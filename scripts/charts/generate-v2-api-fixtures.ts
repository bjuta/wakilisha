import fs from "node:fs";
import path from "node:path";

type InsertPlan = {
  generatedAt: string;
  migrationReadiness: "ready" | "ready_with_warnings" | "blocked";
  counts: Record<string, number>;
  inserts: {
    series: Record<string, unknown>[];
    markets: Record<string, unknown>[];
    programs: Record<string, unknown>[];
    methodologies: Record<string, unknown>[];
    eligibilityRules: Record<string, unknown>[];
    editions: Record<string, unknown>[];
    sourceCoverage: Record<string, unknown>[];
    slugAliases: Record<string, unknown>[];
    entrySamples?: Record<string, unknown>[];
  };
};

type ChartEntry = {
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

type EntriesPayload = { entries: ChartEntry[] };

type ApiProgram = {
  id: string;
  seriesSlug: string;
  seriesLabel: string;
  marketSlug: string;
  marketLabel: string;
  publicSlug: string;
  publicLabel: string;
  shortLabel: string | null;
  sourceFamilySlug: string | null;
  periodType: string | null;
  methodologyVersion: string | null;
  eligibilityRulesVersion: string | null;
  latestEdition: ApiEditionSummary | null;
  archive: ApiEditionSummary[];
};

type ApiEditionSummary = {
  id: string;
  slug: string;
  label: string;
  date: string;
  periodStart: string | null;
  periodEnd: string | null;
  entryCount: number;
};

type ApiEntry = {
  id: string;
  rank: number;
  previousRank: number | null;
  movement: string;
  trackSlug: string | null;
  trackTitle: string;
  artistNames: string[];
  artistSlugs: string[];
  artworkUrl: string | null;
  score: number | null;
};

const root = process.cwd();
const reportsDir = path.join(root, "reports");
const chartsDir = path.join(root, "public/charts-data");
const insertPlanPath = path.join(reportsDir, "chart-v2-insert-plan.json");
const fixturesJsonPath = path.join(reportsDir, "chart-v2-api-fixtures.json");
const fixturesMdPath = path.join(reportsDir, "chart-v2-api-fixtures.md");

function readJsonFile<T>(filepath: string): T {
  if (!fs.existsSync(filepath)) throw new Error(`Missing required file: ${filepath}`);
  return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
}

function value<T = string>(row: Record<string, unknown>, key: string): T {
  return row[key] as T;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return asString(value);
}

function readEntries(sourceFamilySlug: string, editionSlug: string): ChartEntry[] {
  const filepath = path.join(chartsDir, "entries", sourceFamilySlug, `${editionSlug}.json`);
  if (!fs.existsSync(filepath)) return [];
  return (readJsonFile<EntriesPayload>(filepath).entries ?? []).slice().sort((a, b) => a.rank - b.rank);
}

function toEntry(entry: ChartEntry): ApiEntry {
  return {
    id: entry.id,
    rank: entry.rank,
    previousRank: entry.previousRank,
    movement: entry.movement,
    trackSlug: entry.trackSlug ?? null,
    trackTitle: entry.trackTitle,
    artistNames: entry.artistNames ?? [],
    artistSlugs: entry.artistSlugs ?? [],
    artworkUrl: entry.artworkUrl ?? null,
    score: typeof entry.score === "number" ? entry.score : null,
  };
}

function toEditionSummary(edition: Record<string, unknown>): ApiEditionSummary {
  return {
    id: asString(edition.id),
    slug: asString(edition.edition_slug),
    label: asString(edition.edition_label),
    date: asString(edition.edition_date),
    periodStart: asNullableString(edition.period_start),
    periodEnd: asNullableString(edition.period_end),
    entryCount: Number(edition.entry_count ?? 0),
  };
}

fs.mkdirSync(reportsDir, { recursive: true });

const plan = readJsonFile<InsertPlan>(insertPlanPath);
if (plan.migrationReadiness === "blocked") {
  throw new Error("Cannot generate V2 API fixtures because insert plan is blocked.");
}

const editionsByProgram = new Map<string, Record<string, unknown>[]>();
for (const edition of plan.inserts.editions) {
  const programId = asString(edition.program_id);
  const list = editionsByProgram.get(programId) ?? [];
  list.push(edition);
  editionsByProgram.set(programId, list);
}

for (const list of editionsByProgram.values()) {
  list.sort((a, b) => Date.parse(asString(b.edition_date)) - Date.parse(asString(a.edition_date)));
}

const seriesBySlug = new Map(plan.inserts.series.map((row) => [asString(row.series_slug), row]));
const marketBySlug = new Map(plan.inserts.markets.map((row) => [asString(row.market_slug), row]));
const methodologiesByVersion = new Map(plan.inserts.methodologies.map((row) => [asString(row.methodology_version), row]));
const eligibilityByVersion = new Map(plan.inserts.eligibilityRules.map((row) => [asString(row.eligibility_version), row]));

const programs: ApiProgram[] = plan.inserts.programs.map((program) => {
  const programId = asString(program.id);
  const editions = editionsByProgram.get(programId) ?? [];
  const latest = editions[0];
  const series = seriesBySlug.get(asString(program.series_slug));
  const market = marketBySlug.get(asString(program.market_slug));
  return {
    id: programId,
    seriesSlug: asString(program.series_slug),
    seriesLabel: asString(series?.series_label ?? program.series_slug),
    marketSlug: asString(program.market_slug),
    marketLabel: asString(market?.market_label ?? program.market_slug),
    publicSlug: asString(program.public_slug),
    publicLabel: asString(program.public_label),
    shortLabel: asNullableString(program.short_label),
    sourceFamilySlug: asNullableString(program.source_family_slug),
    periodType: asNullableString(program.default_period_type),
    methodologyVersion: asNullableString(program.default_methodology_version),
    eligibilityRulesVersion: asNullableString(program.default_eligibility_rules_version),
    latestEdition: latest ? toEditionSummary(latest) : null,
    archive: editions.slice(0, 6).map(toEditionSummary),
  };
});

const latestExamples = programs.map((program) => {
  const latest = program.latestEdition;
  const entries = latest && program.sourceFamilySlug ? readEntries(program.sourceFamilySlug, latest.slug) : [];
  return {
    endpoint: `/wp-json/wakilisha/v2/charts/${program.publicSlug}/latest`,
    program,
    edition: latest,
    entries: entries.slice(0, 10).map(toEntry),
  };
});

const specificEditionExamples = programs.map((program) => {
  const archive = editionsByProgram.get(program.id) ?? [];
  const edition = archive[0];
  const editionSummary = edition ? toEditionSummary(edition) : null;
  const entries = editionSummary && program.sourceFamilySlug ? readEntries(program.sourceFamilySlug, editionSummary.slug) : [];
  return {
    endpoint: editionSummary ? `/wp-json/wakilisha/v2/charts/${program.publicSlug}/${editionSummary.slug}` : `/wp-json/wakilisha/v2/charts/${program.publicSlug}/{editionSlug}`,
    program,
    edition: editionSummary,
    entries: entries.slice(0, 10).map(toEntry),
  };
});

const aliasExamples = plan.inserts.slugAliases.slice(0, 20).map((alias) => ({
  legacySlug: value(alias, "legacy_slug"),
  canonicalSlug: value(alias, "canonical_slug"),
  entityType: value(alias, "entity_type"),
  redirectStatus: value(alias, "redirect_status"),
}));

const fixtures = {
  generatedAt: new Date().toISOString(),
  mode: "public-api-fixtures-no-db-writes",
  sourceInsertPlan: path.relative(root, insertPlanPath),
  endpoints: {
    listPrograms: "/wp-json/wakilisha/v2/charts",
    getProgram: "/wp-json/wakilisha/v2/charts/{programSlug}",
    getLatestEdition: "/wp-json/wakilisha/v2/charts/{programSlug}/latest",
    getEdition: "/wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}",
    getEditionEntries: "/wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}/entries",
    resolveAlias: "/wp-json/wakilisha/v2/charts/resolve/{slug}",
  },
  counts: {
    programs: programs.length,
    editions: plan.counts.editions,
    entries: plan.counts.entries,
    aliases: plan.counts.slugAliases,
  },
  responses: {
    listPrograms: {
      data: programs,
      meta: { count: programs.length },
    },
    latestExamples,
    specificEditionExamples,
    aliasExamples,
    methodologyExamples: Array.from(methodologiesByVersion.values()),
    eligibilityExamples: Array.from(eligibilityByVersion.values()),
  },
};

const md = `# Chart V2 Public API Fixtures

Generated: ${fixtures.generatedAt}

Mode: **${fixtures.mode}**

Source insert plan: \`${fixtures.sourceInsertPlan}\`

## Endpoint contract

| Name | Endpoint |
| --- | --- |
${Object.entries(fixtures.endpoints).map(([name, endpoint]) => `| ${name} | \`${endpoint}\` |`).join("\n")}

