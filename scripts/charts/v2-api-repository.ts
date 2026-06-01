import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Row = Record<string, unknown>;

type Entry = {
  id: string;
  editionId: string;
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

type EntriesPayload = { entries: Entry[] };

type InsertPlan = {
  generatedAt: string;
  migrationReadiness: "ready" | "ready_with_warnings" | "blocked";
  counts: Record<string, number>;
  inserts: {
    series: Row[];
    markets: Row[];
    programs: Row[];
    methodologies: Row[];
    eligibilityRules: Row[];
    editions: Row[];
    sourceCoverage: Row[];
    slugAliases: Row[];
  };
};

type TracksIndex = Record<string, {
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

export type V2Repository = {
  kind: "json-local" | "database";
  getCounts(): Record<string, number>;
  getMigrationReadiness(): string;
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
};

const root = process.cwd();
const reportsDir = path.join(root, "reports");
const chartsDir = path.join(root, "public/charts-data");
const defaultPlanPath = path.join(reportsDir, "chart-v2-insert-plan.json");
const tracksPath = path.join(chartsDir, "tracks.json");

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) throw new Error(`Missing required file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function str(row: Row | undefined | null, key: string): string {
  return String(row?.[key] ?? "");
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function programId(program: Row): string {
  return String(program.id);
}

export function sourceFamilySlug(program: Row): string {
  return String(program.source_family_slug ?? program.public_slug);
}

export class JsonV2Repository implements V2Repository {
  kind = "json-local" as const;
  private plan: InsertPlan;
  private tracksIndex: TracksIndex;
  private seriesBySlug: Map<string, Row>;
  private marketBySlug: Map<string, Row>;
  private methodologiesByVersion: Map<string, Row>;
  private eligibilityByVersion: Map<string, Row>;
  private coverageByEdition: Map<string, Row[]>;
  private aliasToCanonical: Map<string, string>;

  constructor(planPath = defaultPlanPath) {
    this.plan = readJson<InsertPlan>(planPath);
    this.tracksIndex = fs.existsSync(tracksPath) ? readJson<TracksIndex>(tracksPath) : {};
    this.seriesBySlug = new Map(this.plan.inserts.series.map((row) => [String(row.series_slug), row]));
    this.marketBySlug = new Map(this.plan.inserts.markets.map((row) => [String(row.market_slug), row]));
    this.methodologiesByVersion = new Map(this.plan.inserts.methodologies.map((row) => [String(row.methodology_version), row]));
    this.eligibilityByVersion = new Map(this.plan.inserts.eligibilityRules.map((row) => [String(row.eligibility_version), row]));
    this.coverageByEdition = new Map();
    for (const row of this.plan.inserts.sourceCoverage) {
      const editionId = String(row.edition_id);
      const list = this.coverageByEdition.get(editionId) ?? [];
      list.push(row);
      this.coverageByEdition.set(editionId, list);
    }
    this.aliasToCanonical = new Map();
    for (const alias of this.plan.inserts.slugAliases) {
      if (alias.redirect_status === "active") {
        this.aliasToCanonical.set(String(alias.legacy_slug), String(alias.canonical_slug));
      }
    }
  }

  getCounts() {
    return this.plan.counts;
  }

  getMigrationReadiness() {
    return this.plan.migrationReadiness;
  }

  async resolveProgramSlug(slug: string): Promise<V2ResolvedSlug> {
    const canonicalSlug = this.aliasToCanonical.get(slug) ?? slug;
    return { requestedSlug: slug, canonicalSlug, canonicalized: canonicalSlug !== slug };
  }

  async listPrograms(): Promise<Row[]> {
    return this.plan.inserts.programs;
  }

  async getProgram(slug: string): Promise<Row | null> {
    const { canonicalSlug } = await this.resolveProgramSlug(slug);
    return this.plan.inserts.programs.find((program) => program.public_slug === canonicalSlug) ?? null;
  }

  async listEditionsForProgram(program: Row): Promise<Row[]> {
    return this.plan.inserts.editions
      .filter((edition) => edition.program_id === programId(program))
      .slice()
      .sort((a, b) => Date.parse(str(b, "edition_date")) - Date.parse(str(a, "edition_date")));
  }

  async getLatestNonEmptyEdition(program: Row): Promise<Row | null> {
    const editions = await this.listEditionsForProgram(program);
    return editions.find((edition) => Number(edition.entry_count ?? 0) > 0) ?? null;
  }

  async getEdition(program: Row, editionSlug: string): Promise<Row | null> {
    const editions = await this.listEditionsForProgram(program);
    return editions.find((edition) => edition.edition_slug === editionSlug) ?? null;
  }

  async listEntries(program: Row, editionSlug: string): Promise<Entry[]> {
    const filePath = path.join(chartsDir, "entries", sourceFamilySlug(program), `${editionSlug}.json`);
    if (!fs.existsSync(filePath)) return [];
    return (readJson<EntriesPayload>(filePath).entries ?? []).slice().sort((a, b) => a.rank - b.rank);
  }

  async listSourceCoverage(editionId: string): Promise<Row[]> {
    return this.coverageByEdition.get(editionId) ?? [];
  }

  async getSeries(seriesSlug: string): Promise<Row | null> {
    return this.seriesBySlug.get(seriesSlug) ?? null;
  }

  async getMarket(marketSlug: string): Promise<Row | null> {
    return this.marketBySlug.get(marketSlug) ?? null;
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

  constructor(private databaseUrl = process.env.DATABASE_URL ?? "") {
    if (!this.databaseUrl) {
      throw new Error("DatabaseV2Repository requires DATABASE_URL.");
    }
  }

  private queryJson<T>(sql: string): T {
    const wrapped = `WITH q AS (${sql}) SELECT COALESCE(json_agg(q), '[]'::json) FROM q;`;
    const result = spawnSync("psql", [this.databaseUrl, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", wrapped], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
    });
    if (result.status !== 0) {
      throw new Error(`psql query failed: ${result.stderr || result.stdout}`);
    }
    const output = result.stdout.trim() || "[]";
    return JSON.parse(output) as T;
  }

  private first(sql: string): Row | null {
    return (this.queryJson<Row[]>(sql)[0] as Row | undefined) ?? null;
  }

  getCounts(): Record<string, number> {
    const row = this.first(`
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
    return row ?? {};
  }

  getMigrationReadiness(): string {
    return "database_readonly";
  }

  async resolveProgramSlug(slug: string): Promise<V2ResolvedSlug> {
    const alias = this.first(`
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
    return this.queryJson<Row[]>(`SELECT * FROM wk_chart_programs_v2 ORDER BY public_slug ASC`);
  }

  async getProgram(slug: string): Promise<Row | null> {
    const { canonicalSlug } = await this.resolveProgramSlug(slug);
    return this.first(`SELECT * FROM wk_chart_programs_v2 WHERE public_slug = ${sqlLiteral(canonicalSlug)} LIMIT 1`);
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
    const rows = this.queryJson<Row[]>(`
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
  if (mode === "database") return new DatabaseV2Repository();
  return new JsonV2Repository();
}
