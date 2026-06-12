#!/usr/bin/env node
// export-wordpress-fixture.mjs — standalone WordPress → Gate A fixture exporter
//
// DROP THIS FILE onto your WordPress Lightsail server and run directly:
//   node export-wordpress-fixture.mjs \
//     --chart-slug top-songs-kenya \
//     --last 4 \
//     --output-dir fixtures
//
// OR for a single edition:
//   node export-wordpress-fixture.mjs \
//     --chart-slug top-songs-kenya \
//     --edition-date 2026-05-18 \
//     --output fixtures/edition-2026-05-18.json
//
// Requires mysql2 (npm install mysql2 if not already installed).
// No Supabase connection needed — reads directly from WordPress MySQL.

import mysql from 'mysql2/promise';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ══════════════════════════════════════════════════════════════════════════
// CLI helpers
// ══════════════════════════════════════════════════════════════════════════

function arg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function clean(value) {
  return String(value ?? '').trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isoDate(value) {
  // mysql2 returns DATE columns as JS Date objects — normalize to YYYY-MM-DD
  if (value instanceof Date && !isNaN(value)) {
    return value.toISOString().slice(0, 10);
  }
  var s = String(value ?? '').trim();
  return s.slice(0, 10) || s;
}

function normalizedKey(trackTitle, artistName) {
  return `${slugify(trackTitle)}::${slugify(artistName)}`;
}

// ══════════════════════════════════════════════════════════════════════════
// MySQL connection config
// ══════════════════════════════════════════════════════════════════════════

const DB_HOST = arg('--host') ?? process.env.WP_DB_HOST ?? '127.0.0.1';
const DB_PORT = Number(arg('--port') ?? process.env.WP_DB_PORT ?? 3306);
const DB_USER = arg('--user') ?? process.env.WP_DB_USER ?? 'bn_wordpress';
const DB_PASSWORD = arg('--password') ?? process.env.WP_DB_PASSWORD;
const DB_NAME = arg('--database') ?? process.env.WP_DB_NAME ?? 'bitnami_wordpress';
const DB_PREFIX = arg('--prefix') ?? process.env.WP_DB_PREFIX ?? 'wp_';

const CHART_SLUG = arg('--chart-slug') ?? 'top-songs-kenya';
const EDITION_DATE = arg('--edition-date') ?? null;
const LAST_N = arg('--last') ? Number(arg('--last')) : null;
const OUTPUT_PATH = arg('--output') ?? null;
const OUTPUT_DIR = arg('--output-dir') ?? null;

function tbl(name) {
  return '`' + DB_PREFIX + name + '`';
}

// ══════════════════════════════════════════════════════════════════════════
// Data loaders
// ══════════════════════════════════════════════════════════════════════════

async function loadChart(db) {
  const [rows] = await db.query(
    `SELECT id, slug, title, chart_size, provider FROM ${tbl('wkcharts_charts')} WHERE slug = ? LIMIT 1`,
    [CHART_SLUG],
  );
  if (!rows.length) {
    process.stderr.write(`[wp-fixture] FATAL: Chart not found with slug: ${CHART_SLUG}\n`);
    process.exit(1);
  }
  const c = rows[0];
  return {
    id: Number(c.id),
    slug: clean(c.slug),
    title: clean(c.title),
    chart_size: c.chart_size != null ? Number(c.chart_size) : null,
    provider: clean(c.provider),
  };
}

async function loadEditions(db, chartSlug) {
  let query;
  let params;

  if (EDITION_DATE) {
    query = `SELECT id, chart_slug, chart_title, chart_size, provider, source_url, edition_date, status, ingest_summary, methodology_version, source_policy_version, eligibility_policy_version, scoring_policy_version, policy_snapshot FROM ${tbl('wkcharts_editions')} WHERE chart_slug = ? AND edition_date = ? AND status = 'published' ORDER BY edition_date DESC`;
    params = [chartSlug, EDITION_DATE];
  } else if (LAST_N) {
    query = `SELECT id, chart_slug, chart_title, chart_size, provider, source_url, edition_date, status, ingest_summary, methodology_version, source_policy_version, eligibility_policy_version, scoring_policy_version, policy_snapshot FROM ${tbl('wkcharts_editions')} WHERE chart_slug = ? AND status = 'published' ORDER BY edition_date DESC LIMIT ?`;
    params = [chartSlug, LAST_N];
  } else {
    process.stderr.write('[wp-fixture] FATAL: Either --edition-date or --last is required\n');
    process.exit(1);
  }

  const [rows] = await db.query(query, params);
  if (!rows.length) {
    process.stderr.write(`[wp-fixture] FATAL: No published editions found for chart_slug=${chartSlug}\n`);
    process.exit(1);
  }

  return rows.map(function(r) {
    return {
      id: Number(r.id),
      chart_slug: clean(r.chart_slug),
      chart_title: clean(r.chart_title),
      chart_size: r.chart_size != null ? Number(r.chart_size) : null,
      provider: clean(r.provider),
      source_url: r.source_url ? clean(r.source_url) : null,
      edition_date: isoDate(r.edition_date),
      status: clean(r.status),
      ingest_summary: r.ingest_summary ? (typeof r.ingest_summary === 'string' ? r.ingest_summary : clean(r.ingest_summary)) : null,
      methodology_version: clean(r.methodology_version),
      source_policy_version: clean(r.source_policy_version),
      eligibility_policy_version: clean(r.eligibility_policy_version),
      scoring_policy_version: clean(r.scoring_policy_version),
      policy_snapshot: r.policy_snapshot ? (typeof r.policy_snapshot === 'string' ? r.policy_snapshot : null) : null,
    };
  });
}

async function loadEditionItems(db, editionId) {
  const [rows] = await db.query(
    `SELECT id, edition_id, position, track_id, title, artist_name, artwork_url, release_date, isrc, provider, provider_track_id, score, source_payload, release_id, duration_ms, source_count, carry_forward_only, continuity_locked, previous_position FROM ${tbl('wkcharts_edition_items')} WHERE edition_id = ? ORDER BY position ASC`,
    [editionId],
  );
  return rows.map(function(r) {
    return {
      id: Number(r.id),
      edition_id: Number(r.edition_id),
      position: Number(r.position),
      track_id: r.track_id != null ? Number(r.track_id) : null,
      title: clean(r.title),
      artist_name: clean(r.artist_name),
      artwork_url: r.artwork_url ? clean(r.artwork_url) : null,
      release_date: r.release_date ? clean(r.release_date) : null,
      isrc: r.isrc ? clean(r.isrc) : null,
      provider: clean(r.provider),
      provider_track_id: r.provider_track_id ? clean(r.provider_track_id) : null,
      score: r.score != null ? Number(r.score) : null,
      source_payload: r.source_payload ? (typeof r.source_payload === 'string' ? r.source_payload : null) : null,
      release_id: r.release_id != null ? Number(r.release_id) : null,
      duration_ms: r.duration_ms != null ? Number(r.duration_ms) : null,
      source_count: r.source_count != null ? Number(r.source_count) : null,
      carry_forward_only: r.carry_forward_only != null ? Number(r.carry_forward_only) : null,
      continuity_locked: r.continuity_locked != null ? Number(r.continuity_locked) : null,
      previous_position: r.previous_position != null ? Number(r.previous_position) : null,
    };
  });
}

async function loadTracksByIds(db, trackIds) {
  if (!trackIds.length) return new Map();
  var placeholders = trackIds.map(function() { return '?'; }).join(',');
  var [rows] = await db.query(
    `SELECT id, normalized_key, title, artist_name, display_artist_line, artwork_url, release_date, isrc, label_name, release_id, duration_ms FROM ${tbl('wkcharts_tracks')} WHERE id IN (${placeholders})`,
    trackIds,
  );
  var map = new Map();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    map.set(Number(r.id), {
      id: Number(r.id),
      normalized_key: r.normalized_key ? clean(r.normalized_key) : null,
      title: clean(r.title),
      artist_name: clean(r.artist_name),
      display_artist_line: r.display_artist_line ? clean(r.display_artist_line) : null,
      artwork_url: r.artwork_url ? clean(r.artwork_url) : null,
      release_date: r.release_date ? clean(r.release_date) : null,
      isrc: r.isrc ? clean(r.isrc) : null,
      label_name: r.label_name ? clean(r.label_name) : null,
      release_id: r.release_id != null ? Number(r.release_id) : null,
      duration_ms: r.duration_ms != null ? Number(r.duration_ms) : null,
    });
  }
  return map;
}

