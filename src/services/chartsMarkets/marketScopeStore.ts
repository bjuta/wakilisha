import type { ChartMarketScope } from "../chartsEligibility/eligibilityTypes";

const STORAGE_KEY = "wakilisha_chart_market_scopes_v1";

function now() {
  return new Date().toISOString();
}

export type StoredChartMarketScope = ChartMarketScope & {
  id: string;
  name: string;
  slug: string;
  description: string;
  visibility: "public" | "admin_only";
  createdAt: string;
  updatedAt: string;
};

export type CreateChartMarketScopeRequest = Omit<StoredChartMarketScope, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

export type UpdateChartMarketScopeRequest = Partial<CreateChartMarketScopeRequest> & {
  id: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function baseScope(overrides: Partial<StoredChartMarketScope>): StoredChartMarketScope {
  const timestamp = now();
  const name = overrides.name ?? "Kenya";
  return {
    id: overrides.id ?? `scope_${slugify(name)}`,
    name,
    slug: overrides.slug ?? slugify(name),
    description: overrides.description ?? "Default chart market scope.",
    visibility: overrides.visibility ?? "admin_only",
    primaryMarketSlug: overrides.primaryMarketSlug ?? "kenya",
    includedMarkets: overrides.includedMarkets ?? [{ marketSlug: "kenya", countryCode: "KE" }],
    aggregationMode: overrides.aggregationMode ?? "combined",
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  };
}

export const DEFAULT_MARKET_SCOPES: StoredChartMarketScope[] = [
  baseScope({
    id: "scope_kenya",
    name: "Kenya",
    slug: "kenya",
    description: "Single-country Kenya market scope.",
    visibility: "public",
    primaryMarketSlug: "kenya",
    includedMarkets: [{ marketSlug: "kenya", countryCode: "KE" }],
    aggregationMode: "combined",
  }),
  baseScope({
    id: "scope_nigeria",
    name: "Nigeria",
    slug: "nigeria",
    description: "Single-country Nigeria market scope.",
    visibility: "public",
    primaryMarketSlug: "nigeria",
    includedMarkets: [{ marketSlug: "nigeria", countryCode: "NG" }],
    aggregationMode: "combined",
  }),
  baseScope({
    id: "scope_east_africa_ke_ug_tz",
    name: "East Africa — Kenya, Uganda, Tanzania",
    slug: "east-africa-ke-ug-tz",
    description: "Multi-country East Africa scope preserving Kenya, Uganda, and Tanzania separately for analytics.",
    visibility: "admin_only",
    primaryMarketSlug: "east-africa",
    includedMarkets: [
      { marketSlug: "kenya", countryCode: "KE", weight: 1 },
      { marketSlug: "uganda", countryCode: "UG", weight: 1 },
      { marketSlug: "tanzania", countryCode: "TZ", weight: 1 },
    ],
    aggregationMode: "separate_then_combined",
  }),
  baseScope({
    id: "scope_global_african",
    name: "Global African",
    slug: "global-african",
    description: "Global African music scope for pan-African/diaspora chart programs.",
    visibility: "public",
    primaryMarketSlug: "global-african",
    includedMarkets: [
      { marketSlug: "kenya", countryCode: "KE" },
      { marketSlug: "nigeria", countryCode: "NG" },
      { marketSlug: "south-africa", countryCode: "ZA" },
      { marketSlug: "ghana", countryCode: "GH" },
      { marketSlug: "uganda", countryCode: "UG" },
      { marketSlug: "tanzania", countryCode: "TZ" },
    ],
    aggregationMode: "editorial",
  }),
];

function readStoredScopes(): StoredChartMarketScope[] {
  if (typeof window === "undefined") return DEFAULT_MARKET_SCOPES;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_MARKET_SCOPES;
  try {
    const parsed = JSON.parse(raw) as StoredChartMarketScope[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MARKET_SCOPES;
  } catch {
    return DEFAULT_MARKET_SCOPES;
  }
}

function writeStoredScopes(scopes: StoredChartMarketScope[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scopes));
}

export function getMarketScopes(): StoredChartMarketScope[] {
  return readStoredScopes();
}

export function getMarketScope(idOrSlug: string): StoredChartMarketScope | null {
  return getMarketScopes().find((scope) => scope.id === idOrSlug || scope.slug === idOrSlug) ?? null;
}

export function createMarketScope(request: CreateChartMarketScopeRequest): StoredChartMarketScope {
  const scopes = getMarketScopes();
  const scope = baseScope({ ...request, id: request.id ?? `scope_${slugify(request.slug || request.name)}` });
  if (scopes.some((existing) => existing.slug === scope.slug || existing.id === scope.id)) {
    throw new Error(`Market scope already exists for ${scope.slug}.`);
  }
  const next = [...scopes, scope];
  writeStoredScopes(next);
  return scope;
}

export function updateMarketScope(request: UpdateChartMarketScopeRequest): StoredChartMarketScope {
  const scopes = getMarketScopes();
  const existing = scopes.find((scope) => scope.id === request.id);
  if (!existing) throw new Error(`Market scope not found: ${request.id}.`);
  const updated: StoredChartMarketScope = {
    ...existing,
    ...request,
    slug: request.slug ?? existing.slug,
    updatedAt: now(),
  };
  writeStoredScopes(scopes.map((scope) => (scope.id === request.id ? updated : scope)));
  return updated;
}

export function resetMarketScopes(): StoredChartMarketScope[] {
  writeStoredScopes(DEFAULT_MARKET_SCOPES);
  return DEFAULT_MARKET_SCOPES;
}
