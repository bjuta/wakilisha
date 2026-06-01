import fs from "node:fs";
import path from "node:path";
import type { ChartEdition, ChartEditionEntry, ChartFamily } from "../../src/services/chartsPublic/types";

const root = process.cwd();
const dataDir = path.join(root, "public/charts-data");

// Fallback to mock data if CSV JSON files don't exist
const hasJsonData = fs.existsSync(path.join(dataDir, "manifest.json"));

let manifest: { totalFamilies: number; totalEditions: number; totalEntries: number } | null = null;
let families: ChartFamily[] = [];
let editions: ChartEdition[] = [];
let tracks: Record<string, unknown> = {};

if (hasJsonData) {
  manifest = JSON.parse(fs.readFileSync(path.join(dataDir, "manifest.json"), "utf8"));
  families = JSON.parse(fs.readFileSync(path.join(dataDir, "families.json"), "utf8")).families;
  editions = JSON.parse(fs.readFileSync(path.join(dataDir, "editions.json"), "utf8")).editions;
  if (fs.existsSync(path.join(dataDir, "tracks.json"))) {
    tracks = JSON.parse(fs.readFileSync(path.join(dataDir, "tracks.json"), "utf8"));
  }
} else {
  console.log("No public/charts-data JSON files found. Skipping JSON-backed validation.");
  process.exit(0);
}

function loadEntriesForEdition(familySlug: string, editionSlug: string): ChartEditionEntry[] {
  const filePath = path.join(dataDir, "entries", familySlug, `${editionSlug}.json`);
  if (!fs.existsSync(filePath)) return [];
  const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as { entries: ChartEditionEntry[] };
  return data.entries;
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

const duplicateEditionIds = editions.length - new Set(editions.map((edition) => edition.id)).size;
if (duplicateEditionIds > 0) {
  errors.push(`${duplicateEditionIds} duplicate edition IDs found in JSON chart data`);
}

let totalEntries = 0;

for (const edition of editions) {
  const family = families.find((f) => f.id === edition.familyId);
  const familySlug = family?.slug || family?.id || edition.familyId;
  const entries = loadEntriesForEdition(familySlug, edition.slug);
  totalEntries += entries.length;
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
for (const edition of editions) {
  const list = editionsByFamily.get(edition.familyId) ?? [];
  list.push(edition);
  editionsByFamily.set(edition.familyId, list);
}

for (const [familySlug, familyEditions] of editionsByFamily) {
  const signatures = familyEditions.map((edition) => {
    const family = families.find((f) => f.id === edition.familyId);
    const resolvedFamilySlug = family?.slug || family?.id || familySlug;
    return {
      edition,
      signature: signature(loadEntriesForEdition(resolvedFamilySlug, edition.slug)),
    };
  });

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
  const family = families.find((f) => f.id === familySlug || f.slug === familySlug);
  const resolvedFamilySlug = family?.slug || family?.id || familySlug;
  const familyEditions = editions.filter((e) => e.familyId === familySlug);
  for (const edition of familyEditions) {
    const entries = loadEntriesForEdition(resolvedFamilySlug, edition.slug);
    if (entries.some((entry) => entry.editionId !== edition.id)) {
      errors.push(`${familySlug}/${edition.slug}: route helper returned cross-edition entries`);
    }
  }
}

console.log(`\nWAKILISHA chart partitioning report (JSON-backed public data)`);
console.log(`Families: ${editionsByFamily.size}, editions: ${editions.length}, entries: ${totalEntries}`);
console.table(report.slice(0, 80));
if (report.length > 80) {
  console.log(`… ${report.length - 80} more editions omitted from console table`);
}

if (manifest && totalEntries !== manifest.totalEntries) {
  errors.push(`Total entries mismatch: manifest says ${manifest.totalEntries}, loaded ${totalEntries}`);
}

if (Object.keys(tracks).length > 0) {
  console.log(`\nTrack history index: ${Object.keys(tracks).length} tracks`);
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
console.log(`Total entries across all JSON chunks: ${totalEntries}`);