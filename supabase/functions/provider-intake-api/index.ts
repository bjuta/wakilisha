import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = ["https://wakilisha.africa","https://www.wakilisha.africa","https://staging.wakilisha.africa","https://readdy.ai","https://readdy.cc","https://www.readdy.cc","http://localhost:5173","http://localhost:3000"];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isReaddyPreview = origin.endsWith(".readdy.cc") || origin === "https://readdy.cc";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) || isReaddyPreview ? origin : ALLOWED_ORIGINS[0];
  return {"Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Vary":"Origin"};
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

async function readCredential(db: ReturnType<typeof createClient>, envVar: string, dbKey: string): Promise<string | null> {
  const ev = Deno.env.get(envVar);
  if (ev && ev.trim()) return ev.trim();
  try {
    const { data: row } = await db.from("admin_settings_secrets").select("setting_value").eq("setting_key", dbKey).maybeSingle();
    if (row && (row.setting_value as string)?.trim()) return (row.setting_value as string).trim();
  } catch { /* ignore */ }
  return null;
}

async function createAppleMusicJWT(pk: string, tid: string, kid: string): Promise<string> {
  const pem = pk.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const bin = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", bin, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = { alg: "ES256", kid };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = { iss: tid, iat: nowSec, exp: nowSec + 3600 };
  const enc = new TextEncoder();
  const b64u = (s: string) => s.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const hb = b64u(btoa(JSON.stringify(header)));
  const pb = b64u(btoa(JSON.stringify(payload)));
  const si = hb + "." + pb;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(si));
  const sb = b64u(btoa(String.fromCharCode(...new Uint8Array(sig))));
  return si + "." + sb;
}

interface AppleArtwork {
  url: string;
  width: number;
  height: number;
}

interface AppleRelItem {
  id: string;
  type: string;
  href?: string;
  attributes?: Record<string, unknown>;
}

interface AppleSearchHit {
  id: string;
  type: string;
  href: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    url?: string;
    artwork?: AppleArtwork;
    releaseDate?: string;
    genreNames?: string[];
    recordLabel?: string;
    isrc?: string;
    trackNumber?: number;
    durationInMillis?: number;
    contentRating?: string;
    editorialNotes?: { short?: string; standard?: string };
    playParams?: { id?: string; kind?: string };
    previews?: Array<{ url: string }>;
    trackCount?: number;
  };
  relationships?: {
    artists?: { data: AppleRelItem[] };
    albums?: { data: AppleRelItem[] };
    tracks?: { data: AppleRelItem[] };
  };
}

