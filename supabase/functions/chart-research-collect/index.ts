import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  D11B_ADAPTER_VERSION,
  D11B_PROTOCOL_VERSION,
  D11B_SOURCE_CONSTITUTION_VERSION,
  appleSourceKey,
  buildYouTubeWeeklyRequest,
  expectedSourceKeys,
  parseAppleTop100,
  parseAudiomackWeekly100,
  parseYouTubeWeeklyChart,
  type ParsedResearchRow,
  type ParsedSourcePayload,
  type QualifiedSource,
  validateCanonicalD11BWindow,
} from "./adapters.ts";
import { dueD11BCollectionTargets } from "./schedule.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const USER_AGENT =
  "Mozilla/5.0 (compatible; WAKILISHA-D11B-Research/1.0; +https://wakilisha.africa)";

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

type Db = ReturnType<typeof createClient>;

type IdentityResult = {
  canonicalTrackId: string | null;
  status: "resolved" | "unresolved" | "quarantined";
  confidence: "verified" | "high" | "medium" | "low" | "unknown";
  method: string;
};

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith(".wakilisha.africa");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

function serviceDb(): Db {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function authorize(req: Request, db: Db): Promise<boolean> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  if (token === SERVICE_KEY) return true;

  const callerDb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });
  const { data: { user }, error } = await callerDb.auth.getUser(token);
  if (error || !user) return false;
  const cap = await callerDb.rpc("current_user_has_capability", {
    required_capability: "manage_ingest",
  });
  return !cap.error && cap.data === true;
}

async function sha256Text(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function methodologyVersion(source: QualifiedSource): string {
  if (source === "youtube") return "youtube-weekly-top-songs-help-9014376+d007";
  if (source === "audiomack") return "audiomack-weekly100-geo+d007";
  return "apple-most-played-top100-ke+d007";
}

function providerKey(source: QualifiedSource): string {
  if (source === "apple") return "apple_music";
  return source;
}

function sourceFamily(source: QualifiedSource): string {
  return source === "youtube" ? "video_consumption" : "audio_consumption";
}

async function currentTrackId(
  db: Db,
  trackId: string,
): Promise<string | null> {
  const { data, error } = await db.rpc("resolve_registry_identity_lineage_v1", {
    p_entity_type: "track",
    p_entity_id: trackId,
    p_max_depth: 16,
  });
  if (error || !data) return null;
  const rows = Array.isArray(data) ? data : [data];
  const currentIds = new Set<string>();
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const id = String(
      row.current_entity_id ?? row.current_track_id ?? row.entity_id ?? "",
    ).trim();
    const status = String(row.status ?? row.resolution_status ?? "").toLowerCase();
    if (id && !status.includes("split") && !status.includes("ambiguous")) {
      currentIds.add(id);
    }
  }
  return currentIds.size === 1 ? [...currentIds][0] : null;
}

function confidenceFromLink(value: unknown): IdentityResult["confidence"] {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "unknown";
  if (numeric >= 0.99) return "verified";
  if (numeric >= 0.95) return "high";
  if (numeric >= 0.8) return "medium";
  return "low";
}

async function resolveIdentity(
  db: Db,
  source: QualifiedSource,
  row: ParsedResearchRow,
): Promise<IdentityResult> {
  if (row.providerTrackId) {
    const { data, error } = await db
      .from("registry_track_provider_links")
      .select(
        "track_id,match_confidence,match_method,match_status",
      )
      .eq("provider_key", providerKey(source))
      .eq("provider_track_id", row.providerTrackId)
      .eq("match_status", "matched");

    if (!error && data && data.length > 0) {
      const candidates = new Map<string, { confidence: unknown; method: string }>();
      for (const link of data) {
        const trackId = String(link.track_id ?? "").trim();
        if (!trackId) continue;
        candidates.set(trackId, {
          confidence: link.match_confidence,
          method: String(link.match_method ?? "provider_id"),
        });
      }
      if (candidates.size > 1) {
        return {
          canonicalTrackId: null,
          status: "quarantined",
          confidence: "unknown",
          method: "provider_id_multiple_matches",
        };
      }
      if (candidates.size === 1) {
        const [trackId, meta] = [...candidates.entries()][0];
        const current = await currentTrackId(db, trackId);
        if (!current) {
          return {
            canonicalTrackId: null,
            status: "quarantined",
            confidence: "unknown",
            method: "provider_id_lineage_unresolved",
          };
        }
        return {
          canonicalTrackId: current,
          status: "resolved",
          confidence: confidenceFromLink(meta.confidence),
          method: `provider_id:${meta.method}`,
        };
      }
    }
  }

  if (row.isrc) {
    const { data, error } = await db
      .from("registry_tracks")
      .select("id,isrc,status")
      .eq("isrc", row.isrc)
      .eq("status", "active");
    if (!error && data) {
      const ids = [...new Set(data.map((track) => String(track.id)))];
      if (ids.length > 1) {
        return {
          canonicalTrackId: null,
          status: "quarantined",
          confidence: "unknown",
          method: "isrc_multiple_matches",
        };
      }
      if (ids.length === 1) {
        const current = await currentTrackId(db, ids[0]);
        if (current) {
          return {
            canonicalTrackId: current,
            status: "resolved",
            confidence: "verified",
            method: "isrc",
          };
        }
      }
    }
  }

  return {
    canonicalTrackId: null,
    status: "unresolved",
    confidence: "unknown",
    method: "no_strong_registry_match",
  };
}

