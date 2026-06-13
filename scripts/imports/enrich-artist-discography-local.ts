/**
 * enrich-artist-discography-local.ts
 *
 * LOCAL Node.js script — run this directly on the WordPress server.
 *
 * Reads WordPress MySQL tables and enriches Supabase registry.
 *
 * DRY RUN by default — pass --commit to actually write.
 *
 * USAGE:
 *   ./run-enrich.sh              # dry run
 *   ./run-enrich.sh --commit     # real write
 *   ./run-enrich.sh --commit --limit 10
 */

import mysql from "mysql2/promise";
import pg from "pg";
import crypto from "node:crypto";

// ── CLI ────────────────────────────────────────────────────────────────────
function arg(name: string) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function hasFlag(name: string) { return process.argv.includes(name); }
function required(v: string | undefined, label: string) { if (!v) throw new Error(`${label} required`); return v; }
function normalizeDbUrl(url: string) { try { const u = new URL(url); u.searchParams.delete("sslmode"); return u.toString(); } catch { return url; } }

const COMMIT = hasFlag("--commit");
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

// ── Utils ──────────────────────────────────────────────────────────────────
function clean(v: unknown): string { return String(v ?? "").trim(); }
function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}
function parseDate(v: unknown): string | null {
  if (!v) return null; const s = String(v).trim();
  if (!s || s === "0000-00-00") return null;
  const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}
function parseReleaseType(t: string): string {
  const l = t.toLowerCase();
  if (l.includes("album") || l === "lp") return "album";
  if (l.includes("ep") || l === "extended play") return "ep";
  if (l.includes("single")) return "single";
  if (l.includes("compilation") || l.includes("mixtape")) return l;
  return "album";
}
function normalizeArtistType(t: string): string {
  const l = t.toLowerCase().trim();
  if (!l || l === "not_applicable") return "unknown";
  // Direct matches first
  if (["solo", "group", "collective", "band", "duo", "unknown"].includes(l)) return l;
  // Map common WP/legacy values
  if (["musician", "artist", "rapper", "singer", "producer", "dj", "composer", "songwriter", "performer"].includes(l)) return "solo";
  if (["trio", "quartet", "quintet", "ensemble", "orchestra", "choir"].includes(l)) return "group";
  if (["duo_act"].includes(l)) return "duo";
  return "unknown";
}
function dedupeSlug(base: string, seen: Set<string>): string {
  if (!seen.has(base)) { seen.add(base); return base; }
  let i = 2; while (seen.has(`${base}-${i}`)) i++;
  const s = `${base}-${i}`; seen.add(s); return s;
}
function t(prefix: string, name: string) { return `\`${prefix}${name}\``; }

// ── Stats ──────────────────────────────────────────────────────────────────
const stats = {
  wpArtists: 0, wpShells: 0, wpShellArtists: 0, wpShellTracks: 0, wpTracks: 0, wpTrackArtists: 0,
  artistsEnriched: 0, releasesUpserted: 0, tracksUpserted: 0,
  releaseArtistsUpserted: 0, releaseTracksUpserted: 0, trackArtistsUpserted: 0,
  standaloneTracks: 0, errors: 0, skippedNoMatch: 0,
};

const BATCH = 200;

async function batchUpsert(pool: pg.Pool, table: string, rows: Record<string,unknown>[], conflict: string) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(", ");
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const vals: unknown[] = [];
    const groups = batch.map((row, ri) => {
      const base = ri * cols.length;
      cols.forEach(c => vals.push(row[c] ?? null));
      return `(${cols.map((_, j) => `$${base + j + 1}`).join(", ")})`;
    });
    const setClause = cols.filter(c => c !== conflict && c !== "id").map(c => `"${c}" = EXCLUDED."${c}"`).join(", ");
    await pool.query(`INSERT INTO "${table}" (${colList}) VALUES ${groups.join(", ")} ON CONFLICT ("${conflict}") DO UPDATE SET ${setClause}`, vals);
  }
}

