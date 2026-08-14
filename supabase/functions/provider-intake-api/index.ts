import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = ["https://wakilisha.africa","https://www.wakilisha.africa","https://staging.wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","http://localhost:5173","http://localhost:3000"];
function corsR(req: Request, methods="GET, POST, OPTIONS"): Record<string,string> { const o=req.headers.get("Origin")??""; const isR=o.endsWith(".wakilisha.africa")||o==="https://wakilisha.africa"; const ao=ALLOWED_ORIGINS.includes(o)||isR?o:ALLOWED_ORIGINS[0]; return {"Access-Control-Allow-Origin":ao,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":methods,"Vary":"Origin"}; }
async function vJwt(req: Request): Promise<{id:string;email?:string}|null> { const ah=req.headers.get("Authorization"); if(!ah||!ah.startsWith("Bearer ")) return null; const t=ah.replace("Bearer ",""); const uc=createClient(SUPABASE_URL,SERVICE_KEY,{global:{headers:{Authorization:`Bearer ${t}`}}}); const {data:{user},error}=await uc.auth.getUser(t); if(error||!user) return null; return {id:user.id,email:user.email}; }
async function rCap(userId: string, cap: string): Promise<boolean> { const c=createClient(SUPABASE_URL,SERVICE_KEY); const {data:roles}=await c.from("user_role_assignments").select("role_key, role_definitions!inner(role_capabilities(capability_key))").eq("user_id",userId).eq("status","active").or("expires_at.is.null,expires_at.gt.now()"); if(!roles||roles.length===0) return false; if(roles.some((r:{role_key:string})=>r.role_key==="administrator")) return true; const all=new Set<string>(); for(const r of roles){const caps=(r.role_definitions as {role_capabilities?:Array<{capability_key:string}>}|null)?.role_capabilities??[];for(const c of caps)all.add(c.capability_key);} return all.has(cap); }
function jRaw(data:unknown,cors:Record<string,string>,s=200):Response{return new Response(JSON.stringify(data),{status:s,headers:{...cors,"Content-Type":"application/json"}});}
async function rCred(envVar:string,dbKey:string,db?:ReturnType<typeof createClient>):Promise<string|null>{const ev=Deno.env.get(envVar);if(ev&&ev.trim())return ev.trim();if(!db)return null;try{const{data:row}=await db.from("admin_settings_secrets").select("setting_value").eq("setting_key",dbKey).maybeSingle();if(row&&(row.setting_value as string)?.trim())return(row.setting_value as string).trim();}catch{return null;}return null;}
function slugify(s:string):string{return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,160);}
async function cAJWT(pk:string,tid:string,kid:string):Promise<string>{const pem=pk.replace("-----BEGIN PRIVATE KEY-----","").replace("-----END PRIVATE KEY-----","").replace(/\s/g,"");const bin=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey("pkcs8",bin,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);const h={alg:"ES256",kid};const ns=Math.floor(Date.now()/1000);const pl={iss:tid,iat:ns,exp:ns+3600};const enc=new TextEncoder();const b64u=(s:string)=>s.replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");const hb=b64u(btoa(JSON.stringify(h))),pb=b64u(btoa(JSON.stringify(pl))),si=hb+"."+pb;const sig=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,enc.encode(si));const sb=b64u(btoa(String.fromCharCode(...new Uint8Array(sig))));return si+"."+sb;}
interface AArt { url: string; }
interface ASHit { id: string; type: string; attributes?: { name?: string; artistName?: string; artwork?: AArt; releaseDate?: string; genreNames?: string[]; recordLabel?: string; isrc?: string; trackNumber?: number; durationInMillis?: number; playParams?: { id?: string }; previews?: Array<{ url: string }>; trackCount?: number; }; relationships?: { tracks?: { data: Array<{ id: string; attributes?: Record<string,unknown> }> }; }; }
function aUrl(aw: AArt|undefined|null, w: number): string|null { if(!aw?.url) return null; return aw.url.replace("{w}",String(w)).replace("{h}",String(w)); }
const TS = ["canonicalized","rejected"];

async function getSpotifyAccessToken(
  db: ReturnType<typeof createClient>,
): Promise<{ token: string; market: string } | { error: string }> {
  const clientId = await rCred(
    "SPOTIFY_CLIENT_ID",
    "spotify_client_id",
    db,
  );
  const clientSecret = await rCred(
    "SPOTIFY_CLIENT_SECRET",
    "spotify_client_secret",
    db,
  );
  const market =
    (
      await rCred(
        "SPOTIFY_MARKET",
        "spotify_market",
        db,
      )
    ) || "KE";

  if (!clientId || !clientSecret) {
    return { error: "Spotify credentials not configured." };
  }

  const encoded = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
  );

  const payload = await response.json().catch(() => ({})) as {
    access_token?: string;
  };

  if (!response.ok || !payload.access_token) {
    return {
      error: `Spotify token request failed (${response.status}).`,
    };
  }

  return {
    token: payload.access_token,
    market: String(market).toUpperCase(),
  };
}

function spotifyArtwork(
  images: Array<{ url?: string; width?: number; height?: number }> | undefined,
): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  return (
    [...images]
      .sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0))
      .map((image) => String(image.url ?? "").trim())
      .find(Boolean) ?? null
  );
}

