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
  const ev = Deno.env.get(envVar); if (ev && ev.trim()) return ev.trim();
  try { const { data: row } = await db.from("admin_settings_secrets").select("setting_value").eq("setting_key", dbKey).maybeSingle(); if (row && (row.setting_value as string)?.trim()) return (row.setting_value as string).trim(); } catch { }
  return null;
}

async function createAppleMusicJWT(pk: string, tid: string, kid: string): Promise<string> {
  const pem = pk.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const bin = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", bin, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = { alg: "ES256", kid };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: tid, iat: now, exp: now + 3600 };
  const enc = new TextEncoder();
  const b64u = (s: string) => s.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const hb = b64u(btoa(JSON.stringify(header))), pb = b64u(btoa(JSON.stringify(payload))), si = hb+"."+pb;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(si));
  const sb = b64u(btoa(String.fromCharCode(...new Uint8Array(sig))));
  return si+"."+sb;
}

interface AppleArtwork { url: string; width: number; height: number; }
interface AppleSearchHit {
  id: string; type: string; href: string;
  attributes?: {
    name?: string; artistName?: string; albumName?: string;
    url?: string; artwork?: AppleArtwork;
    releaseDate?: string; genreNames?: string[];
    recordLabel?: string; isrc?: string; trackNumber?: number;
    durationInMillis?: number; contentRating?: string;
    editorialNotes?: { short?: string; standard?: string; };
    playParams?: { id?: string; kind?: string; };
    previews?: Array<{ url: string }>;
  };
  relationships?: {
    artists?: { data: Array<{ id: string; type: string; href?: string; attributes?: { name?: string; url?: string; artwork?: AppleArtwork } }> };
    albums?: { data: Array<{ id: string; type: string; href?: string; attributes?: { name?: string; artistName?: string; artwork?: AppleArtwork; url?: string; trackCount?: number; releaseDate?: string; } }> };
    tracks?: { data: Array<{ id: string; type: string; href?: string; attributes?: { name?: string; artistName?: string; artwork?: AppleArtwork; url?: string; durationInMillis?: number; trackNumber?: number; isrc?: string; previews?: Array<{ url: string }> } }> };
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
  const providerUrl = a.url || `https://music.apple.com/${storefront}/${hit.type === "albums" ? "album" : hit.type === "songs" ? "song" : "artist"}/${hit.id}`;
  const artworkUrl = artUrl(a.artwork, 300);

  const summaryFields: Array<{ key: string; label: string; value: unknown }> = [];
  if (a.releaseDate) summaryFields.push({ key: "releaseDate", label: "Release Date", value: a.releaseDate });
  if (a.genreNames) summaryFields.push({ key: "genres", label: "Genres", value: a.genreNames.join(", ") });
  if (a.recordLabel) summaryFields.push({ key: "label", label: "Label", value: a.recordLabel });
  if (a.isrc) summaryFields.push({ key: "isrc", label: "ISRC", value: a.isrc });
  if (a.trackNumber != null) summaryFields.push({ key: "trackNumber", label: "Track #", value: a.trackNumber });
  if (a.contentRating) summaryFields.push({ key: "rating", label: "Rating", value: a.contentRating });

  const relatedEntities = {
    artists: (hit.relationships?.artists?.data || []).map((r: Record<string, unknown>) => ({
      providerEntityType: "artist" as const,
      providerEntityId: r.id as string,
      name: ((r.attributes as Record<string, unknown>)?.name as string) || "Unknown",
      providerUrl: ((r.attributes as Record<string, unknown>)?.url as string) || null,
      artworkUrl: artUrl((r.attributes as Record<string, unknown>)?.artwork as AppleArtwork | undefined, 200),
    })),
    releases: (hit.relationships?.albums?.data || []).map((r: Record<string, unknown>) => ({
      providerEntityType: "release" as const,
      providerEntityId: r.id as string,
      name: ((r.attributes as Record<string, unknown>)?.name as string) || "Unknown",
      providerUrl: ((r.attributes as Record<string, unknown>)?.url as string) || null,
      artworkUrl: artUrl((r.attributes as Record<string, unknown>)?.artwork as AppleArtwork | undefined, 200),
    })),
    tracks: (hit.relationships?.tracks?.data || []).map((r: Record<string, unknown>) => ({
      providerEntityType: "track" as const,
      providerEntityId: r.id as string,
      name: ((r.attributes as Record<string, unknown>)?.name as string) || "Unknown",
      providerUrl: ((r.attributes as Record<string, unknown>)?.url as string) || null,
      artworkUrl: artUrl((r.attributes as Record<string, unknown>)?.artwork as AppleArtwork | undefined, 200),
    })),
    labels: [] as Array<Record<string, unknown>>,
  };

  return {
    provider: "apple_music",
    providerEntityType: entityType,
    providerEntityId: hit.id,
    providerUrl,
    title,
    subtitle: a.albumName || artistDisplayName || null,
    artistDisplayName,
    artworkUrl,
    confidenceScore: 0.95,
    source: {
      searchQuery: query,
      storefrontOrMarket: storefront,
      fetchedAt: new Date().toISOString(),
      rawKind: hit.type,
    },
    summaryFields,
    relatedEntities,
  };
}

// ── SEARCH ─────────────────────────────────────────────────────────
async function handleSearch(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const provider = (body.provider as string) || "apple_music";
  const storefront = (body.storefront as string) || "ke";
  const query = (body.query as string) || (body.q as string) || "";
  const entityType = (body.entityType as string) || (body.type as string) || "all";
  const limit = Math.min(Number(body.limit) || 25, 50);

  if (!query.trim()) return json(req, { error: "Missing query parameter" }, 400);

  if (provider !== "apple_music") {
    return json(req, { provider: "spotify", query, storefrontOrMarket: storefront, groups: { artists: [], releases: [], tracks: [], labels: [] }, rawResultCount: 0, normalizedResultCount: 0, error: "Spotify search is not yet available." });
  }

  const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key");
  const teamId = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id");
  const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");

  if (!privateKey || !teamId || !musicKeyId) {
    return json(req, { provider, query, storefrontOrMarket: storefront, groups: { artists: [], releases: [], tracks: [], labels: [] }, rawResultCount: 0, normalizedResultCount: 0, error: "Apple Music credentials not configured. Upload a private key in Settings." });
  }

  let token: string;
  try {
    token = await createAppleMusicJWT(privateKey, teamId, musicKeyId);
  } catch (e) {
    return json(req, { provider, query, storefrontOrMarket: storefront, groups: { artists: [], releases: [], tracks: [], labels: [] }, rawResultCount: 0, normalizedResultCount: 0, error: "Apple Music JWT creation failed: " + (e instanceof Error ? e.message : String(e)) });
  }

  const types: string[] = [];
  if (entityType === "all") { types.push("artists", "albums", "songs"); }
  else if (entityType === "release") { types.push("albums"); }
  else if (entityType === "track") { types.push("songs"); }
  else if (entityType === "artist") { types.push("artists"); }
  else { types.push(entityType); }

  const apiUrl = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(query)}&types=${types.join(",")}&limit=${limit}`;

  const res = await fetch(apiUrl, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) {
    const errText = await res.text();
    return json(req, { provider, query, storefrontOrMarket: storefront, groups: { artists: [], releases: [], tracks: [], labels: [] }, rawResultCount: 0, normalizedResultCount: 0, error: "Apple Music API " + res.status + ": " + errText.slice(0, 300) });
  }

  const data = await res.json() as { results?: Record<string, { data: AppleSearchHit[] }> };
  const rawGroups = data.results || {};

  const groups = {
    artists: (rawGroups.artists?.data || []).map(h => mapSearchHit(h, storefront, query)),
    releases: (rawGroups.albums?.data || []).map(h => mapSearchHit(h, storefront, query)),
    tracks: (rawGroups.songs?.data || []).map(h => mapSearchHit(h, storefront, query)),
    labels: [] as Array<Record<string, unknown>>,
  };

  const total = groups.artists.length + groups.releases.length + groups.tracks.length;

  return json(req, {
    provider,
    query,
    storefrontOrMarket: storefront,
    groups,
    rawResultCount: total,
    normalizedResultCount: total,
  });
}

// ── INSPECT ────────────────────────────────────────────────────────
async function handleInspect(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const provider = (body.provider as string) || "apple_music";
  const providerEntityType = (body.providerEntityType as string) || "release";
  const providerEntityId = (body.providerEntityId as string) || "";
  const storefront = (body.storefront as string) || "ke";

  if (!providerEntityId) return json(req, { error: "Missing providerEntityId" }, 400);

  const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key");
  const teamId = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id");
  const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");

  if (!privateKey || !teamId || !musicKeyId) {
    return json(req, { error: "Apple Music credentials not configured." }, 400);
  }

  let token: string;
  try {
    token = await createAppleMusicJWT(privateKey, teamId, musicKeyId);
  } catch (e) {
    return json(req, { error: "JWT failed: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }

  const appleType = providerEntityType === "release" ? "albums" : providerEntityType === "track" ? "songs" : "artists";
  const apiUrl = `https://api.music.apple.com/v1/catalog/${storefront}/${appleType}/${providerEntityId}?include=artists,tracks`;

