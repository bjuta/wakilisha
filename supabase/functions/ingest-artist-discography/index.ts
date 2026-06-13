// ingest-artist-discography
// Searches Apple Music for albums by an artist, fetches full album details
// with tracks, and upserts into registry_releases, registry_tracks,
// registry_release_tracks, registry_release_artists, registry_track_artists.
//
// Input: { artistSlug: string }
// Output: { ok, summary, releases_created, tracks_created, ... }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SignJWT } from "https://esm.sh/jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function parseReleaseTypeFromApple(attrs: Record<string, unknown>): string {
  const isSingle = attrs.isSingle === true;
  const isComplete = attrs.isComplete === true;
  const trackCount = Number(attrs.trackCount ?? 0);
  const name = String(attrs.name ?? "").toLowerCase();

  if (name.includes("ep") || (trackCount >= 2 && trackCount <= 8 && !isComplete)) return "ep";
  if (isSingle || trackCount === 1) return "single";
  return "album";
}

function parseDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s === "0000-00-00") return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function dedupeSlug(base: string, seen: Set<string>): string {
  if (!seen.has(base)) {
    seen.add(base);
    return base;
  }
  let i = 2;
  while (seen.has(`${base}-${i}`)) i++;
  const s = `${base}-${i}`;
  seen.add(s);
  return s;
}

function artworkUrl(urlTemplate: string, width: number): string {
  return urlTemplate.replace("{w}", String(width)).replace("{h}", String(width));
}

// ── Apple Music JWT ─────────────────────────────────────────────────────────

async function createAppleMusicToken(
  teamId: string,
  keyId: string,
  privateKeyRaw: string
): Promise<string> {
  const key = privateKeyRaw
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(cryptoKey);

  return token;
}

// ── Credential reader ───────────────────────────────────────────────────────

async function readCredential(
  db: ReturnType<typeof createClient>,
  key: string
): Promise<string | null> {
  const { data, error } = await db
    .from("admin_settings_secrets")
    .select("setting_value")
    .eq("setting_key", key)
    .maybeSingle();

  if (error) {
    console.error(`[ingest-discography] readCredential(${key}) error:`, error.message);
  }

  if (data?.setting_value?.trim()) return data.setting_value.trim();

  const envVal = Deno.env.get(key.toUpperCase());
  return envVal?.trim() || null;
}

// ── Apple Music API Helpers ─────────────────────────────────────────────────

interface AppleAlbumSearchResult {
  id: string;
  type: string;
  attributes: {
    name: string;
    artistName: string;
    artwork?: { url: string; width: number; height: number };
    releaseDate?: string;
    trackCount?: number;
    isSingle?: boolean;
    isComplete?: boolean;
    upc?: string;
    genreNames?: string[];
    url?: string;
  };
}

interface AppleTrackAttributes {
  name: string;
  artistName: string;
  durationInMillis?: number;
  trackNumber?: number;
  discNumber?: number;
  isrc?: string;
  artwork?: { url: string; width: number; height: number };
  contentRating?: string;
  previews?: Array<{ url: string }>;
}

interface AppleAlbumDetail {
  id: string;
  type: string;
  attributes: {
    name: string;
    artistName: string;
    artwork?: { url: string; width: number; height: number };
    releaseDate?: string;
    trackCount?: number;
    isSingle?: boolean;
    isComplete?: boolean;
    upc?: string;
    genreNames?: string[];
    url?: string;
  };
  relationships?: {
    tracks?: {
      data: Array<{
        id: string;
        type: string;
        attributes: AppleTrackAttributes;
      }>;
    };
  };
}

