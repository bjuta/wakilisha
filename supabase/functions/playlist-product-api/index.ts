import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

type JsonObject = Record<string, unknown>;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function userClient(authHeader: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw Object.assign(new Error("Authentication is required."), {
      status: 401,
    });
  }

  const client = userClient(authHeader);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw Object.assign(new Error("Authentication is required."), {
      status: 401,
    });
  }

  return { authHeader, client, user: data.user };
}

async function requirePlaylistEdit(
  client: ReturnType<typeof userClient>,
  playlistId: string,
) {
  const { data, error } = await client.rpc(
    "current_user_can_edit_playlist_id",
    { p_playlist_id: playlistId },
  );
  if (error || data !== true) {
    throw Object.assign(
      new Error("Playlist edit permission is required."),
      { status: 403 },
    );
  }
}

function youtubeIdentity(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  let id = "";
  if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
    if (url.pathname.startsWith("/shorts/")) {
      id = url.pathname.split("/").filter(Boolean)[1] ?? "";
    }
    if (url.pathname.startsWith("/embed/")) {
      id = url.pathname.split("/").filter(Boolean)[1] ?? "";
    }
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

function spotifyTrackIdentity(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "open.spotify.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "track" || !parts[1]) return null;
  return parts[1];
}

function appleSongIdentity(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "music.apple.com") return null;
  const queryId = url.searchParams.get("i");
  if (queryId) return queryId;
  const parts = url.pathname.split("/").filter(Boolean);
  const songIndex = parts.indexOf("song");
  if (songIndex >= 0 && parts[songIndex + 2]) {
    return parts[songIndex + 2];
  }
  return null;
}

function isSoundCloud(url: URL) {
  return url.hostname.replace(/^www\./, "") === "soundcloud.com";
}

