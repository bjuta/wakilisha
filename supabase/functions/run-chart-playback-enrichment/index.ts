import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

type RequestBody = {
  source_run_id?: string | null;
  chart_program_id?: string | null;
  chart_edition_id?: string | null;
  provider?: string | null;
  storefront?: string | null;
  limit?: number | null;
  min_auto_accept?: number | null;
  write?: boolean | null;
};

type ParsedRequest = {
  sourceRunId: string | null;
  chartProgramId: string | null;
  chartEditionId: string | null;
  provider: "apple_music";
  storefront: string;
  limit: number;
  minAutoAccept: number;
  write: boolean;
};

type EnrichmentItemInsert = {
  run_id: string;
  chart_entry_id: string | null;
  registry_track_id: string | null;
  rank: number | null;
  track_title: string;
  artist_name: string | null;
  isrc?: string | null;
  provider: string;
  storefront: string;
  status: "queued";
  provider_url?: string | null;
  preview_url?: string | null;
  artwork_url?: string | null;
  metadata: Record<string, unknown>;
};

type CandidateLoadResult = {
  items: EnrichmentItemInsert[];
  candidateSource: "wk_chart_entries_v2" | "chart_ingest_candidates";
  candidateSourceId: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isUuidLike(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeOptionalUuid(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return isUuidLike(value) ? value : "__invalid_uuid__";
}

function uuidOrNull(value: unknown): string | null {
  return isUuidLike(value) ? value : null;
}

function cleanRequiredTitle(value: unknown): string {
  const title = typeof value === "string" ? value.trim() : "";
  return title || "Untitled";
}

function cleanOptionalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

async function readCredential(
  db: ReturnType<typeof createClient>,
  envVar: string,
  dbKey: string,
): Promise<string | null> {
  const envValue = Deno.env.get(envVar)?.trim();
  if (envValue) return envValue;

  const { data, error } = await db
    .from("admin_settings_secrets")
    .select("setting_value")
    .eq("setting_key", dbKey)
    .maybeSingle();

  if (error) return null;

  const value = typeof data?.setting_value === "string" ? data.setting_value.trim() : "";
  return value || null;
}

async function assertCanManageCharts(authClient: ReturnType<typeof createClient>): Promise<{
  ok: true;
  userId: string;
} | {
  ok: false;
  status: number;
  error: string;
}> {
  const { data: userData, error: userError } = await authClient.auth.getUser();

  if (userError || !userData.user) {
    return { ok: false, status: 401, error: "not_authenticated" };
  }

  const [{ data: isAdmin, error: adminError }, { data: canManageCharts, error: manageError }] = await Promise.all([
    authClient.rpc("current_user_is_administrator"),
    authClient.rpc("current_user_has_capability", { required_capability: "manage_charts" }),
  ]);

  if (adminError || manageError) {
    return { ok: false, status: 500, error: "capability_check_failed" };
  }

  if (isAdmin !== true && canManageCharts !== true) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true, userId: userData.user.id };
}

function validateBody(raw: RequestBody): {
  ok: true;
  value: ParsedRequest;
} | {
  ok: false;
  error: string;
} {
  const sourceRunId = normalizeOptionalUuid(raw.source_run_id);
  const chartProgramId = normalizeOptionalUuid(raw.chart_program_id);
  const chartEditionId = normalizeOptionalUuid(raw.chart_edition_id);

  if (
    sourceRunId === "__invalid_uuid__"
    || chartProgramId === "__invalid_uuid__"
    || chartEditionId === "__invalid_uuid__"
  ) {
    return { ok: false, error: "invalid_uuid" };
  }

  if (!sourceRunId && !chartProgramId && !chartEditionId) {
    return { ok: false, error: "missing_chart_scope" };
  }

  const provider = (raw.provider ?? "apple_music").trim();
  if (provider !== "apple_music") {
    return { ok: false, error: "unsupported_provider" };
  }

  const storefront = (raw.storefront ?? "ke").trim().toLowerCase();
  if (!/^[a-z]{2,8}$/.test(storefront)) {
    return { ok: false, error: "invalid_storefront" };
  }

  const limit = raw.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return { ok: false, error: "invalid_limit" };
  }

  const minAutoAccept = raw.min_auto_accept ?? 0.9;
  if (typeof minAutoAccept !== "number" || !Number.isFinite(minAutoAccept) || minAutoAccept < 0 || minAutoAccept > 1) {
    return { ok: false, error: "invalid_min_auto_accept" };
  }

  return {
    ok: true,
    value: {
      sourceRunId,
      chartProgramId,
      chartEditionId,
      provider,
      storefront,
      limit,
      minAutoAccept,
      write: raw.write === true,
    },
  };
}

