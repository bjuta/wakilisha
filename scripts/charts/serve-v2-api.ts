import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";

type ProgramRow = Record<string, unknown>;
type EditionRow = Record<string, unknown>;
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

type InsertPlan = {
  generatedAt: string;
  migrationReadiness: "ready" | "ready_with_warnings" | "blocked";
  counts: Record<string, number>;
  inserts: {
    series: ProgramRow[];
    markets: ProgramRow[];
    programs: ProgramRow[];
    methodologies: ProgramRow[];
    eligibilityRules: ProgramRow[];
    editions: EditionRow[];
    sourceCoverage: ProgramRow[];
    slugAliases: ProgramRow[];
  };
};

type EntriesPayload = { entries: Entry[] };

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

const root = process.cwd();
const reportsDir = path.join(root, "reports");
const chartsDir = path.join(root, "public/charts-data");
const planPath = path.join(reportsDir, "chart-v2-insert-plan.json");
const tracksPath = path.join(chartsDir, "tracks.json");
const port = Number(process.env.WAKILISHA_V2_API_PORT ?? 4175);

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) throw new Error(`Missing required file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

const plan = readJson<InsertPlan>(planPath);
const tracksIndex = fs.existsSync(tracksPath) ? readJson<TracksIndex>(tracksPath) : {};

const programs = plan.inserts.programs;
const editions = plan.inserts.editions;
const seriesBySlug = new Map(plan.inserts.series.map((row) => [String(row.series_slug), row]));
const marketBySlug = new Map(plan.inserts.markets.map((row) => [String(row.market_slug), row]));
const methodologiesByVersion = new Map(plan.inserts.methodologies.map((row) => [String(row.methodology_version), row]));
const eligibilityByVersion = new Map(plan.inserts.eligibilityRules.map((row) => [String(row.eligibility_version), row]));
const coverageByEdition = new Map<string, ProgramRow[]>();
for (const row of plan.inserts.sourceCoverage) {
  const editionId = String(row.edition_id);
  const list = coverageByEdition.get(editionId) ?? [];
  list.push(row);
  coverageByEdition.set(editionId, list);
}

const aliasToCanonical = new Map<string, string>();
for (const alias of plan.inserts.slugAliases) {
  if (alias.redirect_status === "active") {
    aliasToCanonical.set(String(alias.legacy_slug), String(alias.canonical_slug));
  }
}

function str(row: Record<string, unknown> | undefined, key: string): string {
  return String(row?.[key] ?? "");
}

function nullable(row: Record<string, unknown> | undefined, key: string): string | null {
  const value = row?.[key];
  return value === undefined || value === null || value === "" ? null : String(value);
}

function numberValue(row: Record<string, unknown> | undefined, key: string): number {
  const value = Number(row?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function resolveProgramSlug(slug: string): { requestedSlug: string; canonicalSlug: string; canonicalized: boolean } {
  const canonicalSlug = aliasToCanonical.get(slug) ?? slug;
  return { requestedSlug: slug, canonicalSlug, canonicalized: canonicalSlug !== slug };
}

function findProgram(slug: string): ProgramRow | null {
  const { canonicalSlug } = resolveProgramSlug(slug);
  return programs.find((program) => program.public_slug === canonicalSlug) ?? null;
}

function programId(program: ProgramRow): string {
  return String(program.id);
}

function sourceFamilySlug(program: ProgramRow): string {
  return String(program.source_family_slug ?? program.public_slug);
}

function sortedEditionsForProgram(program: ProgramRow): EditionRow[] {
  return editions
    .filter((edition) => edition.program_id === programId(program))
    .slice()
    .sort((a, b) => Date.parse(String(b.edition_date)) - Date.parse(String(a.edition_date)));
}

function readEntries(program: ProgramRow, editionSlug: string): Entry[] {
  const filePath = path.join(chartsDir, "entries", sourceFamilySlug(program), `${editionSlug}.json`);
  if (!fs.existsSync(filePath)) return [];
  return (readJson<EntriesPayload>(filePath).entries ?? []).slice().sort((a, b) => a.rank - b.rank);
}

function latestNonEmptyEdition(program: ProgramRow): EditionRow | null {
  for (const edition of sortedEditionsForProgram(program)) {
    if (numberValue(edition, "entry_count") > 0) return edition;
  }
  return null;
}

function toEditionSummary(edition: EditionRow) {
  return {
    id: str(edition, "id"),
    slug: str(edition, "edition_slug"),
    label: str(edition, "edition_label"),
    date: str(edition, "edition_date"),
    periodStart: nullable(edition, "period_start"),
    periodEnd: nullable(edition, "period_end"),
    entryCount: numberValue(edition, "entry_count"),
  };
}

function toProgram(program: ProgramRow) {
  const series = seriesBySlug.get(str(program, "series_slug"));
  const market = marketBySlug.get(str(program, "market_slug"));
  const archive = sortedEditionsForProgram(program).filter((edition) => numberValue(edition, "entry_count") > 0);
  return {
    id: str(program, "id"),
    seriesSlug: str(program, "series_slug"),
    seriesLabel: str(series, "series_label"),
    marketSlug: str(program, "market_slug"),
    marketLabel: str(market, "market_label"),
    publicSlug: str(program, "public_slug"),
    publicLabel: str(program, "public_label"),
    shortLabel: nullable(program, "short_label"),
    sourceFamilySlug: nullable(program, "source_family_slug"),
    periodType: nullable(program, "default_period_type"),
    methodologyVersion: nullable(program, "default_methodology_version"),
    eligibilityRulesVersion: nullable(program, "default_eligibility_rules_version"),
    latestEdition: archive[0] ? toEditionSummary(archive[0]) : null,
    archive: archive.slice(0, 6).map(toEditionSummary),
  };
}

function toEntry(entry: Entry) {
  return {
    id: entry.id,
    rank: entry.rank,
    previousRank: entry.previousRank,
    movement: entry.movement,
    trackSlug: entry.trackSlug,
    trackTitle: entry.trackTitle,
    artistNames: entry.artistNames ?? [],
    artistSlugs: entry.artistSlugs ?? [],
    artworkUrl: entry.artworkUrl,
    score: typeof entry.score === "number" ? entry.score : null,
    sourceEntryId: entry.id,
  };
}

function envelope(data: unknown, meta: Record<string, unknown> = {}) {
  return {
    data,
    meta: {
      apiVersion: "v2",
      generatedAt: new Date().toISOString(),
      source: "chart-v2-local-readonly-server",
      ...meta,
    },
  };
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=60, stale-while-revalidate=300",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body, null, 2));
}

function error(res: http.ServerResponse, status: number, code: string, message: string, meta: Record<string, unknown> = {}) {
  json(res, status, { code, message, status, meta });
}

function route(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== "GET") return error(res, 405, "method_not_allowed", "Only GET is supported.");
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const prefix = "/wp-json/wakilisha/v2";
  if (!url.pathname.startsWith(prefix)) return error(res, 404, "not_found", "Route not found.");
  const parts = url.pathname.slice(prefix.length).split("/").filter(Boolean).map(decodeURIComponent);

  if (parts.join("/") === "charts/health") {
    return json(res, 200, envelope({
      ok: true,
      plugin: "wakilisha-react-local-v2-api",
      version: "0.1.0",
      charts_public: true,
      charts_v2: true,
      counts: plan.counts,
      migrationReadiness: plan.migrationReadiness,
    }));
  }

  if (parts.length === 1 && parts[0] === "charts") {
    return json(res, 200, envelope({ programs: programs.map(toProgram) }, { count: programs.length }));
  }

  if (parts.length === 3 && parts[0] === "charts" && parts[1] === "resolve") {
    const resolved = resolveProgramSlug(parts[2]);
    const program = findProgram(parts[2]);
    if (!program) return error(res, 404, "chart_alias_not_found", "Chart alias not found.", { requestedSlug: parts[2] });
    return json(res, 200, envelope({ ...resolved, program: toProgram(program) }, resolved));
  }

  if (parts.length >= 2 && parts[0] === "charts") {
    const resolved = resolveProgramSlug(parts[1]);
    const program = findProgram(parts[1]);
    if (!program) return error(res, 404, "chart_program_not_found", "Chart program not found.", { requestedSlug: parts[1] });

    if (parts.length === 2) {
      return json(res, 200, envelope({ program: toProgram(program) }, resolved));
    }

    if (parts.length === 3 && parts[2] === "latest") {
      const edition = latestNonEmptyEdition(program);
      if (!edition) return error(res, 404, "chart_edition_not_found", "No non-empty latest edition found.", resolved);
      const entries = readEntries(program, str(edition, "edition_slug"));
      return json(res, 200, envelope({ program: toProgram(program), edition: toEditionSummary(edition), entries: entries.map(toEntry) }, resolved));
    }

    const editionSlug = parts[2];
    const edition = sortedEditionsForProgram(program).find((item) => item.edition_slug === editionSlug);
    if (!edition) return error(res, 404, "chart_edition_not_found", "Chart edition not found.", { ...resolved, editionSlug });
    const entries = readEntries(program, editionSlug);

    if (parts.length === 4 && parts[3] === "entries") {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? entries.length) || entries.length, 200);
      const offset = Number(url.searchParams.get("offset") ?? 0) || 0;
      return json(res, 200, envelope({ entries: entries.slice(offset, offset + limit).map(toEntry) }, { ...resolved, editionSlug, count: entries.length, limit, offset }));
    }

    const methodology = methodologiesByVersion.get(str(program, "default_methodology_version")) ?? null;
    const eligibilityRules = eligibilityByVersion.get(str(program, "default_eligibility_rules_version")) ?? null;
    const sourceCoverage = coverageByEdition.get(str(edition, "id")) ?? [];
    const warnings = entries.length === 0 ? ["This edition has no chart entries and is marked for content QA review."] : [];
    return json(res, 200, envelope({
      program: toProgram(program),
      edition: toEditionSummary(edition),
      entries: entries.map(toEntry),
      methodology,
      eligibilityRules,
      sourceCoverage,
    }, { ...resolved, editionSlug, warnings }));
  }

  if (parts.length === 4 && parts[0] === "tracks" && parts[2] === "chart-history") {
    const history = tracksIndex[parts[1]] ?? null;
    return json(res, 200, envelope({ history }, { trackSlug: parts[1] }));
  }

  return error(res, 404, "not_found", "Route not found.");
}

const server = http.createServer(route);
server.listen(port, () => {
  console.log(`WAKILISHA Chart V2 local read-only API listening on http://localhost:${port}/wp-json/wakilisha/v2`);
  console.log("Data source: reports/chart-v2-insert-plan.json + public/charts-data");
  console.log("No database writes. No public JSON mutation.");
});
