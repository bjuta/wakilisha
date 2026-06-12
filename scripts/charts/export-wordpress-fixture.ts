/**
 * WAKILISHA — WordPress MySQL → Gate A Fixture Exporter
 *
 * Reads chart edition data DIRECTLY from the WordPress MySQL plugin tables
 * (wp_wkcharts_editions, wp_wkcharts_edition_items, wp_wkcharts_track_sources,
 *  wp_wkcharts_tracks, wp_wkcharts_artists, etc.) and exports Gate A-compatible
 * fixture JSON files.
 *
 * This bypasses Supabase entirely — reads straight from the WordPress DB that
 * powers the live WKCharts plugin.
 *
 * USAGE (on the WordPress Lightsail server):
 *   WP_DB_HOST=127.0.0.1 WP_DB_PORT=3306 WP_DB_USER=bn_wordpress \
 *   WP_DB_PASSWORD=... WP_DB_NAME=bitnami_wordpress WP_DB_PREFIX=wp_ \
 *   npx tsx scripts/charts/export-wordpress-fixture.ts \
 *     --chart-slug top-songs-kenya \
 *     --edition-date 2026-05-18 \
 *     --output test/fixtures/edition-2026-05-18.json
 *
 *   # Export last 4 published editions:
 *   npx tsx scripts/charts/export-wordpress-fixture.ts \
 *     --chart-slug top-songs-kenya \
 *     --last 4 \
 *     --output-dir test/fixtures
 *
 * OUTPUT:
 *   One JSON fixture file per edition, compatible with run-engine.ts and
 *   golden-file-migration.test.ts.
 *
 * FIXTURE FORMAT:
 *   edition_date, chart_program, chart_size, scoring_policy_version,
 *   source_evidence[], previous_edition[], airplay_detections[],
 *   expected_positions[]
 */

import mysql from 'mysql2/promise';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// CLI helpers
// ─────────────────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function required(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function fatal(message: string, code = 1): never {
  process.stderr.write(`\n[wp-fixture] FATAL: ${message}\n`);
  process.exit(code);
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isoDate(value: unknown): string {
  // mysql2 returns DATE columns as JS Date objects — normalize to YYYY-MM-DD
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value ?? '').trim();
  return s.slice(0, 10) || s;
}