function mapChartEntryToItem(
  runId: string,
  value: ParsedRequest,
  entry: Record<string, unknown>,
): EnrichmentItemInsert {
  return {
    run_id: runId,
    chart_entry_id: uuidOrNull(entry.id),
    registry_track_id: uuidOrNull(entry.canonical_track_id),
    rank: typeof entry.rank === "number" ? entry.rank : null,
    track_title: cleanRequiredTitle(entry.track_title),
    artist_name: cleanOptionalText(entry.artist_name),
    provider: value.provider,
    storefront: value.storefront,
    status: "queued",
    artwork_url: cleanOptionalText(entry.artwork_url),
    metadata: {
      candidate_source: "wk_chart_entries_v2",
      normalized_key: cleanOptionalText(entry.normalized_key),
      release_date: cleanOptionalText(entry.release_date),
    },
  };
}

function mapIngestCandidateToItem(
  runId: string,
  value: ParsedRequest,
  candidate: Record<string, unknown>,
): EnrichmentItemInsert {
  return {
    run_id: runId,
    chart_entry_id: null,
    registry_track_id: null,
    rank: null,
    track_title: cleanRequiredTitle(candidate.title),
    artist_name: cleanOptionalText(candidate.artist_display),
    isrc: cleanOptionalText(candidate.isrc),
    provider: value.provider,
    storefront: value.storefront,
    status: "queued",
    provider_url: cleanOptionalText(candidate.external_url),
    preview_url: cleanOptionalText(candidate.preview_url),
    artwork_url: cleanOptionalText(candidate.artwork_url),
    metadata: {
      candidate_source: "chart_ingest_candidates",
      candidate_id: uuidOrNull(candidate.id),
      normalized_key: cleanOptionalText(candidate.normalized_key),
      release_date: cleanOptionalText(candidate.release_date),
    },
  };
}

async function loadChartEntries(
  db: ReturnType<typeof createClient>,
  runId: string,
  value: ParsedRequest,
  editionId: string,
): Promise<CandidateLoadResult> {
  const { data, error } = await db
    .from("wk_chart_entries_v2")
    .select("id, canonical_track_id, rank, track_title, artist_name, artwork_url, normalized_key, release_date")
    .eq("edition_id", editionId)
    .order("rank", { ascending: true })
    .limit(value.limit);

  if (error) throw new Error(`failed_to_load_chart_entries: ${error.message}`);

  return {
    items: (data ?? []).map((entry: Record<string, unknown>) => mapChartEntryToItem(runId, value, entry)),
    candidateSource: "wk_chart_entries_v2",
    candidateSourceId: editionId,
  };
}

async function loadIngestCandidates(
  db: ReturnType<typeof createClient>,
  runId: string,
  value: ParsedRequest,
  sourceRunId: string,
): Promise<CandidateLoadResult> {
  const { data, error } = await db
    .from("chart_ingest_candidates")
    .select("id, title, artist_display, isrc, external_url, preview_url, artwork_url, normalized_key, release_date")
    .eq("run_id", sourceRunId)
    .eq("status", "eligible")
    .order("created_at", { ascending: true })
    .limit(value.limit);

  if (error) throw new Error(`failed_to_load_ingest_candidates: ${error.message}`);

  return {
    items: (data ?? []).map((candidate: Record<string, unknown>) => mapIngestCandidateToItem(runId, value, candidate)),
    candidateSource: "chart_ingest_candidates",
    candidateSourceId: sourceRunId,
  };
}

