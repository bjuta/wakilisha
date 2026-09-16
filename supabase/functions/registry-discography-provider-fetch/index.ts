import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SignJWT } from "npm:jose@5.9.6";
import { albumArtistCreditIncludesArtist } from "../ingest-artist-discography/releaseArtistCredit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

const MAX_ALBUMS = 25;
const ALBUM_FETCH_CONCURRENCY = 4;

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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function artworkUrl(template: string, width: number): string {
  return template.replace("{w}", String(width)).replace("{h}", String(width));
}

function parseDate(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "0000-00-00") return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
}

function parseReleaseType(attributes: Record<string, unknown>): "album" | "ep" | "single" {
  const isSingle = attributes.isSingle === true;
  const isComplete = attributes.isComplete === true;
  const trackCount = Number(attributes.trackCount ?? 0);
  const name = String(attributes.name ?? "").toLowerCase();
  if (name.includes("ep") || (trackCount >= 2 && trackCount <= 8 && !isComplete)) return "ep";
  if (isSingle || trackCount === 1) return "single";
  return "album";
}

async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readSecret(
  db: ReturnType<typeof createClient>,
  key: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("admin_settings_secrets")
    .select("setting_value")
    .eq("setting_key", key)
    .maybeSingle();
  if (error) throw new Error(`Provider credential lookup failed for ${key}.`);
  const value = String(data?.setting_value ?? "").trim();
  if (value) return value;
  return Deno.env.get(key.toUpperCase())?.trim() || null;
}

async function createAppleMusicToken(teamId: string, keyId: string, privateKeyRaw: string): Promise<string> {
  let key = privateKeyRaw
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/[\s\n\r\t]/g, "");
  const binaryKey = base64ToBytes(key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(cryptoKey);
}

type AppleTrack = {
  id: string;
  attributes?: {
    name?: string;
    artistName?: string;
    durationInMillis?: number;
    trackNumber?: number;
    discNumber?: number;
    isrc?: string;
    artwork?: { url?: string };
    contentRating?: string;
    previews?: Array<{ url?: string }>;
    genreNames?: string[];
  };
};

type AppleAlbum = {
  id: string;
  attributes?: {
    name?: string;
    artistName?: string;
    artwork?: { url?: string };
    releaseDate?: string;
    trackCount?: number;
    isSingle?: boolean;
    isComplete?: boolean;
    upc?: string;
    genreNames?: string[];
    url?: string;
    recordLabel?: string;
  };
  relationships?: {
    tracks?: { data?: AppleTrack[] };
    artists?: { data?: Array<{ id: string; attributes?: { name?: string; url?: string } }> };
  };
};

async function searchAlbumIds(
  token: string,
  storefront: string,
  artistName: string,
  limit: number,
): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  while (ids.length < limit) {
    const pageLimit = Math.min(25, limit - ids.length);
    const url = new URL(`https://api.music.apple.com/v1/catalog/${storefront}/search`);
    url.searchParams.set("term", artistName);
    url.searchParams.set("types", "albums");
    url.searchParams.set("limit", String(pageLimit));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Apple Music search failed (${response.status}).`);
    const payload = await response.json() as { results?: { albums?: { data?: Array<{ id: string; attributes?: { artistName?: string } }> } } };
    const rows = payload.results?.albums?.data ?? [];
    if (!rows.length) break;
    for (const row of rows) {
      if (albumArtistCreditIncludesArtist(String(row.attributes?.artistName ?? ""), artistName)) ids.push(row.id);
      if (ids.length >= limit) break;
    }
    offset += rows.length;
    if (rows.length < pageLimit) break;
  }
  return [...new Set(ids)];
}

async function fetchAlbum(token: string, storefront: string, albumId: string): Promise<AppleAlbum | null> {
  const url = `https://api.music.apple.com/v1/catalog/${storefront}/albums/${encodeURIComponent(albumId)}?include=tracks,artists`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const payload = await response.json() as { data?: AppleAlbum[] };
  return payload.data?.[0] ?? null;
}