async function loadTrackSourcesByTrackIds(db, trackIds) {
  if (!trackIds.length) return new Map();
  var placeholders = trackIds.map(function() { return '?'; }).join(',');
  var [rows] = await db.query(
    `SELECT id, track_id, provider, provider_track_id, source_url, raw_payload, preview_url, preview_available FROM ${tbl('wkcharts_track_sources')} WHERE track_id IN (${placeholders})`,
    trackIds,
  );
  var map = new Map();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var tid = Number(r.track_id);
    if (!map.has(tid)) map.set(tid, []);
    map.get(tid).push({
      id: Number(r.id),
      track_id: tid,
      provider: clean(r.provider),
      provider_track_id: r.provider_track_id ? clean(r.provider_track_id) : null,
      source_url: r.source_url ? clean(r.source_url) : null,
      preview_url: r.preview_url ? clean(r.preview_url) : null,
      preview_available: r.preview_available != null ? Number(r.preview_available) : null,
    });
  }
  return map;
}

// ══════════════════════════════════════════════════════════════════════════
// Previous edition entries (using chart_slug, not chart_id)
// ══════════════════════════════════════════════════════════════════════════

async function loadPreviousEditionEntries(db, chartSlug, currentEditionDate) {
  var [rows] = await db.query(
    `SELECT id, edition_date FROM ${tbl('wkcharts_editions')} WHERE chart_slug = ? AND status = 'published' AND edition_date < ? ORDER BY edition_date DESC LIMIT 1`,
    [chartSlug, currentEditionDate],
  );
  if (!rows.length) {
    process.stderr.write('[wp-fixture] No previous edition found\n');
    return [];
  }

  var prevEditionId = Number(rows[0].id);
  var prevEditionDate = isoDate(rows[0].edition_date);
  var prevItems = await loadEditionItems(db, prevEditionId);

  var entries = [];
  for (var i = 0; i < prevItems.length; i++) {
    var item = prevItems[i];
    var title = item.title || ('Track ' + (item.track_id || 'unknown'));
    var artist = item.artist_name || 'Unknown Artist';
    var key = normalizedKey(title, artist);
    entries.push({ normalized_key: key, position: item.position });
  }

  process.stderr.write(`[wp-fixture] Previous edition #${prevEditionId} (${prevEditionDate}): ${entries.length} entries\n`);
  return entries;
}

