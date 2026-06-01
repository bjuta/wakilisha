import type { ChartEdition, ChartEditionEntry, ChartFamily, TrackChartHistory } from "./types";

// ─── JSON-backed async chart data loader ──────────────────────────────────────
// Replaces the old inline CSV_PUBLIC_CHART_DATA blob with lazy-loaded JSON
// assets under public/charts-data/. No generated file exceeds 1 MB and the
// main JS bundle stays small.

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChartDataManifest {
  generatedAt: string;
  sourceFiles: string[];
  totalFamilies: number;
  totalEditions: number;
  totalEntries: number;
}

interface FamiliesPayload {
  families: ChartFamily[];
}

interface EditionsPayload {
  editions: ChartEdition[];
}

interface EditionEntriesPayload {
  entries: ChartEditionEntry[];
}

// ─── State ──────────────────────────────────────────────────────────────────

let manifest: ChartDataManifest | null = null;
let families: ChartFamily[] | null = null;
let editions: ChartEdition[] | null = null;
let tracksIndex: Record<string, TrackChartHistory> | null = null;

const entriesCache = new Map<string, ChartEditionEntry[]>();

// ─── Helpers ────────────────────────────────────────────────────────────────

function getBasePath(): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return base || "";
}

function dataUrl(filename: string): string {
  const base = getBasePath();
  return base ? `${base}/charts-data/${filename}` : `/charts-data/${filename}`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Internal loaders ─────────────────────────────────────────────────────────

async function loadManifest(): Promise<ChartDataManifest | null> {
  if (manifest) return manifest;
  manifest = await fetchJson<ChartDataManifest>(dataUrl("manifest.json"));
  return manifest;
}

async function loadFamilies(): Promise<ChartFamily[]> {
  if (families) return families;
  const data = await fetchJson<FamiliesPayload>(dataUrl("families.json"));
  families = data?.families ?? [];
  return families;
}

async function loadEditions(): Promise<ChartEdition[]> {
  if (editions) return editions;
  const data = await fetchJson<EditionsPayload>(dataUrl("editions.json"));
  editions = data?.editions ?? [];
  return editions;
}

async function loadEntriesForEdition(familySlug: string, editionSlug: string): Promise<ChartEditionEntry[]> {
  const cacheKey = `${familySlug}/${editionSlug}`;
  if (entriesCache.has(cacheKey)) return entriesCache.get(cacheKey)!;

  const data = await fetchJson<EditionEntriesPayload>(dataUrl(`entries/${familySlug}/${editionSlug}.json`));
  const entries = data?.entries ?? [];
  entriesCache.set(cacheKey, entries);
  return entries;
}

async function loadTracksIndex(): Promise<Record<string, TrackChartHistory>> {
  if (tracksIndex) return tracksIndex;
  const data = await fetchJson<Record<string, TrackChartHistory>>(dataUrl("tracks.json"));
  tracksIndex = data ?? {};
  return tracksIndex;
}

// ─── Public API (async, preserves old interface shape) ─────────────────────────

export async function hasCsvPublicChartData(): Promise<boolean> {
  const m = await loadManifest();
  return m !== null && m.totalEntries > 0;
}

export async function getCsvFamily(familySlug: string): Promise<ChartFamily | null> {
  const all = await loadFamilies();
  return (
    all.find(
      (family) =>
        family.slug === familySlug || family.familyKey === familySlug || family.id === familySlug
    ) ?? null
  );
}

export async function getCsvEditionsForFamily(familySlug: string): Promise<ChartEdition[]> {
  const family = await getCsvFamily(familySlug);
  if (!family) return [];
  const all = await loadEditions();
  return all
    .filter((edition) => edition.familyId === family.id)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime() ||
        b.label.localeCompare(a.label)
    );
}

export async function getCsvLatestEdition(familySlug: string): Promise<ChartEdition | null> {
  return (await getCsvEditionsForFamily(familySlug))[0] ?? null;
}

export async function getCsvEdition(familySlug: string, editionSlug: string): Promise<ChartEdition | null> {
  const family = await getCsvFamily(familySlug);
  if (!family) return null;
  const all = await loadEditions();
  return (
    all.find(
      (edition) =>
        edition.familyId === family.id &&
        (edition.slug === editionSlug || edition.id === editionSlug)
    ) ?? null
  );
}

export async function getCsvEntriesForEdition(
  familySlug: string,
  editionSlug: string
): Promise<ChartEditionEntry[]> {
  const edition = await getCsvEdition(familySlug, editionSlug);
  if (!edition) return [];

  const family = await getCsvFamily(familySlug);
  const resolvedFamilySlug = family?.slug || family?.id || familySlug;
  const entries = await loadEntriesForEdition(resolvedFamilySlug, edition.slug);

  // Guard: filter out any entries that don't belong to this edition
  return entries
    .filter((entry) => entry.editionId === edition.id)
    .slice()
    .sort((a, b) => a.rank - b.rank);
}

export async function getCsvTrackHistory(trackSlug: string): Promise<TrackChartHistory | null> {
  const index = await loadTracksIndex();
  return index[trackSlug] ?? null;
}

export async function getCsvFamilies(): Promise<ChartFamily[]> {
  return loadFamilies();
}

// ─── Re-export type for consumers that imported it from here ──────────────────
export type { CsvPublicChartData } from "./types";