const STUDIO_STORE_KEY = "wkcharts_ingest_studio_v1";
const CURRENT_MARKET_SCOPE_KEY = "wkcharts_current_ingest_market_scope_v1";

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

type PendingMarketScopeSelection = IngestRunMarketScopePatch & {
  selectedAt: string;
};

type LocalStudioStore = {
  runs?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

let pendingPatchTimer: number | null = null;

function readStore(): LocalStudioStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STUDIO_STORE_KEY);
    return raw ? (JSON.parse(raw) as LocalStudioStore) : null;
  } catch {
    return null;
  }
}

function writeStore(store: LocalStudioStore): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STUDIO_STORE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function persistIngestRunMarketScope(runId: string, patch: IngestRunMarketScopePatch): boolean {
  const store = readStore();
  if (!store || !Array.isArray(store.runs)) return false;

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
  return writeStore(store);
}

export function getIngestRunMarketScope(runId: string): IngestRunMarketScopePatch | null {
  const store = readStore();
  if (!store || !Array.isArray(store.runs)) return null;
  const run = store.runs.find((item) => item.id === runId);
  if (!run) return null;
  return {
    marketScopeId: typeof run.marketScopeId === "string" ? run.marketScopeId : null,
    marketScopeSnapshot: (run.marketScopeSnapshot as IngestRunMarketScopePatch["marketScopeSnapshot"]) ?? null,
  };
}

export function setCurrentIngestMarketScopeSelection(patch: IngestRunMarketScopePatch): void {
  if (typeof window === "undefined") return;
  const pending: PendingMarketScopeSelection = { ...patch, selectedAt: new Date().toISOString() };
  try {
    localStorage.setItem(CURRENT_MARKET_SCOPE_KEY, JSON.stringify(pending));
  } catch {
    return;
  }
  startPendingMarketScopeMonitor();
}

export function getCurrentIngestMarketScopeSelection(): PendingMarketScopeSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CURRENT_MARKET_SCOPE_KEY);
    return raw ? (JSON.parse(raw) as PendingMarketScopeSelection) : null;
  } catch {
    return null;
  }
}

export function persistPendingMarketScopeToLatestRun(): boolean {
  const pending = getCurrentIngestMarketScopeSelection();
  const store = readStore();
  if (!pending || !store || !Array.isArray(store.runs) || store.runs.length === 0) return false;

  const pendingSelectedAt = new Date(pending.selectedAt).getTime();
  const newestRun = [...store.runs]
    .filter((run) => !run.marketScopeId)
    .sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime())[0];

  if (!newestRun || typeof newestRun.id !== "string") return false;

  const runCreatedAt = new Date(String(newestRun.createdAt ?? 0)).getTime();
  const runIsRecentEnough = Number.isFinite(runCreatedAt) && runCreatedAt >= pendingSelectedAt - 5 * 60 * 1000;
  if (!runIsRecentEnough) return false;

  return persistIngestRunMarketScope(newestRun.id, pending);
}

export function startPendingMarketScopeMonitor(): void {
  if (typeof window === "undefined" || pendingPatchTimer !== null) return;
  const startedAt = Date.now();
  pendingPatchTimer = window.setInterval(() => {
    persistPendingMarketScopeToLatestRun();
    if (Date.now() - startedAt > 30_000) {
      if (pendingPatchTimer !== null) window.clearInterval(pendingPatchTimer);
      pendingPatchTimer = null;
    }
  }, 500);
}
