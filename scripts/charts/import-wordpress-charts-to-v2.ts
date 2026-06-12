/**
 * WAKILISHA — WordPress Chart → V2 Direct Importer
 *
 * Reads chart edition data DIRECTLY from the WordPress MySQL plugin tables
 * and writes it into the Supabase v2 chart schema (wk_chart_*_v2).
 *
 * This script is designed to run on the WordPress Lightsail server (or
 * any machine with MySQL access to the WordPress DB) and connect to
 * Supabase via DATABASE_URL.
 *
 * USAGE (on the WordPress Lightsail server):
 *   DATABASE_URL="postgresql://..." \
 *   WP_DB_HOST=127.0.0.1 WP_DB_PORT=3306 WP_DB_USER=bn_wordpress \
 *   WP_DB_PASSWORD=... WP_DB_NAME=bitnami_wordpress WP_DB_PREFIX=wp_ \
 *   npx tsx scripts/charts/import-wordpress-charts-to-v2.ts --dry-run
 *
 *   # To actually write to Supabase:
 *   WAKILISHA_CHART_IMPORT_COMMIT=1 \
 *   npx tsx scripts/charts/import-wordpress-charts-to-v2.ts
 *
 * WHAT IT DOES:
 *   1. Discovers all chart-related tables in WordPress MySQL
 *   2. Maps old chart programs → v2 programs (series + market)
 *   3. Normalizes old edition URLs → v2 edition slugs
 *   4. Migrates all editions, entries, tracks, artists, sources
 *   5. Preserves old ingest settings + source URLs in v2 metadata
 *   6. Creates slug aliases for old → new URL redirects
 *   7. Generates a migration report
 */

import mysql from "mysql2/promise";
import pg from "pg";
import * as fs from "node:fs";
import * as path from "node:path";

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

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function isoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value ?? "").trim();
  return s.slice(0, 10) || s;
}

function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeId(prefix: string, value: string): string {
  return `${prefix}_${safeSlug(value)}`.replace(/-+/g, "_").slice(0, 64);
}

