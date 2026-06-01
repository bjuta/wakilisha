import fs from "node:fs";
import path from "node:path";

type ProgramPreview = {
  sourceFamilySlug: string;
  seriesSlug: string;
  seriesLabel: string;
  marketSlug: string;
  marketLabel: string;
  publicSlug: string;
  publicLabel: string;
  shortLabel: string;
  chartMode: "data" | "editorial" | "hybrid";
  periodType: "weekly" | "monthly" | "yearly" | "evergreen";
  methodologyVersion: string;
  eligibilityRulesVersion: string;
  legacySlugs: string[];
};

type PreviewReport = {
  generatedAt: string;
  mode: string;
  migrationReadiness: "ready" | "ready_with_warnings" | "blocked";
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  programs: ProgramPreview[];
  aliases: {
    legacySlug: string;
    canonicalSlug: string;
    entityType: string;
    redirectStatus: string;
  }[];
};

type ChartEdition = {
  id: string;
  familyId: string;
  slug: string;
  label: string;
  date: string;
  periodStart?: string;
  periodEnd?: string;
  status: "draft" | "published";
  entryCount: number;
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
  entryPayload?: Record<string, unknown>;
};

type EditionsPayload = { editions: ChartEdition[] };
type EntriesPayload = { entries: ChartEntry[] };

type InsertPlan = {
  generatedAt: string;
  mode: "dry-run-no-db-writes";
  sourcePreview: string;
  migrationReadiness: PreviewReport["migrationReadiness"];
  blocked: boolean;
  counts: Record<string, number>;
  inserts: {
    series: unknown[];
    markets: unknown[];
    programs: unknown[];
    methodologies: unknown[];
    eligibilityRules: unknown[];
    editions: unknown[];
    entries: unknown[];
    sourceCoverage: unknown[];
    slugAliases: unknown[];
  };
  warnings: string[];
};

const root = process.cwd();
const chartsDir = path.join(root, "public/charts-data");
const reportsDir = path.join(root, "reports");
const previewPath = path.join(reportsDir, "chart-v2-migration-preview.json");
const jsonPlanPath = path.join(reportsDir, "chart-v2-insert-plan.json");
const mdPlanPath = path.join(reportsDir, "chart-v2-insert-plan.md");
const sqlPlanPath = path.join(reportsDir, "chart-v2-inserts.sql");

function readJsonFile<T>(filepath: string): T {
  if (!fs.existsSync(filepath)) throw new Error(`Missing required file: ${filepath}`);
  return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
}

function readChartJson<T>(relativePath: string): T {
  return readJsonFile<T>(path.join(chartsDir, relativePath));
}

