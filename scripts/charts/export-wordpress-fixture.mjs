#!/usr/bin/env node
// export-wordpress-fixture.mjs — standalone bundled WordPress → Gate A fixture exporter
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

function required(value, label) {
  if (!value) {
    process.stderr.write(`[wp-fixture] FATAL: ${label} is required.\n`);
    process.exit(1);
  }
  return value;
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

function normalizedKey(trackTitle, artistName) {
  return `${slugify(trackTitle)}::${slugify(artistName)}`;
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
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
    `SELECT id, name, slug, status, chart_type, frequency FROM ${tbl('wkcharts_charts')} WHERE slug = ? LIMIT 1`,
    [CHART_SLUG],
  );
  if (!rows.length) {
    process.stderr.write(`[wp-fixture] FATAL: Chart not found with slug: ${CHART_SLUG}\n`);
    process.exit(1);
  }
  const c = rows[0];
  return {
    id: Number(c.id),
    name: clean(c.name),
    slug: clean(c.slug),
    status: clean(c.status),
    chart_type: clean(c.chart_type),
    frequency: clean(c.frequency),
  };
}

async function loadEditions(db, chartId) {
  let query;
  let params;

  if (EDITION_DATE) {
    query = `SELECT id, title, slug, status, edition_date, chart_id, week_number, year, entry_count FROM ${tbl('wkcharts_editions')} WHERE chart_id = ? AND edition_date = ? AND status = 'publish' ORDER BY edition_date DESC`;
    params = [chartId, EDITION_DATE];
  } else if (LAST_N) {
    query = `SELECT id, title, slug, status, edition_date, chart_id, week_number, year, entry_count FROM ${tbl('wkcharts_editions')} WHERE chart_id = ? AND status = 'publish' ORDER BY edition_date DESC LIMIT ?`;
    params = [chartId, LAST_N];
  } else {
    process.stderr.write('[wp-fixture] FATAL: Either --edition-date or --last is required\n');
    process.exit(1);
  }

  const [rows] = await db.query(query, params);
  if (!rows.length) {
    process.stderr.write(`[wp-fixture] FATAL: No published editions found for chart_id=${chartId}\n`);
    process.exit(1);
  }

  return rows.map(function(r) {
    return {
      id: Number(r.id),
      title: clean(r.title),
      slug: clean(r.slug),
      status: clean(r.status),
      edition_date: clean(r.edition_date),
      chart_id: Number(r.chart_id),
      week_number: r.week_number != null ? Number(r.week_number) : null,
      year: r.year != null ? Number(r.year) : null,
      entry_count: r.entry_count != null ? Number(r.entry_count) : null,
    };
  });
}

async function loadEditionItems(db, editionId) {
  const [rows] = await db.query(
    `SELECT id, edition_id, track_id, rank, previous_rank, weeks_on_chart, peak_position, is_new_entry, is_re_entry FROM ${tbl('wkcharts_edition_items')} WHERE edition_id = ? ORDER BY rank ASC`,
    [editionId],
  );
  return rows.map(function(r) {
    return {
      id: Number(r.id),
      edition_id: Number(r.edition_id),
      track_id: Number(r.track_id),
      rank: Number(r.rank),
      previous_rank: r.previous_rank != null ? Number(r.previous_rank) : null,
      weeks_on_chart: r.weeks_on_chart != null ? Number(r.weeks_on_chart) : null,
      peak_position: r.peak_position != null ? Number(r.peak_position) : null,
      is_new_entry: r.is_new_entry != null ? Number(r.is_new_entry) : null,
      is_re_entry: r.is_re_entry != null ? Number(r.is_re_entry) : null,
    };
  });
}

async function loadTracks(db, trackIds) {
  if (!trackIds.length) return new Map();
  var placeholders = trackIds.map(function() { return '?'; }).join(',');
  var [rows] = await db.query(
    `SELECT id, title, slug, status, artist_id, release_id, spotify_id, apple_music_id, youtube_id, isrc, explicit FROM ${tbl('wkcharts_tracks')} WHERE id IN (${placeholders})`,
    trackIds,
  );
  var map = new Map();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    map.set(Number(r.id), {
      id: Number(r.id),
      title: clean(r.title),
      slug: clean(r.slug),
      status: clean(r.status),
      artist_id: r.artist_id != null ? Number(r.artist_id) : null,
      release_id: r.release_id != null ? Number(r.release_id) : null,
      spotify_id: r.spotify_id ? clean(r.spotify_id) : null,
      apple_music_id: r.apple_music_id ? clean(r.apple_music_id) : null,
      youtube_id: r.youtube_id ? clean(r.youtube_id) : null,
      isrc: r.isrc ? clean(r.isrc) : null,
      explicit: r.explicit != null ? Number(r.explicit) : null,
    });
  }
  return map;
}

