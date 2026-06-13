/**
 * Chart Family Defaults Store
 * Persists per-family ingest configuration so admins can save recurring settings
 * directly from the ingest screen. Future editions reuse saved defaults automatically.
 *
 * Priority: saved defaults > ChartFamily object fallbacks > system defaults
 */

const STORE_KEY = "wkcharts_family_defaults_v1";

export interface ChartFamilyDefaults {
  familyId: string;
  chartTitle: string;
  chartSlug: string;
  chartSize: number;
  market: string;
  chartKind: "tracks" | "releases";
  coverStyle: string;
  eligibilityProfileId: string;
  marketScopeId: string;
  sourceUrlsTemplate: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ChartFamilyDefaultsDiff {
  hasDefaults: boolean;
  fields: {
    chartTitle: boolean;
    chartSlug: boolean;
    chartSize: boolean;
    market: boolean;
    chartKind: boolean;
    coverStyle: boolean;
    eligibilityProfileId: boolean;
    marketScopeId: boolean;
    sourceUrlsTemplate: boolean;
  };
  changedCount: number;
}

function readStore(): Record<string, ChartFamilyDefaults> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Record<string, ChartFamilyDefaults>;
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, ChartFamilyDefaults>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export function getFamilyDefaults(familyId: string): ChartFamilyDefaults | null {
  const store = readStore();
  return store[familyId] ?? null;
}

export function getAllFamilyDefaults(): Record<string, ChartFamilyDefaults> {
  return readStore();
}

export function hasFamilyDefaults(familyId: string): boolean {
  return getFamilyDefaults(familyId) !== null;
}

export function saveFamilyDefaults(
  familyId: string,
  config: Omit<ChartFamilyDefaults, "familyId" | "updatedAt" | "updatedBy"> & { updatedBy?: string },
): ChartFamilyDefaults {
  const store = readStore();
  const defaults: ChartFamilyDefaults = {
    familyId,
    chartTitle: config.chartTitle,
    chartSlug: config.chartSlug,
    chartSize: config.chartSize,
    market: config.market,
    chartKind: config.chartKind,
    coverStyle: config.coverStyle,
    eligibilityProfileId: config.eligibilityProfileId,
    marketScopeId: config.marketScopeId,
    sourceUrlsTemplate: config.sourceUrlsTemplate,
    updatedAt: new Date().toISOString(),
    updatedBy: config.updatedBy ?? "Admin",
  };
  store[familyId] = defaults;
  writeStore(store);
  return defaults;
}

export function deleteFamilyDefaults(familyId: string): void {
  const store = readStore();
  delete store[familyId];
  writeStore(store);
}

export function computeDefaultsDiff(
  familyId: string,
  current: {
    chartTitle: string;
    chartSlug: string;
    chartSize: number;
    market: string;
    chartKind: "tracks" | "releases";
    coverStyle: string;
    eligibilityProfileId: string;
    marketScopeId: string;
    sourceUrls: string;
  },
): ChartFamilyDefaultsDiff {
  const defaults = getFamilyDefaults(familyId);
  if (!defaults) {
    return {
      hasDefaults: false,
      fields: {
        chartTitle: false,
        chartSlug: false,
        chartSize: false,
        market: false,
        chartKind: false,
        coverStyle: false,
        eligibilityProfileId: false,
        marketScopeId: false,
        sourceUrlsTemplate: false,
      },
      changedCount: 0,
    };
  }

  const fields = {
    chartTitle: current.chartTitle !== defaults.chartTitle,
    chartSlug: current.chartSlug !== defaults.chartSlug,
    chartSize: current.chartSize !== defaults.chartSize,
    market: current.market !== defaults.market,
    chartKind: current.chartKind !== defaults.chartKind,
    coverStyle: current.coverStyle !== defaults.coverStyle,
    eligibilityProfileId: current.eligibilityProfileId !== defaults.eligibilityProfileId,
    marketScopeId: current.marketScopeId !== defaults.marketScopeId,
    sourceUrlsTemplate: current.sourceUrls !== defaults.sourceUrlsTemplate,
  };

  const changedCount = Object.values(fields).filter(Boolean).length;

  return {
    hasDefaults: true,
    fields,
    changedCount,
  };
}

export function getFamiliesWithDefaults(familyIds: string[]): Set<string> {
  const store = readStore();
  const result = new Set<string>();
  for (const id of familyIds) {
    if (store[id]) result.add(id);
  }
  return result;
}