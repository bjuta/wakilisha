#!/usr/bin/env node
/**
 * run-enrich-4mr-standalone.mjs
 *
 * STANDALONE SCRIPT — copy this single file to the WordPress server and run it.
 * No project dependencies. Just needs mysql2 + pg installed.
 *
 * USAGE (on the WP server):
 *   npm install mysql2 pg
 *   DATABASE_URL="postgresql://..." node run-enrich-4mr-standalone.mjs
 */

import mysql from "mysql2/promise";
import pg from "pg";
import crypto from "node:crypto";

// ── CONFIG (hardcoded for 4mr-frank-white) ─────────────────────────────────
const ARTIST_SLUG = "4mr-frank-white";
const COMMIT = true; // Live run — writes to Supabase

const WP = {
  host: "127.0.0.1",        // localhost on WP server
  port: 3306,
  user: "bn_wordpress",
  password: "236407f4e9404d1cd2215f9759d1ddc198d04fa6aaffc7d61fb98f1422c4eb0b",
  database: "bitnami_wordpress",
  prefix: "wp_",
};

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL env var not set.");
  process.exit(1);
}

function normalizeDbUrl(url) {
  try { const u = new URL(url); u.searchParams.delete("sslmode"); return u.toString(); } catch { return url; }
}

// ── Utils ──────────────────────────────────────────────────────────────────
const clean = (v) => String(v ?? "").trim();
const slugify = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);

const parseDate = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s === "0000-00-00") return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
};

const parseReleaseType = (t) => {
  const l = t.toLowerCase();
  if (l.includes("album") || l === "lp") return "album";
  if (l.includes("ep") || l === "extended play") return "ep";
  if (l.includes("single")) return "single";
  if (l.includes("compilation") || l.includes("mixtape")) return l;
  return "album";
};

const dedupeSlug = (base, seen) => {
  if (!seen.has(base)) { seen.add(base); return base; }
  let i = 2;
  while (seen.has(`${base}-${i}`)) i++;
  const s = `${base}-${i}`;
  seen.add(s);
  return s;
};

const t = (prefix, name) => `\`${prefix}${name}\``;

// ── Stats ──────────────────────────────────────────────────────────────────
const stats = {
  wpArtists: 0, wpShells: 0, wpShellArtists: 0, wpShellTracks: 0, wpTracks: 0, wpTrackArtists: 0,
  releasesUpserted: 0, tracksUpserted: 0,
  releaseArtistsUpserted: 0, releaseTracksUpserted: 0, trackArtistsUpserted: 0,
  standaloneTracks: 0, errors: 0, skippedNoMatch: 0,
};

// ── Batch helpers ──────────────────────────────────────────────────────────
const BATCH = 200;

async function batchUpsert(pool, table, rows, conflict) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const vals = [];
    const groups = batch.map((row, ri) => {
      const base = ri * cols.length;
      cols.forEach((c) => vals.push(row[c] ?? null));
      return `(${cols.map((_, j) => `$${base + j + 1}`).join(", ")})`;
    });
    const setClause = cols
      .filter((c) => c !== conflict && c !== "id")
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(", ");
    await pool.query(
      `INSERT INTO "${table}" (${colList}) VALUES ${groups.join(", ")} ON CONFLICT ("${conflict}") DO UPDATE SET ${setClause}`,
      vals
    );
  }
}

