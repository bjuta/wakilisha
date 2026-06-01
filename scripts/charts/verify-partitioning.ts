import type { ChartEdition, ChartEditionEntry } from "../../src/services/chartsPublic/types";
import {
  CSV_PUBLIC_CHART_DATA,
  hasCsvPublicChartData,
  getCsvEntriesForEdition,
  getCsvEditionsForFamily,
} from "../../src/services/chartsPublic/csvData";
import {
  MOCK_EDITIONS,
  MOCK_ENTRIES,
  getMockEditionsForFamily,
  getMockEntriesForEdition,
} from "../../src/services/chartsPublic/mockData";

const usingCsv = hasCsvPublicChartData();
const EDITIONS: ChartEdition[] = usingCsv ? CSV_PUBLIC_CHART_DATA.editions : MOCK_EDITIONS;
const ENTRIES: ChartEditionEntry[] = usingCsv ? CSV_PUBLIC_CHART_DATA.entries : MOCK_ENTRIES;

function getEntriesForEdition(familySlug: string, editionSlug: string) {
  return usingCsv ? getCsvEntriesForEdition(familySlug, editionSlug) : getMockEntriesForEdition(familySlug, editionSlug);
}

function getEditionsForFamily(familySlug: string) {
  return usingCsv ? getCsvEditionsForFamily(familySlug) : getMockEditionsForFamily(familySlug);
}

function signature(entries: ChartEditionEntry[]) {
  return entries
    .slice(0, 10)
    .map((entry) => `${entry.rank}:${entry.trackTitle}:${entry.artistNames.join("/")}`)
    .join("|");
}

function topThree(entries: ChartEditionEntry[]) {
  return entries
    .slice(0, 3)
    .map((entry) => `#${entry.rank} ${entry.trackTitle} — ${entry.artistNames.join(", ")}`)
    .join("; ");
}

const errors: string[] = [];
const warnings: string[] = [];
const report: {
  family: string;
  edition: string;
  editionId: string;
  entryCount: number;
  uniqueEntryIds: number;
  top3: string;
}[] = [];

const duplicateEditionIds = EDITIONS.length - new Set(EDITIONS.map((edition) => edition.id)).size;
if (duplicateEditionIds > 0) {
  errors.push(`${duplicateEditionIds} duplicate edition IDs found in ${usingCsv ? "CSV" : "mock"} chart data`);
}

const duplicateEntryIds = ENTRIES.length - new Set(ENTRIES.map((entry) => entry.id)).size;
if (duplicateEntryIds > 0) {
  errors.push(`${duplicateEntryIds} duplicate entry IDs found in ${usingCsv ? "CSV" : "mock"} chart data`);
}

for (const edition of EDITIONS) {
  const familySlug = edition.familyId;
  const entries = getEntriesForEdition(familySlug, edition.slug);
  const uniqueEntryIds = new Set(entries.map((entry) => entry.id));

  if (entries.length !== uniqueEntryIds.size) {
    errors.push(`${familySlug}/${edition.slug}: duplicate entry IDs detected`);
  }

  const wrongEditionIds = entries.filter((entry) => entry.editionId !== edition.id);
  if (wrongEditionIds.length) {
    errors.push(`${familySlug}/${edition.slug}: ${wrongEditionIds.length} entries have the wrong editionId`);
  }

  if (entries.length !== edition.entryCount) {
    warnings.push(`${familySlug}/${edition.slug}: entryCount metadata=${edition.entryCount}, returned=${entries.length}`);
  }

  report.push({
    family: familySlug,
    edition: edition.slug,
    editionId: edition.id,
    entryCount: entries.length,
    uniqueEntryIds: uniqueEntryIds.size,
    top3: topThree(entries),
  });
}

const editionsByFamily = new Map<string, ChartEdition[]>();
for (const edition of EDITIONS) {
  const list = editionsByFamily.get(edition.familyId) ?? [];
  list.push(edition);
  editionsByFamily.set(edition.familyId, list);
}

for (const [familySlug, editions] of editionsByFamily) {
  const signatures = editions.map((edition) => ({
    edition,
    signature: signature(getEntriesForEdition(familySlug, edition.slug)),
  }));

  for (let i = 0; i < signatures.length; i += 1) {
    for (let j = i + 1; j < signatures.length; j += 1) {
      if (signatures[i].signature && signatures[i].signature === signatures[j].signature) {
        warnings.push(
          `${familySlug}: ${signatures[i].edition.slug} and ${signatures[j].edition.slug} have identical top-10 signatures; verify source data intentionally matches`
        );
      }
    }
  }
}

for (const familySlug of Array.from(editionsByFamily.keys())) {
  const editions = getEditionsForFamily(familySlug);
  for (const edition of editions) {
    const entries = getEntriesForEdition(familySlug, edition.slug);
    if (entries.some((entry) => entry.editionId !== edition.id)) {
      errors.push(`${familySlug}/${edition.slug}: route helper returned cross-edition entries`);
    }
  }
}

console.log(`\nWAKILISHA chart partitioning report (${usingCsv ? "CSV-backed public data" : "mock fallback"})`);
console.log(`Families: ${editionsByFamily.size}, editions: ${EDITIONS.length}, entries: ${ENTRIES.length}`);
console.table(report.slice(0, 80));
if (report.length > 80) {
  console.log(`… ${report.length - 80} more editions omitted from console table`);
}

if (warnings.length) {
  console.warn("\nWarnings:");
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (errors.length) {
  console.error("\nErrors:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`\nPASS: ${report.length} editions verified. Every returned entry belongs to its requested edition.`);