async function loadArtists(db, artistIds) {
  if (!artistIds.length) return new Map();
  var placeholders = artistIds.map(function() { return '?'; }).join(',');
  var [rows] = await db.query(
    `SELECT id, name, slug FROM ${tbl('wkcharts_artists')} WHERE id IN (${placeholders})`,
    artistIds,
  );
  var map = new Map();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    map.set(Number(r.id), {
      id: Number(r.id),
      name: clean(r.name),
      slug: clean(r.slug),
    });
  }
  return map;
}

async function loadTrackArtists(db, trackIds) {
  if (!trackIds.length) return new Map();
  var placeholders = trackIds.map(function() { return '?'; }).join(',');
  var [rows] = await db.query(
    `SELECT id, track_id, artist_id, is_primary FROM ${tbl('wkcharts_track_artists')} WHERE track_id IN (${placeholders}) ORDER BY is_primary DESC, sort_order ASC`,
    trackIds,
  );
  var map = new Map();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var tid = Number(r.track_id);
    var aid = Number(r.artist_id);
    if (!map.has(tid)) map.set(tid, []);
    map.get(tid).push(aid);
  }
  return map;
}

async function loadTrackSources(db, trackIds) {
  if (!trackIds.length) return new Map();
  var placeholders = trackIds.map(function() { return '?'; }).join(',');
  var [rows] = await db.query(
    `SELECT id, track_id, provider, raw_payload FROM ${tbl('wkcharts_track_sources')} WHERE track_id IN (${placeholders})`,
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
      raw_payload: typeof r.raw_payload === 'string' ? r.raw_payload : null,
    });
  }
  return map;
}

async function loadReleases(db, releaseIds) {
  if (!releaseIds.length) return new Map();
  var placeholders = releaseIds.map(function() { return '?'; }).join(',');
  var [rows] = await db.query(
    `SELECT id, title, release_date FROM ${tbl('wkcharts_releases')} WHERE id IN (${placeholders})`,
    releaseIds,
  );
  var map = new Map();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    map.set(Number(r.id), {
      id: Number(r.id),
      title: clean(r.title),
      release_date: r.release_date ? clean(r.release_date) : null,
    });
  }
  return map;
}

// ══════════════════════════════════════════════════════════════════════════
// Previous edition entries
// ══════════════════════════════════════════════════════════════════════════

async function loadPreviousEditionEntries(db, chartId, currentEditionDate, tracksById, trackArtists, artistsById) {
  var [rows] = await db.query(
    `SELECT id, edition_date FROM ${tbl('wkcharts_editions')} WHERE chart_id = ? AND status = 'publish' AND edition_date < ? ORDER BY edition_date DESC LIMIT 1`,
    [chartId, currentEditionDate],
  );
  if (!rows.length) return [];

  var prevEditionId = Number(rows[0].id);
  var prevItems = await loadEditionItems(db, prevEditionId);

  // Ensure we have track/artist data
  var prevTrackIds = prevItems.map(function(i) { return i.track_id; });
  var missingTrackIds = prevTrackIds.filter(function(id) { return !tracksById.has(id); });
  if (missingTrackIds.length) {
    var moreTracks = await loadTracks(db, missingTrackIds);
    moreTracks.forEach(function(track, id) { tracksById.set(id, track); });
  }

  var allTrackIds = Array.from(new Set(
    Array.from(tracksById.keys()).concat(prevTrackIds)
  ));
  var missingArtistTrackIds = allTrackIds.filter(function(id) { return !trackArtists.has(id); });
  if (missingArtistTrackIds.length) {
    var moreTrackArtists = await loadTrackArtists(db, allTrackIds);
    moreTrackArtists.forEach(function(aids, tid) { trackArtists.set(tid, aids); });
  }

  var allArtistIds = new Set();
  trackArtists.forEach(function(aids) {
    for (var i = 0; i < aids.length; i++) allArtistIds.add(aids[i]);
  });
  var missingArtistIds = Array.from(allArtistIds).filter(function(id) { return !artistsById.has(id); });
  if (missingArtistIds.length) {
    var moreArtists = await loadArtists(db, missingArtistIds);
    moreArtists.forEach(function(artist, id) { artistsById.set(id, artist); });
  }

  var entries = [];
  for (var i = 0; i < prevItems.length; i++) {
    var item = prevItems[i];
    var track = tracksById.get(item.track_id);
    if (!track) continue;

    var aids = trackArtists.get(item.track_id) || [];
    var primaryArtist = aids.length > 0 ? artistsById.get(aids[0]) : null;
    var title = track.title || ('Track ' + item.track_id);
    var artist = primaryArtist ? primaryArtist.name : 'Unknown Artist';
    var key = normalizedKey(title, artist);
    entries.push({ normalized_key: key, position: item.rank });
  }

  process.stderr.write(`[wp-fixture] Previous edition #${prevEditionId}: ${entries.length} entries\n`);
  return entries;
}

