import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { ChartEdition, ChartEditionEntry, ChartFamily } from "../../src/services/chartsPublic/types";
import discovery from "../../data/charts-import/reports/chart-csv-discovery.json" assert { type: "json" };

type DiscoveryFile = {
  filename: string;
  filepath: string;
  detectedChartType: string;
  confidence: "high" | "medium" | "low";
  rowCount: number;
  detectedDate: string | null;
  detectedWeek: string | null;
  validationStatus: "valid" | "warnings" | "errors";
  mappedFields: Record<string, string>;
};

const root = process.cwd();
const outPath = path.join(root, "src/services/chartsPublic/csvData.ts");
const files = (discovery.files ?? []) as DiscoveryFile[];

const familyConfig: Record<string, { id: string; label: string; size: number; frequency: ChartFamily["editionFrequency"]; description: string }> = {
  top_40: {
    id: "weekly-top-40",
    label: "WAKILISHA Top 40",
    size: 40,
    frequency: "weekly",
    description: "The primary WAKILISHA chart imported from historical CSV exports.",
  },
  top_100: {
    id: "weekly-top-100",
    label: "WAKILISHA Top 100",
    size: 100,
    frequency: "weekly",
    description: "The expanded WAKILISHA chart imported from historical CSV exports.",
  },
  afrobeats: {
    id: "afrobeats-top-20",
    label: "Afrobeats Top 20",
    size: 20,
    frequency: "weekly",
    description: "Genre-focused Afrobeats chart imported from WAKILISHA CSV exports.",
  },
  generic_ranked: {
    id: "legacy-ranked",
    label: "Legacy Ranked Import",
    size: 100,
    frequency: "weekly",
    description: "Legacy ranked chart data requiring editorial verification.",
  },
};

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function cell(row: Record<string, unknown>, column?: string) {
  if (!column) return "";
  const value = row[column];
  return value == null ? "" : String(value).trim();
}

function hashPayload(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(31, hash) + text.charCodeAt(i) | 0;
  return `csv-${Math.abs(hash).toString(16)}`;
}

