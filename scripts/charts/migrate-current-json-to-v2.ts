import fs from "node:fs";
import path from "node:path";

type ChartFamily = {
  id: string;
  familyKey: string;
  label: string;
  description?: string;
  defaultChartSize?: number;
  slug?: string;
  sourceFamilySlug?: string;
  publicSlug?: string;
  publicLabel?: string;
  shortLabel?: string;
  seriesSlug?: string;
  seriesLabel?: string;
  marketSlug?: string;
  marketLabel?: string;
  chartMode?: "data" | "editorial" | "hybrid";
  periodType?: "weekly" | "monthly" | "yearly" | "evergreen";
  methodologyVersion?: string;
  eligibilityRulesVersion?: string;
  legacySlugs?: string[];
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

type Manifest = {
  generatedAt: string;
  sourceFiles: string[];
  totalFamilies: number;
  totalEditions: number;
  totalEntries: number;
};

type FamiliesPayload = { families: ChartFamily[] };
type EditionsPayload = { editions: ChartEdition[] };
type EntriesPayload = { entries: ChartEntry[] };

const root = process.cwd();
const chartsDir = path.join(root, "public/charts-data");
const reportsDir = path.join(root, "reports");
const jsonReportPath = path.join(reportsDir, "chart-v2-migration-preview.json");
const mdReportPath = path.join(reportsDir, "chart-v2-migration-preview.md");

const TAXONOMY: Record<string, {
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
}> = {
  kenya: {
    sourceFamilySlug: "kenya",
    seriesSlug: "top-songs",
    seriesLabel: "Top Songs",
    marketSlug: "kenya",
    marketLabel: "Kenya",
    publicSlug: "top-songs-kenya",
    publicLabel: "Top 100 Songs · Kenya",
    shortLabel: "Kenya Top 100",
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: "csv-registry-import-v1",
    eligibilityRulesVersion: "top-songs-kenya-v1",
    legacySlugs: ["kenya", "top-100-kenya", "kenya-top-100"],
  },
  rnb: {
    sourceFamilySlug: "rnb",
    seriesSlug: "rnb",
    seriesLabel: "R&B Songs",
    marketSlug: "kenya",
    marketLabel: "Kenya",
    publicSlug: "rnb-kenya",
    publicLabel: "R&B Songs · Kenya",
    shortLabel: "Kenyan R&B",
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: "csv-registry-import-v1",
    eligibilityRulesVersion: "rnb-kenya-v1",
    legacySlugs: ["rnb", "kenyan-rnb", "top-kenyan-rnb-songs"],
  },
  gengetone: {
    sourceFamilySlug: "gengetone",
    seriesSlug: "gengetone",
    seriesLabel: "Gengetone Songs",
    marketSlug: "kenya",
    marketLabel: "Kenya",
    publicSlug: "gengetone-kenya",
    publicLabel: "Gengetone Songs · Kenya",
    shortLabel: "Gengetone",
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: "csv-registry-import-v1",
    eligibilityRulesVersion: "gengetone-kenya-v1",
    legacySlugs: ["gengetone", "top-gengetone-songs"],
  },
  "2026": {
    sourceFamilySlug: "2026",
    seriesSlug: "2026-releases",
    seriesLabel: "2026 Releases",
    marketSlug: "kenya",
    marketLabel: "Kenya",
    publicSlug: "2026-releases-kenya",
    publicLabel: "2026 Releases · Kenya",
    shortLabel: "2026 Releases",
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: "csv-registry-import-v1",
    eligibilityRulesVersion: "2026-releases-kenya-v1",
    legacySlugs: ["2026", "top-kenyan-songs-released-in-2026"],
  },
};

function readJson<T>(relativePath: string): T {
  const fullPath = path.join(chartsDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required chart JSON file: ${fullPath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

function sourceFamilySlug(family: ChartFamily): string {
  return family.sourceFamilySlug || family.familyKey || family.slug || family.id;
}

function getTaxonomy(family: ChartFamily) {
  return TAXONOMY[sourceFamilySlug(family)] ?? null;
}

function entryFilePath(familySlug: string, editionSlug: string) {
  return `entries/${familySlug}/${editionSlug}.json`;
}

function readEntriesForEdition(familySlug: string, editionSlug: string): ChartEntry[] {
  const payload = readJson<EntriesPayload>(entryFilePath(familySlug, editionSlug));
  return payload.entries ?? [];
}

function findDuplicateRanks(entries: ChartEntry[]): number[] {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    counts.set(entry.rank, (counts.get(entry.rank) ?? 0) + 1);
  }
  return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([rank]) => rank).sort((a, b) => a - b);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

fs.mkdirSync(reportsDir, { recursive: true });

const manifest = readJson<Manifest>("manifest.json");
const familiesPayload = readJson<FamiliesPayload>("families.json");
const editionsPayload = readJson<EditionsPayload>("editions.json");

const families = familiesPayload.families ?? [];
const editions = editionsPayload.editions ?? [];
const familyBySource = new Map(families.map((family) => [sourceFamilySlug(family), family]));
const editionsByFamily = new Map<string, ChartEdition[]>();
for (const edition of editions) {
  const list = editionsByFamily.get(edition.familyId) ?? [];
  list.push(edition);
  editionsByFamily.set(edition.familyId, list);
}

const unmappedFamilies = families.filter((family) => !getTaxonomy(family)).map(sourceFamilySlug);
const programs = families.map((family) => {
  const taxonomy = getTaxonomy(family);
  return {
    sourceFamilySlug: sourceFamilySlug(family),
    seriesSlug: taxonomy?.seriesSlug ?? family.seriesSlug ?? sourceFamilySlug(family),
    seriesLabel: taxonomy?.seriesLabel ?? family.seriesLabel ?? family.label,
    marketSlug: taxonomy?.marketSlug ?? family.marketSlug ?? "unspecified",
    marketLabel: taxonomy?.marketLabel ?? family.marketLabel ?? "Unspecified",
    publicSlug: taxonomy?.publicSlug ?? family.publicSlug ?? family.slug ?? family.familyKey,
    publicLabel: taxonomy?.publicLabel ?? family.publicLabel ?? family.label,
    shortLabel: taxonomy?.shortLabel ?? family.shortLabel ?? family.label,
    chartMode: taxonomy?.chartMode ?? family.chartMode ?? "data",
    periodType: taxonomy?.periodType ?? family.periodType ?? "weekly",
    methodologyVersion: taxonomy?.methodologyVersion ?? family.methodologyVersion ?? "csv-registry-import-v1",
    eligibilityRulesVersion: taxonomy?.eligibilityRulesVersion ?? family.eligibilityRulesVersion ?? `${sourceFamilySlug(family)}-v1`,
    legacySlugs: taxonomy?.legacySlugs ?? family.legacySlugs ?? [sourceFamilySlug(family)],
  };
});

const emptyEditions: { family: string; edition: string; editionId: string }[] = [];
const duplicateRanksPerEdition: { family: string; edition: string; editionId: string; ranks: number[] }[] = [];
const entriesWithoutArtwork: { family: string; edition: string; entryId: string; rank: number; title: string; artist: string }[] = [];
const entriesWithoutTrackSlug: { family: string; edition: string; entryId: string; rank: number; title: string; artist: string }[] = [];
const latestEditionTop3PerProgram: Record<string, { edition: string; editionId: string; top3: { rank: number; title: string; artist: string }[] }> = {};

let entryCount = 0;
for (const [familySlug, familyEditions] of editionsByFamily.entries()) {
  const sortedEditions = familyEditions.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestEdition = sortedEditions[0];
  const family = familyBySource.get(familySlug);
  const program = family ? programs.find((item) => item.sourceFamilySlug === familySlug) : null;

  for (const edition of familyEditions) {
    const entries = readEntriesForEdition(familySlug, edition.slug);
    entryCount += entries.length;

    if (entries.length === 0) {
      emptyEditions.push({ family: familySlug, edition: edition.slug, editionId: edition.id });
    }

    const duplicateRanks = findDuplicateRanks(entries);
    if (duplicateRanks.length) {
      duplicateRanksPerEdition.push({ family: familySlug, edition: edition.slug, editionId: edition.id, ranks: duplicateRanks });
    }

    for (const entry of entries) {
      const artist = entry.artistNames?.join(", ") || "Unknown artist";
      if (!entry.artworkUrl) {
        entriesWithoutArtwork.push({ family: familySlug, edition: edition.slug, entryId: entry.id, rank: entry.rank, title: entry.trackTitle, artist });
      }
      if (!entry.trackSlug) {
        entriesWithoutTrackSlug.push({ family: familySlug, edition: edition.slug, entryId: entry.id, rank: entry.rank, title: entry.trackTitle, artist });
      }
    }
  }

  if (latestEdition && program) {
    const entries = readEntriesForEdition(familySlug, latestEdition.slug).slice().sort((a, b) => a.rank - b.rank);
    latestEditionTop3PerProgram[program.publicSlug] = {
      edition: latestEdition.slug,
      editionId: latestEdition.id,
      top3: entries.slice(0, 3).map((entry) => ({
        rank: entry.rank,
        title: entry.trackTitle,
        artist: entry.artistNames?.join(", ") || "Unknown artist",
      })),
    };
  }
}

const aliases = programs.flatMap((program) =>
  unique([program.sourceFamilySlug, ...program.legacySlugs]).map((legacySlug) => ({
    legacySlug,
    canonicalSlug: program.publicSlug,
    entityType: "chart_program",
    redirectStatus: legacySlug === program.publicSlug ? "deprecated" : "active",
  }))
);

const preview = {
  generatedAt: new Date().toISOString(),
  mode: "preview-only-no-db-writes",
  source: {
    manifest,
    familyCount: families.length,
    editionCount: editions.length,
    entryCount,
  },
  target: {
    seriesCount: unique(programs.map((program) => program.seriesSlug)).length,
    marketCount: unique(programs.map((program) => program.marketSlug)).length,
    programCount: programs.length,
    editionCount: editions.length,
    entryCount,
    aliasCount: aliases.length,
  },
  programs,
  aliases,
  validation: {
    unmappedFamilies,
    emptyEditions,
    duplicateRanksPerEdition,
    entriesWithoutArtwork: {
      count: entriesWithoutArtwork.length,
      sample: entriesWithoutArtwork.slice(0, 50),
    },
    entriesWithoutTrackSlug: {
      count: entriesWithoutTrackSlug.length,
      sample: entriesWithoutTrackSlug.slice(0, 50),
    },
    latestEditionTop3PerProgram,
  },
};

fs.writeFileSync(jsonReportPath, JSON.stringify(preview, null, 2));

const md = `# Chart V2 Migration Preview

Generated: ${preview.generatedAt}

Mode: **${preview.mode}**

## Source counts

| Metric | Count |
| --- | ---: |
| Families | ${preview.source.familyCount} |
| Editions | ${preview.source.editionCount} |
| Entries | ${preview.source.entryCount} |
| Manifest entries | ${manifest.totalEntries} |

## Target counts

| Metric | Count |
| --- | ---: |
| Series | ${preview.target.seriesCount} |
| Markets | ${preview.target.marketCount} |
| Programs | ${preview.target.programCount} |
| Editions | ${preview.target.editionCount} |
| Entries | ${preview.target.entryCount} |
| Aliases | ${preview.target.aliasCount} |

## Programs

| Source family | Series | Market | Public slug | Public label |
| --- | --- | --- | --- | --- |
${programs.map((program) => `| ${program.sourceFamilySlug} | ${program.seriesSlug} | ${program.marketSlug} | ${program.publicSlug} | ${program.publicLabel} |`).join("\n")}

## Validation

- Unmapped families: ${unmappedFamilies.length ? unmappedFamilies.join(", ") : "None"}
- Empty editions: ${emptyEditions.length}
- Editions with duplicate ranks: ${duplicateRanksPerEdition.length}
- Entries without artwork: ${entriesWithoutArtwork.length}
- Entries without trackSlug: ${entriesWithoutTrackSlug.length}

## Latest edition top 3 per program

${Object.entries(latestEditionTop3PerProgram).map(([publicSlug, data]) => `### ${publicSlug}\n\nEdition: ${data.edition}\n\n${data.top3.map((entry) => `- #${entry.rank} ${entry.title} — ${entry.artist}`).join("\n") || "No entries"}`).join("\n\n")}

## Notes

This report is preview-only. It does not write to the database, mutate public JSON assets, alter routes, or change existing content.
`;

fs.writeFileSync(mdReportPath, md);

console.log("Chart V2 migration preview generated");
console.log(`JSON: ${path.relative(root, jsonReportPath)}`);
console.log(`Markdown: ${path.relative(root, mdReportPath)}`);
console.log(`Families: ${families.length}, series: ${preview.target.seriesCount}, markets: ${preview.target.marketCount}, programs: ${programs.length}`);
console.log(`Editions: ${editions.length}, entries: ${entryCount}, aliases: ${aliases.length}`);
if (unmappedFamilies.length) console.warn(`Unmapped families: ${unmappedFamilies.join(", ")}`);
if (emptyEditions.length) console.warn(`Empty editions: ${emptyEditions.length}`);
if (duplicateRanksPerEdition.length) console.warn(`Duplicate-rank editions: ${duplicateRanksPerEdition.length}`);
