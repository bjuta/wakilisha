/**
 * Public Charts API Client
 * Separate from the admin ingestion adapter.
 * Provides read-only access to published chart data for the public-facing pages.
 *
 * Future endpoints:
 * GET /wp-json/wakilisha/v1/charts
 * GET /wp-json/wakilisha/v1/charts/:family
 * GET /wp-json/wakilisha/v1/charts/:family/latest
 * GET /wp-json/wakilisha/v1/charts/:family/:edition
 * GET /wp-json/wakilisha/v1/charts/:family/:edition/entries
 * GET /wp-json/wakilisha/v1/tracks/:slug/chart-history
 */

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

// ─── Configuration ───
const PUBLIC_API_BASE =
  import.meta.env.VITE_WAKILISHA_WP_API_BASE ||
  "/wp-json/wakilisha/v1";

const PUBLIC_MODE =
  (import.meta.env.VITE_CHARTS_PUBLIC_MODE as "mock" | "wordpress") ||
  "mock";

// ─── Dev warning ───
if (import.meta.env.DEV && !import.meta.env.VITE_WAKILISHA_WP_API_BASE) {
  // eslint-disable-next-line no-console
  console.warn(
    "[chartsPublic] VITE_WAKILISHA_WP_API_BASE is not set. Public charts client will use default '/wp-json/wakilisha/v1'"
  );
}

// ─── HTTP Helpers ───

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

// ─── Mock Data (for development before backend is wired) ───

const MOCK_FAMILIES: ChartFamily[] = [
  {
    id: "top-40",
    familyKey: "top-40",
    label: "Top 40",
    description: "The official weekly Top 40 chart featuring the most popular tracks across all platforms.",
    defaultChartSize: 40,
    defaultRegion: "global",
    editionFrequency: "weekly",
    defaultRuleset: "default",
    defaultScoringModel: "weighted_streaming",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "top-100",
    familyKey: "top-100",
    label: "Top 100",
    description: "Extended weekly Top 100 chart with deeper catalog coverage.",
    defaultChartSize: 100,
    defaultRegion: "global",
    editionFrequency: "weekly",
    defaultRuleset: "extended",
    defaultScoringModel: "weighted_streaming",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "breakout",
    familyKey: "breakout",
    label: "Breakout",
    description: "Tracks breaking into the mainstream for the first time.",
    defaultChartSize: 20,
    defaultRegion: "global",
    editionFrequency: "weekly",
    defaultRuleset: "breakout",
    defaultScoringModel: "velocity_weighted",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

const MOCK_EDITIONS: ChartEdition[] = [
  {
    id: "ed-2026-w22",
    familyId: "top-40",
    slug: "week-22-2026",
    label: "Week 22, 2026",
    date: "2026-05-31",
    periodStart: "2026-05-24",
    periodEnd: "2026-05-30",
    status: "published",
    ingestJobId: "job-2026-w22",
    publishedAt: "2026-05-31T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 40,
    newEntries: 3,
    reEntries: 1,
  },
  {
    id: "ed-2026-w21",
    familyId: "top-40",
    slug: "week-21-2026",
    label: "Week 21, 2026",
    date: "2026-05-24",
    periodStart: "2026-05-17",
    periodEnd: "2026-05-23",
    status: "published",
    ingestJobId: "job-2026-w21",
    publishedAt: "2026-05-24T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 40,
    newEntries: 2,
    reEntries: 0,
  },
];

const MOCK_ENTRIES: ChartEditionEntry[] = [
  {
    id: "entry-001",
    editionId: "ed-2026-w22",
    rank: 1,
    previousRank: 2,
    movement: "up",
    peakPosition: 1,
    weeksOnChart: 8,
    trackSlug: "midnight-dreams",
    trackTitle: "Midnight Dreams",
    artistSlugs: ["luna-stark"],
    artistNames: ["Luna Stark"],
    artworkUrl: "https://readdy.ai/api/search-image?query=abstract%20album%20cover%20art%20with%20midnight%20blue%20and%20silver%20tones%2C%20dreamy%20atmospheric%2C%20minimal%20design&width=300&height=300&seq=1&orientation=squarish",
    score: 985.4,
    entryPayload: {},
  },
  {
    id: "entry-002",
    editionId: "ed-2026-w22",
    rank: 2,
    previousRank: 1,
    movement: "down",
    peakPosition: 1,
    weeksOnChart: 12,
    trackSlug: "golden-hour",
    trackTitle: "Golden Hour",
    artistSlugs: ["the-radiants"],
    artistNames: ["The Radiants"],
    artworkUrl: "https://readdy.ai/api/search-image?query=abstract%20album%20cover%20art%20with%20warm%20golden%20tones%2C%20sunset%20inspired%2C%20minimal%20design&width=300&height=300&seq=2&orientation=squarish",
    score: 972.1,
    entryPayload: {},
  },
  {
    id: "entry-003",
    editionId: "ed-2026-w22",
    rank: 3,
    previousRank: 5,
    movement: "up",
    peakPosition: 3,
    weeksOnChart: 4,
    trackSlug: "electric-soul",
    trackTitle: "Electric Soul",
    artistSlugs: ["kai-nova"],
    artistNames: ["Kai Nova"],
    artworkUrl: "https://readdy.ai/api/search-image?query=abstract%20album%20cover%20art%20with%20electric%20purple%20and%20neon%20pink%20tones%2C%20energetic%2C%20minimal%20design&width=300&height=300&seq=3&orientation=squarish",
    score: 954.7,
    entryPayload: {},
  },
];

const MOCK_TRACK_HISTORY: TrackChartHistory = {
  trackSlug: "midnight-dreams",
  trackTitle: "Midnight Dreams",
  artistNames: ["Luna Stark"],
  appearances: [
    { editionSlug: "week-22-2026", editionLabel: "Week 22, 2026", rank: 1, weeksOnChart: 8, movement: "up" as const },
    { editionSlug: "week-21-2026", editionLabel: "Week 21, 2026", rank: 2, weeksOnChart: 7, movement: "same" as const },
    { editionSlug: "week-20-2026", editionLabel: "Week 20, 2026", rank: 3, weeksOnChart: 6, movement: "up" as const },
  ],
  peakPosition: 1,
  totalWeeksOnChart: 8,
  firstAppearance: "2026-04-05",
  latestAppearance: "2026-05-31",
};

// ─── Public API Functions ───

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
    const family = MOCK_FAMILIES.find((f) => f.slug === familySlug || f.familyKey === familySlug);
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
    const edition = MOCK_EDITIONS.find((e) => e.familyId === familySlug);
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
    const edition = MOCK_EDITIONS.find(
      (e) => e.familyId === familySlug && e.slug === editionSlug
    );
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
    const edition = MOCK_EDITIONS.find(
      (e) => e.familyId === familySlug && e.slug === editionSlug
    );
    if (!edition) return Promise.resolve([]);
    return Promise.resolve([...MOCK_ENTRIES]);
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