// Registry Artist Enrichment v2
// Multi-provider enrichment with multi-strategy name search,
// ID→name fallback, name verification, and debug transparency.
// Supports both single-artist (by slug) and bulk enrichment modes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://wakilisha.africa",
  "https://wakilisha.africa",
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

async function readCredential(
  db: ReturnType<typeof createClient>,
  envVar: string,
  dbKey: string,
): Promise<string | null> {
  const ev = Deno.env.get(envVar);
  if (ev?.trim()) return ev.trim();
  try {
    const { data } = await db
      .from("admin_settings_secrets")
      .select("setting_value")
      .eq("setting_key", dbKey)
      .maybeSingle();
    if (data?.setting_value?.trim()) return String(data.setting_value).trim();
  } catch { /* ignore */ }
  return null;
}

// ─── Name normalization for comparison ───

function normalizeName(n: string): string {
  return n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, "")      // strip special chars
    .replace(/\s+/g, " ")
    .trim();
}

function namesAreClose(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  // Exact match after normalization
  if (na === nb) return true;
  // One contains the other (handles "Burna Boy" vs "Burna Boy (Official)")
  if (na.includes(nb) || nb.includes(na)) return true;
  // Word-level: at least 80% of words overlap
  const wa = new Set(na.split(" ").filter(Boolean));
  const wb = new Set(nb.split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return false;
  let overlap = 0;
  for (const w of wa) { if (wb.has(w)) overlap++; }
  const ratio = overlap / Math.max(wa.size, wb.size);
  return ratio >= 0.7;
}

// ═══════════════════════════════════════════════════════════════════════
//  Spotify
// ═══════════════════════════════════════════════════════════════════════

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

interface SpotifyImage {
  url: string;
  width: number;
  height: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
  images: SpotifyImage[];
  followers?: { total: number };
  popularity?: number;
  genres?: string[];
}

interface SpotifySearchResult {
  found: boolean;
  apiError?: string;
  items: SpotifyArtist[];
}

async function fetchSpotifyArtistById(id: string, token: string): Promise<SpotifyArtist | null> {
  try {
    const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json() as SpotifyArtist;
  } catch {
    return null;
  }
}

async function searchSpotifyArtists(query: string, token: string): Promise<SpotifySearchResult> {
  try {
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "artist");
    url.searchParams.set("limit", "10");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      return { found: false, apiError: `HTTP ${res.status}`, items: [] };
    }
    const data = await res.json() as { artists?: { items?: SpotifyArtist[] } };
    const items = data?.artists?.items ?? [];
    return { found: items.length > 0, items };
  } catch (e) {
    return { found: false, apiError: e instanceof Error ? e.message : "network error", items: [] };
  }
}

async function resolveSpotifyArtist(
  artistName: string,
  normalizedName: string,
  spotifyId: string | undefined,
  token: string,
): Promise<{ artist: SpotifyArtist | null; debug: Record<string, unknown> }> {
  const debug: Record<string, unknown> = { strategies: [] };

  // Strategy 1: Direct ID lookup (if we have one)
  if (spotifyId) {
    const byId = await fetchSpotifyArtistById(spotifyId, token);
    debug.strategies = [...(debug.strategies as unknown[]), { strategy: "id_lookup", id: spotifyId, found: !!byId }];
    if (byId) {
      return { artist: byId, debug };
    }
    // ID failed — fall through to name search
    debug.id_failed_falling_back_to_name = true;
  }

  // Build search queries — try display_name first, then normalized_name
  const queries = new Map<string, string>();
  queries.set(artistName, "display_name");
  if (normalizedName && normalizedName !== artistName) {
    queries.set(normalizedName, "normalized_name");
  }

  for (const [q, label] of queries) {
    // Try exact phrase first (with quotes)
    const phraseQuery = `"${q}"`;
    const phraseResult = await searchSpotifyArtists(phraseQuery, token);
    debug.strategies = [...(debug.strategies as unknown[]), { strategy: `name_search_phrase`, query: phraseQuery, label, found: phraseResult.found, apiError: phraseResult.apiError, candidateCount: phraseResult.items.length }];

    if (phraseResult.found) {
      // Verify name match
      for (const item of phraseResult.items) {
        if (namesAreClose(item.name, artistName) || namesAreClose(item.name, normalizedName || artistName)) {
          return { artist: item, debug: { ...debug, matchedVia: `name_search_phrase:${label}`, matchedName: item.name } };
        }
      }
      // No close match in phrase results
      debug.phrase_no_close_match = `tried ${phraseResult.items.length} results, none matched "${artistName}"`;
    } else if (phraseResult.apiError) {
      debug.phrase_api_error = phraseResult.apiError;
    }

    // Fallback: unquoted search
    const broadResult = await searchSpotifyArtists(q, token);
    debug.strategies = [...(debug.strategies as unknown[]), { strategy: `name_search_broad`, query: q, label, found: broadResult.found, apiError: broadResult.apiError, candidateCount: broadResult.items.length }];

    if (broadResult.found) {
      for (const item of broadResult.items) {
        if (namesAreClose(item.name, artistName) || namesAreClose(item.name, normalizedName || artistName)) {
          return { artist: item, debug: { ...debug, matchedVia: `name_search_broad:${label}`, matchedName: item.name } };
        }
      }
      debug.broad_no_close_match = `tried ${broadResult.items.length} results, none matched "${artistName}"`;
    }
  }

  return { artist: null, debug };
}

