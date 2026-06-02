const STUDIO_STORE_KEY = "wkcharts_ingest_studio_v1";

export type IngestRunMarketScopePatch = {
  marketScopeId: string | null;
  marketScopeSnapshot?: {
    id: string;
    name: string;
    slug: string;
    primaryMarketSlug: string;
    includedMarkets: Array<{ marketSlug: string; countryCode: string; weight?: number }>;
    aggregationMode: string;
  } | null;
};

type LocalStudioStore = {
  runs?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export function persistIngestRunMarketScope(runId: string, patch: IngestRunMarketScopePatch): boolean {
  if (typeof window === "undefined") return false;

  try {
    const raw = localStorage.getItem(STUDIO_STORE_KEY);
    if (!raw) return false;

    const store = JSON.parse(raw) as LocalStudioStore;
    if (!Array.isArray(store.runs)) return false;

    let changed = false;
    store.runs = store.runs.map((run) => {
      if (run.id !== runId) return run;
      changed = true;
      return {
        ...run,
        marketScopeId: patch.marketScopeId,
        marketScopeSnapshot: patch.marketScopeSnapshot ?? null,
        updatedAt: new Date().toISOString(),
      };
    });

    if (!changed) return false;
    localStorage.setItem(STUDIO_STORE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function getIngestRunMarketScope(runId: string): IngestRunMarketScopePatch | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STUDIO_STORE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw) as LocalStudioStore;
    const run = store.runs?.find((item) => item.id === runId);
    if (!run) return null;
    return {
      marketScopeId: typeof run.marketScopeId === "string" ? run.marketScopeId : null,
      marketScopeSnapshot: (run.marketScopeSnapshot as IngestRunMarketScopePatch["marketScopeSnapshot"]) ?? null,
    };
  } catch {
    return null;
  }
}
