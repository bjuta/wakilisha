import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

function corsRestricted(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
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
    headers: {
      ...corsRestricted(req),
      "Content-Type": "application/json",
    },
  });
}

async function authorize(req: Request): Promise<boolean> {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const token = authorization.replace("Bearer ", "");
  const callerDb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await callerDb.auth.getUser(token);

  if (userError || !user) return false;

  const { data, error } = await callerDb.rpc(
    "current_user_has_capability",
    { required_capability: "manage_ingest" },
  );

  return !error && data === true;
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

  if (error) {
    throw new Error(`Provider credential lookup failed for ${key}.`);
  }

  const value = String(data?.setting_value || "").trim();
  return value || null;
}

function sanitizeDate(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().split("T")[0];
}

interface ProviderTrack {
  title: string;
  artist: string;
  release_date: string | null;
  isrc: string | null;
  source_position: number;
  provider_track_id: string | null;
  provider_release_id: string | null;
  provider_artist_ids: string[];
  artwork_url: string | null;
  external_url: string | null;
  preview_url: string | null;
  raw_payload: unknown;
}

interface ProviderFetchResult {
  tracks: ProviderTrack[];
  warnings: string[];
  error: string | null;
}

async function fetchSpotify(
  db: ReturnType<typeof createClient>,
  sourceUrl: string,
  market: string,
  maxRows: number,
): Promise<ProviderFetchResult> {
  const clientId = await readSecret(db, "spotify_client_id");
  const clientSecret = await readSecret(db, "spotify_client_secret");
  const configuredMarket = await readSecret(db, "spotify_market");

  if (!clientId || !clientSecret) {
    return {
      tracks: [],
      warnings: [],
      error: "Spotify credentials not configured.",
    };
  }

  const tokenResponse = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
      },
      body: "grant_type=client_credentials",
    },
  );

  if (!tokenResponse.ok) {
    return {
      tracks: [],
      warnings: [],
      error: `Spotify authorization failed (${tokenResponse.status}).`,
    };
  }

  const tokenData = await tokenResponse.json() as {
    access_token?: string;
  };
  if (!tokenData.access_token) {
    return {
      tracks: [],
      warnings: [],
      error: "Spotify authorization returned no access token.",
    };
  }

  const playlistMatch = sourceUrl.match(
    /spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
  );
  if (!playlistMatch) {
    return {
      tracks: [],
      warnings: [],
      error: "Cannot extract Spotify playlist ID from source URL.",
    };
  }

  const playlistId = playlistMatch[1];
  const spotifyMarket = configuredMarket || market;
  const warnings: string[] = [];
  const items: Array<{ track: {
    id: string;
    name: string;
    artists: Array<{ id: string; name: string }>;
    album: {
      id: string;
      images: Array<{ url: string }>;
      release_date: string;
    };
    external_ids: { isrc?: string };
    external_urls: { spotify: string };
    preview_url: string | null;
    duration_ms: number;
    popularity: number;
  } | null }> = [];

  let offset = 0;
  let total = 0;
  while (items.length < maxRows) {
    const limit = Math.min(100, maxRows - items.length);
    const url = new URL(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    );
    url.searchParams.set("market", spotifyMarket);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set(
      "fields",
      "items(track(id,name,artists(id,name),album(id,images,release_date),external_ids(isrc),external_urls(spotify),preview_url,duration_ms,popularity)),next,total",
    );

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!response.ok) {
      return {
        tracks: [],
        warnings,
        error: `Spotify API failed (${response.status}).`,
      };
    }

    const page = await response.json() as {
      items: typeof items;
      next: string | null;
      total: number;
    };
    total = page.total ?? total;
    const pageItems = page.items ?? [];
    if (pageItems.length === 0) break;
    items.push(...pageItems);
    offset += pageItems.length;
    if (!page.next) break;
  }

  if (total > items.length) {
    warnings.push(
      `Spotify playlist has ${total} tracks; fetched ${items.length} using maxRows ${maxRows}.`,
    );
  }

  const tracks: ProviderTrack[] = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!item?.track) {
      warnings.push(`Spotify item ${index + 1}: null track`);
      continue;
    }
    const track = item.track;
    tracks.push({
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(", "),
      release_date: sanitizeDate(track.album?.release_date),
      isrc: track.external_ids?.isrc || null,
      source_position: index + 1,
      provider_track_id: track.id,
      provider_release_id: track.album?.id || null,
      provider_artist_ids: track.artists.map((artist) => artist.id),
      artwork_url: track.album?.images?.[0]?.url || null,
      external_url: track.external_urls?.spotify || sourceUrl,
      preview_url: track.preview_url || null,
      raw_payload: {
        provider: "spotify",
        trackId: track.id,
        albumId: track.album?.id,
        artistIds: track.artists.map((artist) => artist.id),
        durationMs: track.duration_ms,
        popularity: track.popularity,
      },
    });
  }

  return { tracks, warnings, error: null };
}