function normalizeDatabaseUrlForPg(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const COMMIT = process.env.WAKILISHA_CHART_IMPORT_COMMIT === "1";
const DRY_RUN = !COMMIT || arg("--dry-run") !== undefined;

const wpConfig = {
  host: required(arg("--host") ?? process.env.WP_DB_HOST, "WP_DB_HOST or --host"),
  port: Number(arg("--port") ?? process.env.WP_DB_PORT ?? 3306),
  user: required(arg("--user") ?? process.env.WP_DB_USER, "WP_DB_USER or --user"),
  password: required(arg("--password") ?? process.env.WP_DB_PASSWORD, "WP_DB_PASSWORD or --password"),
  database: required(arg("--database") ?? process.env.WP_DB_NAME, "WP_DB_NAME or --database"),
  prefix: arg("--prefix") ?? process.env.WP_DB_PREFIX ?? "wp_",
};

const databaseUrl = required(process.env.DATABASE_URL, "DATABASE_URL");

function tbl(name: string): string {
  return `\`${wpConfig.prefix}${name}\``;
}

// ─────────────────────────────────────────────────────────────────────────────
// Postgres helpers
// ─────────────────────────────────────────────────────────────────────────────

function createPgPool(): pg.Pool {
  return new pg.Pool({
    connectionString: normalizeDatabaseUrlForPg(databaseUrl),
    ssl: { rejectUnauthorized: false },
    max: 4,
    connectionTimeoutMillis: 15000,
  });
}

async function queryFirst(pool: pg.Pool, sql: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query(sql);
  return result.rows[0] ?? null;
}

async function queryRows(pool: pg.Pool, sql: string): Promise<Record<string, unknown>[]> {
  const result = await pool.query(sql);
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// WordPress discovery helpers
// ─────────────────────────────────────────────────────────────────────────────

type WordPressRow = Record<string, unknown>;

async function tableExists(db: mysql.Connection, name: string): Promise<boolean> {
  const [rows] = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1`,
    [wpConfig.database, `${wpConfig.prefix}${name}`],
  );
  return (rows as WordPressRow[]).length > 0;
}

async function queryWp(db: mysql.Connection, sql: string, params?: unknown[]): Promise<WordPressRow[]> {
  const [rows] = await db.query(sql, params);
  return rows as WordPressRow[];
}

async function countWp(db: mysql.Connection, table: string): Promise<number> {
  const [rows] = await db.query(`SELECT COUNT(*) AS count FROM ${tbl(table)}`);
  return Number((rows as WordPressRow[])[0]?.count ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface OldChart {
  id: number;
  name: string;
  slug: string;
  status: string;
  chart_type: string;
  frequency: string;
  inferred?: boolean;
}

interface OldEdition {
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

interface OldEditionItem {
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

interface OldTrack {
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

interface OldArtist {
  id: number;
  name: string;
  slug: string;
}

interface OldTrackSource {
  id: number;
  track_id: number;
  provider: string;
  raw_payload: string | null;
}

interface OldIngestRun {
  id: number;
  chart_id: number | null;
  edition_id: number | null;
  edition_date: string | null;
  source_urls: string | null;
  source_policy: string | null;
  scoring_policy: string | null;
  eligibility_policy: string | null;
  methodology: string | null;
  status: string;
  created_at: string | null;
  raw_payload: string | null;
}

interface V2Program {
  id: string;
  series_slug: string;
  market_slug: string;
  public_slug: string;
  public_label: string;
  short_label: string;
  source_family_slug: string;
  default_period_type: string;
  default_methodology_version: string;
  default_eligibility_rules_version: string;
  chart_size: number;
  streaming_min_sources: number;
  cross_source_mode: string;
  cross_source_weight: number;
  continuity_weight: number;
  carry_forward_weight: number;
  airplay_enabled: boolean;
  airplay_station_scope: string;
  airplay_min_duration: number;
  airplay_weight: number;
  airplay_min_stations: number;
  airplay_min_detections: number;
  airplay_max_score: number;
  airplay_rescue_mode: string;
  anti_gaming_max_tracks_per_lead_artist: number;
  anti_gaming_overlap_bonus_cap: number;
  anti_gaming_artist_overflow_penalty: number;
  anti_gaming_demote_carry_forward_without_current: boolean;
  missing_policy: string;
  override_mode: string;
}

interface V2Edition {
  id: string;
  program_id: string;
  edition_slug: string;
  edition_label: string;
  edition_date: string;
  period_start: string | null;
  period_end: string | null;
  status: string;
  entry_count: number;
  chart_size: number;
  methodology_version: string | null;
  source_policy_version: string | null;
  eligibility_policy_version: string | null;
  scoring_policy_version: string | null;
  rule_set_snapshot: Record<string, unknown>;
  ingest_run_id: string | null;
  published_at: string | null;
  published_by: string | null;
}

interface V2Entry {
  id: string;
  edition_id: string;
  rank: number;
  previous_rank: number | null;
  movement: string;
  track_slug: string | null;
  track_title: string;
  artist_slug: string | null;
  artist_name: string;
  artwork_url: string | null;
  normalized_key: string | null;
  source_urls_seen: string[];
  source_payload: Record<string, unknown>;
  scoring_policy_version: string | null;
  methodology_version: string | null;
  eligibility_policy_version: string | null;
}

interface V2SourceCoverage {
  id: string;
  edition_id: string;
  source_name: string;
  source_count: number;
  coverage_status: string;
  coverage_payload: Record<string, unknown>;
}

interface V2Alias {
  id: string;
  legacy_slug: string;
  canonical_slug: string;
  entity_type: string;
  redirect_status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Program mapping (old chart slug → v2 program)
// ─────────────────────────────────────────────────────────────────────────────

function inferMarketFromSlug(slug: string): string {
  if (slug.includes("ke") || slug.includes("kenya") || slug.includes("nairobi")) return "kenya";
  if (slug.includes("ng") || slug.includes("nigeria") || slug.includes("lagos")) return "nigeria";
  if (slug.includes("za") || slug.includes("south-africa") || slug.includes("johannesburg")) return "south-africa";
  if (slug.includes("gh") || slug.includes("ghana") || slug.includes("accra")) return "ghana";
  if (slug.includes("tz") || slug.includes("tanzania") || slug.includes("dar")) return "tanzania";
  if (slug.includes("ug") || slug.includes("uganda") || slug.includes("kampala")) return "uganda";
  return "kenya";
}

function inferSeriesFromSlug(slug: string): string {
  const lowered = slug.toLowerCase();
  if (lowered.includes("rnb") || lowered.includes("r&b")) return "rnb";
  if (lowered.includes("gengetone")) return "gengetone";
  if (lowered.includes("gospel")) return "gospel";
  if (lowered.includes("afrobeats")) return "afrobeats";
  if (lowered.includes("hiphop") || lowered.includes("hip-hop") || lowered.includes("rap")) return "hiphop";
  if (lowered.includes("reggae") || lowered.includes("dancehall")) return "reggae";
  if (lowered.includes("2026")) return "2026";
  if (lowered.includes("2025")) return "2025";
  if (lowered.includes("new")) return "new-releases";
  if (lowered.includes("top")) return "top-songs";
  return lowered;
}

function buildV2ProgramSlug(chartSlug: string, market: string): string {
  const series = inferSeriesFromSlug(chartSlug);
  return `${series}/${market}`;
}

function buildV2ProgramFromOldChart(chart: OldChart): V2Program {
  const market = inferMarketFromSlug(chart.slug);
  const series = inferSeriesFromSlug(chart.slug);
  const publicSlug = buildV2ProgramSlug(chart.slug, market);
  const sourceFamily = chart.slug || series;

  return {
    id: safeId("program", publicSlug),
    series_slug: series,
    market_slug: market,
    public_slug: publicSlug,
    public_label: chart.name || `${series.replace(/-/g, " ")} · ${market.replace(/-/g, " ")}`,
    short_label: chart.name || series,
    source_family_slug: sourceFamily,
    default_period_type: "weekly",
    default_methodology_version: "legacy-import-v1",
    default_eligibility_rules_version: "legacy-import-v1",
    chart_size: 20,
    streaming_min_sources: 1,
    cross_source_mode: "standard",
    cross_source_weight: 1.0,
    continuity_weight: 1.0,
    carry_forward_weight: 1.0,
    airplay_enabled: false,
    airplay_station_scope: "all",
    airplay_min_duration: 20,
    airplay_weight: 1.0,
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
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Loaders
// ─────────────────────────────────────────────────────────────────────────────

async function loadOldCharts(db: mysql.Connection): Promise<OldChart[]> {
  const charts: OldChart[] = [];

  if (await tableExists(db, "wkcharts_charts")) {
    const rows = await queryWp(db, `SELECT id, name, slug, status, chart_type, frequency FROM ${tbl("wkcharts_charts")}`);
    for (const r of rows) {
      charts.push({
        id: Number(r.id),
        name: clean(r.name),
        slug: clean(r.slug),
        status: clean(r.status),
        chart_type: clean(r.chart_type),
        frequency: clean(r.frequency),
      });
    }
  }

  if (charts.length === 0) {
    const postRows = await queryWp(db,
      `SELECT p.ID, p.post_title, p.post_name, p.post_status, pm.meta_value AS chart_type
       FROM ${tbl("posts")} p
       LEFT JOIN ${tbl("postmeta")} pm ON pm.post_id = p.ID AND pm.meta_key = 'chart_type'
       WHERE p.post_type = 'wk_chart_series' AND p.post_status != 'trash'`,
    );
    for (const r of postRows) {
      charts.push({
        id: Number(r.ID),
        name: clean(r.post_title),
        slug: clean(r.post_name) || safeSlug(clean(r.post_title)),
        status: clean(r.post_status),
        chart_type: clean(r.chart_type) || "top_songs",
        frequency: "weekly",
        inferred: true,
      });
    }
  }

  if (charts.length === 0) {
    const editionRows = await queryWp(db,
      `SELECT chart_id, MIN(title) as title, MIN(slug) as slug
       FROM ${tbl("wkcharts_editions")}
       WHERE chart_id IS NOT NULL
       GROUP BY chart_id`,
    );
    for (const r of editionRows) {
      const slug = clean(r.slug) || safeSlug(clean(r.title));
      charts.push({
        id: Number(r.chart_id),
        name: clean(r.title),
        slug: slug.split("-")[0] || slug,
        status: "publish",
        chart_type: "top_songs",
        frequency: "weekly",
        inferred: true,
      });
    }
  }

  return charts;
}

async function loadOldEditions(db: mysql.Connection, chartId: number): Promise<OldEdition[]> {
  const rows = await queryWp(db,
    `SELECT id, title, slug, status, edition_date, chart_id, week_number, year, entry_count
     FROM ${tbl("wkcharts_editions")}
     WHERE chart_id = ?
     ORDER BY edition_date DESC`,
    [chartId],
  );
  return rows.map((r) => ({
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
}

async function loadOldEditionItems(db: mysql.Connection, editionId: number): Promise<OldEditionItem[]> {
  const rows = await queryWp(db,
    `SELECT id, edition_id, track_id, rank, previous_rank, weeks_on_chart, peak_position, is_new_entry, is_re_entry
     FROM ${tbl("wkcharts_edition_items")}
     WHERE edition_id = ?
     ORDER BY rank ASC`,
    [editionId],
  );
  return rows.map((r) => ({
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

async function loadOldTracks(db: mysql.Connection, trackIds: number[]): Promise<Map<number, OldTrack>> {
  if (!trackIds.length) return new Map();
  const placeholders = trackIds.map(() => "?").join(",");
  const rows = await queryWp(db,
    `SELECT id, title, slug, status, artist_id, release_id, spotify_id, apple_music_id, youtube_id, isrc, explicit
     FROM ${tbl("wkcharts_tracks")}
     WHERE id IN (${placeholders})`,
    trackIds,
  );
  const map = new Map<number, OldTrack>();
  for (const r of rows) {
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

async function loadOldArtists(db: mysql.Connection, artistIds: number[]): Promise<Map<number, OldArtist>> {
  if (!artistIds.length) return new Map();
  const placeholders = artistIds.map(() => "?").join(",");
  const rows = await queryWp(db,
    `SELECT id, name, slug FROM ${tbl("wkcharts_artists")} WHERE id IN (${placeholders})`,
    artistIds,
  );
  const map = new Map<number, OldArtist>();
  for (const r of rows) {
    map.set(Number(r.id), { id: Number(r.id), name: clean(r.name), slug: clean(r.slug) });
  }
  return map;
}

async function loadOldTrackSources(db: mysql.Connection, trackIds: number[]): Promise<Map<number, OldTrackSource[]>> {
  if (!trackIds.length) return new Map();
  const placeholders = trackIds.map(() => "?").join(",");
  const rows = await queryWp(db,
    `SELECT id, track_id, provider, raw_payload FROM ${tbl("wkcharts_track_sources")} WHERE track_id IN (${placeholders})`,
    trackIds,
  );
  const map = new Map<number, OldTrackSource[]>();
  for (const r of rows) {
    const trackId = Number(r.track_id);
    if (!map.has(trackId)) map.set(trackId, []);
    map.get(trackId)!.push({
      id: Number(r.id),
      track_id: trackId,
      provider: clean(r.provider),
      raw_payload: typeof r.raw_payload === "string" ? r.raw_payload : null,
    });
  }
  return map;
}

async function loadOldIngestRuns(db: mysql.Connection, chartId?: number): Promise<OldIngestRun[]> {
  if (!await tableExists(db, "wkcharts_ingest_runs")) return [];
  let sql = `SELECT id, chart_id, edition_id, edition_date, source_urls, source_policy, scoring_policy, eligibility_policy, methodology, status, created_at, raw_payload FROM ${tbl("wkcharts_ingest_runs")}`;
  const params: unknown[] = [];
  if (chartId !== undefined) {
    sql += " WHERE chart_id = ?";
    params.push(chartId);
  }
  sql += " ORDER BY created_at DESC";
  const rows = await queryWp(db, sql, params);
  return rows.map((r) => ({
    id: Number(r.id),
    chart_id: r.chart_id != null ? Number(r.chart_id) : null,
    edition_id: r.edition_id != null ? Number(r.edition_id) : null,
    edition_date: isoDate(r.edition_date),
    source_urls: r.source_urls ? clean(r.source_urls) : null,
    source_policy: r.source_policy ? clean(r.source_policy) : null,
    scoring_policy: r.scoring_policy ? clean(r.scoring_policy) : null,
    eligibility_policy: r.eligibility_policy ? clean(r.eligibility_policy) : null,
    methodology: r.methodology ? clean(r.methodology) : null,
    status: clean(r.status),
    created_at: isoDate(r.created_at),
    raw_payload: r.raw_payload ? clean(r.raw_payload) : null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Build V2 objects
// ─────────────────────────────────────────────────────────────────────────────

function buildV2Edition(oldEdition: OldEdition, program: V2Program, ingestRun: OldIngestRun | null): V2Edition {
  const editionSlug = oldEdition.edition_date;
  const editionLabel = oldEdition.title || `${program.public_label} · ${oldEdition.edition_date}`;

  return {
    id: safeId("edition", `${program.public_slug}_${editionSlug}`),
    program_id: program.id,
    edition_slug: editionSlug,
    edition_label: editionLabel,
    edition_date: oldEdition.edition_date,
    period_start: oldEdition.edition_date,
    period_end: oldEdition.edition_date,
    status: oldEdition.status === "published" ? "published" : "draft",
    entry_count: oldEdition.entry_count ?? 0,
    chart_size: program.chart_size,
    methodology_version: ingestRun?.methodology ?? program.default_methodology_version,
    source_policy_version: ingestRun?.source_policy ?? "legacy-import",
    eligibility_policy_version: ingestRun?.eligibility_policy ?? "legacy-import",
    scoring_policy_version: ingestRun?.scoring_policy ?? "legacy-import",
    rule_set_snapshot: {
      old_edition_id: oldEdition.id,
      old_chart_id: oldEdition.chart_id,
      week_number: oldEdition.week_number,
      year: oldEdition.year,
      ingest_run_id: ingestRun?.id ?? null,
      ingest_run_status: ingestRun?.status ?? null,
      migrated_at: new Date().toISOString(),
    },
    ingest_run_id: ingestRun ? String(ingestRun.id) : null,
    published_at: oldEdition.status === "published" ? new Date().toISOString() : null,
    published_by: null,
  };
}

function buildV2Entry(
  item: OldEditionItem,
  edition: V2Edition,
  track: OldTrack | undefined,
  artist: OldArtist | undefined,
  trackSources: OldTrackSource[],
): V2Entry {
  const trackTitle = track?.title || `Track ${item.track_id}`;
  const artistName = artist?.name || "Unknown Artist";

  const sourceUrls = trackSources.map((s) => {
    const provider = s.provider.toLowerCase();
    if (provider === "spotify" && track?.spotify_id) return `https://open.spotify.com/track/${track.spotify_id}`;
    if (provider === "applemusic" && track?.apple_music_id) return `https://music.apple.com/track/${track.apple_music_id}`;
    if (provider === "youtube" && track?.youtube_id) return `https://youtube.com/watch?v=${track.youtube_id}`;
    return `${provider}:track:${track?.slug || ""}`;
  });

  const movement = item.is_new_entry ? "new" : item.is_re_entry ? "re_entry" : item.previous_rank != null ? (item.rank < item.previous_rank ? "up" : item.rank > item.previous_rank ? "down" : "same") : "same";

  return {
    id: safeId("entry", `${edition.edition_slug}_${String(item.rank).padStart(3, "0")}_${item.track_id}`),
    edition_id: edition.id,
    rank: item.rank,
    previous_rank: item.previous_rank,
    movement,
    track_slug: track?.slug || null,
    track_title: trackTitle,
    artist_slug: artist?.slug || null,
    artist_name: artistName,
    artwork_url: null,
    normalized_key: `${safeSlug(trackTitle)}::${safeSlug(artistName)}`,
    source_urls_seen: [...new Set(sourceUrls)],
    source_payload: {
      old_item_id: item.id,
      old_track_id: item.track_id,
      weeks_on_chart: item.weeks_on_chart,
      peak_position: item.peak_position,
      is_new_entry: item.is_new_entry,
      is_re_entry: item.is_re_entry,
      track_isrc: track?.isrc ?? null,
      track_explicit: track?.explicit ?? null,
      track_spotify_id: track?.spotify_id ?? null,
      track_apple_music_id: track?.apple_music_id ?? null,
      track_youtube_id: track?.youtube_id ?? null,
      track_sources: trackSources.map((s) => ({ provider: s.provider, raw_payload: s.raw_payload })),
      migrated_at: new Date().toISOString(),
    },
    scoring_policy_version: edition.scoring_policy_version,
    methodology_version: edition.methodology_version,
    eligibility_policy_version: edition.eligibility_policy_version,
  };
}