// ══════════════════════════════════════════════════════════════════════════
// Airplay (best-effort)
// ══════════════════════════════════════════════════════════════════════════

async function tryLoadAirplay(db, editionDate, tracksById, trackArtists, artistsById) {
  var buckets = [];
  var weekStart = getWeekStart(editionDate);

  // Try dedicated airplay table
  try {
    var [rows] = await db.query(
      `SELECT * FROM ${tbl('wkcharts_airplay')} WHERE week_start = ? LIMIT 100`,
      [weekStart],
    );
    if (rows.length > 0) {
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var trackId = r.track_id != null ? Number(r.track_id) : null;
        var trackTitle = 'Unknown';
        var artistName = 'Unknown';
        if (trackId && tracksById.has(trackId)) {
          trackTitle = tracksById.get(trackId).title;
          var aids = trackArtists.get(trackId) || [];
          artistName = aids.length > 0 ? (artistsById.get(aids[0]) ? artistsById.get(aids[0]).name : 'Unknown') : 'Unknown';
        }
        buckets.push({
          canonical_track_id: 'wp-track-' + (trackId || 'unknown'),
          normalized_key: normalizedKey(trackTitle, artistName),
          station_id: clean(r.station_id || r.source_id || 'unknown-station'),
          station_weight: r.station_weight != null ? Number(r.station_weight) : 1.0,
          week_start: clean(r.week_start || weekStart),
          detection_count: r.detection_count != null ? Number(r.detection_count) : 0,
          total_played_duration: r.total_played_duration_seconds != null ? Number(r.total_played_duration_seconds) : 0,
          weighted_score: r.weighted_score != null ? Number(r.weighted_score) : 0,
        });
      }
    }
  } catch (e) {
    // Table doesn't exist — that's fine
  }

  if (buckets.length > 0) {
    process.stderr.write('[wp-fixture] Airplay: ' + buckets.length + ' buckets from wkcharts_airplay\n');
  } else {
    process.stderr.write('[wp-fixture] Airplay: none found (no wkcharts_airplay table or no data)\n');
  }

  return buckets;
}

// ══════════════════════════════════════════════════════════════════════════
// Source URL construction
// ══════════════════════════════════════════════════════════════════════════

