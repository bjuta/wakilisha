#!/usr/bin/env node
/**
 * clean-wp-chart-import.mjs
 *
 * Clean WordPress Chart → V2 Import Pipeline
 * ──────────────────────────────────────────
 * NO staging middleman. Data flows WP MySQL → registry canonicalize → chart v2 tables directly.
 *
 * Architecture:
 *   - VERIFIED_MARKET_MAP: single source of truth (Kenya only, June 2026)
 *   - Registry canonicalization (non-blocking): ISRC → slug lookup
 *   - Publish-first: every edition published immediately
 *   - Unmatched tracks flagged for future enrichment, never blocked
 *
 * Usage (on WordPress Lightsail server):
 *
 *   # Discovery mode (safe, no writes):
 *   WP_DB_HOST="localhost" WP_DB_USER="bn_wordpress" \
 *   WP_DB_PASSWORD="..." WP_DB_NAME="bitnami_wordpress" \
 *   DATABASE_URL="postgresql://..." \
 *   node clean-wp-chart-import.mjs --discover
 *
 *   # Preview mode (dry run, shows what will be imported):
 *   node clean-wp-chart-import.mjs --preview
 *
 *   # Import mode (commits to Supabase):
 *   node clean-wp-chart-import.mjs --import
 */

import mysql from "mysql2/promise";
import pg from "pg";

// ── WP MySQL Config ──
const WP = {
  host: process.env.WP_DB_HOST || "127.0.0.1",
  port: Number(process.env.WP_DB_PORT || 3306),
  user: process.env.WP_DB_USER || "bn_wordpress",
  password: process.env.WP_DB_PASSWORD,
  database: process.env.WP_DB_NAME || "bitnami_wordpress",
  prefix: process.env.WP_DB_PREFIX || "wp_",
};

const DATABASE_URL = process.env.DATABASE_URL;
const MODE = process.argv.includes("--import") ? "import"
  : process.argv.includes("--preview") ? "preview"
  : "discover";

// ── VERIFIED MARKET MAPPING (June 2026) ──
// Only Kenya has published charts. No auto-inference.
const VERIFIED_MARKET_MAP = {
  "2026":      { series: "2026-releases", market: "kenya", label: "2026 Releases" },
  "gengetone": { series: "gengetone",     market: "kenya", label: "Gengetone Songs" },
  "kenya":     { series: "top-songs",     market: "kenya", label: "Top 100 Songs" },
  "rnb":       { series: "rnb",           market: "kenya", label: "R&B Songs" },
};

const MARKET_CODES = {
  kenya:          { code: "KE", tz: "Africa/Nairobi" },
  nigeria:        { code: "NG", tz: "Africa/Lagos" },
  "south-africa": { code: "ZA", tz: "Africa/Johannesburg" },
  ghana:          { code: "GH", tz: "Africa/Accra" },
  tanzania:       { code: "TZ", tz: "Africa/Dar_es_Salaam" },
  uganda:         { code: "UG", tz: "Africa/Kampala" },
};

// ── Helpers ──
function clean(v) { return String(v ?? "").trim(); }
function isoDate(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim().slice(0, 10);
  return s.match(/^\d{4}-\d{2}-\d{2}$/) ? s : "";
}
function safeSlug(v) {
  return v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function safeId(prefix, v) {
  return (prefix + "_" + safeSlug(v)).replace(/-+/g, "_").slice(0, 64);
}
function wpTbl(name) { return "`" + WP.prefix + name + "`"; }

async function wpQuery(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

function pgPool() {
  if (!DATABASE_URL) return null;
  const url = new URL(DATABASE_URL);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("uselibpqcompat");
  return new pg.Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 20000,
  });
}