function safeId(prefix: string, value: string): string {
  return `${prefix}_${value}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sqlString(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

function sqlNumber(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "NULL";
}

function asDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : value;
}

function first<T>(items: T[]): T | undefined {
  return items[0];
}

fs.mkdirSync(reportsDir, { recursive: true });

const preview = readJsonFile<PreviewReport>(previewPath);
if (preview.migrationReadiness === "blocked") {
  throw new Error("Chart V2 insert plan refused: migration preview is blocked. Resolve blockers before planning inserts.");
}

const editionsPayload = readChartJson<EditionsPayload>("editions.json");
const editions = editionsPayload.editions ?? [];
const programsBySourceFamily = new Map(preview.programs.map((program) => [program.sourceFamilySlug, program]));
const programIdBySourceFamily = new Map(preview.programs.map((program) => [program.sourceFamilySlug, safeId("program", program.publicSlug)]));

const series = Array.from(
  new Map(
    preview.programs.map((program) => [
      program.seriesSlug,
      {
        id: safeId("series", program.seriesSlug),
        series_slug: program.seriesSlug,
        series_label: program.seriesLabel,
        description: `Chart series for ${program.seriesLabel}.`,
        chart_mode: program.chartMode,
      },
    ])
  ).values()
);

const markets = Array.from(
  new Map(
    preview.programs.map((program) => [
      program.marketSlug,
      {
        id: safeId("market", program.marketSlug),
        market_slug: program.marketSlug,
        market_label: program.marketLabel,
        market_type: program.marketSlug === "global" ? "global" : "country",
        country_code: program.marketSlug === "kenya" ? "KE" : null,
        parent_market_slug: null,
        timezone: program.marketSlug === "kenya" ? "Africa/Nairobi" : null,
        default_language: "en",
      },
    ])
  ).values()
);

const programs = preview.programs.map((program) => ({
  id: safeId("program", program.publicSlug),
  series_slug: program.seriesSlug,
  market_slug: program.marketSlug,
  public_slug: program.publicSlug,
  public_label: program.publicLabel,
  short_label: program.shortLabel,
  source_family_slug: program.sourceFamilySlug,
  default_period_type: program.periodType,
  default_methodology_version: program.methodologyVersion,
  default_eligibility_rules_version: program.eligibilityRulesVersion,
}));

const methodologies = Array.from(
  new Map(
    preview.programs.map((program) => [
      program.methodologyVersion,
      {
        id: safeId("methodology", program.methodologyVersion),
        methodology_version: program.methodologyVersion,
        label: program.methodologyVersion,
        description: "Imported WAKILISHA CSV/registry chart methodology placeholder. Replace with full formula before API cutover.",
        formula_payload: {
          mode: "csv_registry_import",
          version: program.methodologyVersion,
          note: "Dry-run insert planner preserves source ranking order. It does not recalculate rankings.",
        },
        source_weights_payload: {
          source: "public/charts-data",
          weighting: "preserved_rank_order",
        },
      },
    ])
  ).values()
);

const eligibilityRules = Array.from(
  new Map(
    preview.programs.map((program) => [
      program.eligibilityRulesVersion,
      {
        id: safeId("eligibility", program.eligibilityRulesVersion),
        eligibility_version: program.eligibilityRulesVersion,
        label: program.eligibilityRulesVersion,
        description: `Eligibility rules placeholder for ${program.publicLabel}.`,
        rules_payload: {
          sourceFamilySlug: program.sourceFamilySlug,
          seriesSlug: program.seriesSlug,
          marketSlug: program.marketSlug,
          note: "Dry-run placeholder. Formal eligibility rules must be authored before automated ingestion uses this version.",
        },
      },
    ])
  ).values()
);

const editionInserts: Record<string, unknown>[] = [];
const entryInserts: Record<string, unknown>[] = [];
const sourceCoverageInserts: Record<string, unknown>[] = [];
const warnings: string[] = [];

for (const edition of editions) {
  const programId = programIdBySourceFamily.get(edition.familyId);
  const program = programsBySourceFamily.get(edition.familyId);
  if (!programId || !program) {
    warnings.push(`Skipped edition ${edition.slug}: no program mapping for family ${edition.familyId}`);
    continue;
  }

  const editionId = safeId("edition", `${program.publicSlug}_${edition.slug}`);
  const entriesPath = `entries/${edition.familyId}/${edition.slug}.json`;
  const entriesPayload = readChartJson<EntriesPayload>(entriesPath);
  const entries = entriesPayload.entries ?? [];

  editionInserts.push({
    id: editionId,
    program_id: programId,
    source_edition_id: edition.id,
    edition_slug: edition.slug,
    edition_label: edition.label,
    edition_date: asDate(edition.date),
    period_start: asDate(edition.periodStart ?? edition.date),
    period_end: asDate(edition.periodEnd ?? edition.date),
    status: edition.status === "published" ? "published" : "draft",
    entry_count: entries.length,
    snapshot_id: null,
  });

  sourceCoverageInserts.push({
    id: safeId("coverage", `${editionId}_csv_registry_import`),
    edition_id: editionId,
    source_name: "WAKILISHA CSV Registry Import",
    coverage_status: entries.length > 0 ? "manual" : "unavailable",
    coverage_payload: {
      sourceFile: entriesPath,
      entryCount: entries.length,
      sourceFamilySlug: edition.familyId,
      methodologyVersion: program.methodologyVersion,
    },
  });

  for (const entry of entries) {
    const artistName = entry.artistNames?.join(", ") || "Unknown artist";
    entryInserts.push({
      id: safeId("entry", `${editionId}_${String(entry.rank).padStart(3, "0")}_${entry.id}`),
      edition_id: editionId,
      rank: entry.rank,
      previous_rank: entry.previousRank,
      movement: entry.movement,
      track_slug: entry.trackSlug ?? null,
      track_title: entry.trackTitle,
      artist_name: artistName,
      artist_slug: first(entry.artistSlugs ?? []) ?? null,
      artwork_url: entry.artworkUrl ?? null,
      source_entry_id: entry.id,
      raw_payload: {
        sourceEntry: entry,
        sourceFamilySlug: edition.familyId,
        sourceEditionSlug: edition.slug,
        sourceEditionId: edition.id,
        publicProgramSlug: program.publicSlug,
      },
    });
  }
}

const slugAliases = preview.aliases.map((alias) => ({
  id: safeId("alias", `${alias.entityType}_${alias.legacySlug}`),
  legacy_slug: alias.legacySlug,
  canonical_slug: alias.canonicalSlug,
  entity_type: alias.entityType,
  redirect_status: alias.redirectStatus,
}));

const plan: InsertPlan = {
  generatedAt: new Date().toISOString(),
  mode: "dry-run-no-db-writes",
  sourcePreview: path.relative(root, previewPath),
  migrationReadiness: preview.migrationReadiness,
  blocked: false,
  counts: {
    series: series.length,
    markets: markets.length,
    programs: programs.length,
    methodologies: methodologies.length,
    eligibilityRules: eligibilityRules.length,
    editions: editionInserts.length,
    entries: entryInserts.length,
    sourceCoverage: sourceCoverageInserts.length,
    slugAliases: slugAliases.length,
  },
  inserts: {
    series,
    markets,
    programs,
    methodologies,
    eligibilityRules,
    editions: editionInserts,
    entries: entryInserts,
    sourceCoverage: sourceCoverageInserts,
    slugAliases,
  },
  warnings,
};

function insertSql(table: string, rows: Record<string, unknown>[]): string {
  if (!rows.length) return `-- No rows for ${table}\n`;
  const columns = Object.keys(rows[0]);
  const values = rows
    .map((row) => {
      const cells = columns.map((column) => {
        const value = row[column];
        if (column.endsWith("payload") || column === "raw_payload" || column === "formula_payload" || column === "source_weights_payload" || column === "rules_payload" || column === "coverage_payload") return sqlJson(value ?? null);
        if (typeof value === "number") return sqlNumber(value);
        return sqlString(value);
      });
      return `(${cells.join(", ")})`;
    })
    .join(",\n");
  return `INSERT INTO ${table} (${columns.join(", ")})\nVALUES\n${values}\nON CONFLICT DO NOTHING;\n`;
}

const sql = [
  "-- WAKILISHA Chart V2 dry-run insert plan",
  "-- Generated for review only. Do not execute until content QA and DBA review are complete.",
  "-- This file is produced from public/charts-data and reports/chart-v2-migration-preview.json.",
  "BEGIN;",
  insertSql("wk_chart_series_v2", series),
  insertSql("wk_chart_markets_v2", markets),
  insertSql("wk_chart_programs_v2", programs),
  insertSql("wk_chart_methodologies_v2", methodologies),
  insertSql("wk_chart_eligibility_rules_v2", eligibilityRules),
  insertSql("wk_chart_editions_v2", editionInserts),
  insertSql("wk_chart_entries_v2", entryInserts),
  insertSql("wk_chart_source_coverage_v2", sourceCoverageInserts),
  insertSql("wk_chart_slug_aliases_v2", slugAliases),
  "ROLLBACK;",
  "-- ROLLBACK is intentional. This is a review artifact, not an executable migration.",
].join("\n\n");

const md = `# Chart V2 Dry-Run Insert Plan

Generated: ${plan.generatedAt}

Mode: **${plan.mode}**

Source preview: \`${plan.sourcePreview}\`

Migration readiness: **${plan.migrationReadiness}**

## Planned insert counts

| Table | Rows |
| --- | ---: |
| wk_chart_series_v2 | ${plan.counts.series} |
| wk_chart_markets_v2 | ${plan.counts.markets} |
| wk_chart_programs_v2 | ${plan.counts.programs} |
| wk_chart_methodologies_v2 | ${plan.counts.methodologies} |
| wk_chart_eligibility_rules_v2 | ${plan.counts.eligibilityRules} |
| wk_chart_editions_v2 | ${plan.counts.editions} |
| wk_chart_entries_v2 | ${plan.counts.entries} |
| wk_chart_source_coverage_v2 | ${plan.counts.sourceCoverage} |
| wk_chart_slug_aliases_v2 | ${plan.counts.slugAliases} |

## Programs

| Program ID | Public slug | Public label | Series | Market | Source family |
| --- | --- | --- | --- | --- | --- |
${programs.map((program) => `| ${program.id} | ${program.public_slug} | ${program.public_label} | ${program.series_slug} | ${program.market_slug} | ${program.source_family_slug ?? ""} |`).join("\n")}

## Methodology versions

${methodologies.map((methodology) => `- ${methodology.methodology_version}`).join("\n")}

## Eligibility rule versions

${eligibilityRules.map((rule) => `- ${rule.eligibility_version}`).join("\n")}

## Warnings

${warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "No planner warnings."}

## Generated artifacts

- \`reports/chart-v2-insert-plan.json\`
- \`reports/chart-v2-insert-plan.md\`
- \`reports/chart-v2-inserts.sql\`

## Safety note

This planner does not write to the database. The generated SQL is wrapped in \`BEGIN; ... ROLLBACK;\` and is intended for review only. Do not remove the rollback or execute inserts until the V2 preview has zero blockers and content QA has approved warnings.
`;

fs.writeFileSync(jsonPlanPath, JSON.stringify(plan, null, 2));
fs.writeFileSync(mdPlanPath, md);
fs.writeFileSync(sqlPlanPath, sql);

console.log("Chart V2 dry-run insert plan generated");
console.log(`Readiness: ${plan.migrationReadiness}`);
console.log(`JSON: ${path.relative(root, jsonPlanPath)}`);
console.log(`Markdown: ${path.relative(root, mdPlanPath)}`);
console.log(`SQL: ${path.relative(root, sqlPlanPath)}`);
console.log(`Series: ${plan.counts.series}, markets: ${plan.counts.markets}, programs: ${plan.counts.programs}`);
console.log(`Editions: ${plan.counts.editions}, entries: ${plan.counts.entries}, aliases: ${plan.counts.slugAliases}`);
if (warnings.length) console.warn(`Planner warnings: ${warnings.length}`);
