import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const root = process.cwd();
const dataRoot = path.join(root, "public", "charts-data");

type PgPool = InstanceType<typeof pg.Pool>;

export type Row = Record<string, unknown>;
export type Entry = {
  id: string;
  rank: number;
  previousRank: number | null;
  movement: string;
  trackSlug: string | null;
  trackTitle: string;
  artistSlugs?: string[];
  artistNames: string[];
  artworkUrl: string | null;
  score?: number;
};
export type TracksIndex = Record<string, {
  trackSlug: string;
  trackTitle: string;
  artistNames: string[];
  appearances: {
    editionSlug: string;
    editionLabel: string;
    rank: number;
    weeksOnChart: number;
    movement: "up" | "down" | "same" | "new" | "re_entry";
  }[];
  peakPosition: number;
  totalWeeksOnChart: number;
  firstAppearance: string | null;
  latestAppearance: string | null;
}>;

export type V2ResolvedSlug = {
  requestedSlug: string;
  canonicalSlug: string;
  canonicalized: boolean;
};

export interface V2Repository {
  kind: "json-local" | "database";
  testConnection(): Promise<boolean>;
  end(): Promise<void>;
  getCounts(): Promise<Record<string, number>>;
  getMigrationReadiness(): Promise<string>;
  resolveProgramSlug(slug: string): Promise<V2ResolvedSlug>;
  listPrograms(): Promise<Row[]>;
  getProgram(slug: string): Promise<Row | null>;
  listEditionsForProgram(program: Row): Promise<Row[]>;
  getLatestNonEmptyEdition(program: Row): Promise<Row | null>;
  getEdition(program: Row, editionSlug: string): Promise<Row | null>;
  listEntries(program: Row, editionSlug: string): Promise<Entry[]>;
  listSourceCoverage(editionId: string): Promise<Row[]>;
  getSeries(seriesSlug: string): Promise<Row | null>;
  getMarket(marketSlug: string): Promise<Row | null>;
  getMethodology(methodologyVersion: string): Promise<Row | null>;
  getEligibilityRules(eligibilityVersion: string): Promise<Row | null>;
  getTrackHistory(trackSlug: string): Promise<TracksIndex[string] | null>;
}

function readJson<T>(filepath: string): T {
  return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
}

export function str(row: Row | undefined | null, key: string): string {
  return String(row?.[key] ?? "");
}