// ══════════════════════════════════════════════════════════════════════════
// Fixture builder for a single edition
// ══════════════════════════════════════════════════════════════════════════

async function buildFixture(db, chart, edition) {
  process.stderr.write('\n[wp-fixture] Building fixture for edition #' + edition.id + ' (' + edition.edition_date + ')...\n');

  // 1. Load edition items (already have title, artist_name inline)
  var items = await loadEditionItems(db, edition.id);
  process.stderr.write('[wp-fixture]   ' + items.length + ' edition items\n');

  // 2. Collect track_ids, load tracks + track_sources
  var trackIds = [];
  var seenTrackIds = new Set();
  for (var i = 0; i < items.length; i++) {
    if (items[i].track_id != null && !seenTrackIds.has(items[i].track_id)) {
      seenTrackIds.add(items[i].track_id);
      trackIds.push(items[i].track_id);
    }
  }

  var tracksById = new Map();
  var trackSourcesById = new Map();
  if (trackIds.length > 0) {
    tracksById = await loadTracksByIds(db, trackIds);
    process.stderr.write('[wp-fixture]   ' + tracksById.size + ' tracks loaded');
    trackSourcesById = await loadTrackSourcesByTrackIds(db, trackIds);
    process.stderr.write(', ' + trackSourcesById.size + ' tracks with source data\n');
  } else {
    process.stderr.write('[wp-fixture]   no linked tracks\n');
  }

  // 3. Build source_evidence from track_sources + inline item data
  var sourceEvidence = [];
  var evidenceTrackIds = new Set();

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var tid = item.track_id;

    // Use inline data from edition_items if no linked track
    var trackTitle = item.title || 'Unknown Track';
    var artistName = item.artist_name || 'Unknown Artist';
    var releaseDate = item.release_date || null;

    // If linked track exists, prefer its data
    if (tid != null && tracksById.has(tid)) {
      var track = tracksById.get(tid);
      trackTitle = track.title || trackTitle;
      artistName = track.artist_name || artistName;
      releaseDate = track.release_date || releaseDate;
    }

    if (evidenceTrackIds.has(tid)) continue;
    evidenceTrackIds.add(tid);

    var sources = tid != null ? (trackSourcesById.get(tid) || []) : [];
    var sourceUrls = [];
    for (var s = 0; s < sources.length; s++) {
      if (sources[s].source_url) {
        sourceUrls.push(sources[s].source_url);
      } else {
        // fallback URL from provider + provider_track_id
        var prov = sources[s].provider || 'unknown';
        var ptid = sources[s].provider_track_id || '';
        sourceUrls.push(prov + ':track:' + (ptid || slugify(trackTitle)));
      }
    }

    sourceEvidence.push({
      track_title: trackTitle,
      artist_name: artistName,
      source_urls: sourceUrls.length > 0 ? sourceUrls : ['unknown:track:' + slugify(trackTitle)],
      release_date: releaseDate,
      occurrence_count: sourceUrls.length || 1,
    });
  }
  process.stderr.write('[wp-fixture]   ' + sourceEvidence.length + ' source evidence records\n');

  // 4. Build expected_positions from inline data + normalized_key from tracks
  var expectedPositions = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var title = item.title || 'Unknown Track';
    var artist = item.artist_name || 'Unknown Artist';

    // Use pre-computed normalized_key from tracks if available, else compute
    var nk = null;
    if (item.track_id != null && tracksById.has(item.track_id)) {
      var trackObj = tracksById.get(item.track_id);
      nk = trackObj.normalized_key;
    }
    if (!nk) {
      nk = normalizedKey(title, artist);
    }

    expectedPositions.push({
      rank: item.position,
      normalized_key: nk,
      track_title: title,
      artist_name: artist,
    });
  }

  // 5. Previous edition
  var previousEdition = await loadPreviousEditionEntries(db, chart.slug, edition.edition_date);

  // 6. No airplay table on this WP instance
  var airplayDetections = [];

  // 7. Assemble
  var chartSize = edition.chart_size || chart.chart_size || expectedPositions.length;
  var allSources = 0;
  for (var i = 0; i < sourceEvidence.length; i++) {
    allSources += sourceEvidence[i].source_urls.length;
  }

  return {
    _provenance: 'Exported from WordPress MySQL (' + CHART_SLUG + ', edition #' + edition.id + ', ' + edition.edition_date + ')',
    _generated_at: new Date().toISOString(),
    _generator: 'export-wordpress-fixture.mjs',
    _source_edition_id: edition.id,
    edition_date: edition.edition_date,
    chart_program: CHART_SLUG,
    chart_size: chartSize,
    scoring_policy_version: edition.scoring_policy_version || '1.0',
    methodology_notes: 'Chart: ' + (edition.chart_title || chart.title) + '. Provider: ' + (edition.provider || chart.provider || 'unknown') + '. Sources: ' + allSources + ' total URLs across ' + sourceEvidence.length + ' tracks.',
    corrections_applied: [],
    source_evidence: sourceEvidence,
    previous_edition: previousEdition,
    airplay_detections: airplayDetections,
    expected_positions: expectedPositions,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════════════

async function main() {
  process.stderr.write('[wp-fixture] Connecting to MySQL ' + DB_HOST + ':' + DB_PORT + '/' + DB_NAME + '...\n');

  var db = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    connectTimeout: 15000,
  });

  try {
    await db.ping();
    process.stderr.write('[wp-fixture] Connected.\n');

    var chart = await loadChart(db);
    process.stderr.write('[wp-fixture] Chart: ' + chart.title + ' (id=' + chart.id + ', size=' + (chart.chart_size || '?') + ')\n');

    var editions = await loadEditions(db, chart.slug);
    process.stderr.write('[wp-fixture] Found ' + editions.length + ' edition(s)\n');

    var fixtures = [];
    for (var i = 0; i < editions.length; i++) {
      var fixture = await buildFixture(db, chart, editions[i]);
      fixtures.push(fixture);
    }

    // Write fixtures
    var outDir = OUTPUT_DIR || (OUTPUT_PATH ? path.dirname(OUTPUT_PATH) : 'fixtures');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    for (var i = 0; i < fixtures.length; i++) {
      var fixture = fixtures[i];
      var filename = (fixtures.length > 1 && !OUTPUT_PATH)
        ? path.join(outDir, 'edition-' + fixture.edition_date + '.json')
        : (OUTPUT_PATH || path.join(outDir, 'edition-' + fixture.edition_date + '.json'));

      fs.writeFileSync(filename, JSON.stringify(fixture, null, 2) + '\n');
      process.stderr.write(
        '[wp-fixture] DONE: ' + filename + ' — ' +
        fixture.expected_positions.length + ' positions, ' +
        fixture.source_evidence.length + ' source tracks, ' +
        fixture.airplay_detections.length + ' airplay buckets\n',
      );
    }

    process.stderr.write('\n[wp-fixture] All done. ' + fixtures.length + ' fixture(s) exported.\n');
  } finally {
    await db.end();
  }
}

main().catch(function(err) {
  process.stderr.write('[wp-fixture] Unhandled error: ' + (err && err.message ? err.message : err) + '\n');
  if (err && err.stack) process.stderr.write(err.stack + '\n');
  process.exit(1);
});