async function createAppleMusicJWT(
  privateKey: string,
  teamId: string,
  keyId: string,
): Promise<string> {
  const pem = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const base64Url = (value: string) =>
    value.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedHeader = base64Url(
    btoa(JSON.stringify({ alg: "ES256", kid: keyId })),
  );
  const encodedPayload = base64Url(
    btoa(JSON.stringify({ iss: teamId, iat: now, exp: now + 3600 })),
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  const encodedSignature = base64Url(
    btoa(String.fromCharCode(...new Uint8Array(signature))),
  );
  return `${signingInput}.${encodedSignature}`;
}

async function fetchAppleMusic(
  db: ReturnType<typeof createClient>,
  sourceUrl: string,
  market: string,
  maxRows: number,
): Promise<ProviderFetchResult> {
  const privateKey = await readSecret(db, "apple_music_private_key");
  const teamId = await readSecret(db, "apple_music_team_id");
  const keyId = await readSecret(db, "apple_music_key_id");
  const configuredStorefront = await readSecret(
    db,
    "apple_music_storefront",
  );

  if (!privateKey || !teamId || !keyId) {
    return {
      tracks: [],
      warnings: [],
      error: "Apple Music credentials not configured.",
    };
  }

  let developerToken: string;
  try {
    developerToken = await createAppleMusicJWT(privateKey, teamId, keyId);
  } catch {
    return {
      tracks: [],
      warnings: [],
      error: "Apple Music developer-token signing failed.",
    };
  }

  const parsed = sourceUrl.match(
    /music\.apple\.com\/([a-z]{2})\/(playlist|album)\/[^/]+\/(pl\.|[a-z]+\.)?([a-zA-Z0-9]+)/i,
  );
  let storefront = (
    configuredStorefront || market.slice(0, 2) || "ke"
  ).toLowerCase();
  let resourceType = "playlists";
  let resourceId = "";

  if (parsed) {
    storefront = parsed[1].toLowerCase();
    resourceType = parsed[2] === "album" ? "albums" : "playlists";
    resourceId = (parsed[3] || "") + parsed[4];
  } else {
    const idMatch = sourceUrl.match(/(pl\.|al\.)([a-zA-Z0-9]+)/i);
    if (!idMatch) {
      return {
        tracks: [],
        warnings: [],
        error: "Cannot parse Apple Music source URL.",
      };
    }
    resourceId = idMatch[1] + idMatch[2];
  }

  const response = await fetch(
    `https://api.music.apple.com/v1/catalog/${storefront}/${resourceType}/${resourceId}/tracks`,
    { headers: { Authorization: `Bearer ${developerToken}` } },
  );
  if (!response.ok) {
    return {
      tracks: [],
      warnings: [],
      error: `Apple Music API failed (${response.status}).`,
    };
  }

  const data = await response.json() as {
    data: Array<{
      id: string;
      attributes: {
        name: string;
        artistName: string;
        artwork: { url: string };
        url: string;
        previews?: Array<{ url: string }>;
        releaseDate?: string;
        isrc?: string;
        genreNames: string[];
      };
      relationships?: {
        artists: { data: Array<{ id: string }> };
        albums: { data: Array<{ id: string }> };
      };
    }>;
  };

  const tracks: ProviderTrack[] = [];
  const warnings: string[] = [];
  for (const [index, song] of (data.data || []).slice(0, maxRows).entries()) {
    const attrs = song.attributes;
    if (!attrs) {
      warnings.push(`Apple Music song ${index + 1}: missing attributes`);
      continue;
    }
    tracks.push({
      title: attrs.name,
      artist: attrs.artistName,
      release_date: sanitizeDate(attrs.releaseDate),
      isrc: attrs.isrc || null,
      source_position: index + 1,
      provider_track_id: song.id,
      provider_release_id:
        song.relationships?.albums?.data?.[0]?.id || null,
      provider_artist_ids:
        song.relationships?.artists?.data?.map((artist) => artist.id) || [],
      artwork_url: attrs.artwork?.url
        ? attrs.artwork.url.replace("{w}", "300").replace("{h}", "300")
        : null,
      external_url: attrs.url || sourceUrl,
      preview_url: attrs.previews?.[0]?.url || null,
      raw_payload: {
        provider: "apple_music",
        songId: song.id,
        albumId: song.relationships?.albums?.data?.[0]?.id,
        genres: attrs.genreNames,
        isrc: attrs.isrc,
      },
    });
  }

  return { tracks, warnings, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsRestricted(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "method_not_allowed" }, 405);
  }
  if (!(await authorize(req))) {
    return json(req, { error: "forbidden" }, 403);
  }

  let body: {
    provider?: string;
    sourceUrl?: string;
    market?: string;
    maxRows?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_json" }, 400);
  }

  const provider = String(body.provider || "");
  const sourceUrl = String(body.sourceUrl || "");
  const market = String(body.market || "KE");
  const maxRows = Math.min(500, Math.max(1, Number(body.maxRows || 100)));
  if (!sourceUrl) {
    return json(req, { error: "source_url_required" }, 400);
  }

  const secretDb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    if (provider === "spotify") {
      return json(
        req,
        await fetchSpotify(secretDb, sourceUrl, market, maxRows),
      );
    }
    if (provider === "apple_music") {
      return json(
        req,
        await fetchAppleMusic(secretDb, sourceUrl, market, maxRows),
      );
    }
    return json(req, {
      tracks: [],
      warnings: [`Unknown provider: ${provider}`],
      error: `Unknown provider '${provider}'.`,
    }, 400);
  } catch (error) {
    console.error(
      "[chart-provider-fetch]",
      error instanceof Error ? error.message : String(error),
    );
    return json(req, {
      tracks: [],
      warnings: [],
      error: "provider_fetch_internal_error",
    }, 500);
  }
});