function buildV2SourceCoverage(edition: V2Edition, sourceCount: number): V2SourceCoverage {
  return {
    id: safeId("coverage", `${edition.id}_wp_import`),
    edition_id: edition.id,
    source_name: "WordPress Legacy Import",
    source_count: sourceCount,
    coverage_status: sourceCount > 0 ? "manual" : "unavailable",
    coverage_payload: {
      old_edition_id: edition.rule_set_snapshot.old_edition_id,
      source_count: sourceCount,
      ingest_run_id: edition.ingest_run_id,
      migrated_at: new Date().toISOString(),
    },
  };
}

function buildV2Alias(oldChartSlug: string, oldEditionSlug: string, program: V2Program): V2Alias {
  const oldPath = `charts/${oldChartSlug}/${oldEditionSlug}`;
  const newPath = `charts/${program.public_slug}`;
  return {
    id: safeId("alias", `chart_${oldPath}`),
    legacy_slug: oldPath,
    canonical_slug: newPath,
    entity_type: "chart_program",
    redirect_status: "active",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Database writes
// ─────────────────────────────────────────────────────────────────────────────

function sqlInsert(table: string, rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const values = rows
    .map((row) => {
      const cells = columns.map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return "NULL";
        if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
        if (typeof value === "boolean") return String(value);
        if (typeof value === "number") return String(value);
        return `'${String(value).replace(/'/g, "''")}'`;
      });
      return `(${cells.join(", ")})`;
    })
    .join(",\n");
  return `INSERT INTO ${table} (${columns.join(", ")})\nVALUES\n${values}\nON CONFLICT DO NOTHING;`;
}