function metaContent(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function readProviderCredential(
  dbKey: string,
): Promise<string | null> {
  const service = serviceClient();
  const { data, error } = await service
    .from("admin_settings_secrets")
    .select("setting_value")
    .eq("setting_key", dbKey)
    .maybeSingle();

  const stored = stringValue(
    objectValue(data).setting_value,
  );
  if (!error && stored) return stored;

  const envValue = Deno.env.get(dbKey);
  return envValue?.trim() || null;
}

async function validateYouTube(url: URL) {
  const id = youtubeIdentity(url);
  if (!id) return null;

  const canonicalUrl = `https://www.youtube.com/watch?v=${id}`;
  const apiKey = await readProviderCredential("YOUTUBE_API_KEY") ?? "";

  if (apiKey) {
    const endpoint = new URL(
      "https://www.googleapis.com/youtube/v3/videos",
    );
    endpoint.searchParams.set("part", "status,snippet");
    endpoint.searchParams.set("id", id);
    endpoint.searchParams.set("key", apiKey);

    const response = await fetch(endpoint);
    const payload = objectValue(
      await response.json().catch(() => ({})),
    );
    const items = Array.isArray(payload.items) ? payload.items : [];
    const item = objectValue(items[0]);
    const status = objectValue(item.status);
    const snippet = objectValue(item.snippet);

    if (response.ok && item.id) {
      if (status.embeddable !== true) {
        throw Object.assign(
          new Error(
            "That YouTube video does not allow embedded playback, so it cannot be used in a WAKILISHA Playlist.",
          ),
          { status: 400 },
        );
      }

      const privacy = stringValue(status.privacyStatus);
      if (!["public", "unlisted"].includes(privacy)) {
        throw Object.assign(
          new Error("That YouTube video is not publicly playable."),
          { status: 400 },
        );
      }

      return {
        providerKey: "youtube",
        providerObjectId: id,
        providerUrl: url.toString(),
        canonicalUrl,
        playbackKind: "video",
        embedUrl: `https://www.youtube.com/embed/${id}`,
        previewUrl: null,
        titleHint: stringValue(snippet.title) || null,
        artistNamesHint: stringValue(snippet.channelTitle)
          ? [stringValue(snippet.channelTitle)]
          : [],
        releaseTitleHint: null,
        artworkUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        requiresClientProbe: false,
        providerMetadata: {
          validation_mode: "youtube_data_api",
          privacy_status: privacy,
          embeddable: true,
          channel_id: snippet.channelId ?? null,
          published_at: snippet.publishedAt ?? null,
        },
      };
    }
  }

  const oembed = new URL("https://www.youtube.com/oembed");
  oembed.searchParams.set("url", canonicalUrl);
  oembed.searchParams.set("format", "json");

  const response = await fetch(oembed, {
    headers: { Accept: "application/json" },
  });
  const payload = objectValue(
    await response.json().catch(() => ({})),
  );

  if (!response.ok || !stringValue(payload.title)) {
    throw Object.assign(
      new Error("That YouTube video could not be reached."),
      { status: 400 },
    );
  }

  const author = stringValue(payload.author_name);

  return {
    providerKey: "youtube",
    providerObjectId: id,
    providerUrl: url.toString(),
    canonicalUrl,
    playbackKind: "video",
    embedUrl: `https://www.youtube.com/embed/${id}`,
    previewUrl: null,
    titleHint: stringValue(payload.title) || null,
    artistNamesHint: author ? [author] : [],
    releaseTitleHint: null,
    artworkUrl:
      stringValue(payload.thumbnail_url)
      || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    requiresClientProbe: true,
    providerMetadata: {
      validation_mode: "youtube_iframe_browser_probe",
      oembed_type: payload.type ?? null,
      author_url: payload.author_url ?? null,
    },
  };
}

async function validateSpotify(url: URL) {
  const id = spotifyTrackIdentity(url);
  if (!id) return null;

  const canonicalUrl = `https://open.spotify.com/track/${id}`;
  const response = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(canonicalUrl)}`,
    { headers: { Accept: "application/json" } },
  );
  const payload = objectValue(await response.json().catch(() => ({})));

  if (!response.ok || !stringValue(payload.title)) {
    throw Object.assign(
      new Error(
        "That Spotify track could not be confirmed as an embeddable track.",
      ),
      { status: 400 },
    );
  }

  const author = stringValue(payload.author_name);

  return {
    providerKey: "spotify",
    providerObjectId: id,
    providerUrl: url.toString(),
    canonicalUrl,
    playbackKind: "audio",
    embedUrl: `https://open.spotify.com/embed/track/${id}`,
    previewUrl: null,
    titleHint: stringValue(payload.title) || null,
    artistNamesHint: author ? [author] : [],
    releaseTitleHint: null,
    artworkUrl: stringValue(payload.thumbnail_url) || null,
    providerMetadata: {
      provider_name: payload.provider_name ?? "Spotify",
      oembed_type: payload.type ?? null,
    },
  };
}

