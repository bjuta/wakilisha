#!/usr/bin/env node
/**
 * smart-wp-chart-import.mjs
 *
 * ONE SCRIPT: Discovery → Mapping Analysis → Import
 *
 * Run on the WordPress Lightsail server:
 *
 *   # Preview mode (no writes):
 *   DATABASE_URL="postgresql://..." \
 *   node smart-wp-chart-import.mjs
 *
 *   # Commit mode:
 *   WAKILISHA_CHART_IMPORT_COMMIT=1 DATABASE_URL="postgresql://..." \
 *   node smart-wp-chart-import.mjs
 *
 *   # Save report:
 *   node smart-wp-chart-import.mjs > wp-chart-report.json 2>wp-chart-import.log
 */

import mysql from "mysql2/promise";
import pg from "pg";

const WP = {
  host: process.env.WP_DB_HOST || "127.0.0.1",
  port: Number(process.env.WP_DB_PORT || 3306),
  user: process.env.WP_DB_USER || "bn_wordpress",
  password: process.env.WP_DB_PASSWORD || "236407f4e9404d1cd2215f9759d1ddc198d04fa6aaffc7d61fb98f1422c4eb0b",
  database: process.env.WP_DB_NAME || "bitnami_wordpress",
  prefix: process.env.WP_DB_PREFIX || "wp_",
};

const DATABASE_URL = process.env.DATABASE_URL;
const COMMIT = process.env.WAKILISHA_CHART_IMPORT_COMMIT === "1";

function wpTbl(name) { return "`" + WP.prefix + name + "`"; }
function clean(v) { return String(v ?? "").trim(); }
function isoDate(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return String(v ?? "").trim().slice(0, 10);
}
function safeSlug(v) {
  return v.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function safeId(prefix, v) {
  return (prefix + "_" + safeSlug(v)).replace(/-+/g, "_").slice(0, 64);
}

async function wpQuery(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

function createPgPool() {
  if (!DATABASE_URL) return null;
  const url = new URL(DATABASE_URL);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("uselibpqcompat");
  return new pg.Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    max: 4,
    connectionTimeoutMillis: 15000,
  });
}

function sqlInsert(table, rows) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const values = rows.map(row => {
    const cells = columns.map(col => {
      const v = row[col];
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "object") return "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb";
      if (typeof v === "boolean") return String(v);
      if (typeof v === "number") return String(v);
      return "'" + String(v).replace(/'/g, "''") + "'";
    });
    return "(" + cells.join(", ") + ")";
  }).join(",\n");
  return "INSERT INTO " + table + " (" + columns.join(", ") + ")\nVALUES\n" + values + "\nON CONFLICT DO NOTHING;";
}

// Known mappings from CSV preview — trusted reference
const KNOWN_MAPPINGS = {
  "2026":      { series: "2026-releases", market: "kenya", label: "2026 Releases" },
  "gengetone": { series: "gengetone", market: "kenya", label: "Gengetone Songs" },
  "kenya":     { series: "top-songs", market: "kenya", label: "Top 100 Songs" },
  "rnb":       { series: "rnb", market: "kenya", label: "R&B Songs" },
};

const SERIES_PATTERNS = [
  { pattern: /2026/, series: "2026-releases", label: "2026 Releases" },
  { pattern: /gengetone/, series: "gengetone", label: "Gengetone Songs" },
  { pattern: /gospel/, series: "gospel", label: "Gospel Songs" },
  { pattern: /afrobeats?/, series: "afrobeats", label: "Afrobeats Songs" },
  { pattern: /hip\s*hop|hiphop|rap/, series: "hiphop", label: "Hip Hop Songs" },
  { pattern: /reggae|dancehall/, series: "reggae", label: "Reggae/Dancehall Songs" },
  { pattern: /rnb|r\s*&?\s*b/, series: "rnb", label: "R&B Songs" },
  { pattern: /top.*100|top.*songs|kenya/, series: "top-songs", label: "Top 100 Songs" },
  { pattern: /new.*release|fresh/, series: "new-releases", label: "New Releases" },
];