async function writeV2Data(pool: pg.Pool, data: {
  programs: V2Program[];
  editions: V2Edition[];
  entries: V2Entry[];
  sourceCoverage: V2SourceCoverage[];
  aliases: V2Alias[];
}) {
  const allSql: string[] = [];

  // Series
  const seriesMap = new Map<string, { series_slug: string; series_label: string }>();
  for (const p of data.programs) {
    if (!seriesMap.has(p.series_slug)) {
      seriesMap.set(p.series_slug, {
        series_slug: p.series_slug,
        series_label: p.series_slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      });
    }
  }
  if (seriesMap.size) allSql.push(sqlInsert("wk_chart_series_v2", Array.from(seriesMap.values())));

  // Markets
  const marketsMap = new Map<string, Record<string, unknown>>();
  for (const p of data.programs) {
    if (!marketsMap.has(p.market_slug)) {
      marketsMap.set(p.market_slug, {
        market_slug: p.market_slug,
        market_label: p.market_slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        market_type: "country",
        country_code: p.market_slug === "kenya" ? "KE" : p.market_slug === "nigeria" ? "NG" : p.market_slug === "south-africa" ? "ZA" : p.market_slug === "ghana" ? "GH" : p.market_slug === "tanzania" ? "TZ" : p.market_slug === "uganda" ? "UG" : null,
        timezone: p.market_slug === "kenya" ? "Africa/Nairobi" : p.market_slug === "nigeria" ? "Africa/Lagos" : p.market_slug === "south-africa" ? "Africa/Johannesburg" : null,
        default_language: "en",
      });
    }
  }
  if (marketsMap.size) allSql.push(sqlInsert("wk_chart_markets_v2", Array.from(marketsMap.values())));

  // Programs
  if (data.programs.length) {
    allSql.push(sqlInsert("wk_chart_programs_v2", data.programs.map((p) => ({
      id: p.id, series_slug: p.series_slug, market_slug: p.market_slug, public_slug: p.public_slug,
      public_label: p.public_label, short_label: p.short_label, source_family_slug: p.source_family_slug,
      default_period_type: p.default_period_type, default_methodology_version: p.default_methodology_version,
      default_eligibility_rules_version: p.default_eligibility_rules_version, chart_size: p.chart_size,
      streaming_min_sources: p.streaming_min_sources, cross_source_mode: p.cross_source_mode,
      cross_source_weight: p.cross_source_weight, continuity_weight: p.continuity_weight,
      carry_forward_weight: p.carry_forward_weight, airplay_enabled: p.airplay_enabled,
      airplay_station_scope: p.airplay_station_scope, airplay_min_duration: p.airplay_min_duration,
      airplay_weight: p.airplay_weight, airplay_min_stations: p.airplay_min_stations,
      airplay_min_detections: p.airplay_min_detections, airplay_max_score: p.airplay_max_score,
      airplay_rescue_mode: p.airplay_rescue_mode,
      anti_gaming_max_tracks_per_lead_artist: p.anti_gaming_max_tracks_per_lead_artist,
      anti_gaming_overlap_bonus_cap: p.anti_gaming_overlap_bonus_cap,
      anti_gaming_artist_overflow_penalty: p.anti_gaming_artist_overflow_penalty,
      anti_gaming_demote_carry_forward_without_current: p.anti_gaming_demote_carry_forward_without_current,
      missing_policy: p.missing_policy, override_mode: p.override_mode,
    }))));
  }

  // Editions
  if (data.editions.length) {
    allSql.push(sqlInsert("wk_chart_editions_v2", data.editions.map((e) => ({
      id: e.id, program_id: e.program_id, edition_slug: e.edition_slug, edition_label: e.edition_label,
      edition_date: e.edition_date, period_start: e.period_start, period_end: e.period_end,
      status: e.status, entry_count: e.entry_count, chart_size: e.chart_size,
      methodology_version: e.methodology_version, source_policy_version: e.source_policy_version,
      eligibility_policy_version: e.eligibility_policy_version, scoring_policy_version: e.scoring_policy_version,
      rule_set_snapshot: e.rule_set_snapshot, ingest_run_id: e.ingest_run_id,
      published_at: e.published_at, published_by: e.published_by,
    }))));
  }

  // Entries
  if (data.entries.length) {
    allSql.push(sqlInsert("wk_chart_entries_v2", data.entries.map((e) => ({
      id: e.id, edition_id: e.edition_id, rank: e.rank, previous_rank: e.previous_rank,
      movement: e.movement, track_slug: e.track_slug, track_title: e.track_title,
      artist_slug: e.artist_slug, artist_name: e.artist_name, artwork_url: e.artwork_url,
      normalized_key: e.normalized_key, source_urls_seen: e.source_urls_seen,
      source_payload: e.source_payload, scoring_policy_version: e.scoring_policy_version,
      methodology_version: e.methodology_version, eligibility_policy_version: e.eligibility_policy_version,
    }))));
  }

  // Source coverage
  if (data.sourceCoverage.length) {
    allSql.push(sqlInsert("wk_chart_source_coverage_v2", data.sourceCoverage.map((c) => ({
      id: c.id, edition_id: c.edition_id, source_name: c.source_name,
      source_count: c.source_count, coverage_status: c.coverage_status, coverage_payload: c.coverage_payload,
    }))));
  }

  // Aliases
  if (data.aliases.length) {
    allSql.push(sqlInsert("wk_chart_slug_aliases_v2", data.aliases.map((a) => ({
      id: a.id, legacy_slug: a.legacy_slug, canonical_slug: a.canonical_slug,
      entity_type: a.entity_type, redirect_status: a.redirect_status,
    }))));
  }

  const fullSql = allSql.join("\n\n");

  if (DRY_RUN) {
    const sqlPath = path.join(process.cwd(), "reports", "chart-v2-wordpress-import.sql");
    fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
    fs.writeFileSync(sqlPath, fullSql);
    console.log(`\n[import] DRY RUN: SQL written to ${sqlPath}`);
    console.log(`[import] ${data.programs.length} programs, ${data.editions.length} editions, ${data.entries.length} entries`);
    console.log(`[import] To execute, set WAKILISHA_CHART_IMPORT_COMMIT=1 and re-run\n`);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(fullSql);
    await client.query("COMMIT");
    console.log(`\n[import] COMMITTED: ${data.programs.length} programs, ${data.editions.length} editions, ${data.entries.length} entries\n`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`\n[import] ROLLBACK: ${error instanceof Error ? error.message : error}\n`);
    throw error;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  WAKILISHA WordPress Chart → V2 Importer");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN (preview only)" : "COMMIT (writing to DB)"}`);
  console.log(`  MySQL: ${wpConfig.host}:${wpConfig.port}/${wpConfig.database}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const wp = await mysql.createConnection({
    host: wpConfig.host,
    port: wpConfig.port,
    user: wpConfig.user,
    password: wpConfig.password,
    database: wpConfig.database,
    connectTimeout: 15000,
  });

  const pool = createPgPool();

  try {
    await wp.ping();
    console.log("[import] MySQL connected");

    const pgOk = await queryFirst(pool, "SELECT 1 AS ok");
    if (!pgOk) throw new Error("PostgreSQL connection failed");
    console.log("[import] PostgreSQL connected\n");

    // ── Discovery ──
    const tablesToCheck = [
      "wkcharts_charts",
      "wkcharts_editions",
      "wkcharts_edition_items",
      "wkcharts_tracks",
      "wkcharts_artists",
      "wkcharts_track_artists",
      "wkcharts_track_sources",
      "wkcharts_ingest_runs",
    ];

    const tableStatus: Record<string, { exists: boolean; count: number }> = {};
    for (const name of tablesToCheck) {
      const exists = await tableExists(wp, name);
      const count = exists ? await countWp(wp, name) : 0;
      tableStatus[name] = { exists, count };
      console.log(`[import] ${name}: ${exists ? `${count} rows` : "MISSING"}`);
    }

    // ── Load charts ──
    const oldCharts = await loadOldCharts(wp);
    console.log(`\n[import] Discovered ${oldCharts.length} chart(s):`);
    for (const c of oldCharts) {
      console.log(`[import]   #${c.id}: "${c.name}" (slug: ${c.slug}, type: ${c.chart_type})`);
    }

    if (oldCharts.length === 0) {
      console.error("\n[import] No charts found. Cannot proceed.\n");
      process.exit(1);
    }

    // ── Build programs ──
    const v2Programs: V2Program[] = [];
    const chartIdToProgram = new Map<number, V2Program>();
    const seenSlugs = new Set<string>();
    for (const chart of oldCharts) {
      const program = buildV2ProgramFromOldChart(chart);
      if (!seenSlugs.has(program.public_slug)) {
        seenSlugs.add(program.public_slug);
        v2Programs.push(program);
      }
      chartIdToProgram.set(chart.id, program);
    }

    // ── Load and migrate editions ──
    const v2Editions: V2Edition[] = [];
    const v2Entries: V2Entry[] = [];
    const v2Coverage: V2SourceCoverage[] = [];
    const v2Aliases: V2Alias[] = [];
    let totalOldEntries = 0;

    for (const chart of oldCharts) {
      const program = chartIdToProgram.get(chart.id)!;
      const oldEditions = await loadOldEditions(wp, chart.id);
      const ingestRuns = await loadOldIngestRuns(wp, chart.id);
      const ingestRunByEditionId = new Map<number, OldIngestRun>();
      for (const run of ingestRuns) {
        if (run.edition_id != null && !ingestRunByEditionId.has(run.edition_id)) {
          ingestRunByEditionId.set(run.edition_id, run);
        }
      }

      console.log(`\n[import] Chart "${chart.name}": ${oldEditions.length} editions`);

      for (const oldEdition of oldEditions) {
        const ingestRun = ingestRunByEditionId.get(oldEdition.id) ?? null;
        const v2Edition = buildV2Edition(oldEdition, program, ingestRun);
        v2Editions.push(v2Edition);

        const alias = buildV2Alias(chart.slug, oldEdition.slug, program);
        v2Aliases.push(alias);

        const oldItems = await loadOldEditionItems(wp, oldEdition.id);
        if (!oldItems.length) {
          console.warn(`[import]   ${oldEdition.edition_date}: 0 items (skipping)`);
          continue;
        }

        const trackIds = [...new Set(oldItems.map((i) => i.track_id))];
        const tracksById = await loadOldTracks(wp, trackIds);

        const allArtistIds = new Set<number>();
        for (const [, track] of tracksById) {
          if (track.artist_id != null) allArtistIds.add(track.artist_id);
        }
        if (tableStatus["wkcharts_track_artists"].exists) {
          const placeholders = trackIds.map(() => "?").join(",");
          const rows = await queryWp(wp,
            `SELECT track_id, artist_id FROM ${tbl("wkcharts_track_artists")} WHERE track_id IN (${placeholders})`,
            trackIds,
          );
          for (const r of rows) {
            allArtistIds.add(Number(r.artist_id));
          }
        }

        const artistsById = await loadOldArtists(wp, [...allArtistIds]);
        const trackSourcesById = await loadOldTrackSources(wp, trackIds);

        let editionSourceCount = 0;
        for (const item of oldItems) {
          const track = tracksById.get(item.track_id);
          const artistIds = track?.artist_id != null ? [track.artist_id] : [];
          const primaryArtist = artistIds.length > 0 ? artistsById.get(artistIds[0]) : undefined;
          const sources = trackSourcesById.get(item.track_id) ?? [];
          editionSourceCount += sources.length;

          const entry = buildV2Entry(item, v2Edition, track, primaryArtist, sources);
          v2Entries.push(entry);
          totalOldEntries++;
        }

        const coverage = buildV2SourceCoverage(v2Edition, editionSourceCount);
        v2Coverage.push(coverage);

        console.log(`[import]   ${oldEdition.edition_date}: ${oldItems.length} entries, ${editionSourceCount} sources`);
      }
    }

    // ── Write ──
    console.log(`\n[import] Prepared: ${v2Programs.length} programs, ${v2Editions.length} editions, ${v2Entries.length} entries, ${v2Coverage.length} coverage, ${v2Aliases.length} aliases`);

    await writeV2Data(pool, {
      programs: v2Programs,
      editions: v2Editions,
      entries: v2Entries,
      sourceCoverage: v2Coverage,
      aliases: v2Aliases,
    });

    // ── Report ──
    const reportPath = path.join(process.cwd(), "reports", "chart-v2-wordpress-import.json");
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      mode: DRY_RUN ? "dry-run" : "committed",
      wordpress: { host: wpConfig.host, database: wpConfig.database, prefix: wpConfig.prefix, tableStatus },
      v2: {
        programCount: v2Programs.length,
        editionCount: v2Editions.length,
        entryCount: v2Entries.length,
        sourceCoverageCount: v2Coverage.length,
        aliasCount: v2Aliases.length,
      },
      programs: v2Programs.map((p) => ({ id: p.id, public_slug: p.public_slug, public_label: p.public_label })),
      editions: v2Editions.map((e) => ({ id: e.id, program_id: e.program_id, edition_slug: e.edition_slug, edition_date: e.edition_date })),
      aliases: v2Aliases.map((a) => ({ legacy_slug: a.legacy_slug, canonical_slug: a.canonical_slug })),
    }, null, 2));
    console.log(`[import] Report written to ${reportPath}\n`);

  } finally {
    await wp.end();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\n[import] Fatal error:", err instanceof Error ? err.message : err, "\n");
  process.exit(1);
});