// ═══════════════════════════════════════════════════════════════════════
//  Apple Music
// ═══════════════════════════════════════════════════════════════════════

async function createAppleMusicJWT(pk: string, tid: string, kid: string): Promise<string> {
  const pem = pk
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const bin = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", bin, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const header = { alg: "ES256", kid };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = { iss: tid, iat: nowSec, exp: nowSec + 3600 };
  const enc = new TextEncoder();
  const b64u = (s: string) => s.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const hb = b64u(btoa(JSON.stringify(header)));
  const pb = b64u(btoa(JSON.stringify(payload)));
  const si = hb + "." + pb;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, enc.encode(si),
  );
  const sb = b64u(btoa(String.fromCharCode(...new Uint8Array(sig))));
  return si + "." + sb;
}

async function getAppleMusicToken(db: ReturnType<typeof createClient>): Promise<string | null> {
  const pk = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key");
  const tid = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id");
  const kid = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");
  if (!pk || !tid || !kid) return null;
  try {
    return await createAppleMusicJWT(pk, tid, kid);
  } catch {
    return null;
  }
}

interface AppleMusicArtwork {
  url?: string;
  width?: number;
  height?: number;
}

interface AppleMusicArtist {
  id: string;
  name: string;
  artwork?: AppleMusicArtwork;
  genreNames?: string[];
  editorialNotes?: { standard?: string; short?: string };
}

interface AppleMusicSearchResult {
  found: boolean;
  apiError?: string;
  items: AppleMusicArtist[];
}

function resolveAppleMusicArtworkUrl(artwork: AppleMusicArtwork | undefined): string | null {
  if (!artwork?.url) return null;
  const w = artwork.width ?? 1200;
  const h = artwork.height ?? 1200;
  return artwork.url
    .replace("{w}", String(w))
    .replace("{h}", String(h))
    .replace("{f}", "jpg");
}

function parseAppleArtist(item: { id: string; attributes?: Record<string, unknown> }): AppleMusicArtist {
  const attrs = item.attributes ?? {};
  return {
    id: item.id,
    name: String(attrs.name ?? ""),
    artwork: (attrs.artwork as AppleMusicArtwork) ?? undefined,
    genreNames: (attrs.genreNames as string[]) ?? undefined,
    editorialNotes: (attrs.editorialNotes as AppleMusicArtist["editorialNotes"]) ?? undefined,
  };
}