  const res = await fetch(apiUrl, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) {
    const errText = await res.text();
    return json(req, { error: "Apple Music API " + res.status + ": " + errText.slice(0, 300) }, 500);
  }

  const raw = await res.json() as { data: AppleSearchHit[] };
  const mainData = raw.data?.[0];
  if (!mainData) return json(req, { error: "Entity not found" }, 404);

  const a = mainData.attributes || {};
  const query = a.name || "";
  const title = a.name || "";
  const artistDisplayName = a.artistName || null;
  const artworkUrl = artUrl(a.artwork, 600);
  const providerUrl = a.url || `https://music.apple.com/${storefront}/${appleType === "albums" ? "album" : appleType === "songs" ? "song" : "artist"}/${providerEntityId}`;

  const sourceResult = {
    provider,
    providerEntityType,
    providerEntityId,
    providerUrl,
    title,
    subtitle: a.albumName || artistDisplayName || null,
    artistDisplayName,
    artworkUrl,
    confidenceScore: 0.95,
    source: {
      searchQuery: query,
      storefrontOrMarket: storefront,
      fetchedAt: new Date().toISOString(),
      rawKind: appleType,
    },
    summaryFields: [
      a.releaseDate ? { key: "releaseDate", label: "Release Date", value: a.releaseDate } : null,
      a.genreNames ? { key: "genres", label: "Genres", value: a.genreNames.join(", ") } : null,
      a.recordLabel ? { key: "label", label: "Label", value: a.recordLabel } : null,
      a.isrc ? { key: "isrc", label: "ISRC", value: a.isrc } : null,
      a.contentRating ? { key: "rating", label: "Rating", value: a.contentRating } : null,
      a.trackCount != null ? { key: "trackCount", label: "Tracks", value: a.trackCount } : null,
    ].filter(Boolean) as Array<{ key: string; label: string; value: unknown }>,
    relatedEntities: {
      artists: [] as Array<Record<string, unknown>>,
      releases: [] as Array<Record<string, unknown>>,
      tracks: [] as Array<Record<string, unknown>>,
      labels: [] as Array<Record<string, unknown>>,
    },
  };