function artUrl(aw: AppleArtwork | undefined | null, w: number): string | null {
  if (!aw?.url) return null;
  return aw.url.replace("{w}", String(w)).replace("{h}", String(w));
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function parseEntityType(appleType: string): "artist" | "release" | "track" | "label" {
  if (appleType === "artists") return "artist";
  if (appleType === "albums") return "release";
  if (appleType === "songs") return "track";
  return "release";
}

function mapSearchHit(hit: AppleSearchHit, storefront: string, query: string): Record<string, unknown> {
  const a = hit.attributes || {};
  const entityType = parseEntityType(hit.type);
  const title = a.name || "";
  const artistDisplayName = a.artistName || null;
  const providerUrl = a.url || ("https://music.apple.com/" + storefront + "/" + (hit.type === "albums" ? "album" : hit.type === "songs" ? "song" : "artist") + "/" + hit.id);
  const artwork = artUrl(a.artwork, 300);
  const summaryFields: Array<{ key: string; label: string; value: unknown }> = [];
  if (a.releaseDate) summaryFields.push({ key: "releaseDate", label: "Release Date", value: a.releaseDate });
  if (a.genreNames) summaryFields.push({ key: "genres", label: "Genres", value: a.genreNames.join(", ") });
  if (a.recordLabel) summaryFields.push({ key: "label", label: "Label", value: a.recordLabel });
  if (a.isrc) summaryFields.push({ key: "isrc", label: "ISRC", value: a.isrc });
  if (a.trackNumber != null) summaryFields.push({ key: "trackNumber", label: "Track #", value: a.trackNumber });
  if (a.contentRating) summaryFields.push({ key: "rating", label: "Rating", value: a.contentRating });
  if (a.trackCount != null) summaryFields.push({ key: "trackCount", label: "Tracks", value: a.trackCount });
  if (a.durationInMillis) summaryFields.push({ key: "duration", label: "Duration", value: Math.round(a.durationInMillis / 1000) + "s" });
  const relatedEntities = {
    artists: (hit.relationships?.artists?.data || []).map((r) => ({
      providerEntityType: "artist", providerEntityId: r.id,
      name: (r.attributes?.name as string) || "Unknown",
      providerUrl: (r.attributes?.url as string) || null,
      artworkUrl: artUrl(r.attributes?.artwork as AppleArtwork | undefined, 200),
    })),
    releases: (hit.relationships?.albums?.data || []).map((r) => ({
      providerEntityType: "release", providerEntityId: r.id,
      name: (r.attributes?.name as string) || "Unknown",
      providerUrl: (r.attributes?.url as string) || null,
      artworkUrl: artUrl(r.attributes?.artwork as AppleArtwork | undefined, 200),
    })),
    tracks: (hit.relationships?.tracks?.data || []).map((r) => ({
      providerEntityType: "track", providerEntityId: r.id,
      name: (r.attributes?.name as string) || "Unknown",
      providerUrl: (r.attributes?.url as string) || null,
      artworkUrl: artUrl(r.attributes?.artwork as AppleArtwork | undefined, 200),
    })),
    labels: [] as Array<Record<string, unknown>>,
  };
  return {
    provider: "apple_music", providerEntityType: entityType, providerEntityId: hit.id,
    providerUrl, title, subtitle: a.albumName || artistDisplayName || null,
    artistDisplayName, artworkUrl: artwork, confidenceScore: 0.95,
    source: { searchQuery: query, storefrontOrMarket: storefront, fetchedAt: new Date().toISOString(), rawKind: hit.type },
    summaryFields, relatedEntities,
  };
}

async function searchRegistryReleases(db: ReturnType<typeof createClient>, title: string, artistName: string | null): Promise<Array<Record<string, unknown>>> {
  const candidates: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const add = (rows: Array<Record<string, unknown>> | null) => {
    for (const r of (rows ?? [])) {
      if (!seen.has(r.id as string)) { seen.add(r.id as string); candidates.push(r); }
    }
  };
  const { data: byTitle } = await db.from("registry_releases").select("id, slug, title, release_date, artwork_url, status, primary_artist_name").ilike("title", title).limit(5);
  add(byTitle);
  const norm = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const { data: byNorm } = await db.from("registry_releases").select("id, slug, title, release_date, artwork_url, status, primary_artist_name").ilike("normalized_title", "%" + norm + "%").limit(5);
  add(byNorm);
  if (title.length >= 4) {
    const prefix = title.slice(0, Math.min(title.length, 20));
    const { data: byPrefix } = await db.from("registry_releases").select("id, slug, title, release_date, artwork_url, status, primary_artist_name").ilike("title", "%" + prefix + "%").limit(5);
    add(byPrefix);
  }
  if (artistName && artistName !== "Unknown Artist") {
    const artistSlug = slugify(artistName);
    const { data: byArtistSlug } = await db.from("registry_releases").select("id, slug, title, release_date, artwork_url, status, primary_artist_name").ilike("slug", artistSlug + "--%").limit(5);
    add(byArtistSlug);
    const { data: byArtistName } = await db.from("registry_releases").select("id, slug, title, release_date, artwork_url, status, primary_artist_name").ilike("primary_artist_name", "%" + artistName + "%").limit(5);
    add(byArtistName);
  }
  return candidates;
}

async function handleSearch(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const provider = (body.provider as string) || "apple_music";
  const storefront = (body.storefront as string) || "ke";
  const query = (body.query as string) || (body.q as string) || "";
  const entityType = (body.entityType as string) || "all";
  const limit = Math.min(Number(body.limit) || 25, 50);
  if (!query.trim()) return json(req, { error: "Missing query parameter" }, 400);
  if (provider !== "apple_music") {
    return json(req, { provider: "spotify", query, storefrontOrMarket: storefront, groups: { artists: [], releases: [], tracks: [], labels: [] }, rawResultCount: 0, normalizedResultCount: 0, error: "Spotify search is not yet available." });
  }
  const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key");
  const teamId = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id");
  const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");
  if (!privateKey || !teamId || !musicKeyId) {
    return json(req, { provider, query, storefrontOrMarket: storefront, groups: { artists: [], releases: [], tracks: [], labels: [] }, rawResultCount: 0, normalizedResultCount: 0, error: "Apple Music credentials not configured." });
  }
  let token: string;
  try { token = await createAppleMusicJWT(privateKey, teamId, musicKeyId); }
  catch (e) { return json(req, { provider, query, storefrontOrMarket: storefront, groups: { artists: [], releases: [], tracks: [], labels: [] }, rawResultCount: 0, normalizedResultCount: 0, error: "JWT failed: " + (e instanceof Error ? e.message : String(e)) }); }
  const types: string[] = [];
  if (entityType === "all") { types.push("artists"); types.push("albums"); types.push("songs"); }
  else if (entityType === "release") types.push("albums");
  else if (entityType === "track") types.push("songs");
  else if (entityType === "artist") types.push("artists");
  else types.push(entityType);
  const apiUrl = "https://api.music.apple.com/v1/catalog/" + storefront + "/search?term=" + encodeURIComponent(query) + "&types=" + types.join(",") + "&limit=" + limit;
  const res = await fetch(apiUrl, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) { const errText = await res.text(); return json(req, { provider, query, storefrontOrMarket: storefront, groups: { artists: [], releases: [], tracks: [], labels: [] }, rawResultCount: 0, normalizedResultCount: 0, error: "Apple Music API " + res.status + ": " + errText.slice(0, 300) }); }
  const data = await res.json() as { results?: Record<string, { data: AppleSearchHit[] }> };
  const rg = data.results || {};
  const groups = {
    artists: (rg.artists?.data || []).map((h) => mapSearchHit(h, storefront, query)),
    releases: (rg.albums?.data || []).map((h) => mapSearchHit(h, storefront, query)),
    tracks: (rg.songs?.data || []).map((h) => mapSearchHit(h, storefront, query)),
    labels: [] as Array<Record<string, unknown>>,
  };
  const total = groups.artists.length + groups.releases.length + groups.tracks.length;
  return json(req, { provider, query, storefrontOrMarket: storefront, groups, rawResultCount: total, normalizedResultCount: total });
}

async function handleInspect(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const provider = (body.provider as string) || "apple_music";
  const providerEntityType = (body.providerEntityType as string) || "release";
  const providerEntityId = (body.providerEntityId as string) || "";
  const storefront = (body.storefront as string) || "ke";
  if (!providerEntityId) return json(req, { error: "Missing providerEntityId" }, 400);
  const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key");
  const teamId = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id");
  const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");
  if (!privateKey || !teamId || !musicKeyId) return json(req, { error: "Apple Music credentials not configured." }, 400);
  let token: string;
  try { token = await createAppleMusicJWT(privateKey, teamId, musicKeyId); }
  catch (e) { return json(req, { error: "JWT failed: " + (e instanceof Error ? e.message : String(e)) }, 500); }
  const appleType = providerEntityType === "release" ? "albums" : providerEntityType === "track" ? "songs" : "artists";
  const apiUrl = "https://api.music.apple.com/v1/catalog/" + storefront + "/" + appleType + "/" + providerEntityId + "?include=artists,tracks";
  const res = await fetch(apiUrl, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) { const errText = await res.text(); return json(req, { error: "Apple Music API " + res.status + ": " + errText.slice(0, 300) }, 500); }
  const raw = await res.json() as { data: AppleSearchHit[] };
  const mainData = raw.data?.[0];
  if (!mainData) return json(req, { error: "Entity not found" }, 404);
  const a = mainData.attributes || {};
  const title = a.name || "";
  const artistDisplayName = a.artistName || null;
  const artwork = artUrl(a.artwork, 600);
  const providerUrl = a.url || ("https://music.apple.com/" + storefront + "/" + (appleType === "albums" ? "album" : appleType === "songs" ? "song" : "artist") + "/" + providerEntityId);
  const sourceResult = {
    provider, providerEntityType, providerEntityId, providerUrl, title,
    subtitle: a.albumName || artistDisplayName || null, artistDisplayName, artworkUrl: artwork, confidenceScore: 0.95,
    source: { searchQuery: title, storefrontOrMarket: storefront, fetchedAt: new Date().toISOString(), rawKind: appleType },
    summaryFields: [
      a.releaseDate ? { key: "releaseDate", label: "Release Date", value: a.releaseDate } : null,
      a.genreNames ? { key: "genres", label: "Genres", value: a.genreNames.join(", ") } : null,
      a.recordLabel ? { key: "label", label: "Label", value: a.recordLabel } : null,
      a.isrc ? { key: "isrc", label: "ISRC", value: a.isrc } : null,
      a.contentRating ? { key: "rating", label: "Rating", value: a.contentRating } : null,
      a.trackCount != null ? { key: "trackCount", label: "Tracks", value: a.trackCount } : null,
      a.durationInMillis ? { key: "duration", label: "Duration", value: Math.round(a.durationInMillis / 1000) + "s" } : null,
    ].filter(Boolean) as Array<{ key: string; label: string; value: unknown }>,
    relatedEntities: { artists: [] as unknown[], releases: [] as unknown[], tracks: [] as unknown[], labels: [] as unknown[] },
  };
  const relatedArtists = (mainData.relationships?.artists?.data || []).map((r) => ({
    provider: "apple_music", providerEntityType: "artist", providerEntityId: r.id,
    providerUrl: (r.attributes?.url as string) || r.href || null, title: (r.attributes?.name as string) || "Unknown",
    subtitle: null, artistDisplayName: (r.attributes?.name as string) || null,
    artworkUrl: artUrl(r.attributes?.artwork as AppleArtwork | undefined, 300), confidenceScore: 0.95,
    source: { searchQuery: title, storefrontOrMarket: storefront, fetchedAt: new Date().toISOString(), rawKind: "artists" },
    summaryFields: [], relatedEntities: { artists: [], releases: [], tracks: [], labels: [] },
  }));
  const relatedTracks = (mainData.relationships?.tracks?.data || []).map((r) => {
    const previews = r.attributes?.previews as Array<{ url: string }> | undefined;
    return {
      provider: "apple_music", providerEntityType: "track", providerEntityId: r.id,
      providerUrl: (r.attributes?.url as string) || r.href || null, title: (r.attributes?.name as string) || "Unknown",
      subtitle: (r.attributes?.artistName as string) || null, artistDisplayName: (r.attributes?.artistName as string) || null,
      artworkUrl: artUrl(r.attributes?.artwork as AppleArtwork | undefined, 300), confidenceScore: 0.95,
      source: { searchQuery: title, storefrontOrMarket: storefront, fetchedAt: new Date().toISOString(), rawKind: "songs" },
      summaryFields: [
        r.attributes?.trackNumber != null ? { key: "trackNumber", label: "Track #", value: r.attributes.trackNumber } : null,
        r.attributes?.isrc ? { key: "isrc", label: "ISRC", value: r.attributes.isrc } : null,
        r.attributes?.durationInMillis ? { key: "duration", label: "Duration", value: Math.round((r.attributes.durationInMillis as number) / 1000) + "s" } : null,
        previews?.[0]?.url ? { key: "preview", label: "Preview", value: previews[0].url } : null,
      ].filter(Boolean),
      relatedEntities: { artists: [], releases: [], tracks: [], labels: [] },
    };
  });
  const sourceFields = Object.entries(a).filter(([_k, v]) => v != null).map(([key, value]) => ({
    key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
    value: typeof value === "object" ? JSON.stringify(value).slice(0, 100) : String(value).slice(0, 200),
  }));
  const { data: shellLinks } = await db.from("provider_entity_links")
    .select("registry_entity_id").eq("provider", provider).eq("provider_entity_id", providerEntityId).eq("registry_entity_type", providerEntityType);
  const shellIds = (shellLinks || []).map((l) => l.registry_entity_id as string);
  const { data: shells } = shellIds.length > 0
    ? await db.from("registry_release_shells").select("id, slug, title, status, release_id").in("id", shellIds)
    : { data: [] };
  const existingShellMatches = (shells || []).map((s) => ({
    shellKey: s.id, registryEntityId: s.id, status: s.status, title: s.title, providerEntityId,
  }));
  const registryCandidates = providerEntityType === "release" ? await searchRegistryReleases(db, title, artistDisplayName) : [];
  const possibleRegistryMatches = {
    artists: [],
    releases: registryCandidates.map((r) => ({
      registryEntityId: r.id, entityType: "release",
      title: r.title, matchReason: "Registry: \"" + r.title + "\" by " + (r.primary_artist_name || "unknown"),
      matchScore: 0.85,
    })),
    tracks: [],
  };
  return json(req, {
    result: sourceResult,
    detail: {
      release: providerEntityType === "release" ? sourceResult : null,
      artists: relatedArtists, tracks: relatedTracks, labels: [],
      providerLinks: [
        ...relatedArtists.map((ar) => ({ entityType: "artist", providerEntityId: ar.providerEntityId, providerUrl: ar.providerUrl })),
        ...relatedTracks.map((tr) => ({ entityType: "track", providerEntityId: tr.providerEntityId, providerUrl: tr.providerUrl })),
      ],
      sourceFields,
    },
    possibleRegistryMatches,
    existingShellMatches,
  });
}

async function handleTestConnection(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const provider = (body.provider as string) || "apple_music";
  const storefront = (body.storefront as string) || "ke";
  if (provider !== "apple_music") return json(req, { provider, storefront, status: "unavailable", error: "Only Apple Music is supported.", testedAt: new Date().toISOString() });
  const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key");
  const teamId = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id");
  const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");
  if (!privateKey || !teamId || !musicKeyId) {
    const missing = [!privateKey && "APPLE_MUSIC_PRIVATE_KEY", !teamId && "APPLE_TEAM_ID", !musicKeyId && "APPLE_MUSIC_KEY_ID"].filter(Boolean);
    return json(req, { provider, storefront, status: "failed", error: "Missing: " + missing.join(", "), testedAt: new Date().toISOString() });
  }
  const start = Date.now();
  let token: string;
  try { token = await createAppleMusicJWT(privateKey, teamId, musicKeyId); }
  catch (e) { return json(req, { provider, storefront, status: "failed", error: "JWT failed: " + (e instanceof Error ? e.message : String(e)), testedAt: new Date().toISOString() }); }
  try {
    const res = await fetch("https://api.music.apple.com/v1/catalog/" + storefront + "/search?term=test&types=artists&limit=1", { headers: { Authorization: "Bearer " + token } });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      const bd = await res.json() as { results?: { artists?: { data?: unknown[] } } };
      return json(req, { provider, storefront, status: "connected", latencyMs, resultCount: bd.results?.artists?.data?.length || 0, testedAt: new Date().toISOString() });
    }
    return json(req, { provider, storefront, status: "failed", error: "Apple Music API returned " + res.status, latencyMs, testedAt: new Date().toISOString() });
  } catch (e) {
    return json(req, { provider, storefront, status: "failed", error: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - start, testedAt: new Date().toISOString() });
  }
}

