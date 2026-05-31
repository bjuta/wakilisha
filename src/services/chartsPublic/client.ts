// ... existing code ...
import type {
  ChartFamily,
  ChartEdition,
  ChartEditionEntry,
  ChartEntry,
  TrackChartHistory,
} from "./types";

import {
  fromWpChartFamily,
  fromWpChartEdition,
} from "../chartsIngestion/normalizers";

import {
  MOCK_FAMILIES,
  MOCK_EDITIONS,
  MOCK_ENTRIES,
  MOCK_TRACK_HISTORY,
  getMockEntriesForEdition,
  getMockLatestEdition,
  getMockEdition,
  getMockFamily,
} from "./mockData";

// ... existing code ...
const PUBLIC_API_BASE =
  import.meta.env.VITE_WAKILISHA_WP_API_BASE ||
  "/wp-json/wakilisha/v1";

const PUBLIC_MODE =
  (import.meta.env.VITE_CHARTS_PUBLIC_MODE as "mock" | "wordpress") ||
  "mock";

// ... existing code ...
if (import.meta.env.DEV && !import.meta.env.VITE_WAKILISHA_WP_API_BASE) {
  // eslint-disable-next-line no-console
  console.warn(
    "[chartsPublic] VITE_WAKILISHA_WP_API_BASE is not set. Public charts client will use default '/wp-json/wakilisha/v1'"
  );
}

// ... existing code ...
class PublicApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
  }
}

async function publicRequest<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${PUBLIC_API_BASE}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
      credentials: "same-origin",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      throw new PublicApiError(
        text || `Public API returned ${response.status}`,
        response.status
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof PublicApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new PublicApiError("Request timed out", 504);
    }
    throw new PublicApiError(
      err instanceof Error ? err.message : "Unknown error",
      500
    );
  }
}

// ... existing code ...
function isMock(): boolean {
  return PUBLIC_MODE === "mock";
}

export function getChartFamilies(): Promise<ChartFamily[]> {
  if (isMock()) {
    return Promise.resolve([...MOCK_FAMILIES]);
  }
  return publicRequest<{ families: unknown[] }>("/charts")
    .then((res) => (res.families || []).map(fromWpChartFamily))
    .catch((err) => {
      throw new Error(`getChartFamilies failed: ${err.message}`);
    });
}

export function getChartFamily(familySlug: string): Promise<ChartFamily | null> {
  if (isMock()) {
    const family = getMockFamily(familySlug);
    return Promise.resolve(family ? { ...family } : null);
  }
  return publicRequest<{ family: unknown }>(`/charts/${familySlug}`)
    .then((res) => (res.family ? fromWpChartFamily(res.family) : null))
    .catch((err) => {
      throw new Error(`getChartFamily failed: ${err.message}`);
    });
}

export function getLatestChartEdition(familySlug: string): Promise<ChartEdition | null> {
  if (isMock()) {
    const edition = getMockLatestEdition(familySlug);
    return Promise.resolve(edition ? { ...edition } : null);
  }
  return publicRequest<{ edition: unknown }>(`/charts/${familySlug}/latest`)
    .then((res) => (res.edition ? fromWpChartEdition(res.edition) : null))
    .catch((err) => {
      throw new Error(`getLatestChartEdition failed: ${err.message}`);
    });
}

export function getChartEdition(
  familySlug: string,
  editionSlug: string
): Promise<ChartEdition | null> {
  if (isMock()) {
    const edition = getMockEdition(familySlug, editionSlug);
    return Promise.resolve(edition ? { ...edition } : null);
  }
  return publicRequest<{ edition: unknown }>(`/charts/${familySlug}/${editionSlug}`)
    .then((res) => (res.edition ? fromWpChartEdition(res.edition) : null))
    .catch((err) => {
      throw new Error(`getChartEdition failed: ${err.message}`);
    });
}

export function getChartEditionEntries(
  familySlug: string,
  editionSlug: string
): Promise<ChartEditionEntry[]> {
  if (isMock()) {
    return Promise.resolve(getMockEntriesForEdition(familySlug, editionSlug));
  }
  return publicRequest<{ entries: unknown[] }>(`/charts/${familySlug}/${editionSlug}/entries`)
    .then((res) => (res.entries || []) as ChartEditionEntry[])
    .catch((err) => {
      throw new Error(`getChartEditionEntries failed: ${err.message}`);
    });
}

export function getTrackChartHistory(trackSlug: string): Promise<TrackChartHistory | null> {
  if (isMock()) {
    if (trackSlug === "midnight-dreams") {
      return Promise.resolve({ ...MOCK_TRACK_HISTORY });
    }
    return Promise.resolve({
      trackSlug,
      trackTitle: "Unknown Track",
      artistNames: [],
      appearances: [],
      peakPosition: 0,
      totalWeeksOnChart: 0,
      firstAppearance: null,
      latestAppearance: null,
    });
  }
  return publicRequest<{ history: unknown }>(`/tracks/${trackSlug}/chart-history`)
    .then((res) => (res.history ? res.history as TrackChartHistory : null))
    .catch((err) => {
      throw new Error(`getTrackChartHistory failed: ${err.message}`);
    });
}

// ─── Re-export types ───
export type { ChartFamily, ChartEdition, ChartEditionEntry, ChartEntry, TrackChartHistory };
export { PublicApiError, PUBLIC_MODE };
export {
  getMockEntriesForEdition,
  getMockLatestEdition,
  getMockEdition,
  getMockFamily,
} from "./mockData";
export {
  toChartDirectoryViewModel,
  toChartEditionViewModel,
  toChartEntryRowViewModel,
  toChartTrackPlayerModel,
  toChartTrackPlayerModels,
  toChartFamilyViewModel,
} from "./viewModels";
export type {
  ChartDirectoryViewModel,
  ChartEditionViewModel,
  ChartEntryRowViewModel,
  ChartFamilyViewModel,
  ChartTrackPlayerModel,
} from "./viewModels";