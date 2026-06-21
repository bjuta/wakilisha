// Backfill Artist Type
// Phase 1: Name-based heuristics to classify artist as solo, group, band, duo, or collective
// Phase 2 (optional): MusicBrainz verification for ambiguous cases

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://readdy.ai",
  "https://readdy.cc",
  "http://localhost:5173",
  "http://localhost:3000",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ─── Name heuristics ───

type ArtistTypeResult = "solo" | "group" | "band" | "duo" | "collective";

function classifyArtistType(name: string): { type: ArtistTypeResult; heuristic: string } {
  const n = name.trim();

  // Normalize for matching: lowercase, collapse whitespace
  const lower = n.toLowerCase().replace(/\s+/g, " ");

  // ── Specific: band ──
  const bandPatterns = [
    /\bband\b/, /\bband\b/i,
    /boys\b/i, /boyz\b/i,
    /orchestra\b/i,
    /ensemble\b/i,
    /quartet\b/i, /quintet\b/i,
    /symphony\b/i,
    /philharmonic\b/i,
  ];
  for (const pat of bandPatterns) {
    if (pat.test(lower)) return { type: "band", heuristic: `name contains "${pat.source.replace(/\\b/g, "").replace(/\bi\b/, "")}"` };
  }

  // ── Specific: duo ──
  if (/\bduo\b/i.test(lower)) return { type: "duo", heuristic: "name contains \"duo\"" };
  if (/\btrio\b/i.test(lower)) return { type: "group", heuristic: "name contains \"trio\" → group" };

  // ── Specific: collective ──
  if (/\bcollective\b/i.test(lower)) return { type: "collective", heuristic: "name contains \"collective\"" };
  if (/\bcrew\b/i.test(lower)) return { type: "collective", heuristic: "name contains \"crew\"" };
  if (/\bfamily\b/i.test(lower)) return { type: "collective", heuristic: "name contains \"family\"" };
  if (/\ball.stars?\b/i.test(lower)) return { type: "collective", heuristic: "name contains \"all star(s)\"" };

  // ── Group indicators: "The X" pattern (but not "Thee" which is different) ──
  if (/^the\s+\w/i.test(lower) && !/^the\s+(great|best|real|one|only|late)\b/i.test(lower)) {
    return { type: "group", heuristic: "name starts with \"The\" → group" };
  }

  // ── Group indicators: "X & Y", "X and Y" ──
  if (/\s+[&]\s+/i.test(n)) return { type: "group", heuristic: "name contains \"&\" → group/collab" };
  if (/\band\b/i.test(lower)) {
    // "and" could be a group name or just part of a compound name like "Time and Gold"
    // If "and" is between two name-like tokens, treat as group
    const parts = lower.split(/\s+/);
    const andIdx = parts.findIndex((p) => p === "and");
    if (andIdx > 0 && andIdx < parts.length - 1) {
      return { type: "group", heuristic: "name contains \"X and Y\" pattern → group" };
    }
  }

  // ── Group indicators: gang, squad, unit, mob ──
  if (/\bgang\b/i.test(lower)) return { type: "group", heuristic: "name contains \"gang\"" };
  if (/\bsquad\b/i.test(lower)) return { type: "group", heuristic: "name contains \"squad\"" };
  if (/\bunit\b/i.test(lower)) return { type: "group", heuristic: "name contains \"unit\"" };
  if (/\bmob\b/i.test(lower)) return { type: "group", heuristic: "name contains \"mob\"" };

  // ── Group indicators: "ft." / "feat." / "w/" patterns ──
  if (/\bft[.\s]/i.test(lower)) return { type: "group", heuristic: "name contains \"ft.\" → collab/group" };
  if (/\bfeat[.\s]/i.test(lower)) return { type: "group", heuristic: "name contains \"feat.\" → collab/group" };

  // ── Group indicators: "x" between two words (collab marker) ──
  if (/\b\w+\s+x\s+\w+\b/i.test(n)) return { type: "group", heuristic: "name contains \"X\" between words → collab/group" };

  // ── Group indicators: plural collective terms ──
  if (/\b(guys|gents|lads|ladies|kings|queens|princes|princesses|legends|giants|titans|heroes|stars|legends|brothers|sisters)\b/i.test(lower)) {
    return { type: "group", heuristic: `name contains collective plural "${lower.match(/\b(guys|gents|lads|ladies|kings|queens|princes|princesses|legends|giants|titans|heroes|stars|legends|brothers|sisters)\b/i)?.[0]}" → group` };
  }

  // ── DJ prefix: solo unless followed by group indicators ──
  if (/^dj\s+/i.test(lower)) return { type: "solo", heuristic: "name starts with \"DJ\"" };

  // ── MC prefix: solo ──
  if (/^mc\s+/i.test(lower)) return { type: "solo", heuristic: "name starts with \"MC\"" };

  // ── Default: solo ──
  // Most names that don't match group patterns are solo artists
  return { type: "solo", heuristic: "no group indicators found → default solo" };
}

// ─── Name normalization for MusicBrainz comparison ───