async function fetchAppleAlbum(token: string, providerEntityId: string, storefront: string): Promise<{ album: AppleSearchHit | null; error: string | null }> {
  const apiUrl = "https://api.music.apple.com/v1/catalog/" + storefront + "/albums/" + providerEntityId + "?include=artists,tracks";
  const res = await fetch(apiUrl, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) { const errText = await res.text(); return { album: null, error: "Apple Music API " + res.status + ": " + errText.slice(0, 300) }; }
  const raw = await res.json() as { data: AppleSearchHit[] };
  const album = raw.data?.[0] || null;
  if (album) {
    console.log("[fetchAppleAlbum] id:", providerEntityId, "tracks:", album.relationships?.tracks?.data?.length ?? 0, "artists:", album.relationships?.artists?.data?.length ?? 0);
  }
  return { album, error: null };
}

function extractTracks(album: AppleSearchHit, albumArtist: string, artwork: string | null) {
  const trackData = album.relationships?.tracks?.data || [];
  console.log("[extractTracks] raw track count:", trackData.length);
  return trackData.map((t) => ({
    id: t.id,
    title: (t.attributes?.name as string) || "Untitled",
    artistName: (t.attributes?.artistName as string) || albumArtist,
    trackNumber: (t.attributes?.trackNumber as number | null) ?? null,
    durationMs: (t.attributes?.durationInMillis as number | null) || null,
    isrc: (t.attributes?.isrc as string) || null,
    artworkUrl: artUrl(t.attributes?.artwork as AppleArtwork | undefined, 300) || artwork,
    previewUrl: ((t.attributes?.previews as Array<{ url: string }> | undefined)?.[0]?.url) || null,
  }));
}

