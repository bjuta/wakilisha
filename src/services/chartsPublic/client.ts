import type {
  ChartFamily,
  ChartEdition,
  ChartEditionEntry,
  TrackChartHistory,
} from "./types";

import { fromWpChartFamily, fromWpChartEdition } from "../chartsIngestion/normalizers";

import { publicWpGet, PublicWpApiError } from "./wpAdapter";

import {
  getCachedChart,
  setCachedChart,
  clearChartCache,
  DEFAULT_CACHE_TTL,
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

// ─── Environment ───
export const PUBLIC_API_BASE =
  import.meta.env.VITE_WAKILISHA_WP_API_BASE || "/wp-json/wakilisha/v1";

export const PUBLIC_MODE =
  (import.meta.env.VITE_CHARTS_PUBLIC_MODE as "mock" | "wordpress") || "mock";

if (import.meta.env.DEV && !import.meta.env.VITE_WAKILISHA_WP_API_BASE) {
  // eslint-disable-next-line no-console
  console.warn(
    "[chartsPublic] VITE_WAKILISHA_WP_API_BASE is not set. Public charts client will use default '/wp-json/wakilisha/v1'"
  );
}

// ─── Error type ───
export { PublicWpApiError };

// ─── Metadata types ───
export interface ChartFetchMeta {
  source: "mock" | "wordpress" | "cache";
  fetchedAt: string;
  isStale: boolean;
}

export interface ChartResult<T> {
  data: T;
  meta: ChartFetchMeta;
}

// ─── Helpers ───
function isMock(): boolean {
  return PUBLIC_MODE === "mock";
}

function now(): string {
  return new Date().toISOString();
}

function mockMeta(): ChartFetchMeta {
  return { source: "mock", fetchedAt: now(), isStale: false };
}

function cacheMeta(entry: {
  source: "mock" | "wordpress";
  fetchedAt: number;
  isStale: boolean;
}): ChartFetchMeta {
  return {
    source: "cache",
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    isStale: entry.isStale,
  };
}

function wpMeta(): ChartFetchMeta {
  return { source: "wordpress", fetchedAt: now(), isStale: false };
}

async function useCsvPublicData(): Promise<boolean> {
  return isMock() && (await hasCsvPublicChartData());
}

/**
 * Core cache wrapper. Checks cache first, returns fresh if hit.
 * On fetch failure, falls back to stale cache if available.
 */
async function withCache<T>(
  key: string,
  fetchFn: () => Promise<{ data: T; source: "mock" | "wordpress" }>,
  ttlMs = DEFAULT_CACHE_TTL
): Promise<ChartResult<T>> {
  const cached = getCachedChart<T>(key);
  if (cached && !cached.isStale) {
    return { data: cached.data, meta: cacheMeta(cached) };
  }

  try {
    const { data, source } = await fetchFn();
    setCachedChart(key, data, source, ttlMs);
    return { data, meta: source === "mock" ? mockMeta() : wpMeta() };
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

// ─── API Functions ───

export function getChartFamilies(): Promise<ChartResult<ChartFamily[]>> {
  return withCache("chart_families", async () => {
    if (isMock()) {
      const csvData = await useCsvPublicData();
      return {
        data: csvData ? await getCsvFamilies() : [...MOCK_FAMILIES],
        source: "mock",
      };
    }
    const res = await publicWpGet<{ families: unknown[] }>("/charts");
    return {
      data: (res.families || []).map(fromWpChartFamily),
      source: "wordpress",
    };
  });
}

export function getChartFamily(
  familySlug: string
): Promise<ChartResult<ChartFamily | null>> {
  return withCache(`chart_family_${familySlug}`, async () => {
    if (isMock()) {
      const csvData = await useCsvPublicData();
      const family = csvData ? await getCsvFamily(familySlug) : getMockFamily(familySlug);
      return { data: family ? { ...family } : null, source: "mock" };
    }
    const res = await publicWpGet<{ family: unknown }>(`/charts/${familySlug}`);
    return {
      data: res.family ? fromWpChartFamily(res.family) : null,
      source: "wordpress",
    };
  });
}

export function getChartEditionsForFamily(
  familySlug: string
): Promise<ChartResult<ChartEdition[]>> {
  return withCache(`chart_family_editions_${familySlug}`, async () => {
    if (isMock()) {
      const csvData = await useCsvPublicData();
      return {
        data: csvData ? await getCsvEditionsForFamily(familySlug) : getMockEditionsForFamily(familySlug),
        source: "mock",
      };
    }
    const res = await publicWpGet<{ editions: unknown[] }>(
      `/charts/${familySlug}/editions`
    );
    return {
      data: (res.editions || []).map(fromWpChartEdition),
      source: "wordpress",
    };
  });
}

export function getLatestChartEdition(
  familySlug: string
): Promise<ChartResult<ChartEdition | null>> {
  return withCache(`chart_latest_${familySlug}`, async () => {
    if (isMock()) {
      const csvData = await useCsvPublicData();
      const edition = csvData ? await getCsvLatestEdition(familySlug) : getMockLatestEdition(familySlug);
      return { data: edition ? { ...edition } : null, source: "mock" };
    }
    const res = await publicWpGet<{ edition: unknown }>(
      `/charts/${familySlug}/latest`
    );
    return {
      data: res.edition ? fromWpChartEdition(res.edition) : null,
      source: "wordpress",
    };
  });
}

export function getChartEdition(
  familySlug: string,
  editionSlug: string
): Promise<ChartResult<ChartEdition | null>> {
  return withCache(
    `chart_edition_${familySlug}_${editionSlug}`,
    async () => {
      if (isMock()) {
        const csvData = await useCsvPublicData();
        const edition = csvData ? await getCsvEdition(familySlug, editionSlug) : getMockEdition(familySlug, editionSlug);
        return { data: edition ? { ...edition } : null, source: "mock" };
      }
      const res = await publicWpGet<{ edition: unknown }>(
        `/charts/${familySlug}/${editionSlug}`
      );
      return {
        data: res.edition ? fromWpChartEdition(res.edition) : null,
        source: "wordpress",
      };
    }
  );
}

export function getChartEditionEntries(
  familySlug: string,
  editionSlug: string
): Promise<ChartResult<ChartEditionEntry[]>> {
  return withCache(
    `chart_entries_${familySlug}_${editionSlug}`,
    async () => {
      if (isMock()) {
        const csvData = await useCsvPublicData();
        return {
          data: csvData
            ? await getCsvEntriesForEdition(familySlug, editionSlug)
            : getMockEntriesForEdition(familySlug, editionSlug),
          source: "mock",
        };
      }
      const res = await publicWpGet<{ entries: unknown[] }>(
        `/charts/${familySlug}/${editionSlug}/entries`
      );
      return {
        data: (res.entries || []) as ChartEditionEntry[],
        source: "wordpress",
      };
    }
  );
}

export function getTrackChartHistory(
  trackSlug: string
): Promise<ChartResult<TrackChartHistory | null>> {
  return withCache(`track_history_${trackSlug}`, async () => {
    if (isMock()) {
      const csvData = await useCsvPublicData();
      const csvHistory = csvData ? await getCsvTrackHistory(trackSlug) : null;
      if (csvHistory) return { data: csvHistory, source: "mock" };
      if (trackSlug === "midnight-dreams") {
        return { data: { ...MOCK_TRACK_HISTORY }, source: "mock" };
      }
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
        source: "mock",
      };
    }
    const res = await publicWpGet<{ history: unknown }>(
      `/tracks/${trackSlug}/chart-history`
    );
    return {
      data: res.history ? (res.history as TrackChartHistory) : null,
      source: "wordpress",
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