async function batchInsert(pool: pg.Pool, table: string, rows: Record<string,unknown>[]) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(", ");
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const vals: unknown[] = [];
    const groups = batch.map((row, ri) => {
      const base = ri * cols.length;
      cols.forEach(c => vals.push(row[c] ?? null));
      return `(${cols.map((_, j) => `$${base + j + 1}`).join(", ")})`;
    });
    await pool.query(`INSERT INTO "${table}" (${colList}) VALUES ${groups.join(", ")}`, vals);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Wakilisha Artist Discography Enrichment v2 (LOCAL)");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Mode:       ${COMMIT ? "COMMIT" : "DRY RUN"}`);
  console.log(`  WP MySQL:   ${WP.user}@${WP.host}:${WP.port}/${WP.database}`);
  if (LIMIT > 0) console.log(`  Limit:      ${LIMIT} artists`);
  console.log("═══════════════════════════════════════════════════════\n");

  const wp = await mysql.createConnection({ host: WP.host, port: WP.port, user: WP.user, password: WP.password, database: WP.database, connectTimeout: 20000 });
  await wp.ping();
  console.log("[enrich] Connected to WordPress MySQL");

  const pool = new pg.Pool({ connectionString: normalizeDbUrl(DATABASE_URL), ssl: { rejectUnauthorized: false }, max: 4 });

  try {
    // ════════════════════════════════════════════════════════════════════
    // 1. Load registry artists (Supabase)
    // ════════════════════════════════════════════════════════════════════
    const raRes = await pool.query(`SELECT id, slug, display_name, public_image_url, bio, origin_iso2, artist_type, metadata FROM registry_artists`);
    const regArtistBySlug = new Map<string, { id: string; slug: string; display_name: string; public_image_url: string|null; bio: string|null; origin_iso2: string|null; artist_type: string|null; metadata: Record<string,unknown>; }>();
    for (const r of raRes.rows) regArtistBySlug.set(String(r.slug), r);
    console.log(`[enrich] Registry artists: ${regArtistBySlug.size}`);

    // ════════════════════════════════════════════════════════════════════
    // 2. Load WP artists
    // ════════════════════════════════════════════════════════════════════
    let wpAQuery = `SELECT id, post_id, slug, display_name, normalized_name, country_iso2, artist_type, apple_artist_id, spotify_artist_id, image_url, status_flags FROM ${t(WP.prefix, "wkcharts_artists")}`;
    if (LIMIT > 0) wpAQuery += ` LIMIT ${LIMIT}`;
    const [wpARows] = await wp.query(wpAQuery);
    const wpArtists = wpARows as Record<string,unknown>[];
    stats.wpArtists = wpArtists.length;
    console.log(`[enrich] WP artists: ${wpArtists.length}`);

    // Build maps: wp.id → slug, wp.post_id → slug
    const wpIdToSlug = new Map<number, string>();
    const wpPostIdToSlug = new Map<number, string>();
    for (const a of wpArtists) {
      const id = Number(a.id);
      const pid = Number(a.post_id);
      const s = clean(a.slug);
      wpIdToSlug.set(id, s);
      if (pid && pid > 0) wpPostIdToSlug.set(pid, s);
    }

    // ════════════════════════════════════════════════════════════════════
    // 3. Enrich registry artists from WP data
    // ════════════════════════════════════════════════════════════════════
    if (COMMIT) {
      let enriched = 0;
      for (const wa of wpArtists) {
        const wpSlug = clean(wa.slug);
        const ra = regArtistBySlug.get(wpSlug);
        if (!ra) { stats.skippedNoMatch++; continue; }
        const patch: Record<string,unknown> = {};
        if (clean(wa.image_url) && !ra.public_image_url) patch.public_image_url = clean(wa.image_url);
        if (clean(wa.country_iso2) && !ra.origin_iso2) patch.origin_iso2 = clean(wa.country_iso2);
        if (clean(wa.artist_type) && !ra.artist_type) patch.artist_type = normalizeArtistType(clean(wa.artist_type));
        const meta = (ra.metadata || {}) as Record<string,unknown>;
        const metaP: Record<string,unknown> = {};
        if (clean(wa.spotify_artist_id) && !meta.spotify_artist_id) metaP.spotify_artist_id = clean(wa.spotify_artist_id);
        if (clean(wa.apple_artist_id) && !meta.apple_music_id) metaP.apple_music_id = clean(wa.apple_artist_id);
        if (Object.keys(metaP).length > 0) patch.metadata = { ...meta, ...metaP };
        if (Object.keys(patch).length > 0) {
          const keys = Object.keys(patch);
          const setClause = keys.map((k,i) => `"${k}" = $${i+2}`).join(", ");
          await pool.query(`UPDATE registry_artists SET ${setClause} WHERE id = $1`, [ra.id, ...Object.values(patch)]);
          enriched++;
        }
      }
      stats.artistsEnriched = enriched;
      console.log(`[enrich] Artists enriched: ${enriched}`);
    } else {
      for (const wa of wpArtists) {
        const wpSlug = clean(wa.slug);
        const ra = regArtistBySlug.get(wpSlug);
        if (!ra) { stats.skippedNoMatch++; continue; }
        if ((clean(wa.image_url) && !ra.public_image_url) || (clean(wa.country_iso2) && !ra.origin_iso2) || (clean(wa.artist_type) && !ra.artist_type) || (clean(wa.spotify_artist_id) && !(ra.metadata as Record<string,unknown>)?.spotify_artist_id) || (clean(wa.apple_artist_id) && !(ra.metadata as Record<string,unknown>)?.apple_music_id)) {
          stats.artistsEnriched++;
        }
      }
      console.log(`[enrich] Would enrich: ${stats.artistsEnriched} (dry run)`);
    }

    // ════════════════════════════════════════════════════════════════════
    // 4. Load WP release shells
    // ════════════════════════════════════════════════════════════════════
    let shellQ = `SELECT id, shell_uuid, status, artist_post_id, artist_name_raw, title_raw, title_normalized, release_type_guess, release_date, artwork_url FROM ${t(WP.prefix, "wkcharts_release_shells")} WHERE status != 'ignored'`;
    if (LIMIT > 0) shellQ += ` LIMIT ${LIMIT * 10}`;
    const [shellRows] = await wp.query(shellQ);
    const wpShells = shellRows as Record<string,unknown>[];
    stats.wpShells = wpShells.length;
    console.log(`[enrich] WP shells: ${wpShells.length}`);

    // ════════════════════════════════════════════════════════════════════
    // 5. Load shell artists
    // ════════════════════════════════════════════════════════════════════
    const [saRows] = await wp.query(`SELECT id, shell_id, artist_name, artist_post_id, role, confidence FROM ${t(WP.prefix, "wkcharts_release_shell_artists")}`);
    const wpShellArtists = saRows as Record<string,unknown>[];
    stats.wpShellArtists = wpShellArtists.length;
    console.log(`[enrich] WP shell artists: ${wpShellArtists.length}`);

    const shellArtistsMap = new Map<number, Record<string,unknown>[]>();
    for (const sa of wpShellArtists) {
      const sid = Number(sa.shell_id);
      if (!shellArtistsMap.has(sid)) shellArtistsMap.set(sid, []);
      shellArtistsMap.get(sid)!.push(sa);
    }

    // ════════════════════════════════════════════════════════════════════
    // 6. Load shell tracks
    // ════════════════════════════════════════════════════════════════════
    const [stRows] = await wp.query(`SELECT id, shell_id, track_number, disc_number, title_raw, title_normalized, duration_ms, isrc, artwork_url FROM ${t(WP.prefix, "wkcharts_release_shell_tracks")}`);
    const wpShellTracks = stRows as Record<string,unknown>[];
    stats.wpShellTracks = wpShellTracks.length;
    console.log(`[enrich] WP shell tracks: ${wpShellTracks.length}`);

    const shellTracksMap = new Map<number, Record<string,unknown>[]>();
    for (const st of wpShellTracks) {
      const sid = Number(st.shell_id);
      if (!shellTracksMap.has(sid)) shellTracksMap.set(sid, []);
      shellTracksMap.get(sid)!.push(st);
    }

    // ════════════════════════════════════════════════════════════════════
    // 7. Load WP tracks (unified track table)
    // ════════════════════════════════════════════════════════════════════
    const [tRows] = await wp.query(`SELECT id, normalized_key, title, artist_name, display_artist_line, artwork_url, isrc, duration_ms, release_id, metadata_confidence FROM ${t(WP.prefix, "wkcharts_tracks")}`);
    const wpTracks = tRows as Record<string,unknown>[];
    stats.wpTracks = wpTracks.length;
    console.log(`[enrich] WP tracks: ${wpTracks.length}`);

    // ════════════════════════════════════════════════════════════════════
    // 8. Load track artists
    // ════════════════════════════════════════════════════════════════════
    const [taRows] = await wp.query(`SELECT id, track_id, artist_id, sort_order, role, confidence FROM ${t(WP.prefix, "wkcharts_track_artists")}`);
    const wpTrackArtists = taRows as Record<string,unknown>[];
    stats.wpTrackArtists = wpTrackArtists.length;
    console.log(`[enrich] WP track artists: ${wpTrackArtists.length}`);

    const trackArtistsMap = new Map<number, Record<string,unknown>[]>();
    for (const ta of wpTrackArtists) {
      const tid = Number(ta.track_id);
      if (!trackArtistsMap.has(tid)) trackArtistsMap.set(tid, []);
      trackArtistsMap.get(tid)!.push(ta);
    }

    // ════════════════════════════════════════════════════════════════════
    // 9. Load existing Supabase releases
    // ════════════════════════════════════════════════════════════════════
    const exRel = await pool.query(`SELECT id, slug FROM registry_releases`);
    const existReleaseBySlug = new Map<string, string>();
    for (const r of exRel.rows) existReleaseBySlug.set(String(r.slug), String(r.id));
    const seenReleaseSlugs = new Set(existReleaseBySlug.keys());

    // ════════════════════════════════════════════════════════════════════
    // 10. Load existing Supabase tracks
    // ════════════════════════════════════════════════════════════════════
    const exTrk = await pool.query(`SELECT id, slug, isrc FROM registry_tracks`);
    const existTrackByIsrc = new Map<string, string>();
    const existTrackBySlug = new Map<string, string>();
    for (const t of exTrk.rows) {
      existTrackBySlug.set(String(t.slug), String(t.id));
      if (t.isrc) existTrackByIsrc.set(String(t.isrc), String(t.id));
    }
    const seenTrackSlugs = new Set(existTrackBySlug.keys());

    // ════════════════════════════════════════════════════════════════════
    // 11. Process releases + tracks
    // ════════════════════════════════════════════════════════════════════
    const releaseRows: Record<string,unknown>[] = [];
    const releaseArtistRows: Record<string,unknown>[] = [];
    const trackRows: Record<string,unknown>[] = [];
    const releaseTrackRows: Record<string,unknown>[] = [];

    const shellIdToRegReleaseId = new Map<number, string>();
    const wpTrackIdToRegTrackId = new Map<number, string>();

    for (const shell of wpShells) {
      const shellId = Number(shell.id);
      const rawTitle = clean(shell.title_raw) || clean(shell.title_normalized) || `Release ${shellId}`;
      const rawSlug = slugify(rawTitle);
      const releaseSlug = dedupeSlug(rawSlug, seenReleaseSlugs);

      let releaseId: string;
      if (existReleaseBySlug.has(rawSlug)) {
        releaseId = existReleaseBySlug.get(rawSlug)!;
      } else {
        releaseId = crypto.randomUUID();
        shellIdToRegReleaseId.set(shellId, releaseId);
        releaseRows.push({
          id: releaseId, slug: releaseSlug,
          title: rawTitle,
          normalized_title: rawTitle.toLowerCase(),
          release_type: parseReleaseType(clean(shell.release_type_guess) || "album"),
          release_date: parseDate(shell.release_date),
          artwork_url: clean(shell.artwork_url) || null,
          status: "active",
          metadata: JSON.stringify({ wp_shell_id: shellId, wp_shell_uuid: clean(shell.shell_uuid) }),
        });
      }
      shellIdToRegReleaseId.set(shellId, releaseId);

      // Release artists (from shell_artists, resolved via artist_post_id → wp_artists.post_id → slug)
      const sArtists = shellArtistsMap.get(shellId) ?? [];
      for (const sa of sArtists) {
        const wpPostId = Number(sa.artist_post_id);
        const wpSlug = wpPostIdToSlug.get(wpPostId);
        if (!wpSlug) continue;
        const ra = regArtistBySlug.get(wpSlug);
        if (!ra) { stats.skippedNoMatch++; continue; }
        const isPrimary = clean(sa.role) === "primary";
        const conf = sa.confidence ? Math.round(Number(sa.confidence) * 100) : 95;
        releaseArtistRows.push({
          id: crypto.randomUUID(), release_id: releaseId, artist_id: ra.id,
          artist_slug: ra.slug, artist_name_text: ra.display_name,
          role: clean(sa.role) || "primary_artist", is_primary: isPrimary,
          is_featured: false, credit_order: isPrimary ? 0 : 1,
          source: "wkcharts_release_shell_artists", confidence: conf, status: "active",
          metadata: JSON.stringify({ wp_shell_artist_id: Number(sa.id), wp_artist_post_id: wpPostId }),
        });
      }

      // Release tracks (from shell_tracks, cross-reference with wp_wkcharts_tracks by title/artist)
      const sTracks = shellTracksMap.get(shellId) ?? [];
      for (const st of sTracks) {
        const stTitle = clean(st.title_raw) || clean(st.title_normalized) || "Unknown Track";
        const stIsrc = clean(st.isrc) || null;
        const trackNum = Number(st.track_number || 0);
        const discNum = Number(st.disc_number || 1);
        const durMs = st.duration_ms ? Number(st.duration_ms) : null;
        const artworkUrl = clean(st.artwork_url) || clean(shell.artwork_url) || null;

        // Try to find this track in wp_wkcharts_tracks by ISRC first, then by title
        let existingWpTrackId: number | undefined;
        let existingRegTrackId: string | undefined;

        if (stIsrc) {
          for (const wt of wpTracks) {
            if (clean(wt.isrc) === stIsrc) { existingWpTrackId = Number(wt.id); break; }
          }
          existingRegTrackId = existTrackByIsrc.get(stIsrc);
        }
        if (!existingWpTrackId && !existingRegTrackId) {
          const stNorm = stTitle.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
          for (const wt of wpTracks) {
            const wtNorm = clean(wt.title).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
            if (wtNorm === stNorm) { existingWpTrackId = Number(wt.id); break; }
          }
        }

        let trackId: string;
        const rawTrackSlug = slugify(stTitle);

        if (existingRegTrackId) {
          trackId = existingRegTrackId;
          if (existingWpTrackId) wpTrackIdToRegTrackId.set(existingWpTrackId, trackId);
        } else if (existingWpTrackId && wpTrackIdToRegTrackId.has(existingWpTrackId)) {
          trackId = wpTrackIdToRegTrackId.get(existingWpTrackId)!;
        } else {
          // Check existing slugs
          const alreadyExists = existTrackBySlug.get(rawTrackSlug);
          if (alreadyExists) {
            trackId = alreadyExists;
          } else {
            trackId = crypto.randomUUID();
            const trackSlug = dedupeSlug(rawTrackSlug, seenTrackSlugs);
            existTrackBySlug.set(trackSlug, trackId);
            if (stIsrc) existTrackByIsrc.set(stIsrc, trackId);

            trackRows.push({
              id: trackId, slug: trackSlug,
              title: stTitle, normalized_title: stTitle.toLowerCase(),
              isrc: stIsrc, release_id: releaseId,
              duration_ms: durMs, explicit: false,
              track_number: trackNum || null, disc_number: discNum || 1,
              artwork_url: artworkUrl, status: "active",
              metadata: JSON.stringify({ wp_shell_track_id: Number(st.id), source: "wkcharts_release_shell_tracks" }),
            });
          }
          if (existingWpTrackId) wpTrackIdToRegTrackId.set(existingWpTrackId, trackId);
        }

        releaseTrackRows.push({
          id: crypto.randomUUID(), release_id: releaseId, track_id: trackId,
          disc_number: discNum || 1, track_number: trackNum || null,
          source: "wkcharts_release_shell_tracks", confidence: 95, status: "active",
          metadata: JSON.stringify({ wp_shell_track_id: Number(st.id) }),
        });
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // 12. Standalone tracks (tracks in wp_wkcharts_tracks not in any shell)
    // ════════════════════════════════════════════════════════════════════
    const shellLinkedTrackIds = new Set<number>();
    for (const [,tracks] of shellTracksMap) {
      for (const st of tracks) {
        // find matching wp track
        const stIsrc = clean(st.isrc);
        for (const wt of wpTracks) {
          if (stIsrc && clean(wt.isrc) === stIsrc) { shellLinkedTrackIds.add(Number(wt.id)); break; }
        }
      }
    }

    let standaloneAdded = 0;
    for (const wt of wpTracks) {
      const wtId = Number(wt.id);
      if (shellLinkedTrackIds.has(wtId)) continue;
      if (wpTrackIdToRegTrackId.has(wtId)) continue;

      const wtTitle = clean(wt.title);
      const wtIsrc = clean(wt.isrc) || null;
      const rawSlug = slugify(wtTitle);

      let existingId = wtIsrc ? existTrackByIsrc.get(wtIsrc) : undefined;
      if (!existingId) existingId = existTrackBySlug.get(rawSlug);
      if (existingId) { wpTrackIdToRegTrackId.set(wtId, existingId); continue; }

      const trackId = crypto.randomUUID();
      const trackSlug = dedupeSlug(rawSlug, seenTrackSlugs);
      wpTrackIdToRegTrackId.set(wtId, trackId);
      existTrackBySlug.set(trackSlug, trackId);
      if (wtIsrc) existTrackByIsrc.set(wtIsrc, trackId);

      trackRows.push({
        id: trackId, slug: trackSlug,
        title: wtTitle, normalized_title: wtTitle.toLowerCase(),
        isrc: wtIsrc, release_id: null,
        duration_ms: wt.duration_ms ? Number(wt.duration_ms) : null,
        explicit: false, track_number: null, disc_number: 1,
        artwork_url: clean(wt.artwork_url) || null, status: "active",
        metadata: JSON.stringify({ wp_track_id: wtId, source: "wkcharts_tracks" }),
      });
      standaloneAdded++;
    }
    stats.standaloneTracks = standaloneAdded;

    // ════════════════════════════════════════════════════════════════════
    // 13. Track-artist links
    // ════════════════════════════════════════════════════════════════════
    const trackArtistRows: Record<string,unknown>[] = [];
    for (const ta of wpTrackArtists) {
      const wpTrackId = Number(ta.track_id);
      const wpArtistId = Number(ta.artist_id);
      const regTrackId = wpTrackIdToRegTrackId.get(wpTrackId);
      if (!regTrackId) continue;
      const wpSlug = wpIdToSlug.get(wpArtistId);
      if (!wpSlug) continue;
      const ra = regArtistBySlug.get(wpSlug);
      if (!ra) continue;
      const isPrimary = clean(ta.role) === "primary";
      const sortOrder = Number(ta.sort_order || 0);
      const conf = ta.confidence ? Math.round(Number(ta.confidence) * 100) : 95;
      trackArtistRows.push({
        id: crypto.randomUUID(), track_id: regTrackId, artist_id: ra.id,
        artist_slug: ra.slug, artist_name_text: ra.display_name,
        role: clean(ta.role) || "primary", is_primary: isPrimary,
        is_featured: false, credit_order: sortOrder || (isPrimary ? 0 : 1),
        source: "wkcharts_track_artists", confidence: conf, status: "active",
        metadata: JSON.stringify({ wp_track_artist_id: Number(ta.id) }),
      });
    }

    stats.releasesUpserted = releaseRows.length;
    stats.tracksUpserted = trackRows.length;
    stats.releaseArtistsUpserted = releaseArtistRows.length;
    stats.releaseTracksUpserted = releaseTrackRows.length;
    stats.trackArtistsUpserted = trackArtistRows.length;

    console.log(`\n[enrich] Releases to upsert:     ${releaseRows.length}`);
    console.log(`[enrich] Tracks to upsert:        ${trackRows.length}`);
    console.log(`[enrich] Release-artist links:    ${releaseArtistRows.length}`);
    console.log(`[enrich] Release-track links:     ${releaseTrackRows.length}`);
    console.log(`[enrich] Standalone tracks:       ${standaloneAdded}`);
    console.log(`[enrich] Track-artist links:      ${trackArtistRows.length}`);

    // ════════════════════════════════════════════════════════════════════
    // 14. COMMIT
    // ════════════════════════════════════════════════════════════════════
    if (COMMIT) {
      console.log("\n── Writing to Supabase ──");
      if (releaseRows.length > 0) { console.log(`[enrich] Inserting ${releaseRows.length} releases...`); await batchUpsert(pool, "registry_releases", releaseRows, "slug"); }
      if (trackRows.length > 0) { console.log(`[enrich] Inserting ${trackRows.length} tracks...`); await batchUpsert(pool, "registry_tracks", trackRows, "slug"); }

      if (releaseArtistRows.length > 0) {
        const rids = [...new Set(releaseArtistRows.map(r => String(r.release_id)))];
        for (let i = 0; i < rids.length; i += 200) {
          await pool.query(`DELETE FROM registry_release_artists WHERE release_id = ANY($1::uuid[]) AND source = 'wkcharts_release_shell_artists'`, [rids.slice(i, i + 200)]);
        }
        await batchInsert(pool, "registry_release_artists", releaseArtistRows);
      }
      if (releaseTrackRows.length > 0) {
        const rids = [...new Set(releaseTrackRows.map(r => String(r.release_id)))];
        for (let i = 0; i < rids.length; i += 200) {
          await pool.query(`DELETE FROM registry_release_tracks WHERE release_id = ANY($1::uuid[]) AND source = 'wkcharts_release_shell_tracks'`, [rids.slice(i, i + 200)]);
        }
        await batchInsert(pool, "registry_release_tracks", releaseTrackRows);
      }
      if (trackArtistRows.length > 0) {
        const tids = [...new Set(trackArtistRows.map(r => String(r.track_id)))];
        for (let i = 0; i < tids.length; i += 200) {
          await pool.query(`DELETE FROM registry_track_artists WHERE track_id = ANY($1::uuid[]) AND source = 'wkcharts_track_artists'`, [tids.slice(i, i + 200)]);
        }
        await batchInsert(pool, "registry_track_artists", trackArtistRows);
      }
      console.log("\n✓ COMMIT COMPLETE");
    } else {
      console.log("\n── DRY RUN (no writes) ──");
      console.log("  Pass --commit to write to Supabase.");
    }

    // ════════════════════════════════════════════════════════════════════
    // 15. Summary
    // ════════════════════════════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  SUMMARY");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  WP artists:              ${stats.wpArtists}`);
    console.log(`  WP release shells:       ${stats.wpShells}`);
    console.log(`  WP shell artists:        ${stats.wpShellArtists}`);
    console.log(`  WP shell tracks:         ${stats.wpShellTracks}`);
    console.log(`  WP tracks:               ${stats.wpTracks}`);
    console.log(`  WP track artists:        ${stats.wpTrackArtists}`);
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  Artists enriched:        ${stats.artistsEnriched}`);
    console.log(`  Releases ${COMMIT ? "inserted" : "to insert"}:     ${stats.releasesUpserted}`);
    console.log(`  Tracks ${COMMIT ? "inserted" : "to insert"}:        ${stats.tracksUpserted}`);
    console.log(`  Standalone tracks:       ${stats.standaloneTracks}`);
    console.log(`  Release-artist links:    ${stats.releaseArtistsUpserted}`);
    console.log(`  Release-track links:     ${stats.releaseTracksUpserted}`);
    console.log(`  Track-artist links:      ${stats.trackArtistsUpserted}`);
    console.log(`  Skipped (no match):      ${stats.skippedNoMatch}`);
    console.log(`  Errors:                  ${stats.errors}`);
    console.log("═══════════════════════════════════════════════════════");
  } finally {
    await wp.end();
    await pool.end();
  }
}

main().catch(e => { console.error("\n[enrich] FATAL:", e instanceof Error ? e.message : String(e)); process.exit(1); });