async function getAppleCredentials(db: ReturnType<typeof createClient>): Promise<{ token: string } | { error: string }> {
  const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key");
  const teamId = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id");
  const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");
  if (!privateKey || !teamId || !musicKeyId) return { error: "Apple Music credentials not configured." };
  try {
    const token = await createAppleMusicJWT(privateKey, teamId, musicKeyId);
    return { token };
  } catch (e) {
    return { error: "JWT failed: " + (e instanceof Error ? e.message : String(e)) };
  }
}

/** Terminal states — shells in these states should not be clobbered by refresh/create */
const TERMINAL_SHELL_STATUSES = ["canonicalized", "rejected"];

async function handleCreateShell(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>, userId: string) {
  try {
    const now = new Date().toISOString();
    const provider = (body.provider as string) || "apple_music";
    const providerEntityType = (body.providerEntityType as string) || "release";
    const providerEntityId = (body.providerEntityId as string) || "";
    const storefront = (body.storefrontOrMarket as string) || (body.storefront as string) || "ke";
    const selectedTrackIds = (body.selectedTrackIds as string[]) || [];
    const idempotencyKey = (body.idempotencyKey as string) || (provider + ":" + providerEntityType + ":" + providerEntityId + ":" + storefront + ":create_shell");
    if (!providerEntityId) return json(req, { error: "Missing providerEntityId" });
    if (providerEntityType !== "release") return json(req, { error: "Only releases can be staged as shells." });

    const creds = await getAppleCredentials(db);
    if ("error" in creds) return json(req, { error: creds.error });

    const { album, error: fetchErr } = await fetchAppleAlbum(creds.token, providerEntityId, storefront);
    if (fetchErr || !album) return json(req, { error: fetchErr || "Album not found" });
    const attrs = album.attributes || {};
    const albumTitle = attrs.name || "Untitled";
    const albumArtist = attrs.artistName || "Unknown Artist";
    const artwork = artUrl(attrs.artwork, 600);
    const releaseDate = attrs.releaseDate || null;
    const genreNames = attrs.genreNames || [];
    const recordLabel = attrs.recordLabel || null;
    const upc = attrs.playParams?.id || null;
    const appleUrl = attrs.url || ("https://music.apple.com/" + storefront + "/album/" + providerEntityId);
    const tracks = extractTracks(album, albumArtist, artwork);
    const selectedTracks = selectedTrackIds.length > 0 ? tracks.filter((t) => selectedTrackIds.includes(t.id)) : [...tracks];
    if (selectedTracks.length === 0 && tracks.length > 0) selectedTracks.push(...tracks);

    const artistSlugCandidate = slugify(albumArtist);
    let primaryArtistSlug = artistSlugCandidate;
    let primaryArtistName = albumArtist;
    const { data: registryArtist } = await db.from("registry_artists").select("slug, display_name").eq("slug", artistSlugCandidate).in("status", ["active", "draft"]).maybeSingle();
    if (registryArtist) { primaryArtistSlug = registryArtist.slug as string; primaryArtistName = registryArtist.display_name as string; }
    const scopedSlug = primaryArtistSlug + "--" + slugify(albumTitle);

    const { data: existingLinks } = await db.from("provider_entity_links").select("registry_entity_id").eq("provider", provider).eq("provider_entity_id", providerEntityId).limit(1);
    if (existingLinks && existingLinks.length > 0) {
      const existingId = existingLinks[0].registry_entity_id as string;
      return json(req, { error: "A release shell already exists for this provider entity.", existingShellKey: existingId, existingRegistryEntityId: existingId });
    }

    let releaseId: string;
    let matchedExistingRelease = false;
    const { data: bySlug } = await db.from("registry_releases").select("id, slug").eq("slug", scopedSlug).maybeSingle();
    if (bySlug) {
      releaseId = bySlug.id as string;
      matchedExistingRelease = true;
    } else {
      const candidates = await searchRegistryReleases(db, albumTitle, albumArtist);
      const best = candidates.find((r) => {
        const rt = ((r.title as string) || "").toLowerCase();
        const at = albumTitle.toLowerCase();
        return rt === at || rt.startsWith(at.slice(0, Math.min(at.length, 15)));
      });
      if (best) {
        releaseId = best.id as string;
        matchedExistingRelease = true;
      } else {
        releaseId = crypto.randomUUID();
        const { error: relErr } = await db.from("registry_releases").insert({
          id: releaseId, slug: scopedSlug, title: albumTitle,
          normalized_title: albumTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
          status: "draft", metadata: {}, release_date: releaseDate, artwork_url: artwork, upc, created_at: now, updated_at: now,
        });
        if (relErr) return json(req, { error: "Failed to create registry_releases row: " + relErr.message });
      }
    }

    const shellId = crypto.randomUUID();
    const { error: shellErr } = await db.from("registry_release_shells").insert({
      id: shellId, release_id: releaseId, slug: scopedSlug, title: albumTitle,
      primary_artist_name: primaryArtistName, primary_artist_slug: primaryArtistSlug,
      release_date: releaseDate, track_count: selectedTracks.length, has_artwork: !!artwork,
      tracks: selectedTracks, status: "draft", readiness: "draft", generated_by: "provider_intake_api",
      source_provenance: { provider, provider_entity_id: providerEntityId, provider_url: appleUrl, artist_name: albumArtist, genre_names: genreNames, record_label: recordLabel, upc, artwork_url: artwork, track_count: selectedTracks.length, idempotency_key: idempotencyKey, ingested_at: now, matched_existing_release: matchedExistingRelease },
      last_generated_at: now, created_at: now, updated_at: now,
    });
    if (shellErr) return json(req, { error: "Failed to create shell: " + shellErr.message });
    await db.from("provider_entity_links").insert({
      id: crypto.randomUUID(), provider, provider_entity_id: providerEntityId,
      registry_entity_type: "release", registry_entity_id: shellId, provider_url: appleUrl,
      confidence_score: 1.0, match_status: "confirmed", created_at: now, updated_at: now,
    });
    await db.from("registry_release_shell_lifecycle_events").insert({
      id: crypto.randomUUID(), registry_entity_id: shellId, registry_entity_type: "release",
      status: "draft", actor: userId, reason: "Shell created from " + provider + ": " + albumTitle + (matchedExistingRelease ? " -- linked to existing registry release" : ""), created_at: now,
    });
    return json(req, {
      shell: { shellKey: shellId, registryEntityId: shellId, status: "draft" },
      writes: { providerFieldObservations: 0, registryEnrichmentSuggestions: 0, providerEntityLinks: 1, lifecycleEvents: 1 },
      mode: "create", matchedExistingRelease,
      slug: { pattern: "artistSlug--titleSlug", scoped: scopedSlug, artistSlug: primaryArtistSlug, artistName: primaryArtistName },
      release: { id: releaseId, slug: scopedSlug, createdNew: !matchedExistingRelease },
      skipped: [],
    });
  } catch (e) {
    return json(req, { error: "Unexpected create-shell error: " + (e instanceof Error ? e.message : String(e)) });
  }
}