async function fetchAppleMusicArtistById(
  id: string,
  token: string,
  storefront: string,
): Promise<AppleMusicArtist | null> {
  try {
    const res = await fetch(
      `https://api.music.apple.com/v1/catalog/${storefront}/artists/${id}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = await res.json() as { data?: Array<{ id: string; attributes?: Record<string, unknown> }> };
    const item = data?.data?.[0];
    if (!item) return null;
    return parseAppleArtist(item);
  } catch {
    return null;
  }
}

async function searchAppleMusicArtists(
  query: string,
  token: string,
  storefront: string,
): Promise<AppleMusicSearchResult> {
  try {
    const url = new URL(`https://api.music.apple.com/v1/catalog/${storefront}/search`);
    url.searchParams.set("term", query);
    url.searchParams.set("types", "artists");
    url.searchParams.set("limit", "10");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      return { found: false, apiError: `HTTP ${res.status}`, items: [] };
    }
    const data = await res.json() as {
      results?: { artists?: { data?: Array<{ id: string; attributes?: Record<string, unknown> }> } };
    };
    const items = (data?.results?.artists?.data ?? []).map(parseAppleArtist);
    return { found: items.length > 0, items };
  } catch (e) {
    return { found: false, apiError: e instanceof Error ? e.message : "network error", items: [] };
  }
}

async function resolveAppleMusicArtist(
  artistName: string,
  normalizedName: string,
  appleMusicId: string | undefined,
  token: string,
  storefront: string,
): Promise<{ artist: AppleMusicArtist | null; debug: Record<string, unknown> }> {
  const debug: Record<string, unknown> = { strategies: [] };

  // Strategy 1: Direct ID lookup
  if (appleMusicId) {
    const byId = await fetchAppleMusicArtistById(appleMusicId, token, storefront);
    debug.strategies = [...(debug.strategies as unknown[]), { strategy: "id_lookup", id: appleMusicId, found: !!byId }];
    if (byId) {
      return { artist: byId, debug };
    }
    debug.id_failed_falling_back_to_name = true;
  }

  // Build search queries
  const queries = new Map<string, string>();
  queries.set(artistName, "display_name");
  if (normalizedName && normalizedName !== artistName) {
    queries.set(normalizedName, "normalized_name");
  }

  for (const [q, label] of queries) {
    const result = await searchAppleMusicArtists(q, token, storefront);
    debug.strategies = [...(debug.strategies as unknown[]), { strategy: `name_search`, query: q, label, found: result.found, apiError: result.apiError, candidateCount: result.items.length }];

    if (result.found) {
      for (const item of result.items) {
        if (namesAreClose(item.name, artistName) || namesAreClose(item.name, normalizedName || artistName)) {
          return { artist: item, debug: { ...debug, matchedVia: `name_search:${label}`, matchedName: item.name } };
        }
      }
      debug.no_close_match = `tried ${result.items.length} results, none matched "${artistName}"`;
    }
  }

  return { artist: null, debug };
}

// ═══════════════════════════════════════════════════════════════════════
//  Enrichment aggregation
// ═══════════════════════════════════════════════════════════════════════

interface EnrichmentResult {
  slug: string;
  name: string;
  status: "updated" | "skipped" | "no_data" | "error";
  providersTried: string[];
  providersFound: string[];
  changes: {
    image?: { old: string | null; new: string | null; source: string };
    bio?: { old: string | null; new: string | null; source: string };
    genres?: { old: string[]; new: string[]; source: string };
    metadata?: Record<string, unknown>;
  };
  message?: string;
  debug?: Record<string, unknown>;
}

