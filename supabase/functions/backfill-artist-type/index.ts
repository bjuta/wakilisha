// Compatibility adapter for Artist type proposals/admissions.
// Canonical mutation authority lives in registry-enrich-artist typed admissions.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".wakilisha.africa");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(req, { error: "unauthorized" }, 401);

  let body: {
    dry_run?: boolean;
    approved?: boolean;
    evidence_ids?: string[];
    use_musicbrainz?: boolean;
    force?: boolean;
    batch_size?: number;
    artist_id?: string;
    artist_ids?: string[];
    artist_slug?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_json" }, 400);
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/registry-enrich-artist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      dry_run: body.dry_run !== false,
      approved: body.approved === true,
      evidence_ids: body.evidence_ids,
      batch_size: Math.min(Math.max(Number(body.batch_size) || 20, 1), 50),
      artist_id: body.artist_id,
      artist_ids: body.artist_ids,
      artist_slug: body.artist_slug,
      filter: "missing_type",
      providers: [],
      include_type: true,
      use_musicbrainz: body.use_musicbrainz !== false,
      force: body.force === true,
    }),
  });

  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) return json(req, result, response.status);

  const rawResults = Array.isArray(result.results) ? result.results as Array<Record<string, unknown>> : [];
  let fromHeuristic = 0;
  let fromMusicBrainz = 0;
  const results = rawResults.map((item) => {
    const changes = (item.changes ?? {}) as Record<string, unknown>;
    const typeChange = (changes.type ?? {}) as Record<string, unknown>;
    const source = String(typeChange.source ?? "skipped");
    if (source === "musicbrainz") fromMusicBrainz++;
    else if (typeChange.new) fromHeuristic++;
    return {
      id: item.id,
      slug: item.slug,
      name: item.name,
      previousType: typeChange.old ?? null,
      newType: typeChange.new ?? null,
      heuristic: typeChange.heuristic ?? "",
      source: typeChange.new ? source : "skipped",
      mbType: typeChange.musicbrainzType ?? null,
      confidence: typeChange.score == null ? null : Number(typeChange.score) / 100,
      operation: Array.isArray(item.operations) ? item.operations[0] : null,
      message: item.message,
    };
  });

  return json(req, {
    ok: true,
    dry_run: Boolean(result.dry_run),
    force: Boolean(body.force),
    total_found: Number(result.total_found ?? 0),
    from_heuristic: fromHeuristic,
    from_musicbrainz: fromMusicBrainz,
    skipped: Number(result.skipped ?? 0),
    errors: Number(result.errors ?? 0),
    reviewed_artist_ids: result.reviewed_artist_ids ?? [],
    reviewed_evidence_ids: result.reviewed_evidence_ids ?? [],
    results,
  });
});