const MARKET_PATTERNS = [
  { pattern: /kenya|ke\b|nairobi/, market: "kenya", label: "Kenya", code: "KE", tz: "Africa/Nairobi" },
  { pattern: /nigeria|ng\b|lagos/, market: "nigeria", label: "Nigeria", code: "NG", tz: "Africa/Lagos" },
  { pattern: /south.africa|za\b|johannesburg/, market: "south-africa", label: "South Africa", code: "ZA", tz: "Africa/Johannesburg" },
  { pattern: /ghana|gh\b|accra/, market: "ghana", label: "Ghana", code: "GH", tz: "Africa/Accra" },
  { pattern: /tanzania|tz\b|dar.es.salaam/, market: "tanzania", label: "Tanzania", code: "TZ", tz: "Africa/Dar_es_Salaam" },
  { pattern: /uganda|ug\b|kampala/, market: "uganda", label: "Uganda", code: "UG", tz: "Africa/Kampala" },
];

function inferSeries(chartSlug, chartName) {
  const s = (chartSlug + " " + (chartName || "")).toLowerCase();
  for (const p of SERIES_PATTERNS) {
    if (p.pattern.test(s)) return p;
  }
  return { series: safeSlug(chartSlug), label: chartName || chartSlug };
}

function inferMarket(chartSlug, chartName) {
  const s = (chartSlug + " " + (chartName || "")).toLowerCase();
  for (const p of MARKET_PATTERNS) {
    if (p.pattern.test(s)) return p;
  }
  return { market: "kenya", label: "Kenya", code: "KE", tz: "Africa/Nairobi" };
}

// ────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────

