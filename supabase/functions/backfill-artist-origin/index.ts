// Backfill Artist Origin ISO2
// Phase 1: Normalize metadata.country → origin_iso2
// Phase 2: MusicBrainz lookup for artists missing origin
// Phase 3: Report results

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── ISO2 ↔ Country name mappings (subset focused on Africa + major music markets) ──

const ISO2_TO_NAME: Record<string, string> = {
  ng: "Nigeria", ke: "Kenya", gh: "Ghana", za: "South Africa", ug: "Uganda",
  tz: "Tanzania", cm: "Cameroon", et: "Ethiopia", rw: "Rwanda", zm: "Zambia",
  zw: "Zimbabwe", sn: "Senegal", ml: "Mali", cd: "Congo (DRC)", cg: "Congo",
  ao: "Angola", bw: "Botswana", na: "Namibia", ma: "Morocco", dz: "Algeria",
  tn: "Tunisia", eg: "Egypt", sd: "Sudan", sl: "Sierra Leone", lr: "Liberia",
  bf: "Burkina Faso", ne: "Niger", td: "Chad", ga: "Gabon", gn: "Guinea",
  gw: "Guinea-Bissau", gm: "The Gambia", tg: "Togo", bj: "Benin", mz: "Mozambique",
  mw: "Malawi", mg: "Madagascar", mu: "Mauritius", sc: "Seychelles", dj: "Djibouti",
  so: "Somalia", er: "Eritrea", ss: "South Sudan", sz: "Eswatini", ls: "Lesotho",
  ci: "Côte d'Ivoire", cv: "Cape Verde", st: "São Tomé and Príncipe",
  gq: "Equatorial Guinea", bi: "Burundi", cf: "Central African Republic",
  km: "Comoros", mr: "Mauritania", ly: "Libya",
  gb: "United Kingdom", fr: "France", de: "Germany", it: "Italy", es: "Spain",
  pt: "Portugal", nl: "Netherlands", be: "Belgium", ch: "Switzerland",
  se: "Sweden", no: "Norway", dk: "Denmark", fi: "Finland", ie: "Ireland",
  pl: "Poland", cz: "Czech Republic", sk: "Slovakia", hu: "Hungary", ro: "Romania",
  bg: "Bulgaria", hr: "Croatia", si: "Slovenia", rs: "Serbia", al: "Albania",
  ua: "Ukraine", lt: "Lithuania", lv: "Latvia", ee: "Estonia",
  gr: "Greece", cy: "Cyprus", tr: "Turkey",
  us: "United States", ca: "Canada", mx: "Mexico",
  br: "Brazil", ar: "Argentina", co: "Colombia", cl: "Chile", pe: "Peru",
  ve: "Venezuela", ec: "Ecuador", do: "Dominican Republic", jm: "Jamaica",
  tt: "Trinidad and Tobago", bb: "Barbados", ht: "Haiti", cu: "Cuba",
  pr: "Puerto Rico", pa: "Panama", cr: "Costa Rica", gt: "Guatemala",
  cn: "China", jp: "Japan", kr: "South Korea", in: "India", pk: "Pakistan",
  bd: "Bangladesh", lk: "Sri Lanka", np: "Nepal",
  id: "Indonesia", my: "Malaysia", ph: "Philippines", sg: "Singapore",
  th: "Thailand", vn: "Vietnam", mm: "Myanmar",
  sa: "Saudi Arabia", ae: "United Arab Emirates", qa: "Qatar", kw: "Kuwait",
  jo: "Jordan", lb: "Lebanon", il: "Israel", ir: "Iran", iq: "Iraq",
  au: "Australia", nz: "New Zealand",
};

function buildNameToIso2(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const [iso2, name] of Object.entries(ISO2_TO_NAME)) {
    m[name] = iso2.toUpperCase();
  }
  // Aliases
  m["USA"] = "US";
  m["UK"] = "GB";
  m["UAE"] = "AE";
  m["DRC"] = "CD";
  m["Congo-Kinshasa"] = "CD";
  m["Congo-Brazzaville"] = "CG";
  m["Ivory Coast"] = "CI";
  m["Swaziland"] = "SZ";
  m["Czechia"] = "CZ";
  m["Russia"] = "RU";
  m["South Korea"] = "KR";
  m["North Korea"] = "KP";
  m["The Gambia"] = "GM";
  m["Gambia"] = "GM";
  m["USA"] = "US";
  m["United States of America"] = "US";
  return m;
}

const NAME_TO_ISO2 = buildNameToIso2();

function normalizeCountryToIso2(input: string | null | undefined): { iso2: string; name: string } | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct ISO2 match
  const lower = trimmed.toLowerCase();
  if (ISO2_TO_NAME[lower]) {
    return { iso2: lower.toUpperCase(), name: ISO2_TO_NAME[lower] };
  }

  // Country name match (case-insensitive)
  const lowerName = trimmed.toLowerCase();
  for (const [name, iso2] of Object.entries(NAME_TO_ISO2)) {
    if (name.toLowerCase() === lowerName) {
      return { iso2, name };
    }
  }

  // Try ISO2 uppercase (e.g. "KE")
  const upper = trimmed.toUpperCase();
  const iso2Lower = upper.toLowerCase();
  if (ISO2_TO_NAME[iso2Lower]) {
    return { iso2: upper, name: ISO2_TO_NAME[iso2Lower] };
  }

  return null;
}

// ── MusicBrainz ──

interface MusicBrainzArtist {
  id: string;
  name: string;
  country?: string;
  score?: number;
  "life-span"?: { begin?: string; end?: string };
  area?: { name: string };
  tags?: Array<{ name: string; count: number }>;
}

