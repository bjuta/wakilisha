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

export const PUBLIC_API_BASE = import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE || "/__wakilisha-v2-api/wp-json/wakilisha/v2";
export const PUBLIC_MODE = "api-first" as const;
export const PUBLIC_API_VERSION = "runtime" as const;

type ApiRow = Record<string, unknown>;

type ApiProgram = ApiRow & {
  id?: string;
  publicSlug?: string;
  publicLabel?: string;
  shortLabel?: string | null;
  sourceFamilySlug?: string | null;
  seriesSlug?: string;
  seriesLabel?: string;
  marketSlug?: string;
  marketLabel?: string;
  periodType?: string | null;
  methodologyVersion?: string | null;
  eligibilityRulesVersion?: string | null;
  latestEdition?: ApiEdition | null;
  archive?: ApiEdition[];
};

type ApiEdition = ApiRow & {
  id?: string;
  slug?: string;
  label?: string;
  date?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  entryCount?: number;
};

type ApiEntry = ApiRow & {
  id?: string;
  editionId?: string;
  rank?: number;
  previousRank?: number | null;
  movement?: string;
  trackSlug?: string | null;
  trackTitle?: string;
  artistSlugs?: string[];
  artistNames?: string[];
  artworkUrl?: string | null;
  score?: number | null;
  sourceEntryId?: string;
};

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