function readCsv(file: DiscoveryFile): Record<string, string>[] {
  const absolute = path.join(root, file.filepath);
  if (!fs.existsSync(absolute)) {
    return file.rowCount > 0 ? (file as unknown as { sampleRows?: Record<string, string>[] }).sampleRows ?? [] : [];
  }
  const raw = fs.readFileSync(absolute, "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true, bom: true, trim: true }) as Record<string, string>[];
}

function buildFamily(config: typeof familyConfig[string]): ChartFamily {
  return {
    id: config.id,
    familyKey: config.id,
    label: config.label,
    description: config.description,
    defaultChartSize: config.size,
    defaultRegion: "Africa",
    editionFrequency: config.frequency,
    defaultRuleset: "csv_import_v1",
    defaultScoringModel: "csv_rank_order",
    createdAt: "2026-05-30T00:00:00Z",
    updatedAt: new Date().toISOString(),
    slug: config.id,
  };
}

const families = new Map<string, ChartFamily>();
const editions: ChartEdition[] = [];
const entries: ChartEditionEntry[] = [];
const usedFiles: string[] = [];

for (const file of files) {
  const config = familyConfig[file.detectedChartType];
  if (!config) continue;
  const rows = readCsv(file);
  if (!rows.length) continue;
  usedFiles.push(file.filename);
  const family = buildFamily(config);
  families.set(family.id, family);

  const date = file.detectedDate || "2026-05-30";
  const week = file.detectedWeek || date;
  const editionSlug = slugify(`${week || date}-${file.detectedChartType}`);
  const editionId = `csv-${family.id}-${editionSlug}`;
  const mapped = file.mappedFields ?? {};

  const editionEntries = rows.map((row, index) => {
    const rankRaw = Number(cell(row, mapped.rank));
    const rank = Number.isFinite(rankRaw) && rankRaw > 0 ? rankRaw : index + 1;
    const title = cell(row, mapped.title) || `Untitled row ${index + 1}`;
    const artist = cell(row, mapped.artist_line) || "Unknown artist";
    const trackSlug = slugify(`${title}-${artist}`);
    const artworkUrl = cell(row, mapped.artwork_url) || null;
    const isrc = cell(row, mapped.isrc) || null;
    const releaseTitle = cell(row, mapped.release_title) || null;
    const label = cell(row, mapped.label) || "";
    const rawHash = hashPayload(row);

    return {
      id: `${editionId}::${String(rank).padStart(3, "0")}::${trackSlug}`,
      editionId,
      rank,
      previousRank: null,
      movement: "new" as const,
      peakPosition: rank,
      weeksOnChart: 1,
      trackSlug,
      trackTitle: title,
      artistSlugs: artist.split(/,|&| ft\.? | feat\.? /i).map((name) => slugify(name.trim())).filter(Boolean),
      artistNames: [artist],
      artworkUrl: artworkUrl || `https://picsum.photos/seed/${encodeURIComponent(trackSlug)}/600/600`,
      score: Math.max(100, 1000 - index * 10),
      entryPayload: {
        source: "csv",
        sourceFilename: file.filename,
        sourceRowNumber: index + 1,
        rawRowHash: rawHash,
        rawPayload: row,
        mappedFields: mapped,
        isrc,
        releaseTitle,
        label,
        externalUrls: {
          spotify: cell(row, mapped.spotify_url) || null,
          youtube: cell(row, mapped.youtube_url) || null,
          apple: cell(row, mapped.apple_music_url) || null,
        },
      },
      genre: file.detectedChartType === "afrobeats" ? "Afrobeats" : undefined,
      source: "WAKILISHA CSV Import",
      isPlayable: Boolean(cell(row, mapped.spotify_url) || cell(row, mapped.youtube_url) || cell(row, mapped.apple_music_url)),
      duration: undefined,
      movementAmount: 0,
    } satisfies ChartEditionEntry;
  }).sort((a, b) => a.rank - b.rank);

  entries.push(...editionEntries);
  editions.push({
    id: editionId,
    familyId: family.id,
    slug: editionSlug,
    label: `${family.label} · ${week}`,
    date,
    periodStart: date,
    periodEnd: date,
    status: "published",
    ingestJobId: `csv-import-${slugify(file.filename)}`,
    publishedAt: `${date}T00:00:00Z`,
    publishedBy: "WAKILISHA CSV Import",
    entryCount: editionEntries.length,
    newEntries: editionEntries.length,
    reEntries: 0,
  });
}

const source = `import type { ChartEdition, ChartEditionEntry, ChartFamily, TrackChartHistory } from "./types";\n\nexport type CsvPublicChartData = {\n  generatedAt: string | null;\n  sourceFiles: string[];\n  families: ChartFamily[];\n  editions: ChartEdition[];\n  entries: ChartEditionEntry[];\n};\n\nexport const CSV_PUBLIC_CHART_DATA: CsvPublicChartData = ${JSON.stringify({ generatedAt: new Date().toISOString(), sourceFiles: usedFiles, families: Array.from(families.values()), editions, entries }, null, 2)};\n\nexport function hasCsvPublicChartData() {\n  return CSV_PUBLIC_CHART_DATA.families.length > 0 && CSV_PUBLIC_CHART_DATA.editions.length > 0 && CSV_PUBLIC_CHART_DATA.entries.length > 0;\n}\n\nexport function getCsvFamily(familySlug: string): ChartFamily | null {\n  return CSV_PUBLIC_CHART_DATA.families.find((family) => family.slug === familySlug || family.familyKey === familySlug || family.id === familySlug) ?? null;\n}\n\nexport function getCsvEditionsForFamily(familySlug: string): ChartEdition[] {\n  const family = getCsvFamily(familySlug);\n  if (!family) return [];\n  return CSV_PUBLIC_CHART_DATA.editions.filter((edition) => edition.familyId === family.id).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.label.localeCompare(a.label));\n}\n\nexport function getCsvLatestEdition(familySlug: string): ChartEdition | null {\n  return getCsvEditionsForFamily(familySlug)[0] ?? null;\n}\n\nexport function getCsvEdition(familySlug: string, editionSlug: string): ChartEdition | null {\n  const family = getCsvFamily(familySlug);\n  if (!family) return null;\n  return CSV_PUBLIC_CHART_DATA.editions.find((edition) => edition.familyId === family.id && (edition.slug === editionSlug || edition.id === editionSlug)) ?? null;\n}\n\nexport function getCsvEntriesForEdition(familySlug: string, editionSlug: string): ChartEditionEntry[] {\n  const edition = getCsvEdition(familySlug, editionSlug);\n  if (!edition) return [];\n  return CSV_PUBLIC_CHART_DATA.entries.filter((entry) => entry.editionId === edition.id).slice().sort((a, b) => a.rank - b.rank);\n}\n\nexport function getCsvTrackHistory(trackSlug: string): TrackChartHistory | null {\n  const appearances = CSV_PUBLIC_CHART_DATA.entries.filter((entry) => entry.trackSlug === trackSlug);\n  if (!appearances.length) return null;\n  const sorted = appearances.slice().sort((a, b) => {\n    const editionA = CSV_PUBLIC_CHART_DATA.editions.find((edition) => edition.id === a.editionId);\n    const editionB = CSV_PUBLIC_CHART_DATA.editions.find((edition) => edition.id === b.editionId);\n    return new Date(editionB?.date ?? 0).getTime() - new Date(editionA?.date ?? 0).getTime();\n  });\n  const first = sorted[sorted.length - 1];\n  const latest = sorted[0];\n  const firstEdition = CSV_PUBLIC_CHART_DATA.editions.find((edition) => edition.id === first.editionId);\n  const latestEdition = CSV_PUBLIC_CHART_DATA.editions.find((edition) => edition.id === latest.editionId);\n  return {\n    trackSlug,\n    trackTitle: latest.trackTitle,\n    artistNames: latest.artistNames,\n    appearances: sorted.map((entry) => {\n      const edition = CSV_PUBLIC_CHART_DATA.editions.find((item) => item.id === entry.editionId);\n      return { editionSlug: edition?.slug ?? entry.editionId, editionLabel: edition?.label ?? entry.editionId, rank: entry.rank, weeksOnChart: entry.weeksOnChart ?? 0, movement: entry.movement };\n    }),\n    peakPosition: Math.min(...sorted.map((entry) => entry.rank)),\n    totalWeeksOnChart: Math.max(...sorted.map((entry) => entry.weeksOnChart ?? 0)),\n    firstAppearance: firstEdition?.date ?? null,\n    latestAppearance: latestEdition?.date ?? null,\n  };\n}\n`;

fs.writeFileSync(outPath, source);
console.log(`Generated ${outPath}`);
console.log(`Families: ${families.size}, editions: ${editions.length}, entries: ${entries.length}`);