## Fixture counts

| Item | Count |
| --- | ---: |
| Programs | ${fixtures.counts.programs} |
| Editions | ${fixtures.counts.editions} |
| Entries | ${fixtures.counts.entries} |
| Aliases | ${fixtures.counts.aliases} |

## Programs

| Public slug | Label | Series | Market | Latest edition |
| --- | --- | --- | --- | --- |
${programs.map((program) => `| ${program.publicSlug} | ${program.publicLabel} | ${program.seriesSlug} | ${program.marketSlug} | ${program.latestEdition?.slug ?? "None"} |`).join("\n")}

## Latest endpoint examples

${latestExamples.map((example) => `### ${example.endpoint}\n\n- Program: ${example.program.publicLabel}\n- Latest edition: ${example.edition?.slug ?? "None"}\n- Sample entries: ${example.entries.length}\n- #1: ${example.entries[0] ? `${example.entries[0].trackTitle} — ${example.entries[0].artistNames.join(", ")}` : "None"}`).join("\n\n")}

## Safety note

This fixture generator does not write to the database and does not change public chart JSON. It produces small API response examples for backend and frontend contract alignment before the V2 API is implemented.
`;

fs.writeFileSync(fixturesJsonPath, JSON.stringify(fixtures, null, 2));
fs.writeFileSync(fixturesMdPath, md);

console.log("Chart V2 public API fixtures generated");
console.log(`JSON: ${path.relative(root, fixturesJsonPath)}`);
console.log(`Markdown: ${path.relative(root, fixturesMdPath)}`);
console.log(`Programs: ${programs.length}, editions: ${plan.counts.editions}, entries: ${plan.counts.entries}, aliases: ${plan.counts.slugAliases}`);