function providerToSourceUrl(provider, track) {
  var slug = track.slug || slugify(track.title);
  switch (provider.toLowerCase()) {
    case 'spotify':
      return track.spotify_id
        ? 'https://open.spotify.com/track/' + track.spotify_id
        : 'spotify:track:' + slug;
    case 'applemusic':
      return track.apple_music_id
        ? 'https://music.apple.com/track/' + track.apple_music_id
        : 'applemusic:track:' + slug;
    case 'youtube':
      return track.youtube_id
        ? 'https://youtube.com/watch?v=' + track.youtube_id
        : 'youtube:track:' + slug;
    case 'deezer':
      return 'deezer:track:' + slug;
    case 'boomplay':
      return 'boomplay:track:' + slug;
    default:
      return provider.toLowerCase() + ':track:' + slug;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Fixture builder for a single edition
// ══════════════════════════════════════════════════════════════════════════

async function buildFixture(db, chart, edition) {
  process.stderr.write('\n[wp-fixture] Building fixture for edition #' + edition.id + ' (' + edition.edition_date + ')...\n');

  // 1. Load edition items
  var items = await loadEditionItems(db, edition.id);
  process.stderr.write('[wp-fixture]   ' + items.length + ' edition items\n');

  // 2. Load tracks
  var trackIds = Array.from(new Set(items.map(function(i) { return i.track_id; })));
  var tracksById = await loadTracks(db, trackIds);
  process.stderr.write('[wp-fixture]   ' + tracksById.size + ' tracks loaded\n');

  // 3. Load track→artist mappings
  var trackArtists = await loadTrackArtists(db, trackIds);
  var allArtistIds = new Set();
  trackArtists.forEach(function(aids) {
    for (var i = 0; i < aids.length; i++) allArtistIds.add(aids[i]);
  });
  var artistsById = await loadArtists(db, Array.from(allArtistIds));
  process.stderr.write('[wp-fixture]   ' + artistsById.size + ' artists loaded\n');

  // 4. Load releases
  var releaseIds = Array.from(new Set(
    Array.from(tracksById.values())
      .map(function(t) { return t.release_id; })
      .filter(function(id) { return id != null; })
  ));
  var releasesById = await loadReleases(db, releaseIds);

  // 5. Load track sources
  var trackSources = await loadTrackSources(db, trackIds);
  process.stderr.write('[wp-fixture]   ' + trackSources.size + ' tracks with source data\n');

  // 6. Build source_evidence
  var sourceEvidence = [];
  var seenTracks = new Set();

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (seenTracks.has(item.track_id)) continue;
    seenTracks.add(item.track_id);

    var track = tracksById.get(item.track_id);
    if (!track) continue;

    var aids = trackArtists.get(item.track_id) || [];
    var primaryArtist = aids.length > 0 ? artistsById.get(aids[0]) : null;
    var artistName = primaryArtist ? primaryArtist.name : 'Unknown Artist';

    var sources = trackSources.get(item.track_id) || [];
    var sourceUrls = [];
    for (var s = 0; s < sources.length; s++) {
      sourceUrls.push(providerToSourceUrl(sources[s].provider, track));
    }
    var uniqueUrls = Array.from(new Set(sourceUrls));

    var releaseDate = null;
    if (track.release_id != null && releasesById.has(track.release_id)) {
      releaseDate = releasesById.get(track.release_id).release_date;
    }

    sourceEvidence.push({
      track_title: track.title || ('Track ' + item.track_id),
      artist_name: artistName,
      source_urls: uniqueUrls,
      release_date: releaseDate,
      occurrence_count: uniqueUrls.length,
    });
  }
  process.stderr.write('[wp-fixture]   ' + sourceEvidence.length + ' source evidence records\n');

  // 7. Build expected_positions
  var expectedPositions = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var track = tracksById.get(item.track_id);
    if (!track) continue;

    var aids = trackArtists.get(item.track_id) || [];
    var primaryArtist = aids.length > 0 ? artistsById.get(aids[0]) : null;
    var artistName = primaryArtist ? primaryArtist.name : 'Unknown Artist';
    var title = track.title || ('Track ' + item.track_id);

    expectedPositions.push({
      rank: item.rank,
      normalized_key: normalizedKey(title, artistName),
      track_title: title,
      artist_name: artistName,
    });
  }

  // 8. Previous edition
  var previousEdition = await loadPreviousEditionEntries(
    db, chart.id, edition.edition_date,
    tracksById, trackArtists, artistsById,
  );

  // 9. Airplay
  var airplayDetections = await tryLoadAirplay(
    db, edition.edition_date,
    tracksById, trackArtists, artistsById,
  );

  // 10. Assemble
  var chartSize = edition.entry_count || expectedPositions.length;
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
    scoring_policy_version: '1.0',
    methodology_notes: 'Chart: ' + chart.name + ' (' + chart.chart_type + ', ' + chart.frequency + '). Week ' + (edition.week_number || '?') + ', Year ' + (edition.year || '?') + '. Sources: ' + allSources + ' total URLs across ' + sourceEvidence.length + ' tracks.',
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
    process.stderr.write('[wp-fixture] Chart: ' + chart.name + ' (id=' + chart.id + ', type=' + chart.chart_type + ')\n');

    var editions = await loadEditions(db, chart.id);
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
      var filename = OUTPUT_PATH || path.join(outDir, 'edition-' + fixture.edition_date + '.json');
      var finalPath = (fixtures.length > 1 && !OUTPUT_PATH)
        ? path.join(outDir, 'edition-' + fixture.edition_date + '.json')
        : filename;

      fs.writeFileSync(finalPath, JSON.stringify(fixture, null, 2) + '\n');
      process.stderr.write(
        '[wp-fixture] DONE: ' + finalPath + ' — ' +
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