async function loadCandidates(
  db: ReturnType<typeof createClient>,
  runId: string,
  value: ParsedRequest,
): Promise<CandidateLoadResult> {
  if (value.chartEditionId) {
    return await loadChartEntries(db, runId, value, value.chartEditionId);
  }

  if (value.sourceRunId) {
    const { data: sourceRun, error } = await db
      .from("chart_ingest_runs")
      .select("id, commit_edition_id")
      .eq("id", value.sourceRunId)
      .maybeSingle();

    if (error) throw new Error(`failed_to_load_source_run: ${error.message}`);
    if (!sourceRun) throw new Error("source_run_not_found");

    const commitEditionId = uuidOrNull(sourceRun.commit_edition_id);
    if (commitEditionId) {
      return await loadChartEntries(db, runId, value, commitEditionId);
    }

    return await loadIngestCandidates(db, runId, value, value.sourceRunId);
  }

  if (value.chartProgramId) {
    const { data: edition, error } = await db
      .from("wk_chart_editions_v2")
      .select("id")
      .eq("program_id", value.chartProgramId)
      .in("status", ["committed", "published"])
      .order("edition_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`failed_to_load_latest_edition: ${error.message}`);

    const editionId = uuidOrNull(edition?.id);
    if (!editionId) {
      return {
        items: [],
        candidateSource: "wk_chart_entries_v2",
        candidateSourceId: null,
      };
    }

    return await loadChartEntries(db, runId, value, editionId);
  }

  return {
    items: [],
    candidateSource: "wk_chart_entries_v2",
    candidateSourceId: null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ ok: false, error: "server_not_configured" }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ ok: false, error: "not_authenticated" }, 401);
  }

  const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_KEY, {
    global: { headers: { Authorization: authorization } },
  });

  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

  const access = await assertCanManageCharts(authClient);
  if (!access.ok) {
    return jsonResponse({ ok: false, error: access.error }, access.status);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const parsed = validateBody(body);
  if (!parsed.ok) {
    return jsonResponse({ ok: false, error: parsed.error }, 400);
  }

  const [privateKey, teamId, keyId] = await Promise.all([
    readCredential(serviceClient, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key"),
    readCredential(serviceClient, "APPLE_MUSIC_TEAM_ID", "apple_music_team_id"),
    readCredential(serviceClient, "APPLE_MUSIC_KEY_ID", "apple_music_key_id"),
  ]);

  const missing = [
    !privateKey && "APPLE_MUSIC_PRIVATE_KEY",
    !teamId && "APPLE_MUSIC_TEAM_ID",
    !keyId && "APPLE_MUSIC_KEY_ID",
  ].filter(Boolean);

  if (missing.length > 0) {
    return jsonResponse({ ok: false, error: "missing_credentials", missing }, 400);
  }

  const value = parsed.value;

  const { data, error } = await serviceClient
    .from("wk_chart_playback_enrichment_runs")
    .insert({
      source_run_id: value.sourceRunId,
      chart_program_id: value.chartProgramId,
      chart_edition_id: value.chartEditionId,
      provider: value.provider,
      storefront: value.storefront,
      status: "queued",
      write_mode: value.write,
      min_auto_accept: value.minAutoAccept,
      requested_by: access.userId,
      metadata: {
        limit: value.limit,
        phase: "skeleton",
      },
    })
    .select("id,status")
    .single();

  if (error || !data) {
    return jsonResponse({ ok: false, error: "insert_failed" }, 500);
  }

  const runId = data.id as string;

  try {
    const loaded = await loadCandidates(serviceClient, runId, value);

    for (let i = 0; i < loaded.items.length; i += 100) {
      const chunk = loaded.items.slice(i, i + 100);
      const { error: itemInsertError } = await serviceClient
        .from("wk_chart_playback_enrichment_items")
        .insert(chunk);

      if (itemInsertError) {
        throw new Error(`failed_to_insert_candidates: ${itemInsertError.message}`);
      }
    }

    const runMetadata = {
      limit: value.limit,
      phase: "candidate_loading",
      candidate_source: loaded.candidateSource,
      candidate_source_id: loaded.candidateSourceId,
      loaded_at: new Date().toISOString(),
    };

    await serviceClient
      .from("wk_chart_playback_enrichment_runs")
      .update({
        total_candidates: loaded.items.length,
        metadata: runMetadata,
      })
      .eq("id", runId);

    return jsonResponse({
      ok: true,
      run_id: runId,
      status: "queued",
      total_candidates: loaded.items.length,
      candidate_source: loaded.candidateSource,
    }, 201);
  } catch (candidateError: unknown) {
    const message = candidateError instanceof Error ? candidateError.message : String(candidateError);

    await serviceClient
      .from("wk_chart_playback_enrichment_runs")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", runId);

    return jsonResponse({
      ok: false,
      run_id: runId,
      error: message,
    }, 500);
  }
});