async function fetchSource(
  source: QualifiedSource,
  trackingStart: string,
  trackingEnd: string,
  checkpointDate?: string,
): Promise<{ parsed: ParsedSourcePayload; raw: string; url: string }> {
  if (source === "youtube") {
    const url = "https://charts.youtube.com/youtubei/v1/browse?alt=json";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildYouTubeWeeklyRequest(trackingStart, trackingEnd),
      ),
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`youtube_http_${response.status}`);
    return {
      parsed: parseYouTubeWeeklyChart(
        JSON.parse(raw),
        trackingStart,
        trackingEnd,
      ),
      raw,
      url,
    };
  }

  if (source === "audiomack") {
    const url = "https://audiomack.com/geo-charts/playlist/kenya";
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`audiomack_http_${response.status}`);
    return { parsed: parseAudiomackWeekly100(raw), raw, url };
  }

  if (!checkpointDate) throw new Error("apple_checkpoint_date_required");
  const url =
    "https://rss.applemarketingtools.com/api/v2/ke/music/most-played/100/songs.json";
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`apple_http_${response.status}`);
  return {
    parsed: parseAppleTop100(JSON.parse(raw), checkpointDate),
    raw,
    url,
  };
}

function observationPeriod(
  source: QualifiedSource,
  trackingStart: string,
  trackingEnd: string,
  checkpointDate?: string,
): { start: string; end: string; authority: string } {
  if (source === "youtube") {
    return {
      start: trackingStart,
      end: trackingEnd,
      authority: "provider_explicit_weekly_period",
    };
  }
  if (source === "audiomack") {
    return {
      start: trackingStart,
      end: trackingEnd,
      authority: "d11b_tracking_window_provider_native_range_unknown",
    };
  }
  if (!checkpointDate) throw new Error("apple_checkpoint_date_required");
  return {
    start: `${checkpointDate}T00:00:00.000Z`,
    end: `${checkpointDate}T23:59:59.999Z`,
    authority: "d11b_daily_checkpoint_bucket_provider_window_unspecified",
  };
}

async function ensureWindow(
  db: Db,
  trackingStart: string,
  trackingEnd: string,
): Promise<Record<string, unknown>> {
  validateCanonicalD11BWindow(trackingStart, trackingEnd);

  const existing = await db
    .from("chart_research_windows")
    .select("*")
    .eq("tracking_start", trackingStart)
    .eq("tracking_end", trackingEnd)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) {
    if (existing.data.phase !== "engineering_pilot") {
      throw new Error("existing_window_not_engineering_pilot");
    }
    return existing.data as Record<string, unknown>;
  }

  const inserted = await db
    .from("chart_research_windows")
    .insert({
      tracking_start: trackingStart,
      tracking_end: trackingEnd,
      phase: "engineering_pilot",
      protocol_version: D11B_PROTOCOL_VERSION,
      source_constitution_version: D11B_SOURCE_CONSTITUTION_VERSION,
      expected_source_keys: expectedSourceKeys(trackingStart, trackingEnd),
      collection_state: "collecting",
      notes:
        "Engineering pilot only. Not D11B qualification authority until L034-L037 freeze.",
    })
    .select("*")
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data as Record<string, unknown>;
}

function sourceKey(
  source: QualifiedSource,
  checkpointDate?: string,
): string {
  if (source === "youtube") return "youtube_weekly_ke";
  if (source === "audiomack") return "audiomack_weekly100_ke";
  if (!checkpointDate) throw new Error("apple_checkpoint_date_required");
  return appleSourceKey(checkpointDate);
}