async function fetchAlbums(
  token: string,
  storefront: string,
  ids: string[],
): Promise<{ albums: AppleAlbum[]; failed: string[] }> {
  const queue = [...ids];
  const albums: AppleAlbum[] = [];
  const failed: string[] = [];
  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      if (!id) break;
      try {
        const album = await fetchAlbum(token, storefront, id);
        if (album) albums.push(album);
        else failed.push(id);
      } catch {
        failed.push(id);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(ALBUM_FETCH_CONCURRENCY, Math.max(queue.length, 1)) }, () => worker()));
  return { albums, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(req, { ok: false, error: "unauthorized" }, 401);
  const token = authorization.slice("Bearer ".length);
  const callerDb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await callerDb.auth.getUser(token);
  if (userError || !user) return json(req, { ok: false, error: "unauthorized" }, 401);
  const { data: canManage, error: capabilityError } = await callerDb.rpc(
    "current_user_has_capability",
    { required_capability: "manage_registry" },
  );
  if (capabilityError || canManage !== true) return json(req, { ok: false, error: "forbidden" }, 403);

  let body: { artist_id?: string; album_ids?: string[]; limit?: number };
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: "invalid_json" }, 400);
  }

  const artistId = String(body.artist_id ?? "").trim();
  if (!isUuid(artistId)) return json(req, { ok: false, error: "invalid_artist_id" }, 400);

  const { data: artist, error: artistError } = await callerDb
    .from("registry_artists")
    .select("id,slug,display_name,status")
    .eq("id", artistId)
    .maybeSingle();
  if (artistError) return json(req, { ok: false, error: "artist_read_failed", detail: artistError.message }, 500);
  if (!artist || !["active", "draft"].includes(String(artist.status))) {
    return json(req, { ok: false, error: "artist_not_found" }, 404);
  }

  const credentialDb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const [teamId, keyId, privateKey, configuredStorefront] = await Promise.all([
    readSecret(credentialDb, "apple_music_team_id"),
    readSecret(credentialDb, "apple_music_key_id"),
    readSecret(credentialDb, "apple_music_private_key"),
    readSecret(credentialDb, "apple_music_storefront"),
  ]);
  if (!teamId || !keyId || !privateKey) {
    return json(req, { ok: false, error: "apple_music_credentials_missing" }, 503);
  }

  const storefront = configuredStorefront || "ke";
  let providerToken: string;
  try {
    providerToken = await createAppleMusicToken(teamId, keyId, privateKey);
  } catch (error) {
    return json(req, { ok: false, error: "apple_music_token_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }

  const requestedIds = Array.isArray(body.album_ids)
    ? [...new Set(body.album_ids.map(String).map((value) => value.trim()).filter(Boolean))].slice(0, MAX_ALBUMS)
    : [];
  const limit = Math.min(Math.max(Number(body.limit) || MAX_ALBUMS, 1), MAX_ALBUMS);

  let albumIds = requestedIds;
  if (!albumIds.length) {
    try {
      albumIds = await searchAlbumIds(providerToken, storefront, String(artist.display_name), limit);
    } catch (error) {
      return json(req, { ok: false, error: "apple_music_search_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
    }
  }

  const fetched = await fetchAlbums(providerToken, storefront, albumIds);
  const acquiredAt = new Date().toISOString();
  const albums = fetched.albums.map((album) => {
    const attributes = album.attributes ?? {};
    const tracks = album.relationships?.tracks?.data ?? [];
    const relatedArtists = album.relationships?.artists?.data ?? [];
    return {
      apple_music_id: album.id,
      title: String(attributes.name ?? "").trim(),
      album_artist_name: String(attributes.artistName ?? "").trim(),
      release_type: parseReleaseType(attributes as Record<string, unknown>),
      release_date: parseDate(attributes.releaseDate),
      upc: String(attributes.upc ?? "").trim() || null,
      record_label: String(attributes.recordLabel ?? "").trim() || null,
      genre_names: (attributes.genreNames ?? []).map(String).map((value) => value.trim()).filter(Boolean),
      artwork_url: attributes.artwork?.url ? artworkUrl(attributes.artwork.url, 800) : null,
      apple_music_url: String(attributes.url ?? "").trim() || null,
      related_artists: relatedArtists.map((row) => ({
        apple_music_artist_id: row.id,
        name: String(row.attributes?.name ?? "").trim(),
        url: String(row.attributes?.url ?? "").trim() || null,
      })).filter((row) => row.name),
      tracks: tracks.map((track) => {
        const trackAttributes = track.attributes ?? {};
        return {
          apple_music_id: track.id,
          title: String(trackAttributes.name ?? "").trim(),
          artist_name: String(trackAttributes.artistName ?? "").trim(),
          duration_ms: Number.isFinite(Number(trackAttributes.durationInMillis)) ? Number(trackAttributes.durationInMillis) : null,
          track_number: Number.isFinite(Number(trackAttributes.trackNumber)) ? Number(trackAttributes.trackNumber) : null,
          disc_number: Number.isFinite(Number(trackAttributes.discNumber)) ? Number(trackAttributes.discNumber) : null,
          isrc: String(trackAttributes.isrc ?? "").trim().toUpperCase() || null,
          artwork_url: trackAttributes.artwork?.url ? artworkUrl(trackAttributes.artwork.url, 800) : null,
          explicit: String(trackAttributes.contentRating ?? "") === "explicit",
          preview_url: String(trackAttributes.previews?.[0]?.url ?? "").trim() || null,
          genre_names: (trackAttributes.genreNames ?? []).map(String).map((value) => value.trim()).filter(Boolean),
        };
      }).filter((track) => track.title),
    };
  }).filter((album) => album.title);

  const observation = {
    provider: "apple_music",
    storefront,
    acquired_at: acquiredAt,
    artist: {
      id: String(artist.id),
      slug: String(artist.slug),
      display_name: String(artist.display_name),
    },
    albums,
    failed_album_ids: fetched.failed.sort(),
  };
  const sourcePayloadFingerprint = await sha256Hex(observation);

  return json(req, {
    ok: true,
    observation,
    source_payload_fingerprint: sourcePayloadFingerprint,
  });
});
