import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { ChartEdition, ChartEditionEntry, ChartFamily, TrackChartHistory } from "../../src/services/chartsPublic/types";

const root = process.cwd();
const rawDir = path.join(root, "data/supabase-imports/2026-05-30/raw");
const outDir = path.join(root, "public/charts-data");

function readCsv(filename: string): Record<string, string>[] {
  const filepath = path.join(rawDir, filename);
  if (!fs.existsSync(filepath)) throw new Error(`Missing required CSV: ${filepath}`);
  const raw = fs.readFileSync(filepath, "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true, bom: true, trim: true }) as Record<string, string>[];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function safeDate(value: string | null | undefined) {
  if (!value) return "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : value;
}

function numberOrNull(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hashPayload(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  return `csv-${Math.abs(hash).toString(16)}`;
}

function splitArtistNames(artistName: string) {
  return artistName
    .split(/,|&| ft\.? | feat\.? | featuring /i)
    .map((name) => name.trim())
    .filter(Boolean);
}

function editionKey(edition: Record<string, string>) {
  return edition.edition_id || edition.id || edition.slug;
}

function isBetterEditionCandidate(next: Record<string, string>, current: Record<string, string>) {
  const nextSlug = next.slug || "";
  const currentSlug = current.slug || "";
  if (currentSlug.endsWith("-2") && !nextSlug.endsWith("-2")) return true;
  if (!current.chart_date && next.chart_date) return true;
  if (!current.title && next.title) return true;
  return false;
}

const seriesRows = readCsv("wk_chart_series.csv");
const editionRows = readCsv("wk_chart_editions.csv");
const entryRows = readCsv("wk_chart_entries.csv");
const trackRows = readCsv("wk_tracks.csv");

const tracksBySlug = new Map(trackRows.filter((row) => row.slug).map((row) => [row.slug, row]));
const seriesBySlug = new Map(seriesRows.filter((row) => row.slug).map((row) => [row.slug, row]));
const seriesBySourceWpPostId = new Map(seriesRows.filter((row) => row.source_wp_post_id).map((row) => [row.source_wp_post_id, row]));

function inferSeriesForEdition(edition: Record<string, string>) {
  if (edition.chart_slug && seriesBySlug.has(edition.chart_slug)) return seriesBySlug.get(edition.chart_slug)!;
  if (edition.series_wp_post_id && seriesBySourceWpPostId.has(edition.series_wp_post_id)) return seriesBySourceWpPostId.get(edition.series_wp_post_id)!;
  if (edition.chart_slug) {
    return {
      id: edition.chart_slug,
      slug: edition.chart_slug,
      title: edition.chart_slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      raw_meta: "",
      wp_status: "publish",
      created_at: "",
      updated_at: "",
    } as Record<string, string>;
  }
  return null;
}

const rawEditionPairs = editionRows
  .map((edition) => ({ edition, series: inferSeriesForEdition(edition) }))
  .filter((pair): pair is { edition: Record<string, string>; series: Record<string, string> } => Boolean(pair.series));

const editionPairsById = new Map<string, { edition: Record<string, string>; series: Record<string, string> }>();
for (const pair of rawEditionPairs) {
  const key = editionKey(pair.edition);
  if (!key) continue;
  const existing = editionPairsById.get(key);
  if (!existing || isBetterEditionCandidate(pair.edition, existing.edition)) {
    editionPairsById.set(key, pair);
  }
}
const editionPairs = Array.from(editionPairsById.values());
const duplicateEditionCount = rawEditionPairs.length - editionPairs.length;

const familyIds = new Set(editionPairs.map(({ series }) => series.slug || series.id));

const families: ChartFamily[] = Array.from(familyIds).map((familyId) => {
  const series = editionPairs.find((pair) => (pair.series.slug || pair.series.id) === familyId)?.series;
  const relatedEditions = editionPairs.filter((pair) => (pair.series.slug || pair.series.id) === familyId);
  const relatedEntries = entryRows.filter((entry) => relatedEditions.some((pair) => editionKey(pair.edition) === entry.edition_id || pair.edition.slug === entry.edition_id));
  const maxRank = Math.max(...relatedEntries.map((entry) => numberOrNull(entry.position) ?? 0), 0);

  return {
    id: familyId,
    familyKey: familyId,
    label: series?.title || familyId.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    description: "Imported from the normalized WAKILISHA chart CSV export.",
    defaultChartSize: maxRank || 40,
    defaultRegion: "Africa",
    editionFrequency: "weekly",
    defaultRuleset: "csv_registry_import_v1",
    defaultScoringModel: "csv_position_order",
    createdAt: series?.created_at || "2026-05-30T00:00:00Z",
    updatedAt: series?.updated_at || new Date().toISOString(),
    slug: familyId,
  } satisfies ChartFamily;
});

const editions: ChartEdition[] = editionPairs.map(({ edition, series }) => {
  const familyId = series.slug || series.id;
  const editionId = editionKey(edition);
  const entriesForEdition = entryRows.filter((entry) => entry.edition_id === editionId || entry.edition_id === edition.slug);
  const date = safeDate(edition.chart_date || entriesForEdition[0]?.chart_date || edition.created_at);

  return {
    id: editionId,
    familyId,
    slug: edition.slug || slugify(`${familyId}-${editionId}`),
    label: edition.title || `${families.find((family) => family.id === familyId)?.label ?? familyId} \u00b7 ${date || editionId}`,
    date,
    periodStart: date,
    periodEnd: date,
    status: edition.wp_status === "draft" ? "draft" : "published",
    ingestJobId: `csv-import-${editionId}`,
    publishedAt: date ? `${date}T00:00:00Z` : null,
    publishedBy: "WAKILISHA CSV Import",
    entryCount: entriesForEdition.length,
    newEntries: entriesForEdition.filter((entry) => !entry.previous_position || Number(entry.previous_position) <= 0).length,
    reEntries: 0,
  } satisfies ChartEdition;
});

const editionsById = new Map(editions.map((edition) => [edition.id, edition]));
const editionsBySlug = new Map(editions.map((edition) => [edition.slug, edition]));
const entriesByEdition = new Map<string, Record<string, string>[]>();
for (const entry of entryRows) {
  const edition = editionsById.get(entry.edition_id) ?? editionsBySlug.get(entry.edition_id);
  if (!edition) continue;
  const list = entriesByEdition.get(edition.id) ?? [];
  list.push(entry);
  entriesByEdition.set(edition.id, list);
}

const peakByTrack = new Map<string, number>();
const weeksByTrack = new Map<string, number>();
for (const entry of entryRows) {
  const trackKey = entry.track_slug || slugify(`${entry.title}-${entry.artist_name}`);
  const rank = numberOrNull(entry.position) ?? 9999;
  peakByTrack.set(trackKey, Math.min(peakByTrack.get(trackKey) ?? rank, rank));
  weeksByTrack.set(trackKey, (weeksByTrack.get(trackKey) ?? 0) + 1);
}

// Build entries per edition
const entries: ChartEditionEntry[] = [];
const entriesPerEdition = new Map<string, ChartEditionEntry[]>();

for (const edition of editions) {
  const rows = (entriesByEdition.get(edition.id) ?? []).slice().sort((a, b) => (numberOrNull(a.position) ?? 9999) - (numberOrNull(b.position) ?? 9999));
  const editionEntries: ChartEditionEntry[] = [];

  rows.forEach((row, index) => {
    const rank = numberOrNull(row.position) ?? index + 1;
    const previousRank = numberOrNull(row.previous_position);
    const track = row.track_slug ? tracksBySlug.get(row.track_slug) : undefined;
    const title = row.title || track?.title || `Untitled row ${index + 1}`;
    const artistName = row.artist_name || track?.artist_name || "Unknown artist";
    const trackSlug = row.track_slug || track?.slug || slugify(`${title}-${artistName}`);
    const artworkUrl = row.artwork_url || track?.artwork_url || null;
    const previewUrl = row.preview_url || track?.preview_url || null;
    const sourcePayload = row.source_payload || track?.platform_links || "";
    const movement: ChartEditionEntry["movement"] = previousRank == null || previousRank <= 0 ? "new" : previousRank > rank ? "up" : previousRank < rank ? "down" : "same";

    const entry: ChartEditionEntry = {
      id: row.id || `${edition.id}::${String(rank).padStart(3, "0")}::${trackSlug}`,
      editionId: edition.id,
      rank,
      previousRank,
      movement,
      peakPosition: peakByTrack.get(trackSlug) ?? rank,
      weeksOnChart: weeksByTrack.get(trackSlug) ?? 1,
      trackSlug,
      trackTitle: title,
      artistSlugs: row.artist_slug ? [row.artist_slug] : splitArtistNames(artistName).map(slugify),
      artistNames: [artistName],
      artworkUrl: artworkUrl || `https://picsum.photos/seed/${encodeURIComponent(trackSlug)}/600/600`,
      score: Math.max(100, 10000 - rank * 10),
      entryPayload: {
        source: "normalized_csv_export",
        sourceFilename: "wk_chart_entries.csv",
        sourceRowId: row.id,
        sourceRowNumber: index + 1,
        rawRowHash: hashPayload(row),
        rawPayload: row,
        trackPayload: track ?? null,
        releaseSlug: row.release_slug || track?.release_slug || null,
        labelName: row.label_name || track?.label_name || null,
        isrc: row.isrc || track?.isrc || null,
        releaseDate: row.release_date || track?.release_date || null,
        previewUrl,
        sourcePayload,
      },
      genre: undefined,
      source: "WAKILISHA CSV Import",
      isPlayable: Boolean(previewUrl || sourcePayload),
      duration: numberOrNull(row.duration || track?.duration) ?? undefined,
      movementAmount: previousRank ? Math.abs(previousRank - rank) : 0,
    };

    editionEntries.push(entry);
    entries.push(entry);
  });

  entriesPerEdition.set(edition.id, editionEntries);
}

// Build track history index
const trackAppearances = new Map<string, ChartEditionEntry[]>();
for (const entry of entries) {
  const list = trackAppearances.get(entry.trackSlug) ?? [];
  list.push(entry);
  trackAppearances.set(entry.trackSlug, list);
}

const tracks: Record<string, TrackChartHistory> = {};
for (const [trackSlug, appearances] of trackAppearances) {
  const sorted = appearances.slice().sort((a, b) => {
    const editionA = editions.find((edition) => edition.id === a.editionId);
    const editionB = editions.find((edition) => edition.id === b.editionId);
    return new Date(editionB?.date ?? 0).getTime() - new Date(editionA?.date ?? 0).getTime();
  });

  const first = sorted[sorted.length - 1];
  const latest = sorted[0];
  const firstEdition = editions.find((edition) => edition.id === first.editionId);
  const latestEdition = editions.find((edition) => edition.id === latest.editionId);

  tracks[trackSlug] = {
    trackSlug,
    trackTitle: latest.trackTitle,
    artistNames: latest.artistNames,
    appearances: sorted.map((entry) => {
      const edition = editions.find((item) => item.id === entry.editionId);
      return {
        editionSlug: edition?.slug ?? entry.editionId,
        editionLabel: edition?.label ?? entry.editionId,
        rank: entry.rank,
        weeksOnChart: entry.weeksOnChart ?? 0,
        movement: entry.movement,
      };
    }),
    peakPosition: Math.min(...sorted.map((entry) => entry.rank)),
    totalWeeksOnChart: Math.max(...sorted.map((entry) => entry.weeksOnChart ?? 0)),
    firstAppearance: firstEdition?.date ?? null,
    latestAppearance: latestEdition?.date ?? null,
  };
}

// Ensure output directory exists
fs.mkdirSync(outDir, { recursive: true });

// Write manifest
const manifest = {
  generatedAt: new Date().toISOString(),
  sourceFiles: ["wk_chart_series.csv", "wk_chart_editions.csv", "wk_chart_entries.csv", "wk_tracks.csv"],
  totalFamilies: families.length,
  totalEditions: editions.length,
  totalEntries: entries.length,
};

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

// Write families
fs.writeFileSync(path.join(outDir, "families.json"), JSON.stringify({ families }, null, 2));

// Write editions
fs.writeFileSync(path.join(outDir, "editions.json"), JSON.stringify({ editions }, null, 2));

// Write per-edition entries
let entriesFileCount = 0;
let totalEntriesWritten = 0;

for (const edition of editions) {
  const family = families.find((f) => f.id === edition.familyId);
  if (!family) continue;

  const familySlug = family.slug || family.id;
  const editionSlug = edition.slug;
  const editionEntries = entriesPerEdition.get(edition.id) ?? [];

  const editionDir = path.join(outDir, "entries", familySlug);
  fs.mkdirSync(editionDir, { recursive: true });

  const filePath = path.join(editionDir, `${editionSlug}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ entries: editionEntries }, null, 2));
  entriesFileCount += 1;
  totalEntriesWritten += editionEntries.length;
}

// Write tracks index
fs.writeFileSync(path.join(outDir, "tracks.json"), JSON.stringify(tracks, null, 2));

// Print summary
function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function getFileSize(filepath: string) {
  try {
    return fs.statSync(filepath).size;
  } catch {
    return 0;
  }
}

const files = fs.readdirSync(outDir, { recursive: true, withFileTypes: true });
let maxFileSize = 0;
let maxFileName = "";
let totalSize = 0;

for (const file of files) {
  if (file.isFile()) {
    const filePath = path.join(file.path || outDir, file.name);
    const size = getFileSize(filePath);
    totalSize += size;
    if (size > maxFileSize) {
      maxFileSize = size;
      maxFileName = file.name;
    }
  }
}

console.log("\n=== WAKILISHA Charts JSON Generator ===");
console.log(`Families: ${families.length}`);
console.log(`Editions: ${editions.length} (deduped from ${rawEditionPairs.length}, duplicates removed: ${duplicateEditionCount})`);
console.log(`Entries: ${entries.length} (written to ${entriesFileCount} edition files)`);
console.log(`Unique tracks: ${Object.keys(tracks).length}`);
console.log(`\nOutput directory: ${outDir}`);
console.log(`Total size: ${formatBytes(totalSize)}`);
console.log(`Largest file: ${maxFileName} (${formatBytes(maxFileSize)})`);
console.log(`\nPASS: All files written successfully.`);

// Validate no file exceeds 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;
if (maxFileSize > MAX_FILE_SIZE) {
  console.error(`\nERROR: File ${maxFileName} exceeds ${formatBytes(MAX_FILE_SIZE)} GitHub limit`);
  process.exit(1);
}

// Validate total entries match
if (totalEntriesWritten !== entries.length) {
  console.error(`\nERROR: Entry count mismatch: generated ${entries.length}, written ${totalEntriesWritten}`);
  process.exit(1);
}

// Validate entries per edition
let failedEditions = 0;
for (const edition of editions) {
  const family = families.find((f) => f.id === edition.familyId);
  if (!family) continue;

  const filePath = path.join(outDir, "entries", family.slug || family.id, `${edition.slug}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as { entries: ChartEditionEntry[] };
  const wrongIds = data.entries.filter((e) => e.editionId !== edition.id);
  if (wrongIds.length > 0) {
    console.error(`Edition ${edition.slug}: ${wrongIds.length} entries have wrong editionId`);
    failedEditions += 1;
  }
}

if (failedEditions > 0) {
  console.error(`\nERROR: ${failedEditions} editions failed validation`);
  process.exit(1);
}

console.log("\nAll validations passed.");