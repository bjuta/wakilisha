/**
 * enrich-artist-discography-local.ts
 *
 * LOCAL Node.js script — run this directly on the WordPress server to bypass
 * the 127.0.0.1 connectivity issue that Edge Functions can't reach.
 *
 * Reads WordPress MySQL (wp_wkcharts_*) plugin tables, enriches
 * registry_artists, and populates registry_releases, registry_tracks,
 * registry_release_artists, registry_release_tracks, and
 * registry_track_artists into Supabase.
 *
 * DRY RUN by default — pass --commit to actually write.
 *
 * USAGE (on the WordPress server):
 *   DATABASE_URL="postgresql://..." \
 *   WP_DB_HOST=127.0.0.1 WP_DB_PORT=3306 WP_DB_USER=bn_wordpress \
 *   WP_DB_PASSWORD="..." WP_DB_NAME=bitnami_wordpress WP_DB_PREFIX=wp_ \
 *   npx tsx enrich-artist-discography-local.ts
 *
 * OPTIONS:
 *   --commit       Actually write to Supabase (default is dry run)
 *   --artist-slug  Only process one artist (e.g. "sauti-sol")
 *   --limit N      Only process N artists
 */

import mysql from "mysql2/promise";
import pg from "pg";
import crypto from "node:crypto";

// ── CLI helpers ─────────────────────────────────────────────────────────────

function arg(name: string) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}
function hasFlag(name: string) {
  return process.argv.includes(name);
}
function required(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label} is required. Use env var or CLI flag.`);
  return value;
}
function normalizeDatabaseUrl(url: string) {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("uselibpqcompat");
    return u.toString();
  } catch {
    return url;
  }
}

// ── Config from env + CLI ──────────────────────────────────────────────────

const COMMIT = hasFlag("--commit");
const ARTIST_SLUG_FILTER = arg("--artist-slug") || undefined;
const LIMIT = arg("--limit") ? Number(arg("--limit")) : 0;

const WP = {
  host: required(arg("--host") ?? process.env.WP_DB_HOST, "WP_DB_HOST"),
  port: Number(arg("--port") ?? process.env.WP_DB_PORT ?? 3306),
  user: required(arg("--user") ?? process.env.WP_DB_USER, "WP_DB_USER"),
  password: required(arg("--password") ?? process.env.WP_DB_PASSWORD, "WP_DB_PASSWORD"),
  database: required(arg("--database") ?? process.env.WP_DB_NAME, "WP_DB_NAME"),
  prefix: arg("--prefix") ?? process.env.WP_DB_PREFIX ?? "wp_",
};

const DATABASE_URL = required(process.env.DATABASE_URL, "DATABASE_URL");

// ── String utils ───────────────────────────────────────────────────────────

function clean(v: unknown): string {
  return String(v ?? "").trim();
}
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}
function parseDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s === "0000-00-00") return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}
function parseReleaseType(t: string): string {
  const lower = t.toLowerCase();
  if (lower.includes("album") || lower === "lp") return "album";
  if (lower.includes("ep") || lower === "extended play") return "ep";
  if (lower.includes("single")) return "single";
  if (lower.includes("compilation") || lower.includes("mixtape")) return lower;
  return "album";
}
function dedupeSlug(base: string, seen: Set<string>): string {
  if (!seen.has(base)) { seen.add(base); return base; }
  let i = 2;
  while (seen.has(`${base}-${i}`)) i++;
  const slug = `${base}-${i}`;
  seen.add(slug);
  return slug;
}
function table(prefix: string, name: string) {
  return `\`${prefix}${name}\``;
}

// ── Stats tracker ───────────────────────────────────────────────────────────

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
  track_artists_upserted: 0,
  standalone_tracks_added: 0,
  errors: 0,
  skipped_no_registry_match: 0,
};

const log: string[] = [];