function pgLiteral(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function buildInsert(table, rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const values = rows.map(r => "(" + cols.map(c => pgLiteral(r[c])).join(", ") + ")").join(",\n");
  return "INSERT INTO " + table + " (" + cols.join(", ") + ")\nVALUES\n" + values + "\nON CONFLICT (id) DO UPDATE SET " + cols.filter(c => c !== "id").map(c => c + " = EXCLUDED." + c).join(", ") + ";";
}

// ── Registry Canonicalization (non-blocking) ──
async function lookupRegistryEntities(pool, tracks) {
  const trackMap = new Map();
  let matchedTracks = 0;
  let unmatchedTracks = 0;
  let matchedArtists = 0;

  // Look up tracks by ISRC
  const isrcs = [...new Set(tracks.map(t => t.isrc).filter(Boolean))];
  const isrcTrackMap = new Map();
  if (isrcs.length > 0) {
    const client = await pool.connect();
    try {
      for (let i = 0; i < isrcs.length; i += 100) {
        const batch = isrcs.slice(i, i + 100);
        const ph = batch.map((_, j) => "$" + (j + 1)).join(", ");
        const res = await client.query(
          "SELECT id, slug, isrc, release_id FROM registry_tracks WHERE isrc IN (" + ph + ") AND isrc IS NOT NULL",
          batch
        );
        for (const row of res.rows) {
          if (row.isrc) isrcTrackMap.set(row.isrc.toLowerCase(), row);
        }
      }
    } finally { client.release(); }
  }

  // Look up tracks by slug (fallback)
  const slugs = [...new Set(tracks.map(t => t.slug).filter(Boolean))];
  const slugTrackMap = new Map();
  if (slugs.length > 0) {
    const client = await pool.connect();
    try {
      for (let i = 0; i < slugs.length; i += 100) {
        const batch = slugs.slice(i, i + 100);
        const ph = batch.map((_, j) => "$" + (j + 1)).join(", ");
        const res = await client.query(
          "SELECT id, slug, release_id FROM registry_tracks WHERE slug IN (" + ph + ")",
          batch
        );
        for (const row of res.rows) {
          slugTrackMap.set(row.slug, row);
        }
      }
    } finally { client.release(); }
  }

  // Look up artists by slug
  const artistSlugs = [...new Set(tracks.map(t => t.artist_slug).filter(Boolean))];
  const artistMap = new Map();
  if (artistSlugs.length > 0) {
    const client = await pool.connect();
    try {
      for (let i = 0; i < artistSlugs.length; i += 100) {
        const batch = artistSlugs.slice(i, i + 100);
        const ph = batch.map((_, j) => "$" + (j + 1)).join(", ");
        const res = await client.query(
          "SELECT id, slug FROM registry_artists WHERE slug IN (" + ph + ")",
          batch
        );
        for (const row of res.rows) {
          artistMap.set(row.slug, row.id);
        }
      }
    } finally { client.release(); }
  }

  // Match each track
  for (const tr of tracks) {
    const key = tr.title + "::" + tr.artist_name;
    let canonicalTrackId = null;
    let canonicalReleaseId = null;

    if (tr.isrc) {
      const match = isrcTrackMap.get(tr.isrc.toLowerCase());
      if (match) { canonicalTrackId = match.id; canonicalReleaseId = match.release_id ?? null; matchedTracks++; }
    }
    if (!canonicalTrackId) {
      const slugMatch = slugTrackMap.get(tr.slug);
      if (slugMatch) { canonicalTrackId = slugMatch.id; canonicalReleaseId = slugMatch.release_id ?? null; matchedTracks++; }
    }
    if (!canonicalTrackId) unmatchedTracks++;

    const artistId = artistMap.get(tr.artist_slug) ?? null;
    if (artistId) matchedArtists++;

    trackMap.set(key, { canonical_track_id: canonicalTrackId, canonical_release_id: canonicalReleaseId, canonical_artist_id: artistId });
  }

  return { trackMap, stats: { matched_tracks: matchedTracks, unmatched_tracks: unmatchedTracks, matched_artists: matchedArtists } };
}

// ── Main ──
async function main() {
  console.error("═══════════════════════════════════════════════════════");
  console.error("  WAKILISHA Clean WP Chart → V2 Import");
  console.error("  Mode: " + MODE.toUpperCase());
  console.error("  MySQL: " + WP.host + ":" + WP.port + "/" + WP.database);
  console.error("  Supabase: " + (DATABASE_URL ? "connected" : "NOT CONFIGURED"));
  console.error("═══════════════════════════════════════════════════════\n");

  if (!WP.password) {
    console.error("FATAL: WP_DB_PASSWORD not set\n");
    process.exit(1);
  }

  // Connect MySQL
  const wp = await mysql.createConnection({
    host: WP.host, port: WP.port, user: WP.user,
    password: WP.password, database: WP.database,
    connectTimeout: 15000,
  });

  let pool = null;
  if (DATABASE_URL) pool = pgPool();

  try {
    await wp.ping();
    console.error("[mysql] Connected\n");

    // ── PHASE 0: TABLE DISCOVERY ──
    const allTables = await wpQuery(wp,
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE ? ORDER BY TABLE_NAME",
      [WP.database, WP.prefix + "wkcharts%"]
    );
    const chartTables = allTables.map(r => r.TABLE_NAME.replace(WP.prefix, ""));
    console.error("[discovery] wkcharts tables: " + chartTables.join(", "));

    const tableCounts = {};
    for (const name of chartTables) {
      const rows = await wpQuery(wp, "SELECT COUNT(*) AS cnt FROM " + wpTbl(name));
      tableCounts[name] = Number(rows[0]?.cnt ?? 0);
      console.error("  " + name + ": " + tableCounts[name] + " rows");
    }

    const chartPostCount = (await wpQuery(wp,
      "SELECT COUNT(*) AS cnt FROM " + wpTbl("posts") + " WHERE post_type = 'wk_chart_series'"
    ))[0]?.cnt ?? 0;
    console.error("  wp_posts (wk_chart_series): " + chartPostCount + " rows\n");

    // ── PHASE 1: LOAD CHART DEFINITIONS ──
    let charts = [];
    if (chartTables.includes("wkcharts_charts") && tableCounts["wkcharts_charts"] > 0) {
      charts = await wpQuery(wp,
        "SELECT id, name, slug, status, chart_type FROM " + wpTbl("wkcharts_charts")
      );
    }
    if (charts.length === 0 && chartPostCount > 0) {
      charts = await wpQuery(wp,
        "SELECT p.ID AS id, p.post_title AS name, p.post_name AS slug, p.post_status AS status, 'top_songs' AS chart_type " +
        "FROM " + wpTbl("posts") + " p WHERE p.post_type = 'wk_chart_series' AND p.post_status != 'trash'"
      );
    }

    if (charts.length === 0) {
      console.error("[discovery] No charts found. Nothing to import.\n");
      console.log(JSON.stringify({ status: "no_charts_found", tables: chartTables, table_counts: tableCounts }, null, 2));
      process.exit(0);
    }

    console.error("[discovery] " + charts.length + " chart(s) found:\n");

    // ── PHASE 2: MAPPING ──
    const mapping = [];
    const unmappedSlugs = [];

    for (const chart of charts) {
      const s = clean(chart.slug);
      const name = clean(chart.name);
      const known = VERIFIED_MARKET_MAP[s];

      if (known) {
        const pubSlug = known.series + "/" + known.market;
        const marketLabel = known.market === "kenya" ? "Kenya" : known.market;
        mapping.push({
          old_chart_id: Number(chart.id), old_chart_slug: s, old_chart_name: name,
          series: known.series, market: known.market,
          public_slug: pubSlug,
          public_label: known.label + " \u00b7 " + marketLabel,
          program_id: safeId("program", pubSlug), verified: true,
        });
        console.error("  \u2705 " + s + " \u2192 " + known.series + "/" + known.market + " (verified)");
      } else {
        unmappedSlugs.push(s);
        const series = safeSlug(s);
        const market = "kenya";
        const pubSlug = series + "/" + market;
        mapping.push({
          old_chart_id: Number(chart.id), old_chart_slug: s, old_chart_name: name,
          series, market, public_slug: pubSlug,
          public_label: (name || series) + " \u00b7 Kenya",
          program_id: safeId("program", pubSlug), verified: false,
        });
        console.error("  \u26a0\ufe0f " + s + " \u2192 " + series + "/kenya (unmapped, defaulting to Kenya)");
      }
    }

    const verifiedCount = mapping.filter(m => m.verified).length;
    console.error("\n[mapping] " + verifiedCount + " verified, " + unmappedSlugs.length + " unmapped\n");

    if (MODE === "discover") {
      await wp.end();
      if (pool) await pool.end();
      console.log(JSON.stringify({
        scanned_at: new Date().toISOString(),
        mode: "discover",
        wp_tables: chartTables,
        wp_table_counts: tableCounts,
        charts_found: charts.map(c => ({ id: Number(c.id), name: clean(c.name), slug: clean(c.slug), status: clean(c.status) })),
        mapping: mapping.map(m => ({ old_slug: m.old_chart_slug, new_series: m.series, new_market: m.market, verified: m.verified })),
        unmapped_slugs: unmappedSlugs,
      }, null, 2));
      process.exit(0);
    }

    // ── PHASE 3: LOAD ALL DATA ──
    console.error("[load] Fetching editions, entries, tracks, artists...\n");

    const allEditions = [];
    const allEntriesRaw = [];
    const allAliases = [];
    const allCoverage = [];
    const allTracksForRegistry = [];

    const hasSources = chartTables.includes("wkcharts_track_sources");

    for (const m of mapping) {
      let editions = [];
      try {
        editions = await wpQuery(wp,
          "SELECT id, title, slug, status, edition_date, chart_id, week_number, year, entry_count " +
          "FROM " + wpTbl("wkcharts_editions") + " WHERE chart_id = ? ORDER BY edition_date ASC",
          [m.old_chart_id]
        );
      } catch (err) {
        console.error("[load] Failed editions for " + m.old_chart_slug + ": " + err.message);
        continue;
      }
      console.error("  " + m.old_chart_slug + ": " + editions.length + " editions");

      // Load ingest runs for methodology info
      const ingestByEdition = new Map();
      if (chartTables.includes("wkcharts_ingest_runs")) {
        try {
          const runs = await wpQuery(wp,
            "SELECT id, edition_id, methodology, source_policy, scoring_policy, eligibility_policy, status " +
            "FROM " + wpTbl("wkcharts_ingest_runs") + " WHERE chart_id = ? ORDER BY created_at DESC",
            [m.old_chart_id]
          );
          for (const run of runs) {
            const edId = run.edition_id;
            if (edId && !ingestByEdition.has(edId)) ingestByEdition.set(edId, run);
          }
        } catch {}
      }

      const allTrackIds = new Set();

      for (const ed of editions) {
        const edId = Number(ed.id);
        const edDate = isoDate(ed.edition_date);
        const edSlug = clean(ed.slug);
        const ingestRun = ingestByEdition.get(edId) || null;

        allAliases.push({
          id: safeId("alias", "chart_" + m.old_chart_slug + "_" + edSlug),
          legacy_slug: "charts/" + m.old_chart_slug + "/" + edSlug,
          canonical_slug: "charts/" + m.public_slug,
          entity_type: "chart_program",
          redirect_status: "active",
        });

        let items = [];
        try {
          items = await wpQuery(wp,
            "SELECT id, edition_id, track_id, rank, previous_rank, weeks_on_chart, " +
            "peak_position, is_new_entry, is_re_entry " +
            "FROM " + wpTbl("wkcharts_edition_items") + " WHERE edition_id = ? ORDER BY rank ASC",
            [edId]
          );
        } catch (err) {
          console.error("[load] Failed entries for edition " + edId + ": " + err.message);
          continue;
        }

        for (const item of items) {
          if (item.track_id) allTrackIds.add(Number(item.track_id));
        }

        const v2EdId = safeId("edition", m.public_slug + "_" + edDate);
        allEditions.push({
          id: v2EdId,
          program_id: m.program_id,
          edition_slug: edDate,
          edition_label: clean(ed.title) || m.public_label + " \u00b7 " + edDate,
          edition_date: edDate,
          period_start: edDate,
          period_end: edDate,
          status: "published",
          entry_count: items.length,
          chart_size: 20,
          methodology_version: clean(ingestRun?.methodology) || "legacy-import-v1",
          source_policy_version: clean(ingestRun?.source_policy) || "legacy-import",
          eligibility_policy_version: clean(ingestRun?.eligibility_policy) || "legacy-import",
          scoring_policy_version: clean(ingestRun?.scoring_policy) || "legacy-import",
          rule_set_snapshot: {
            old_edition_id: edId, old_chart_id: m.old_chart_id, old_chart_slug: m.old_chart_slug,
            week_number: ed.week_number, year: ed.year,
            ingest_run_id: ingestRun?.id ?? null, ingest_run_status: ingestRun?.status ?? null,
            migrated_at: new Date().toISOString(),
          },
          ingest_run_id: ingestRun ? String(ingestRun.id) : null,
          published_at: new Date().toISOString(),
          published_by: "clean-wp-chart-import",
        });

        allCoverage.push({
          id: safeId("coverage", v2EdId + "_wp_import"),
          edition_id: v2EdId,
          source_name: "WordPress Legacy Import",
          source_count: items.length,
          coverage_status: items.length > 0 ? "manual" : "unavailable",
          coverage_payload: { old_edition_id: edId, migrated_at: new Date().toISOString() },
        });

        for (const item of items) {
          item._v2_edition_id = v2EdId;
          item._chart_id = m.old_chart_id;
          item._public_slug = m.public_slug;
          item._program_id = m.program_id;
          item._verified = m.verified;
        }
        allEntriesRaw.push(...items);
      }

      // Load tracks
      if (allTrackIds.size > 0) {
        const trackIdsArr = [...allTrackIds];
        const tracksById = new Map();
        for (let i = 0; i < trackIdsArr.length; i += 200) {
          const batch = trackIdsArr.slice(i, i + 200);
          const ph = batch.map(() => "?").join(",");
          try {
            const tracks = await wpQuery(wp,
              "SELECT id, title, slug, artist_id, spotify_id, apple_music_id, youtube_id, isrc, explicit " +
              "FROM " + wpTbl("wkcharts_tracks") + " WHERE id IN (" + ph + ")", batch
            );
            for (const t of tracks) tracksById.set(t.id, t);
          } catch (err) {
            console.error("[load] Failed tracks batch: " + err.message);
          }
        }

        for (const item of allEntriesRaw) {
          const tid = item.track_id;
          item._track = tracksById.get(tid) || null;
        }
      }

      // Load artists
      const artistIds = new Set();
      for (const item of allEntriesRaw) {
        if (item._track?.artist_id) artistIds.add(Number(item._track.artist_id));
      }

      const artistsById = new Map();
      if (artistIds.size > 0) {
        const artistIdsArr = [...artistIds];
        for (let i = 0; i < artistIdsArr.length; i += 200) {
          const batch = artistIdsArr.slice(i, i + 200);
          const ph = batch.map(() => "?").join(",");
          try {
            const artists = await wpQuery(wp,
              "SELECT id, name, slug FROM " + wpTbl("wkcharts_artists") + " WHERE id IN (" + ph + ")", batch
            );
            for (const a of artists) artistsById.set(a.id, a);
          } catch (err) {
            console.error("[load] Failed artists batch: " + err.message);
          }
        }
      }

      for (const item of allEntriesRaw) {
        const track = item._track;
        const artist = track?.artist_id ? artistsById.get(track.artist_id) : undefined;
        item._artist = artist || null;

        if (track && artist) {
          const title = clean(track.title);
          const isrc = track.isrc ? clean(track.isrc) : null;
          const artistName = clean(artist.name);
          if (title && artistName) {
            const exists = allTracksForRegistry.find(t => t.title === title && t.artist_name === artistName);
            if (!exists) {
              allTracksForRegistry.push({
                title, slug: safeSlug(title), isrc: isrc || null,
                artist_name: artistName, artist_slug: safeSlug(artistName),
              });
            }
          }
        }
      }
    }

    await wp.end();
    console.error("[load] MySQL done. Editions=" + allEditions.length + " Entries=" + allEntriesRaw.length + " RegistryTracks=" + allTracksForRegistry.length + "\n");

    // ── PHASE 4: REGISTRY CANONICALIZATION ──
    let registryResult = { trackMap: new Map(), stats: { matched_tracks: 0, unmatched_tracks: 0, matched_artists: 0 } };
    if (pool) {
      console.error("[registry] Looking up " + allTracksForRegistry.length + " tracks...");
      registryResult = await lookupRegistryEntities(pool, allTracksForRegistry);
      console.error("[registry] Matched: " + registryResult.stats.matched_tracks + " tracks, " + registryResult.stats.matched_artists + " artists. Unmatched: " + registryResult.stats.unmatched_tracks + "\n");
    }

    // ── PHASE 5: BUILD FINAL ENTRIES ──
    console.error("[build] Constructing v2 entries...\n");

    const finalEntries = [];
    let canonMatched = 0;
    let canonUnmatched = 0;

    for (const item of allEntriesRaw) {
      const track = item._track;
      const artist = item._artist;
      const v2EdId = item._v2_edition_id;
      const edDate = v2EdId ? v2EdId.split("_").pop() || "" : "";

      const trackTitle = clean(track?.title) || "Track " + (item.track_id || "unknown");
      const artistName = clean(artist?.name) || "Unknown Artist";
      const rank = Number(item.rank ?? 0);
      const prevRank = item.previous_rank != null ? Number(item.previous_rank) : null;
      const isNewEntry = item.is_new_entry === 1 || item.is_new_entry === "1";
      const isReEntry = item.is_re_entry === 1 || item.is_re_entry === "1";

      let movement = "same";
      if (isNewEntry) movement = "new";
      else if (isReEntry) movement = "re_entry";
      else if (prevRank !== null) {
        if (rank < prevRank) movement = "up";
        else if (rank > prevRank) movement = "down";
      }

      const canonKey = trackTitle + "::" + artistName;
      const canon = registryResult.trackMap.get(canonKey);
      if (canon?.canonical_track_id) canonMatched++;
      else canonUnmatched++;

      const sourceUrls = [];
      if (track?.spotify_id) sourceUrls.push("https://open.spotify.com/track/" + clean(track.spotify_id));
      if (track?.apple_music_id) sourceUrls.push("https://music.apple.com/track/" + clean(track.apple_music_id));
      if (track?.youtube_id) sourceUrls.push("https://youtube.com/watch?v=" + clean(track.youtube_id));

      finalEntries.push({
        id: safeId("entry", edDate + "_" + String(rank).padStart(3, "0") + "_" + String(item.track_id || "0")),
        edition_id: v2EdId,
        rank, previous_rank: prevRank, movement,
        track_slug: track?.slug ? clean(track.slug) : null,
        track_title: trackTitle,
        artist_slug: artist?.slug ? clean(artist.slug) : null,
        artist_name: artistName,
        artwork_url: null,
        normalized_key: safeSlug(trackTitle) + "::" + safeSlug(artistName),
        lead_artist_key: safeSlug(artistName),
        source_count: 1,
        occurrence_count: 1,
        source_urls_seen: JSON.stringify(sourceUrls),
        release_date: null,
        release_recency_days: null,
        canonical_track_id: canon?.canonical_track_id ?? null,
        canonical_release_id: canon?.canonical_release_id ?? null,
        canonical_artist_id: canon?.canonical_artist_id ?? null,
        source_score: 0,
        cross_source_bonus: 0,
        overlap_bonus: 0,
        recency_score: 0,
        continuity_score: 0,
        carry_forward_bonus: 0,
        airplay_score: 0,
        anti_gaming_penalty: 0,
        total_score: 0,
        carry_forward_only: false,
        continuity_locked: false,
        airplay_candidate_only: false,
        overlap_bonus_capped: false,
        lead_artist_overflow: false,
        stale_carry_forward_demoted: false,
        eligibility_status: "published",
        eligibility_warnings: JSON.stringify(canon?.canonical_track_id ? [] : [{ type: "no_registry_match", message: "Track not found in registry. Flagged for future enrichment." }]),
        source_payload: JSON.stringify({
          old_item_id: Number(item.id ?? 0), old_track_id: item.track_id ?? null,
          weeks_on_chart: item.weeks_on_chart ?? null, peak_position: item.peak_position ?? null,
          is_new_entry: isNewEntry, is_re_entry: isReEntry,
          track_isrc: track?.isrc ? clean(track.isrc) : null,
          track_spotify_id: track?.spotify_id ? clean(track.spotify_id) : null,
          track_apple_music_id: track?.apple_music_id ? clean(track.apple_music_id) : null,
          track_youtube_id: track?.youtube_id ? clean(track.youtube_id) : null,
          migrated_at: new Date().toISOString(),
        }),
        scoring_policy_version: "legacy-import",
        methodology_version: "legacy-import-v1",
        eligibility_policy_version: "legacy-import",
      });
    }

    console.error("[build] " + finalEntries.length + " entries. Canonicalized: " + canonMatched + " matched, " + canonUnmatched + " unmatched\n");

    // ── PHASE 6: BUILD SERIES, MARKETS, PROGRAMS ──
    const seenSeries = new Set();
    const seriesRows = [];
    const seenMarkets = new Set();
    const marketRows = [];
    const seenPrograms = new Set();
    const programRows = [];

    for (const m of mapping) {
      if (!seenSeries.has(m.series)) {
        seenSeries.add(m.series);
        seriesRows.push({
          series_slug: m.series,
          series_label: m.series.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        });
      }
      if (!seenMarkets.has(m.market)) {
        seenMarkets.add(m.market);
        const mc = MARKET_CODES[m.market] || { code: null, tz: null };
        marketRows.push({
          market_slug: m.market,
          market_label: m.market.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          market_type: "country",
          country_code: mc.code,
          timezone: mc.tz,
          default_language: "en",
        });
      }
      if (!seenPrograms.has(m.program_id)) {
        seenPrograms.add(m.program_id);
        programRows.push({
          id: m.program_id,
          series_slug: m.series,
          market_slug: m.market,
          public_slug: m.public_slug,
          public_label: m.public_label,
          short_label: m.old_chart_name || m.series,
          source_family_slug: m.old_chart_slug,
          default_period_type: "weekly",
          default_methodology_version: "legacy-import-v1",
          default_eligibility_rules_version: "legacy-import-v1",
          chart_size: 20,
          streaming_min_sources: 1,
          cross_source_mode: "standard",
          cross_source_weight: 1,
          continuity_weight: 1,
          carry_forward_weight: 1,
          airplay_enabled: false,
          airplay_station_scope: "all",
          airplay_min_duration: 20,
          airplay_weight: 1,
          airplay_min_stations: 1,
          airplay_min_detections: 1,
          airplay_max_score: 24,
          airplay_rescue_mode: "allow_rescue",
          anti_gaming_max_tracks_per_lead_artist: 3,
          anti_gaming_overlap_bonus_cap: 10,
          anti_gaming_artist_overflow_penalty: 8,
          anti_gaming_demote_carry_forward_without_current: false,
          missing_policy: "review",
          override_mode: "full_pipeline",
        });
      }
    }

    // ── PHASE 7: PREVIEW ──
    if (MODE === "preview") {
      if (pool) await pool.end();
      console.log(JSON.stringify({
        scanned_at: new Date().toISOString(),
        mode: "preview",
        mapping: {
          verified: verifiedCount,
          unmapped_slugs: unmappedSlugs,
          programs_total: mapping.length,
        },
        summary: {
          series: seriesRows.length,
          markets: marketRows.length,
          programs: programRows.length,
          editions: allEditions.length,
          entries: finalEntries.length,
          aliases: allAliases.length,
          coverage: allCoverage.length,
        },
        registry: {
          tracks_looked_up: allTracksForRegistry.length,
          tracks_matched: registryResult.stats.matched_tracks,
          tracks_unmatched: registryResult.stats.unmatched_tracks,
          artists_matched: registryResult.stats.matched_artists,
          canon_entries_matched: canonMatched,
          canon_entries_unmatched: canonUnmatched,
        },
        publish_first: {
          all_editions_published: true,
          editions_total: allEditions.length,
          entries_total: finalEntries.length,
        },
        sample_programs: programRows.slice(0, 5).map(p => ({ id: p.id, public_slug: p.public_slug, public_label: p.public_label })),
        sample_editions: allEditions.slice(0, 5).map(e => ({ id: e.id, edition_slug: e.edition_slug, entry_count: e.entry_count })),
      }, null, 2));
      console.error("\n[preview] Dry run complete. Run with --import to commit.\n");
      process.exit(0);
    }

    // ── PHASE 8: COMMIT ──
    if (MODE !== "import") {
      console.error("[done] Nothing to commit. Use --import to write.\n");
      if (pool) await pool.end();
      process.exit(0);
    }

    if (!pool) {
      console.error("FATAL: DATABASE_URL not set. Cannot commit.\n");
      process.exit(1);
    }

    console.error("[commit] Writing to Supabase...\n");

    const batchInsert = async (table, rows, label) => {
      if (!rows.length) return 0;
      const client = await pool.connect();
      try {
        const sql = buildInsert(table, rows);
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
        console.error("  " + label + ": " + rows.length + " rows");
        return rows.length;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("  " + label + ": FAILED — " + err.message);
        throw err;
      } finally {
        client.release();
      }
    };

    const inserted = {};
    try {
      inserted.series = await batchInsert("wk_chart_series_v2", seriesRows, "series");
      inserted.markets = await batchInsert("wk_chart_markets_v2", marketRows, "markets");
      inserted.programs = await batchInsert("wk_chart_programs_v2", programRows, "programs");
      inserted.editions = await batchInsert("wk_chart_editions_v2", allEditions, "editions");

      // Entries in batches of 200
      let entryCount = 0;
      for (let i = 0; i < finalEntries.length; i += 200) {
        const batch = finalEntries.slice(i, i + 200);
        await batchInsert("wk_chart_entries_v2", batch, "entries batch " + (i / 200 + 1));
        entryCount += batch.length;
      }
      inserted.entries = entryCount;

      inserted.coverage = await batchInsert("wk_chart_source_coverage_v2", allCoverage, "coverage");
      inserted.aliases = await batchInsert("wk_chart_slug_aliases_v2", allAliases, "aliases");

      console.error("\n[commit] ALL DONE! \u2705\n");
    } catch (err) {
      console.error("\n[commit] FAILED during insert: " + err.message + "\n");
      if (pool) await pool.end();
      process.exit(1);
    }

    await pool.end();

    console.log(JSON.stringify({
      completed_at: new Date().toISOString(),
      mode: "import",
      success: true,
      inserted,
      registry: {
        tracks_looked_up: allTracksForRegistry.length,
        tracks_matched: registryResult.stats.matched_tracks,
        tracks_unmatched: registryResult.stats.unmatched_tracks,
        artists_matched: registryResult.stats.matched_artists,
        canon_entries_matched: canonMatched,
        canon_entries_unmatched: canonUnmatched,
      },
      mapping: {
        verified: verifiedCount,
        unmapped_slugs: unmappedSlugs,
        programs_total: mapping.length,
      },
      publish_first: {
        all_editions_published: true,
        editions_total: allEditions.length,
        entries_total: finalEntries.length,
      },
    }, null, 2));

    console.error("\n[clean-wp-chart-import] Complete.\n");
  } catch (err) {
    console.error("[clean-wp-chart-import] FATAL: " + (err instanceof Error ? err.message : String(err)));
    try { await wp.end(); } catch {}
    if (pool) await pool.end();
    process.exit(1);
  }
}

main();