  const relatedArtists = (mainData.relationships?.artists?.data || []).map(r => ({
    provider: "apple_music",
    providerEntityType: "artist" as const,
    providerEntityId: r.id,
    providerUrl: r.attributes?.url || r.href || null,
    title: r.attributes?.name || "Unknown",
    subtitle: null,
    artistDisplayName: r.attributes?.name || null,
    artworkUrl: artUrl(r.attributes?.artwork, 300),
    confidenceScore: 0.95,
    source: { searchQuery: query, storefrontOrMarket: storefront, fetchedAt: new Date().toISOString(), rawKind: "artists" },
    summaryFields: [] as Array<{ key: string; label: string; value: unknown }>,
    relatedEntities: { artists: [], releases: [], tracks: [], labels: [] },
  }));

  const relatedTracks = (mainData.relationships?.tracks?.data || []).map(r => ({
    provider: "apple_music",
    providerEntityType: "track" as const,
    providerEntityId: r.id,
    providerUrl: r.attributes?.url || r.href || null,
    title: r.attributes?.name || "Unknown",
    subtitle: r.attributes?.artistName || null,
    artistDisplayName: r.attributes?.artistName || null,
    artworkUrl: artUrl(r.attributes?.artwork, 300),
    confidenceScore: 0.95,
    source: { searchQuery: query, storefrontOrMarket: storefront, fetchedAt: new Date().toISOString(), rawKind: "songs" },
    summaryFields: [
      r.attributes?.trackNumber != null ? { key: "trackNumber", label: "Track #", value: r.attributes.trackNumber } : null,
      r.attributes?.isrc ? { key: "isrc", label: "ISRC", value: r.attributes.isrc } : null,
      r.attributes?.durationInMillis ? { key: "duration", label: "Duration", value: Math.round(r.attributes.durationInMillis / 1000) + "s" } : null,
    ].filter(Boolean) as Array<{ key: string; label: string; value: unknown }>,
    relatedEntities: { artists: [], releases: [], tracks: [], labels: [] },
  }));

  const sourceFields = Object.entries(a).filter(([_, v]) => v != null).map(([key, value]) => ({
    key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()),
    value: typeof value === "object" ? JSON.stringify(value).slice(0, 100) : String(value).slice(0, 200),
  }));

  // Look up existing shells for this provider entity
  const { data: shellLinks } = await db.from("provider_entity_links")
    .select("registry_entity_id, provider, provider_entity_id")
    .eq("provider", provider)
    .eq("provider_entity_id", providerEntityId)
    .eq("registry_entity_type", providerEntityType);

  const shellIds = shellLinks?.map(l => l.registry_entity_id as string) || [];
  const { data: shells } = shellIds.length > 0
    ? await db.from("registry_release_shells")
      .select("id, slug, title, status, release_id")
      .in("id", shellIds)
    : { data: [] };

  const existingShellMatches = shells?.map(s => ({
    shellKey: s.id as string,
    registryEntityId: s.id as string,
    status: s.status as string,
    title: s.title as string,
    providerEntityId: providerEntityId,
  })) || [];

  return json(req, {
    result: sourceResult,
    detail: {
      release: providerEntityType === "release" ? sourceResult : null,
      artists: relatedArtists,
      tracks: relatedTracks,
      labels: [],
      providerLinks: [
        ...relatedArtists.map(a => ({ entityType: "artist" as const, providerEntityId: a.providerEntityId, providerUrl: a.providerUrl })),
        ...relatedTracks.map(t => ({ entityType: "track" as const, providerEntityId: t.providerEntityId, providerUrl: t.providerUrl })),
      ],
      sourceFields,
    },
    possibleRegistryMatches: { artists: [], releases: [], tracks: [] },
    existingShellMatches,
  });
}

