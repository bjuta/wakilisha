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

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesAreClose(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const wa = new Set(na.split(" ").filter(Boolean));
  const wb = new Set(nb.split(" ").filter(Boolean));
  if (!wa.size || !wb.size) return false;
  let overlap = 0;
  for (const word of wa) if (wb.has(word)) overlap++;
  return overlap / Math.max(wa.size, wb.size) >= 0.7;
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
  const envKey = key.toUpperCase();
  const envValue = Deno.env.get(envKey);
  if (envValue?.trim()) return envValue.trim();
  const { data, error } = await db
    .from("admin_settings_secrets")
    .select("setting_value")
    .eq("setting_key", key)
    .maybeSingle();
  if (error) throw new Error(`credential_lookup_failed:${key}`);
  const value = String(data?.setting_value ?? "").trim();
  return value || null;
}

interface ArtistRow {
  id: string;
  slug: string;
  display_name: string;
  normalized_name: string | null;
  metadata: Record<string, unknown>;
  status: string;
}

interface ProviderImage {
  url: string;
  width: number;
  height: number;
}

interface SpotifyObservation {
  provider: "spotify";
  id: string;
  name: string;
  image: ProviderImage | null;
  followers: number | null;
  popularity: number | null;
  genres: string[];
  sourceRef: string;
  sourcePayloadFingerprint: string;
}

interface AppleObservation {
  provider: "apple_music";
  id: string;
  name: string;
  image: ProviderImage | null;
  bio: string | null;
  genres: string[];
  sourceRef: string;
  sourcePayloadFingerprint: string;
}

interface MusicBrainzObservation {
  provider: "musicbrainz";
  id: string;
  name: string;
  artistType: "solo" | "group" | "band" | "collective" | "duo" | null;
  providerType: string | null;
  score: number;
  sourceRef: string;
  sourcePayloadFingerprint: string;
}

async function spotifyObservation(
  secretsDb: ReturnType<typeof createClient>,
  artist: ArtistRow,
): Promise<SpotifyObservation | null> {
  const clientId = await readSecret(secretsDb, "spotify_client_id");
  const clientSecret = await readSecret(secretsDb, "spotify_client_secret");
  if (!clientId || !clientSecret) return null;

  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenResponse.ok) return null;
  const tokenJson = await tokenResponse.json() as { access_token?: string };
  if (!tokenJson.access_token) return null;

  type SpotifyArtist = {
    id: string;
    name: string;
    images?: ProviderImage[];
    followers?: { total?: number };
    popularity?: number;
    genres?: string[];
    external_urls?: { spotify?: string };
  };

  const headers = { Authorization: `Bearer ${tokenJson.access_token}` };
  let candidate: SpotifyArtist | null = null;
  const knownId = String(artist.metadata?.spotify_id ?? "").trim();

  if (knownId) {
    const response = await fetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(knownId)}`, { headers });
    if (response.ok) candidate = await response.json() as SpotifyArtist;
  }

  if (!candidate) {
    const queries = [artist.display_name, artist.normalized_name ?? ""]
      .map((value) => value.trim())
      .filter((value, index, all) => value && all.indexOf(value) === index);
    for (const query of queries) {
      const url = new URL("https://api.spotify.com/v1/search");
      url.searchParams.set("q", `\"${query}\"`);
      url.searchParams.set("type", "artist");
      url.searchParams.set("limit", "10");
      const response = await fetch(url, { headers });
      if (!response.ok) continue;
      const body = await response.json() as { artists?: { items?: SpotifyArtist[] } };
      candidate = (body.artists?.items ?? []).find((item) =>
        namesAreClose(item.name, artist.display_name) ||
        namesAreClose(item.name, artist.normalized_name ?? artist.display_name)
      ) ?? null;
      if (candidate) break;
    }
  }

  if (!candidate) return null;
  const image = [...(candidate.images ?? [])]
    .sort((a, b) => (b.width || 0) - (a.width || 0))[0] ?? null;
  const normalized = {
    id: candidate.id,
    name: candidate.name,
    image,
    followers: candidate.followers?.total ?? null,
    popularity: candidate.popularity ?? null,
    genres: [...new Set(candidate.genres ?? [])].sort(),
  };
  return {
    provider: "spotify",
    ...normalized,
    sourceRef: candidate.external_urls?.spotify || `https://open.spotify.com/artist/${candidate.id}`,
    sourcePayloadFingerprint: await sha256Hex(normalized),
  };
}