function normalizedKey(trackTitle: string, artistName: string): string {
  return `${slugify(trackTitle)}::${slugify(artistName)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WordPressRow {
  [column: string]: unknown;
}

interface ChartRow {
  id: number;
  name: string;
  slug: string;
  status: string;
  chart_type: string;
  frequency: string;
}

interface EditionRow {
  id: number;
  title: string;
  slug: string;
  status: string;
  edition_date: string;
  chart_id: number;
  week_number: number | null;
  year: number | null;
  entry_count: number | null;
}

interface EditionItemRow {
  id: number;
  edition_id: number;
  track_id: number;
  rank: number;
  previous_rank: number | null;
  weeks_on_chart: number | null;
  peak_position: number | null;
  is_new_entry: number | null;
  is_re_entry: number | null;
}

interface TrackRow {
  id: number;
  title: string;
  slug: string;
  status: string;
  artist_id: number | null;
  release_id: number | null;
  spotify_id: string | null;
  apple_music_id: string | null;
  youtube_id: string | null;
  isrc: string | null;
  explicit: number | null;
}

interface ArtistRow {
  id: number;
  name: string;
  slug: string;
}

interface TrackArtistRow {
  id: number;
  track_id: number;
  artist_id: number;
  is_primary: number | null;
}

interface TrackSourceRow {
  id: number;
  track_id: number;
  provider: string;
  raw_payload: string | null;
}

interface ReleaseRow {
  id: number;
  title: string;
  release_date: string | null;
}

interface SourceEvidenceRecord {
  track_title: string;
  artist_name: string;
  source_urls: string[];
  release_date: string | null;
  occurrence_count: number;
}

interface PreviousEditionEntry {
  normalized_key: string;
  position: number;
}

interface AirplayEvidenceBucket {
  canonical_track_id: string;
  normalized_key: string;
  station_id: string;
  station_weight: number;
  week_start: string;
  detection_count: number;
  total_played_duration: number;
  weighted_score: number;
}

interface ExpectedPosition {
  rank: number;
  normalized_key: string;
  track_title: string;
  artist_name: string;
}

interface EditionFixture {
  _provenance: string;
  _generated_at: string;
  _generator: string;
  _source_edition_id: number;
  edition_date: string;
  chart_program: string;
  chart_size: number;
  scoring_policy_version: string;
  methodology_notes: string;
  corrections_applied: string[];
  source_evidence: SourceEvidenceRecord[];
  previous_edition: PreviousEditionEntry[];
  airplay_detections: AirplayEvidenceBucket[];
  expected_positions: ExpectedPosition[];
}

// ─────────────────────────────────────────────────────────────────────────────
// MySQL connection
// ─────────────────────────────────────────────────────────────────────────────

function wpConfig() {
  return {
    host: required(arg('--host') ?? process.env.WP_DB_HOST, 'WP_DB_HOST or --host'),
    port: Number(arg('--port') ?? process.env.WP_DB_PORT ?? 3306),
    user: required(arg('--user') ?? process.env.WP_DB_USER, 'WP_DB_USER or --user'),
    password: required(arg('--password') ?? process.env.WP_DB_PASSWORD, 'WP_DB_PASSWORD or --password'),
    database: required(arg('--database') ?? process.env.WP_DB_NAME, 'WP_DB_NAME or --database'),
    prefix: arg('--prefix') ?? process.env.WP_DB_PREFIX ?? 'wp_',
  };
}

function tbl(prefix: string, name: string): string {
  return `\`${prefix}${name}\``;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data loaders
// ─────────────────────────────────────────────────────────────────────────────

async function loadChart(
  db: mysql.Connection,
  prefix: string,
  chartSlug: string,
): Promise<ChartRow> {
  const [rows] = await db.query(
    `SELECT id, name, slug, status, chart_type, frequency FROM ${tbl(prefix, 'wkcharts_charts')} WHERE slug = ? LIMIT 1`,
    [chartSlug],
  );
  const charts = rows as WordPressRow[];
  if (!charts.length) fatal(`Chart not found with slug: ${chartSlug}`);
  const c = charts[0];
  return {
    id: Number(c.id),
    name: clean(c.name),
    slug: clean(c.slug),
    status: clean(c.status),
    chart_type: clean(c.chart_type),
    frequency: clean(c.frequency),
  };
}

async function loadEditions(
  db: mysql.Connection,
  prefix: string,
  chartId: number,
  lastN: number | null,
  editionDate: string | null,
): Promise<EditionRow[]> {
  let query: string;
  const params: (number | string)[] = [];

  if (editionDate) {
    query = `SELECT id, title, slug, status, edition_date, chart_id, week_number, year, entry_count FROM ${tbl(prefix, 'wkcharts_editions')} WHERE chart_id = ? AND edition_date = ? AND status = 'published' ORDER BY edition_date DESC`;
    params.push(chartId, editionDate);
  } else if (lastN) {
    query = `SELECT id, title, slug, status, edition_date, chart_id, week_number, year, entry_count FROM ${tbl(prefix, 'wkcharts_editions')} WHERE chart_id = ? AND status = 'published' ORDER BY edition_date DESC LIMIT ?`;
    params.push(chartId, lastN);
  } else {
    fatal('Either --edition-date or --last is required');
  }

  const [rows] = await db.query(query, params);
  const editions = (rows as WordPressRow[]).map((r) => ({
    id: Number(r.id),
    title: clean(r.title),
    slug: clean(r.slug),
    status: clean(r.status),
    edition_date: isoDate(r.edition_date),
    chart_id: Number(r.chart_id),
    week_number: r.week_number != null ? Number(r.week_number) : null,
    year: r.year != null ? Number(r.year) : null,
    entry_count: r.entry_count != null ? Number(r.entry_count) : null,
  }));

  if (!editions.length) {
    fatal(`No published editions found for chart_id=${chartId}` + (editionDate ? ` on ${editionDate}` : ''));
  }

  return editions;
}

async function loadEditionItems(
  db: mysql.Connection,
  prefix: string,
  editionId: number,
): Promise<EditionItemRow[]> {
  const [rows] = await db.query(
    `SELECT id, edition_id, track_id, rank, previous_rank, weeks_on_chart, peak_position, is_new_entry, is_re_entry FROM ${tbl(prefix, 'wkcharts_edition_items')} WHERE edition_id = ? ORDER BY rank ASC`,
    [editionId],
  );
  return (rows as WordPressRow[]).map((r) => ({
    id: Number(r.id),
    edition_id: Number(r.edition_id),
    track_id: Number(r.track_id),
    rank: Number(r.rank),
    previous_rank: r.previous_rank != null ? Number(r.previous_rank) : null,
    weeks_on_chart: r.weeks_on_chart != null ? Number(r.weeks_on_chart) : null,
    peak_position: r.peak_position != null ? Number(r.peak_position) : null,
    is_new_entry: r.is_new_entry != null ? Number(r.is_new_entry) : null,
    is_re_entry: r.is_re_entry != null ? Number(r.is_re_entry) : null,
  }));
}

async function loadTracks(
  db: mysql.Connection,
  prefix: string,
  trackIds: number[],
): Promise<Map<number, TrackRow>> {
  if (!trackIds.length) return new Map();
  const placeholders = trackIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id, title, slug, status, artist_id, release_id, spotify_id, apple_music_id, youtube_id, isrc, explicit FROM ${tbl(prefix, 'wkcharts_tracks')} WHERE id IN (${placeholders})`,
    trackIds,
  );
  const map = new Map<number, TrackRow>();
  for (const r of rows as WordPressRow[]) {
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

async function loadArtists(
  db: mysql.Connection,
  prefix: string,
  artistIds: number[],
): Promise<Map<number, ArtistRow>> {
  if (!artistIds.length) return new Map();
  const placeholders = artistIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id, name, slug FROM ${tbl(prefix, 'wkcharts_artists')} WHERE id IN (${placeholders})`,
    artistIds,
  );
  const map = new Map<number, ArtistRow>();
  for (const r of rows as WordPressRow[]) {
    map.set(Number(r.id), {
      id: Number(r.id),
      name: clean(r.name),
      slug: clean(r.slug),
    });
  }
  return map;
}

