import fs from "node:fs";
import path from "node:path";

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

  constructor(private databaseUrl = process.env.DATABASE_URL ?? "") {}

  private notConfigured(): never {
    throw new Error(
      "DatabaseV2Repository is a scaffold. Wire a Postgres client and query wk_chart_*_v2 tables before enabling DB mode. DATABASE_URL provided: " +
        Boolean(this.databaseUrl)
    );
  }

  getCounts(): Record<string, number> { return this.notConfigured(); }
  getMigrationReadiness(): string { return this.notConfigured(); }
  resolveProgramSlug(_slug: string): Promise<V2ResolvedSlug> { return Promise.resolve(this.notConfigured()); }
  listPrograms(): Promise<Row[]> { return Promise.resolve(this.notConfigured()); }
  getProgram(_slug: string): Promise<Row | null> { return Promise.resolve(this.notConfigured()); }
  listEditionsForProgram(_program: Row): Promise<Row[]> { return Promise.resolve(this.notConfigured()); }
  getLatestNonEmptyEdition(_program: Row): Promise<Row | null> { return Promise.resolve(this.notConfigured()); }
  getEdition(_program: Row, _editionSlug: string): Promise<Row | null> { return Promise.resolve(this.notConfigured()); }
  listEntries(_program: Row, _editionSlug: string): Promise<Entry[]> { return Promise.resolve(this.notConfigured()); }
  listSourceCoverage(_editionId: string): Promise<Row[]> { return Promise.resolve(this.notConfigured()); }
  getSeries(_seriesSlug: string): Promise<Row | null> { return Promise.resolve(this.notConfigured()); }
  getMarket(_marketSlug: string): Promise<Row | null> { return Promise.resolve(this.notConfigured()); }
  getMethodology(_methodologyVersion: string): Promise<Row | null> { return Promise.resolve(this.notConfigured()); }
  getEligibilityRules(_eligibilityVersion: string): Promise<Row | null> { return Promise.resolve(this.notConfigured()); }
  getTrackHistory(_trackSlug: string): Promise<TracksIndex[string] | null> { return Promise.resolve(this.notConfigured()); }
}

export function createV2Repository(): V2Repository {
  const mode = process.env.WAKILISHA_V2_REPOSITORY_MODE ?? "json";
  if (mode === "database") return new DatabaseV2Repository();
  return new JsonV2Repository();
}
