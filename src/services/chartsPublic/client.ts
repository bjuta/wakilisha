import type {
  ChartFamily,
  ChartEdition,
  ChartEditionEntry,
  TrackChartHistory,
} from "./types";

import {
  getCachedChart,
  setCachedChart,
  clearChartCache,
  DEFAULT_CACHE_TTL,
  type PublicChartCacheSource,
} from "./cache";

import {
  MOCK_FAMILIES,
  MOCK_TRACK_HISTORY,
  getMockEntriesForEdition,
  getMockLatestEdition,
  getMockEdition,
  getMockFamily,
  getMockEditionsForFamily,
} from "./mockData";

import {
  hasCsvPublicChartData,
  getCsvEntriesForEdition,
  getCsvLatestEdition,
  getCsvEdition,
  getCsvFamily,
  getCsvFamilies,
  getCsvEditionsForFamily,
  getCsvTrackHistory,
} from "./csvData";

export const PUBLIC_API_BASE = import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE || "/api/wakilisha/public";
export const PUBLIC_MODE = "local" as const;
export const PUBLIC_API_VERSION = "runtime" as const;

export class PublicChartsApiError extends Error {
  status: number;
  code?: string;
  retryable: boolean;

  constructor(message: string, status = 500, code = "public_charts_error", retryable = false) {
    super(message);
    this.name = "PublicChartsApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export interface ChartFetchMeta {
  source: PublicChartCacheSource | "cache";
  fetchedAt: string;
  isStale: boolean;
}

export interface ChartResult<T> {
  data: T;
  meta: ChartFetchMeta;
}

function now(): string {
  return new Date().toISOString();
}

function localMeta(): ChartFetchMeta {
  return { source: "local", fetchedAt: now(), isStale: false };
}

function cacheMeta(entry: {
  source: PublicChartCacheSource;
  fetchedAt: number;
  isStale: boolean;
}): ChartFetchMeta {
  return {
    source: "cache",
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    isStale: entry.isStale,
  };
}

async function useCsvPublicData(): Promise<boolean> {
  return hasCsvPublicChartData();
}

async function withCache<T>(
  key: string,
  fetchFn: () => Promise<{ data: T; source: PublicChartCacheSource }>,
  ttlMs = DEFAULT_CACHE_TTL
): Promise<ChartResult<T>> {
  const cached = getCachedChart<T>(key);
  if (cached && !cached.isStale) {
    return { data: cached.data, meta: cacheMeta(cached) };
  }

  try {
    const { data, source } = await fetchFn();
    setCachedChart(key, data, source, ttlMs);
    return { data, meta: source === "local" ? localMeta() : { source, fetchedAt: now(), isStale: false } };
  } catch (err) {
    if (cached) {
      return {
        data: cached.data,
        meta: { ...cacheMeta(cached), isStale: true },
      };
    }
    throw err;
  }
}

export function getChartFamilies(): Promise<ChartResult<ChartFamily[]>> {
  return withCache("chart_families_runtime", async () => {
    const csvData = await useCsvPublicData();
    return {
      data: csvData ? await getCsvFamilies() : [...MOCK_FAMILIES],
      source: "local",
    };
  });
}

export function getChartFamily(familySlug: string): Promise<ChartResult<ChartFamily | null>> {
  return withCache(`chart_family_runtime_${familySlug}`, async () => {
    const csvData = await useCsvPublicData();
    const family = csvData ? await getCsvFamily(familySlug) : getMockFamily(familySlug);
    return { data: family ? { ...family } : null, source: "local" };
  });
}

export function getChartEditionsForFamily(familySlug: string): Promise<ChartResult<ChartEdition[]>> {
  return withCache(`chart_family_editions_runtime_${familySlug}`, async () => {
    const csvData = await useCsvPublicData();
    return {
      data: csvData ? await getCsvEditionsForFamily(familySlug) : getMockEditionsForFamily(familySlug),
      source: "local",
    };
  });
}

export function getLatestChartEdition(familySlug: string): Promise<ChartResult<ChartEdition | null>> {
  return withCache(`chart_latest_runtime_${familySlug}`, async () => {
    const csvData = await useCsvPublicData();
    const edition = csvData ? await getCsvLatestEdition(familySlug) : getMockLatestEdition(familySlug);
    return { data: edition ? { ...edition } : null, source: "local" };
  });
}

export function getChartEdition(familySlug: string, editionSlug: string): Promise<ChartResult<ChartEdition | null>> {
  return withCache(`chart_edition_runtime_${familySlug}_${editionSlug}`, async () => {
    const csvData = await useCsvPublicData();
    const edition = csvData ? await getCsvEdition(familySlug, editionSlug) : getMockEdition(familySlug, editionSlug);
    return { data: edition ? { ...edition } : null, source: "local" };
  });
}

export function getChartEditionEntries(familySlug: string, editionSlug: string): Promise<ChartResult<ChartEditionEntry[]>> {
  return withCache(`chart_entries_runtime_${familySlug}_${editionSlug}`, async () => {
    const csvData = await useCsvPublicData();
    return {
      data: csvData ? await getCsvEntriesForEdition(familySlug, editionSlug) : getMockEntriesForEdition(familySlug, editionSlug),
      source: "local",
    };
  });
}

export function getTrackChartHistory(trackSlug: string): Promise<ChartResult<TrackChartHistory | null>> {
  return withCache(`track_history_runtime_${trackSlug}`, async () => {
    const csvData = await useCsvPublicData();
    const csvHistory = csvData ? await getCsvTrackHistory(trackSlug) : null;
    if (csvHistory) return { data: csvHistory, source: "local" };
    if (trackSlug === "midnight-dreams") return { data: { ...MOCK_TRACK_HISTORY }, source: "local" };
    return {
      data: {
        trackSlug,
        trackTitle: "Unknown Track",
        artistNames: [],
        appearances: [],
        peakPosition: 0,
        totalWeeksOnChart: 0,
        firstAppearance: null,
        latestAppearance: null,
      },
      source: "local",
    };
  });
}

export { clearChartCache };
export type { ChartFamily, ChartEdition, ChartEditionEntry, TrackChartHistory };
export {
  getMockEntriesForEdition,
  getMockLatestEdition,
  getMockEdition,
  getMockFamily,
  getMockEditionsForFamily,
} from "./mockData";
export {
  hasCsvPublicChartData,
  getCsvEntriesForEdition,
  getCsvLatestEdition,
  getCsvEdition,
  getCsvFamily,
  getCsvFamilies,
  getCsvEditionsForFamily,
} from "./csvData";
export {
  toChartDirectoryViewModel,
  toChartEditionViewModel,
  toChartEntryRowViewModel,
  toChartTrackPlayerModel,
  toChartTrackPlayerModels,
  toChartFamilyViewModel,
  toChartArchiveViewModel,
} from "./viewModels";