function info(msg: string) {
  log.push(msg);
  console.log(`[enrich] ${msg}`);
}
function err(msg: string) {
  log.push(`ERROR: ${msg}`);
  console.error(`[enrich] ERROR: ${msg}`);
  stats.errors++;
}

// ── Batch helpers ───────────────────────────────────────────────────────────

const BATCH = 200;

async function batchUpsert(
  pool: pg.Pool,
  tableName: string,
  rows: Record<string, unknown>[],
  conflictCol: string,
) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(", ");

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const values: unknown[] = [];
    const paramGroups = batch.map((row, idx) => {
      const base = idx * columns.length;
      columns.forEach((col) => {
        values.push(row[col] ?? null);
      });
      return `(${columns.map((_, j) => `$${base + j + 1}`).join(", ")})`;
    });

    const setClause = columns
      .filter((c) => c !== conflictCol && c !== "id")
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(", ");

    try {
      await pool.query(
        `INSERT INTO "${tableName}" (${colList})
         VALUES ${paramGroups.join(", ")}
         ON CONFLICT ("${conflictCol}") DO UPDATE SET ${setClause}`,
        values,
      );
    } catch (e) {
      err(`Batch upsert ${tableName} failed: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
  }
}

async function batchInsert(
  pool: pg.Pool,
  tableName: string,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(", ");

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const values: unknown[] = [];
    const paramGroups = batch.map((row, idx) => {
      const base = idx * columns.length;
      columns.forEach((col) => {
        values.push(row[col] ?? null);
      });
      return `(${columns.map((_, j) => `$${base + j + 1}`).join(", ")})`;
    });

    try {
      await pool.query(
        `INSERT INTO "${tableName}" (${colList}) VALUES ${paramGroups.join(", ")}`,
        values,
      );
    } catch (e) {
      err(`Batch insert ${tableName} failed: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
  }
}

