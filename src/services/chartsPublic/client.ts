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
  getSupabaseChartFamilies,
  getSupabaseChartFamily,
  getSupabaseChartEditionsForFamily,
  getSupabaseLatestChartEdition,
  getSupabaseChartEdition,
  getSupabaseChartEditionEntries,
  getSupabaseTrackChartHistory,
} from "./supabaseRuntime";

export const PUBLIC_API_BASE = import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE || "/__wakilisha-v2-api/wp-json/wakilisha/v2";
export const PUBLIC_MODE = "supabase-import" as const;
export const PUBLIC_API_VERSION = "phase8-import-runtime" as const;

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
  return withCache("chart_families_supabase_import", async () => ({
    data: await getSupabaseChartFamilies(),
    source: "legacy_import",
  }));
}

export function getChartFamily(familySlug: string): Promise<ChartResult<ChartFamily | null>> {
  return withCache(`chart_family_supabase_import_${familySlug}`, async () => ({
    data: await getSupabaseChartFamily(familySlug),
    source: "legacy_import",
  }));
}

export function getChartEditionsForFamily(familySlug: string): Promise<ChartResult<ChartEdition[]>> {
  return withCache(`chart_family_editions_supabase_import_${familySlug}`, async () => ({
    data: await getSupabaseChartEditionsForFamily(familySlug),
    source: "legacy_import",
  }));
}

export function getLatestChartEdition(familySlug: string): Promise<ChartResult<ChartEdition | null>> {
  return withCache(`chart_latest_supabase_import_${familySlug}`, async () => ({
    data: await getSupabaseLatestChartEdition(familySlug),
    source: "legacy_import",
  }));
}

export function getChartEdition(familySlug: string, editionSlug: string): Promise<ChartResult<ChartEdition | null>> {
  return withCache(`chart_edition_supabase_import_${familySlug}_${editionSlug}`, async () => ({
    data: await getSupabaseChartEdition(familySlug, editionSlug),
    source: "legacy_import",
  }));
}

export function getChartEditionEntries(familySlug: string, editionSlug: string): Promise<ChartResult<ChartEditionEntry[]>> {
  return withCache(`chart_entries_supabase_import_${familySlug}_${editionSlug}`, async () => ({
    data: await getSupabaseChartEditionEntries(familySlug, editionSlug),
    source: "legacy_import",
  }));
}

export function getTrackChartHistory(trackSlug: string): Promise<ChartResult<TrackChartHistory | null>> {
  return withCache(`track_history_supabase_import_${trackSlug}`, async () => ({
    data: await getSupabaseTrackChartHistory(trackSlug),
    source: "legacy_import",
  }));
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