async function main() {
  console.error("═══════════════════════════════════════════════════════");
  console.error("  WAKILISHA Smart WP Chart \u2192 V2 Importer");
  console.error("  Mode: " + (COMMIT ? "COMMIT (writing to DB)" : "DISCOVERY & PREVIEW"));
  console.error("  MySQL: " + WP.host + ":" + WP.port + "/" + WP.database);
  console.error("═══════════════════════════════════════════════════════\n");

  const wp = await mysql.createConnection({
    host: WP.host, port: WP.port, user: WP.user,
    password: WP.password, database: WP.database,
    connectTimeout: 15000,
  });

  let pool = null;
  if (DATABASE_URL) pool = createPgPool();

  try {
    await wp.ping();
    console.error("[import] MySQL connected\n");

    // ── PHASE 1: DISCOVER WP TABLES ──
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

    // ── PHASE 2: LOAD CHART DEFINITIONS ──
    let charts = [];

    if (chartTables.includes("wkcharts_charts") && tableCounts["wkcharts_charts"] > 0) {
      charts = await wpQuery(wp,
        "SELECT id, name, slug, status, chart_type, frequency FROM " + wpTbl("wkcharts_charts")
      );
    }

    if (charts.length === 0 && chartPostCount > 0) {
      charts = await wpQuery(wp,
        "SELECT p.ID AS id, p.post_title AS name, p.post_name AS slug, p.post_status AS status, " +
        "COALESCE(pm_type.meta_value, 'top_songs') AS chart_type, " +
        "COALESCE(pm_freq.meta_value, 'weekly') AS frequency " +
        "FROM " + wpTbl("posts") + " p " +
        "LEFT JOIN " + wpTbl("postmeta") + " pm_type ON pm_type.post_id = p.ID AND pm_type.meta_key = 'chart_type' " +
        "LEFT JOIN " + wpTbl("postmeta") + " pm_freq ON pm_freq.post_id = p.ID AND pm_freq.meta_key = 'frequency' " +
        "WHERE p.post_type = 'wk_chart_series' AND p.post_status != 'trash'"
      );
    }

    if (charts.length === 0 && chartTables.includes("wkcharts_editions")) {
      charts = await wpQuery(wp,
        "SELECT DISTINCT chart_id AS id, MIN(title) AS name, MIN(slug) AS slug " +
        "FROM " + wpTbl("wkcharts_editions") + " WHERE chart_id IS NOT NULL GROUP BY chart_id"
      );
    }

    console.error("[discovery] " + charts.length + " chart(s) found:");
    for (const c of charts) {
      console.error("  #" + c.id + ": \"" + clean(c.name) + "\" (slug: " + clean(c.slug) + ", type: " + clean(c.chart_type) + ")");
    }

    if (charts.length === 0) {
      console.error("\n[import] No charts found. Nothing to import.\n");
      console.log(JSON.stringify({
        scanned_at: new Date().toISOString(),
        status: "no_charts_found",
        wp_tables: chartTables,
        wp_table_counts: tableCounts,
        wp_chart_series_posts: chartPostCount,
      }, null, 2));
      process.exit(1);
    }

    // ── PHASE 3: MAPPING ANALYSIS ──
    console.error("\n[MAPPING] old slug \u2192 new architecture:\n");

    const mappings = [];
    const programMap = new Map();
    const seenPrograms = new Set();

    for (const chart of charts) {
      const slug = clean(chart.slug);
      const name = clean(chart.name);
      const known = KNOWN_MAPPINGS[slug];
      const infSeries = inferSeries(slug, name);
      const infMarket = inferMarket(slug, name);

      const effSeries = known ? known.series : infSeries.series;
      const effMarket = known ? known.market : infMarket.market;
      const effLabel = known ? known.label : infSeries.label;
      const pubSlug = effSeries + "/" + effMarket;

      const m = {
        old_chart_id: Number(chart.id),
        old_chart_slug: slug,
        old_chart_name: name,
        old_chart_type: clean(chart.chart_type),
        new_series: effSeries,
        new_series_label: infSeries.label,
        new_market: effMarket,
        new_market_label: infMarket.label,
        new_public_slug: pubSlug,
        new_public_label: effLabel + " \u00b7 " + infMarket.label,
        new_program_id: safeId("program", pubSlug),
        mapping_source: known ? "known_csv_mapping" : "auto_inferred",
        mapping_confidence: known ? "high" : "medium",
      };

      mappings.push(m);
      programMap.set(Number(chart.id), m);

      if (!seenPrograms.has(pubSlug)) {
        seenPrograms.add(pubSlug);
        console.error("  " + slug + " \u2192 " + pubSlug + " (" + m.mapping_source + ")");
      }
    }

    // ── PHASE 4: LOAD EDITIONS & BUILD V2 DATA ──
    console.error("\n[import] Loading editions and building v2 data...\n");

    const allEditions = [];
    const allEntries = [];
    const allAliases = [];
    const discrepancies = [];

    if (!chartTables.includes("wkcharts_editions")) {
      console.error("[import] CRITICAL: wkcharts_editions table missing!\n");
      process.exit(1);
    }

    for (const chart of charts) {
      const chartId = Number(chart.id);
      const mapping = programMap.get(chartId);
      if (!mapping) continue;

      const editions = await wpQuery(wp,
        "SELECT id, title, slug, status, edition_date, chart_id, week_number, year, entry_count " +
        "FROM " + wpTbl("wkcharts_editions") + " WHERE chart_id = ? ORDER BY edition_date DESC",
        [chartId]
      );

      console.error("  Chart \"" + clean(chart.slug) + "\": " + editions.length + " editions");

      let ingestRuns = [];
      if (chartTables.includes("wkcharts_ingest_runs")) {
        ingestRuns = await wpQuery(wp,
          "SELECT id, chart_id, edition_id, edition_date, source_urls, source_policy, " +
          "scoring_policy, eligibility_policy, methodology, status, created_at, raw_payload " +
          "FROM " + wpTbl("wkcharts_ingest_runs") + " WHERE chart_id = ? ORDER BY created_at DESC",
          [chartId]
        );
      }

      const ingestByEdition = new Map();
      for (const run of ingestRuns) {
        if (run.edition_id && !ingestByEdition.has(run.edition_id)) {
          ingestByEdition.set(run.edition_id, run);
        }
      }

      for (const ed of editions) {
        const edId = Number(ed.id);
        const edDate = isoDate(ed.edition_date);
        const ingestRun = ingestByEdition.get(edId) || null;
        const edSlug = clean(ed.slug);

        // Build alias
        const oldPath = "charts/" + mapping.old_chart_slug + "/" + edSlug;
        const newPath = "charts/" + mapping.new_public_slug;
        allAliases.push({
          id: safeId("alias", "chart_" + mapping.old_chart_slug + "_" + edSlug),
          legacy_slug: oldPath,
          canonical_slug: newPath,
          entity_type: "chart_program",
          redirect_status: "active",
        });

        // Load items
        const items = await wpQuery(wp,
          "SELECT id, edition_id, track_id, rank, previous_rank, weeks_on_chart, " +
          "peak_position, is_new_entry, is_re_entry " +
          "FROM " + wpTbl("wkcharts_edition_items") + " WHERE edition_id = ? ORDER BY rank ASC",
          [edId]
        );

        if (items.length === 0) {
          discrepancies.push({
            type: "empty_edition",
            edition_id: edId, edition_date: edDate,
            chart_slug: mapping.old_chart_slug,
          });
          console.error("    " + edDate + ": EMPTY \u26a0\ufe0f");
        } else {
          console.error("    " + edDate + ": " + items.length + " items");
        }

        // Load tracks
        const trackIds = [...new Set(items.map(i => i.track_id))];
        const tracksById = new Map();
        if (trackIds.length > 0 && chartTables.includes("wkcharts_tracks")) {
          const ph = trackIds.map(() => "?").join(",");
          const rows = await wpQuery(wp,
            "SELECT id, title, slug, status, artist_id, release_id, spotify_id, " +
            "apple_music_id, youtube_id, isrc, explicit " +
            "FROM " + wpTbl("wkcharts_tracks") + " WHERE id IN (" + ph + ")",
            trackIds
          );
          for (const t of rows) tracksById.set(t.id, t);
        }

        // Check orphans
        for (const item of items) {
          if (!tracksById.has(item.track_id)) {
            discrepancies.push({
              type: "orphan_track",
              edition_id: edId, track_id: item.track_id,
              rank: item.rank, chart_slug: mapping.old_chart_slug,
            });
          }
        }

        // Load artists
        const artistIds = new Set();
        for (const [, t] of tracksById) {
          if (t.artist_id) artistIds.add(t.artist_id);
        }

        if (chartTables.includes("wkcharts_track_artists") && trackIds.length > 0) {
          const ph = trackIds.map(() => "?").join(",");
          const rows = await wpQuery(wp,
            "SELECT track_id, artist_id FROM " + wpTbl("wkcharts_track_artists") +
            " WHERE track_id IN (" + ph + ")", trackIds
          );
          for (const r of rows) artistIds.add(r.artist_id);
        }

        const artistsById = new Map();
        if (artistIds.size > 0 && chartTables.includes("wkcharts_artists")) {
          const ids = [...artistIds];
          const ph = ids.map(() => "?").join(",");
          const rows = await wpQuery(wp,
            "SELECT id, name, slug FROM " + wpTbl("wkcharts_artists") +
            " WHERE id IN (" + ph + ")", ids
          );
          for (const a of rows) artistsById.set(a.id, a);
        }

        // Load sources
        const sourcesByTrackId = new Map();
        if (chartTables.includes("wkcharts_track_sources") && trackIds.length > 0) {
          const ph = trackIds.map(() => "?").join(",");
          const rows = await wpQuery(wp,
            "SELECT id, track_id, provider, raw_payload FROM " + wpTbl("wkcharts_track_sources") +
            " WHERE track_id IN (" + ph + ")", trackIds
          );
          for (const s of rows) {
            const tid = s.track_id;
            if (!sourcesByTrackId.has(tid)) sourcesByTrackId.set(tid, []);
            sourcesByTrackId.get(tid).push(s);
          }
        }

        // Build V2 edition
        const v2EdId = safeId("edition", mapping.new_public_slug + "_" + edDate);
        const v2Edition = {
          id: v2EdId,
          program_id: mapping.new_program_id,
          edition_slug: edDate,
          edition_label: clean(ed.title) || mapping.new_public_label + " \u00b7 " + edDate,
          edition_date: edDate,
          period_start: edDate,
          period_end: edDate,
          status: clean(ed.status) === "published" ? "published" : "draft",
          entry_count: items.length,
          chart_size: 20,
          methodology_version: clean(ingestRun?.methodology) || "legacy-import-v1",
          source_policy_version: clean(ingestRun?.source_policy) || "legacy-import",
          eligibility_policy_version: clean(ingestRun?.eligibility_policy) || "legacy-import",
          scoring_policy_version: clean(ingestRun?.scoring_policy) || "legacy-import",
          rule_set_snapshot: {
            old_edition_id: edId,
            old_chart_id: chartId,
            old_chart_slug: mapping.old_chart_slug,
            week_number: ed.week_number,
            year: ed.year,
            ingest_run_id: ingestRun?.id || null,
            ingest_run_status: ingestRun?.status || null,
            migrated_at: new Date().toISOString(),
          },
          ingest_run_id: ingestRun ? String(ingestRun.id) : null,
          published_at: clean(ed.status) === "published" ? new Date().toISOString() : null,
          published_by: null,
        };
        allEditions.push(v2Edition);

        // Build entries
        for (const item of items) {
          const track = tracksById.get(item.track_id);
          const primaryArtist = track?.artist_id ? artistsById.get(track.artist_id) : undefined;
          const sources = sourcesByTrackId.get(item.track_id) || [];

          const trackTitle = clean(track?.title) || "Track " + item.track_id;
          const artistName = clean(primaryArtist?.name) || "Unknown Artist";

          let movement = "same";
          if (item.is_new_entry) movement = "new";
          else if (item.is_re_entry) movement = "re_entry";
          else if (item.previous_rank != null) {
            if (item.rank < item.previous_rank) movement = "up";
            else if (item.rank > item.previous_rank) movement = "down";
          }

          const sourceUrls = sources.map(s => {
            const prov = clean(s.provider).toLowerCase();
            if (prov === "spotify" && track?.spotify_id) return "https://open.spotify.com/track/" + clean(track.spotify_id);
            if (prov === "applemusic" && track?.apple_music_id) return "https://music.apple.com/track/" + clean(track.apple_music_id);
            if (prov === "youtube" && track?.youtube_id) return "https://youtube.com/watch?v=" + clean(track.youtube_id);
            return prov + ":track:" + (clean(track?.slug) || "");
          });

          allEntries.push({
            id: safeId("entry", edDate + "_" + String(item.rank).padStart(3, "0") + "_" + item.track_id),
            edition_id: v2EdId,
            rank: Number(item.rank),
            previous_rank: item.previous_rank != null ? Number(item.previous_rank) : null,
            movement,
            track_slug: clean(track?.slug) || null,
            track_title: trackTitle,
            artist_slug: clean(primaryArtist?.slug) || null,
            artist_name: artistName,
            artwork_url: null,
            normalized_key: safeSlug(trackTitle) + "::" + safeSlug(artistName),
            source_urls_seen: [...new Set(sourceUrls)],
            source_payload: {
              old_item_id: Number(item.id),
              old_track_id: item.track_id,
              weeks_on_chart: item.weeks_on_chart,
              peak_position: item.peak_position,
              is_new_entry: item.is_new_entry,
              is_re_entry: item.is_re_entry,
              track_isrc: track?.isrc ? clean(track.isrc) : null,
              track_spotify_id: track?.spotify_id ? clean(track.spotify_id) : null,
              track_apple_music_id: track?.apple_music_id ? clean(track.apple_music_id) : null,
              track_youtube_id: track?.youtube_id ? clean(track.youtube_id) : null,
              track_sources: sources.map(s => ({ provider: clean(s.provider), raw_payload: s.raw_payload })),
              migrated_at: new Date().toISOString(),
            },
            scoring_policy_version: v2Edition.scoring_policy_version,
            methodology_version: v2Edition.methodology_version,
            eligibility_policy_version: v2Edition.eligibility_policy_version,
          });
        }
      }
    }

    console.error("\n[import] Prepared:");
    console.error("  Programs: " + seenPrograms.size);
    console.error("  Editions: " + allEditions.length);
    console.error("  Entries: " + allEntries.length);
    console.error("  Aliases: " + allAliases.length);
    console.error("  Discrepancies: " + discrepancies.length);

    if (discrepancies.length > 0) {
      const byType = {};
      for (const d of discrepancies) byType[d.type] = (byType[d.type] || 0) + 1;
      console.error("\n[DISCREPANCIES]");
      for (const [t, c] of Object.entries(byType)) {
        console.error("  " + t + ": " + c);
      }
    }

    // ── PHASE 5: COMMIT (if requested) ──
    if (COMMIT && pool) {
      console.error("\n[import] COMMITTING to Supabase...\n");

      const seriesRows = [];
      const seenSeries = new Set();
      for (const m of mappings) {
        if (!seenSeries.has(m.new_series)) {
          seenSeries.add(m.new_series);
          seriesRows.push({ series_slug: m.new_series, series_label: m.new_series_label });
        }
      }

      const marketRows = [];
      const seenMarkets = new Set();
      for (const m of mappings) {
        if (!seenMarkets.has(m.new_market)) {
          seenMarkets.add(m.new_market);
          const mi = inferMarket(m.old_chart_slug, m.old_chart_name);
          marketRows.push({
            market_slug: m.new_market,
            market_label: mi.label,
            market_type: "country",
            country_code: mi.code,
            timezone: mi.tz,
            default_language: "en",
          });
        }
      }

      const uniqueMappings = mappings.filter((m, i, arr) =>
        arr.findIndex(x => x.new_program_id === m.new_program_id) === i
      );

      const programRows = uniqueMappings.map(m => ({
        id: m.new_program_id,
        series_slug: m.new_series,
        market_slug: m.new_market,
        public_slug: m.new_public_slug,
        public_label: m.new_public_label,
        short_label: m.new_series_label,
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
        override_mode: "metadata_and_matching_only",
      }));

      const coverageRows = allEditions.map(ed => ({
        id: safeId("coverage", ed.id + "_wp_import"),
        edition_id: ed.id,
        source_name: "WordPress Legacy Import",
        source_count: ed.entry_count,
        coverage_status: ed.entry_count > 0 ? "manual" : "unavailable",
        coverage_payload: { old_edition_id: ed.rule_set_snapshot.old_edition_id, migrated_at: new Date().toISOString() },
      }));

      const allSql = [];
      if (seriesRows.length) allSql.push(sqlInsert("wk_chart_series_v2", seriesRows));
      if (marketRows.length) allSql.push(sqlInsert("wk_chart_markets_v2", marketRows));
      if (programRows.length) allSql.push(sqlInsert("wk_chart_programs_v2", programRows));
      if (allEditions.length) allSql.push(sqlInsert("wk_chart_editions_v2", allEditions));
      if (allEntries.length) allSql.push(sqlInsert("wk_chart_entries_v2", allEntries));
      if (coverageRows.length) allSql.push(sqlInsert("wk_chart_source_coverage_v2", coverageRows));
      if (allAliases.length) allSql.push(sqlInsert("wk_chart_slug_aliases_v2", allAliases));

      const fullSql = allSql.join("\n\n");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(fullSql);
        await client.query("COMMIT");
        console.error("[import] COMMITTED successfully!\n");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("[import] ROLLBACK: " + err.message + "\n");
        throw err;
      } finally {
        client.release();
      }
    }

    // ── OUTPUT REPORT ──
    const report = {
      scanned_at: new Date().toISOString(),
      mode: COMMIT ? "committed" : "preview",
      wp_connection: { host: WP.host, database: WP.database, prefix: WP.prefix },
      wp_tables: chartTables,
      wp_table_counts: tableCounts,
      charts_found: charts.map(c => ({
        id: Number(c.id), name: clean(c.name), slug: clean(c.slug),
        status: clean(c.status), chart_type: clean(c.chart_type),
      })),
      mapping: mappings,
      summary: {
        programs: seenPrograms.size,
        editions: allEditions.length,
        entries: allEntries.length,
        aliases: allAliases.length,
        discrepancies: discrepancies.length,
      },
      discrepancies_by_type: discrepancies.reduce((acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
      }, {}),
      discrepancies: discrepancies.slice(0, 50),
      sample_editions: allEditions.slice(0, 5).map(ed => ({
        id: ed.id, program_id: ed.program_id,
        edition_slug: ed.edition_slug, edition_date: ed.edition_date,
        entry_count: ed.entry_count,
      })),
      sample_aliases: allAliases.slice(0, 10),
    };

    console.log(JSON.stringify(report, null, 2));
    console.error("\n[import] Done.\n");

  } finally {
    await wp.end();
    if (pool) await pool.end();
  }
}

main().catch(err => {
  console.error("[import] FATAL:", err.message);
  process.exit(1);
});