// ── TEST CONNECTION ────────────────────────────────────────────────
async function handleTestConnection(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const provider = (body.provider as string) || "apple_music";
  const storefront = (body.storefront as string) || "ke";

  if (provider !== "apple_music") {
    return json(req, { provider, storefront, status: "unavailable", error: "Only Apple Music is supported.", testedAt: new Date().toISOString() });
  }

  const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key");
  const teamId = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id");
  const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");

  if (!privateKey || !teamId || !musicKeyId) {
    const missing: string[] = [];
    if (!privateKey) missing.push("APPLE_MUSIC_PRIVATE_KEY");
    if (!teamId) missing.push("APPLE_TEAM_ID");
    if (!musicKeyId) missing.push("APPLE_MUSIC_KEY_ID");
    return json(req, { provider, storefront, status: "failed", error: "Missing credentials: " + missing.join(", "), testedAt: new Date().toISOString() });
  }

  const start = Date.now();
  let token: string;
  try {
    token = await createAppleMusicJWT(privateKey, teamId, musicKeyId);
  } catch (e) {
    return json(req, { provider, storefront, status: "failed", error: "JWT creation failed: " + (e instanceof Error ? e.message : String(e)), testedAt: new Date().toISOString() });
  }

  try {
    const res = await fetch(`https://api.music.apple.com/v1/catalog/${storefront}/search?term=test&types=artists&limit=1`, {
      headers: { Authorization: "Bearer " + token },
    });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      const body = await res.json() as { results?: { artists?: { data?: unknown[] } } };
      const resultCount = body.results?.artists?.data?.length || 0;
      return json(req, { provider, storefront, status: "connected", latencyMs, resultCount, testedAt: new Date().toISOString() });
    }
    return json(req, { provider, storefront, status: "failed", error: "Apple Music API returned " + res.status, latencyMs, testedAt: new Date().toISOString() });
  } catch (e) {
    return json(req, { provider, storefront, status: "failed", error: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - start, testedAt: new Date().toISOString() });
  }
}