async function searchAlbums(
  token: string,
  storefront: string,
  artistName: string,
  limit = 50
): Promise<AppleAlbumSearchResult[]> {
  const allAlbums: AppleAlbumSearchResult[] = [];
  let offset = 0;
  const pageSize = 25;

  while (offset < limit) {
    const fetchLimit = Math.min(pageSize, limit - offset);
    const url = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(artistName)}&types=albums&limit=${fetchLimit}&offset=${offset}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(
        `[ingest-discography] Apple Music search failed: ${res.status} ${errText.slice(0, 200)}`
      );
      break;
    }

    const data = await res.json();
    const albums = data?.results?.albums?.data ?? [];
    if (albums.length === 0) break;

    allAlbums.push(...albums);
    offset += fetchLimit;
    if (albums.length < fetchLimit) break;
  }

  return allAlbums;
}

async function fetchAlbumDetail(
  token: string,
  storefront: string,
  albumId: string
): Promise<AppleAlbumDetail | null> {
  const url = `https://api.music.apple.com/v1/catalog/${storefront}/albums/${albumId}?include=tracks`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(
      `[ingest-discography] fetch album ${albumId} failed: ${res.status} ${errText.slice(0, 200)}`
    );
    return null;
  }

  const json = await res.json();
  const albumData = json?.data?.[0] ?? json?.data ?? null;
  return albumData;
}

async function fetchAlbumsInParallel(
  token: string,
  storefront: string,
  albumIds: string[],
  concurrency = 8
): Promise<{ detail: AppleAlbumDetail; id: string }[]> {
  const results: { detail: AppleAlbumDetail; id: string }[] = [];
  const queue = [...albumIds];

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      const detail = await fetchAlbumDetail(token, storefront, id);
      if (detail) {
        results.push({ detail, id });
      }
    }
  }

  // Run N workers in parallel
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return results;
}

// ── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY") ??
      "";
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "Supabase config missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const db = createClient(supabaseUrl, supabaseKey);

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_json" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const artistSlug = String(body.artistSlug ?? "").trim();
    if (!artistSlug) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing artistSlug" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Read Apple Music credentials ──────────────────────────────────────
    const [teamId, keyId, privateKey, storefrontRaw] = await Promise.all([
      readCredential(db, "apple_music_team_id"),
      readCredential(db, "apple_music_key_id"),
      readCredential(db, "apple_music_private_key"),
      readCredential(db, "apple_music_storefront"),
    ]);
    const storefront = storefrontRaw || "ke";

    if (!teamId || !keyId || !privateKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Apple Music credentials not configured. Set apple_music_team_id, apple_music_key_id, and apple_music_private_key.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Look up the artist in registry_artists ────────────────────────────
    const { data: artistRow, error: artistErr } = await db
      .from("registry_artists")
      .select("id, slug, display_name, metadata")
      .eq("slug", artistSlug)
      .maybeSingle();

    if (artistErr || !artistRow) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Artist not found: ${artistSlug}`,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const artistId = artistRow.id as string;
    const artistName = artistRow.display_name as string;
    const artistMeta = (artistRow.metadata ?? {}) as Record<string, unknown>;

    // ── Generate Apple Music developer token ──────────────────────────────
    let token: string;
    try {
      token = await createAppleMusicToken(teamId, keyId, privateKey);
    } catch (err) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Failed to create Apple Music JWT: ${err instanceof Error ? err.message : String(err)}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Search Apple Music for albums ─────────────────────────────────────
    console.log(`[ingest-discography] Searching Apple Music for: "${artistName}"`);
    const searchResults = await searchAlbums(token, storefront, artistName, 50);

    if (searchResults.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: `No albums found on Apple Music for "${artistName}"`,
          releases_created: 0,
          tracks_created: 0,
          albums_searched: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[ingest-discography] Found ${searchResults.length} album search results`
    );

    // ── Filter to albums where artistName matches ─────────────────────────
    const artistNameLower = artistName.toLowerCase();
    const matchingAlbums = searchResults.filter((a) => {
      const albumArtist = (a.attributes?.artistName ?? "").toLowerCase();
      return albumArtist.includes(artistNameLower) || artistNameLower.includes(albumArtist);
    });

    console.log(
      `[ingest-discography] ${matchingAlbums.length} albums match artist name, fetching details in parallel...`
    );

    // ── Fetch full details for matching albums IN PARALLEL (8 concurrent) ──
    const albumIds = matchingAlbums.map((a) => a.id);
    const fetchedResults = await fetchAlbumsInParallel(token, storefront, albumIds, 8);
    const albumDetails = fetchedResults.map((r) => r.detail);
    const failedIds = albumIds.filter((id) => !fetchedResults.find((r) => r.id === id));

    console.log(
      `[ingest-discography] Fetched ${albumDetails.length} album details, ${failedIds.length} failed (${Date.now() - start}ms elapsed)`
    );

    if (albumDetails.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: `Found ${matchingAlbums.length} album results but failed to fetch details for all of them.`,
          releases_created: 0,
          tracks_created: 0,
          albums_searched: matchingAlbums.length,
          albums_failed: failedIds,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Load existing registry data to avoid duplicates ───────────────────
    const [existingReleasesRes, existingTracksRes] = await Promise.all([
      db.from("registry_releases").select("id, slug").eq("status", "active"),
      db.from("registry_tracks").select("id, slug, isrc").eq("status", "active"),
    ]);

    const existingReleaseSlugs = new Set(
      (existingReleasesRes.data ?? []).map((r: { slug: string }) => r.slug)
    );
    const seenReleaseSlugs = new Set(existingReleaseSlugs);

    const existingTrackBySlug = new Map(
      (existingTracksRes.data ?? []).map((t: { id: string; slug: string }) => [t.slug, t.id])
    );
    const existingTrackByIsrc = new Map(
      (existingTracksRes.data ?? [])
        .filter((t: { isrc: string | null }) => t.isrc)
        .map((t: { id: string; isrc: string }) => [t.isrc, t.id])
    );
    const seenTrackSlugs = new Set(existingTrackBySlug.keys());

    console.log(
      `[ingest-discography] Loaded ${existingReleaseSlugs.size} release slugs, ${existingTrackBySlug.size} track slugs (${Date.now() - start}ms elapsed)`
    );

    // ── Build insert batches ──────────────────────────────────────────────
    const releaseRows: Record<string, unknown>[] = [];
    const releaseArtistRows: Record<string, unknown>[] = [];
    const trackRows: Record<string, unknown>[] = [];
    const releaseTrackRows: Record<string, unknown>[] = [];
    const trackArtistRows: Record<string, unknown>[] = [];

    const albumIdToReleaseId = new Map<string, string>();

    for (const album of albumDetails) {
      const attrs = album.attributes ?? {};
      const rawTitle = attrs.name ?? "Unknown Album";
      const rawSlug = slugify(rawTitle);
      const releaseSlug = dedupeSlug(rawSlug, seenReleaseSlugs);
      const releaseType = parseReleaseTypeFromApple(attrs);
      const releaseDate = parseDate(attrs.releaseDate ?? null);
      const upc = attrs.upc ? String(attrs.upc) : null;
      const releaseId = crypto.randomUUID();

      albumIdToReleaseId.set(album.id, releaseId);

      let awUrl: string | null = null;
      if (attrs.artwork?.url) {
        awUrl = artworkUrl(attrs.artwork.url, 800);
      }

      releaseRows.push({
        id: releaseId,
        slug: releaseSlug,
        title: rawTitle,
        normalized_title: slugify(rawTitle).replace(/-/g, " "),
        release_type: releaseType,
        upc,
        release_date: releaseDate,
        artwork_url: awUrl,
        status: "active",
        metadata: {
          apple_music_album_id: album.id,
          apple_music_url: attrs.url ?? null,
          genre_names: attrs.genreNames ?? [],
          source: "apple_music_ingest",
        },
      });

      releaseArtistRows.push({
        release_id: releaseId,
        artist_id: artistId,
        artist_slug: artistSlug,
        artist_name_text: artistName,
        role: "primary_artist",
        is_primary: true,
        is_featured: false,
        credit_order: 1,
        source: "apple_music_ingest",
        confidence: 90,
        status: "active",
        metadata: { apple_music_album_id: album.id },
      });

      const tracksData = album.relationships?.tracks?.data ?? [];
      for (const track of tracksData) {
        const tAttrs = track.attributes ?? {};
        const trackTitle = tAttrs.name ?? "Untitled";
        const trackIsrc = tAttrs.isrc ? String(tAttrs.isrc).trim() : null;
        const rawTrackSlug = slugify(trackTitle);
        const discNum = tAttrs.discNumber ?? 1;
        const trackNum = tAttrs.trackNumber ?? null;
        const durationMs = tAttrs.durationInMillis ?? null;
        const explicit = (tAttrs.contentRating ?? "") === "explicit";

        let trackId: string | undefined;
        if (trackIsrc) trackId = existingTrackByIsrc.get(trackIsrc);
        if (!trackId) trackId = existingTrackBySlug.get(rawTrackSlug);

        if (!trackId) {
          trackId = crypto.randomUUID();
          const trackSlug = dedupeSlug(rawTrackSlug, seenTrackSlugs);
          existingTrackBySlug.set(trackSlug, trackId);
          if (trackIsrc) existingTrackByIsrc.set(trackIsrc, trackId);
          seenTrackSlugs.add(trackSlug);

          let trackAwUrl: string | null = null;
          if (tAttrs.artwork?.url) {
            trackAwUrl = artworkUrl(tAttrs.artwork.url, 800);
          } else {
            trackAwUrl = awUrl;
          }

          const previewUrl =
            tAttrs.previews && tAttrs.previews.length > 0
              ? tAttrs.previews[0].url
              : null;

          trackRows.push({
            id: trackId,
            slug: trackSlug,
            title: trackTitle,
            normalized_title: slugify(trackTitle).replace(/-/g, " "),
            isrc: trackIsrc,
            release_id: releaseId,
            duration_ms: durationMs,
            explicit,
            track_number: trackNum,
            disc_number: discNum,
            artwork_url: trackAwUrl,
            preview_url: previewUrl,
            status: "active",
            metadata: {
              apple_music_track_id: track.id,
              apple_music_album_id: album.id,
              source: "apple_music_ingest",
            },
          });
        }

        releaseTrackRows.push({
          release_id: releaseId,
          track_id: trackId!,
          disc_number: discNum,
          track_number: trackNum,
          source: "apple_music_ingest",
          confidence: 90,
          status: "active",
          metadata: {
            apple_music_track_id: track.id,
            apple_music_album_id: album.id,
          },
        });

        trackArtistRows.push({
          track_id: trackId!,
          artist_id: artistId,
          artist_slug: artistSlug,
          artist_name_text: artistName,
          role: "primary_artist",
          is_primary: true,
          is_featured: false,
          credit_order: 1,
          source: "apple_music_ingest",
          confidence: 90,
          status: "active",
          metadata: {
            apple_music_track_id: track.id,
            apple_music_album_id: album.id,
          },
        });
      }
    }

    console.log(
      `[ingest-discography] Built ${releaseRows.length} releases, ${trackRows.length} tracks, ${releaseTrackRows.length} release-track links, ${releaseArtistRows.length} release-artist links, ${trackArtistRows.length} track-artist links (${Date.now() - start}ms elapsed)`
    );

    // ── Commit to database (parallelized where possible) ──────────────────
    const BATCH = 200;
    const summary = {
      releases_created: 0,
      releases_skipped: 0,
      tracks_created: 0,
      tracks_skipped: 0,
      release_artist_links: 0,
      release_track_links: 0,
      track_artist_links: 0,
      errors: [] as string[],
    };

    function chunk<T>(arr: T[], size: number): T[][] {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    }

    // Upsert releases and tracks in parallel
    const writePromises: Promise<void>[] = [];

    if (releaseRows.length > 0) {
      for (const batch of chunk(releaseRows, BATCH)) {
        writePromises.push(
          (async () => {
            const { error } = await db
              .from("registry_releases")
              .upsert(batch, { onConflict: "slug", ignoreDuplicates: true });
            if (error) summary.errors.push(`releases: ${error.message}`);
          })()
        );
      }
      summary.releases_created = releaseRows.length;
    }

    if (trackRows.length > 0) {
      for (const batch of chunk(trackRows, BATCH)) {
        writePromises.push(
          (async () => {
            const { error } = await db
              .from("registry_tracks")
              .upsert(batch, { onConflict: "slug", ignoreDuplicates: true });
            if (error) summary.errors.push(`tracks: ${error.message}`);
          })()
        );
      }
      summary.tracks_created = trackRows.length;
    }

    await Promise.all(writePromises);

    console.log(
      `[ingest-discography] Releases + tracks upserted (${Date.now() - start}ms elapsed)`
    );

    // Now handle link tables — delete first, then insert
    const linkWritePromises: Promise<void>[] = [];

    if (releaseArtistRows.length > 0) {
      const releaseIds = [...new Set(releaseArtistRows.map((r) => String(r.release_id)))];
      linkWritePromises.push(
        (async () => {
          for (const idChunk of chunk(releaseIds, 100)) {
            await db
              .from("registry_release_artists")
              .delete()
              .in("release_id", idChunk)
              .eq("source", "apple_music_ingest");
          }
          for (const batch of chunk(releaseArtistRows, BATCH)) {
            const { error } = await db
              .from("registry_release_artists")
              .insert(batch);
            if (error) summary.errors.push(`release_artists: ${error.message}`);
          }
        })()
      );
      summary.release_artist_links = releaseArtistRows.length;
    }

    if (releaseTrackRows.length > 0) {
      const releaseIds = [...new Set(releaseTrackRows.map((r) => String(r.release_id)))];
      linkWritePromises.push(
        (async () => {
          for (const idChunk of chunk(releaseIds, 100)) {
            await db
              .from("registry_release_tracks")
              .delete()
              .in("release_id", idChunk)
              .eq("source", "apple_music_ingest");
          }
          for (const batch of chunk(releaseTrackRows, BATCH)) {
            const { error } = await db
              .from("registry_release_tracks")
              .insert(batch);
            if (error) summary.errors.push(`release_tracks: ${error.message}`);
          }
        })()
      );
      summary.release_track_links = releaseTrackRows.length;
    }

    if (trackArtistRows.length > 0) {
      const trackIds = [...new Set(trackArtistRows.map((r) => String(r.track_id)))];
      linkWritePromises.push(
        (async () => {
          for (const idChunk of chunk(trackIds, 100)) {
            await db
              .from("registry_track_artists")
              .delete()
              .in("track_id", idChunk)
              .eq("source", "apple_music_ingest");
          }
          for (const batch of chunk(trackArtistRows, BATCH)) {
            const { error } = await db
              .from("registry_track_artists")
              .insert(batch);
            if (error) summary.errors.push(`track_artists: ${error.message}`);
          }
        })()
      );
      summary.track_artist_links = trackArtistRows.length;
    }

    await Promise.all(linkWritePromises);

    console.log(
      `[ingest-discography] Link tables written (${Date.now() - start}ms elapsed)`
    );

    // ── Update artist metadata ────────────────────────────────────────────
    const appleAlbumIds = albumDetails.map((a) => a.id);
    const updatedMeta = {
      ...artistMeta,
      apple_music_album_ids: appleAlbumIds,
      apple_music_discography_ingested_at: new Date().toISOString(),
    };

    await db
      .from("registry_artists")
      .update({
        metadata: updatedMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", artistId);

    const durationMs = Date.now() - start;

    return new Response(
      JSON.stringify({
        ok: true,
        artist: { id: artistId, slug: artistSlug, name: artistName },
        albums_searched: matchingAlbums.length,
        albums_fetched: albumDetails.length,
        albums_failed: failedIds,
        summary,
        duration_ms: durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ingest-discography] fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: "internal_error", detail: msg.slice(0, 300) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