async function handleRefreshShell(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>, userId: string) {
  try {
    const now = new Date().toISOString();
    const provider = (body.provider as string) || "apple_music";
    const providerEntityType = (body.providerEntityType as string) || "release";
    const providerEntityId = (body.providerEntityId as string) || "";
    const storefront = (body.storefrontOrMarket as string) || (body.storefront as string) || "ke";
    const selectedTrackIds = (body.selectedTrackIds as string[]) || [];
    if (!providerEntityId) return json(req, { error: "Missing providerEntityId" });
    if (providerEntityType !== "release") return json(req, { error: "Only releases can be refreshed." });
    const { data: existingLinks } = await db.from("provider_entity_links").select("registry_entity_id").eq("provider", provider).eq("provider_entity_id", providerEntityId).limit(1);
    if (!existingLinks || existingLinks.length === 0) return json(req, { error: "No existing shell found. Use create instead." });
    const shellId = existingLinks[0].registry_entity_id as string;
    const { data: existingShell } = await db.from("registry_release_shells").select("id, slug, release_id, status, source_provenance").eq("id", shellId).maybeSingle();
    if (!existingShell) return json(req, { error: "Existing shell not found." });

    // Guard: don't clobber canonicalized or rejected shells
    const currentStatus = existingShell.status as string;
    if (TERMINAL_SHELL_STATUSES.includes(currentStatus)) {
      console.log(`[refresh-shell] skipping — shell ${shellId} is already "${currentStatus}"`);
      return json(req, {
        shell: { shellKey: shellId, registryEntityId: shellId, status: currentStatus },
        writes: { providerFieldObservations: 0, registryEnrichmentSuggestions: 0, providerEntityLinks: 0, lifecycleEvents: 0 },
        mode: "refresh-skipped",
        skipped: [`Shell is already ${currentStatus} — refresh not allowed`],
        diag: { tracksFetched: 0, tracksSelected: 0 },
      });
    }

    const creds = await getAppleCredentials(db);
    if ("error" in creds) return json(req, { error: creds.error });
    const { album, error: fetchErr } = await fetchAppleAlbum(creds.token, providerEntityId, storefront);
    if (fetchErr || !album) return json(req, { error: fetchErr || "Album not found" });
    const attrs = album.attributes || {};
    const albumTitle = attrs.name || "Untitled";
    const albumArtist = attrs.artistName || "Unknown Artist";
    const artwork = artUrl(attrs.artwork, 600);
    const releaseDate = attrs.releaseDate || null;
    const genreNames = attrs.genreNames || [];
    const recordLabel = attrs.recordLabel || null;
    const upc = attrs.playParams?.id || null;
    const appleUrl = attrs.url || ("https://music.apple.com/" + storefront + "/album/" + providerEntityId);
    const tracks = extractTracks(album, albumArtist, artwork);
    const selectedTracks = selectedTrackIds.length > 0 ? tracks.filter((t) => selectedTrackIds.includes(t.id)) : [...tracks];
    if (selectedTracks.length === 0 && tracks.length > 0) selectedTracks.push(...tracks);

    console.log("[refresh-shell] id:", shellId, "tracks fetched:", tracks.length, "selected:", selectedTracks.length);

    const artistSlugCandidate = slugify(albumArtist);
    let primaryArtistSlug = artistSlugCandidate;
    let primaryArtistName = albumArtist;
    const { data: registryArtist } = await db.from("registry_artists").select("slug, display_name").eq("slug", artistSlugCandidate).in("status", ["active", "draft"]).maybeSingle();
    if (registryArtist) { primaryArtistSlug = registryArtist.slug as string; primaryArtistName = registryArtist.display_name as string; }

    await db.from("registry_enrichment_suggestions").delete().eq("registry_entity_id", shellId);
    await db.from("provider_field_observations").delete().eq("provider_item_id", providerEntityId);
    const updatePayload = {
      title: albumTitle, primary_artist_name: primaryArtistName, primary_artist_slug: primaryArtistSlug,
      release_date: releaseDate, track_count: selectedTracks.length, has_artwork: !!artwork,
      tracks: selectedTracks, status: "draft", readiness: "draft",
      source_provenance: { provider, provider_entity_id: providerEntityId, provider_url: appleUrl, artist_name: albumArtist, genre_names: genreNames, record_label: recordLabel, upc, artwork_url: artwork, track_count: selectedTracks.length, refreshed_at: now, ingested_at: (existingShell.source_provenance as Record<string, unknown>)?.ingested_at || now },
      last_generated_at: now, updated_at: now,
    };
    const { error: updErr } = await db.from("registry_release_shells").update(updatePayload).eq("id", shellId);
    if (updErr) {
      console.error("[refresh-shell] DB update failed:", updErr.message, "tracks:", selectedTracks.length);
      return json(req, { error: "Failed to refresh shell: " + updErr.message, diag: { tracksFetched: tracks.length, tracksSelected: selectedTracks.length } });
    }
    const existingReleaseId = existingShell.release_id as string;
    const { data: existingRelease } = await db.from("registry_releases").select("id, status").eq("id", existingReleaseId).maybeSingle();
    if (existingRelease && existingRelease.status === "draft") {
      const { error: relUpdErr } = await db.from("registry_releases").update({ title: albumTitle, release_date: releaseDate, artwork_url: artwork, upc, updated_at: now }).eq("id", existingReleaseId);
      if (relUpdErr) console.error("[refresh-shell] release update failed:", relUpdErr.message);
    }
    await db.from("registry_release_shell_lifecycle_events").insert({
      id: crypto.randomUUID(), registry_entity_id: shellId, registry_entity_type: "release",
      status: "draft", actor: userId, reason: "Shell refreshed from " + provider + ": " + albumTitle, created_at: now,
    });
    return json(req, {
      shell: { shellKey: shellId, registryEntityId: shellId, status: "draft" },
      writes: { providerFieldObservations: 0, registryEnrichmentSuggestions: 0, providerEntityLinks: 0, lifecycleEvents: 1 },
      mode: "refresh",
      slug: { pattern: "artistSlug--titleSlug", scoped: existingShell.slug, artistSlug: primaryArtistSlug, artistName: primaryArtistName },
      release: { id: existingReleaseId, slug: existingShell.slug, createdNew: false },
      skipped: [],
      diag: { tracksFetched: tracks.length, tracksSelected: selectedTracks.length },
    });
  } catch (e) {
    return json(req, { error: "Unexpected refresh-shell error: " + (e instanceof Error ? e.message : String(e)) });
  }
}

