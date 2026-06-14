
// enrich-artist-discography/index.ts
// Connects to WordPress MySQL, reads wkcharts_artists, wkcharts_tracks,
// wkcharts_track_artists, wkcharts_release_shells, wkcharts_release_shell_artists,
// wkcharts_release_shell_tracks and populates:
//   - registry_artists (bio, image enrichment)
//   - registry_releases
//   - registry_release_artists
//   - registry_tracks
//   - registry_release_tracks
//
// Runs in "dry_run" mode by default — pass { commit: true } to write.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const APPROVED_ORIGINS = ["https://wakilisha.africa", "https://www.wakilisha.africa", "https://staging.wakilisha.africa"];

function corsHeaders(origin: string | null) {
  const allowed = origin && APPROVED_ORIGINS.includes(origin) ? origin : APPROVED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

function parseReleaseType(t: string): string {
  const lower = t.toLowerCase();
  if (lower.includes("album") || lower === "lp") return "album";
  if (lower.includes("ep") || lower === "extended play") return "ep";
  if (lower.includes("single")) return "single";
  if (lower.includes("compilation") || lower.includes("mixtape")) return lower;
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
  if (!seen.has(base)) { seen.add(base); return base; }
  let i = 2;
  while (seen.has(`${base}-${i}`)) i++;
  const slug = `${base}-${i}`;
  seen.add(slug);
  return slug;
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase config missing" }, 500, origin);

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const { credentials, commit = false, artistSlugFilter, limit = 0 } = body as {
    credentials?: { host: string; port?: number; user: string; password: string; database: string; prefix?: string };
    commit?: boolean;
    artistSlugFilter?: string;
    limit?: number;
  };

  if (!credentials?.host || !credentials?.user || !credentials?.password || !credentials?.database) {
    return json({ error: "credentials.host, .user, .password, .database are required" }, 400, origin);
  }

  const prefix = credentials.prefix ?? "wp_";

  // ── Connect to WordPress MySQL ──────────────────────────────────────────────
  const mysql = new Client();
  try {
    await mysql.connect({
      hostname: credentials.host,
      port: credentials.port ?? 3306,
      username: credentials.user,
      password: credentials.password,
      db: credentials.database,
      connectTimeout: 20000,
    });
  } catch (err) {
    return json({
      error: "Cannot connect to WordPress MySQL",
      detail: err instanceof Error ? err.message : String(err),
      hint: credentials.host === "127.0.0.1" || credentials.host === "localhost"
        ? "This host is localhost — the edge function cannot reach it. Run this from your WP server instead."
        : "Check that the host is reachable and the MySQL port is not firewalled.",
    }, 502, origin);
  }

  const log: string[] = [];
  const stats = {
    wp_artists: 0,
    wp_releases: 0,
    wp_tracks: 0,
    wp_track_artists: 0,
    wp_release_shell_artists: 0,
    wp_release_shell_tracks: 0,
    artists_enriched: 0,
    releases_upserted: 0,
    tracks_upserted: 0,
    release_artists_upserted: 0,
    release_tracks_upserted: 0,
    errors: 0,
    skipped_no_registry_match: 0,
  };

  try {
    // ── 1. Load all registry artists into a slug→id map ───────────────────────
    const { data: registryArtistRows } = await supabase
      .from("registry_artists")
      .select("id, slug, display_name, public_image_url, bio, metadata");

    const registryArtistBySlug = new Map<string, { id: string; slug: string; display_name: string; public_image_url: string | null; bio: string | null; metadata: Record<string, unknown> }>();
    for (const ra of (registryArtistRows ?? [])) {
      registryArtistBySlug.set(String(ra.slug), ra as never);
    }
    log.push(`Registry artists loaded: ${registryArtistBySlug.size}`);

    // ── 2. Load wp_wkcharts_artists ─────────────────────────────────────────────
    const wpArtistQuery = `SELECT id, name, slug, bio, image_url, origin, artist_type, spotify_id, apple_music_id, website, status FROM \`${prefix}wkcharts_artists\`${artistSlugFilter ? ` WHERE slug = '${artistSlugFilter.replace(/'/g, "\\'")}'` : ""}${limit > 0 ? ` LIMIT ${Number(limit)}` : ""}`;
    const wpArtistResult = await mysql.execute(wpArtistQuery);
    const wpArtists = (wpArtistResult.rows ?? []) as Array<Record<string, unknown>>;
    stats.wp_artists = wpArtists.length;
    log.push(`WP wkcharts_artists fetched: ${wpArtists.length}`);

    // Build WP artist id → slug map
    const wpArtistIdToSlug = new Map<number, string>();
    for (const wa of wpArtists) {
      const id = Number(wa.id);
      const slug = clean(wa.slug) || slugify(clean(wa.name));
      wpArtistIdToSlug.set(id, slug);
    }

    // ── 3. Enrich registry_artists with WP bio/image ────────────────────────────
    for (const wa of wpArtists) {
      const wpSlug = clean(wa.slug) || slugify(clean(wa.name));
      const registryArtist = registryArtistBySlug.get(wpSlug);
      if (!registryArtist) {
        stats.skipped_no_registry_match++;
        continue;
      }

      const patch: Record<string, unknown> = {};
      const wpImage = clean(wa.image_url);
      if (wpImage && !registryArtist.public_image_url) {
        patch.public_image_url = wpImage;
      }
      const wpBio = clean(wa.bio);
      if (wpBio && !registryArtist.bio) {
        patch.bio = wpBio;
      }
      const existingMeta = (registryArtist.metadata || {}) as Record<string, unknown>;
      const metaPatch: Record<string, unknown> = {};
      if (clean(wa.spotify_id) && !existingMeta.spotify_artist_id) metaPatch.spotify_artist_id = clean(wa.spotify_id);
      if (clean(wa.apple_music_id) && !existingMeta.apple_music_id) metaPatch.apple_music_id = clean(wa.apple_music_id);
      if (clean(wa.artist_type) && !existingMeta.artist_type) metaPatch.artist_type = clean(wa.artist_type);
      if (clean(wa.origin) && !existingMeta.country) metaPatch.country = clean(wa.origin);
      if (clean(wa.website) && !existingMeta.website) metaPatch.website = clean(wa.website);

      if (Object.keys(metaPatch).length > 0) {
        patch.metadata = { ...existingMeta, ...metaPatch };
      }

      if (Object.keys(patch).length > 0) {
        if (commit) {
          const { error } = await supabase.from("registry_artists").update(patch).eq("id", registryArtist.id);
          if (error) {
            log.push(`ERROR enriching artist ${wpSlug}: ${error.message}`);
            stats.errors++;
          } else {
            stats.artists_enriched++;
          }
        } else {
          stats.artists_enriched++;
        }
      }
    }
    log.push(`Artists enriched: ${stats.artists_enriched} (${commit ? "committed" : "dry run"})`);

    // ── 4. Load wp_wkcharts_release_shells ──────────────────────────────────────
    const wpShellsResult = await mysql.execute(`SELECT id, title, slug, type, release_date, cover_url, status FROM \`${prefix}wkcharts_release_shells\``);
    const wpShells = (wpShellsResult.rows ?? []) as Array<Record<string, unknown>>;
    stats.wp_releases = wpShells.length;
    log.push(`WP wkcharts_release_shells fetched: ${wpShells.length}`);

    // ── 5. Load wp_wkcharts_release_shell_artists ───────────────────────────────
    const wpShellArtistsResult = await mysql.execute(`SELECT id, release_shell_id, artist_id, role, is_primary FROM \`${prefix}wkcharts_release_shell_artists\``);
    const wpShellArtists = (wpShellArtistsResult.rows ?? []) as Array<Record<string, unknown>>;
    stats.wp_release_shell_artists = wpShellArtists.length;
    log.push(`WP wkcharts_release_shell_artists fetched: ${wpShellArtists.length}`);

    // ── 6. Load wp_wkcharts_release_shell_tracks ────────────────────────────────
    const wpShellTracksResult = await mysql.execute(`SELECT id, release_shell_id, track_id, track_number, disc_number FROM \`${prefix}wkcharts_release_shell_tracks\``);
    const wpShellTracks = (wpShellTracksResult.rows ?? []) as Array<Record<string, unknown>>;
    stats.wp_release_shell_tracks = wpShellTracks.length;
    log.push(`WP wkcharts_release_shell_tracks fetched: ${wpShellTracks.length}`);

    // ── 7. Load wp_wkcharts_tracks ──────────────────────────────────────────────
    const wpTracksResult = await mysql.execute(`SELECT id, title, slug, isrc, duration, explicit, track_number, spotify_id, apple_music_id, youtube_id, artwork_url, status FROM \`${prefix}wkcharts_tracks\``);
    const wpTracks = (wpTracksResult.rows ?? []) as Array<Record<string, unknown>>;
    stats.wp_tracks = wpTracks.length;
    log.push(`WP wkcharts_tracks fetched: ${wpTracks.length}`);

    // ── 8. Load wp_wkcharts_track_artists ───────────────────────────────────────
    const wpTrackArtistsResult = await mysql.execute(`SELECT id, track_id, artist_id, role, is_primary FROM \`${prefix}wkcharts_track_artists\``);
    const wpTrackArtists = (wpTrackArtistsResult.rows ?? []) as Array<Record<string, unknown>>;
    stats.wp_track_artists = wpTrackArtists.length;
    log.push(`WP wkcharts_track_artists fetched: ${wpTrackArtists.length}`);

    // ── Build lookup maps ────────────────────────────────────────────────────────
    const shellArtistsMap = new Map<number, Array<Record<string, unknown>>>();
    for (const sa of wpShellArtists) {
      const shellId = Number(sa.release_shell_id);
      if (!shellArtistsMap.has(shellId)) shellArtistsMap.set(shellId, []);
      shellArtistsMap.get(shellId)!.push(sa);
    }

    const shellTracksMap = new Map<number, Array<Record<string, unknown>>>();
    for (const st of wpShellTracks) {
      const shellId = Number(st.release_shell_id);
      if (!shellTracksMap.has(shellId)) shellTracksMap.set(shellId, []);
      shellTracksMap.get(shellId)!.push(st);
    }

    const wpTrackById = new Map<number, Record<string, unknown>>();
    for (const t of wpTracks) {
      wpTrackById.set(Number(t.id), t);
    }

    const trackArtistsMap = new Map<number, Array<Record<string, unknown>>>();
    for (const ta of wpTrackArtists) {
      const trackId = Number(ta.track_id);
      if (!trackArtistsMap.has(trackId)) trackArtistsMap.set(trackId, []);
      trackArtistsMap.get(trackId)!.push(ta);
    }

    // ── 9. Load existing registry releases to avoid duplicates ──────────────────
    const { data: existingReleases } = await supabase.from("registry_releases").select("id, slug");
    const existingReleaseSlugs = new Set((existingReleases ?? []).map((r: any) => String(r.slug)));
    const existingReleaseBySlug = new Map<string, string>((existingReleases ?? []).map((r: any) => [String(r.slug), String(r.id)]));

    // ── 10. Load existing registry tracks ────────────────────────────────────────
    const { data: existingTracks } = await supabase.from("registry_tracks").select("id, slug, isrc");
    const existingTrackByIsrc = new Map<string, string>((existingTracks ?? []).filter((t: any) => t.isrc).map((t: any) => [String(t.isrc), String(t.id)]));
    const existingTrackBySlug = new Map<string, string>((existingTracks ?? []).map((t: any) => [String(t.slug), String(t.id)]));
    const existingTrackSlugs = new Set(existingTrackBySlug.keys());

    // Preload existing track→artist links so slug-matching is scoped by artist.
    // An "Intro" by Sauti Sol is not the same song as "Intro" by Wakadinali.
    const { data: existingTrackArtists } = await supabase.from("registry_track_artists")
      .select("track_id, artist_slug").eq("status", "active");
    const existingTrackArtistSet = new Set<string>(
      (existingTrackArtists ?? []).map((r: any) => `${r.track_id}:${r.artist_slug}`)
    );

    // ── 11. Process each release shell ────────────────────────────────────────────
    const seenReleaseSlugs = new Set<string>(existingReleaseSlugs);
    const seenTrackSlugs = new Set<string>(existingTrackSlugs);

    const releaseRows: Record<string, unknown>[] = [];
    const releaseArtistRows: Record<string, unknown>[] = [];
    const trackRows: Record<string, unknown>[] = [];
    const releaseTrackRows: Record<string, unknown>[] = [];

    const shellIdToRegistryReleaseId = new Map<number, string>();
    const wpTrackIdToRegistryId = new Map<number, string>();

    for (const shell of wpShells) {
      const shellId = Number(shell.id);
      const rawTitle = clean(shell.title);
      const rawSlug = clean(shell.slug) || slugify(rawTitle);
      const releaseSlug = dedupeSlug(rawSlug, seenReleaseSlugs);
      const releaseType = parseReleaseType(clean(shell.type) || "album");
      const releaseDate = parseDate(shell.release_date);
      const artworkUrl = clean(shell.cover_url);
      const releaseId = crypto.randomUUID();

      shellIdToRegistryReleaseId.set(shellId, releaseId);

      if (!existingReleaseBySlug.has(rawSlug)) {
        releaseRows.push({
          id: releaseId,
          slug: releaseSlug,
          title: rawTitle || `Release ${shellId}`,
          normalized_title: slugify(rawTitle || String(shellId)).replace(/-/g, " "),
          release_type: releaseType,
          release_date: releaseDate,
          artwork_url: artworkUrl || null,
          status: "active",
          metadata: {
            wp_shell_id: shellId,
            source: "wkcharts_release_shells",
          },
        });
      } else {
        shellIdToRegistryReleaseId.set(shellId, existingReleaseBySlug.get(rawSlug)!);
      }

      // ── Shell artists → registry_release_artists ─────────────────────────────
      const shellArtists = shellArtistsMap.get(shellId) ?? [];
      // Build set of registry artist slugs for this release (for track dedup scoping)
      const releaseArtistSlugs = new Set<string>();
      for (const sa of shellArtists) {
        const wpArtistId = Number(sa.artist_id);
        const wpArtistSlug = wpArtistIdToSlug.get(wpArtistId);
        if (!wpArtistSlug) continue;
        const registryArtist = registryArtistBySlug.get(wpArtistSlug);
        if (!registryArtist) {
          stats.skipped_no_registry_match++;
          continue;
        }
        releaseArtistSlugs.add(registryArtist.slug);
        const isPrimary = Number(sa.is_primary) === 1;
        const role = clean(sa.role) || "primary_artist";
        releaseArtistRows.push({
          release_id: releaseId,
          artist_id: registryArtist.id,
          artist_slug: registryArtist.slug,
          artist_name_text: registryArtist.display_name,
          role,
          is_primary: isPrimary,
          is_featured: !isPrimary && role.includes("feat"),
          credit_order: isPrimary ? 0 : 1,
          source: "wkcharts_release_shell_artists",
          confidence: 95,
          status: "active",
          metadata: { wp_shell_artist_id: Number(sa.id), wp_artist_id: wpArtistId },
        });
      }

      // ── Shell tracks → registry_tracks + registry_release_tracks ────────────
      const shellTracks = shellTracksMap.get(shellId) ?? [];
      for (const st of shellTracks) {
        const wpTrackId = Number(st.track_id);
        const wpTrack = wpTrackById.get(wpTrackId);
        if (!wpTrack) continue;

        const trackTitle = clean(wpTrack.title);
        const trackIsrc = clean(wpTrack.isrc) || null;
        const trackArtworkUrl = clean(wpTrack.artwork_url) || artworkUrl || null;
        const durationMs = wpTrack.duration ? Math.round(Number(wpTrack.duration) * 1000) : null;
        const trackNumber = Number(st.track_number || wpTrack.track_number || 0);
        const discNumber = Number(st.disc_number || 1);

        // Build WP artist slugs for this track (for dedup scoping)
        const wpTrackArtists = trackArtistsMap.get(wpTrackId) ?? [];
        const trackArtistSlugs = new Set<string>();
        for (const ta of wpTrackArtists) {
          const wpAId = Number(ta.artist_id);
          const slug = wpArtistIdToSlug.get(wpAId);
          if (slug) trackArtistSlugs.add(slug);
        }

        // Match by ISRC first (globally unique)
        let existingTrackId = trackIsrc ? existingTrackByIsrc.get(trackIsrc) : undefined;
        const rawTrackSlug = clean(wpTrack.slug) || slugify(trackTitle);

        // Fallback: match by slug BUT only if the existing track is already
        // linked to at least one artist from this release OR this track's WP artists.
        // Prevents "Intro" cross-artist merging.
        if (!existingTrackId) {
          const slugMatchId = existingTrackBySlug.get(rawTrackSlug);
          if (slugMatchId) {
            const scopedArtists = new Set([...releaseArtistSlugs, ...trackArtistSlugs]);
            const isSameArtistContext = [...scopedArtists].some(
              (slug) => existingTrackArtistSet.has(`${slugMatchId}:${slug}`)
            );
            if (isSameArtistContext) existingTrackId = slugMatchId;
          }
        }

        let trackId: string;
        if (existingTrackId) {
          trackId = existingTrackId;
          wpTrackIdToRegistryId.set(wpTrackId, trackId);
        } else if (!wpTrackIdToRegistryId.has(wpTrackId)) {
          trackId = crypto.randomUUID();
          const trackSlug = dedupeSlug(rawTrackSlug, seenTrackSlugs);
          wpTrackIdToRegistryId.set(wpTrackId, trackId);
          existingTrackBySlug.set(trackSlug, trackId);
          if (trackIsrc) existingTrackByIsrc.set(trackIsrc, trackId);

          trackRows.push({
            id: trackId,
            slug: trackSlug,
            title: trackTitle || `Track ${wpTrackId}`,
            normalized_title: slugify(trackTitle || String(wpTrackId)).replace(/-/g, " "),
            isrc: trackIsrc,
            release_id: releaseId,
            duration_ms: durationMs,
            explicit: Number(wpTrack.explicit) === 1,
            track_number: trackNumber || null,
            disc_number: discNumber || 1,
            artwork_url: trackArtworkUrl,
            status: "active",
            metadata: {
              wp_track_id: wpTrackId,
              spotify_id: clean(wpTrack.spotify_id) || null,
              apple_music_id: clean(wpTrack.apple_music_id) || null,
              youtube_id: clean(wpTrack.youtube_id) || null,
              source: "wkcharts_tracks",
            },
          });
        } else {
          trackId = wpTrackIdToRegistryId.get(wpTrackId)!;
        }

        releaseTrackRows.push({
          release_id: releaseId,
          track_id: trackId,
          disc_number: discNumber,
          track_number: trackNumber || null,
          source: "wkcharts_release_shell_tracks",
          confidence: 95,
          status: "active",
          metadata: { wp_shell_track_id: Number(st.id) },
        });
      }
    }

    stats.releases_upserted = releaseRows.length;
    stats.tracks_upserted = trackRows.length;
    stats.release_artists_upserted = releaseArtistRows.length;
    stats.release_tracks_upserted = releaseTrackRows.length;

    log.push(`Releases to upsert: ${releaseRows.length}`);
    log.push(`Tracks to upsert: ${trackRows.length}`);
    log.push(`Release-artist links to upsert: ${releaseArtistRows.length}`);
    log.push(`Release-track links to upsert: ${releaseTrackRows.length}`);

    // ── 12. Also migrate standalone tracks (not in release shells) ───────────────
    const shellTrackWpIds = new Set<number>();
    for (const [, tracks] of shellTracksMap) {
      for (const st of tracks) shellTrackWpIds.add(Number(st.track_id));
    }

    let standaloneTracksAdded = 0;
    for (const wpTrack of wpTracks) {
      const wpTrackId = Number(wpTrack.id);
      if (shellTrackWpIds.has(wpTrackId)) continue;
      if (wpTrackIdToRegistryId.has(wpTrackId)) continue;

      const trackTitle = clean(wpTrack.title);
      const trackIsrc = clean(wpTrack.isrc) || null;
      const rawTrackSlug = clean(wpTrack.slug) || slugify(trackTitle);

      // Build WP artist slugs for this track
      const wpTrackArtists = trackArtistsMap.get(wpTrackId) ?? [];
      const trackArtistSlugs = new Set<string>();
      for (const ta of wpTrackArtists) {
        const wpAId = Number(ta.artist_id);
        const slug = wpArtistIdToSlug.get(wpAId);
        if (slug) trackArtistSlugs.add(slug);
      }

      let existingTrackId = trackIsrc ? existingTrackByIsrc.get(trackIsrc) : undefined;

      // Artist-scoped slug fallback
      if (!existingTrackId) {
        const slugMatchId = existingTrackBySlug.get(rawTrackSlug);
        if (slugMatchId) {
          const isSameArtistContext = [...trackArtistSlugs].some(
            (slug) => existingTrackArtistSet.has(`${slugMatchId}:${slug}`)
          );
          if (isSameArtistContext) existingTrackId = slugMatchId;
        }
      }

      if (existingTrackId) {
        wpTrackIdToRegistryId.set(wpTrackId, existingTrackId);
        continue;
      }

      const trackId = crypto.randomUUID();
      const trackSlug = dedupeSlug(rawTrackSlug, seenTrackSlugs);
      wpTrackIdToRegistryId.set(wpTrackId, trackId);
      existingTrackBySlug.set(trackSlug, trackId);
      if (trackIsrc) existingTrackByIsrc.set(trackIsrc, trackId);

      const durationMs = wpTrack.duration ? Math.round(Number(wpTrack.duration) * 1000) : null;
      const artworkUrl = clean(wpTrack.artwork_url) || null;

      trackRows.push({
        id: trackId,
        slug: trackSlug,
        title: trackTitle || `Track ${wpTrackId}`,
        normalized_title: slugify(trackTitle || String(wpTrackId)).replace(/-/g, " "),
        isrc: trackIsrc,
        release_id: null,
        duration_ms: durationMs,
        explicit: Number(wpTrack.explicit) === 1,
        track_number: Number(wpTrack.track_number) || null,
        disc_number: 1,
        artwork_url: artworkUrl,
        status: "active",
        metadata: {
          wp_track_id: wpTrackId,
          spotify_id: clean(wpTrack.spotify_id) || null,
          apple_music_id: clean(wpTrack.apple_music_id) || null,
          youtube_id: clean(wpTrack.youtube_id) || null,
          source: "wkcharts_tracks",
        },
      });
      standaloneTracksAdded++;
    }
    stats.tracks_upserted = trackRows.length;
    log.push(`Standalone tracks (not in release shell): ${standaloneTracksAdded}`);

    // ── 13. Also build registry_track_artists links from wkcharts_track_artists ──
    const trackArtistRows: Record<string, unknown>[] = [];
    for (const ta of wpTrackArtists) {
      const wpTrackId = Number(ta.track_id);
      const wpArtistId = Number(ta.artist_id);
      const trackId = wpTrackIdToRegistryId.get(wpTrackId);
      if (!trackId) continue;
      const wpArtistSlug = wpArtistIdToSlug.get(wpArtistId);
      if (!wpArtistSlug) continue;
      const registryArtist = registryArtistBySlug.get(wpArtistSlug);
      if (!registryArtist) continue;
      const isPrimary = Number(ta.is_primary) === 1;
      const role = clean(ta.role) || "primary_artist";
      trackArtistRows.push({
        track_id: trackId,
        artist_id: registryArtist.id,
        artist_slug: registryArtist.slug,
        role,
        is_primary: isPrimary,
        credit_order: isPrimary ? 0 : 1,
        source: "wkcharts_track_artists",
        confidence: 95,
        status: "active",
        metadata: { wp_track_artist_id: Number(ta.id) },
      });
    }
    log.push(`Track-artist links to upsert: ${trackArtistRows.length}`);

    // ── 14. Commit to Supabase ────────────────────────────────────────────────────
    if (commit) {
      const BATCH = 200;

      if (releaseRows.length > 0) {
        for (let i = 0; i < releaseRows.length; i += BATCH) {
          const { error } = await supabase.from("registry_releases").upsert(releaseRows.slice(i, i + BATCH), { onConflict: "slug" });
          if (error) { log.push(`ERROR inserting releases batch ${i}: ${error.message}`); stats.errors++; }
        }
        log.push(`Releases inserted: ${releaseRows.length}`);
      }

      if (trackRows.length > 0) {
        for (let i = 0; i < trackRows.length; i += BATCH) {
          const batch = trackRows.slice(i, i + BATCH);
          const { error } = await supabase.from("registry_tracks").upsert(batch, { onConflict: "slug", ignoreDuplicates: true });
          if (error) { log.push(`ERROR inserting tracks batch ${i}: ${error.message}`); stats.errors++; }
        }
        log.push(`Tracks inserted: ${trackRows.length}`);
      }

      if (releaseArtistRows.length > 0) {
        const releaseIds = [...new Set(releaseArtistRows.map((r) => String(r.release_id)))];
        for (let i = 0; i < releaseIds.length; i += 200) {
          await supabase.from("registry_release_artists").delete().in("release_id", releaseIds.slice(i, i + 200)).eq("source", "wkcharts_release_shell_artists");
        }
        for (let i = 0; i < releaseArtistRows.length; i += BATCH) {
          const { error } = await supabase.from("registry_release_artists").insert(releaseArtistRows.slice(i, i + BATCH));
          if (error) { log.push(`ERROR inserting release_artists batch ${i}: ${error.message}`); stats.errors++; }
        }
        log.push(`Release-artist links inserted: ${releaseArtistRows.length}`);
      }

      if (releaseTrackRows.length > 0) {
        const releaseIds = [...new Set(releaseTrackRows.map((r) => String(r.release_id)))];
        for (let i = 0; i < releaseIds.length; i += 200) {
          await supabase.from("registry_release_tracks").delete().in("release_id", releaseIds.slice(i, i + 200)).eq("source", "wkcharts_release_shell_tracks");
        }
        for (let i = 0; i < releaseTrackRows.length; i += BATCH) {
          const { error } = await supabase.from("registry_release_tracks").insert(releaseTrackRows.slice(i, i + BATCH));
          if (error) { log.push(`ERROR inserting release_tracks batch ${i}: ${error.message}`); stats.errors++; }
        }
        log.push(`Release-track links inserted: ${releaseTrackRows.length}`);
      }

      if (trackArtistRows.length > 0) {
        const { error: checkErr } = await supabase.from("registry_track_artists").select("id").limit(1);
        if (!checkErr) {
          const trackIds = [...new Set(trackArtistRows.map((r) => String(r.track_id)))];
          for (let i = 0; i < trackIds.length; i += 200) {
            await supabase.from("registry_track_artists").delete().in("track_id", trackIds.slice(i, i + 200)).eq("source", "wkcharts_track_artists");
          }
          for (let i = 0; i < trackArtistRows.length; i += BATCH) {
            const { error } = await supabase.from("registry_track_artists").insert(trackArtistRows.slice(i, i + BATCH));
            if (error) { log.push(`WARN inserting track_artists batch ${i}: ${error.message}`); }
          }
          log.push(`Track-artist links inserted: ${trackArtistRows.length}`);
        } else {
          log.push(`SKIP: registry_track_artists table not available — ${checkErr.message}`);
        }
      }

      log.push(`Commit complete.`);
    } else {
      log.push(`DRY RUN — pass { commit: true } to write to database.`);
    }

    return json({
      success: true,
      commit,
      stats,
      log,
      preview: {
        sample_releases: releaseRows.slice(0, 3),
        sample_tracks: trackRows.slice(0, 3),
        sample_release_artists: releaseArtistRows.slice(0, 3),
      },
    }, 200, origin);

  } catch (err) {
    log.push(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
    return json({ success: false, error: err instanceof Error ? err.message : "Internal error", log, stats }, 500, origin);
  } finally {
    try { await mysql.close(); } catch { /* ignore */ }
  }
});