export function programId(program: Row): string {
  return str(program, "id");
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
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

class JsonV2Repository implements V2Repository {
  kind = "json-local" as const;
  private manifest = readJson<Record<string, unknown>>(path.join(dataRoot, "manifest.json"));
  private families = readJson<Row[]>(path.join(dataRoot, "families.json"));
  private editions = readJson<Row[]>(path.join(dataRoot, "editions.json"));
  private tracksIndex = readJson<TracksIndex>(path.join(dataRoot, "tracks.json"));
  private seriesBySlug = new Map<string, Row>();
  private marketsBySlug = new Map<string, Row>();
  private methodologiesByVersion = new Map<string, Row>();
  private eligibilityByVersion = new Map<string, Row>();

  constructor() {
    for (const family of this.families) {
      this.seriesBySlug.set(str(family, "seriesSlug"), {
        id: str(family, "seriesSlug"),
        series_slug: str(family, "seriesSlug"),
        series_label: str(family, "seriesLabel"),
      });
      this.marketsBySlug.set(str(family, "marketSlug"), {
        id: str(family, "marketSlug"),
        market_slug: str(family, "marketSlug"),
        market_label: str(family, "marketLabel"),
      });
      this.methodologiesByVersion.set(str(family, "methodologyVersion"), {
        id: str(family, "methodologyVersion"),
        methodology_version: str(family, "methodologyVersion"),
      });
      this.eligibilityByVersion.set(str(family, "eligibilityRulesVersion"), {
        id: str(family, "eligibilityRulesVersion"),
        eligibility_version: str(family, "eligibilityRulesVersion"),
      });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      return this.families.length > 0;
    } catch {
      return false;
    }
  }

  async end(): Promise<void> {
    // No-op for JSON repo
  }

  async getCounts(): Promise<Record<string, number>> {
    return (this.manifest.totals as Record<string, number> | undefined) ?? {};
  }

  async getMigrationReadiness(): Promise<string> {
    return "ready_with_warnings";
  }

  async resolveProgramSlug(slug: string): Promise<V2ResolvedSlug> {
    const family = this.families.find((row) =>
      str(row, "publicSlug") === slug ||
      str(row, "sourceFamilySlug") === slug ||
      (Array.isArray(row.legacySlugs) && (row.legacySlugs as string[]).includes(slug))
    );
    const canonicalSlug = family ? str(family, "publicSlug") : slug;
    return { requestedSlug: slug, canonicalSlug, canonicalized: canonicalSlug !== slug };
  }

  async listPrograms(): Promise<Row[]> {
    return this.families.map((family) => ({
      id: str(family, "publicSlug"),
      series_slug: str(family, "seriesSlug"),
      market_slug: str(family, "marketSlug"),
      public_slug: str(family, "publicSlug"),
      public_label: str(family, "publicLabel"),
      short_label: str(family, "shortLabel"),
      source_family_slug: str(family, "sourceFamilySlug"),
      default_period_type: str(family, "periodType"),
      default_methodology_version: str(family, "methodologyVersion"),
      default_eligibility_rules_version: str(family, "eligibilityRulesVersion"),
    }));
  }

  async getProgram(slug: string): Promise<Row | null> {
    const { canonicalSlug } = await this.resolveProgramSlug(slug);
    return (await this.listPrograms()).find((row) => str(row, "public_slug") === canonicalSlug) ?? null;
  }

  async listEditionsForProgram(program: Row): Promise<Row[]> {
    const sourceSlug = str(program, "source_family_slug") || str(program, "public_slug");
    return this.editions
      .filter((edition) => str(edition, "familyId") === sourceSlug || str(edition, "familyId") === str(program, "public_slug"))
      .map((edition) => ({
        id: str(edition, "id"),
        program_id: programId(program),
        edition_slug: str(edition, "slug"),
        edition_label: str(edition, "label"),
        edition_date: str(edition, "date"),
        period_start: str(edition, "periodStart"),
        period_end: str(edition, "periodEnd"),
        entry_count: Number(edition.entryCount ?? 0),
      }))
      .sort((a, b) => str(b, "edition_date").localeCompare(str(a, "edition_date")) || str(b, "edition_slug").localeCompare(str(a, "edition_slug")));
  }

  async getLatestNonEmptyEdition(program: Row): Promise<Row | null> {
    return (await this.listEditionsForProgram(program)).find((edition) => Number(edition.entry_count ?? 0) > 0) ?? null;
  }

  async getEdition(program: Row, editionSlug: string): Promise<Row | null> {
    return (await this.listEditionsForProgram(program)).find((edition) => str(edition, "edition_slug") === editionSlug) ?? null;
  }

  async listEntries(program: Row, editionSlug: string): Promise<Entry[]> {
    const entriesPath = path.join(dataRoot, "entries", str(program, "source_family_slug") || str(program, "public_slug"), `${editionSlug}.json`);
    if (!fs.existsSync(entriesPath)) return [];
    const entries = readJson<Row[]>(entriesPath);
    return entries.map((entry) => ({
      id: str(entry, "id"),
      rank: Number(entry.rank ?? 0),
      previousRank: entry.previousRank === null || entry.previousRank === undefined ? null : Number(entry.previousRank),
      movement: str(entry, "movement"),
      trackSlug: str(entry, "trackSlug") || null,
      trackTitle: str(entry, "trackTitle"),
      artistSlugs: Array.isArray(entry.artistSlugs) ? entry.artistSlugs as string[] : [],
      artistNames: Array.isArray(entry.artistNames) ? entry.artistNames as string[] : [],
      artworkUrl: str(entry, "artworkUrl") || null,
      score: typeof entry.score === "number" ? entry.score : 0,
    }));
  }

  async listSourceCoverage(): Promise<Row[]> {
    return [];
  }

  async getSeries(seriesSlug: string): Promise<Row | null> {
    return this.seriesBySlug.get(seriesSlug) ?? null;
  }

  async getMarket(marketSlug: string): Promise<Row | null> {
    return this.marketsBySlug.get(marketSlug) ?? null;
  }

  async getMethodology(methodologyVersion: string): Promise<Row | null> {
    return this.methodologiesByVersion.get(methodologyVersion) ?? null;
  }

  async getEligibilityRules(eligibilityVersion: string): Promise<Row | null> {
    return this.eligibilityByVersion.get(eligibilityVersion) ?? null;
  }

  async getTrackHistory(trackSlug: string): Promise<TracksIndex[string] | null> {
    return this.tracksIndex[trackSlug] ?? null;
  }
}

export class DatabaseV2Repository implements V2Repository {
  kind = "database" as const;
  private pool: PgPool;

  constructor(private databaseUrl = process.env.DATABASE_URL ?? "") {
    if (!this.databaseUrl) {
      throw new Error("DatabaseV2Repository requires DATABASE_URL.");
    }
    this.pool = new pg.Pool({
      connectionString: normalizeDatabaseUrlForPg(this.databaseUrl),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      query_timeout: 10000,
      statement_timeout: 10000,
      max: 4,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.pool.query("SELECT 1 AS ok");
      return result.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  async end(): Promise<void> {
    await this.pool.end();
  }

  private async queryJson<T>(sql: string): Promise<T> {
    const wrapped = `WITH q AS (${sql}) SELECT COALESCE(json_agg(q), '[]'::json) AS result FROM q;`;
    const result = await this.pool.query(wrapped);
    const jsonValue = result.rows[0]?.result;
    if (jsonValue === null || jsonValue === undefined) return [] as T;
    if (typeof jsonValue === "string") return JSON.parse(jsonValue) as T;
    return jsonValue as T;
  }

  private async first(sql: string): Promise<Row | null> {
    const rows = await this.queryJson<Row[]>(sql);
    return rows[0] ?? null;
  }

  async getCounts(): Promise<Record<string, number>> {
    const row = await this.first(`
      SELECT
        (SELECT COUNT(*)::int FROM wk_chart_series_v2) AS series,
        (SELECT COUNT(*)::int FROM wk_chart_markets_v2) AS markets,
        (SELECT COUNT(*)::int FROM wk_chart_programs_v2) AS programs,
        (SELECT COUNT(*)::int FROM wk_chart_methodologies_v2) AS methodologies,
        (SELECT COUNT(*)::int FROM wk_chart_eligibility_rules_v2) AS "eligibilityRules",
        (SELECT COUNT(*)::int FROM wk_chart_editions_v2) AS editions,
        (SELECT COUNT(*)::int FROM wk_chart_entries_v2) AS entries,
        (SELECT COUNT(*)::int FROM wk_chart_source_coverage_v2) AS "sourceCoverage",
        (SELECT COUNT(*)::int FROM wk_chart_slug_aliases_v2) AS "slugAliases"
    `);
    return (row as Record<string, number> | null) ?? {};
  }

  async getMigrationReadiness(): Promise<string> {
    return "database_readonly";
  }

  async resolveProgramSlug(slug: string): Promise<V2ResolvedSlug> {
    const alias = await this.first(`
      SELECT canonical_slug
      FROM wk_chart_slug_aliases_v2
      WHERE legacy_slug = ${sqlLiteral(slug)}
        AND entity_type = 'chart_program'
        AND redirect_status = 'active'
      LIMIT 1
    `);
    const canonicalSlug = String(alias?.canonical_slug ?? slug);
    return { requestedSlug: slug, canonicalSlug, canonicalized: canonicalSlug !== slug };
  }

  async listPrograms(): Promise<Row[]> {
    return this.queryJson<Row[]>(`
      SELECT
        p.*,
        s.series_label,
        m.market_label,
        COALESCE((
          SELECT json_agg(edition_row ORDER BY edition_row.edition_date DESC, edition_row.edition_slug DESC)
          FROM (
            SELECT
              e.id,
              e.edition_slug,
              e.edition_label,
              e.edition_date,
              e.period_start,
              e.period_end,
              e.entry_count
            FROM wk_chart_editions_v2 e
            WHERE e.program_id = p.id
              AND e.entry_count > 0
          ) edition_row
        ), '[]'::json) AS archive_json
      FROM wk_chart_programs_v2 p
      LEFT JOIN wk_chart_series_v2 s ON s.series_slug = p.series_slug
      LEFT JOIN wk_chart_markets_v2 m ON m.market_slug = p.market_slug
      ORDER BY p.public_slug ASC
    `);
  }

  async getProgram(slug: string): Promise<Row | null> {
    const { canonicalSlug } = await this.resolveProgramSlug(slug);
    return this.first(`
      SELECT
        p.*,
        s.series_label,
        m.market_label
      FROM wk_chart_programs_v2 p
      LEFT JOIN wk_chart_series_v2 s ON s.series_slug = p.series_slug
      LEFT JOIN wk_chart_markets_v2 m ON m.market_slug = p.market_slug
      WHERE p.public_slug = ${sqlLiteral(canonicalSlug)}
      LIMIT 1
    `);
  }

  async listEditionsForProgram(program: Row): Promise<Row[]> {
    return this.queryJson<Row[]>(`
      SELECT *
      FROM wk_chart_editions_v2
      WHERE program_id = ${sqlLiteral(programId(program))}
      ORDER BY edition_date DESC, edition_slug DESC
    `);
  }

  async getLatestNonEmptyEdition(program: Row): Promise<Row | null> {
    return this.first(`
      SELECT *
      FROM wk_chart_editions_v2
      WHERE program_id = ${sqlLiteral(programId(program))}
        AND entry_count > 0
      ORDER BY edition_date DESC, edition_slug DESC
      LIMIT 1
    `);
  }

  async getEdition(program: Row, editionSlug: string): Promise<Row | null> {
    return this.first(`
      SELECT *
      FROM wk_chart_editions_v2
      WHERE program_id = ${sqlLiteral(programId(program))}
        AND edition_slug = ${sqlLiteral(editionSlug)}
      LIMIT 1
    `);
  }

  async listEntries(program: Row, editionSlug: string): Promise<Entry[]> {
    const edition = await this.getEdition(program, editionSlug);
    if (!edition) return [];
    return this.queryJson<Entry[]>(`
      SELECT
        id,
        edition_id AS "editionId",
        rank,
        previous_rank AS "previousRank",
        movement,
        track_slug AS "trackSlug",
        track_title AS "trackTitle",
        CASE
          WHEN artist_slug IS NULL OR artist_slug = '' THEN ARRAY[]::text[]
          ELSE ARRAY[artist_slug]
        END AS "artistSlugs",
        CASE
          WHEN artist_name IS NULL OR artist_name = '' THEN ARRAY[]::text[]
          ELSE string_to_array(artist_name, ', ')
        END AS "artistNames",
        artwork_url AS "artworkUrl",
        NULL::numeric AS score
      FROM wk_chart_entries_v2
      WHERE edition_id = ${sqlLiteral(str(edition, "id"))}
      ORDER BY rank ASC
    `);
  }

  async listSourceCoverage(editionId: string): Promise<Row[]> {
    return this.queryJson<Row[]>(`
      SELECT *
      FROM wk_chart_source_coverage_v2
      WHERE edition_id = ${sqlLiteral(editionId)}
      ORDER BY source_name ASC
    `);
  }

  async getSeries(seriesSlug: string): Promise<Row | null> {
    return this.first(`SELECT * FROM wk_chart_series_v2 WHERE series_slug = ${sqlLiteral(seriesSlug)} LIMIT 1`);
  }

  async getMarket(marketSlug: string): Promise<Row | null> {
    return this.first(`SELECT * FROM wk_chart_markets_v2 WHERE market_slug = ${sqlLiteral(marketSlug)} LIMIT 1`);
  }

  async getMethodology(methodologyVersion: string): Promise<Row | null> {
    return this.first(`SELECT * FROM wk_chart_methodologies_v2 WHERE methodology_version = ${sqlLiteral(methodologyVersion)} LIMIT 1`);
  }

  async getEligibilityRules(eligibilityVersion: string): Promise<Row | null> {
    return this.first(`SELECT * FROM wk_chart_eligibility_rules_v2 WHERE eligibility_version = ${sqlLiteral(eligibilityVersion)} LIMIT 1`);
  }

  async getTrackHistory(trackSlug: string): Promise<TracksIndex[string] | null> {
    const rows = await this.queryJson<Row[]>(`
      SELECT
        e.edition_slug AS "editionSlug",
        e.edition_label AS "editionLabel",
        e.edition_date AS "editionDate",
        ce.rank,
        ce.movement,
        ce.track_title AS "trackTitle",
        ce.artist_name AS "artistName"
      FROM wk_chart_entries_v2 ce
      INNER JOIN wk_chart_editions_v2 e ON e.id = ce.edition_id
      WHERE ce.track_slug = ${sqlLiteral(trackSlug)}
      ORDER BY e.edition_date ASC, ce.rank ASC
    `);
    if (!rows.length) return null;
    const ranks = rows.map((row) => Number(row.rank)).filter((rank) => Number.isFinite(rank));
    const firstRow = rows[0];
    const latestRow = rows[rows.length - 1];
    return {
      trackSlug,
      trackTitle: str(firstRow, "trackTitle"),
      artistNames: str(firstRow, "artistName") ? str(firstRow, "artistName").split(", ") : [],
      appearances: rows.map((row, index) => ({
        editionSlug: str(row, "editionSlug"),
        editionLabel: str(row, "editionLabel"),
        rank: Number(row.rank ?? 0),
        weeksOnChart: index + 1,
        movement: ["up", "down", "same", "new", "re_entry"].includes(str(row, "movement"))
          ? (str(row, "movement") as "up" | "down" | "same" | "new" | "re_entry")
          : "same",
      })),
      peakPosition: ranks.length ? Math.min(...ranks) : 0,
      totalWeeksOnChart: rows.length,
      firstAppearance: str(firstRow, "editionSlug") || null,
      latestAppearance: str(latestRow, "editionSlug") || null,
    };
  }
}

export function createV2Repository(): V2Repository {
  const mode = process.env.WAKILISHA_V2_REPOSITORY_MODE ?? "json";
  if (mode === "database") {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "WAKILISHA_V2_REPOSITORY_MODE=database but DATABASE_URL is not set. " +
        "Set DATABASE_URL or switch to WAKILISHA_V2_REPOSITORY_MODE=json."
      );
    }
    return new DatabaseV2Repository();
  }
  return new JsonV2Repository();
}
