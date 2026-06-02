import type { IngestEnrichmentOptions } from "./enrichmentOptions";

const STUDIO_STORE_KEY = "wkcharts_ingest_studio_v1";
const CURRENT_ENRICHMENT_OPTIONS_KEY = "wkcharts_current_ingest_enrichment_options_v1";

export type IngestRunEnrichmentOptionsPatch = {
  enrichmentOptions: IngestEnrichmentOptions;
};

type PendingEnrichmentOptionsSelection = IngestRunEnrichmentOptionsPatch & {
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

export function persistIngestRunEnrichmentOptions(runId: string, patch: IngestRunEnrichmentOptionsPatch): boolean {
  const store = readStore();
  if (!store || !Array.isArray(store.runs)) return false;

  let changed = false;
  store.runs = store.runs.map((run) => {
    if (run.id !== runId) return run;
    changed = true;
    return {
      ...run,
      enrichmentOptions: patch.enrichmentOptions,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!changed) return false;
  return writeStore(store);
}

export function getIngestRunEnrichmentOptions(runId: string): IngestRunEnrichmentOptionsPatch | null {
  const store = readStore();
  if (!store || !Array.isArray(store.runs)) return null;
  const run = store.runs.find((item) => item.id === runId);
  if (!run || typeof run.enrichmentOptions !== "object" || run.enrichmentOptions === null) return null;
  return { enrichmentOptions: run.enrichmentOptions as IngestEnrichmentOptions };
}

export function setCurrentIngestEnrichmentOptionsSelection(patch: IngestRunEnrichmentOptionsPatch): void {
  if (typeof window === "undefined") return;
  const pending: PendingEnrichmentOptionsSelection = { ...patch, selectedAt: new Date().toISOString() };
  try {
    localStorage.setItem(CURRENT_ENRICHMENT_OPTIONS_KEY, JSON.stringify(pending));
  } catch {
    return;
  }
  startPendingEnrichmentOptionsMonitor();
}

export function getCurrentIngestEnrichmentOptionsSelection(): PendingEnrichmentOptionsSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CURRENT_ENRICHMENT_OPTIONS_KEY);
    return raw ? (JSON.parse(raw) as PendingEnrichmentOptionsSelection) : null;
  } catch {
    return null;
  }
}

export function persistPendingEnrichmentOptionsToLatestRun(): boolean {
  const pending = getCurrentIngestEnrichmentOptionsSelection();
  const store = readStore();
  if (!pending || !store || !Array.isArray(store.runs) || store.runs.length === 0) return false;

  const pendingSelectedAt = new Date(pending.selectedAt).getTime();
  const newestRun = [...store.runs]
    .filter((run) => !run.enrichmentOptions)
    .sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime())[0];

  if (!newestRun || typeof newestRun.id !== "string") return false;

  const runCreatedAt = new Date(String(newestRun.createdAt ?? 0)).getTime();
  const runIsRecentEnough = Number.isFinite(runCreatedAt) && runCreatedAt >= pendingSelectedAt - 5 * 60 * 1000;
  if (!runIsRecentEnough) return false;

  return persistIngestRunEnrichmentOptions(newestRun.id, pending);
}

export function startPendingEnrichmentOptionsMonitor(): void {
  if (typeof window === "undefined" || pendingPatchTimer !== null) return;
  const startedAt = Date.now();
  pendingPatchTimer = window.setInterval(() => {
    persistPendingEnrichmentOptionsToLatestRun();
    if (Date.now() - startedAt > 30_000) {
      if (pendingPatchTimer !== null) window.clearInterval(pendingPatchTimer);
      pendingPatchTimer = null;
    }
  }, 500);
}
