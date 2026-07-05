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
  value: {
    sourceRunId: string | null;
    chartProgramId: string | null;
    chartEditionId: string | null;
    provider: "apple_music";
    storefront: string;
    limit: number;
    minAutoAccept: number;
    write: boolean;
  };
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

  return jsonResponse({
    ok: true,
    run_id: data.id,
    status: data.status,
  }, 201);
});