async function collectOne(
  db: Db,
  windowId: string,
  source: QualifiedSource,
  checkpointDate?: string,
): Promise<Record<string, unknown>> {
  const windowResult = await db
    .from("chart_research_windows")
    .select("*")
    .eq("id", windowId)
    .single();
  if (windowResult.error || !windowResult.data) {
    throw new Error("research_window_not_found");
  }
  const window = windowResult.data as Record<string, unknown>;
  if (window.phase !== "engineering_pilot") {
    throw new Error("qualification_collection_not_authorized");
  }

  const trackingStart = String(window.tracking_start);
  const trackingEnd = String(window.tracking_end);
  validateCanonicalD11BWindow(trackingStart, trackingEnd);
  const key = sourceKey(source, checkpointDate);
  const expected = Array.isArray(window.expected_source_keys)
    ? window.expected_source_keys.map(String)
    : [];
  if (!expected.includes(key)) throw new Error("source_not_expected_for_window");

  const existing = await db
    .from("chart_research_source_runs")
    .select("id,fetch_status,parse_status,row_count,health_state")
    .eq("window_id", windowId)
    .eq("source_key", key)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (
    existing.data?.fetch_status === "succeeded" &&
    existing.data?.parse_status === "succeeded"
  ) {
    const count = await db
      .from("chart_research_observations")
      .select("id", { count: "exact", head: true })
      .eq("source_run_id", existing.data.id);
    if (!count.error && (count.count ?? 0) > 0) {
      return {
        ok: true,
        idempotent: true,
        source_run_id: existing.data.id,
        observation_count: count.count,
      };
    }
  }

  const startedAt = new Date().toISOString();
  let raw = "";
  let parsed: ParsedSourcePayload | null = null;
  let url = "";
  try {
    const fetched = await fetchSource(
      source,
      trackingStart,
      trackingEnd,
      checkpointDate,
    );
    raw = fetched.raw;
    parsed = fetched.parsed;
    url = fetched.url;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const payloadHash = raw ? await sha256Text(raw) : null;
    const failed = await db
      .from("chart_research_source_runs")
      .upsert({
        window_id: windowId,
        source_key: key,
        provider: providerKey(source),
        source_family: sourceFamily(source),
        source_surface: key,
        provider_market: "KE",
        expected: true,
        fetch_started_at: startedAt,
        fetch_finished_at: new Date().toISOString(),
        fetch_status: message.includes("http_") ? "failed" : "succeeded",
        parse_status: message.includes("http_") ? "not_applicable" : "failed",
        row_count: 0,
        censoring_type: "top_n",
        payload_hash: payloadHash,
        health_state: message.includes("http_") ? "down" : "parse_failed",
        failure_reason: message,
        adapter_version: D11B_ADAPTER_VERSION,
        source_methodology_version: methodologyVersion(source),
        territorial_confidence: "provider_defined",
        receipt_json: {
          source_url: url || null,
          checkpoint_date: checkpointDate ?? null,
          error: message,
        },
      }, { onConflict: "window_id,source_key" })
      .select("id")
      .single();
    if (failed.error) throw failed.error;
    return {
      ok: false,
      source_run_id: failed.data.id,
      source: key,
      error: message,
    };
  }

  const payloadHash = await sha256Text(raw);
  const health = parsed.chartDepth >= 100 ? "healthy" : "degraded";
  const run = await db
    .from("chart_research_source_runs")
    .upsert({
      window_id: windowId,
      source_key: key,
      provider: providerKey(source),
      source_family: sourceFamily(source),
      source_surface: parsed.sourceSurface,
      provider_market: parsed.providerMarket,
      expected: true,
      fetch_started_at: startedAt,
      fetch_finished_at: new Date().toISOString(),
      fetch_status: "succeeded",
      parse_status: "succeeded",
      row_count: parsed.rows.length,
      chart_depth: parsed.chartDepth,
      censoring_type: parsed.censoringType,
      payload_hash: payloadHash,
      health_state: health,
      failure_reason: null,
      adapter_version: D11B_ADAPTER_VERSION,
      source_methodology_version: methodologyVersion(source),
      territorial_confidence: "provider_defined",
      receipt_json: {
        ...parsed.receipt,
        source_url: url,
        checkpoint_date: checkpointDate ?? null,
        payload_hash: payloadHash,
      },
    }, { onConflict: "window_id,source_key" })
    .select("id")
    .single();
  if (run.error) throw run.error;

  const period = observationPeriod(
    source,
    trackingStart,
    trackingEnd,
    checkpointDate,
  );
  const capturedAt = new Date().toISOString();
  const observations: Record<string, unknown>[] = [];

  for (const row of parsed.rows) {
    const identity = await resolveIdentity(db, source, row);
    observations.push({
      window_id: windowId,
      source_run_id: run.data.id,
      provider: providerKey(source),
      source_family: sourceFamily(source),
      source_surface: parsed.sourceSurface,
      provider_market: parsed.providerMarket,
      provider_row_key: row.providerRowKey,
      provider_track_id: row.providerTrackId,
      provider_release_id: row.providerReleaseId,
      provider_artist_ids: row.providerArtistIds,
      isrc: row.isrc,
      canonical_track_id: identity.canonicalTrackId,
      identity_status: identity.status,
      identity_confidence: identity.confidence,
      rank: row.rank,
      chart_depth: row.chartDepth,
      censoring_type: parsed.censoringType,
      metric_name: row.metricName,
      metric_value: row.metricValue,
      metric_unit: row.metricUnit,
      period_start: period.start,
      period_end: period.end,
      captured_at: capturedAt,
      behavior_class: "consumption",
      officiality_class: "official_chart",
      territorial_confidence: "provider_defined",
      missingness_state:
        identity.status === "resolved" ? "observed" : "identity_unresolved",
      raw_payload_hash: payloadHash,
      raw_payload_ref: {
        ...row.rawPayloadRef,
        source_key: key,
        source_url: url,
        period_authority: period.authority,
        identity_resolution_method: identity.method,
      },
      adapter_version: D11B_ADAPTER_VERSION,
      source_methodology_version: methodologyVersion(source),
    });
  }

  for (let offset = 0; offset < observations.length; offset += 200) {
    const chunk = observations.slice(offset, offset + 200);
    const inserted = await db.from("chart_research_observations").insert(chunk);
    if (inserted.error) {
      await db
        .from("chart_research_source_runs")
        .update({
          health_state: "degraded",
          failure_reason: `observation_insert_failed:${inserted.error.message}`,
        })
        .eq("id", run.data.id);
      throw inserted.error;
    }
  }

  return {
    ok: true,
    idempotent: false,
    source_run_id: run.data.id,
    source: key,
    observation_count: observations.length,
    resolved_count: observations.filter((row) =>
      row.identity_status === "resolved"
    ).length,
    unresolved_count: observations.filter((row) =>
      row.identity_status !== "resolved"
    ).length,
    health_state: health,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors(req) });
  }
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const db = serviceDb();
  if (!await authorize(req, db)) return json(req, { error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_json" }, 400);
  }

  try {
    const action = String(body.action ?? "");
    if (action === "ensure_window") {
      const trackingStart = String(body.trackingStart ?? "");
      const trackingEnd = String(body.trackingEnd ?? "");
      const window = await ensureWindow(db, trackingStart, trackingEnd);
      return json(req, { ok: true, window });
    }

    if (action === "collect_due") {
      const windowId = String(body.windowId ?? "");
      const now = body.now ? String(body.now) : new Date().toISOString();
      if (!windowId) return json(req, { error: "windowId_required" }, 400);

      const windowResult = await db
        .from("chart_research_windows")
        .select("*")
        .eq("id", windowId)
        .single();
      if (windowResult.error || !windowResult.data) {
        return json(req, { error: "research_window_not_found" }, 404);
      }
      if (windowResult.data.phase !== "engineering_pilot") {
        return json(req, { error: "qualification_collection_not_authorized" }, 409);
      }

      const sourceRuns = await db
        .from("chart_research_source_runs")
        .select("source_key,fetch_status,parse_status")
        .eq("window_id", windowId);
      if (sourceRuns.error) throw sourceRuns.error;

      const completedKeys = (sourceRuns.data ?? [])
        .filter((row) =>
          row.fetch_status === "succeeded" &&
          row.parse_status === "succeeded"
        )
        .map((row) => String(row.source_key));

      const due = dueD11BCollectionTargets(
        String(windowResult.data.tracking_start),
        String(windowResult.data.tracking_end),
        now,
        completedKeys,
      );

      const results: Record<string, unknown>[] = [];
      for (const target of due) {
        results.push(await collectOne(
          db,
          windowId,
          target.source,
          "checkpointDate" in target ? target.checkpointDate : undefined,
        ));
      }

      return json(req, {
        ok: results.every((result) => result.ok !== false),
        due_count: due.length,
        results,
      });
    }

    if (action === "collect_source") {
      const windowId = String(body.windowId ?? "");
      const source = String(body.source ?? "") as QualifiedSource;
      const checkpointDate = body.checkpointDate
        ? String(body.checkpointDate)
        : undefined;
      if (!windowId) return json(req, { error: "windowId_required" }, 400);
      if (!["youtube", "audiomack", "apple"].includes(source)) {
        return json(req, { error: "source_not_in_frozen_constitution" }, 400);
      }
      const result = await collectOne(
        db,
        windowId,
        source,
        checkpointDate,
      );
      return json(req, result, result.ok === false ? 424 : 200);
    }

    return json(req, { error: "unknown_action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[chart-research-collect]", message);
    return json(req, { error: "research_collection_failed", detail: message }, 500);
  }
});
