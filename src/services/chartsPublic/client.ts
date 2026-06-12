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
  getV2ChartFamilies,
  getV2ChartFamily,
  getV2ChartEditionsForFamily,
  getV2LatestChartEdition,
  getV2ChartEdition,
  getV2ChartEditionEntries,
  getV2TrackChartHistory,
} from "./v2Adapter";

export const PUBLIC_API_BASE = import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE || "/api/v1";
export const PUBLIC_MODE = "public-api" as const;
export const PUBLIC_API_VERSION = "v1-public-api" as const;

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
    return { data, meta: { source, fetchedAt: now(), isStale: false } };
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
  return withCache("chart_families_public_api", async () => ({
    data: await getV2ChartFamilies(),
    source: "wordpress",
  }));
}

export function getChartFamily(familySlug: string): Promise<ChartResult<ChartFamily | null>> {
  return withCache(`chart_family_public_api_${familySlug}`, async () => ({
    data: await getV2ChartFamily(familySlug),
    source: "wordpress",
  }));
}

export function getChartEditionsForFamily(familySlug: string): Promise<ChartResult<ChartEdition[]>> {
  return withCache(`chart_family_editions_public_api_${familySlug}`, async () => ({
    data: await getV2ChartEditionsForFamily(familySlug),
    source: "wordpress",
  }));
}

export function getLatestChartEdition(familySlug: string): Promise<ChartResult<ChartEdition | null>> {
  return withCache(`chart_latest_public_api_${familySlug}`, async () => ({
    data: await getV2LatestChartEdition(familySlug),
    source: "wordpress",
  }));
}

export function getChartEdition(familySlug: string, editionSlug: string): Promise<ChartResult<ChartEdition | null>> {
  return withCache(`chart_edition_public_api_${familySlug}_${editionSlug}`, async () => ({
    data: await getV2ChartEdition(familySlug, editionSlug),
    source: "wordpress",
  }));
}

export function getChartEditionEntries(familySlug: string, editionSlug: string): Promise<ChartResult<ChartEditionEntry[]>> {
  return withCache(`chart_entries_public_api_${familySlug}_${editionSlug}`, async () => ({
    data: await getV2ChartEditionEntries(familySlug, editionSlug),
    source: "wordpress",
  }));
}

export function getTrackChartHistory(trackSlug: string): Promise<ChartResult<TrackChartHistory | null>> {
  return withCache(`track_history_public_api_${trackSlug}`, async () => ({
    data: await getV2TrackChartHistory(trackSlug),
    source: "wordpress",
  }));
}

export { clearChartCache };
export type { ChartFamily, ChartEdition, ChartEditionEntry, TrackChartHistory };

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
