import type {
  ChartFamily,
  ChartEdition,
  ChartEditionEntry,
  TrackChartHistory,
} from "./types";

import { clearChartCache, type PublicChartCacheSource } from "./cache";

import {
  getV2ChartFamilies,
  getV2ChartFamily,
  getV2ChartEditionsForFamily,
  getV2LatestChartEdition,
  getV2LatestChartEditionWithEntries,
  getV2ChartEdition,
  getV2ChartEditionEntries,
  getV2TrackChartHistory,
} from "./v2Adapter";

export const PUBLIC_API_BASE = import.meta.env.VITE_PUBLIC_API_BASE || "/api/v1";
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

// Publication can be withdrawn after a response is read. Do not reuse an
// in-memory Edition response or return stale chart data when validation fails.
async function readChartFresh<T>(
  _key: string,
  fetchFn: () => Promise<{ data: T; source: PublicChartCacheSource }>
): Promise<ChartResult<T>> {
  const { data, source } = await fetchFn();
  return { data, meta: { source, fetchedAt: now(), isStale: false } };
}

export function getChartFamilies(): Promise<ChartResult<{ families: ChartFamily[]; editions: ChartEdition[] }>> {
  return readChartFresh("chart_families_public_api", async () => ({
    data: await getV2ChartFamilies(),
    source: "wordpress",
  }));
}

export function getChartFamily(familySlug: string, marketSlug?: string | null): Promise<ChartResult<ChartFamily | null>> {
  const marketKey = marketSlug || "default";
  return readChartFresh(`chart_family_public_api_${familySlug}_${marketKey}`, async () => ({
    data: await getV2ChartFamily(familySlug, marketSlug),
    source: "wordpress",
  }));
}

export function getChartEditionsForFamily(familySlug: string, marketSlug?: string | null): Promise<ChartResult<ChartEdition[]>> {
  const marketKey = marketSlug || "default";
  return readChartFresh(`chart_family_editions_public_api_${familySlug}_${marketKey}`, async () => ({
    data: await getV2ChartEditionsForFamily(familySlug, marketSlug),
    source: "wordpress",
  }));
}

export function getLatestChartEdition(familySlug: string, marketSlug?: string | null): Promise<ChartResult<ChartEdition | null>> {
  const marketKey = marketSlug || "default";
  return readChartFresh(`chart_latest_public_api_${familySlug}_${marketKey}`, async () => ({
    data: await getV2LatestChartEdition(familySlug, marketSlug),
    source: "wordpress",
  }));
}

export function getLatestChartEditionWithEntries(familySlug: string, marketSlug?: string | null): Promise<ChartResult<{ edition: ChartEdition | null; entries: ChartEditionEntry[] }>> {
  const marketKey = marketSlug || "default";
  return readChartFresh(`chart_latest_entries_public_api_${familySlug}_${marketKey}`, async () => ({
    data: await getV2LatestChartEditionWithEntries(familySlug, marketSlug),
    source: "wordpress",
  }));
}

export function getChartEdition(familySlug: string, editionSlug: string, marketSlug?: string | null): Promise<ChartResult<ChartEdition | null>> {
  const marketKey = marketSlug || "default";
  return readChartFresh(`chart_edition_public_api_${familySlug}_${marketKey}_${editionSlug}`, async () => ({
    data: await getV2ChartEdition(familySlug, editionSlug, marketSlug),
    source: "wordpress",
  }));
}

export function getChartEditionEntries(familySlug: string, editionSlug: string, marketSlug?: string | null): Promise<ChartResult<ChartEditionEntry[]>> {
  const marketKey = marketSlug || "default";
  return readChartFresh(`chart_entries_public_api_${familySlug}_${marketKey}_${editionSlug}`, async () => ({
    data: await getV2ChartEditionEntries(familySlug, editionSlug, marketSlug),
    source: "wordpress",
  }));
}

export function getTrackChartHistory(trackSlug: string): Promise<ChartResult<TrackChartHistory | null>> {
  return readChartFresh(`track_history_public_api_${trackSlug}`, async () => ({
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

export {
  getSupabaseChartFamilies,
  getSupabaseChartFamily,
  getSupabaseChartEditionsForFamily,
  getSupabaseLatestChartEdition,
  getSupabaseChartEdition,
  getSupabaseChartEditionEntries,
  getSupabaseTrackChartHistory,
} from "./supabaseRuntime";