async function batchInsertOnConflict(pool, table, rows) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const vals = [];
    const groups = batch.map((row, ri) => {
      const base = ri * cols.length;
      cols.forEach((c) => vals.push(row[c] ?? null));
      return `(${cols.map((_, j) => `$${base + j + 1}`).join(", ")})`;
    });
    await pool.query(
      `INSERT INTO "${table}" (${colList}) VALUES ${groups.join(", ")} ON CONFLICT DO NOTHING`,
      vals
    );
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  4mr-frank-white Discography Enrichment");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Mode:       COMMIT (will write to Supabase)`);
  console.log(`  WP MySQL:   ${WP.user}@${WP.host}:${WP.port}/${WP.database}`);
  console.log(`  Artist:     ${ARTIST_SLUG}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // Connect WordPress MySQL (localhost)
  const wp = await mysql.createConnection({
    host: WP.host,
    port: WP.port,
    user: WP.user,
    password: WP.password,
    database: WP.database,
    connectTimeout: 20000,
  });
  await wp.ping();
  console.log("[enrich] Connected to WordPress MySQL on localhost");

  // Connect Supabase Postgres
  const pool = new pg.Pool({
    connectionString: normalizeDbUrl(DATABASE_URL),
    ssl: { rejectUnauthorized: false },
    max: 4,
    connectionTimeoutMillis: 30000,
  });
  // Test connection
  await pool.query("SELECT 1");
  console.log("[enrich] Connected to Supabase Postgres\n");

  try {
    // ════════════════════════════════════════════════════════════════════
    // 1. Load registry artists (Supabase)
    // ════════════════════════════════════════════════════════════════════
    const raRes = await pool.query(
      "SELECT id, slug, display_name FROM registry_artists"
    );
    const regArtistBySlug = new Map();
    for (const r of raRes.rows) regArtistBySlug.set(String(r.slug), r);
    console.log(`[enrich] Registry artists: ${regArtistBySlug.size}`);

    // ════════════════════════════════════════════════════════════════════
    // 2. Load WP artist (4mr-frank-white)
    // ════════════════════════════════════════════════════════════════════
    const [wpARows] = await wp.query(
      `SELECT id, post_id, slug, display_name FROM ${t(WP.prefix, "wkcharts_artists")} WHERE slug = ?`,
      [ARTIST_SLUG]
    );
    if (wpARows.length === 0) {
      console.error(`ERROR: Artist "${ARTIST_SLUG}" not found in WordPress!`);
      process.exit(1);
    }
    const wpArtist = wpARows[0];
    const wpPostId = Number(wpArtist.post_id);
    stats.wpArtists = 1;
    console.log(`[enrich] WP artist: ${wpArtist.display_name} (post_id=${wpPostId})`);

    // ════════════════════════════════════════════════════════════════════
    // 3. Load WP release shells (filtered by artist_post_id)
    // ════════════════════════════════════════════════════════════════════
    const [shellRows] = await wp.query(
      `SELECT id, shell_uuid, status, artist_post_id, artist_name_raw, title_raw, title_normalized, release_type_guess, release_date, artwork_url FROM ${t(WP.prefix, "wkcharts_release_shells")} WHERE status != 'ignored' AND artist_post_id = ?`,
      [wpPostId]
    );
    const wpShells = shellRows;
    stats.wpShells = wpShells.length;
    console.log(`[enrich] WP shells: ${wpShells.length}`);

    // ════════════════════════════════════════════════════════════════════
    // 4. Load shell artists
    // ════════════════════════════════════════════════════════════════════
    const [saRows] = await wp.query(
      `SELECT id, shell_id, artist_name, artist_post_id, role, confidence FROM ${t(WP.prefix, "wkcharts_release_shell_artists")}`
    );
    stats.wpShellArtists = saRows.length;
    console.log(`[enrich] WP shell artists: ${saRows.length}`);

    const shellArtistsMap = new Map();
    for (const sa of saRows) {
      const sid = Number(sa.shell_id);
      if (!shellArtistsMap.has(sid)) shellArtistsMap.set(sid, []);
      shellArtistsMap.get(sid).push(sa);
    }

    // ════════════════════════════════════════════════════════════════════
    // 5. Load shell tracks
    // ════════════════════════════════════════════════════════════════════
    const [stRows] = await wp.query(
      `SELECT id, shell_id, track_number, disc_number, title_raw, title_normalized, duration_ms, isrc, artwork_url FROM ${t(WP.prefix, "wkcharts_release_shell_tracks")}`
    );
    stats.wpShellTracks = stRows.length;
    console.log(`[enrich] WP shell tracks: ${stRows.length}`);

    const shellTracksMap = new Map();
    for (const st of stRows) {
      const sid = Number(st.shell_id);
      if (!shellTracksMap.has(sid)) shellTracksMap.set(sid, []);
      shellTracksMap.get(sid).push(st);
    }

    // ════════════════════════════════════════════════════════════════════
    // 6. Load WP tracks
    // ════════════════════════════════════════════════════════════════════
    const [tRows] = await wp.query(
      `SELECT id, normalized_key, title, artist_name, display_artist_line, artwork_url, isrc, duration_ms, release_id, metadata_confidence FROM ${t(WP.prefix, "wkcharts_tracks")}`
    );
    const wpTracks = tRows;
    stats.wpTracks = wpTracks.length;
    console.log(`[enrich] WP tracks: ${wpTracks.length}`);

    // ════════════════════════════════════════════════════════════════════
    // 7. Load track artists
    // ════════════════════════════════════════════════════════════════════
    const [taRows] = await wp.query(
      `SELECT id, track_id, artist_id, sort_order, role, confidence FROM ${t(WP.prefix, "wkcharts_track_artists")}`
    );
    stats.wpTrackArtists = taRows.length;
    console.log(`[enrich] WP track artists: ${taRows.length}`);

    const trackArtistsMap = new Map();
    for (const ta of taRows) {
      const tid = Number(ta.track_id);
      if (!trackArtistsMap.has(tid)) trackArtistsMap.set(tid, []);
      trackArtistsMap.get(tid).push(ta);
    }

    // ════════════════════════════════════════════════════════════════════
    // 8. Build WP artist lookup maps
    // ════════════════════════════════════════════════════════════════════
    const [wpAllARows] = await wp.query(
      `SELECT id, post_id, slug FROM ${t(WP.prefix, "wkcharts_artists")}`
    );
    const wpIdToSlug = new Map();
    const wpPostIdToSlug = new Map();
    for (const a of wpAllARows) {
      wpIdToSlug.set(Number(a.id), clean(a.slug));
      const pid = Number(a.post_id);
      if (pid > 0) wpPostIdToSlug.set(pid, clean(a.slug));
    }

    // ════════════════════════════════════════════════════════════════════
    // 9. Load existing Supabase data
    // ════════════════════════════════════════════════════════════════════
    const exRel = await pool.query("SELECT id, slug FROM registry_releases");
    const existReleaseBySlug = new Map();
    for (const r of exRel.rows) existReleaseBySlug.set(String(r.slug), String(r.id));
    const seenReleaseSlugs = new Set(existReleaseBySlug.keys());

    const exTrk = await pool.query("SELECT id, slug, isrc FROM registry_tracks");
    const existTrackByIsrc = new Map();
    const existTrackBySlug = new Map();
    for (const t of exTrk.rows) {
      existTrackBySlug.set(String(t.slug), String(t.id));
      if (t.isrc) existTrackByIsrc.set(String(t.isrc), String(t.id));
    }
    const seenTrackSlugs = new Set(existTrackBySlug.keys());

    // ════════════════════════════════════════════════════════════════════
    // 10. Process releases + tracks
    // ════════════════════════════════════════════════════════════════════
    const releaseRows = [];
    const releaseArtistRows = [];
    const trackRows = [];
    const releaseTrackRows = [];

    const wpTrackIdToRegTrackId = new Map();
    const regArtist = regArtistBySlug.get(ARTIST_SLUG);

    if (!regArtist) {
      console.error(`ERROR: Artist "${ARTIST_SLUG}" not found in registry!`);
      process.exit(1);
    }

    console.log(`[enrich] Registry artist ID: ${regArtist.id}\n`);
    console.log("── Processing releases ──");

    for (const shell of wpShells) {
      const shellId = Number(shell.id);
      const rawTitle = clean(shell.title_raw) || clean(shell.title_normalized) || `Release ${shellId}`;
      const rawSlug = slugify(rawTitle);
      const releaseSlug = dedupeSlug(rawSlug, seenReleaseSlugs);

      let releaseId;
      if (existReleaseBySlug.has(rawSlug)) {
        releaseId = existReleaseBySlug.get(rawSlug);
        console.log(`  [exists] ${rawTitle} → ${releaseSlug} (${releaseId})`);
      } else {
        releaseId = crypto.randomUUID();
        releaseRows.push({
          id: releaseId, slug: releaseSlug,
          title: rawTitle, normalized_title: rawTitle.toLowerCase(),
          release_type: parseReleaseType(clean(shell.release_type_guess) || "album"),
          release_date: parseDate(shell.release_date),
          artwork_url: clean(shell.artwork_url) || null,
          status: "active",
          metadata: JSON.stringify({ wp_shell_id: shellId, wp_shell_uuid: clean(shell.shell_uuid) }),
        });
        console.log(`  [new] ${rawTitle} → ${releaseSlug} (${releaseId})`);
      }

      // Release artist: 4mr-frank-white is primary
      releaseArtistRows.push({
        id: crypto.randomUUID(),
        release_id: releaseId,
        artist_id: regArtist.id,
        artist_slug: ARTIST_SLUG,
        artist_name_text: regArtist.display_name || wpArtist.display_name || "4Mr Frank White",
        role: "primary_artist",
        is_primary: true,
        is_featured: false,
        credit_order: 0,
        source: "wkcharts_release_shells",
        confidence: 95,
        status: "active",
        metadata: JSON.stringify({ wp_shell_id: shellId, wp_artist_post_id: wpPostId }),
      });

      // Also handle additional shell artists (features, producers, etc.)
      const sArtists = shellArtistsMap.get(shellId) ?? [];
      for (const sa of sArtists) {
        const saWpPostId = Number(sa.artist_post_id);
        const saWpSlug = wpPostIdToSlug.get(saWpPostId);
        if (!saWpSlug || saWpSlug === ARTIST_SLUG) continue;
        const saReg = regArtistBySlug.get(saWpSlug);
        if (!saReg) { stats.skippedNoMatch++; continue; }
        const isPrimary = clean(sa.role) === "primary";
        const conf = sa.confidence ? Math.round(Number(sa.confidence) * 100) : 85;
        releaseArtistRows.push({
          id: crypto.randomUUID(),
          release_id: releaseId,
          artist_id: saReg.id,
          artist_slug: saReg.slug,
          artist_name_text: saReg.display_name,
          role: clean(sa.role) || "featured_artist",
          is_primary: isPrimary,
          is_featured: !isPrimary,
          credit_order: isPrimary ? 0 : 1,
          source: "wkcharts_release_shell_artists",
          confidence: conf,
          status: "active",
          metadata: JSON.stringify({ wp_shell_artist_id: Number(sa.id), wp_artist_post_id: saWpPostId }),
        });
      }

      // Release tracks
      const sTracks = shellTracksMap.get(shellId) ?? [];
      for (const st of sTracks) {
        const stTitle = clean(st.title_raw) || clean(st.title_normalized) || "Unknown Track";
        const stIsrc = clean(st.isrc) || null;
        const trackNum = Number(st.track_number || 0);
        const discNum = Number(st.disc_number || 1);
        const durMs = st.duration_ms ? Number(st.duration_ms) : null;
        const artworkUrl = clean(st.artwork_url) || clean(shell.artwork_url) || null;

        // Try matching to an existing registry track by ISRC first, then by slug
        let existingRegTrackId = stIsrc ? existTrackByIsrc.get(stIsrc) : undefined;
        if (!existingRegTrackId) {
          const tSlug = slugify(stTitle);
          existingRegTrackId = existTrackBySlug.get(tSlug);
        }

        let trackId;
        if (existingRegTrackId) {
          trackId = existingRegTrackId;
        } else {
          trackId = crypto.randomUUID();
          const rawTrackSlug = slugify(stTitle);
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

        // Try to find matching wp_track for track-artist links
        let matchingWpTrackId = undefined;
        if (stIsrc) {
          for (const wt of wpTracks) {
            if (clean(wt.isrc) === stIsrc) { matchingWpTrackId = Number(wt.id); break; }
          }
        }
        if (!matchingWpTrackId) {
          const stNorm = stTitle.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
          for (const wt of wpTracks) {
            const wtNorm = clean(wt.title).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
            if (wtNorm === stNorm) { matchingWpTrackId = Number(wt.id); break; }
          }
        }
        if (matchingWpTrackId) wpTrackIdToRegTrackId.set(matchingWpTrackId, trackId);

        releaseTrackRows.push({
          id: crypto.randomUUID(),
          release_id: releaseId,
          track_id: trackId,
          disc_number: discNum || 1,
          track_number: trackNum || null,
          source: "wkcharts_release_shell_tracks",
          confidence: 95,
          status: "active",
          metadata: JSON.stringify({ wp_shell_track_id: Number(st.id) }),
        });
      }

      console.log(`    tracks: ${sTracks.length}`);
    }

    // ════════════════════════════════════════════════════════════════════
    // 11. Track-artist links (from wp_wkcharts_track_artists)
    // ════════════════════════════════════════════════════════════════════
    const trackArtistRows = [];
    for (const ta of taRows) {
      const wpTrackId = Number(ta.track_id);
      const wpArtistId = Number(ta.artist_id);
      const regTrackId = wpTrackIdToRegTrackId.get(wpTrackId);
      if (!regTrackId) continue;
      const wpSlug = wpIdToSlug.get(wpArtistId);
      if (!wpSlug) continue;
      if (wpSlug !== ARTIST_SLUG) continue; // Only link back to 4mr-frank-white
      const isPrimary = clean(ta.role) === "primary";
      const sortOrder = Number(ta.sort_order || 0);
      const conf = ta.confidence ? Math.round(Number(ta.confidence) * 100) : 95;
      trackArtistRows.push({
        id: crypto.randomUUID(),
        track_id: regTrackId,
        artist_id: regArtist.id,
        artist_slug: ARTIST_SLUG,
        artist_name_text: regArtist.display_name,
        role: clean(ta.role) || "primary",
        is_primary: isPrimary,
        is_featured: false,
        credit_order: sortOrder || (isPrimary ? 0 : 1),
        source: "wkcharts_track_artists",
        confidence: conf,
        status: "active",
        metadata: JSON.stringify({ wp_track_artist_id: Number(ta.id) }),
      });
    }

    stats.releasesUpserted = releaseRows.length;
    stats.tracksUpserted = trackRows.length;
    stats.releaseArtistsUpserted = releaseArtistRows.length;
    stats.releaseTracksUpserted = releaseTrackRows.length;
    stats.trackArtistsUpserted = trackArtistRows.length;

    // Deduplicate release-track links
    const dedupedRT = new Map();
    for (const rt of releaseTrackRows) {
      const key = `${rt.release_id}::${rt.track_id}`;
      if (!dedupedRT.has(key)) dedupedRT.set(key, rt);
    }
    const uniqueReleaseTrackRows = [...dedupedRT.values()];

    // Deduplicate release-artist links
    const dedupedRA = new Map();
    for (const ra of releaseArtistRows) {
      const key = `${ra.release_id}::${ra.artist_id}::${ra.role}::${ra.credit_order}`;
      if (!dedupedRA.has(key)) dedupedRA.set(key, ra);
    }
    const uniqueReleaseArtistRows = [...dedupedRA.values()];

    // Deduplicate track-artist links
    const dedupedTA = new Map();
    for (const ta of trackArtistRows) {
      const key = `${ta.track_id}::${ta.artist_id}::${ta.role}::${ta.credit_order}`;
      if (!dedupedTA.has(key)) dedupedTA.set(key, ta);
    }
    const uniqueTrackArtistRows = [...dedupedTA.values()];

    console.log(`\n── Summary before commit ──`);
    console.log(`  Releases to insert:       ${releaseRows.length}`);
    console.log(`  Tracks to insert:         ${trackRows.length}`);
    console.log(`  Release-artist links:     ${releaseArtistRows.length}`);
    console.log(`  Release-track links:      ${uniqueReleaseTrackRows.length}`);
    console.log(`  Track-artist links:       ${uniqueTrackArtistRows.length}\n`);

    // ════════════════════════════════════════════════════════════════════
    // 12. COMMIT TO SUPABASE
    // ════════════════════════════════════════════════════════════════════
    console.log("── Writing to Supabase ──");

    if (releaseRows.length > 0) {
      console.log(`  Inserting ${releaseRows.length} releases...`);
      await batchUpsert(pool, "registry_releases", releaseRows, "slug");
      console.log("  ✓ releases done");
    }

    if (trackRows.length > 0) {
      console.log(`  Inserting ${trackRows.length} tracks...`);
      await batchUpsert(pool, "registry_tracks", trackRows, "slug");
      console.log("  ✓ tracks done");
    }

    if (releaseArtistRows.length > 0) {
      console.log(`  Inserting ${uniqueReleaseArtistRows.length} release-artist links...`);
      await batchInsertOnConflict(pool, "registry_release_artists", uniqueReleaseArtistRows);
      console.log("  ✓ release-artist links done");
    }

    if (uniqueReleaseTrackRows.length > 0) {
      console.log(`  Inserting ${uniqueReleaseTrackRows.length} release-track links...`);
      await batchInsertOnConflict(pool, "registry_release_tracks", uniqueReleaseTrackRows);
      console.log("  ✓ release-track links done");
    }

    if (uniqueTrackArtistRows.length > 0) {
      console.log(`  Inserting ${uniqueTrackArtistRows.length} track-artist links...`);
      await batchInsertOnConflict(pool, "registry_track_artists", uniqueTrackArtistRows);
      console.log("  ✓ track-artist links done");
    }

    // ════════════════════════════════════════════════════════════════════
    // 13. Summary
    // ════════════════════════════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  COMPLETE");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  WP artist:                ${stats.wpArtists}`);
    console.log(`  WP release shells:        ${stats.wpShells}`);
    console.log(`  WP shell tracks:          ${stats.wpShellTracks}`);
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  Releases inserted:        ${stats.releasesUpserted}`);
    console.log(`  Tracks inserted:          ${stats.tracksUpserted}`);
    console.log(`  Release-artist links:     ${stats.releaseArtistsUpserted}`);
    console.log(`  Release-track links:      ${stats.releaseTracksUpserted}`);
    console.log(`  Track-artist links:       ${stats.trackArtistsUpserted}`);
    console.log(`  Skipped (no match):       ${stats.skippedNoMatch}`);
    console.log(`  Errors:                   ${stats.errors}`);
    console.log("═══════════════════════════════════════════════════════");
  } finally {
    await wp.end();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("\n[enrich] FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});