async function handleAttachShell(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>, userId: string) {
  try {
    const now = new Date().toISOString();
    const provider = (body.provider as string) || "apple_music";
    const providerEntityType = (body.providerEntityType as string) || "release";
    const providerEntityId = (body.providerEntityId as string) || "";
    const storefront = (body.storefrontOrMarket as string) || (body.storefront as string) || "ke";
    const targetRegistryEntityId = (body.targetRegistryEntityId as string) || "";
    if (!providerEntityId) return json(req, { error: "Missing providerEntityId" });
    if (!targetRegistryEntityId) return json(req, { error: "Missing targetRegistryEntityId" });
    if (providerEntityType !== "release") return json(req, { error: "Only releases can be attached." });

    let shellId: string | null = null;
    let releaseId: string | null = null;
    let targetSlug = "";
    const { data: targetShell } = await db.from("registry_release_shells").select("id, release_id, slug").eq("id", targetRegistryEntityId).maybeSingle();
    if (targetShell) {
      shellId = targetShell.id as string;
      releaseId = targetShell.release_id as string;
      targetSlug = targetShell.slug as string;
    } else {
      const { data: targetRelease } = await db.from("registry_releases").select("id, slug").eq("id", targetRegistryEntityId).maybeSingle();
      if (targetRelease) { releaseId = targetRelease.id as string; targetSlug = targetRelease.slug as string; }
    }
    if (!releaseId) return json(req, { error: "Target registry entity not found. Pass either a shell ID or a registry release ID." });

    const creds = await getAppleCredentials(db);
    if ("error" in creds) return json(req, { error: creds.error });
    const { album, error: fetchErr } = await fetchAppleAlbum(creds.token, providerEntityId, storefront);
    if (fetchErr || !album) return json(req, { error: fetchErr || "Album not found" });
    const attrs = album.attributes || {};
    const albumTitle = attrs.name || "Untitled";
    const albumArtist = attrs.artistName || "Unknown Artist";
    const artwork = artUrl(attrs.artwork, 600);
    const releaseDate = attrs.releaseDate || null;
    const genreNames = attrs.genreNames || [];
    const recordLabel = attrs.recordLabel || null;
    const upc = attrs.playParams?.id || null;
    const appleUrl = attrs.url || ("https://music.apple.com/" + storefront + "/album/" + providerEntityId);
    const tracks = extractTracks(album, albumArtist, artwork);

    console.log("[attach-shell] id:", shellId, "providerEntityId:", providerEntityId, "tracks fetched:", tracks.length);

    const artistSlugCandidate = slugify(albumArtist);
    let primaryArtistSlug = artistSlugCandidate;
    let primaryArtistName = albumArtist;
    const { data: registryArtist } = await db.from("registry_artists").select("slug, display_name").eq("slug", artistSlugCandidate).in("status", ["active", "draft"]).maybeSingle();
    if (registryArtist) { primaryArtistSlug = registryArtist.slug as string; primaryArtistName = registryArtist.display_name as string; }

    const provenance = { provider, provider_entity_id: providerEntityId, provider_url: appleUrl, artist_name: albumArtist, genre_names: genreNames, record_label: recordLabel, upc, artwork_url: artwork, track_count: tracks.length, attached_at: now, ingested_at: now };

    if (shellId) {
      const updatePayload = {
        title: albumTitle, primary_artist_name: primaryArtistName, primary_artist_slug: primaryArtistSlug,
        release_date: releaseDate, track_count: tracks.length, has_artwork: !!artwork, tracks,
        status: "draft", readiness: "draft", source_provenance: provenance, last_generated_at: now, updated_at: now,
      };
      const { error: updErr } = await db.from("registry_release_shells").update(updatePayload).eq("id", shellId);
      if (updErr) {
        console.error("[attach-shell] DB update failed:", updErr.message, "tracks:", tracks.length);
        return json(req, { error: "Failed to attach shell: " + updErr.message, diag: { tracksFetched: tracks.length } });
      }
    } else {
      shellId = crypto.randomUUID();
      const { error: shellErr } = await db.from("registry_release_shells").insert({
        id: shellId, release_id: releaseId, slug: targetSlug, title: albumTitle,
        primary_artist_name: primaryArtistName, primary_artist_slug: primaryArtistSlug,
        release_date: releaseDate, track_count: tracks.length, has_artwork: !!artwork, tracks,
        status: "draft", readiness: "draft", generated_by: "provider_intake_api", source_provenance: provenance,
        last_generated_at: now, created_at: now, updated_at: now,
      });
      if (shellErr) return json(req, { error: "Failed to create shell: " + shellErr.message });
    }

    const { data: existingLink } = await db.from("provider_entity_links").select("id").eq("provider", provider).eq("provider_entity_id", providerEntityId).eq("registry_entity_type", "release").eq("registry_entity_id", shellId).maybeSingle();
    if (!existingLink) {
      await db.from("provider_entity_links").insert({
        id: crypto.randomUUID(), provider, provider_entity_id: providerEntityId,
        registry_entity_type: "release", registry_entity_id: shellId, provider_url: appleUrl,
        confidence_score: 1.0, match_status: "confirmed", created_at: now, updated_at: now,
      });
    }
    await db.from("registry_release_shell_lifecycle_events").insert({
      id: crypto.randomUUID(), registry_entity_id: shellId, registry_entity_type: "release",
      status: "draft", actor: userId, reason: "Shell attached to " + provider + " release: " + albumTitle, created_at: now,
    });
    return json(req, {
      shell: { shellKey: shellId, registryEntityId: shellId, status: "draft" },
      writes: { providerFieldObservations: 0, registryEnrichmentSuggestions: 0, providerEntityLinks: 1, lifecycleEvents: 1 },
      mode: "attach",
      slug: { pattern: "artistSlug--titleSlug", scoped: targetSlug, artistSlug: primaryArtistSlug, artistName: primaryArtistName },
      release: { id: releaseId, slug: targetSlug, createdNew: false },
      diag: { tracksFetched: tracks.length },
    });
  } catch (e) {
    return json(req, { error: "Unexpected attach-shell error: " + (e instanceof Error ? e.message : String(e)) });
  }
}