async function searchMusicBrainz(query: string): Promise<MusicBrainzArtist[]> {
  try {
    const url = new URL("https://musicbrainz.org/ws/2/artist/");
    url.searchParams.set("query", `artist:"${query}"`);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", "5");
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

// Name normalization for comparison
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

async function resolveMusicBrainzOrigin(
  displayName: string,
  normalizedName: string,
): Promise<{ iso2: string | null; countryName: string | null; confidence: number; mbId: string | null }> {
  const queries = new Map<string, string>();
  queries.set(displayName, "display_name");
  if (normalizedName && normalizedName !== displayName) {
    queries.set(normalizedName, "normalized_name");
  }

  for (const [q, label] of queries) {
    const results = await searchMusicBrainz(q);
    if (results.length === 0) continue;

    // Find best name match that has a country
    for (const mb of results) {
      if (!mb.country) continue;
      if (namesAreClose(mb.name, displayName) || namesAreClose(mb.name, normalizedName || displayName)) {
        const iso2 = mb.country.toUpperCase();
        const name = ISO2_TO_NAME[iso2.toLowerCase()] || mb.country;
        // Confidence: higher for high-score exact matches
        const scoreConfidence = Math.min((mb.score ?? 50) / 100, 1.0);
        const nameBonus = normalizeName(mb.name) === normalizeName(displayName) ? 0.15 : 0;
        const countryPenalty = ISO2_TO_NAME[iso2.toLowerCase()] ? 0 : -0.3;
        const confidence = Math.min(Math.max(scoreConfidence + nameBonus + countryPenalty, 0.1), 1.0);
        return { iso2, countryName: name, confidence: Math.round(confidence * 10000) / 10000, mbId: mb.id };
      }
    }
  }

  return { iso2: null, countryName: null, confidence: 0, mbId: null };
}

// ── CORS ──

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

// ── Result types ──

interface OriginResult {
  slug: string;
  name: string;
  previousIso2: string | null;
  newIso2: string | null;
  countryName: string | null;
  confidence: number;
  source: "metadata_normalization" | "musicbrainz" | "skipped";
  debug?: string;
}

// ── Main handler ──

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
  const useMusicBrainz = body.use_musicbrainz !== false; // default true
  const batchSize = Math.min(Number(body.batch_size) || 80, 200);

  // Fetch all active/published artists missing origin_iso2
  const { data: artists, error: fetchErr } = await db
    .from("registry_artists")
    .select("id, slug, display_name, normalized_name, origin_iso2, metadata")
    .in("status", ["active", "draft"])
    .or("origin_iso2.is.null,origin_iso2.eq.")
    .limit(batchSize);

  if (fetchErr) {
    return json(req, { error: "db_query_failed", detail: fetchErr.message }, 500);
  }

  if (!artists || artists.length === 0) {
    return json(req, {
      ok: true,
      message: "All active artists already have origin ISO2 set.",
      total_found: 0,
      results: [],
    });
  }

  const results: OriginResult[] = [];
  let normalized = 0;
  let fromMusicBrainz = 0;
  let skipped = 0;

  for (const artist of artists) {
    const meta = (artist.metadata || {}) as Record<string, unknown>;
    const countryRaw = meta.country ? String(meta.country).trim() : null;
    const displayName = String(artist.display_name || artist.slug);
    const normalizedName = String(artist.normalized_name || "");

    // ── Phase 1: Try metadata.country normalization ──
    if (countryRaw) {
      const norm = normalizeCountryToIso2(countryRaw);
      if (norm) {
        results.push({
          slug: String(artist.slug),
          name: displayName,
          previousIso2: artist.origin_iso2 ? String(artist.origin_iso2) : null,
          newIso2: norm.iso2,
          countryName: norm.name,
          confidence: 0.9,
          source: "metadata_normalization",
          debug: `Normalized "${countryRaw}" → ${norm.iso2} (${norm.name})`,
        });

        if (!dryRun) {
          await db
            .from("registry_artists")
            .update({ origin_iso2: norm.iso2, origin_confidence: 0.9, updated_at: new Date().toISOString() })
            .eq("id", String(artist.id));
        }
        normalized++;
        continue;
      }
    }

    // ── Phase 2: MusicBrainz lookup ──
    if (useMusicBrainz) {
      const mb = await resolveMusicBrainzOrigin(displayName, normalizedName);
      if (mb.iso2) {
        results.push({
          slug: String(artist.slug),
          name: displayName,
          previousIso2: null,
          newIso2: mb.iso2,
          countryName: mb.countryName,
          confidence: mb.confidence,
          source: "musicbrainz",
          debug: `MusicBrainz match: "${mb.countryName}" (${mb.iso2}), score: ${mb.confidence}`,
        });

        if (!dryRun) {
          await db
            .from("registry_artists")
            .update({
              origin_iso2: mb.iso2,
              origin_confidence: mb.confidence,
              updated_at: new Date().toISOString(),
            })
            .eq("id", String(artist.id));
        }
        fromMusicBrainz++;
        // Rate limit: MusicBrainz allows ~1 req/sec
        await new Promise((resolve) => setTimeout(resolve, 1200));
        continue;
      }
    }

    // Not found
    results.push({
      slug: String(artist.slug),
      name: displayName,
      previousIso2: null,
      newIso2: null,
      countryName: null,
      confidence: 0,
      source: "skipped",
      debug: countryRaw
        ? `Could not normalize "${countryRaw}" to ISO2, MusicBrainz returned no match`
        : "No metadata.country and MusicBrainz returned no match",
    });
    skipped++;
  }

  return json(req, {
    ok: true,
    dry_run: dryRun,
    total_found: artists.length,
    normalized_from_metadata: normalized,
    from_musicbrainz: fromMusicBrainz,
    skipped,
    results: results.slice(0, 500),
  });
});
