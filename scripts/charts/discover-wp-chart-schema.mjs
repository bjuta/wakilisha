#!/usr/bin/env node
/**
 * discover-wp-chart-schema.mjs
 *
 * COMPREHENSIVE WordPress Chart Schema Discovery
 *
 * Run directly on the WordPress Lightsail server:
 *   node discover-wp-chart-schema.mjs
 *
 * Or with custom config:
 *   WP_DB_HOST=127.0.0.1 WP_DB_USER=bn_wordpress \
 *   WP_DB_PASSWORD=... WP_DB_NAME=bitnami_wordpress \
 *   node discover-wp-chart-schema.mjs
 *
 * Outputs a complete JSON report to stdout covering:
 *   1. All wkcharts_* table schemas (columns, types, keys, indexes)
 *   2. Sample rows (first 5 from each table)
 *   3. wp_posts with post_type = 'wk_chart_series' (chart program definitions)
 *   4. URL pattern analysis — how old slugs map to chart types/markets/dates
 *   5. Foreign key relationships and orphan detection
 *   6. Distinct value analysis (all chart slugs, markets, statuses, etc.)
 *
 * Pipe to a file:
 *   node discover-wp-chart-schema.mjs > wp-chart-schema-report.json 2>wp-chart-schema-errors.log
 */

import mysql from "mysql2/promise";

const CONFIG = {
  host: process.env.WP_DB_HOST || "127.0.0.1",
  port: Number(process.env.WP_DB_PORT || 3306),
  user: process.env.WP_DB_USER || "bn_wordpress",
  password: process.env.WP_DB_PASSWORD || "236407f4e9404d1cd2215f9759d1ddc198d04fa6aaffc7d61fb98f1422c4eb0b",
  database: process.env.WP_DB_NAME || "bitnami_wordpress",
  prefix: process.env.WP_DB_PREFIX || "wp_",
  connectTimeout: 15000,
};

function tbl(name) {
  return `\`${CONFIG.prefix}${name}\``;
}