function normalizeName(n: string): string {
  return n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesAreClose(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = new Set(na.split(" ").filter(Boolean));
  const wb = new Set(nb.split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return false;
  let overlap = 0;
  for (const w of wa) { if (wb.has(w)) overlap++; }
  return overlap / Math.max(wa.size, wb.size) >= 0.7;
}

// ─── MusicBrainz lookup ───

interface MusicBrainzArtist {
  id: string;
  name: string;
  type?: string;
  score?: number;
}

const MB_TYPE_MAP: Record<string, ArtistTypeResult | null> = {
  "Person": "solo",
  "Group": "group",
  "Orchestra": "band",
  "Choir": "group",
  "Character": "solo",
  "Other": null,
};

async function searchMusicBrainzArtist(query: string): Promise<MusicBrainzArtist[]> {
  try {
    const url = new URL("https://musicbrainz.org/ws/2/artist/");
    url.searchParams.set("query", `artist:"${query}"`);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", "3");
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Wakilisha/1.0 (admin@wakilisha.africa)",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json() as { artists?: MusicBrainzArtist[] };
    return data?.artists ?? [];
  } catch {
    return [];
  }
}

async function resolveMusicBrainzType(
  displayName: string,
  normalizedName: string,
): Promise<{ type: ArtistTypeResult | null; mbType: string | null; mbId: string | null; confidence: number }> {
  const queries = new Map<string, string>();
  queries.set(displayName, "display_name");
  if (normalizedName && normalizedName !== displayName) {
    queries.set(normalizedName, "normalized_name");
  }

  for (const [q, label] of queries) {
    const results = await searchMusicBrainzArtist(q);
    for (const mb of results) {
      if (!mb.type) continue;
      if (namesAreClose(mb.name, displayName) || namesAreClose(mb.name, normalizedName || displayName)) {
        const mapped = MB_TYPE_MAP[mb.type] ?? null;
        const scoreConfidence = Math.min((mb.score ?? 50) / 100, 1.0);
        const nameBonus = normalizeName(mb.name) === normalizeName(displayName) ? 0.1 : 0;
        const confidence = Math.round(Math.min(scoreConfidence + nameBonus, 1.0) * 10000) / 10000;
        return { type: mapped, mbType: mb.type, mbId: mb.id, confidence };
      }
    }
    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return { type: null, mbType: null, mbId: null, confidence: 0 };
}

// ─── Result types ───

interface TypeResult {
  slug: string;
  name: string;
  previousType: string | null;
  newType: string | null;
  heuristic: string;
  source: "name_heuristic" | "musicbrainz" | "skipped";
  mbType?: string | null;
  confidence?: number;
}

// ─── Main handler ───

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  if (req.method !== "POST") {
    return json(req, { error: "method_not_allowed" }, 405);
  }

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(req, { error: "unauthorized" }, 401);
  }
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
  if (authErr || !user) {
    return json(req, { error: "unauthorized" }, 401);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* no body */ }

  const dryRun = body.dry_run === true;
  const useMusicBrainz = body.use_musicbrainz !== false;
  const force = body.force === true;
  const batchSize = Math.min(Number(body.batch_size) || 150, 300);

  // Fetch active/published artists
  let query = db
    .from("registry_artists")
    .select("id, slug, display_name, normalized_name, artist_type, status")
    .in("status", ["active", "draft"]);

  if (!force) {
    query = query.or("artist_type.is.null,artist_type.eq.unknown");
  }

  query = query.limit(batchSize);

  const { data: artists, error: fetchErr } = await query;

  if (fetchErr) {
    return json(req, { error: "db_query_failed", detail: fetchErr.message }, 500);
  }

  if (!artists || artists.length === 0) {
    return json(req, {
      ok: true,
      message: "All artists already have a type set.",
      total_found: 0,
      results: [],
    });
  }

  const results: TypeResult[] = [];
  let fromHeuristic = 0;
  let fromMusicBrainz = 0;
  let skipped = 0;

  for (const artist of artists) {
    const displayName = String(artist.display_name || artist.slug);
    const normalizedName = String(artist.normalized_name || "");

    // Phase 1: Name heuristic
    const { type: heuristicType, heuristic } = classifyArtistType(displayName);

    // Phase 2: Optional MusicBrainz verification
    let mbResult: Awaited<ReturnType<typeof resolveMusicBrainzType>> | null = null;
    if (useMusicBrainz) {
      mbResult = await resolveMusicBrainzType(displayName, normalizedName);
    }

    // Decide final type: prefer MusicBrainz if it agrees or overrides with high confidence
    let finalType: ArtistTypeResult | null = heuristicType;
    let source: "name_heuristic" | "musicbrainz" = "name_heuristic";

    if (mbResult?.type && mbResult.confidence >= 0.6) {
      // MusicBrainz found a type with decent confidence
      if (mbResult.type === heuristicType) {
        // Agreement — boost confidence, use heuristic as it's cheaper
        source = "name_heuristic";
      } else {
        // Disagreement — MusicBrainz overrides if confidence >= 0.8
        if (mbResult.confidence >= 0.8) {
          finalType = mbResult.type;
          source = "musicbrainz";
        }
        // Otherwise stick with heuristic
      }
    }

    results.push({
      slug: String(artist.slug),
      name: displayName,
      previousType: artist.artist_type ? String(artist.artist_type) : null,
      newType: finalType,
      heuristic,
      source,
      mbType: mbResult?.mbType ?? null,
      confidence: mbResult?.confidence,
    });

    if (!finalType) {
      skipped++;
      continue;
    }

    if (source === "musicbrainz") fromMusicBrainz++;
    else fromHeuristic++;

    if (!dryRun) {
      const { error: updateErr } = await db
        .from("registry_artists")
        .update({
          artist_type: finalType,
          updated_at: new Date().toISOString(),
        })
        .eq("id", String(artist.id));

      if (updateErr) {
        results[results.length - 1].source = "skipped";
        fromHeuristic--;
        skipped++;
      }
    }
  }

  return json(req, {
    ok: true,
    dry_run: dryRun,
    force,
    total_found: artists.length,
    from_heuristic: fromHeuristic,
    from_musicbrainz: fromMusicBrainz,
    skipped,
    results: results.slice(0, 500),
  });
});