async function createAppleMusicJwt(
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
  const header = base64Url(btoa(JSON.stringify({ alg: "ES256", kid: keyId })));
  const payload = base64Url(btoa(JSON.stringify({ iss: teamId, iat: now, exp: now + 3600 })));
  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(input),
  );
  const encoded = base64Url(btoa(String.fromCharCode(...new Uint8Array(signature))));
  return `${input}.${encoded}`;
}

async function appleObservation(
  secretsDb: ReturnType<typeof createClient>,
  artist: ArtistRow,
): Promise<AppleObservation | null> {
  const privateKey = await readSecret(secretsDb, "apple_music_private_key");
  const teamId = await readSecret(secretsDb, "apple_music_team_id");
  const keyId = await readSecret(secretsDb, "apple_music_key_id");
  if (!privateKey || !teamId || !keyId) return null;
  const storefront = (await readSecret(secretsDb, "apple_music_storefront")) || "ke";
  const token = await createAppleMusicJwt(privateKey, teamId, keyId);

  type AppleRaw = {
    id: string;
    attributes?: {
      name?: string;
      url?: string;
      artwork?: { url?: string; width?: number; height?: number };
      genreNames?: string[];
      editorialNotes?: { standard?: string; short?: string };
    };
  };

  const parse = (item: AppleRaw): AppleObservation | null => {
    const attrs = item.attributes ?? {};
    const name = String(attrs.name ?? "").trim();
    if (!name || !namesAreClose(name, artist.display_name)) return null;
    const artwork = attrs.artwork?.url
      ? {
          url: attrs.artwork.url
            .replace("{w}", String(attrs.artwork.width ?? 1200))
            .replace("{h}", String(attrs.artwork.height ?? 1200))
            .replace("{f}", "jpg"),
          width: attrs.artwork.width ?? 1200,
          height: attrs.artwork.height ?? 1200,
        }
      : null;
    const normalized = {
      id: item.id,
      name,
      image: artwork,
      bio: attrs.editorialNotes?.standard || attrs.editorialNotes?.short || null,
      genres: [...new Set(attrs.genreNames ?? [])].sort(),
    };
    return {
      provider: "apple_music",
      ...normalized,
      sourceRef: attrs.url || `https://music.apple.com/${storefront}/artist/${item.id}`,
      sourcePayloadFingerprint: "",
    };
  };

  let observation: AppleObservation | null = null;
  const knownId = String(artist.metadata?.apple_music_id ?? "").trim();
  if (knownId) {
    const response = await fetch(
      `https://api.music.apple.com/v1/catalog/${storefront}/artists/${encodeURIComponent(knownId)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
    );
    if (response.ok) {
      const body = await response.json() as { data?: AppleRaw[] };
      if (body.data?.[0]) observation = parse(body.data[0]);
    }
  }

  if (!observation) {
    const url = new URL(`https://api.music.apple.com/v1/catalog/${storefront}/search`);
    url.searchParams.set("term", artist.display_name);
    url.searchParams.set("types", "artists");
    url.searchParams.set("limit", "10");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (response.ok) {
      const body = await response.json() as { results?: { artists?: { data?: AppleRaw[] } } };
      for (const item of body.results?.artists?.data ?? []) {
        observation = parse(item);
        if (observation) break;
      }
    }
  }

  if (!observation) return null;
  const fingerprintPayload = {
    id: observation.id,
    name: observation.name,
    image: observation.image,
    bio: observation.bio,
    genres: observation.genres,
  };
  observation.sourcePayloadFingerprint = await sha256Hex(fingerprintPayload);
  return observation;
}

async function musicBrainzObservation(artist: ArtistRow): Promise<MusicBrainzObservation | null> {
  type MbArtist = { id: string; name: string; type?: string; score?: number };
  const mapType: Record<string, MusicBrainzObservation["artistType"]> = {
    Person: "solo",
    Group: "group",
    Orchestra: "band",
    Choir: "group",
    Character: "solo",
  };

  const queries = [artist.display_name, artist.normalized_name ?? ""]
    .map((value) => value.trim())
    .filter((value, index, all) => value && all.indexOf(value) === index);
  for (const query of queries) {
    const url = new URL("https://musicbrainz.org/ws/2/artist/");
    url.searchParams.set("query", `artist:\"${query}\"`);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", "5");
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Wakilisha/1.0 (admin@wakilisha.africa)",
        Accept: "application/json",
      },
    });
    if (!response.ok) continue;
    const body = await response.json() as { artists?: MbArtist[] };
    const match = (body.artists ?? []).find((item) =>
      namesAreClose(item.name, artist.display_name) ||
      namesAreClose(item.name, artist.normalized_name ?? artist.display_name)
    );
    if (!match) continue;
    const normalized = {
      id: match.id,
      name: match.name,
      artistType: match.type ? (mapType[match.type] ?? null) : null,
      providerType: match.type ?? null,
      score: Math.max(0, Math.min(100, Number(match.score ?? 0))),
    };
    return {
      provider: "musicbrainz",
      ...normalized,
      sourceRef: `https://musicbrainz.org/artist/${match.id}`,
      sourcePayloadFingerprint: await sha256Hex(normalized),
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(req, { error: "unauthorized" }, 401);
  const token = authorization.slice("Bearer ".length);
  const callerDb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await callerDb.auth.getUser(token);
  if (userError || !user) return json(req, { error: "unauthorized" }, 401);
  const { data: canManage, error: capabilityError } = await callerDb.rpc(
    "current_user_has_capability",
    { required_capability: "manage_registry" },
  );
  if (capabilityError || canManage !== true) return json(req, { error: "forbidden" }, 403);

  let body: { artist_id?: string; providers?: string[]; include_musicbrainz?: boolean };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_json" }, 400);
  }

  const artistId = String(body.artist_id ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(artistId)) {
    return json(req, { error: "artist_id_required" }, 400);
  }

  const { data: artistData, error: artistError } = await callerDb
    .from("registry_artists")
    .select("id,slug,display_name,normalized_name,metadata,status")
    .eq("id", artistId)
    .maybeSingle();
  if (artistError) return json(req, { error: "artist_read_failed", detail: artistError.message }, 500);
  if (!artistData || !["active", "draft"].includes(String(artistData.status))) {
    return json(req, { error: "artist_not_eligible" }, 404);
  }

  const artist = artistData as ArtistRow;
  const providers = Array.isArray(body.providers)
    ? body.providers.filter((provider) => ["spotify", "apple_music"].includes(provider))
    : ["spotify", "apple_music"];
  const secretsDb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const observedAt = new Date().toISOString();

  try {
    const [spotify, appleMusic, musicBrainz] = await Promise.all([
      providers.includes("spotify") ? spotifyObservation(secretsDb, artist) : Promise.resolve(null),
      providers.includes("apple_music") ? appleObservation(secretsDb, artist) : Promise.resolve(null),
      body.include_musicbrainz === false ? Promise.resolve(null) : musicBrainzObservation(artist),
    ]);

    return json(req, {
      ok: true,
      observedAt,
      artist: {
        id: artist.id,
        slug: artist.slug,
        displayName: artist.display_name,
        normalizedName: artist.normalized_name,
      },
      spotify,
      appleMusic,
      musicBrainz,
    });
  } catch (error) {
    console.error("[registry-artist-provider-fetch]", error instanceof Error ? error.message : String(error));
    return json(req, { error: "provider_fetch_internal_error" }, 500);
  }
});
