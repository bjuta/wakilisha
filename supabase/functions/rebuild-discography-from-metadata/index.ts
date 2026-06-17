
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const REBUILD_SOURCE = "metadata_rebuild_v3";
const ORPHAN_CHUNK_SIZE = 200;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function parseDurationToMs(duration: string): number | null {
  if (!duration || duration.trim() === "") return null;
  const parts = duration.split(":").map(Number);
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
}

function parseReleaseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function parseFeaturedFromTitle(title: string): string[] {
  if (!title) return [];
  const featured: string[] = [];
  const seen = new Set<string>();

  function addNames(inner: string) {
    const names = inner.split(/\s*[,&]\s*|\s+and\s+/i).map(s => s.trim()).filter(Boolean);
    for (const n of names) {
      const key = n.toLowerCase();
      if (!seen.has(key)) { seen.add(key); featured.push(n); }
    }
  }

  // Parentheses: (feat. X), (ft. X), (featuring X), (with X), (w/ X)
  const parenMatch = title.match(/\((?:feat\.?|ft\.?|featuring|with|w\/)\s+([^)]+)\)/i);
  if (parenMatch) addNames(parenMatch[1]);

  // Square brackets: [feat. X], [ft. X], [featuring X], [with X], [w/ X]
  const bracketMatch = title.match(/\[(?:feat\.?|ft\.?|featuring|with|w\/)\s+([^\]]+)\]/i);
  if (bracketMatch) addNames(bracketMatch[1]);

  // Dash / em-dash / en-dash: — feat. X, - ft. X, — featuring X, — with X
  const dashMatch = title.match(/\s[-\u2013\u2014]\s*(?:feat\.?|ft\.?|featuring|with|w\/)\s+(.+)$/i);
  if (dashMatch) addNames(dashMatch[1]);

  // x collaboration: "Song x Artist2" (colloquial collab marker)
  const xMatch = title.match(/\s+x\s+([A-Z][^,(\[]+?)(?:\s*[,&]\s*[A-Z][^,(\[]+?)*)\s*$/i);
  if (!xMatch) {
    const xMatch2 = title.match(/\s+x\s+([A-Z][^,(\[]+)$/i);
    if (xMatch2) addNames(xMatch2[1]);
  } else {
    addNames(xMatch[1]);
  }

  // + collaboration: "Song + Artist2"
  const plusMatch = title.match(/\s+\+\s+([A-Z][^,(\[]+?)(?:\s*[,&]\s*[A-Z][^,(\[]+?)*)\s*$/i);
  if (!plusMatch) {
    const plusMatch2 = title.match(/\s+\+\s+([A-Z][^,(\[]+)$/i);
    if (plusMatch2) addNames(plusMatch2[1]);
  } else {
    addNames(plusMatch[1]);
  }

  return featured;
}

function makeTrackSlug(artistSlug: string, trackTitle: string): string {
  return `${artistSlug}--${slugify(trackTitle)}`;
}

function makeReleaseSlug(artistSlug: string, albumTitle: string): string {
  return `${artistSlug}--${slugify(albumTitle)}`;
}

interface AlbumEntry {
  year?: string;
  image?: string;
  title: string;
  tracks: Array<{ title: string; duration?: string }>;
  track_count?: number;
  release_date?: string;
}

interface TopSongEntry {
  title: string;
  artists?: string;
  artwork?: string;
  duration?: string;
  song_url?: string;
}

function getEnvInt(name: string, defaultValue: number): number {
  const val = Deno.env.get(name);
  return val ? parseInt(val, 10) : defaultValue;
}

function getArtistBatchSize(): number {
  return getEnvInt("REBUILD_ARTIST_BATCH_SIZE", 20);
}

function getOrphanDeleteBatchSize(): number {
  return getEnvInt("REBUILD_ORPHAN_CHUNK_SIZE", ORPHAN_CHUNK_SIZE);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const batch = parseInt(url.searchParams.get("batch") || "0");
  const doCleanup = url.searchParams.get("cleanup") === "true";
  const batchSize = getArtistBatchSize();
  const offset = batch * batchSize;

  const steps: string[] = [];
  const errors: string[] = [];

  try {
    // ================= STEP 1: Preview URL cache =================
    steps.push("Building preview URL cache...");
    const previewCache: Record<string, string> = {};
    const { data: previewTracks, error: ptErr } = await supabase
      .from("registry_tracks")
      .select("id, title, preview_url")
      .not("preview_url", "is", null);

    if (ptErr) {
      errors.push(`Preview cache error: ${ptErr.message}`);
    } else if (previewTracks) {
      const trackIds = previewTracks.map((t) => t.id);
      const { data: taLinks } = await supabase
        .from("registry_track_artists")
        .select("track_id, artist_slug")
        .in("track_id", trackIds);

      if (taLinks) {
        const linkMap: Record<string, string[]> = {};
        for (const l of taLinks) {
          if (!linkMap[l.track_id]) linkMap[l.track_id] = [];
          linkMap[l.track_id].push(l.artist_slug);
        }
        for (const t of previewTracks) {
          const artists = linkMap[t.id] || [];
          for (const slug of artists) {
            const key = `${slug}||${t.title.toLowerCase().trim()}`;
            if (t.preview_url && !previewCache[key]) {
              previewCache[key] = t.preview_url;
            }
          }
        }
      }
    }
    steps.push(`Cached ${Object.keys(previewCache).length} preview URLs`);

    // ================= STEP 2: Orphan cleanup (only batch 0, only if requested) =================
    let totalOrphansDeleted = 0;
    if (batch === 0 && doCleanup) {
      steps.push("Cleaning orphaned tracks...");
      const { data: allLinked } = await supabase
        .from("registry_track_artists")
        .select("track_id");
      const linkedIds = new Set((allLinked || []).map((r) => r.track_id));

      const { data: allTracks, error: atErr } = await supabase
        .from("registry_tracks")
        .select("id");

      if (atErr) {
        errors.push(`Orphan scan error: ${atErr.message}`);
      } else {
        const orphanIds = (allTracks || []).filter((t) => !linkedIds.has(t.id)).map((t) => t.id);
        const chunkSize = getOrphanDeleteBatchSize();
        steps.push(`Found ${orphanIds.length} orphans, deleting in chunks of ${chunkSize}`);

        for (let i = 0; i < orphanIds.length; i += chunkSize) {
          const chunk = orphanIds.slice(i, i + chunkSize);
          await supabase.from("registry_release_tracks").delete().in("track_id", chunk);
          const { error: chunkErr } = await supabase
            .from("registry_tracks")
            .delete()
            .in("id", chunk);

          if (chunkErr) {
            errors.push(`Orphan chunk ${Math.floor(i / chunkSize) + 1} error: ${chunkErr.message}`);
          } else {
            totalOrphansDeleted += chunk.length;
          }
        }
        steps.push(`Deleted ${totalOrphansDeleted} orphaned tracks`);
      }
    }

    // ================= STEP 3: Pre-fetch active release titles =================
    const { data: activeReleases } = await supabase
      .from("registry_releases")
      .select("title, slug")
      .eq("status", "active");

    const activeTitleOwners = new Map<string, string>();
    if (activeReleases) {
      for (const r of activeReleases) {
        const nt = r.title.toLowerCase().trim();
        if (!activeTitleOwners.has(nt)) activeTitleOwners.set(nt, r.slug);
      }
    }

    // ================= Pre-load ALL active artists for featured artist resolution =================
    steps.push("Pre-loading all active artists for featured artist resolution...");
    const { data: allRegistryArtists } = await supabase
      .from("registry_artists")
      .select("id, slug, display_name")
      .eq("status", "active");
    const artistByName = new Map<string, { id: string; slug: string; display_name: string }>();
    const artistBySlug = new Map<string, { id: string; slug: string; display_name: string }>();
    for (const a of (allRegistryArtists ?? [])) {
      const nameKey = ((a.display_name as string) || "").toLowerCase().trim();
      if (nameKey && !artistByName.has(nameKey)) artistByName.set(nameKey, a as any);
      artistBySlug.set(a.slug as string, a as any);
    }
    steps.push(`Loaded ${artistByName.size} artists by name, ${artistBySlug.size} by slug`);

    // ================= STEP 4: Fetch this batch of artists =================
    steps.push(`Fetching artist batch ${batch} (offset ${offset}, size ${batchSize})...`);
    const { data: artists, error: artistErr } = await supabase
      .from("registry_artists")
      .select("id, slug, display_name, metadata")
      .not("metadata", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (artistErr) throw new Error(`Failed to fetch artists: ${artistErr.message}`);
    if (!artists || artists.length === 0) {
      return new Response(
        JSON.stringify({ success: true, done: true, steps, errors: errors.slice(0, 10) }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    steps.push(`Processing ${artists.length} artists in this batch`);

    // ================= STEP 5: Collect all data =================
    const trackRows: Record<string, unknown>[] = [];
    const releaseRows: Record<string, unknown>[] = [];
    let titleCollisions = 0;
    let albumsProcessed = 0;
    let topSongsProcessed = 0;
    let featLinksCollected = 0;

    const trackSlugToArtist: Record<string, { artistId: string; artistSlug: string; artistName: string }> = {};
    const trackSlugToRelease: Record<string, { releaseSlug: string; trackNumber: number }> = {};
    const releaseSlugToArtist: Record<string, { artistId: string; artistSlug: string; artistName: string }> = {};

    // Collect featured artist rows during data collection
    const featTrackArtistRows: Record<string, unknown>[] = [];

    for (const artist of artists) {
      const metadata = artist.metadata as Record<string, unknown> | null;
      if (!metadata) continue;
      const artistSlug = artist.slug;
      const artistId = artist.id;
      const artistName = artist.display_name;

      const studioAlbums = (metadata.studio_albums || metadata.albums || []) as AlbumEntry[];
      const epsCompilations = (metadata.eps_compilations || []) as AlbumEntry[];
      const allAlbums = [
        ...(Array.isArray(studioAlbums) ? studioAlbums : []),
        ...(Array.isArray(epsCompilations) ? epsCompilations : []),
      ];

      for (const album of allAlbums) {
        if (!album.title || !Array.isArray(album.tracks) || album.tracks.length === 0) continue;

        const releaseSlug = makeReleaseSlug(artistSlug, album.title);
        const releaseDate = parseReleaseDate(album.release_date || album.year || "");
        const artworkUrl = album.image || null;
        const normalizedTitle = album.title.toLowerCase().trim();

        const existingOwner = activeTitleOwners.get(normalizedTitle);
        const hasCollision = existingOwner && existingOwner !== releaseSlug;
        const releaseStatus = hasCollision ? "draft" : "active";
        if (hasCollision) titleCollisions++;
        if (!hasCollision && releaseStatus === "active") {
          activeTitleOwners.set(normalizedTitle, releaseSlug);
        }

        releaseRows.push({
          slug: releaseSlug,
          title: album.title,
          normalized_title: normalizedTitle,
          release_type: "album",
          release_date: releaseDate,
          release_date_precision: releaseDate ? "day" : null,
          artwork_url: artworkUrl,
          status: releaseStatus,
          metadata: { source: REBUILD_SOURCE, original_album_data: album },
        });

        releaseSlugToArtist[releaseSlug] = { artistId, artistSlug, artistName };

        for (let idx = 0; idx < album.tracks.length; idx++) {
          const track = album.tracks[idx];
          if (!track.title) continue;
          const trackSlug = makeTrackSlug(artistSlug, track.title);
          const durationMs = parseDurationToMs(track.duration || "");
          const cacheKey = `${artistSlug}||${track.title.toLowerCase().trim()}`;
          const previewUrl = previewCache[cacheKey] || null;

          trackRows.push({
            slug: trackSlug,
            title: track.title,
            normalized_title: track.title.toLowerCase().trim(),
            duration_ms: durationMs,
            track_number: idx + 1,
            disc_number: 1,
            preview_url: previewUrl,
            status: "active",
            metadata: { source: REBUILD_SOURCE },
          });

          trackSlugToArtist[trackSlug] = { artistId, artistSlug, artistName };
          trackSlugToRelease[trackSlug] = { releaseSlug, trackNumber: idx + 1 };
          albumsProcessed++;

          // Parse featured artists from track title
          const featNames = parseFeaturedFromTitle(track.title);
          const primaryNameKey = (artistName as string).toLowerCase().trim();
          for (let fi = 0; fi < featNames.length; fi++) {
            const featName = featNames[fi];
            const featNameKey = featName.toLowerCase().trim();
            const featSlug = slugify(featName);
            if (featNameKey === primaryNameKey || featSlug === artistSlug) continue;

            const matchedArtist = artistByName.get(featNameKey) || artistBySlug.get(featSlug);
            featTrackArtistRows.push({
              track_id: null, // Will be resolved after track insert
              track_slug: trackSlug,
              artist_id: matchedArtist?.id ?? null,
              artist_slug: matchedArtist?.slug ?? featSlug,
              artist_name_text: matchedArtist?.display_name ?? featName,
              role: "featured_artist",
              is_primary: false,
              is_featured: true,
              credit_order: 2 + fi,
              source: REBUILD_SOURCE,
              confidence: matchedArtist ? 80 : 45,
              status: "active",
              metadata: { resolved_by: matchedArtist ? "name_match" : "text_only" },
            });
            featLinksCollected++;
          }
        }
      }

      // Top songs
      const topSongs = metadata.top_songs as TopSongEntry[] | undefined;
      if (Array.isArray(topSongs) && topSongs.length > 0) {
        for (const song of topSongs) {
          if (!song.title) continue;
          const trackSlug = makeTrackSlug(artistSlug, song.title);
          const durationMs = parseDurationToMs(song.duration || "");
          const cacheKey = `${artistSlug}||${song.title.toLowerCase().trim()}`;
          const previewUrl = previewCache[cacheKey] || song.song_url || null;

          trackRows.push({
            slug: trackSlug,
            title: song.title,
            normalized_title: song.title.toLowerCase().trim(),
            duration_ms: durationMs,
            track_number: 1,
            disc_number: 1,
            artwork_url: song.artwork || null,
            preview_url: previewUrl,
            status: "active",
            metadata: { source: REBUILD_SOURCE, is_top_song: true },
          });

          trackSlugToArtist[trackSlug] = { artistId, artistSlug, artistName };
          topSongsProcessed++;

          // Parse featured artists from top song title
          const featNames = parseFeaturedFromTitle(song.title);
          const primaryNameKey = (artistName as string).toLowerCase().trim();
          for (let fi = 0; fi < featNames.length; fi++) {
            const featName = featNames[fi];
            const featNameKey = featName.toLowerCase().trim();
            const featSlug = slugify(featName);
            if (featNameKey === primaryNameKey || featSlug === artistSlug) continue;

            const matchedArtist = artistByName.get(featNameKey) || artistBySlug.get(featSlug);
            featTrackArtistRows.push({
              track_id: null,
              track_slug: trackSlug,
              artist_id: matchedArtist?.id ?? null,
              artist_slug: matchedArtist?.slug ?? featSlug,
              artist_name_text: matchedArtist?.display_name ?? featName,
              role: "featured_artist",
              is_primary: false,
              is_featured: true,
              credit_order: 2 + fi,
              source: REBUILD_SOURCE,
              confidence: matchedArtist ? 80 : 45,
              status: "active",
              metadata: { resolved_by: matchedArtist ? "name_match" : "text_only" },
            });
            featLinksCollected++;
          }
        }
      }
    }
    steps.push(`Collected ${featLinksCollected} potential featured artist links`);

    // DEDUPLICATE tracks by slug to avoid "ON CONFLICT DO UPDATE cannot affect row a second time"
    const uniqueTracks = new Map<string, Record<string, unknown>>();
    for (const t of trackRows) {
      uniqueTracks.set(t.slug as string, t);
    }
    const tracksToInsert = Array.from(uniqueTracks.values());

    // ================= STEP 6: Batch insert tracks =================
    let trackIdMap: Record<string, string> = {};
    if (tracksToInsert.length > 0) {
      const { data: insertedTracks, error: tErr } = await supabase
        .from("registry_tracks")
        .upsert(tracksToInsert, { onConflict: "slug" })
        .select("id, slug");

      if (tErr) {
        errors.push(`Batch track insert failed: ${tErr.message}`);
      } else if (insertedTracks) {
        for (const t of insertedTracks) {
          trackIdMap[t.slug] = t.id;
        }
      }
    }
    steps.push(`Inserted ${tracksToInsert.length} tracks, resolved ${Object.keys(trackIdMap).length} IDs`);

    // ================= STEP 7: Batch insert releases =================
    let releaseIdMap: Record<string, string> = {};
    if (releaseRows.length > 0) {
      const { data: insertedReleases, error: rErr } = await supabase
        .from("registry_releases")
        .upsert(releaseRows, { onConflict: "slug" })
        .select("id, slug");

      if (rErr) {
        errors.push(`Batch release insert failed: ${rErr.message}`);
      } else if (insertedReleases) {
        for (const r of insertedReleases) {
          releaseIdMap[r.slug] = r.id;
        }
      }
    }
    steps.push(`Inserted ${releaseRows.length} releases, resolved ${Object.keys(releaseIdMap).length} IDs`);

    // ================= STEP 8: Resolve and INSERT link rows (ignore duplicates) =================
    // Track-artist links (primary artists)
    const trackArtistRows: Record<string, unknown>[] = [];
    for (const slug of Object.keys(trackSlugToArtist)) {
      const trackId = trackIdMap[slug];
      const meta = trackSlugToArtist[slug];
      if (trackId && meta) {
        trackArtistRows.push({
          track_id: trackId,
          artist_id: meta.artistId,
          artist_slug: meta.artistSlug,
          artist_name_text: meta.artistName,
          role: "primary",
          is_primary: true,
          is_featured: false,
          credit_order: 0,
          source: REBUILD_SOURCE,
          confidence: 100,
          status: "active",
          metadata: {},
        });
      }
    }

    // Resolve featured artist rows — fill in track_id from trackIdMap
    const resolvedFeatRows: Record<string, unknown>[] = [];
    for (const fr of featTrackArtistRows) {
      const trackId = trackIdMap[fr.track_slug as string];
      if (trackId) {
        const { track_slug, ...rest } = fr;
        resolvedFeatRows.push({ ...rest, track_id: trackId });
      }
    }

    let trackArtistLinksCreated = 0;
    if (trackArtistRows.length > 0) {
      const { data: taInserted, error: taErr } = await supabase
        .from("registry_track_artists")
        .insert(trackArtistRows)
        .select("id");

      if (taErr && !taErr.message.includes("duplicate")) {
        errors.push(`Track-artist insert failed: ${taErr.message}`);
      } else if (taInserted) {
        trackArtistLinksCreated = taInserted.length;
      }
    }

    // Insert featured artist links
    let featArtistLinksCreated = 0;
    if (resolvedFeatRows.length > 0) {
      const { data: feInserted, error: feErr } = await supabase
        .from("registry_track_artists")
        .insert(resolvedFeatRows)
        .select("id");

      if (feErr && !feErr.message.includes("duplicate")) {
        errors.push(`Featured track-artist insert failed: ${feErr.message}`);
      } else if (feInserted) {
        featArtistLinksCreated = feInserted.length;
      }
    }
    steps.push(`Featured artist links created: ${featArtistLinksCreated}`);

    // Release-track links
    const releaseTrackRows: Record<string, unknown>[] = [];
    for (const trackSlug of Object.keys(trackSlugToRelease)) {
      const trackId = trackIdMap[trackSlug];
      const relMeta = trackSlugToRelease[trackSlug];
      const releaseId = releaseIdMap[relMeta.releaseSlug];
      if (trackId && releaseId) {
        releaseTrackRows.push({
          release_id: releaseId,
          track_id: trackId,
          disc_number: 1,
          track_number: relMeta.trackNumber,
          source: REBUILD_SOURCE,
          confidence: 100,
          status: "active",
          metadata: {},
        });
      }
    }

    let releaseTrackLinksCreated = 0;
    if (releaseTrackRows.length > 0) {
      const { data: rtInserted, error: rtErr } = await supabase
        .from("registry_release_tracks")
        .insert(releaseTrackRows)
        .select("id");

      if (rtErr && !rtErr.message.includes("duplicate")) {
        errors.push(`Release-track insert failed: ${rtErr.message}`);
      } else if (rtInserted) {
        releaseTrackLinksCreated = rtInserted.length;
      }
    }

    // Release-artist links
    const releaseArtistRows: Record<string, unknown>[] = [];
    for (const relSlug of Object.keys(releaseSlugToArtist)) {
      const releaseId = releaseIdMap[relSlug];
      const meta = releaseSlugToArtist[relSlug];
      if (releaseId && meta) {
        releaseArtistRows.push({
          release_id: releaseId,
          artist_id: meta.artistId,
          artist_slug: meta.artistSlug,
          artist_name_text: meta.artistName,
          role: "primary",
          is_primary: true,
          is_featured: false,
          credit_order: 0,
          source: REBUILD_SOURCE,
          confidence: 100,
          status: "active",
          metadata: {},
        });
      }
    }

    let releaseArtistLinksCreated = 0;
    if (releaseArtistRows.length > 0) {
      const { data: raInserted, error: raErr } = await supabase
        .from("registry_release_artists")
        .insert(releaseArtistRows)
        .select("id");

      if (raErr && !raErr.message.includes("duplicate")) {
        errors.push(`Release-artist insert failed: ${raErr.message}`);
      } else if (raInserted) {
        releaseArtistLinksCreated = raInserted.length;
      }
    }

    // ================= Summary =================
    const { count: totalTrackArtists } = await supabase
      .from("registry_track_artists")
      .select("*", { count: "exact", head: true });

    const { count: totalTracks } = await supabase
      .from("registry_tracks")
      .select("*", { count: "exact", head: true });

    const { count: totalReleases } = await supabase
      .from("registry_releases")
      .select("*", { count: "exact", head: true });

    return new Response(
      JSON.stringify(
        {
          success: true,
          batch,
          done: false,
          has_more: artists.length === batchSize,
          next_batch: batch + 1,
          steps,
          errors: errors.slice(0, 10),
          stats: {
            artists_this_batch: artists.length,
            albums_processed: albumsProcessed,
            top_songs_processed: topSongsProcessed,
            title_collisions_drafted: titleCollisions,
            tracks_inserted: tracksToInsert.length,
            tracks_resolved: Object.keys(trackIdMap).length,
            releases_inserted: releaseRows.length,
            releases_resolved: Object.keys(releaseIdMap).length,
            track_artist_links_created: trackArtistLinksCreated,
            featured_artist_links_created: featArtistLinksCreated,
            release_track_links_created: releaseTrackLinksCreated,
            release_artist_links_created: releaseArtistLinksCreated,
            orphans_deleted: totalOrphansDeleted,
            total_tracks: totalTracks ?? 0,
            total_releases: totalReleases ?? 0,
            total_track_artist_links: totalTrackArtists ?? 0,
          },
        },
        null,
        2
      ),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: message, batch, steps, errors }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
