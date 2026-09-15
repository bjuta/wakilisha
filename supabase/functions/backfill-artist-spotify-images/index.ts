// Compatibility adapter for Artist Spotify image enrichment.
// Canonical Registry mutation authority lives in registry-enrich-artist typed admissions.

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
      batch_size: Math.min(Math.max(Number(body.batch_size) || 20, 1), 50),
      artist_id: body.artist_id,
      artist_ids: body.artist_ids,
      artist_slug: body.artist_slug,
      filter: "missing_image",
      providers: ["spotify"],
      include_type: false,
      force: false,
    }),
  });

  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) return json(req, result, response.status);

  const rawResults = Array.isArray(result.results) ? result.results as Array<Record<string, unknown>> : [];
  const results = rawResults.map((item) => {
    const changes = (item.changes ?? {}) as Record<string, unknown>;
    const image = (changes.image ?? {}) as Record<string, unknown>;
    const status = String(item.status ?? "skipped");
    return {
      id: item.id,
      slug: item.slug,
      name: item.name,
      spotify_id: null,
      status: status === "updated" ? "updated" : status === "no_data" ? "no_image" : status,
      old_image: image.old ?? null,
      new_image: image.new ?? null,
      message: item.message,
    };
  });

  return json(req, {
    ok: true,
    dry_run: Boolean(result.dry_run),
    total_found: Number(result.total_found ?? 0),
    updated: Number(result.updated ?? 0),
    skipped: Number(result.skipped ?? 0),
    no_image: Number(result.no_data ?? 0),
    errors: Number(result.errors ?? 0),
    reviewed_artist_ids: result.reviewed_artist_ids ?? [],
    results,
  });
});