async function query(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

async function countTable(conn, tableName) {
  try {
    const rows = await query(conn, `SELECT COUNT(*) AS cnt FROM ${tbl(tableName)}`);
    return Number(rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}

async function getColumns(conn, tableName) {
  try {
    const rows = await query(conn,
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA, COLUMN_DEFAULT, ORDINAL_POSITION
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [CONFIG.database, `${CONFIG.prefix}${tableName}`]
    );
    return rows;
  } catch {
    return [];
  }
}

async function getIndexes(conn, tableName) {
  try {
    const rows = await query(conn,
      `SHOW INDEX FROM ${tbl(tableName)}`
    );
    return rows.map(r => ({
      key_name: r.Key_name,
      column_name: r.Column_name,
      non_unique: r.Non_unique,
      seq_in_index: r.Seq_in_index,
    }));
  } catch {
    return [];
  }
}

async function getSampleRows(conn, tableName, limit = 5) {
  try {
    const rows = await query(conn, `SELECT * FROM ${tbl(tableName)} LIMIT ${limit}`);
    return rows;
  } catch {
    return [];
  }
}

async function getDistinctValues(conn, tableName, columnName) {
  try {
    const rows = await query(conn,
      `SELECT ${columnName}, COUNT(*) AS cnt FROM ${tbl(tableName)} GROUP BY ${columnName} ORDER BY cnt DESC`
    );
    return rows;
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────

async function discover() {
  const conn = await mysql.createConnection(CONFIG);
  console.error("[discover] Connected to MySQL. Scanning chart tables...\n");

  try {
    const report = {
      scanned_at: new Date().toISOString(),
      connection: {
        host: CONFIG.host,
        database: CONFIG.database,
        prefix: CONFIG.prefix,
      },

      // ── 1. All wkcharts tables overview ──
      table_overview: {},

      // ── 2. Detailed table schemas ──
      table_schemas: {},

      // ── 3. Chart programs from wp_posts ──
      chart_series_posts: null,

      // ── 4. URL pattern analysis ──
      url_pattern_analysis: null,

      // ── 5. Foreign key integrity ──
      foreign_key_integrity: null,

      // ── 6. Distinct value summaries ──
      distinct_values: {},
    };

    // ──────────────────────────────────────────────────
    // 1. TABLE OVERVIEW — discover all wkcharts tables
    // ──────────────────────────────────────────────────
    const allTables = await query(conn,
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE ? ORDER BY TABLE_NAME`,
      [CONFIG.database, `${CONFIG.prefix}wkcharts%`]
    );

    const chartTableNames = allTables.map(r => r.TABLE_NAME.replace(CONFIG.prefix, ""));

    console.error(`[discover] Found ${chartTableNames.length} wkcharts tables:`);
    for (const name of chartTableNames) {
      const count = await countTable(conn, name);
      report.table_overview[name] = count;
      console.error(`  ${name}: ${count} rows`);
    }

    // Also check wp_posts for wk_chart_series
    const chartSeriesCount = (await query(conn,
      `SELECT COUNT(*) AS cnt FROM ${tbl("posts")} WHERE post_type = 'wk_chart_series'`
    ))[0]?.cnt ?? 0;
    console.error(`  wp_posts (post_type=wk_chart_series): ${chartSeriesCount} rows`);

    // ──────────────────────────────────────────────────
    // 2. DETAILED TABLE SCHEMAS
    // ──────────────────────────────────────────────────
    for (const name of chartTableNames) {
      console.error(`\n[discover] Schema: ${name}`);
      const columns = await getColumns(conn, name);
      const indexes = await getIndexes(conn, name);
      const samples = await getSampleRows(conn, name, 5);

      report.table_schemas[name] = {
        row_count: report.table_overview[name],
        columns: columns.map(c => ({
          name: c.COLUMN_NAME,
          data_type: c.DATA_TYPE,
          column_type: c.COLUMN_TYPE,
          nullable: c.IS_NULLABLE === "YES",
          key: c.COLUMN_KEY || null,
          extra: c.EXTRA || null,
          default: c.COLUMN_DEFAULT,
        })),
        indexes,
        sample_rows: samples,
      };

      console.error(`    ${columns.length} columns, ${indexes.filter(i => i.key_name === "PRIMARY").length} PK, ${indexes.length} total indexes`);
      console.error(`    Samples: ${samples.length} rows`);
    }

    // Also dump wp_posts for wk_chart_series
    {
      const name = "posts (wk_chart_series)";
      console.error(`\n[discover] Schema: ${name}`);
      const columns = await getColumns(conn, "posts");
      const chartPosts = await query(conn,
        `SELECT * FROM ${tbl("posts")} WHERE post_type = 'wk_chart_series' ORDER BY ID`
      );

      report.chart_series_posts = {
        row_count: chartPosts.length,
        columns: columns.map(c => ({
          name: c.COLUMN_NAME,
          data_type: c.DATA_TYPE,
          column_type: c.COLUMN_TYPE,
          nullable: c.IS_NULLABLE === "YES",
          key: c.COLUMN_KEY || null,
          extra: c.EXTRA || null,
          default: c.COLUMN_DEFAULT,
        })),
        sample_rows: chartPosts,
      };
    }

    // ──────────────────────────────────────────────────
    // 3. DISTINCT VALUES ANALYSIS
    // ──────────────────────────────────────────────────
    console.error("\n[discover] Distinct value analysis...");

    // Chart slugs from editions
    if (chartTableNames.includes("wkcharts_editions")) {
      const slugs = await getDistinctValues(conn, "wkcharts_editions", "slug");
      const statuses = await getDistinctValues(conn, "wkcharts_editions", "status");
      const dates = await query(conn,
        `SELECT edition_date, COUNT(*) AS cnt FROM ${tbl("wkcharts_editions")} GROUP BY edition_date ORDER BY edition_date DESC LIMIT 20`
      );
      const chartIds = await getDistinctValues(conn, "wkcharts_editions", "chart_id");

      report.distinct_values.editions = { slugs, statuses, recent_dates: dates, chart_ids: chartIds };
    }

    // Track providers
    if (chartTableNames.includes("wkcharts_track_sources")) {
      const providers = await getDistinctValues(conn, "wkcharts_track_sources", "provider");
      report.distinct_values.track_sources = { providers };
    }

    // Track fields of interest
    if (chartTableNames.includes("wkcharts_tracks")) {
      const statuses = await getDistinctValues(conn, "wkcharts_tracks", "status");
      const hasSpotify = await query(conn,
        `SELECT COUNT(*) AS cnt FROM ${tbl("wkcharts_tracks")} WHERE spotify_id IS NOT NULL AND spotify_id != ''`
      );
      const hasApple = await query(conn,
        `SELECT COUNT(*) AS cnt FROM ${tbl("wkcharts_tracks")} WHERE apple_music_id IS NOT NULL AND apple_music_id != ''`
      );
      const hasYoutube = await query(conn,
        `SELECT COUNT(*) AS cnt FROM ${tbl("wkcharts_tracks")} WHERE youtube_id IS NOT NULL AND youtube_id != ''`
      );
      const hasIsrc = await query(conn,
        `SELECT COUNT(*) AS cnt FROM ${tbl("wkcharts_tracks")} WHERE isrc IS NOT NULL AND isrc != ''`
      );
      report.distinct_values.tracks = {
        statuses,
        provider_coverage: {
          spotify: Number(hasSpotify[0]?.cnt ?? 0),
          apple_music: Number(hasApple[0]?.cnt ?? 0),
          youtube: Number(hasYoutube[0]?.cnt ?? 0),
          isrc: Number(hasIsrc[0]?.cnt ?? 0),
        },
      };
    }

    // Artist fields
    if (chartTableNames.includes("wkcharts_artists")) {
      const statuses = await getDistinctValues(conn, "wkcharts_artists", "status");
      report.distinct_values.artists = { statuses };
    }

    // Ingest runs
    if (chartTableNames.includes("wkcharts_ingest_runs")) {
      const statuses = await getDistinctValues(conn, "wkcharts_ingest_runs", "status");
      report.distinct_values.ingest_runs = { statuses };
    }

    // ──────────────────────────────────────────────────
    // 4. URL PATTERN ANALYSIS
    // ──────────────────────────────────────────────────
    console.error("\n[discover] URL pattern analysis...");

    if (chartTableNames.includes("wkcharts_editions")) {
      // Get all unique chart+edition combinations to understand URL structure
      const urlPatterns = await query(conn,
        `SELECT e.id, e.slug AS edition_slug, e.title, e.edition_date, e.chart_id,
                COALESCE(c.slug, 'NO_CHART') AS chart_slug,
                COALESCE(c.name, 'NO_CHART') AS chart_name,
                COALESCE(c.chart_type, 'unknown') AS chart_type,
                e.entry_count
         FROM ${tbl("wkcharts_editions")} e
         LEFT JOIN ${tbl("wkcharts_charts")} c ON c.id = e.chart_id
         ORDER BY e.edition_date DESC, e.chart_id`
      );

      // Also get chart series from wp_posts
      const postChartSeries = await query(conn,
        `SELECT p.ID, p.post_title, p.post_name, p.post_status,
                pm_chart_type.meta_value AS chart_type,
                pm_frequency.meta_value AS frequency
         FROM ${tbl("posts")} p
         LEFT JOIN ${tbl("postmeta")} pm_chart_type ON pm_chart_type.post_id = p.ID AND pm_chart_type.meta_key = 'chart_type'
         LEFT JOIN ${tbl("postmeta")} pm_frequency ON pm_frequency.post_id = p.ID AND pm_frequency.meta_key = 'frequency'
         WHERE p.post_type = 'wk_chart_series' AND p.post_status != 'trash'
         ORDER BY p.ID`
      );

      // Build URL pattern summary
      const chartSlugMap = {};
      for (const row of urlPatterns) {
        const cs = row.chart_slug || "unknown";
        if (!chartSlugMap[cs]) {
          chartSlugMap[cs] = {
            chart_slug: cs,
            chart_name: row.chart_name,
            chart_type: row.chart_type,
            chart_id: row.chart_id,
            edition_count: 0,
            total_entries: 0,
            first_edition: row.edition_date,
            last_edition: row.edition_date,
            sample_edition_slugs: [],
            sample_urls: [],
          };
        }
        chartSlugMap[cs].edition_count++;
        chartSlugMap[cs].total_entries += (row.entry_count || 0);
        if (row.edition_date < chartSlugMap[cs].first_edition) chartSlugMap[cs].first_edition = row.edition_date;
        if (row.edition_date > chartSlugMap[cs].last_edition) chartSlugMap[cs].last_edition = row.edition_date;
        if (chartSlugMap[cs].sample_edition_slugs.length < 3) {
          chartSlugMap[cs].sample_edition_slugs.push(row.edition_slug);
          chartSlugMap[cs].sample_urls.push(`/charts/${cs}/${row.edition_slug}/`);
        }
      }

      // Show WP post chart series
      const wpChartSeriesMapped = postChartSeries.map(p => ({
        post_id: p.ID,
        post_title: p.post_title,
        post_name: p.post_name,
        post_status: p.post_status,
        chart_type: p.chart_type,
        frequency: p.frequency,
      }));

      report.url_pattern_analysis = {
        total_editions: urlPatterns.length,
        unique_chart_slugs: Object.keys(chartSlugMap).length,
        chart_slug_detail: Object.values(chartSlugMap),
        wp_chart_series_posts: wpChartSeriesMapped,
        old_url_format: "https://wakilisha.africa/charts/{chart_slug}/{edition_slug}/",
        example_urls: Object.values(chartSlugMap).flatMap(c => c.sample_urls.slice(0, 1)),
      };

      console.error(`    ${urlPatterns.length} total editions`);
      console.error(`    ${Object.keys(chartSlugMap).length} unique chart slugs`);
      for (const [slug, detail] of Object.entries(chartSlugMap)) {
        console.error(`      ${slug}: ${detail.edition_count} editions, ${detail.total_entries} entries (${detail.first_edition} → ${detail.last_edition})`);
      }
    }

    // ──────────────────────────────────────────────────
    // 5. FOREIGN KEY INTEGRITY
    // ──────────────────────────────────────────────────
    console.error("\n[discover] Foreign key integrity checks...");

    const fk = {};

    // edition_items → tracks
    if (chartTableNames.includes("wkcharts_edition_items") && chartTableNames.includes("wkcharts_tracks")) {
      const orphanTracks = await query(conn,
        `SELECT COUNT(*) AS cnt FROM ${tbl("wkcharts_edition_items")} ei
         LEFT JOIN ${tbl("wkcharts_tracks")} t ON t.id = ei.track_id
         WHERE t.id IS NULL`
      );
      fk.edition_items_to_tracks_orphans = Number(orphanTracks[0]?.cnt ?? 0);
    }

    // edition_items → editions
    if (chartTableNames.includes("wkcharts_edition_items") && chartTableNames.includes("wkcharts_editions")) {
      const orphanEditions = await query(conn,
        `SELECT COUNT(*) AS cnt FROM ${tbl("wkcharts_edition_items")} ei
         LEFT JOIN ${tbl("wkcharts_editions")} e ON e.id = ei.edition_id
         WHERE e.id IS NULL`
      );
      fk.edition_items_to_editions_orphans = Number(orphanEditions[0]?.cnt ?? 0);
    }

    // editions → charts
    if (chartTableNames.includes("wkcharts_editions") && chartTableNames.includes("wkcharts_charts")) {
      const orphanCharts = await query(conn,
        `SELECT COUNT(*) AS cnt FROM ${tbl("wkcharts_editions")} e
         LEFT JOIN ${tbl("wkcharts_charts")} c ON c.id = e.chart_id
         WHERE c.id IS NULL`
      );
      fk.editions_to_charts_orphans = Number(orphanCharts[0]?.cnt ?? 0);
    }

    // track_artists → tracks
    if (chartTableNames.includes("wkcharts_track_artists") && chartTableNames.includes("wkcharts_tracks")) {
      const orphanTracks = await query(conn,
        `SELECT COUNT(*) AS cnt FROM ${tbl("wkcharts_track_artists")} ta
         LEFT JOIN ${tbl("wkcharts_tracks")} t ON t.id = ta.track_id
         WHERE t.id IS NULL`
      );
      fk.track_artists_to_tracks_orphans = Number(orphanTracks[0]?.cnt ?? 0);
    }

    // track_artists → artists
    if (chartTableNames.includes("wkcharts_track_artists") && chartTableNames.includes("wkcharts_artists")) {
      const orphanArtists = await query(conn,
        `SELECT COUNT(*) AS cnt FROM ${tbl("wkcharts_track_artists")} ta
         LEFT JOIN ${tbl("wkcharts_artists")} a ON a.id = ta.artist_id
         WHERE a.id IS NULL`
      );
      fk.track_artists_to_artists_orphans = Number(orphanArtists[0]?.cnt ?? 0);
    }

    // track_sources → tracks
    if (chartTableNames.includes("wkcharts_track_sources") && chartTableNames.includes("wkcharts_tracks")) {
      const orphanSources = await query(conn,
        `SELECT COUNT(*) AS cnt FROM ${tbl("wkcharts_track_sources")} ts
         LEFT JOIN ${tbl("wkcharts_tracks")} t ON t.id = ts.track_id
         WHERE t.id IS NULL`
      );
      fk.track_sources_to_tracks_orphans = Number(orphanSources[0]?.cnt ?? 0);
    }

    // tracks → artists
    if (chartTableNames.includes("wkcharts_tracks") && chartTableNames.includes("wkcharts_artists")) {
      const orphanArtistIds = await query(conn,
        `SELECT COUNT(*) AS cnt FROM ${tbl("wkcharts_tracks")} t
         LEFT JOIN ${tbl("wkcharts_artists")} a ON a.id = t.artist_id
         WHERE t.artist_id IS NOT NULL AND a.id IS NULL`
      );
      fk.tracks_to_artists_orphans = Number(orphanArtistIds[0]?.cnt ?? 0);
    }

    report.foreign_key_integrity = fk;
    console.error(`    Orphan checks:`, JSON.stringify(fk));

    // ──────────────────────────────────────────────────
    // 6. EDITION ITEMS SAMPLE (for mapping validation)
    // ──────────────────────────────────────────────────
    if (chartTableNames.includes("wkcharts_edition_items")) {
      console.error("\n[discover] Edition items sample...");
      const itemsWithTracks = await query(conn,
        `SELECT ei.id, ei.edition_id, ei.rank, ei.previous_rank, ei.track_id,
                ei.weeks_on_chart, ei.peak_position, ei.is_new_entry, ei.is_re_entry,
                t.title AS track_title, t.slug AS track_slug,
                t.spotify_id, t.apple_music_id, t.youtube_id, t.isrc,
                t.artist_id
         FROM ${tbl("wkcharts_edition_items")} ei
         LEFT JOIN ${tbl("wkcharts_tracks")} t ON t.id = ei.track_id
         ORDER BY ei.edition_id DESC, ei.rank ASC
         LIMIT 20`
      );
      report.sample_edition_items_with_tracks = itemsWithTracks;
    }

    // ── OUTPUT ──
    console.error("\n[discover] Done. Outputting JSON...\n");
    console.log(JSON.stringify(report, null, 2));

  } finally {
    await conn.end();
  }
}

discover().catch((err) => {
  console.error("[discover] FATAL:", err.message);
  process.exit(1);
});