async function validateAppleMusic(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "music.apple.com") return null;

  const id = appleSongIdentity(url);
  if (!id) {
    throw Object.assign(
      new Error(
        "Apple Music album links do not identify one Playlist track. Open the song itself and paste its song link.",
      ),
      { status: 400 },
    );
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const storefront =
    /^[a-z]{2}$/i.test(parts[0] ?? "")
      ? String(parts[0]).toLowerCase()
      : "us";

  const lookup = new URL("https://itunes.apple.com/lookup");
  lookup.searchParams.set("id", id);
  lookup.searchParams.set("entity", "song");
  lookup.searchParams.set("country", storefront.toUpperCase());

  const lookupResponse = await fetch(lookup, {
    headers: {
      Accept: "application/json",
      "User-Agent": "WAKILISHA-Playlist-Validator/1.0",
    },
    redirect: "follow",
  });

  const lookupPayload = objectValue(
    await lookupResponse.json().catch(() => ({})),
  );
  const results = Array.isArray(lookupPayload.results)
    ? lookupPayload.results
    : [];

  const track = results
    .map((value) => objectValue(value))
    .find((value) => String(value.trackId ?? "") === id);

  if (!lookupResponse.ok || !track) {
    throw Object.assign(
      new Error(
        "That Apple Music song could not be confirmed in the public catalog.",
      ),
      { status: 400 },
    );
  }

  const kind = stringValue(track.kind);
  if (kind && kind !== "song") {
    throw Object.assign(
      new Error("That Apple Music link is not a song."),
      { status: 400 },
    );
  }

  const canonical = new URL(url.toString());
  canonical.hash = "";

  const embedUrl = canonical
    .toString()
    .replace("https://music.apple.com", "https://embed.music.apple.com")
    .replace("http://music.apple.com", "https://embed.music.apple.com");

  const embedResponse = await fetch(embedUrl, {
    headers: {
      "User-Agent": "WAKILISHA-Playlist-Validator/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!embedResponse.ok) {
    throw Object.assign(
      new Error(
        "That Apple Music song exists, but its embedded player could not be reached.",
      ),
      { status: 400 },
    );
  }

  const artistName = stringValue(track.artistName);
  const artwork = stringValue(track.artworkUrl100);
  const artworkUrl = artwork
    ? artwork.replace(/100x100bb/i, "600x600bb")
    : null;

  return {
    providerKey: "apple_music",
    providerObjectId: id,
    providerUrl: url.toString(),
    canonicalUrl: canonical.toString(),
    playbackKind: "audio",
    embedUrl,
    previewUrl: stringValue(track.previewUrl) || null,
    titleHint: stringValue(track.trackName) || null,
    artistNamesHint: artistName ? [artistName] : [],
    releaseTitleHint: stringValue(track.collectionName) || null,
    artworkUrl,
    providerMetadata: {
      validation_mode: "itunes_lookup_plus_embed",
      storefront,
      artist_id: track.artistId ?? null,
      collection_id: track.collectionId ?? null,
      primary_genre_name: track.primaryGenreName ?? null,
      release_date: track.releaseDate ?? null,
      track_time_millis: track.trackTimeMillis ?? null,
      embed_http_status: embedResponse.status,
    },
  };
}

async function validateSoundCloud(url: URL) {
  if (!isSoundCloud(url)) return null;

  const canonicalUrl = url.toString();
  const response = await fetch(
    `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(canonicalUrl)}`,
    { headers: { Accept: "application/json" } },
  );
  const payload = objectValue(await response.json().catch(() => ({})));

  if (!response.ok || !stringValue(payload.html)) {
    throw Object.assign(
      new Error(
        "That SoundCloud track could not be confirmed as an embeddable playback source.",
      ),
      { status: 400 },
    );
  }

  const author = stringValue(payload.author_name);

  return {
    providerKey: "soundcloud",
    providerObjectId: canonicalUrl,
    providerUrl: canonicalUrl,
    canonicalUrl,
    playbackKind: "audio",
    embedUrl:
      `https://w.soundcloud.com/player/?url=${encodeURIComponent(canonicalUrl)}`,
    previewUrl: null,
    titleHint: stringValue(payload.title) || null,
    artistNamesHint: author ? [author] : [],
    releaseTitleHint: null,
    artworkUrl: stringValue(payload.thumbnail_url) || null,
    providerMetadata: {
      oembed_type: payload.type ?? null,
      author_url: payload.author_url ?? null,
    },
  };
}

async function resolvePublicTrackMetadataUrl(
  rawUrl: string,
) {
  let url: URL;

  try {
    url = new URL(
      rawUrl,
    );
  } catch {
    throw Object.assign(
      new Error(
        "Enter a valid music link.",
      ),
      {
        status:
          400,
      },
    );
  }

  if (
    ![
      "http:",
      "https:",
    ].includes(
      url.protocol,
    )
  ) {
    throw Object.assign(
      new Error(
        "Music links must use HTTPS or HTTP.",
      ),
      {
        status:
          400,
      },
    );
  }

  const youtubeId =
    youtubeIdentity(
      url,
    );

  if (
    youtubeId
  ) {
    const canonicalUrl =
      `https://www.youtube.com/watch?v=${youtubeId}`;

    const apiKey =
      await readProviderCredential(
        "YOUTUBE_API_KEY",
      ) ??
      "";

    if (
      apiKey
    ) {
      const endpoint =
        new URL(
          "https://www.googleapis.com/youtube/v3/videos",
        );

      endpoint.searchParams.set(
        "part",
        "snippet",
      );
      endpoint.searchParams.set(
        "id",
        youtubeId,
      );
      endpoint.searchParams.set(
        "key",
        apiKey,
      );

      const response =
        await fetch(
          endpoint,
        );

      const payload =
        objectValue(
          await response
            .json()
            .catch(
              () =>
                ({}),
            ),
        );

      const items =
        Array.isArray(
          payload.items,
        )
          ? payload.items
          : [];

      const item =
        objectValue(
          items[0],
        );

      const snippet =
        objectValue(
          item.snippet,
        );

      if (
        response.ok &&
        item.id
      ) {
        const channel =
          stringValue(
            snippet.channelTitle,
          );

        return {
          providerKey:
            "youtube",
          providerObjectId:
            youtubeId,
          providerUrl:
            url.toString(),
          canonicalUrl,
          playbackKind:
            "video",
          titleHint:
            stringValue(
              snippet.title,
            ) ||
            null,
          artistNamesHint:
            channel
              ? [
                  channel,
                ]
              : [],
          releaseTitleHint:
            null,
          artworkUrl:
            `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
          previewUrl:
            null,
          providerMetadata: {
            validation_mode:
              "youtube_public_metadata",
            channel_id:
              snippet.channelId ??
              null,
            published_at:
              snippet.publishedAt ??
              null,
          },
        };
      }
    }

    const oembed =
      new URL(
        "https://www.youtube.com/oembed",
      );

    oembed.searchParams.set(
      "url",
      canonicalUrl,
    );
    oembed.searchParams.set(
      "format",
      "json",
    );

    const response =
      await fetch(
        oembed,
        {
          headers: {
            Accept:
              "application/json",
          },
        },
      );

    const payload =
      objectValue(
        await response
          .json()
          .catch(
            () =>
              ({}),
          ),
      );

    if (
      !response.ok ||
      !stringValue(
        payload.title,
      )
    ) {
      throw Object.assign(
        new Error(
          "That YouTube link could not be read.",
        ),
        {
          status:
            400,
        },
      );
    }

    const author =
      stringValue(
        payload.author_name,
      );

    return {
      providerKey:
        "youtube",
      providerObjectId:
        youtubeId,
      providerUrl:
        url.toString(),
      canonicalUrl,
      playbackKind:
        "video",
      titleHint:
        stringValue(
          payload.title,
        ) ||
        null,
      artistNamesHint:
        author
          ? [
              author,
            ]
          : [],
      releaseTitleHint:
        null,
      artworkUrl:
        stringValue(
          payload.thumbnail_url,
        ) ||
        null,
      previewUrl:
        null,
      providerMetadata: {
        validation_mode:
          "youtube_oembed_metadata",
        author_url:
          payload.author_url ??
          null,
      },
    };
  }

  const spotifyId =
    spotifyTrackIdentity(
      url,
    );

  if (
    spotifyId
  ) {
    const canonicalUrl =
      `https://open.spotify.com/track/${spotifyId}`;

    const response =
      await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(canonicalUrl)}`,
        {
          headers: {
            Accept:
              "application/json",
          },
        },
      );

    const payload =
      objectValue(
        await response
          .json()
          .catch(
            () =>
              ({}),
          ),
      );

    if (
      !response.ok ||
      !stringValue(
        payload.title,
      )
    ) {
      throw Object.assign(
        new Error(
          "That Spotify track could not be read.",
        ),
        {
          status:
            400,
        },
      );
    }

    const author =
      stringValue(
        payload.author_name,
      );

    return {
      providerKey:
        "spotify",
      providerObjectId:
        spotifyId,
      providerUrl:
        url.toString(),
      canonicalUrl,
      playbackKind:
        "audio",
      titleHint:
        stringValue(
          payload.title,
        ) ||
        null,
      artistNamesHint:
        author
          ? [
              author,
            ]
          : [],
      releaseTitleHint:
        null,
      artworkUrl:
        stringValue(
          payload.thumbnail_url,
        ) ||
        null,
      previewUrl:
        null,
      providerMetadata: {
        validation_mode:
          "spotify_oembed_metadata",
        provider_name:
          payload.provider_name ??
          "Spotify",
      },
    };
  }

  const appleId =
    appleSongIdentity(
      url,
    );

  if (
    appleId
  ) {
    const parts =
      url.pathname
        .split(
          "/",
        )
        .filter(
          Boolean,
        );

    const storefront =
      /^[a-z]{2}$/i.test(
        parts[0] ??
        "",
      )
        ? String(
            parts[0],
          ).toLowerCase()
        : "us";

    const lookup =
      new URL(
        "https://itunes.apple.com/lookup",
      );

    lookup.searchParams.set(
      "id",
      appleId,
    );
    lookup.searchParams.set(
      "entity",
      "song",
    );
    lookup.searchParams.set(
      "country",
      storefront.toUpperCase(),
    );

    const response =
      await fetch(
        lookup,
        {
          headers: {
            Accept:
              "application/json",
            "User-Agent":
              "WAKILISHA-Public-Track-Metadata/1.0",
          },
          redirect:
            "follow",
        },
      );

    const payload =
      objectValue(
        await response
          .json()
          .catch(
            () =>
              ({}),
          ),
      );

    const results =
      Array.isArray(
        payload.results,
      )
        ? payload.results
        : [];

    const track =
      results
        .map(
          (
            value,
          ) =>
            objectValue(
              value,
            ),
        )
        .find(
          (
            value,
          ) =>
            String(
              value.trackId ??
              "",
            ) ===
            appleId,
        );

    if (
      !response.ok ||
      !track
    ) {
      throw Object.assign(
        new Error(
          "That Apple Music song could not be read.",
        ),
        {
          status:
            400,
        },
      );
    }

    const artistName =
      stringValue(
        track.artistName,
      );

    const artwork =
      stringValue(
        track.artworkUrl100,
      );

    return {
      providerKey:
        "apple_music",
      providerObjectId:
        appleId,
      providerUrl:
        url.toString(),
      canonicalUrl:
        url.toString(),
      playbackKind:
        "audio",
      titleHint:
        stringValue(
          track.trackName,
        ) ||
        null,
      artistNamesHint:
        artistName
          ? [
              artistName,
            ]
          : [],
      releaseTitleHint:
        stringValue(
          track.collectionName,
        ) ||
        null,
      artworkUrl:
        artwork
          ? artwork.replace(
              /100x100bb/i,
              "600x600bb",
            )
          : null,
      previewUrl:
        stringValue(
          track.previewUrl,
        ) ||
        null,
      providerMetadata: {
        validation_mode:
          "itunes_public_metadata",
        storefront,
        artist_id:
          track.artistId ??
          null,
        collection_id:
          track.collectionId ??
          null,
        primary_genre_name:
          track.primaryGenreName ??
          null,
        release_date:
          track.releaseDate ??
          null,
        track_time_millis:
          track.trackTimeMillis ??
          null,
      },
    };
  }

  if (
    isSoundCloud(
      url,
    )
  ) {
    const canonicalUrl =
      url.toString();

    const response =
      await fetch(
        `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(canonicalUrl)}`,
        {
          headers: {
            Accept:
              "application/json",
          },
        },
      );

    const payload =
      objectValue(
        await response
          .json()
          .catch(
            () =>
              ({}),
          ),
      );

    if (
      !response.ok ||
      !stringValue(
        payload.title,
      )
    ) {
      throw Object.assign(
        new Error(
          "That SoundCloud track could not be read.",
        ),
        {
          status:
            400,
        },
      );
    }

    const author =
      stringValue(
        payload.author_name,
      );

    return {
      providerKey:
        "soundcloud",
      providerObjectId:
        canonicalUrl,
      providerUrl:
        canonicalUrl,
      canonicalUrl,
      playbackKind:
        "audio",
      titleHint:
        stringValue(
          payload.title,
        ) ||
        null,
      artistNamesHint:
        author
          ? [
              author,
            ]
          : [],
      releaseTitleHint:
        null,
      artworkUrl:
        stringValue(
          payload.thumbnail_url,
        ) ||
        null,
      previewUrl:
        null,
      providerMetadata: {
        validation_mode:
          "soundcloud_oembed_metadata",
        author_url:
          payload.author_url ??
          null,
      },
    };
  }

  throw Object.assign(
    new Error(
      "Use a Spotify, Apple Music, YouTube, or SoundCloud track link.",
    ),
    {
      status:
        400,
    },
  );
}

async function validatePlaybackUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error("Enter a valid provider URL."), {
      status: 400,
    });
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw Object.assign(new Error("Playback links must use HTTPS or HTTP."), {
      status: 400,
    });
  }

  const validators = [
    validateYouTube,
    validateSpotify,
    validateAppleMusic,
    validateSoundCloud,
  ];

  for (const validator of validators) {
    const result = await validator(url);
    if (result) return result;
  }

  throw Object.assign(
    new Error(
      "That provider is not yet approved for Playlist playback. Use YouTube, Spotify, Apple Music, or SoundCloud.",
    ),
    { status: 400 },
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json(405, { error: "POST is required." });
    }

    const { client, user } = await requireUser(req);
    const body = objectValue(await req.json());
    const action = stringValue(body.action);

    if (
      action ===
      "resolve_public_track"
    ) {
      const rawUrl =
        stringValue(
          body.url,
        );

      if (
        !rawUrl
      ) {
        return json(
          400,
          {
            error:
              "A music link is required.",
          },
        );
      }

      const resolved =
        await resolvePublicTrackMetadataUrl(
          rawUrl,
        );

      return json(
        200,
        {
          ok:
            true,
          provider_key:
            resolved.providerKey,
          provider_object_id:
            resolved.providerObjectId,
          canonical_url:
            resolved.canonicalUrl,
          title:
            resolved.titleHint,
          artist_names:
            resolved.artistNamesHint,
          release_title:
            resolved.releaseTitleHint,
          artwork_url:
            resolved.artworkUrl,
        },
      );
    }

    if (
      action ===
      "submit_public_missing_track"
    ) {
      if (
        !user.email_confirmed_at
      ) {
        return json(
          403,
          {
            error:
              "Verify your email before submitting a track.",
          },
        );
      }

      const playlistId =
        stringValue(
          body.playlist_id,
        );

      const playlistSlug =
        stringValue(
          body.playlist_slug,
        );

      const trackTitle =
        stringValue(
          body.track_title,
        );

      const artistNames =
        Array.isArray(
          body.artist_names,
        )
          ? body.artist_names
              .map(
                (
                  value,
                ) =>
                  stringValue(
                    value,
                  ),
              )
              .filter(
                Boolean,
              )
          : [];

      const details =
        stringValue(
          body.details,
        );

      const rawUrl =
        stringValue(
          body.url,
        );

      const idempotencyKey =
        stringValue(
          body.idempotency_key,
        );

      if (
        !playlistId ||
        !playlistSlug
      ) {
        return json(
          400,
          {
            error:
              "Playlist context is required.",
          },
        );
      }

      if (
        !trackTitle
      ) {
        return json(
          400,
          {
            error:
              "Track title is required.",
          },
        );
      }

      if (
        artistNames.length <
        1
      ) {
        return json(
          400,
          {
            error:
              "Add at least one artist.",
          },
        );
      }

      if (
        !idempotencyKey
      ) {
        return json(
          400,
          {
            error:
              "Submission identity is required.",
          },
        );
      }

      const resolved =
        rawUrl
          ? await resolvePublicTrackMetadataUrl(
              rawUrl,
            )
          : null;

      const provider =
        resolved
          ? {
              provider_key:
                resolved.providerKey,
              provider_object_id:
                resolved.providerObjectId,
              provider_url:
                resolved.providerUrl,
              canonical_url:
                resolved.canonicalUrl,
              provider_title:
                resolved.titleHint,
              provider_artist_names:
                resolved.artistNamesHint,
              provider_release_title:
                resolved.releaseTitleHint,
              playback_kind:
                resolved.playbackKind,
              artwork_url:
                resolved.artworkUrl,
              preview_url:
                resolved.previewUrl,
              provider_metadata:
                resolved.providerMetadata,
              checked_at:
                new Date()
                  .toISOString(),
            }
          : null;

      const service =
        serviceClient();

      const {
        data,
        error,
      } =
        await service.rpc(
          "create_public_playlist_missing_track_submission",
          {
            p_user_id:
              user.id,
            p_playlist_id:
              playlistId,
            p_playlist_slug:
              playlistSlug,
            p_track_title:
              trackTitle,
            p_artist_names:
              artistNames,
            p_details:
              details ||
              null,
            p_provider:
              provider,
            p_idempotency_key:
              idempotencyKey,
          },
        );

      if (
        error
      ) {
        throw Object.assign(
          new Error(
            error.message,
          ),
          {
            status:
              400,
          },
        );
      }

      const result =
        objectValue(
          data,
        );

      return json(
        200,
        {
          ok:
            true,
          contribution_id:
            result.contribution_id ??
            null,
          registry_suggestion_id:
            result.registry_suggestion_id ??
            null,
          registry_queued:
            result.registry_queued ===
            true,
          created:
            result.created ===
            true,
        },
      );
    }

    const playlistId = stringValue(body.playlist_id);

    if (!playlistId) {
      return json(400, { error: "playlist_id is required." });
    }

    await requirePlaylistEdit(client, playlistId);

    if (action === "validate_playback") {
      const rawUrl = stringValue(body.url);
      if (!rawUrl) {
        return json(400, { error: "A provider URL is required." });
      }

      const validated = await validatePlaybackUrl(rawUrl);
      const service = serviceClient();
      const correlationId = crypto.randomUUID();

      if (validated.requiresClientProbe === true) {
        const expiresAt =
          new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const { data: validationId, error } = await service.rpc(
          "record_playlist_playback_probe_candidate",
          {
            p_requested_by: user.id,
            p_playlist_id: playlistId,
            p_provider_key: validated.providerKey,
            p_provider_object_id: validated.providerObjectId,
            p_provider_url: validated.providerUrl,
            p_canonical_url: validated.canonicalUrl,
            p_playback_kind: validated.playbackKind,
            p_embed_url: validated.embedUrl,
            p_title_hint: validated.titleHint,
            p_artist_names_hint: validated.artistNamesHint,
            p_artwork_url: validated.artworkUrl,
            p_provider_metadata: validated.providerMetadata,
            p_expires_at: expiresAt,
            p_correlation_id: correlationId,
          },
        );

        if (error || !validationId) {
          throw Object.assign(
            new Error(
              error?.message ??
                "Playback probe candidate could not be recorded.",
            ),
            { status: 500 },
          );
        }

        return json(200, {
          ok: true,
          validation_id: validationId,
          validation_status: "probe_required",
          expires_at: expiresAt,
          ...validated,
        });
      }

      const expiresAt =
        new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const { data: validationId, error } = await service.rpc(
        "record_playlist_playback_validation",
        {
          p_requested_by: user.id,
          p_playlist_id: playlistId,
          p_provider_key: validated.providerKey,
          p_provider_object_id: validated.providerObjectId,
          p_provider_url: validated.providerUrl,
          p_canonical_url: validated.canonicalUrl,
          p_playback_kind: validated.playbackKind,
          p_embed_url: validated.embedUrl,
          p_preview_url: validated.previewUrl,
          p_title_hint: validated.titleHint,
          p_artist_names_hint: validated.artistNamesHint,
          p_release_title_hint: validated.releaseTitleHint,
          p_artwork_url: validated.artworkUrl,
          p_provider_metadata: validated.providerMetadata,
          p_expires_at: expiresAt,
          p_correlation_id: correlationId,
        },
      );

      if (error || !validationId) {
        throw Object.assign(
          new Error(
            error?.message ??
              "Playback validation could not be recorded.",
          ),
          { status: 500 },
        );
      }

      return json(200, {
        ok: true,
        validation_id: validationId,
        validation_status: "playable",
        expires_at: expiresAt,
        ...validated,
      });
    }

    if (action === "confirm_playback") {
      const validationId = stringValue(body.validation_id);
      if (!validationId) {
        return json(400, { error: "validation_id is required." });
      }

      const service = serviceClient();
      const { data, error } = await service.rpc(
        "confirm_playlist_playback_validation",
        {
          p_validation_id: validationId,
          p_requested_by: user.id,
          p_playlist_id: playlistId,
          p_probe_metadata: {
            result: "iframe_cued",
            user_agent: req.headers.get("user-agent"),
            origin: req.headers.get("origin"),
            confirmed_at: new Date().toISOString(),
          },
        },
      );

      if (error) {
        throw Object.assign(new Error(error.message), { status: 400 });
      }

      return json(200, {
        ok: true,
        ...objectValue(data),
      });
    }

    if (action === "cover_source") {
      const assetId = stringValue(body.asset_id);
      if (!assetId) {
        return json(400, { error: "asset_id is required." });
      }

      let sourceUrl = "";
      let expectedMime = "";
      let sourceMode = "canonical_revision";

      const { data, error } = await client.rpc(
        "get_playlist_cover_source",
        {
          p_playlist_id: playlistId,
          p_asset_id: assetId,
        },
      );

      if (!error) {
        const canonicalSource = objectValue(data);
        sourceUrl = stringValue(canonicalSource.url);
        expectedMime = stringValue(canonicalSource.mime_type);
      }

      if (!sourceUrl) {
        const service = serviceClient();
        const {
          data: compatibilityData,
          error: compatibilityError,
        } = await service
          .from("registry_media_assets")
          .select("id,url,mime_type,media_kind,status")
          .eq("id", assetId)
          .maybeSingle();

        const compatibility = objectValue(compatibilityData);
        const compatibilityStatus =
          stringValue(compatibility.status);
        const compatibilityMime =
          stringValue(compatibility.mime_type);
        const compatibilityKind =
          stringValue(compatibility.media_kind);

        if (
          compatibilityError ||
          compatibilityStatus !== "active"
        ) {
          throw Object.assign(
            new Error("Selected Media image is unavailable."),
            { status: 400 },
          );
        }

        if (
          !compatibilityMime.toLowerCase().startsWith("image/") &&
          compatibilityKind.toLowerCase() !== "image"
        ) {
          throw Object.assign(
            new Error("The selected Media item is not an image."),
            { status: 400 },
          );
        }

        sourceUrl = stringValue(compatibility.url);
        expectedMime = compatibilityMime;
        sourceMode = "legacy_compatibility";
      }

      if (!sourceUrl) {
        throw Object.assign(
          new Error("The selected Media image has no delivery URL."),
          { status: 400 },
        );
      }

      const response = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "WAKILISHA-Playlist-Cover/1.0",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        throw Object.assign(
          new Error("The selected Media image could not be reached."),
          { status: 400 },
        );
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (
        bytes.byteLength <= 0 ||
        bytes.byteLength > 25 * 1024 * 1024
      ) {
        throw Object.assign(
          new Error(
            "The selected image is empty or too large to prepare as a Playlist cover.",
          ),
          { status: 400 },
        );
      }

      const contentType =
        response.headers.get("content-type") ||
        expectedMime ||
        "application/octet-stream";

      if (!contentType.toLowerCase().startsWith("image/")) {
        throw Object.assign(
          new Error("The selected Media item is not an image."),
          { status: 400 },
        );
      }

      return new Response(bytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "no-store",
          "X-Wakilisha-Source-Asset-Id": assetId,
          "X-Wakilisha-Source-Mode": sourceMode,
        },
      });
    }

    return json(400, { error: "Unknown Playlist product action." });
  } catch (reason) {
    const status =
      typeof reason === "object" &&
      reason !== null &&
      "status" in reason
        ? Number((reason as { status: unknown }).status) || 500
        : 500;
    const message =
      reason instanceof Error
        ? reason.message
        : "Playlist product request failed.";
    return json(status, { error: message });
  }
});