// ── Main pipeline ───────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Wakilisha Artist Discography Enrichment (LOCAL)");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Mode:       ${COMMIT ? "COMMIT" : "DRY RUN"}`);
  console.log(`  WP MySQL:   ${WP.user}@${WP.host}:${WP.port}/${WP.database}`);
  console.log(`  Supabase:   ${new URL(normalizeDatabaseUrl(DATABASE_URL)).host}`);
  if (ARTIST_SLUG_FILTER) console.log(`  Filter:     ${ARTIST_SLUG_FILTER}`);
  if (LIMIT > 0) console.log(`  Limit:      ${LIMIT} artists`);
  console.log("═══════════════════════════════════════════════════════\n");

  const wp = await mysql.createConnection({
    host: WP.host,
    port: WP.port,
    user: WP.user,
    password: WP.password,
    database: WP.database,
    connectTimeout: 20000,
  });
  await wp.ping();
  info(`Connected to WordPress MySQL`);

  const pool = new pg.Pool({
    connectionString: normalizeDatabaseUrl(DATABASE_URL),
    ssl: { rejectUnauthorized: false },
    max: 4,
  });

  try {
    // ── 1. Load registry artists ───────────────────────────────────────
    const artistRes = await pool.query(
      `SELECT id, slug, display_name, public_image_url, bio, metadata FROM registry_artists`
    );
    const registryArtistBySlug = new Map<string, {
      id: string; slug: string; display_name: string;
      public_image_url: string | null; bio: string | null;
      metadata: Record<string, unknown>;
    }>();
    for (const ra of artistRes.rows) {
      registryArtistBySlug.set(String(ra.slug), ra);
    }
    info(`Registry artists loaded: ${registryArtistBySlug.size}`);

    // ── 2. Load WP artists ─────────────────────────────────────────────
    let wpArtistQuery = `SELECT id, name, slug, bio, image_url, origin, artist_type, spotify_id, apple_music_id, website, status FROM ${table(WP.prefix, "wkcharts_artists")}`;
    if (ARTIST_SLUG_FILTER) {
      wpArtistQuery += ` WHERE slug = '${ARTIST_SLUG_FILTER.replace(/'/g, "\\'")}'`;
    }
    if (LIMIT > 0) wpArtistQuery += ` LIMIT ${LIMIT}`;

    const [wpArtistRows] = await wp.query(wpArtistQuery);
    const wpArtists = wpArtistRows as Record<string, unknown>[];
    stats.wp_artists = wpArtists.length;
    info(`WP artists fetched: ${wpArtists.length}`);

    const wpArtistIdToSlug = new Map<number, string>();
    for (const wa of wpArtists) {
      const id = Number(wa.id);
      const slug = clean(wa.slug) || slugify(clean(wa.name));
      wpArtistIdToSlug.set(id, slug);
    }

    // ── 3. Enrich registry artists ─────────────────────────────────────
    if (COMMIT) {
      let enrichedCount = 0;
      for (const wa of wpArtists) {
        const wpSlug = clean(wa.slug) || slugify(clean(wa.name));
        const registryArtist = registryArtistBySlug.get(wpSlug);
        if (!registryArtist) { stats.skipped_no_registry_match++; continue; }

        const patch: Record<string, unknown> = {};
        const wpImage = clean(wa.image_url);
        if (wpImage && !registryArtist.public_image_url) patch.public_image_url = wpImage;
        const wpBio = clean(wa.bio);
        if (wpBio && !registryArtist.bio) patch.bio = wpBio;

        const existingMeta = (registryArtist.metadata || {}) as Record<string, unknown>;
        const metaPatch: Record<string, unknown> = {};
        if (clean(wa.spotify_id) && !existingMeta.spotify_artist_id) metaPatch.spotify_artist_id = clean(wa.spotify_id);
        if (clean(wa.apple_music_id) && !existingMeta.apple_music_id) metaPatch.apple_music_id = clean(wa.apple_music_id);
        if (clean(wa.artist_type) && !existingMeta.artist_type) metaPatch.artist_type = clean(wa.artist_type);
        if (clean(wa.origin) && !existingMeta.country) metaPatch.country = clean(wa.origin);
        if (clean(wa.website) && !existingMeta.website) metaPatch.website = clean(wa.website);

        if (Object.keys(metaPatch).length > 0) patch.metadata = { ...existingMeta, ...metaPatch };

        if (Object.keys(patch).length > 0) {
          const setClause = Object.keys(patch).map((k, i) => `"${k}" = $${i + 2}`).join(", ");
          await pool.query(`UPDATE registry_artists SET ${setClause} WHERE id = $1`, [registryArtist.id, ...Object.values(patch)]);
          enrichedCount++;
        }
      }
      stats.artists_enriched = enrichedCount;
      info(`Artists enriched: ${enrichedCount}`);
    } else {
      for (const wa of wpArtists) {
        const wpSlug = clean(wa.slug) || slugify(clean(wa.name));
        const ra = registryArtistBySlug.get(wpSlug);
        if (!ra) { stats.skipped_no_registry_match++; continue; }
        if ((clean(wa.image_url) && !ra.public_image_url) || (clean(wa.bio) && !ra.bio) ||
            (clean(wa.spotify_id) && !(ra.metadata as Record<string, unknown>)?.spotify_artist_id) ||
            (clean(wa.apple_music_id) && !(ra.metadata as Record<string, unknown>)?.apple_music_id) ||
            (clean(wa.artist_type) && !(ra.metadata as Record<string, unknown>)?.artist_type) ||
            (clean(wa.origin) && !(ra.metadata as Record<string, unknown>)?.country) ||
            (clean(wa.website) && !(ra.metadata as Record<string, unknown>)?.website)) {
          stats.artists_enriched++;
        }
      }
      info(`Artists that would be enriched: ${stats.artists_enriched} (dry run)`);
    }

    // ── 4. Load release shells ───────────────────────────────────────────
    const [shellRows] = await wp.query(
      `SELECT id, title, slug, type, release_date, cover_url, status FROM ${table(WP.prefix, "wkcharts_release_shells")}`
    );
    const wpShells = shellRows as Record<string, unknown>[];
    stats.wp_releases = wpShells.length;
    info(`WP release shells fetched: ${wpShells.length}`);

    // ── 5. Load shell-artist links ───────────────────────────────────────
    const [shellArtistRows] = await wp.query(
      `SELECT id, release_shell_id, artist_id, role, is_primary FROM ${table(WP.prefix, "wkcharts_release_shell_artists")}`
    );
    const wpShellArtists = shellArtistRows as Record<string, unknown>[];
    stats.wp_release_shell_artists = wpShellArtists.length;
    info(`WP shell-artist links fetched: ${wpShellArtists.length}`);

    // ── 6. Load shell-track links ──────────────────────────────────────────
    const [shellTrackRows] = await wp.query(
      `SELECT id, release_shell_id, track_id, track_number, disc_number FROM ${table(WP.prefix, "wkcharts_release_shell_tracks")}`
    );
    const wpShellTracks = shellTrackRows as Record<string, unknown>[];
    stats.wp_release_shell_tracks = wpShellTracks.length;
    info(`WP shell-track links fetched: ${wpShellTracks.length}`);

    // ── 7. Load tracks ───────────────────────────────────────────────────
    const [trackRows] = await wp.query(
      `SELECT id, title, slug, isrc, duration, explicit, track_number, spotify_id, apple_music_id, youtube_id, artwork_url, status FROM ${table(WP.prefix, "wkcharts_tracks")}`
    );
    const wpTracks = trackRows as Record<string, unknown>[];
    stats.wp_tracks = wpTracks.length;
    info(`WP tracks fetched: ${wpTracks.length}`);

    // ── 8. Load track-artist links ─────────────────────────────────────────
    const [trackArtistRows] = await wp.query(
      `SELECT id, track_id, artist_id, role, is_primary FROM ${table(WP.prefix, "wkcharts_track_artists")}`
    );
    const wpTrackArtists = trackArtistRows as Record<string, unknown>[];
    stats.wp_track_artists = wpTrackArtists.length;
    info(`WP track-artist links fetched: ${wpTrackArtists.length}`);

    // ── Build maps ───────────────────────────────────────────────────────
    const shellArtistsMap = new Map<number, Record<string, unknown>[]>();
    for (const sa of wpShellArtists) {
      const sid = Number(sa.release_shell_id);
      if (!shellArtistsMap.has(sid)) shellArtistsMap.set(sid, []);
      shellArtistsMap.get(sid)!.push(sa);
    }
    const shellTracksMap = new Map<number, Record<string, unknown>[]>();
    for (const st of wpShellTracks) {
      const sid = Number(st.release_shell_id);
      if (!shellTracksMap.has(sid)) shellTracksMap.set(sid, []);
      shellTracksMap.get(sid)!.push(st);
    }
    const wpTrackById = new Map<number, Record<string, unknown>>();
    for (const t of wpTracks) wpTrackById.set(Number(t.id), t);
    const trackArtistsMap = new Map<number, Record<string, unknown>[]>();
    for (const ta of wpTrackArtists) {
      const tid = Number(ta.track_id);
      if (!trackArtistsMap.has(tid)) trackArtistsMap.set(tid, []);
      trackArtistsMap.get(tid)!.push(ta);
    }

    // ── 9. Load existing releases ───────────────────────────────────────
    const existingReleaseRes = await pool.query(`SELECT id, slug FROM registry_releases`);
    const existingReleaseBySlug = new Map<string, string>();
    for (const r of existingReleaseRes.rows) {
      existingReleaseBySlug.set(String(r.slug), String(r.id));
    }
    const existingReleaseSlugs = new Set(existingReleaseBySlug.keys());

    // ── 10. Load existing tracks ─────────────────────────────────────────
    const existingTrackRes = await pool.query(`SELECT id, slug, isrc FROM registry_tracks`);
    const existingTrackByIsrc = new Map<string, string>();
    const existingTrackBySlug = new Map<string, string>();
    for (const t of existingTrackRes.rows) {
      existingTrackBySlug.set(String(t.slug), String(t.id));
      if (t.isrc) existingTrackByIsrc.set(String(t.isrc), String(t.id));
    }
    const existingTrackSlugs = new Set(existingTrackBySlug.keys());

    // ── 11. Process releases + tracks ────────────────────────────────────
    const seenReleaseSlugs = new Set(existingReleaseSlugs);
    const seenTrackSlugs = new Set(existingTrackSlugs);

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

      if (!existingReleaseBySlug.has(rawSlug)) {
        shellIdToRegistryReleaseId.set(shellId, releaseId);
        releaseRows.push({
          id: releaseId,
          slug: releaseSlug,
          title: rawTitle || `Release ${shellId}`,
          normalized_title: slugify(rawTitle || String(shellId)).replace(/-/g, " "),
          release_type: releaseType,
          release_date: releaseDate,
          artwork_url: artworkUrl || null,
          status: "active",
          metadata: JSON.stringify({ wp_shell_id: shellId, source: "wkcharts_release_shells" }),
        });
      } else {
        shellIdToRegistryReleaseId.set(shellId, existingReleaseBySlug.get(rawSlug)!);
      }

      // Release artists
      const sArtists = shellArtistsMap.get(shellId) ?? [];
      for (const sa of sArtists) {
        const wpArtistId = Number(sa.artist_id);
        const wpArtistSlug = wpArtistIdToSlug.get(wpArtistId);
        if (!wpArtistSlug) continue;
        const ra = registryArtistBySlug.get(wpArtistSlug);
        if (!ra) { stats.skipped_no_registry_match++; continue; }
        const isPrimary = Number(sa.is_primary) === 1;
        const role = clean(sa.role) || "primary_artist";
        releaseArtistRows.push({
          id: crypto.randomUUID(),
          release_id: releaseId,
          artist_id: ra.id,
          artist_slug: ra.slug,
          artist_name_text: ra.display_name,
          role,
          is_primary: isPrimary,
          is_featured: !isPrimary && role.includes("feat"),
          credit_order: isPrimary ? 0 : 1,
          source: "wkcharts_release_shell_artists",
          confidence: 95,
          status: "active",
          metadata: JSON.stringify({ wp_shell_artist_id: Number(sa.id), wp_artist_id: wpArtistId }),
        });
      }

      // Release tracks
      const sTracks = shellTracksMap.get(shellId) ?? [];
      for (const st of sTracks) {
        const wpTrackId = Number(st.track_id);
        const wpTrack = wpTrackById.get(wpTrackId);
        if (!wpTrack) continue;

        const trackTitle = clean(wpTrack.title);
        const trackIsrc = clean(wpTrack.isrc) || null;
        const trackArtworkUrl = clean(wpTrack.artwork_url) || artworkUrl || null;
        const durationMs = wpTrack.duration ? Math.round(Number(wpTrack.duration) * 1000) : null;
        const trackNumber = Number(st.track_number || wpTrack.track_number || 0);
        const discNumber = Number(st.disc_number || 1);

        let existingTrackId = trackIsrc ? existingTrackByIsrc.get(trackIsrc) : undefined;
        const rawTrackSlug = clean(wpTrack.slug) || slugify(trackTitle);
        if (!existingTrackId) existingTrackId = existingTrackBySlug.get(rawTrackSlug);

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
            metadata: JSON.stringify({
              wp_track_id: wpTrackId,
              spotify_id: clean(wpTrack.spotify_id) || null,
              apple_music_id: clean(wpTrack.apple_music_id) || null,
              youtube_id: clean(wpTrack.youtube_id) || null,
              source: "wkcharts_tracks",
            }),
          });
        } else {
          trackId = wpTrackIdToRegistryId.get(wpTrackId)!;
        }

        releaseTrackRows.push({
          id: crypto.randomUUID(),
          release_id: releaseId,
          track_id: trackId,
          disc_number: discNumber,
          track_number: trackNumber || null,
          source: "wkcharts_release_shell_tracks",
          confidence: 95,
          status: "active",
          metadata: JSON.stringify({ wp_shell_track_id: Number(st.id) }),
        });
      }
    }

    // ── 12. Standalone tracks ────────────────────────────────────────────
    const shellTrackWpIds = new Set<number>();
    for (const [, tracks] of shellTracksMap) {
      for (const st of tracks) shellTrackWpIds.add(Number(st.track_id));
    }

    let standaloneAdded = 0;
    for (const wpTrack of wpTracks) {
      const wpTrackId = Number(wpTrack.id);
      if (shellTrackWpIds.has(wpTrackId)) continue;
      if (wpTrackIdToRegistryId.has(wpTrackId)) continue;

      const trackTitle = clean(wpTrack.title);
      const trackIsrc = clean(wpTrack.isrc) || null;
      const rawTrackSlug = clean(wpTrack.slug) || slugify(trackTitle);

      let existingTrackId = trackIsrc ? existingTrackByIsrc.get(trackIsrc) : undefined;
      if (!existingTrackId) existingTrackId = existingTrackBySlug.get(rawTrackSlug);
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
        metadata: JSON.stringify({
          wp_track_id: wpTrackId,
          spotify_id: clean(wpTrack.spotify_id) || null,
          apple_music_id: clean(wpTrack.apple_music_id) || null,
          youtube_id: clean(wpTrack.youtube_id) || null,
          source: "wkcharts_tracks",
        }),
      });
      standaloneAdded++;
    }
    stats.standalone_tracks_added = standaloneAdded;

    // ── 13. Track-artist links ───────────────────────────────────────────
    const trackArtistRows: Record<string, unknown>[] = [];
    for (const ta of wpTrackArtists) {
      const wpTrackId = Number(ta.track_id);
      const wpArtistId = Number(ta.artist_id);
      const tId = wpTrackIdToRegistryId.get(wpTrackId);
      if (!tId) continue;
      const wpArtistSlug = wpArtistIdToSlug.get(wpArtistId);
      if (!wpArtistSlug) continue;
      const ra = registryArtistBySlug.get(wpArtistSlug);
      if (!ra) continue;
      const isPrimary = Number(ta.is_primary) === 1;
      const role = clean(ta.role) || "primary_artist";
      trackArtistRows.push({
        id: crypto.randomUUID(),
        track_id: tId,
        artist_id: ra.id,
        artist_slug: ra.slug,
        artist_name_text: ra.display_name,
        role,
        is_primary: isPrimary,
        is_featured: !isPrimary && role.includes("feat"),
        credit_order: isPrimary ? 0 : 1,
        source: "wkcharts_track_artists",
        confidence: 95,
        status: "active",
        metadata: JSON.stringify({ wp_track_artist_id: Number(ta.id) }),
      });
    }

    stats.releases_upserted = releaseRows.length;
    stats.tracks_upserted = trackRows.length;
    stats.release_artists_upserted = releaseArtistRows.length;
    stats.release_tracks_upserted = releaseTrackRows.length;
    stats.track_artists_upserted = trackArtistRows.length;

    info(`Releases to upsert: ${releaseRows.length}`);
    info(`Tracks to upsert: ${trackRows.length}`);
    info(`Release-artist links: ${releaseArtistRows.length}`);
    info(`Release-track links: ${releaseTrackRows.length}`);
    info(`Standalone tracks: ${standaloneAdded}`);
    info(`Track-artist links: ${trackArtistRows.length}`);

    // ── 14. COMMIT ───────────────────────────────────────────────────────
    if (COMMIT) {
      console.log("\n── Writing to Supabase ──");

      if (releaseRows.length > 0) {
        info(`Inserting ${releaseRows.length} releases...`);
        await batchUpsert(pool, "registry_releases", releaseRows, "slug");
        info(`Releases done.`);
      }
      if (trackRows.length > 0) {
        info(`Inserting ${trackRows.length} tracks...`);
        await batchUpsert(pool, "registry_tracks", trackRows, "slug");
        info(`Tracks done.`);
      }
      if (releaseArtistRows.length > 0) {
        const releaseIds = [...new Set(releaseArtistRows.map((r) => String(r.release_id)))];
        for (let i = 0; i < releaseIds.length; i += 200) {
          await pool.query(
            `DELETE FROM registry_release_artists WHERE release_id = ANY($1::uuid[]) AND source = 'wkcharts_release_shell_artists'`,
            [releaseIds.slice(i, i + 200)],
          );
        }
        info(`Inserting ${releaseArtistRows.length} release-artist links...`);
        await batchInsert(pool, "registry_release_artists", releaseArtistRows);
        info(`Release-artist links done.`);
      }
      if (releaseTrackRows.length > 0) {
        const releaseIds = [...new Set(releaseTrackRows.map((r) => String(r.release_id)))];
        for (let i = 0; i < releaseIds.length; i += 200) {
          await pool.query(
            `DELETE FROM registry_release_tracks WHERE release_id = ANY($1::uuid[]) AND source = 'wkcharts_release_shell_tracks'`,
            [releaseIds.slice(i, i + 200)],
          );
        }
        info(`Inserting ${releaseTrackRows.length} release-track links...`);
        await batchInsert(pool, "registry_release_tracks", releaseTrackRows);
        info(`Release-track links done.`);
      }
      if (trackArtistRows.length > 0) {
        const trackIds = [...new Set(trackArtistRows.map((r) => String(r.track_id)))];
        for (let i = 0; i < trackIds.length; i += 200) {
          await pool.query(
            `DELETE FROM registry_track_artists WHERE track_id = ANY($1::uuid[]) AND source = 'wkcharts_track_artists'`,
            [trackIds.slice(i, i + 200)],
          );
        }
        info(`Inserting ${trackArtistRows.length} track-artist links...`);
        await batchInsert(pool, "registry_track_artists", trackArtistRows);
        info(`Track-artist links done.`);
      }

      console.log("\n✓ COMMIT COMPLETE");
    } else {
      console.log("\n── DRY RUN (no writes) ──");
      console.log("  Pass --commit to write to Supabase.");
    }

    // ── 15. Summary ──────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  SUMMARY");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  WP artists:               ${stats.wp_artists}`);
    console.log(`  WP releases (shells):     ${stats.wp_releases}`);
    console.log(`  WP tracks:                ${stats.wp_tracks}`);
    console.log(`  WP track artists:         ${stats.wp_track_artists}`);
    console.log(`  WP shell artists:         ${stats.wp_release_shell_artists}`);
    console.log(`  WP shell tracks:          ${stats.wp_release_shell_tracks}`);
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  Artists enriched:         ${stats.artists_enriched}`);
    console.log(`  Releases ${COMMIT ? "inserted" : "to insert"}:      ${stats.releases_upserted}`);
    console.log(`  Tracks ${COMMIT ? "inserted" : "to insert"}:         ${stats.tracks_upserted}`);
    console.log(`  Standalone tracks:        ${stats.standalone_tracks_added}`);
    console.log(`  Release-artist links:     ${stats.release_artists_upserted}`);
    console.log(`  Release-track links:      ${stats.release_tracks_upserted}`);
    console.log(`  Track-artist links:       ${stats.track_artists_upserted}`);
    console.log(`  Skipped (no registry):    ${stats.skipped_no_registry_match}`);
    console.log(`  Errors:                   ${stats.errors}`);
    console.log("═══════════════════════════════════════════════════════");

    if (stats.errors > 0) {
      const errorLines = log.filter((l) => l.startsWith("ERROR:"));
      console.log("\n  Errors encountered:");
      for (const e of errorLines) console.log(`    ${e}`);
    }
  } finally {
    await wp.end();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("\n[enrich] FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});