// ── CREATE RELEASE SHELL ───────────────────────────────────────────
async function handleCreateShell(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>, userId: string) {
  try {
    const now = new Date().toISOString();
    const provider = (body.provider as string) || "apple_music";
    const providerEntityType = (body.providerEntityType as string) || "release";
    const providerEntityId = (body.providerEntityId as string) || "";
    const storefront = (body.storefrontOrMarket as string) || (body.storefront as string) || "ke";
    const selectedTrackIds = (body.selectedTrackIds as string[]) || [];
    const idempotencyKey = (body.idempotencyKey as string) || `${provider}:${providerEntityType}:${providerEntityId}:${storefront}`;

    if (!providerEntityId) return json(req, { error: "Missing providerEntityId" });
    if (providerEntityType !== "release") return json(req, { error: "Only releases can be staged as shells. Tracks and artists are not supported yet." });

    const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key");
    const teamId = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id");
    const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");
    if (!privateKey || !teamId || !musicKeyId) return json(req, { error: "Apple Music credentials not configured." });

    let token: string;
    try { token = await createAppleMusicJWT(privateKey, teamId, musicKeyId); }
    catch (e) { return json(req, { error: "JWT failed: " + (e instanceof Error ? e.message : String(e)) }); }

    const apiUrl = `https://api.music.apple.com/v1/catalog/${storefront}/albums/${providerEntityId}?include=artists,tracks`;
    const res = await fetch(apiUrl, { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) { const errText = await res.text(); return json(req, { error: "Apple Music API " + res.status + ": " + errText.slice(0, 300) }); }

    const raw = await res.json() as { data: AppleSearchHit[] };
    const album = raw.data?.[0];
    if (!album) return json(req, { error: "Album not found on Apple Music" });

    const attrs = album.attributes || {};
    const albumTitle = attrs.name || "Untitled";
    const albumArtist = attrs.artistName || "Unknown Artist";
    const artworkUrl = artUrl(attrs.artwork, 600);
    const releaseDate = attrs.releaseDate || null;
    const genreNames = attrs.genreNames || [];
    const recordLabel = attrs.recordLabel || null;
    const upc = attrs.playParams?.id || null;
    const appleUrl = attrs.url || `https://music.apple.com/${storefront}/album/${providerEntityId}`;

    const tracks = (album.relationships?.tracks?.data || []).map(t => ({
      id: t.id,
      title: t.attributes?.name || "Untitled",
      artistName: t.attributes?.artistName || albumArtist,
      trackNumber: t.attributes?.trackNumber || null,
      durationMs: t.attributes?.durationInMillis || null,
      isrc: t.attributes?.isrc || null,
      artworkUrl: artUrl(t.attributes?.artwork, 300) || artworkUrl,
      previewUrl: t.attributes?.previews?.[0]?.url || null,
    }));

    const selectedTracks = selectedTrackIds.length > 0
      ? tracks.filter(t => selectedTrackIds.includes(t.id))
      : tracks;
    if (selectedTracks.length === 0 && tracks.length > 0) {
      selectedTracks.push(...tracks);
    }

    const artistSlugCandidate = slugify(albumArtist);
    let primaryArtistSlug = artistSlugCandidate;
    let primaryArtistName = albumArtist;
    const { data: registryArtist, error: artistLookupErr } = await db.from("registry_artists")
      .select("slug, display_name")
      .eq("slug", artistSlugCandidate)
      .eq("status", "active")
      .maybeSingle();
    if (artistLookupErr) return json(req, { error: "Artist lookup failed: " + artistLookupErr.message });
    if (registryArtist) {
      primaryArtistSlug = registryArtist.slug as string;
      primaryArtistName = registryArtist.display_name as string;
    }

    const titleSlug = slugify(albumTitle);
    const scopedSlug = `${primaryArtistSlug}--${titleSlug}`;

    const { data: existingLinks, error: linkCheckErr } = await db.from("provider_entity_links")
      .select("registry_entity_id")
      .eq("provider", provider)
      .eq("provider_entity_id", providerEntityId)
      .limit(1);
    if (linkCheckErr) return json(req, { error: "Idempotency check failed: " + linkCheckErr.message });
    if (existingLinks && existingLinks.length > 0) {
      const existingId = existingLinks[0].registry_entity_id as string;
      return json(req, { error: "A release shell already exists for this provider entity.", existingShellKey: existingId, existingRegistryEntityId: existingId });
    }

    const { data: existingRelease, error: existingReleaseErr } = await db.from("registry_releases")
      .select("id, slug")
      .eq("slug", scopedSlug)
      .maybeSingle();
    if (existingReleaseErr) return json(req, { error: "Step 1a — Failed to check existing release: " + existingReleaseErr.message + " (code: " + existingReleaseErr.code + ")" });

    let releaseId: string;
    if (existingRelease) {
      releaseId = existingRelease.id as string;
    } else {
      releaseId = crypto.randomUUID();
      const { error: releaseErr } = await db.from("registry_releases").insert({
        id: releaseId,
        slug: scopedSlug,
        title: albumTitle,
        normalized_title: albumTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        status: "draft",
        metadata: {},
        release_date: releaseDate,
        artwork_url: artworkUrl,
        upc: upc,
        created_at: now,
        updated_at: now,
      });
      if (releaseErr) return json(req, { error: "Step 1 — Failed to create registry_releases row: " + releaseErr.message + " (code: " + releaseErr.code + ", details: " + (releaseErr.details ?? "none") + ")" });
    }

    const shellId = crypto.randomUUID();
    const { error: shellErr } = await db.from("registry_release_shells").insert({
      id: shellId,
      release_id: releaseId,
      slug: scopedSlug,
      title: albumTitle,
      primary_artist_name: primaryArtistName,
      primary_artist_slug: primaryArtistSlug,
      release_date: releaseDate,
      track_count: selectedTracks.length,
      has_artwork: !!artworkUrl,
      status: "draft",
      readiness: "draft",
      generated_by: "provider_intake_api",
      source_provenance: {
        provider,
        provider_entity_id: providerEntityId,
        provider_url: appleUrl,
        artist_name: albumArtist,
        genre_names: genreNames,
        record_label: recordLabel,
        upc,
        artwork_url: artworkUrl,
        track_count: selectedTracks.length,
        idempotency_key: idempotencyKey,
        ingested_at: now,
      },
      last_generated_at: now,
      created_at: now,
      updated_at: now,
    });
    if (shellErr) return json(req, { error: "Step 2 — Failed to create registry_release_shells row: " + shellErr.message + " (code: " + shellErr.code + ", details: " + (shellErr.details ?? "none") + ")" });

    const { error: linkErr } = await db.from("provider_entity_links").insert({
      id: crypto.randomUUID(),
      provider,
      provider_entity_id: providerEntityId,
      registry_entity_type: "release",
      registry_entity_id: shellId,
      provider_url: appleUrl,
      confidence_score: 1.0,
      match_status: "confirmed",
      created_at: now,
      updated_at: now,
    });
    if (linkErr) return json(req, { error: "Step 3 — Failed to create provider_entity_links row: " + linkErr.message + " (code: " + linkErr.code + ", details: " + (linkErr.details ?? "none") + ")" });

    const fieldObservations: Array<Record<string, unknown>> = [
      { field_name: "title", field_value: albumTitle },
      { field_name: "release_date", field_value: releaseDate },
      { field_name: "artwork_url", field_value: artworkUrl },
      { field_name: "artist_name", field_value: albumArtist },
      { field_name: "url", field_value: appleUrl },
    ];
    if (recordLabel) fieldObservations.push({ field_name: "record_label", field_value: recordLabel });
    if (upc) fieldObservations.push({ field_name: "upc", field_value: upc });
    if (genreNames.length > 0) fieldObservations.push({ field_name: "genre_names", field_value: genreNames.join(", ") });

    let obsCount = 0;
    for (const obs of fieldObservations) {
      const { error: obsErr } = await db.from("provider_field_observations").insert({
        id: crypto.randomUUID(),
        provider_item_id: providerEntityId,
        entity_type: "release",
        field_name: obs.field_name,
        field_value: String(obs.field_value ?? ""),
        provider,
        confidence_score: 0.95,
        source_path: appleUrl,
        raw_payload: obs,
        created_at: now,
      });
      if (!obsErr) obsCount++;
    }

    const enrichmentSuggestions = [
      { field_name: "title", suggested_value: albumTitle },
      { field_name: "release_date", suggested_value: releaseDate },
      { field_name: "artwork_url", suggested_value: artworkUrl },
    ];
    let sugCount = 0;
    for (const sug of enrichmentSuggestions) {
      if (!sug.suggested_value) continue;
      const { error: sugErr } = await db.from("registry_enrichment_suggestions").insert({
        id: crypto.randomUUID(),
        registry_entity_id: shellId,
        registry_entity_type: "release",
        field_name: sug.field_name,
        suggested_value: sug.suggested_value,
        current_value: null,
        provider_item_id: providerEntityId,
        confidence_score: 0.95,
        decision_status: "draft",
        created_at: now,
        updated_at: now,
      });
      if (!sugErr) sugCount++;
    }

    const { error: lifeErr } = await db.from("registry_release_shell_lifecycle_events").insert({
      id: crypto.randomUUID(),
      registry_entity_id: shellId,
      registry_entity_type: "release",
      status: "draft",
      actor: userId,
      reason: `Shell created from ${provider} intake: ${albumTitle} (scoped: ${scopedSlug})`,
      created_at: now,
    });
    if (lifeErr) return json(req, { error: "Step 6 — Failed to create lifecycle event: " + lifeErr.message + " (code: " + lifeErr.code + ", details: " + (lifeErr.details ?? "none") + ")" });

    return json(req, {
      shell: { shellKey: shellId, registryEntityId: shellId, status: "draft" },
      writes: {
        providerFieldObservations: obsCount,
        registryEnrichmentSuggestions: sugCount,
        providerEntityLinks: 1,
        lifecycleEvents: 1,
      },
      mode: "create",
      slug: {
        pattern: "artistSlug--titleSlug",
        scoped: scopedSlug,
        artistSlug: primaryArtistSlug,
        artistName: primaryArtistName,
      },
      release: {
        id: releaseId,
        slug: scopedSlug,
        createdNew: !existingRelease,
      },
      skipped: selectedTrackIds.length > 0 && selectedTrackIds.length !== tracks.length
        ? tracks.filter(t => !selectedTrackIds.includes(t.id)).map(t => ({ entityType: "track", providerEntityId: t.id, reason: "Not selected" }))
        : [],
    });
  } catch (unexpectedErr) {
    const message = unexpectedErr instanceof Error ? unexpectedErr.message : String(unexpectedErr);
    const stack = unexpectedErr instanceof Error ? (unexpectedErr.stack ?? "").slice(0, 600) : "";
    return json(req, { error: "Unexpected create-shell error: " + message, stack });
  }
}

// ── REFRESH RELEASE SHELL ──────────────────────────────────────────
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

    const { data: existingLinks, error: linkErr } = await db.from("provider_entity_links")
      .select("registry_entity_id")
      .eq("provider", provider)
      .eq("provider_entity_id", providerEntityId)
      .limit(1);
    if (linkErr) return json(req, { error: "Failed to find existing link: " + linkErr.message });
    if (!existingLinks || existingLinks.length === 0) {
      return json(req, { error: "No existing shell found for this provider entity. Use create instead." });
    }
    const shellId = existingLinks[0].registry_entity_id as string;

    const { data: existingShell, error: shellErr } = await db.from("registry_release_shells")
      .select("id, slug, release_id, status, source_provenance")
      .eq("id", shellId)
      .maybeSingle();
    if (shellErr) return json(req, { error: "Failed to load existing shell: " + shellErr.message });
    if (!existingShell) return json(req, { error: "Existing shell not found in database." });

    const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key");
    const teamId = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id");
    const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");
    if (!privateKey || !teamId || !musicKeyId) return json(req, { error: "Apple Music credentials not configured." });

    let token: string;
    try { token = await createAppleMusicJWT(privateKey, teamId, musicKeyId); }
    catch (e) { return json(req, { error: "JWT failed: " + (e instanceof Error ? e.message : String(e)) }); }

    const apiUrl = `https://api.music.apple.com/v1/catalog/${storefront}/albums/${providerEntityId}?include=artists,tracks`;
    const res = await fetch(apiUrl, { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) { const errText = await res.text(); return json(req, { error: "Apple Music API " + res.status + ": " + errText.slice(0, 300) }); }

    const raw = await res.json() as { data: AppleSearchHit[] };
    const album = raw.data?.[0];
    if (!album) return json(req, { error: "Album not found on Apple Music" });

    const attrs = album.attributes || {};
    const albumTitle = attrs.name || "Untitled";
    const albumArtist = attrs.artistName || "Unknown Artist";
    const artworkUrl = artUrl(attrs.artwork, 600);
    const releaseDate = attrs.releaseDate || null;
    const genreNames = attrs.genreNames || [];
    const recordLabel = attrs.recordLabel || null;
    const upc = attrs.playParams?.id || null;
    const appleUrl = attrs.url || `https://music.apple.com/${storefront}/album/${providerEntityId}`;

    const tracks = (album.relationships?.tracks?.data || []).map(t => ({
      id: t.id,
      title: t.attributes?.name || "Untitled",
      artistName: t.attributes?.artistName || albumArtist,
      trackNumber: t.attributes?.trackNumber || null,
      durationMs: t.attributes?.durationInMillis || null,
      isrc: t.attributes?.isrc || null,
      artworkUrl: artUrl(t.attributes?.artwork, 300) || artworkUrl,
      previewUrl: t.attributes?.previews?.[0]?.url || null,
    }));

    const selectedTracks = selectedTrackIds.length > 0
      ? tracks.filter(t => selectedTrackIds.includes(t.id))
      : tracks;
    if (selectedTracks.length === 0 && tracks.length > 0) {
      selectedTracks.push(...tracks);
    }

    const artistSlugCandidate = slugify(albumArtist);
    let primaryArtistSlug = artistSlugCandidate;
    let primaryArtistName = albumArtist;
    const { data: registryArtist } = await db.from("registry_artists")
      .select("slug, display_name")
      .eq("slug", artistSlugCandidate)
      .eq("status", "active")
      .maybeSingle();
    if (registryArtist) {
      primaryArtistSlug = registryArtist.slug as string;
      primaryArtistName = registryArtist.display_name as string;
    }

    const existingSlug = existingShell.slug as string;
    const existingReleaseId = existingShell.release_id as string;

    const { error: delSugErr } = await db.from("registry_enrichment_suggestions")
      .delete()
      .eq("registry_entity_id", shellId);
    if (delSugErr) return json(req, { error: "Failed to clear old suggestions: " + delSugErr.message });

    const { error: delObsErr } = await db.from("provider_field_observations")
      .delete()
      .eq("provider_item_id", providerEntityId);
    if (delObsErr) return json(req, { error: "Failed to clear old observations: " + delObsErr.message });

    const { error: updateShellErr } = await db.from("registry_release_shells")
      .update({
        title: albumTitle,
        primary_artist_name: primaryArtistName,
        primary_artist_slug: primaryArtistSlug,
        release_date: releaseDate,
        track_count: selectedTracks.length,
        has_artwork: !!artworkUrl,
        status: "draft",
        readiness: "draft",
        source_provenance: {
          provider,
          provider_entity_id: providerEntityId,
          provider_url: appleUrl,
          artist_name: albumArtist,
          genre_names: genreNames,
          record_label: recordLabel,
          upc,
          artwork_url: artworkUrl,
          track_count: selectedTracks.length,
          refreshed_at: now,
          ingested_at: (existingShell.source_provenance as Record<string, unknown>)?.ingested_at || now,
        },
        last_generated_at: now,
        updated_at: now,
      })
      .eq("id", shellId);
    if (updateShellErr) return json(req, { error: "Failed to update shell: " + updateShellErr.message });

    const { data: existingRelease } = await db.from("registry_releases")
      .select("id, status")
      .eq("id", existingReleaseId)
      .maybeSingle();
    if (existingRelease && existingRelease.status === "draft") {
      const { error: relUpdErr } = await db.from("registry_releases").update({
        title: albumTitle,
        normalized_title: albumTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        release_date: releaseDate,
        artwork_url: artworkUrl,
        upc,
        updated_at: now,
      }).eq("id", existingReleaseId);
      if (relUpdErr) console.error("[refresh-shell] release update skipped:", relUpdErr.message);
    }

    const fieldObservations = [
      { field_name: "title", field_value: albumTitle },
      { field_name: "release_date", field_value: releaseDate },
      { field_name: "artwork_url", field_value: artworkUrl },
      { field_name: "artist_name", field_value: albumArtist },
      { field_name: "url", field_value: appleUrl },
    ];
    if (recordLabel) fieldObservations.push({ field_name: "record_label", field_value: recordLabel });
    if (upc) fieldObservations.push({ field_name: "upc", field_value: upc });
    if (genreNames.length > 0) fieldObservations.push({ field_name: "genre_names", field_value: genreNames.join(", ") });

    let obsCount = 0;
    for (const obs of fieldObservations) {
      const { error: obsErr } = await db.from("provider_field_observations").insert({
        id: crypto.randomUUID(),
        provider_item_id: providerEntityId,
        entity_type: "release",
        field_name: obs.field_name,
        field_value: String(obs.field_value ?? ""),
        provider,
        confidence_score: 0.95,
        source_path: appleUrl,
        raw_payload: obs,
        created_at: now,
      });
      if (!obsErr) obsCount++;
    }

    const enrichmentSuggestions = [
      { field_name: "title", suggested_value: albumTitle },
      { field_name: "release_date", suggested_value: releaseDate },
      { field_name: "artwork_url", suggested_value: artworkUrl },
    ];
    let sugCount = 0;
    for (const sug of enrichmentSuggestions) {
      if (!sug.suggested_value) continue;
      const { error: sugErr } = await db.from("registry_enrichment_suggestions").insert({
        id: crypto.randomUUID(),
        registry_entity_id: shellId,
        registry_entity_type: "release",
        field_name: sug.field_name,
        suggested_value: sug.suggested_value,
        current_value: null,
        provider_item_id: providerEntityId,
        confidence_score: 0.95,
        decision_status: "draft",
        created_at: now,
        updated_at: now,
      });
      if (!sugErr) sugCount++;
    }

    const { error: lifeErr } = await db.from("registry_release_shell_lifecycle_events").insert({
      id: crypto.randomUUID(),
      registry_entity_id: shellId,
      registry_entity_type: "release",
      status: "draft",
      actor: userId,
      reason: `Shell refreshed from ${provider} intake: ${albumTitle} (slug preserved: ${existingSlug})`,
      created_at: now,
    });
    if (lifeErr) return json(req, { error: "Failed to create lifecycle event: " + lifeErr.message });

    return json(req, {
      shell: { shellKey: shellId, registryEntityId: shellId, status: "draft" },
      writes: {
        providerFieldObservations: obsCount,
        registryEnrichmentSuggestions: sugCount,
        providerEntityLinks: 0,
        lifecycleEvents: 1,
      },
      mode: "refresh",
      slug: {
        pattern: "artistSlug--titleSlug",
        scoped: existingSlug,
        artistSlug: primaryArtistSlug,
        artistName: primaryArtistName,
      },
      release: {
        id: existingReleaseId,
        slug: existingSlug,
        createdNew: false,
      },
      skipped: selectedTrackIds.length > 0 && selectedTrackIds.length !== tracks.length
        ? tracks.filter(t => !selectedTrackIds.includes(t.id)).map(t => ({ entityType: "track", providerEntityId: t.id, reason: "Not selected" }))
        : [],
    });
  } catch (unexpectedErr) {
    const message = unexpectedErr instanceof Error ? unexpectedErr.message : String(unexpectedErr);
    return json(req, { error: "Unexpected refresh-shell error: " + message });
  }
}

