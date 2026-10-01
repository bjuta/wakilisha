import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MUSICBRAINZ_BASE_URL =
  Deno.env.get("MUSICBRAINZ_BASE_URL") ??
  "https://musicbrainz.org/ws/2";
const MUSICBRAINZ_USER_AGENT =
  Deno.env.get("MUSICBRAINZ_USER_AGENT") ??
  "WAKILISHA/1.0 (https://wakilisha.africa)";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith(".wakilisha.africa");
  return {
    "Access-Control-Allow-Origin": allowed
      ? origin
      : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json",
    },
  });
}

function normalizeIsrc(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function nonBlank(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function uniqueById<T extends { id?: unknown }>(rows: T[]) {
  const seen = new Map<string, T>();
  for (const row of rows) {
    const id = nonBlank(row?.id);
    if (id && !seen.has(id)) seen.set(id, row);
  }
  return [...seen.values()];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function providerJson(path: string) {
  const response = await fetch(
    `${MUSICBRAINZ_BASE_URL.replace(/\/$/, "")}${path}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": MUSICBRAINZ_USER_AGENT,
      },
    },
  );

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(
      `MusicBrainz HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  return body as Record<string, unknown>;
}

function recordingWorkRelations(recording: Record<string, unknown>) {
  const relations = Array.isArray(recording.relations)
    ? recording.relations
    : [];

  return uniqueById(
    relations
      .filter((relation) => {
        if (!relation || typeof relation !== "object") return false;
        const row = relation as Record<string, unknown>;
        return (
          row["target-type"] === "work" &&
          row.work &&
          typeof row.work === "object"
        );
      })
      .map((relation) => {
        const row = relation as Record<string, unknown>;
        const work = row.work as Record<string, unknown>;
        return {
          id: work.id,
          title: work.title,
          relationshipType: row.type,
          relationshipAttributes: Array.isArray(row.attributes)
            ? row.attributes
            : [],
        };
      }),
  );
}

function readIswc(work: Record<string, unknown>) {
  if (Array.isArray(work.iswcs)) {
    return nonBlank(work.iswcs[0]);
  }
  if (Array.isArray(work["iswc-list"])) {
    return nonBlank(work["iswc-list"][0]);
  }
  return nonBlank(work.iswc);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return json(req, 405, { error: "method_not_allowed" });
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    return json(req, 500, { error: "missing_supabase_environment" });
  }

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json(req, 401, { error: "authentication_required" });
  }

  const userClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const serviceClient = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const token = authorization.slice(7);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    return json(req, 401, { error: "invalid_session" });
  }

  const { data: canManage, error: capabilityError } =
    await userClient.rpc("current_user_has_capability", {
      required_capability: "manage_registry",
    });

  if (capabilityError || canManage !== true) {
    return json(req, 403, { error: "manage_registry_required" });
  }

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return json(req, 400, { error: "invalid_json" });
  }

  const trackId = nonBlank(input.track_id);
  const isrc = normalizeIsrc(input.isrc);

  if (!trackId || !UUID_RE.test(trackId)) {
    return json(req, 400, { error: "invalid_track_id" });
  }
  if (!ISRC_RE.test(isrc)) {
    return json(req, 400, { error: "invalid_isrc" });
  }

  const { data: track, error: trackError } = await userClient
    .from("registry_tracks")
    .select("id,title,status,isrc")
    .eq("id", trackId)
    .maybeSingle();

  if (trackError || !track) {
    return json(req, 404, { error: "track_not_found" });
  }

  if (track.status === "archived") {
    return json(req, 409, {
      state: "review_required",
      reason: "track_archived",
      track_id: trackId,
    });
  }

  if (normalizeIsrc(track.isrc) !== isrc) {
    return json(req, 409, {
      state: "review_required",
      reason: "track_isrc_changed",
      track_id: trackId,
      requested_isrc: isrc,
      current_isrc: normalizeIsrc(track.isrc),
    });
  }

  let isrcPayload: Record<string, unknown>;
  try {
    isrcPayload = await providerJson(
      `/isrc/${encodeURIComponent(isrc)}?inc=work-rels&fmt=json`,
    );
  } catch (error) {
    return json(req, 502, {
      state: "provider_error",
      provider: "musicbrainz",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const recordings = uniqueById(
    (Array.isArray(isrcPayload.recordings)
      ? isrcPayload.recordings
      : []
    ).filter(
      (recording): recording is Record<string, unknown> =>
        Boolean(recording) && typeof recording === "object",
    ),
  );

  if (recordings.length !== 1) {
    return json(req, 200, {
      state: "review_required",
      reason:
        recordings.length === 0
          ? "musicbrainz_recording_not_found"
          : "musicbrainz_multiple_recordings",
      track_id: trackId,
      isrc,
      recording_count: recordings.length,
    });
  }

  const recording = recordings[0];
  const recordingId = nonBlank(recording.id);
  if (!recordingId || !UUID_RE.test(recordingId)) {
    return json(req, 200, {
      state: "review_required",
      reason: "musicbrainz_recording_identity_invalid",
      track_id: trackId,
      isrc,
    });
  }

  const workRelations = recordingWorkRelations(recording);

  if (workRelations.length !== 1) {
    return json(req, 200, {
      state: "review_required",
      reason:
        workRelations.length === 0
          ? "musicbrainz_work_not_found"
          : "musicbrainz_multiple_works",
      track_id: trackId,
      isrc,
      recording_mbid: recordingId,
      work_count: workRelations.length,
    });
  }

  const relation = workRelations[0];
  const workId = nonBlank(relation.id);
  if (!workId || !UUID_RE.test(workId)) {
    return json(req, 200, {
      state: "review_required",
      reason: "musicbrainz_work_identity_invalid",
      track_id: trackId,
      isrc,
      recording_mbid: recordingId,
    });
  }

  // Public MusicBrainz requires no more than one request per second.
  await sleep(1100);

  let workPayload: Record<string, unknown>;
  try {
    workPayload = await providerJson(
      `/work/${encodeURIComponent(workId)}?inc=artist-rels&fmt=json`,
    );
  } catch (error) {
    return json(req, 502, {
      state: "provider_error",
      provider: "musicbrainz",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const workTitle =
    nonBlank(workPayload.title) ??
    nonBlank(relation.title);

  if (!workTitle) {
    return json(req, 200, {
      state: "review_required",
      reason: "musicbrainz_work_title_missing",
      track_id: trackId,
      isrc,
      recording_mbid: recordingId,
      work_mbid: workId,
    });
  }

  const iswc = readIswc(workPayload);
  const observedAt = new Date().toISOString();

  const sourcePayload = {
    provider_key: "musicbrainz",
    track_id: trackId,
    source_isrc: isrc,
    recording_mbid: recordingId,
    work_mbid: workId,
    work_title: workTitle,
    iswc,
    recording_work_relationship_type:
      nonBlank(relation.relationshipType),
    recording_work_relationship_attributes:
      relation.relationshipAttributes,
    work_type: nonBlank(workPayload.type),
    work_language:
      nonBlank(workPayload.language),
  };

  const { data: observation, error: observationError } =
    await serviceClient.rpc(
      "record_registry_work_provider_observation_v1",
      {
        p_track_id: trackId,
        p_recording_isrc: isrc,
        p_provider_key: "musicbrainz",
        p_provider_recording_id: recordingId,
        p_provider_work_id: workId,
        p_work_title: workTitle,
        p_iswc: iswc,
        p_observed_at: observedAt,
        p_source_payload: sourcePayload,
      },
    );

  if (observationError || !observation) {
    return json(req, 500, {
      state: "observation_failed",
      error: observationError?.message ?? "missing_observation",
    });
  }

  const observationRow = Array.isArray(observation)
    ? observation[0]
    : observation;

  const { data: admitted, error: admissionError } =
    await userClient.rpc(
      "admin_admit_registry_work_provider_observation_v1",
      {
        p_work_evidence_assertion_id:
          observationRow.work_evidence_assertion_id,
        p_track_work_evidence_assertion_id:
          observationRow.track_work_evidence_assertion_id,
      },
    );

  if (admissionError) {
    return json(req, 409, {
      state: "admission_failed",
      track_id: trackId,
      isrc,
      recording_mbid: recordingId,
      work_mbid: workId,
      message: admissionError.message,
    });
  }

  return json(req, 200, {
    state: "verified",
    provider: "musicbrainz",
    track_id: trackId,
    track_title: track.title,
    isrc,
    recording_mbid: recordingId,
    work_mbid: workId,
    work_title: workTitle,
    iswc,
    observation: observationRow,
    admission: admitted,
  });
});