async function loadTrackArtists(
  db: mysql.Connection,
  prefix: string,
  trackIds: number[],
): Promise<Map<number, number[]>> {
  if (!trackIds.length) return new Map();
  const placeholders = trackIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id, track_id, artist_id, is_primary FROM ${tbl(prefix, 'wkcharts_track_artists')} WHERE track_id IN (${placeholders}) ORDER BY is_primary DESC, sort_order ASC`,
    trackIds,
  );
  const map = new Map<number, number[]>();
  for (const r of rows as WordPressRow[]) {
    const trackId = Number(r.track_id);
    const artistId = Number(r.artist_id);
    if (!map.has(trackId)) map.set(trackId, []);
    map.get(trackId)!.push(artistId);
  }
  return map;
}

async function loadTrackSources(
  db: mysql.Connection,
  prefix: string,
  trackIds: number[],
): Promise<Map<number, TrackSourceRow[]>> {
  if (!trackIds.length) return new Map();
  const placeholders = trackIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id, track_id, provider, raw_payload FROM ${tbl(prefix, 'wkcharts_track_sources')} WHERE track_id IN (${placeholders})`,
    trackIds,
  );
  const map = new Map<number, TrackSourceRow[]>();
  for (const r of rows as WordPressRow[]) {
    const trackId = Number(r.track_id);
    if (!map.has(trackId)) map.set(trackId, []);
    map.get(trackId)!.push({
      id: Number(r.id),
      track_id: trackId,
      provider: clean(r.provider),
      raw_payload: typeof r.raw_payload === 'string' ? r.raw_payload : null,
    });
  }
  return map;
}