// ── ATTACH SHELL ───────────────────────────────────────────────────
async function handleAttachShell(req: Request, db: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const targetRegistryEntityId = (body.targetRegistryEntityId as string) || "";
  if (!targetRegistryEntityId) return json(req, { error: "Missing targetRegistryEntityId" });
  return json(req, { error: "Attach to existing shell is not yet available. Use 'Create new shell' for now." });
}

// ── BACKFILL ───────────────────────────────────────────────────────
async function handleBackfill(req: Request, body: Record<string, unknown>) {
  return json(req, { error: "Backfill is not yet available." });
}

// ── MAIN ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json(req, { error: "Missing Authorization header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const uc = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: "Bearer " + token } } });
  const { data: { user }, error: ae } = await uc.auth.getUser(token);
  if (ae || !user) return json(req, { error: "Invalid or expired token" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const route = (body.route as string) || "";

  try {
    if (route === "search") return handleSearch(req, db, body);
    if (route === "inspect") return handleInspect(req, db, body);
    if (route === "test-connection") return handleTestConnection(req, db, body);
    if (route === "create-shell") return handleCreateShell(req, db, body, user.id);
    if (route === "refresh-shell") return handleRefreshShell(req, db, body, user.id);
    if (route === "attach-shell") return handleAttachShell(req, db, body);
    if (route === "backfill") return handleBackfill(req, body);
    return json(req, { error: "Unknown route: " + (route || "none") });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[provider-intake-api] error:", message);
    return json(req, { error: "Internal error", detail: message });
  }
});