async function fetchPublicApi<T>(path: string): Promise<T> {
  const base = PUBLIC_API_BASE.replace(/\/$/, "");
  const target = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(target, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    throw new PublicChartsApiError(
      `Public charts API request failed: ${response.status}`,
      response.status,
      "public_charts_api_failed",
      response.status >= 500
    );
  }

  const payload = await response.json() as { data?: T };
  if (!payload || !("data" in payload)) {
    throw new PublicChartsApiError("Public charts API returned an invalid payload.", 502, "public_charts_invalid_payload", true);
  }

  return payload.data as T;
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

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const next = Number(value ?? fallback);
  return Number.isFinite(next) ? next : fallback;
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function asPeriodType(value: unknown): ChartFamily["periodType"] {
  return value === "daily" || value === "monthly" || value === "yearly" || value === "evergreen" ? value : "weekly";
}

function asEditionFrequency(value: unknown): ChartFamily["editionFrequency"] {
  return value === "daily" || value === "monthly" ? value : "weekly";
}

function asMovement(value: unknown): ChartEditionEntry["movement"] {
  return value === "up" || value === "down" || value === "same" || value === "new" || value === "re_entry" ? value : "same";
}

function toChartFamilyFromApi(program: ApiProgram): ChartFamily {
  const publicSlug = asString(program.publicSlug, asString(program.id, "chart"));
  const publicLabel = asString(program.publicLabel, publicSlug);
  const periodType = asPeriodType(program.periodType);

  return {
    id: asString(program.id, publicSlug),
    familyKey: publicSlug,
    label: publicLabel,
    description: "",
    defaultChartSize: asNumber(program.latestEdition?.entryCount, 100),
    defaultRegion: asString(program.marketLabel, asString(program.marketSlug, "Kenya")),
    editionFrequency: asEditionFrequency(program.periodType),
    defaultRuleset: asString(program.eligibilityRulesVersion, "legacy-import-v1"),
    defaultScoringModel: asString(program.methodologyVersion, "legacy-import-v1"),
    createdAt: "",
    updatedAt: "",
    slug: publicSlug,
    sourceFamilySlug: asString(program.sourceFamilySlug, publicSlug),
    seriesSlug: asString(program.seriesSlug, publicSlug),
    seriesLabel: asString(program.seriesLabel, publicLabel),
    marketSlug: asString(program.marketSlug, "kenya"),
    marketLabel: asString(program.marketLabel, "Kenya"),
    publicSlug,
    publicLabel,
    shortLabel: asString(program.shortLabel, publicLabel),
    chartMode: "data",
    periodType,
    methodologyVersion: asString(program.methodologyVersion, "legacy-import-v1"),
    eligibilityRulesVersion: asString(program.eligibilityRulesVersion, "legacy-import-v1"),
    legacySlugs: [],
  };
}

function toChartEditionFromApi(edition: ApiEdition, familyId: string): ChartEdition {
  const slug = asString(edition.slug, asString(edition.id, "edition"));
  const date = asString(edition.date);
  return {
    id: asString(edition.id, slug),
    familyId,
    slug,
    label: asString(edition.label, slug),
    date,
    periodStart: asString(edition.periodStart, date),
    periodEnd: asString(edition.periodEnd, date),
    status: "published",
    ingestJobId: null,
    publishedAt: null,
    publishedBy: null,
    entryCount: asNumber(edition.entryCount),
    newEntries: 0,
    reEntries: 0,
  };
}

function toChartEntryFromApi(entry: ApiEntry, editionId: string): ChartEditionEntry {
  const trackSlug = asString(entry.trackSlug);
  return {
    id: asString(entry.id, asString(entry.sourceEntryId, `${editionId}-${entry.rank ?? "entry"}`)),
    editionId: asString(entry.editionId, editionId),
    rank: asNumber(entry.rank),
    previousRank: entry.previousRank === null || entry.previousRank === undefined ? null : asNumber(entry.previousRank),
    movement: asMovement(entry.movement),
    peakPosition: null,
    weeksOnChart: null,
    trackSlug,
    trackTitle: asString(entry.trackTitle, trackSlug),
    artistSlugs: asArray(entry.artistSlugs),
    artistNames: asArray(entry.artistNames),
    artworkUrl: asString(entry.artworkUrl) || null,
    score: entry.score === null || entry.score === undefined ? 0 : asNumber(entry.score),
    entryPayload: entry,
  };
}

async function fallbackFamilies(): Promise<ChartFamily[]> {
  const csvData = await useCsvPublicData();
  return csvData ? await getCsvFamilies() : [...MOCK_FAMILIES];
}

async function fallbackFamily(familySlug: string): Promise<ChartFamily | null> {
  const csvData = await useCsvPublicData();
  return csvData ? await getCsvFamily(familySlug) : getMockFamily(familySlug);
}

async function fallbackEditionsForFamily(familySlug: string): Promise<ChartEdition[]> {
  const csvData = await useCsvPublicData();
  return csvData ? await getCsvEditionsForFamily(familySlug) : getMockEditionsForFamily(familySlug);
}

async function fallbackLatestEdition(familySlug: string): Promise<ChartEdition | null> {
  const csvData = await useCsvPublicData();
  return csvData ? await getCsvLatestEdition(familySlug) : getMockLatestEdition(familySlug);
}

async function fallbackEdition(familySlug: string, editionSlug: string): Promise<ChartEdition | null> {
  const csvData = await useCsvPublicData();
  return csvData ? await getCsvEdition(familySlug, editionSlug) : getMockEdition(familySlug, editionSlug);
}

async function fallbackEntries(familySlug: string, editionSlug: string): Promise<ChartEditionEntry[]> {
  const csvData = await useCsvPublicData();
  return csvData ? await getCsvEntriesForEdition(familySlug, editionSlug) : getMockEntriesForEdition(familySlug, editionSlug);
}

export function getChartFamilies(): Promise<ChartResult<ChartFamily[]>> {
  return withCache("chart_families_runtime", async () => {
    try {
      const api = await fetchPublicApi<{ programs: ApiProgram[] }>("/charts");
      return { data: (api.programs ?? []).map(toChartFamilyFromApi), source: "api" };
    } catch {
      return { data: await fallbackFamilies(), source: "local" };
    }
  });
}

export function getChartFamily(familySlug: string): Promise<ChartResult<ChartFamily | null>> {
  return withCache(`chart_family_runtime_${familySlug}`, async () => {
    try {
      const api = await fetchPublicApi<{ program: ApiProgram }>(`/charts/${encodeURIComponent(familySlug)}`);
      return { data: api.program ? toChartFamilyFromApi(api.program) : null, source: "api" };
    } catch {
      const family = await fallbackFamily(familySlug);
      return { data: family ? { ...family } : null, source: "local" };
    }
  });
}

export function getChartEditionsForFamily(familySlug: string): Promise<ChartResult<ChartEdition[]>> {
  return withCache(`chart_family_editions_runtime_${familySlug}`, async () => {
    try {
      const api = await fetchPublicApi<{ program: ApiProgram }>(`/charts/${encodeURIComponent(familySlug)}`);
      const familyId = asString(api.program?.publicSlug, familySlug);
      return { data: (api.program?.archive ?? []).map((edition) => toChartEditionFromApi(edition, familyId)), source: "api" };
    } catch {
      return { data: await fallbackEditionsForFamily(familySlug), source: "local" };
    }
  });
}

export function getLatestChartEdition(familySlug: string): Promise<ChartResult<ChartEdition | null>> {
  return withCache(`chart_latest_runtime_${familySlug}`, async () => {
    try {
      const api = await fetchPublicApi<{ edition: ApiEdition | null; program?: ApiProgram }>(`/charts/${encodeURIComponent(familySlug)}/latest`);
      const familyId = asString(api.program?.publicSlug, familySlug);
      return { data: api.edition ? toChartEditionFromApi(api.edition, familyId) : null, source: "api" };
    } catch {
      const edition = await fallbackLatestEdition(familySlug);
      return { data: edition ? { ...edition } : null, source: "local" };
    }
  });
}

export function getChartEdition(familySlug: string, editionSlug: string): Promise<ChartResult<ChartEdition | null>> {
  return withCache(`chart_edition_runtime_${familySlug}_${editionSlug}`, async () => {
    try {
      const api = await fetchPublicApi<{ edition: ApiEdition | null; program?: ApiProgram }>(`/charts/${encodeURIComponent(familySlug)}/${encodeURIComponent(editionSlug)}`);
      const familyId = asString(api.program?.publicSlug, familySlug);
      return { data: api.edition ? toChartEditionFromApi(api.edition, familyId) : null, source: "api" };
    } catch {
      const edition = await fallbackEdition(familySlug, editionSlug);
      return { data: edition ? { ...edition } : null, source: "local" };
    }
  });
}

export function getChartEditionEntries(familySlug: string, editionSlug: string): Promise<ChartResult<ChartEditionEntry[]>> {
  return withCache(`chart_entries_runtime_${familySlug}_${editionSlug}`, async () => {
    try {
      const api = await fetchPublicApi<{ entries: ApiEntry[] }>(`/charts/${encodeURIComponent(familySlug)}/${encodeURIComponent(editionSlug)}/entries`);
      return { data: (api.entries ?? []).map((entry) => toChartEntryFromApi(entry, editionSlug)), source: "api" };
    } catch {
      return { data: await fallbackEntries(familySlug, editionSlug), source: "local" };
    }
  });
}

export function getTrackChartHistory(trackSlug: string): Promise<ChartResult<TrackChartHistory | null>> {
  return withCache(`track_history_runtime_${trackSlug}`, async () => {
    try {
      const api = await fetchPublicApi<{ history: TrackChartHistory | null }>(`/tracks/${encodeURIComponent(trackSlug)}/chart-history`);
      return { data: api.history ?? null, source: "api" };
    } catch {
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
    }
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