async function loadReleases(
  db: mysql.Connection,
  prefix: string,
  releaseIds: number[],
): Promise<Map<number, ReleaseRow>> {
  if (!releaseIds.length) return new Map();
  const placeholders = releaseIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id, title, release_date FROM ${tbl(prefix, 'wkcharts_releases')} WHERE id IN (${placeholders})`,
    releaseIds,
  );
  const map = new Map<number, ReleaseRow>();
  for (const r of rows as WordPressRow[]) {
    map.set(Number(r.id), {
      id: Number(r.id),
      title: clean(r.title),
      release_date: r.release_date ? clean(r.release_date) : null,
    });
  }
  return map;
}

async function loadPreviousEditionEntries(
  db: mysql.Connection,
  prefix: string,
  chartId: number,
  currentEditionDate: string,
  tracksById: Map<number, TrackRow>,
  trackArtists: Map<number, number[]>,
  artistsById: Map<number, ArtistRow>,
): Promise<PreviousEditionEntry[]> {
  // Find the most recent published edition before the current one
  const [rows] = await db.query(
    `SELECT id, edition_date FROM ${tbl(prefix, 'wkcharts_editions')} WHERE chart_id = ? AND status = 'published' AND edition_date < ? ORDER BY edition_date DESC LIMIT 1`,
    [chartId, currentEditionDate],
  );
  const prevEds = rows as WordPressRow[];
  if (!prevEds.length) return [];

  const prevEditionId = Number(prevEds[0].id);
  const prevItems = await loadEditionItems(db, prefix, prevEditionId);

  // Ensure we have track/artist data for prev edition tracks
  const prevTrackIds = prevItems.map((i) => i.track_id);
  const missingTrackIds = prevTrackIds.filter((id) => !tracksById.has(id));
  if (missingTrackIds.length) {
    const moreTracks = await loadTracks(db, prefix, missingTrackIds);
    for (const [id, track] of moreTracks) tracksById.set(id, track);
  }

  const allTrackIds = [...new Set([...Array.from(tracksById.keys()), ...prevTrackIds])];
  const missingArtistTrackIds = allTrackIds.filter((id) => !trackArtists.has(id));
  if (missingArtistTrackIds.length) {
    const moreTrackArtists = await loadTrackArtists(db, prefix, allTrackIds);
    for (const [tid, aids] of moreTrackArtists) trackArtists.set(tid, aids);
  }

  const allArtistIds = new Set<number>();
  for (const [, aids] of trackArtists) for (const aid of aids) allArtistIds.add(aid);
  const missingArtistIds = [...allArtistIds].filter((id) => !artistsById.has(id));
  if (missingArtistIds.length) {
    const moreArtists = await loadArtists(db, prefix, missingArtistIds);
    for (const [id, artist] of moreArtists) artistsById.set(id, artist);
  }

  const entries: PreviousEditionEntry[] = [];
  for (const item of prevItems) {
    const track = tracksById.get(item.track_id);
    if (!track) continue;

    const artistIds = trackArtists.get(item.track_id) ?? [];
    const primaryArtist = artistIds.length > 0 ? artistsById.get(artistIds[0]) : null;

    const title = track.title || `Track ${item.track_id}`;
    const artist = primaryArtist?.name || 'Unknown Artist';
    const key = normalizedKey(title, artist);

    entries.push({ normalized_key: key, position: item.rank });
  }

  process.stderr.write(`[wp-fixture] Previous edition #${prevEditionId}: ${entries.length} entries\n`);
  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Try to discover airplay tables (not guaranteed in WordPress)
// ─────────────────────────────────────────────────────────────────────────────

async function tryLoadAirplay(
  db: mysql.Connection,
  prefix: string,
  editionDate: string,
  tracksById: Map<number, TrackRow>,
  trackArtists: Map<number, number[]>,
  artistsById: Map<number, ArtistRow>,
): Promise<AirplayEvidenceBucket[]> {
  // Airplay data may live in postmeta (ACF fields on wk_chart_edition posts)
  // or in a dedicated wp_wkcharts_airplay table. Try both.
  const buckets: AirplayEvidenceBucket[] = [];

  // Try dedicated airplay table first
  try {
    const weekStart = getWeekStart(editionDate);
    const [rows] = await db.query(
      `SELECT * FROM ${tbl(prefix, 'wkcharts_airplay')} WHERE week_start = ? LIMIT 100`,
      [weekStart],
    );
    const airplayRows = rows as WordPressRow[];
    if (airplayRows.length > 0) {
      for (const r of airplayRows) {
        const trackId = r.track_id != null ? Number(r.track_id) : null;
        let trackTitle = 'Unknown';
        let artistName = 'Unknown';
        if (trackId && tracksById.has(trackId)) {
          const track = tracksById.get(trackId)!;
          trackTitle = track.title;
          const aids = trackArtists.get(trackId) ?? [];
          artistName = aids.length > 0 ? (artistsById.get(aids[0])?.name ?? 'Unknown') : 'Unknown';
        }
        buckets.push({
          canonical_track_id: `wp-track-${trackId ?? 'unknown'}`,
          normalized_key: normalizedKey(trackTitle, artistName),
          station_id: clean(r.station_id ?? r.source_id ?? 'unknown-station'),
          station_weight: r.station_weight != null ? Number(r.station_weight) : 1.0,
          week_start: clean(r.week_start ?? weekStart),
          detection_count: r.detection_count != null ? Number(r.detection_count) : 0,
          total_played_duration: r.total_played_duration_seconds != null ? Number(r.total_played_duration_seconds) : 0,
          weighted_score: r.weighted_score != null ? Number(r.weighted_score) : 0,
        });
      }
      if (buckets.length) {
        process.stderr.write(`[wp-fixture] Airplay: ${buckets.length} buckets from wkcharts_airplay\n`);
      }
    }
  } catch {
    // Table doesn't exist — that's fine
  }

  // Also try wkcharts_track_sources airplay provider
  if (buckets.length === 0) {
    try {
      const [rows] = await db.query(
        `SELECT track_id, provider, raw_payload FROM ${tbl(prefix, 'wkcharts_track_sources')} WHERE provider = 'airplay' LIMIT 200`,
      );
      const airplayRows = rows as WordPressRow[];
      for (const r of airplayRows) {
        const trackId = Number(r.track_id);
        const track = tracksById.get(trackId);
        if (!track) continue;
        const aids = trackArtists.get(trackId) ?? [];
        const artistName = aids.length > 0 ? (artistsById.get(aids[0])?.name ?? 'Unknown') : 'Unknown';
        const weekStart = getWeekStart(editionDate);
        buckets.push({
          canonical_track_id: `wp-track-${trackId}`,
          normalized_key: normalizedKey(track.title, artistName),
          station_id: 'airplay-legacy',
          station_weight: 1.0,
          week_start: weekStart,
          detection_count: 1,
          total_played_duration: 0,
          weighted_score: 0,
        });
      }
      if (buckets.length) {
        process.stderr.write(`[wp-fixture] Airplay: ${buckets.length} buckets from track_sources (airplay provider)\n`);
      }
    } catch {
      // No airplay provider rows — that's fine
    }
  }

  return buckets;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Source URL construction from providers
// ─────────────────────────────────────────────────────────────────────────────

function providerToSourceUrl(provider: string, track: TrackRow): string {
  const slug = track.slug || slugify(track.title);
  switch (provider.toLowerCase()) {
    case 'spotify':
      return track.spotify_id
        ? `https://open.spotify.com/track/${track.spotify_id}`
        : `spotify:track:${slug}`;
    case 'applemusic':
      return track.apple_music_id
        ? `https://music.apple.com/track/${track.apple_music_id}`
        : `applemusic:track:${slug}`;
    case 'youtube':
      return track.youtube_id
        ? `https://youtube.com/watch?v=${track.youtube_id}`
        : `youtube:track:${slug}`;
    case 'deezer':
      return `deezer:track:${slug}`;
    case 'boomplay':
      return `boomplay:track:${slug}`;
    default:
      return `${provider.toLowerCase()}:track:${slug}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture builder for a single edition
// ─────────────────────────────────────────────────────────────────────────────

async function buildFixture(
  db: mysql.Connection,
  prefix: string,
  chart: ChartRow,
  edition: EditionRow,
  chartSlug: string,
): Promise<EditionFixture> {
  process.stderr.write(`\n[wp-fixture] Building fixture for edition #${edition.id} (${edition.edition_date})...\n`);

  // 1. Load edition items
  const items = await loadEditionItems(db, prefix, edition.id);
  process.stderr.write(`[wp-fixture]   ${items.length} edition items\n`);

  // 2. Load tracks for all items
  const trackIds = [...new Set(items.map((i) => i.track_id))];
  const tracksById = await loadTracks(db, prefix, trackIds);
  process.stderr.write(`[wp-fixture]   ${tracksById.size} tracks loaded\n`);

  // 3. Load track→artist mappings
  const trackArtists = await loadTrackArtists(db, prefix, trackIds);
  const allArtistIds = new Set<number>();
  for (const [, aids] of trackArtists) for (const aid of aids) allArtistIds.add(aid);
  const artistsById = await loadArtists(db, prefix, [...allArtistIds]);
  process.stderr.write(`[wp-fixture]   ${artistsById.size} artists loaded\n`);

  // 4. Load releases for release dates
  const releaseIds = [...new Set(
    [...tracksById.values()]
      .map((t) => t.release_id)
      .filter((id): id is number => id != null),
  )];
  const releasesById = await loadReleases(db, prefix, releaseIds);

  // 5. Load track sources for source evidence
  const trackSources = await loadTrackSources(db, prefix, trackIds);
  process.stderr.write(`[wp-fixture]   ${trackSources.size} tracks with source data\n`);

  // 6. Build source_evidence
  const sourceEvidence: SourceEvidenceRecord[] = [];
  const seenTracks = new Set<number>();

  for (const item of items) {
    if (seenTracks.has(item.track_id)) continue;
    seenTracks.add(item.track_id);

    const track = tracksById.get(item.track_id);
    if (!track) continue;

    const aids = trackArtists.get(item.track_id) ?? [];
    const primaryArtist = aids.length > 0 ? artistsById.get(aids[0]) : null;
    const artistName = primaryArtist?.name || 'Unknown Artist';

    const sources = trackSources.get(item.track_id) ?? [];
    const sourceUrls = sources.map((s) => providerToSourceUrl(s.provider, track));

    // Deduplicate URLs (same provider might appear twice)
    const uniqueUrls = [...new Set(sourceUrls)];

    // Get release date
    let releaseDate: string | null = null;
    if (track.release_id != null && releasesById.has(track.release_id)) {
      releaseDate = releasesById.get(track.release_id)!.release_date;
    }

    sourceEvidence.push({
      track_title: track.title || `Track ${item.track_id}`,
      artist_name: artistName,
      source_urls: uniqueUrls,
      release_date: releaseDate,
      occurrence_count: uniqueUrls.length,
    });
  }

  process.stderr.write(`[wp-fixture]   ${sourceEvidence.length} source evidence records\n`);

  // 7. Build expected_positions
  const expectedPositions: ExpectedPosition[] = [];
  for (const item of items) {
    const track = tracksById.get(item.track_id);
    if (!track) continue;

    const aids = trackArtists.get(item.track_id) ?? [];
    const primaryArtist = aids.length > 0 ? artistsById.get(aids[0]) : null;
    const artistName = primaryArtist?.name || 'Unknown Artist';
    const title = track.title || `Track ${item.track_id}`;

    expectedPositions.push({
      rank: item.rank,
      normalized_key: normalizedKey(title, artistName),
      track_title: title,
      artist_name: artistName,
    });
  }

  // 8. Load previous edition entries
  const previousEdition = await loadPreviousEditionEntries(
    db, prefix, chart.id, edition.edition_date,
    tracksById, trackArtists, artistsById,
  );

  // 9. Try to load airplay
  const airplayDetections = await tryLoadAirplay(
    db, prefix, edition.edition_date,
    tracksById, trackArtists, artistsById,
  );

  // 10. Assemble fixture
  const chartSize = edition.entry_count ?? expectedPositions.length;
  const allSources = sourceEvidence.reduce((sum, ev) => sum + ev.source_urls.length, 0);

  const fixture: EditionFixture = {
    _provenance: `Exported from WordPress MySQL (${chartSlug}, edition #${edition.id}, ${edition.edition_date})`,
    _generated_at: new Date().toISOString(),
    _generator: 'scripts/charts/export-wordpress-fixture.ts',
    _source_edition_id: edition.id,
    edition_date: edition.edition_date,
    chart_program: chartSlug,
    chart_size: chartSize,
    scoring_policy_version: '1.0',
    methodology_notes: `Chart: ${chart.name} (${chart.chart_type}, ${chart.frequency}). Week ${edition.week_number ?? '?'}, Year ${edition.year ?? '?'}. Sources: ${allSources} total URLs across ${sourceEvidence.length} tracks.`,
    corrections_applied: [],
    source_evidence: sourceEvidence,
    previous_edition: previousEdition,
    airplay_detections: airplayDetections,
    expected_positions: expectedPositions,
  };

  return fixture;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const chartSlug = arg('--chart-slug') ?? 'top-songs-kenya';
  const editionDate = arg('--edition-date') ?? null;
  const lastN = arg('--last') ? Number(arg('--last')) : null;
  const outputPath = arg('--output') ?? null;
  const outputDir = arg('--output-dir') ?? null;

  const cfg = wpConfig();

  process.stderr.write(`[wp-fixture] Connecting to MySQL ${cfg.host}:${cfg.port}/${cfg.database}...\n`);

  const db = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectTimeout: 15000,
  });

  try {
    await db.ping();
    process.stderr.write(`[wp-fixture] Connected.\n`);

    const chart = await loadChart(db, cfg.prefix, chartSlug);
    process.stderr.write(`[wp-fixture] Chart: ${chart.name} (id=${chart.id}, type=${chart.chart_type})\n`);

    const editions = await loadEditions(db, cfg.prefix, chart.id, lastN, editionDate);
    process.stderr.write(`[wp-fixture] Found ${editions.length} edition(s)\n`);

    const fixtures: EditionFixture[] = [];
    for (const edition of editions) {
      const fixture = await buildFixture(db, cfg.prefix, chart, edition, chartSlug);
      fixtures.push(fixture);
    }

    // Write fixtures
    const outDir = outputDir ?? path.dirname(outputPath ?? 'test/fixtures');

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      const filename = outputPath ?? path.join(outDir, `edition-${fixture.edition_date}.json`);
      // If multiple editions and no explicit --output, use individual names
      const finalPath = fixtures.length > 1 && !outputPath
        ? path.join(outDir, `edition-${fixture.edition_date}.json`)
        : filename;

      fs.writeFileSync(finalPath, JSON.stringify(fixture, null, 2) + '\n');
      process.stderr.write(
        `[wp-fixture] ✅ ${finalPath} — ${fixture.expected_positions.length} positions, ` +
        `${fixture.source_evidence.length} source tracks, ${fixture.airplay_detections.length} airplay buckets\n`,
      );
    }

    process.stderr.write(`\n[wp-fixture] Done. ${fixtures.length} fixture(s) exported.\n`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  process.stderr.write(`[wp-fixture] Unhandled error: ${err?.message ?? err}\n`);
  if (err?.stack) process.stderr.write(err.stack + '\n');
  process.exit(1);
});