async function handleBackfill(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>, userId: string) {
  try {
    const now = new Date().toISOString();
    const provider = (body.provider as string) || "apple_music";
    const providerEntityType = (body.providerEntityType as string) || "release";
    const providerEntityId = (body.providerEntityId as string) || "";
    const storefront = (body.storefrontOrMarket as string) || (body.storefront as string) || "ke";
    const targetRegistryEntityId = (body.targetRegistryEntityId as string) || "";
    const selectedTrackIds = (body.selectedTrackIds as string[]) || [];
    if (!providerEntityId) return json(req, { error: "Missing providerEntityId" });
    if (!targetRegistryEntityId) return json(req, { error: "Missing targetRegistryEntityId" });
    if (providerEntityType !== "release") return json(req, { error: "Only releases can be backfilled." });

    const { data: targetRelease } = await db.from("registry_releases").select("id, slug, title, status, release_date, artwork_url, upc, primary_artist_name").eq("id", targetRegistryEntityId).maybeSingle();
    if (!targetRelease) return json(req, { error: "Target release not found." });

    const creds = await getAppleCredentials(db);
    if ("error" in creds) return json(req, { error: creds.error });
    const { album, error: fetchErr } = await fetchAppleAlbum(creds.token, providerEntityId, storefront);
    if (fetchErr || !album) return json(req, { error: fetchErr || "Album not found" });
    const attrs = album.attributes || {};
    const albumTitle = attrs.name || "Untitled";
    const albumArtist = attrs.artistName || "Unknown Artist";
    const artwork = artUrl(attrs.artwork, 600);
    const releaseDate = attrs.releaseDate || null;
    const genreNames = attrs.genreNames || [];
    const recordLabel = attrs.recordLabel || null;
    const upc = attrs.playParams?.id || null;
    const appleUrl = attrs.url || ("https://music.apple.com/" + storefront + "/album/" + providerEntityId);
    const tracks = extractTracks(album, albumArtist, artwork);
    const selectedTracks = selectedTrackIds.length > 0 ? tracks.filter((t) => selectedTrackIds.includes(t.id)) : [...tracks];
    if (selectedTracks.length === 0 && tracks.length > 0) selectedTracks.push(...tracks);

    const releaseId = targetRelease.id as string;
    const existingSlug = targetRelease.slug as string;
    const releaseUpdates: Record<string, unknown> = { updated_at: now };
    if (albumTitle !== targetRelease.title) releaseUpdates.title = albumTitle;
    if (releaseDate && releaseDate !== targetRelease.release_date) releaseUpdates.release_date = releaseDate;
    if (artwork && artwork !== targetRelease.artwork_url) releaseUpdates.artwork_url = artwork;
    if (upc && upc !== targetRelease.upc) releaseUpdates.upc = upc;
    if (Object.keys(releaseUpdates).length > 1) await db.from("registry_releases").update(releaseUpdates).eq("id", releaseId);

    const provenance = { provider, provider_entity_id: providerEntityId, provider_url: appleUrl, artist_name: albumArtist, genre_names: genreNames, record_label: recordLabel, upc, artwork_url: artwork, track_count: selectedTracks.length, backfilled_at: now, ingested_at: now };
    const { data: existingShell } = await db.from("registry_release_shells").select("id").eq("release_id", releaseId).maybeSingle();
    let shellId: string;
    if (existingShell) {
      shellId = existingShell.id as string;
      const updatePayload = {
        title: albumTitle, primary_artist_name: albumArtist, release_date: releaseDate, track_count: selectedTracks.length, has_artwork: !!artwork,
        tracks: selectedTracks, status: "draft", readiness: "draft", source_provenance: provenance, last_generated_at: now, updated_at: now,
      };
      const { error: updErr } = await db.from("registry_release_shells").update(updatePayload).eq("id", shellId);
      if (updErr) {
        console.error("[backfill] DB update failed:", updErr.message, "tracks:", selectedTracks.length);
        return json(req, { error: "Failed to backfill shell: " + updErr.message, diag: { tracksFetched: tracks.length, tracksSelected: selectedTracks.length } });
      }
    } else {
      shellId = crypto.randomUUID();
      const { error: shellErr } = await db.from("registry_release_shells").insert({
        id: shellId, release_id: releaseId, slug: existingSlug, title: albumTitle, primary_artist_name: albumArtist,
        release_date: releaseDate, track_count: selectedTracks.length, has_artwork: !!artwork, tracks: selectedTracks,
        status: "draft", readiness: "draft", generated_by: "provider_intake_api", source_provenance: provenance,
        last_generated_at: now, created_at: now, updated_at: now,
      });
      if (shellErr) return json(req, { error: "Failed to create shell: " + shellErr.message });
    }
    const { data: existingLink } = await db.from("provider_entity_links").select("id").eq("provider", provider).eq("provider_entity_id", providerEntityId).eq("registry_entity_type", "release").eq("registry_entity_id", shellId).maybeSingle();
    if (!existingLink) {
      await db.from("provider_entity_links").insert({
        id: crypto.randomUUID(), provider, provider_entity_id: providerEntityId,
        registry_entity_type: "release", registry_entity_id: shellId, provider_url: appleUrl,
        confidence_score: 1.0, match_status: "confirmed", created_at: now, updated_at: now,
      });
    }
    await db.from("registry_release_shell_lifecycle_events").insert({
      id: crypto.randomUUID(), registry_entity_id: shellId, registry_entity_type: "release",
      status: "draft", actor: userId, reason: "Shell backfilled from " + provider + ": " + albumTitle, created_at: now,
    });
    return json(req, {
      shell: { shellKey: shellId, registryEntityId: shellId, status: "draft" },
      writes: { providerFieldObservations: 0, registryEnrichmentSuggestions: 0, providerEntityLinks: 1, lifecycleEvents: 1 },
      mode: "backfill",
      slug: { pattern: "artistSlug--titleSlug", scoped: existingSlug, artistSlug: slugify(albumArtist), artistName: albumArtist },
      release: { id: releaseId, slug: existingSlug, createdNew: false },
    });
  } catch (e) {
    return json(req, { error: "Unexpected backfill error: " + (e instanceof Error ? e.message : String(e)) });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return json(req, { error: "Missing Authorization header" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const uc = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: "Bearer " + token } } });
  const { data: { user }, error: ae } = await uc.auth.getUser(token);
  if (ae || !user) return json(req, { error: "Invalid or expired token" }, 401);
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { body = {}; }
  const route = (body.route as string) || "";
  try {
    if (route === "search") return handleSearch(req, db, body);
    if (route === "inspect") return handleInspect(req, db, body);
    if (route === "test-connection") return handleTestConnection(req, db, body);
    if (route === "create-shell") return handleCreateShell(req, db, body, user.id);
    if (route === "refresh-shell") return handleRefreshShell(req, db, body, user.id);
    if (route === "attach-shell") return handleAttachShell(req, db, body, user.id);
    if (route === "backfill") return handleBackfill(req, db, body, user.id);
    return json(req, { error: "Unknown route: " + (route || "none") });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[provider-intake-api] error:", message);
    return json(req, { error: "Internal error", detail: message });
  }
});