async function recordArtistSubmissionValidation(
  db: ReturnType<typeof createClient>,
  requestedBy: string,
  artistId: string,
  result: Record<string, any>,
): Promise<string> {
  const enrichment =
    result.enrichment &&
    typeof result.enrichment === "object" &&
    !Array.isArray(result.enrichment)
      ? result.enrichment as Record<string, unknown>
      : {};

  const provider =
    String(result.provider ?? "").trim().toLowerCase();
  const providerEntityId =
    String(result.providerEntityId ?? "").trim();
  const providerUrl =
    String(result.providerUrl ?? enrichment.provider_url ?? "").trim();
  const title =
    String(result.title ?? enrichment.title ?? "").trim();
  const artistNames =
    Array.isArray(enrichment.artist_names)
      ? enrichment.artist_names
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      : [];
  const releaseTitle =
    String(enrichment.release_title ?? "").trim() || null;

  if (
    !["apple_music", "spotify"].includes(provider) ||
    !providerEntityId ||
    !providerUrl ||
    !title
  ) {
    throw new Error(
      "Provider inspection did not return complete Artist submission evidence.",
    );
  }

  const { data, error } = await db.rpc(
    "record_artist_music_submission_validation",
    {
      p_requested_by: requestedBy,
      p_artist_id: artistId,
      p_provider_key: provider,
      p_provider_object_id: providerEntityId,
      p_provider_url: providerUrl,
      p_provider_title: title,
      p_provider_artist_names: artistNames,
      p_provider_release_title: releaseTitle,
      p_playback_kind: "audio",
      p_validation_snapshot: {
        enrichment,
        source:
          result.source &&
          typeof result.source === "object"
            ? result.source
            : {},
      },
      p_expires_at:
        new Date(
          Date.now() + 30 * 60 * 1000,
        ).toISOString(),
    },
  );

  if (error || !data) {
    throw new Error(
      error?.message ||
      "Artist submission validation could not be recorded.",
    );
  }

  return String(data);
}

async function getAC(db:ReturnType<typeof createClient>):Promise<{token:string}|{error:string}>{
  const pk=await rCred("APPLE_MUSIC_PRIVATE_KEY","apple_music_private_key",db);
  const tid=await rCred("APPLE_MUSIC_TEAM_ID","apple_music_team_id",db);
  const kid=await rCred("APPLE_MUSIC_KEY_ID","apple_music_key_id",db);
  if(!pk||!tid||!kid) return {error:"Apple Music credentials not configured."};
  try{return{token:await cAJWT(pk,tid,kid)};}catch(e){return{error:"JWT failed: "+(e instanceof Error?e.message:String(e))};}
}
async function fAlbum(token:string,pid:string,sf:string):Promise<{album:ASHit|null;error:string|null}>{
  const apiUrl="https://api.music.apple.com/v1/catalog/"+sf+"/albums/"+pid+"?include=artists,tracks";
  const res=await fetch(apiUrl,{headers:{Authorization:"Bearer "+token}});
  if(!res.ok){const t=await res.text();return{album:null,error:"Apple Music API "+res.status+": "+t.slice(0,300)};}
  const raw=await res.json() as {data:ASHit[]};
  return {album:raw.data?.[0]||null,error:null};
}
function eTracks(album:ASHit,albumArtist:string,artwork:string|null){
  return (album.relationships?.tracks?.data||[]).map(t=>({
    id:t.id, title:(t.attributes?.name as string)||"Untitled",
    artistName:(t.attributes?.artistName as string)||albumArtist,
    trackNumber:(t.attributes?.trackNumber as number|null)??null,
    durationMs:(t.attributes?.durationInMillis as number|null)||null,
    isrc:(t.attributes?.isrc as string)||null,
    artworkUrl:aUrl(t.attributes?.artwork as AArt|undefined,300)||artwork,
    previewUrl:((t.attributes?.previews as Array<{url:string}>|undefined)?.[0]?.url)||null,
  }));
}

