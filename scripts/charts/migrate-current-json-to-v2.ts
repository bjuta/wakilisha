import fs from "node:fs";
import path from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type FindingSeverity = "blocker" | "warning" | "info";
type FindingCategory =
  | "migration_integrity"
  | "content_qa"
  | "editorial_review"
  | "taxonomy"
  | "asset_quality"
  | "route_alias"
  | "source_provenance";

type Finding = {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  affectedCount: number;
  sample?: unknown[];
  recommendedAction: string;
};

type MigrationReadiness = "ready" | "ready_with_warnings" | "blocked";

// ─── Taxonomy ─────────────────────────────────────────────────────────────────

const TAXONOMY: Record<
  string,
  {
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
  }
> = {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const root = process.cwd();
const chartsDir = path.join(root, "public/charts-data");
const reportsDir = path.join(root, "reports");
const jsonReportPath = path.join(reportsDir, "chart-v2-migration-preview.json");
const mdReportPath = path.join(reportsDir, "chart-v2-migration-preview.md");

function readJson<T>(relativePath: string): T {
  const fullPath = path.join(chartsDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required chart JSON file: ${fullPath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

function sourceFamilySlug(family: ChartFamily): string {
  return family.sourceFamilySlug ?? family.familyKey ?? family.slug ?? family.id;
}

function getTaxonomy(family: ChartFamily) {
  return TAXONOMY[sourceFamilySlug(family)] ?? null;
}

function entryFilePath(familySlug: string, editionSlug: string) {
  return `entries/${familySlug}/${editionSlug}.json`;
}

function readEntriesForEdition(familySlug: string, editionSlug: string): ChartEntry[] {
  const rel = entryFilePath(familySlug, editionSlug);
  const full = path.join(chartsDir, rel);
  if (!fs.existsSync(full)) return [];
  const payload = JSON.parse(fs.readFileSync(full, "utf8")) as EntriesPayload;
  return payload.entries ?? [];
}

function findDuplicateRanks(entries: ChartEntry[]): number[] {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    counts.set(entry.rank, (counts.get(entry.rank) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([rank]) => rank)
    .sort((a, b) => a - b);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function top10Signature(entries: ChartEntry[]): string {
  return entries
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10)
    .map((e) => e.trackTitle)
    .join("|");
}

// ─── Load data ────────────────────────────────────────────────────────────────

fs.mkdirSync(reportsDir, { recursive: true });

const manifest = readJson<Manifest>("manifest.json");
const familiesPayload = readJson<FamiliesPayload>("families.json");
const editionsPayload = readJson<EditionsPayload>("editions.json");

const families = familiesPayload.families ?? [];
const editions = editionsPayload.editions ?? [];
const familyBySource = new Map(families.map((f) => [sourceFamilySlug(f), f]));
const editionsByFamily = new Map<string, ChartEdition[]>();

for (const edition of editions) {
  const list = editionsByFamily.get(edition.familyId) ?? [];
  list.push(edition);
  editionsByFamily.set(edition.familyId, list);
}

// ─── Build programs & aliases ─────────────────────────────────────────────────

const programs = families.map((family) => {
  const tax = getTaxonomy(family);
  return {
    sourceFamilySlug: sourceFamilySlug(family),
    seriesSlug: tax?.seriesSlug ?? family.seriesSlug ?? sourceFamilySlug(family),
    seriesLabel: tax?.seriesLabel ?? family.seriesLabel ?? family.label,
    marketSlug: tax?.marketSlug ?? family.marketSlug ?? "unspecified",
    marketLabel: tax?.marketLabel ?? family.marketLabel ?? "Unspecified",
    publicSlug: tax?.publicSlug ?? family.publicSlug ?? family.slug ?? family.familyKey,
    publicLabel: tax?.publicLabel ?? family.publicLabel ?? family.label,
    shortLabel: tax?.shortLabel ?? family.shortLabel ?? family.label,
    chartMode: tax?.chartMode ?? family.chartMode ?? "data",
    periodType: tax?.periodType ?? family.periodType ?? "weekly",
    methodologyVersion: tax?.methodologyVersion ?? family.methodologyVersion ?? "csv-registry-import-v1",
    eligibilityRulesVersion:
      tax?.eligibilityRulesVersion ?? family.eligibilityRulesVersion ?? `${sourceFamilySlug(family)}-v1`,
    legacySlugs: tax?.legacySlugs ?? family.legacySlugs ?? [sourceFamilySlug(family)],
  };
});

const aliases = programs.flatMap((p) =>
  unique([p.sourceFamilySlug, ...p.legacySlugs]).map((legacySlug) => ({
    legacySlug,
    canonicalSlug: p.publicSlug,
    entityType: "chart_program",
    redirectStatus: legacySlug === p.publicSlug ? "deprecated" : "active",
  }))
);

// ─── Scan editions & entries ──────────────────────────────────────────────────

type EmptyEditionRecord = { familySlug: string; editionSlug: string; editionId: string };
type DuplicateRankRecord = { familySlug: string; editionSlug: string; editionId: string; ranks: number[] };
type EntryQaRecord = { familySlug: string; editionSlug: string; entryId: string; rank: number; title: string; artist: string };

const emptyEditions: EmptyEditionRecord[] = [];
const duplicateRankEditions: DuplicateRankRecord[] = [];
const entriesWithoutArtwork: EntryQaRecord[] = [];
const entriesWithoutTrackSlug: EntryQaRecord[] = [];
const entriesWithPlaceholderArtwork: EntryQaRecord[] = [];
const top10Signatures = new Map<string, string[]>();

let totalEntryCount = 0;

const latestEditionTop3PerProgram: Record<
  string,
  { edition: string; editionId: string; top3: { rank: number; title: string; artist: string }[] }
> = {};

for (const [familySlug, familyEditions] of editionsByFamily.entries()) {
  const sortedEditions = familyEditions.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestEdition = sortedEditions[0];
  const family = familyBySource.get(familySlug);
  const program = family ? programs.find((p) => p.sourceFamilySlug === familySlug) : null;

  for (const edition of familyEditions) {
    const entries = readEntriesForEdition(familySlug, edition.slug);
    totalEntryCount += entries.length;

    // Blocker checks
    if (entries.length === 0) {
      emptyEditions.push({ familySlug, editionSlug: edition.slug, editionId: edition.id });
    }

    const dupeRanks = findDuplicateRanks(entries);
    if (dupeRanks.length > 0) {
      duplicateRankEditions.push({ familySlug, editionSlug: edition.slug, editionId: edition.id, ranks: dupeRanks });
    }

    // Warning checks
    for (const entry of entries) {
      const artist = entry.artistNames?.join(", ") || "Unknown artist";
      const rec: EntryQaRecord = { familySlug, editionSlug: edition.slug, entryId: entry.id, rank: entry.rank, title: entry.trackTitle, artist };

      if (!entry.artworkUrl) {
        entriesWithoutArtwork.push(rec);
      } else if (entry.artworkUrl.includes("placeholder") || entry.artworkUrl.includes("default") || entry.artworkUrl.includes("no-image")) {
        entriesWithPlaceholderArtwork.push(rec);
      }

      if (!entry.trackSlug) {
        entriesWithoutTrackSlug.push(rec);
      }
    }

    // Top-10 signature tracking (for repeated signature warning)
    if (entries.length >= 10) {
      const sig = top10Signature(entries);
      const key = familySlug;
      const existing = top10Signatures.get(key) ?? [];
      existing.push(`${edition.slug}:${sig}`);
      top10Signatures.set(key, existing);
    }
  }

  if (latestEdition && program) {
    const entries = readEntriesForEdition(familySlug, latestEdition.slug)
      .slice()
      .sort((a, b) => a.rank - b.rank);
    latestEditionTop3PerProgram[program.publicSlug] = {
      edition: latestEdition.slug,
      editionId: latestEdition.id,
      top3: entries.slice(0, 3).map((e) => ({
        rank: e.rank,
        title: e.trackTitle,
        artist: e.artistNames?.join(", ") || "Unknown artist",
      })),
    };
  }
}

// Detect repeated top-10 signatures
const repeatedTop10: { familySlug: string; repeatedEditions: string[] }[] = [];
for (const [familySlug, sigList] of top10Signatures.entries()) {
  const sigCounts = new Map<string, string[]>();
  for (const entry of sigList) {
    const [editionSlug, sig] = entry.split(/:(.+)/);
    const existing = sigCounts.get(sig) ?? [];
    existing.push(editionSlug);
    sigCounts.set(sig, existing);
  }
  const repeated = Array.from(sigCounts.values()).filter((v) => v.length > 1);
  if (repeated.length > 0) {
    repeatedTop10.push({ familySlug, repeatedEditions: repeated.flat() });
  }
}

// ─── Blocker: check manifest entry count vs loaded ───────────────────────────

const entryCountMismatch = totalEntryCount !== manifest.totalEntries;

// ─── Blocker: check unmapped families ────────────────────────────────────────

const unmappedFamilies = families.filter((f) => !getTaxonomy(f)).map(sourceFamilySlug);

// ─── Blocker: check duplicate publicSlugs ────────────────────────────────────

const publicSlugs = programs.map((p) => p.publicSlug);
const duplicatePublicSlugs = publicSlugs.filter((slug, i) => publicSlugs.indexOf(slug) !== i);

// ─── Blocker: check duplicate series+market pairs ────────────────────────────

const seriesMarketPairs = programs.map((p) => `${p.seriesSlug}::${p.marketSlug}`);
const duplicateSeriesMarketPairs = seriesMarketPairs.filter((pair, i) => seriesMarketPairs.indexOf(pair) !== i);

// ─── Alias: check legacy slugs that are already canonical ────────────────────

const canonicalSlugs = new Set(programs.map((p) => p.publicSlug));
const aliasesPointingToCanonical = aliases.filter(
  (a) => a.redirectStatus === "active" && canonicalSlugs.has(a.legacySlug)
);

// ─── Build findings ───────────────────────────────────────────────────────────

const findings: Finding[] = [];

// — BLOCKERS —

if (unmappedFamilies.length > 0) {
  findings.push({
    id: "BLOCK-001",
    severity: "blocker",
    category: "taxonomy",
    title: "Unmapped source families",
    description: `${unmappedFamilies.length} source family slug(s) have no V2 taxonomy mapping. These cannot be migrated without a series/market assignment.`,
    affectedCount: unmappedFamilies.length,
    sample: unmappedFamilies,
    recommendedAction: "Add taxonomy entries for each unmapped family slug before proceeding with migration.",
  });
}

if (duplicateRankEditions.length > 0) {
  findings.push({
    id: "BLOCK-002",
    severity: "blocker",
    category: "migration_integrity",
    title: "Duplicate ranks within editions",
    description: `${duplicateRankEditions.length} edition(s) contain entries with duplicate rank numbers. V2 schema enforces unique(edition_id, rank).`,
    affectedCount: duplicateRankEditions.length,
    sample: duplicateRankEditions.slice(0, 5),
    recommendedAction: "Repair source data to eliminate duplicate ranks before migration.",
  });
}

if (entryCountMismatch) {
  findings.push({
    id: "BLOCK-003",
    severity: "blocker",
    category: "migration_integrity",
    title: "Entry count mismatch between manifest and loaded entries",
    description: `Manifest declares ${manifest.totalEntries} entries but ${totalEntryCount} were loaded from JSON files. Data may be incomplete or corrupt.`,
    affectedCount: 1,
    sample: [{ manifestCount: manifest.totalEntries, loadedCount: totalEntryCount }],
    recommendedAction: "Regenerate public JSON or reconcile manifest with actual entry files.",
  });
}

if (duplicatePublicSlugs.length > 0) {
  findings.push({
    id: "BLOCK-004",
    severity: "blocker",
    category: "taxonomy",
    title: "Duplicate public slugs across programs",
    description: `${duplicatePublicSlugs.length} public slug(s) appear on more than one program. V2 schema requires unique public_slug per program.`,
    affectedCount: duplicatePublicSlugs.length,
    sample: duplicatePublicSlugs,
    recommendedAction: "Resolve slug conflicts before migration.",
  });
}

if (duplicateSeriesMarketPairs.length > 0) {
  findings.push({
    id: "BLOCK-005",
    severity: "blocker",
    category: "taxonomy",
    title: "Duplicate series+market program pairs",
    description: `${duplicateSeriesMarketPairs.length} series+market pair(s) appear more than once. V2 schema requires unique(series_slug, market_slug) per program.`,
    affectedCount: duplicateSeriesMarketPairs.length,
    sample: duplicateSeriesMarketPairs,
    recommendedAction: "Ensure each series+market combination maps to exactly one program.",
  });
}

// — WARNINGS —

if (emptyEditions.length > 0) {
  findings.push({
    id: "WARN-001",
    severity: "warning",
    category: "content_qa",
    title: "Empty editions found",
    description: `${emptyEditions.length} edition(s) have zero entries. These will migrate as empty placeholder editions unless excluded.`,
    affectedCount: emptyEditions.length,
    sample: emptyEditions,
    recommendedAction:
      "Confirm whether each empty edition is a valid draft/placeholder or should be excluded from public archive display. Known case: gengetone-2026-03-28.",
  });
}

if (entriesWithoutArtwork.length > 0) {
  findings.push({
    id: "WARN-002",
    severity: "warning",
    category: "asset_quality",
    title: "Entries missing artwork URL",
    description: `${entriesWithoutArtwork.length} entry/entries have no artwork_url. These will display without cover art in V2.`,
    affectedCount: entriesWithoutArtwork.length,
    sample: entriesWithoutArtwork.slice(0, 5),
    recommendedAction: "Enrich missing artwork before API cutover or implement a graceful fallback in the UI.",
  });
}

if (entriesWithoutTrackSlug.length > 0) {
  findings.push({
    id: "WARN-003",
    severity: "warning",
    category: "content_qa",
    title: "Entries missing track slug",
    description: `${entriesWithoutTrackSlug.length} entry/entries have no track_slug. These cannot be linked to the registry track graph in V2.`,
    affectedCount: entriesWithoutTrackSlug.length,
    sample: entriesWithoutTrackSlug.slice(0, 5),
    recommendedAction: "Resolve track slugs via slug matching or manual editorial assignment before migration.",
  });
}

if (entriesWithPlaceholderArtwork.length > 0) {
  findings.push({
    id: "WARN-004",
    severity: "warning",
    category: "asset_quality",
    title: "Entries with placeholder artwork",
    description: `${entriesWithPlaceholderArtwork.length} entry/entries have placeholder or default artwork URLs, which will appear visually broken.`,
    affectedCount: entriesWithPlaceholderArtwork.length,
    sample: entriesWithPlaceholderArtwork.slice(0, 5),
    recommendedAction: "Replace placeholder artwork with real cover art before API cutover.",
  });
}

if (repeatedTop10.length > 0) {
  const totalRepeatedEditions = repeatedTop10.reduce((sum, r) => sum + r.repeatedEditions.length, 0);
  findings.push({
    id: "WARN-005",
    severity: "warning",
    category: "editorial_review",
    title: "Repeated top-10 signatures across editions",
    description: `${repeatedTop10.length} chart(s) have editions where the top-10 ordering is identical to another edition. This may indicate duplicate or stale data, or normal consistency in a slow-moving chart.`,
    affectedCount: totalRepeatedEditions,
    sample: repeatedTop10.slice(0, 3),
    recommendedAction:
      "Review repeated top-10 editions to determine if the data reflects genuine chart stability or a data ingestion error.",
  });
}

if (aliasesPointingToCanonical.length > 0) {
  findings.push({
    id: "WARN-006",
    severity: "warning",
    category: "route_alias",
    title: "Legacy aliases pointing to already-canonical slugs",
    description: `${aliasesPointingToCanonical.length} alias(es) use a slug that is also a canonical public slug. These are redundant and can be omitted from the alias table.`,
    affectedCount: aliasesPointingToCanonical.length,
    sample: aliasesPointingToCanonical.slice(0, 5),
    recommendedAction: "Remove or mark deprecated any alias whose legacy_slug matches a canonical public_slug.",
  });
}

// — INFO —

findings.push({
  id: "INFO-001",
  severity: "info",
  category: "source_provenance",
  title: "Source family count",
  description: `${families.length} source chart family/families loaded from families.json.`,
  affectedCount: families.length,
  recommendedAction: "No action required.",
});

findings.push({
  id: "INFO-002",
  severity: "info",
  category: "taxonomy",
  title: "Target V2 series count",
  description: `${unique(programs.map((p) => p.seriesSlug)).length} distinct series slug(s) detected across all programs.`,
  affectedCount: unique(programs.map((p) => p.seriesSlug)).length,
  recommendedAction: "No action required.",
});

findings.push({
  id: "INFO-003",
  severity: "info",
  category: "taxonomy",
  title: "Target V2 market count",
  description: `${unique(programs.map((p) => p.marketSlug)).length} distinct market slug(s) detected across all programs.`,
  affectedCount: unique(programs.map((p) => p.marketSlug)).length,
  recommendedAction: "No action required.",
});

findings.push({
  id: "INFO-004",
  severity: "info",
  category: "taxonomy",
  title: "Program count",
  description: `${programs.length} V2 chart program(s) derived from source families.`,
  affectedCount: programs.length,
  recommendedAction: "No action required.",
});

findings.push({
  id: "INFO-005",
  severity: "info",
  category: "source_provenance",
  title: "Edition count",
  description: `${editions.length} chart edition(s) loaded from editions.json.`,
  affectedCount: editions.length,
  recommendedAction: "No action required.",
});

findings.push({
  id: "INFO-006",
  severity: "info",
  category: "source_provenance",
  title: "Entry count",
  description: `${totalEntryCount} chart entries loaded across all edition JSON files.`,
  affectedCount: totalEntryCount,
  recommendedAction: "No action required.",
});

findings.push({
  id: "INFO-007",
  severity: "info",
  category: "route_alias",
  title: "Alias count",
  description: `${aliases.length} chart_program aliases (legacy slug → canonical slug) derived.`,
  affectedCount: aliases.length,
  recommendedAction: "No action required.",
});

const uniqueMethodologyVersions = unique(programs.map((p) => p.methodologyVersion));
findings.push({
  id: "INFO-008",
  severity: "info",
  category: "source_provenance",
  title: "Methodology versions detected",
  description: `${uniqueMethodologyVersions.length} distinct methodology version(s): ${uniqueMethodologyVersions.join(", ")}.`,
  affectedCount: uniqueMethodologyVersions.length,
  sample: uniqueMethodologyVersions,
  recommendedAction: "No action required.",
});

const uniqueEligibilityVersions = unique(programs.map((p) => p.eligibilityRulesVersion));
findings.push({
  id: "INFO-009",
  severity: "info",
  category: "source_provenance",
  title: "Eligibility rule versions detected",
  description: `${uniqueEligibilityVersions.length} distinct eligibility rule version(s): ${uniqueEligibilityVersions.join(", ")}.`,
  affectedCount: uniqueEligibilityVersions.length,
  sample: uniqueEligibilityVersions,
  recommendedAction: "No action required.",
});

// ─── Compute readiness ────────────────────────────────────────────────────────

const blockerFindings = findings.filter((f) => f.severity === "blocker");
const warningFindings = findings.filter((f) => f.severity === "warning");
const infoFindings = findings.filter((f) => f.severity === "info");

let migrationReadiness: MigrationReadiness;
if (blockerFindings.length > 0) {
  migrationReadiness = "blocked";
} else if (warningFindings.length > 0) {
  migrationReadiness = "ready_with_warnings";
} else {
  migrationReadiness = "ready";
}

// ─── Build JSON report ────────────────────────────────────────────────────────

const report = {
  generatedAt: new Date().toISOString(),
  mode: "preview-only-no-db-writes",
  migrationReadiness,
  blockerCount: blockerFindings.length,
  warningCount: warningFindings.length,
  infoCount: infoFindings.length,
  source: {
    manifest,
    familyCount: families.length,
    editionCount: editions.length,
    entryCount: totalEntryCount,
  },
  target: {
    seriesCount: unique(programs.map((p) => p.seriesSlug)).length,
    marketCount: unique(programs.map((p) => p.marketSlug)).length,
    programCount: programs.length,
    editionCount: editions.length,
    entryCount: totalEntryCount,
    aliasCount: aliases.length,
  },
  programs,
  aliases,
  findings,
  latestEditionTop3PerProgram,
};

fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

// ─── Build Markdown report ────────────────────────────────────────────────────

const readinessLabel =
  migrationReadiness === "ready"
    ? "✅ READY"
    : migrationReadiness === "ready_with_warnings"
    ? "⚠️  READY WITH WARNINGS"
    : "🚫 BLOCKED";

const programTable = [
  "| Source family | Series | Market | Public slug | Public label | Methodology | Eligibility |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...programs.map(
    (p) =>
      `| ${p.sourceFamilySlug} | ${p.seriesSlug} | ${p.marketSlug} | ${p.publicSlug} | ${p.publicLabel} | ${p.methodologyVersion} | ${p.eligibilityRulesVersion} |`
  ),
].join("\n");

function renderBlockerSection(findings: Finding[]): string {
  if (findings.length === 0) return "No migration blockers found.\n";
  return findings
    .map(
      (f) =>
        `### ${f.id}: ${f.title}\n\n**Severity:** ${f.severity}  \n**Category:** ${f.category}  \n**Affected:** ${f.affectedCount}\n\n${f.description}\n\n**Recommended action:** ${f.recommendedAction}\n`
    )
    .join("\n");
}

function renderWarningSection(findings: Finding[]): string {
  if (findings.length === 0) return "No warnings found.\n";

  const byCategory = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byCategory.get(f.category) ?? [];
    list.push(f);
    byCategory.set(f.category, list);
  }

  const categoryLabels: Record<string, string> = {
    content_qa: "Content QA",
    asset_quality: "Asset Quality",
    editorial_review: "Editorial Review",
    route_alias: "Route Aliases",
    taxonomy: "Taxonomy",
    migration_integrity: "Migration Integrity",
    source_provenance: "Source Provenance",
  };

  const out: string[] = [];
  for (const [cat, catFindings] of byCategory.entries()) {
    out.push(`#### ${categoryLabels[cat] ?? cat}\n`);
    for (const f of catFindings) {
      out.push(`- **${f.id}** — ${f.title} *(${f.affectedCount} affected)*`);
      out.push(`  ${f.description}`);
      out.push(`  → ${f.recommendedAction}\n`);
    }
  }
  return out.join("\n");
}

const top3Section = Object.entries(latestEditionTop3PerProgram)
  .map(
    ([publicSlug, data]) =>
      `### ${publicSlug}\n\nEdition: \`${data.edition}\`\n\n${
        data.top3.map((e) => `- #${e.rank} ${e.title} — ${e.artist}`).join("\n") || "No entries"
      }`
  )
  .join("\n\n");

const md = `# Chart V2 Migration Preview

Generated: ${report.generatedAt}

Mode: **${report.mode}**

---

## Migration Readiness

**Status: ${readinessLabel}**

| Metric | Count |
| --- | ---: |
| Blockers | ${blockerFindings.length} |
| Warnings | ${warningFindings.length} |
| Info | ${infoFindings.length} |

---

## Source Counts

| Metric | Count |
| --- | ---: |
| Families | ${report.source.familyCount} |
| Editions | ${report.source.editionCount} |
| Entries (loaded) | ${report.source.entryCount} |
| Entries (manifest) | ${manifest.totalEntries} |

---

## Target V2 Counts

| Metric | Count |
| --- | ---: |
| Series | ${report.target.seriesCount} |
| Markets | ${report.target.marketCount} |
| Programs | ${report.target.programCount} |
| Editions | ${report.target.editionCount} |
| Entries | ${report.target.entryCount} |
| Aliases | ${report.target.aliasCount} |

---

## Program Mapping

${programTable}

---

## Blockers

${renderBlockerSection(blockerFindings)}

---

## Warnings

${renderWarningSection(warningFindings)}

---

## Latest Edition Top 3 per Program

${top3Section}

---

## Recommended Next Actions

1. Review the empty gengetone edition (\`gengetone-2026-03-28\`) — confirm whether it is a valid draft/placeholder or should be excluded from public archive display.
2. Decide whether repeated top-10 signatures across editions represent acceptable chart stability or a data ingestion error worth correcting.
3. Decide whether entries without artwork need enrichment before API cutover, or whether a graceful UI fallback is sufficient.
4. Proceed to dry-run V2 SQL insert planner only after blocker count remains zero.

---

*This report is preview-only. No database writes. No public chart JSON was modified. No routes were changed.*
`;

fs.writeFileSync(mdReportPath, md);

// ─── Console summary ──────────────────────────────────────────────────────────

const readinessBadge =
  migrationReadiness === "ready"
    ? "ready"
    : migrationReadiness === "ready_with_warnings"
    ? "ready_with_warnings"
    : "BLOCKED";

console.log("Chart V2 migration preview generated");
console.log(`Readiness: ${readinessBadge}`);
console.log(`Blockers: ${blockerFindings.length}`);
console.log(`Warnings: ${warningFindings.length}`);
console.log(`Info: ${infoFindings.length}`);
console.log(`JSON: ${path.relative(root, jsonReportPath)}`);
console.log(`Markdown: ${path.relative(root, mdReportPath)}`);
console.log(
  `Families: ${families.length}, series: ${report.target.seriesCount}, markets: ${report.target.marketCount}, programs: ${programs.length}`
);
console.log(`Editions: ${editions.length}, entries: ${totalEntryCount}, aliases: ${aliases.length}`);

if (blockerFindings.length > 0) {
  console.warn(`\n⚠️  BLOCKERS (${blockerFindings.length}):`);
  for (const f of blockerFindings) {
    console.warn(`  [${f.id}] ${f.title} — ${f.affectedCount} affected`);
  }
}
if (warningFindings.length > 0) {
  console.warn(`\n⚠️  WARNINGS (${warningFindings.length}):`);
  for (const f of warningFindings) {
    console.warn(`  [${f.id}] ${f.title} — ${f.affectedCount} affected`);
  }
}