async function enrichSingleArtist(
  artist: Record<string, unknown>,
  spotifyToken: string | null,
  appleToken: string | null,
  storefront: string,
  dryRun: boolean,
  force: boolean,
  db: ReturnType<typeof createClient>,
): Promise<EnrichmentResult> {
  const slug = String(artist.slug);
  const name = String(artist.display_name || artist.slug);
  const normalizedName = String(artist.normalized_name || "");
  const meta = (artist.metadata || {}) as Record<string, unknown>;
  const currentImage = artist.public_image_url ? String(artist.public_image_url) : null;
  const currentBio = artist.bio ? String(artist.bio) : null;

  const result: EnrichmentResult = {
    slug,
    name,
    status: "skipped",
    providersTried: [],
    providersFound: [],
    changes: {},
    debug: {},
  };

  const spotifyId = String(meta.spotify_id || "").trim() || undefined;
  const appleId = String(meta.apple_music_id || "").trim() || undefined;

  let spotifyData: SpotifyArtist | null = null;
  let appleData: AppleMusicArtist | null = null;

  // ── Spotify ──
  if (spotifyToken) {
    result.providersTried.push("spotify");
    const spotifyResult = await resolveSpotifyArtist(name, normalizedName, spotifyId, spotifyToken);
    (result.debug as Record<string, unknown>).spotify = spotifyResult.debug;
    if (spotifyResult.artist) {
      spotifyData = spotifyResult.artist;
      result.providersFound.push("spotify");
    }
  }

  // ── Apple Music ──
  if (appleToken) {
    result.providersTried.push("apple_music");
    const appleResult = await resolveAppleMusicArtist(name, normalizedName, appleId, appleToken, storefront);
    (result.debug as Record<string, unknown>).apple_music = appleResult.debug;
    if (appleResult.artist) {
      appleData = appleResult.artist;
      result.providersFound.push("apple_music");
    }
  }

  if (!spotifyData && !appleData) {
    result.status = "no_data";
    result.message = "No matching artist found from any provider";
    return result;
  }

  // ── Image: pick best from all sources ──
  const candidates: { url: string | null; width: number; source: string }[] = [];
  if (spotifyData?.images) {
    const best = [...spotifyData.images].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    if (best) candidates.push({ url: best.url, width: best.width || 640, source: "spotify" });
  }
  if (appleData?.artwork) {
    const url = resolveAppleMusicArtworkUrl(appleData.artwork);
    if (url) candidates.push({ url, width: appleData.artwork.width || 1200, source: "apple_music" });
  }

  const bestImage = candidates.length > 0
    ? candidates.sort((a, b) => b.width - a.width)[0]
    : null;

  const shouldUpdateImage = bestImage && (force || !currentImage || !currentImage.startsWith("http"));
  if (shouldUpdateImage) {
    result.changes.image = {
      old: currentImage,
      new: bestImage!.url,
      source: bestImage!.source,
    };
  }

  // ── Bio: prefer Apple Music editorial notes ──
  const editorialBio = appleData?.editorialNotes?.standard || appleData?.editorialNotes?.short || null;
  const shouldUpdateBio = editorialBio && (force || !currentBio);
  if (shouldUpdateBio) {
    result.changes.bio = {
      old: currentBio,
      new: editorialBio,
      source: "apple_music",
    };
  }

  // ── Genres: merge from both ──
  const genreSet = new Set<string>();
  spotifyData?.genres?.forEach((g) => genreSet.add(g));
  appleData?.genreNames?.forEach((g) => genreSet.add(g));
  const oldGenres = (meta.enriched_genres as string[]) ?? [];
  const newGenres = Array.from(genreSet);
  if (newGenres.length > 0 && (force || newGenres.length > oldGenres.length)) {
    result.changes.genres = {
      old: oldGenres,
      new: newGenres,
      source: spotifyData && appleData ? "spotify + apple_music" : spotifyData ? "spotify" : "apple_music",
    };
  }

  // ── Metadata: store IDs, followers, popularity ──
  const updatedMeta: Record<string, unknown> = { ...meta };
  if (spotifyData) {
    updatedMeta.spotify_id = spotifyData.id;
    if (spotifyData.followers?.total !== undefined) {
      updatedMeta.spotify_followers = spotifyData.followers.total;
    }
    if (spotifyData.popularity !== undefined) {
      updatedMeta.spotify_popularity = spotifyData.popularity;
    }
  }
  if (appleData) {
    updatedMeta.apple_music_id = appleData.id;
  }
  if (newGenres.length > 0) {
    updatedMeta.enriched_genres = newGenres;
  }

  const hasChanges = Object.keys(result.changes).length > 0;
  if (!hasChanges) {
    result.status = "skipped";
    result.message = "Artist already enriched; use force=true to re-enrich";
    return result;
  }

  result.status = "updated";

  if (!dryRun) {
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      metadata: updatedMeta,
      updated_at: now,
    };
    if (shouldUpdateImage) {
      updatePayload.public_image_url = bestImage!.url;
      updatePayload.image_source_provider = bestImage!.source;
    }
    if (shouldUpdateBio) {
      updatePayload.bio = editorialBio;
    }

    const { error: updateErr } = await db
      .from("registry_artists")
      .update(updatePayload)
      .eq("id", String(artist.id));

    if (updateErr) {
      result.status = "error";
      result.message = "DB update failed: " + updateErr.message;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════
//  Main handler
// ═══════════════════════════════════════════════════════════════════════

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
  const force = body.force === true;
  const batchSize = Math.min(Number(body.batch_size) || 60, 100);
  const specificSlug = body.artist_slug ? String(body.artist_slug) : null;
  const requestedProviders = Array.isArray(body.providers)
    ? (body.providers as string[]).filter((p) => ["spotify", "apple_music"].includes(p))
    : ["spotify", "apple_music"];
  const filterMode = body.filter ? String(body.filter) : "missing_image";

  // ── Credentials ──
  const spotifyClientId = await readCredential(db, "SPOTIFY_CLIENT_ID", "spotify_client_id");
  const spotifyClientSecret = await readCredential(db, "SPOTIFY_CLIENT_SECRET", "spotify_client_secret");
  const spotifyToken = (requestedProviders.includes("spotify") && spotifyClientId && spotifyClientSecret)
    ? await getSpotifyToken(spotifyClientId, spotifyClientSecret)
    : null;

  const appleToken = requestedProviders.includes("apple_music")
    ? await getAppleMusicToken(db)
    : null;

  const storefront = (await readCredential(db, "APPLE_MUSIC_STOREFRONT", "apple_music_storefront")) || "ke";

  const providerStatus: Record<string, { connected: boolean; error?: string }> = {};
  if (requestedProviders.includes("spotify")) {
    providerStatus.spotify = {
      connected: !!spotifyToken,
      error: !spotifyToken ? "Spotify credentials not configured or auth failed" : undefined,
    };
  }
  if (requestedProviders.includes("apple_music")) {
    providerStatus.apple_music = {
      connected: !!appleToken,
      error: !appleToken ? "Apple Music credentials not configured or JWT failed" : undefined,
    };
  }

  const noProviderAvailable = !spotifyToken && !appleToken;
  if (noProviderAvailable) {
    return json(req, {
      error: "no_providers_available",
      provider_status: providerStatus,
      message: "No provider credentials are configured. Set them in Settings → Integrations.",
    }, 400);
  }

  // ── Query artists ──
  let query = db
    .from("registry_artists")
    .select("id, slug, display_name, normalized_name, public_image_url, bio, status, metadata")
    .in("status", ["active", "draft"]);

  if (specificSlug) {
    query = query.eq("slug", specificSlug);
  } else {
    if (filterMode === "missing_image") {
      query = query.or("public_image_url.is.null,public_image_url.not.like.http%");
    } else if (filterMode === "missing_bio") {
      query = query.is("bio", null);
    }
    query = query.limit(batchSize);
  }

  const { data: artists, error: artistErr } = await query;

  if (artistErr) {
    return json(req, { error: "db_query_failed", detail: artistErr.message }, 500);
  }

  if (!artists || artists.length === 0) {
    return json(req, {
      ok: true,
      message: "No artists match the enrichment criteria.",
      processed: 0,
      updated: 0,
      skipped: 0,
      no_data: 0,
      errors: 0,
      provider_status: providerStatus,
      results: [],
    });
  }

  const results: EnrichmentResult[] = [];
  let updated = 0;
  let skipped = 0;
  let noData = 0;
  let errors = 0;

  const BATCH = 6;
  for (let i = 0; i < artists.length; i += BATCH) {
    const batch = artists.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (artist: Record<string, unknown>) => {
        const r = await enrichSingleArtist(
          artist,
          spotifyToken,
          appleToken,
          storefront,
          dryRun,
          force,
          db,
        );
        results.push(r);
        if (r.status === "updated") updated++;
        else if (r.status === "skipped") skipped++;
        else if (r.status === "no_data") noData++;
        else if (r.status === "error") errors++;
      }),
    );
    if (i + BATCH < artists.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return json(req, {
    ok: true,
    dry_run: dryRun,
    force,
    total_found: artists.length,
    updated,
    skipped,
    no_data: noData,
    errors,
    provider_status: providerStatus,
    results,
  });
});