Deno.serve(async (req) => {
  const cors = corsR(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = await vJwt(req);
  if (!auth) return jRaw({ error: "Missing or invalid token" }, cors, 401);
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { body = {}; }
  let route = String(body.route ?? "");
  const now = new Date().toISOString();
  let artistSubmissionContext: { artistId: string } | null = null;

  const artistSubmissionRoute =
    route === "artist-submission-search" ||
    route === "artist-submission-inspect";

  if (artistSubmissionRoute) {
    const artistId = String(body.artistId ?? "").trim();
    if (!artistId) {
      return jRaw({ error: "Artist is required." }, cors, 400);
    }

    const { data: representation, error: representationError } =
      await db
        .from("artist_representations")
        .select("id")
        .eq("artist_id", artistId)
        .eq("user_id", auth.id)
        .eq("status", "active")
        .eq("can_submit_releases", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const { data: artist, error: artistError } =
      await db
        .from("registry_artists")
        .select("id")
        .eq("id", artistId)
        .eq("status", "active")
        .maybeSingle();

    if (
      representationError ||
      artistError ||
      !representation ||
      !artist
    ) {
      return jRaw(
        { error: "Artist music submission permission is required." },
        cors,
        403,
      );
    }

    artistSubmissionContext = { artistId };
    body.entityType = "track";
    body.providerEntityType = "track";
    route =
      route === "artist-submission-search"
        ? "search"
        : "inspect";
  } else {
    const canAccess = await rCap(auth.id, "manage_registry");
    if (!canAccess) {
      return jRaw(
        { error: "Missing capability: manage_registry" },
        cors,
        403,
      );
    }
  }

  try {
if (route === "search") {
  const provider =
    String(body.provider ?? "apple_music")
      .trim()
      .toLowerCase();
  const q =
    String(body.query ?? body.q ?? "").trim();
  const entityType =
    String(body.entityType ?? "all")
      .trim()
      .toLowerCase();
  const limit = Math.min(Number(body.limit) || 25, 50);

  if (!q) {
    return jRaw({ error: "Missing query parameter" }, cors, 400);
  }

  if (provider === "spotify") {
    const creds = await getSpotifyAccessToken(db);
    if ("error" in creds) {
      return jRaw(
        {
          provider: "spotify",
          query: q,
          groups: { artists: [], releases: [], tracks: [], labels: [] },
          error: creds.error,
        },
        cors,
      );
    }

    const spotifyType =
      entityType === "release"
        ? "album"
        : entityType === "artist"
          ? "artist"
          : "track";

    const api = new URL("https://api.spotify.com/v1/search");
    api.searchParams.set("q", q);
    api.searchParams.set("type", spotifyType);
    api.searchParams.set("limit", String(limit));
    api.searchParams.set("market", creds.market);

    const response = await fetch(api, {
      headers: {
        Authorization: `Bearer ${creds.token}`,
        Accept: "application/json",
      },
    });

    const payload = await response.json().catch(() => ({})) as Record<string, any>;
    if (!response.ok) {
      return jRaw(
        {
          provider: "spotify",
          query: q,
          groups: { artists: [], releases: [], tracks: [], labels: [] },
          error: `Spotify API ${response.status}`,
        },
        cors,
      );
    }

    const tracks = Array.isArray(payload.tracks?.items)
      ? payload.tracks.items
      : [];
    const albums = Array.isArray(payload.albums?.items)
      ? payload.albums.items
      : [];
    const artists = Array.isArray(payload.artists?.items)
      ? payload.artists.items
      : [];

    const trackHits = tracks.map((track: any) => ({
      provider: "spotify",
      providerEntityId: String(track.id ?? ""),
      title: String(track.name ?? ""),
      artistDisplayName: Array.isArray(track.artists)
        ? track.artists
            .map((artist: any) => String(artist.name ?? ""))
            .filter(Boolean)
            .join(", ")
        : null,
      artworkUrl: spotifyArtwork(track.album?.images),
      confidenceScore: 0.95,
    }));

    const releaseHits = albums.map((album: any) => ({
      provider: "spotify",
      providerEntityId: String(album.id ?? ""),
      title: String(album.name ?? ""),
      artistDisplayName: Array.isArray(album.artists)
        ? album.artists
            .map((artist: any) => String(artist.name ?? ""))
            .filter(Boolean)
            .join(", ")
        : null,
      artworkUrl: spotifyArtwork(album.images),
      confidenceScore: 0.95,
    }));

    const artistHits = artists.map((artist: any) => ({
      provider: "spotify",
      providerEntityId: String(artist.id ?? ""),
      title: String(artist.name ?? ""),
      artistDisplayName: String(artist.name ?? ""),
      artworkUrl: spotifyArtwork(artist.images),
      confidenceScore: 0.95,
    }));

    return jRaw(
      {
        provider: "spotify",
        query: q,
        storefrontOrMarket: creds.market,
        groups: {
          artists: artistHits,
          releases: releaseHits,
          tracks: trackHits,
          labels: [],
        },
        rawResultCount:
          trackHits.length +
          releaseHits.length +
          artistHits.length,
      },
      cors,
    );
  }

  const storefront =
    String(body.storefront ?? "ke").trim().toLowerCase();
  const creds = await getAC(db);
  if ("error" in creds) {
    return jRaw(
      {
        provider: "apple_music",
        query: q,
        storefrontOrMarket: storefront,
        groups: { artists: [], releases: [], tracks: [], labels: [] },
        rawResultCount: 0,
        normalizedResultCount: 0,
        error: creds.error,
      },
      cors,
    );
  }

  const types =
    entityType === "all"
      ? ["artists", "albums", "songs"]
      : entityType === "release"
        ? ["albums"]
        : entityType === "artist"
          ? ["artists"]
          : ["songs"];

  const api =
    "https://api.music.apple.com/v1/catalog/" +
    storefront +
    "/search?term=" +
    encodeURIComponent(q) +
    "&types=" +
    types.join(",") +
    "&limit=" +
    limit;

  const response = await fetch(api, {
    headers: { Authorization: "Bearer " + creds.token },
  });

  if (!response.ok) {
    return jRaw(
      {
        provider: "apple_music",
        query: q,
        storefrontOrMarket: storefront,
        groups: { artists: [], releases: [], tracks: [], labels: [] },
        rawResultCount: 0,
        normalizedResultCount: 0,
        error: "Apple Music API " + response.status,
      },
      cors,
    );
  }

  const data = await response.json() as {
    results?: Record<string, { data: ASHit[] }>;
  };
  const groups = data.results || {};
  const formatHit = (hit: ASHit) => ({
    provider: "apple_music",
    providerEntityId: hit.id,
    title: hit.attributes?.name || "",
    artistDisplayName:
      hit.attributes?.artistName || null,
    artworkUrl: aUrl(hit.attributes?.artwork, 300),
    confidenceScore: 0.95,
  });

  return jRaw(
    {
      provider: "apple_music",
      query: q,
      storefrontOrMarket: storefront,
      groups: {
        artists: (groups.artists?.data || []).map(formatHit),
        releases: (groups.albums?.data || []).map(formatHit),
        tracks: (groups.songs?.data || []).map(formatHit),
        labels: [],
      },
      rawResultCount:
        (groups.artists?.data || []).length +
        (groups.albums?.data || []).length +
        (groups.songs?.data || []).length,
    },
    cors,
  );
}

if (route === "inspect") {
  const provider =
    String(body.provider ?? "apple_music")
      .trim()
      .toLowerCase();
  const providerEntityType =
    String(body.providerEntityType ?? "release")
      .trim()
      .toLowerCase();
  const providerEntityId =
    String(body.providerEntityId ?? "").trim();

  if (!providerEntityId) {
    return jRaw(
      { error: "Missing providerEntityId" },
      cors,
      400,
    );
  }

  if (provider === "spotify") {
    const creds = await getSpotifyAccessToken(db);
    if ("error" in creds) {
      return jRaw({ error: creds.error }, cors, 400);
    }

    if (providerEntityType !== "track") {
      return jRaw(
        { error: "Track Intake Spotify inspection requires a track." },
        cors,
        400,
      );
    }

    const trackResponse = await fetch(
      `https://api.spotify.com/v1/tracks/${encodeURIComponent(providerEntityId)}?market=${encodeURIComponent(creds.market)}`,
      {
        headers: {
          Authorization: `Bearer ${creds.token}`,
          Accept: "application/json",
        },
      },
    );

    const track = await trackResponse
      .json()
      .catch(() => ({})) as any;

    if (!trackResponse.ok || !track?.id) {
      return jRaw(
        {
          error:
            `Spotify track inspection failed (${trackResponse.status}).`,
        },
        cors,
        400,
      );
    }

    let album: any = track.album ?? {};
    if (track.album?.id) {
      const albumResponse = await fetch(
        `https://api.spotify.com/v1/albums/${encodeURIComponent(track.album.id)}?market=${encodeURIComponent(creds.market)}`,
        {
          headers: {
            Authorization: `Bearer ${creds.token}`,
            Accept: "application/json",
          },
        },
      );
      if (albumResponse.ok) {
        album = await albumResponse.json().catch(() => album);
      }
    }

    const artistNames = Array.isArray(track.artists)
      ? track.artists
          .map((artist: any) => String(artist.name ?? ""))
          .filter(Boolean)
      : [];

    const rawReleaseDate = String(
      album?.release_date ?? track.album?.release_date ?? "",
    ).trim();
    const releaseDatePrecision =
      String(
        album?.release_date_precision ??
          track.album?.release_date_precision ??
          "",
      ).trim() || null;
    let canonicalReleaseDate: string | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawReleaseDate)) {
      canonicalReleaseDate = rawReleaseDate;
    } else if (/^\d{4}-\d{2}$/.test(rawReleaseDate)) {
      canonicalReleaseDate = `${rawReleaseDate}-01`;
    } else if (/^\d{4}$/.test(rawReleaseDate)) {
      canonicalReleaseDate = `${rawReleaseDate}-01-01`;
    }

    const fields = {
      title: String(track.name ?? "") || null,
      artist_names: artistNames,
      release_title:
        String(album?.name ?? track.album?.name ?? "") || null,
      isrc:
        String(track.external_ids?.isrc ?? "") || null,
      duration_ms:
        Number.isFinite(Number(track.duration_ms))
          ? Number(track.duration_ms)
          : null,
      track_artwork_url:
        spotifyArtwork(track.album?.images),
      release_artwork_url:
        spotifyArtwork(album?.images ?? track.album?.images),
      preview_url:
        String(track.preview_url ?? "") || null,
      release_date: canonicalReleaseDate,
      release_date_precision: releaseDatePrecision,
      label_name:
        String(album?.label ?? "") || null,
      imprint_name: null,
      genre:
        Array.isArray(album?.genres) && album.genres.length
          ? String(album.genres[0])
          : null,
      track_number:
        Number.isFinite(Number(track.track_number))
          ? Number(track.track_number)
          : null,
      disc_number:
        Number.isFinite(Number(track.disc_number))
          ? Number(track.disc_number)
          : null,
      explicit:
        typeof track.explicit === "boolean"
          ? track.explicit
          : null,
      provider_url:
        String(track.external_urls?.spotify ?? "") || null,
      upc:
        String(album?.external_ids?.upc ?? "") || null,
      copyright_text:
        Array.isArray(album?.copyrights)
          ? album.copyrights
              .map((entry: any) => String(entry.text ?? ""))
              .filter(Boolean)
              .join(" | ") || null
          : null,
    };

    const result = {
      provider: "spotify",
      providerEntityType: "track",
      providerEntityId,
      title: fields.title,
      artistDisplayName:
        artistNames.join(", ") || null,
      artworkUrl: fields.track_artwork_url,
      confidenceScore: 0.95,
      providerUrl: fields.provider_url,
      enrichment: fields,
      source: {
        storefrontOrMarket: creds.market,
        fetchedAt: now,
      },
    };

    const validationId =
      artistSubmissionContext
        ? await recordArtistSubmissionValidation(
            db,
            auth.id,
            artistSubmissionContext.artistId,
            result,
          )
        : null;

    return jRaw(
      {
        result,
        ...(validationId ? { validationId } : {}),
        raw: {
          track,
          album,
        },
      },
      cors,
    );
  }

  const storefront =
    String(body.storefront ?? "ke").trim().toLowerCase();
  const creds = await getAC(db);
  if ("error" in creds) {
    return jRaw({ error: creds.error }, cors, 400);
  }

  const endpointType =
    providerEntityType === "release"
      ? "albums"
      : "songs";
  const include =
    providerEntityType === "release"
      ? "artists,tracks"
      : "artists,albums";

  const api =
    "https://api.music.apple.com/v1/catalog/" +
    storefront +
    "/" +
    endpointType +
    "/" +
    providerEntityId +
    "?include=" +
    include;

  const response = await fetch(api, {
    headers: { Authorization: "Bearer " + creds.token },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    return jRaw(
      {
        error:
          "Apple Music API " +
          response.status +
          ": " +
          bodyText.slice(0, 300),
      },
      cors,
      500,
    );
  }

  const raw = await response.json() as {
    data: Array<any>;
    included?: Array<any>;
  };
  const media = raw.data?.[0];
  if (!media) {
    return jRaw({ error: "Entity not found" }, cors, 404);
  }

  const attributes = media.attributes || {};

  if (providerEntityType === "release") {
    const result = {
      provider: "apple_music",
      providerEntityType: "release",
      providerEntityId,
      title: String(attributes.name ?? ""),
      artistDisplayName:
        String(attributes.artistName ?? "") || null,
      artworkUrl: aUrl(attributes.artwork, 600),
      confidenceScore: 0.95,
      source: {
        storefrontOrMarket: storefront,
        fetchedAt: now,
      },
    };

    const tracks = (media.relationships?.tracks?.data || []).map(
      (track: any) => ({
        providerEntityType: "track",
        providerEntityId: String(track.id ?? ""),
        title: String(track.attributes?.name ?? "") || "Unknown",
        artistDisplayName:
          String(track.attributes?.artistName ?? "") || null,
        artworkUrl: aUrl(track.attributes?.artwork, 300),
        isrc: String(track.attributes?.isrc ?? "") || null,
        previewUrl:
          Array.isArray(track.attributes?.previews) &&
          track.attributes.previews[0]?.url
            ? String(track.attributes.previews[0].url)
            : null,
      }),
    );

    const { data: providerLinks } = await db
      .from("provider_entity_links")
      .select("registry_entity_id")
      .eq("provider", "apple_music")
      .eq("provider_entity_id", providerEntityId)
      .eq("registry_entity_type", "release");

    const shellIds = (providerLinks || []).map(
      (link) => link.registry_entity_id as string,
    );

    const { data: shells } =
      shellIds.length > 0
        ? await db
            .from("registry_release_shells")
            .select("id,slug,title,status")
            .in("id", shellIds)
        : { data: [] };

    return jRaw(
      {
        result,
        tracks,
        existingShells: (shells || []).map((shell) => ({
          shellKey: shell.id,
          title: shell.title,
          status: shell.status,
        })),
      },
      cors,
    );
  }

  const included = Array.isArray(raw.included)
    ? raw.included
    : [];
  const album =
    providerEntityType === "track"
      ? included.find((entry: any) => entry.type === "albums")
      : media;
  const albumAttributes = album?.attributes || {};

  const previewUrl =
    Array.isArray(attributes.previews) &&
    attributes.previews[0]?.url
      ? String(attributes.previews[0].url)
      : null;

  const fields = {
    title: String(attributes.name ?? "") || null,
    artist_names:
      String(attributes.artistName ?? "")
        ? [String(attributes.artistName)]
        : [],
    release_title:
      String(
        attributes.albumName ??
        albumAttributes.name ??
        "",
      ) || null,
    isrc:
      String(attributes.isrc ?? "") || null,
    duration_ms:
      Number.isFinite(Number(attributes.durationInMillis))
        ? Number(attributes.durationInMillis)
        : null,
    track_artwork_url:
      aUrl(attributes.artwork, 600),
    release_artwork_url:
      aUrl(albumAttributes.artwork, 600) ||
      aUrl(attributes.artwork, 600),
    preview_url: previewUrl,
    release_date:
      String(
        albumAttributes.releaseDate ??
        attributes.releaseDate ??
        "",
      ) || null,
    release_date_precision: "day",
    label_name:
      String(
        albumAttributes.recordLabel ??
        attributes.recordLabel ??
        "",
      ) || null,
    imprint_name: null,
    genre:
      Array.isArray(attributes.genreNames) &&
      attributes.genreNames.length
        ? String(attributes.genreNames[0])
        : Array.isArray(albumAttributes.genreNames) &&
            albumAttributes.genreNames.length
          ? String(albumAttributes.genreNames[0])
          : null,
    track_number:
      Number.isFinite(Number(attributes.trackNumber))
        ? Number(attributes.trackNumber)
        : null,
    disc_number:
      Number.isFinite(Number(attributes.discNumber))
        ? Number(attributes.discNumber)
        : null,
    explicit:
      String(attributes.contentRating ?? "").toLowerCase() === "explicit"
        ? true
        : null,
    provider_url:
      String(attributes.url ?? "") || null,
    upc:
      String(albumAttributes.upc ?? "") || null,
    copyright_text:
      String(albumAttributes.copyright ?? "") || null,
  };

  const result = {
    provider: "apple_music",
    providerEntityType,
    providerEntityId,
    title: fields.title,
    artistDisplayName:
      fields.artist_names.join(", ") || null,
    artworkUrl: fields.track_artwork_url,
    confidenceScore: 0.95,
    providerUrl: fields.provider_url,
    enrichment: fields,
    source: {
      storefrontOrMarket: storefront,
      fetchedAt: now,
    },
  };

  const validationId =
    artistSubmissionContext
      ? await recordArtistSubmissionValidation(
          db,
          auth.id,
          artistSubmissionContext.artistId,
          result,
        )
      : null;

  return jRaw(
    {
      result,
      ...(validationId ? { validationId } : {}),
      raw,
    },
    cors,
  );
}

    if (route === "test-connection") {
      const creds=await getAC(db);
      if("error" in creds) return jRaw({provider:"apple_music",storefront:(body.storefront as string)||"ke",status:"failed",error:creds.error,testedAt:now},cors);
      const start=Date.now();
      const res=await fetch("https://api.music.apple.com/v1/catalog/"+((body.storefront as string)||"ke")+"/search?term=test&types=artists&limit=1",{headers:{Authorization:"Bearer "+creds.token}});
      return jRaw({provider:"apple_music",storefront:(body.storefront as string)||"ke",status:res.ok?"connected":"failed",latencyMs:Date.now()-start,testedAt:now},cors);
    }
    if (route === "create-shell") {
      const pid=(body.providerEntityId as string)||""; const sf=(body.storefrontOrMarket as string)||(body.storefront as string)||"ke"; const stids=(body.selectedTrackIds as string[])||[];
      if(!pid) return jRaw({error:"Missing providerEntityId"},cors);
      const creds=await getAC(db); if("error" in creds) return jRaw({error:creds.error},cors);
      const{album,error:fe}=await fAlbum(creds.token,pid,sf); if(fe||!album) return jRaw({error:fe||"Album not found"},cors);
      const attrs=album.attributes || {}; const title=attrs.name||"Untitled"; const artist=attrs.artistName||"Unknown Artist"; const aw=aUrl(attrs.artwork,600); const rd=attrs.releaseDate||null; const gn=attrs.genreNames||[]; const rl=attrs.recordLabel||null; const upc=attrs.playParams?.id||null;
      const tracks=eTracks(album,artist,aw); const st=stids.length>0?tracks.filter(tr=>stids.includes(tr.id)):[...tracks]; if(st.length===0&&tracks.length>0) st.push(...tracks);
      const asl=slugify(artist); let ps=asl,pn=artist; const{data:ra}=await db.from("registry_artists").select("slug,display_name").eq("slug",asl).in("status",["active","draft"]).maybeSingle(); if(ra){ps=ra.slug as string;pn=ra.display_name as string;}
      const cs=ps+"--"+slugify(title);
      const{data:el}=await db.from("provider_entity_links").select("registry_entity_id").eq("provider","apple_music").eq("provider_entity_id",pid).limit(1); if(el&&el.length>0) return jRaw({error:"A release shell already exists.",existingShellKey:el[0].registry_entity_id},cors);
      const rid=crypto.randomUUID(); let mer=false; const{data:exRel}=await db.from("registry_releases").select("id,slug").eq("slug",cs).maybeSingle();
      if(exRel){mer=true;} else {const{error:re}=await db.from("registry_releases").insert({id:rid,slug:cs,title,normalized_title:title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""),status:"draft",metadata:{},release_date:rd,artwork_url:aw,upc,created_at:now,updated_at:now});if(re) return jRaw({error:"Failed to create release: "+re.message},cors);}
      const sid=crypto.randomUUID(); const{error:se}=await db.from("registry_release_shells").insert({id:sid,release_id:rid,slug:cs,title,primary_artist_name:pn,primary_artist_slug:ps,release_date:rd,track_count:st.length,has_artwork:!!aw,tracks:st,status:"draft",readiness:"draft",generated_by:"provider_intake_api",source_provenance:{provider:"apple_music",provider_entity_id:pid,artist_name:artist,genre_names:gn,record_label:rl,upc,artwork_url:aw,track_count:st.length,ingested_at:now,matched_existing_release:mer},last_generated_at:now,created_at:now,updated_at:now});
      if(se) return jRaw({error:"Failed to create shell: "+se.message},cors);
      await db.from("provider_entity_links").insert({id:crypto.randomUUID(),provider:"apple_music",provider_entity_id:pid,registry_entity_type:"release",registry_entity_id:sid,confidence_score:1.0,match_status:"confirmed",created_at:now,updated_at:now});
      return jRaw({shell:{shellKey:sid,registryEntityId:sid,status:"draft"},mode:"create",matchedExistingRelease:mer,slug:{scoped:cs,artistSlug:ps,artistName:pn},release:{id:rid,slug:cs,createdNew:!mer}},cors);
    }
    if (route === "refresh-shell") {
      const pid=(body.providerEntityId as string)||""; const sf=(body.storefrontOrMarket as string)||(body.storefront as string)||"ke"; const stids=(body.selectedTrackIds as string[])||[];
      if(!pid) return jRaw({error:"Missing providerEntityId"},cors);
      const{data:el}=await db.from("provider_entity_links").select("registry_entity_id").eq("provider","apple_music").eq("provider_entity_id",pid).limit(1); if(!el||el.length===0) return jRaw({error:"No existing shell found. Use create instead."},cors);
      const sid=el[0].registry_entity_id as string; const{data:es}=await db.from("registry_release_shells").select("id,slug,release_id,status,source_provenance").eq("id",sid).maybeSingle(); if(!es) return jRaw({error:"Shell not found."},cors);
      if(TS.includes(es.status as string)) return jRaw({shell:{shellKey:sid,status:es.status},mode:"refresh-skipped"},cors);
      const creds=await getAC(db); if("error" in creds) return jRaw({error:creds.error},cors);
      const{album,error:fe}=await fAlbum(creds.token,pid,sf); if(fe||!album) return jRaw({error:fe||"Album not found"},cors);
      const attrs=album.attributes || {}; const title=attrs.name||"Untitled"; const artist=attrs.artistName||"Unknown Artist"; const aw=aUrl(attrs.artwork,600); const rd=attrs.releaseDate||null;
      const tracks=eTracks(album,artist,aw); const st=stids.length>0?tracks.filter(tr=>stids.includes(tr.id)):[...tracks]; if(st.length===0&&tracks.length>0) st.push(...tracks);
      const asl=slugify(artist); let ps=asl,pn=artist; const{data:ra}=await db.from("registry_artists").select("slug,display_name").eq("slug",asl).in("status",["active","draft"]).maybeSingle(); if(ra){ps=ra.slug as string;pn=ra.display_name as string;}
      const upd={title,primary_artist_name:pn,primary_artist_slug:ps,release_date:rd,track_count:st.length,has_artwork:!!aw,tracks:st,status:"draft",readiness:"draft",source_provenance:{provider:"apple_music",provider_entity_id:pid,artist_name:artist,track_count:st.length,refreshed_at:now,ingested_at:(es.source_provenance as Record<string,unknown>)?.ingested_at||now},last_generated_at:now,updated_at:now};
      const{error:ue}=await db.from("registry_release_shells").update(upd).eq("id",sid); if(ue) return jRaw({error:"Failed to refresh: "+ue.message},cors);
      const rid=es.release_id as string; await db.from("registry_releases").update({title,release_date:rd,artwork_url:aw,updated_at:now}).eq("id",rid).eq("status","draft");
      return jRaw({shell:{shellKey:sid,status:"draft"},mode:"refresh",slug:{scoped:es.slug,artistSlug:ps,artistName:pn},release:{id:rid,slug:es.slug,createdNew:false},diag:{tracksFetched:tracks.length,tracksSelected:st.length}},cors);
    }
    return jRaw({ error: "Unknown route: " + (route || "none") }, cors);
  } catch (err) {
    console.error("[provider-intake-api]", err instanceof Error ? err.message : String(err));
    return jRaw({ error: "Internal error" }, cors, 500);
  }
});
