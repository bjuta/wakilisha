/**
 * Sprint 5: V2 Edition Store (mock)
 * localStorage-backed persistence for committed V2 editions, entries, and coverage.
 * Simulates wk_chart_editions_v2, wk_chart_entries_v2, wk_chart_source_coverage_v2.
 */

import type { V2Edition, V2Entry, V2SourceCoverage, V2AuditEvent } from "./commitTypes";

const STORE_KEY = "wkcharts_v2_editions_store_v1";

interface V2EditionStore {
  editions: V2Edition[];
  entries: V2Entry[];
  sourceCoverage: V2SourceCoverage[];
  auditEvents: V2AuditEvent[];
}

function loadStore(): V2EditionStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as V2EditionStore;
      if (Array.isArray(parsed.editions)) return parsed;
    }
  } catch {
    // ignore
  }
  return { editions: [], entries: [], sourceCoverage: [], auditEvents: [] };
}

function saveStore(store: V2EditionStore): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

let store = loadStore();

export function getV2EditionStore(): V2EditionStore {
  return store;
}

export function refreshV2EditionStore(): V2EditionStore {
  store = loadStore();
  return store;
}

export function resetV2EditionStore(): void {
  store = { editions: [], entries: [], sourceCoverage: [], auditEvents: [] };
  saveStore(store);
}

// ─── Queries ───

export function getAllV2Editions(): V2Edition[] {
  return store.editions.slice().sort((a, b) =>
    new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime()
  );
}

export function getV2EditionsByProgram(publicSlug: string): V2Edition[] {
  return store.editions
    .filter((e) => e.publicSlug === publicSlug)
    .sort((a, b) => new Date(b.editionDate).getTime() - new Date(a.editionDate).getTime());
}

export function getV2Edition(editionId: string): V2Edition | null {
  return store.editions.find((e) => e.id === editionId) ?? null;
}

export function getV2EditionBySlug(publicSlug: string, editionSlug: string): V2Edition | null {
  return store.editions.find(
    (e) => e.publicSlug === publicSlug && e.editionSlug === editionSlug
  ) ?? null;
}

export function getV2EditionByDate(publicSlug: string, editionDate: string): V2Edition | null {
  return store.editions.find(
    (e) => e.publicSlug === publicSlug && e.editionDate === editionDate
  ) ?? null;
}

export function getV2EditionEntries(editionId: string): V2Entry[] {
  return store.entries
    .filter((e) => e.editionId === editionId)
    .sort((a, b) => a.rank - b.rank);
}

export function getV2EditionSourceCoverage(editionId: string): V2SourceCoverage[] {
  return store.sourceCoverage.filter((c) => c.editionId === editionId);
}

export function getV2AuditEvents(): V2AuditEvent[] {
  return store.auditEvents.slice().sort((a, b) =>
    new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime()
  );
}

// ─── Transactional writes ───
// Write edition + entries + coverage + audit event atomically.
// Only persists if ALL writes succeed. If any throw, store is rolled back.

export type TransactionalCommitPayload = {
  edition: V2Edition;
  entries: V2Entry[];
  sourceCoverage: V2SourceCoverage[];
  auditEvent: V2AuditEvent | null;
};

export function transactionalCommit(payload: TransactionalCommitPayload): void {
  // Clone current store as rollback snapshot
  const snapshot = JSON.parse(JSON.stringify(store)) as V2EditionStore;

  try {
    // Step 1: insert edition
    if (store.editions.find((e) => e.id === payload.edition.id)) {
      throw new Error(`edition_write_failed: Edition ${payload.edition.id} already exists`);
    }
    store.editions.push(payload.edition);

    // Step 2: insert entries
    for (const entry of payload.entries) {
      store.entries.push(entry);
    }

    // Step 3: insert source coverage
    for (const cov of payload.sourceCoverage) {
      store.sourceCoverage.push(cov);
    }

    // Step 4: insert audit event if present
    if (payload.auditEvent) {
      store.auditEvents.push(payload.auditEvent);
    }

    // All succeeded — persist
    saveStore(store);
  } catch (err) {
    // Rollback
    store = snapshot;
    throw err;
  }
}

// ─── Update run commit status on ingest run ───
export function markRunCommitted(
  runId: string,
  editionId: string,
  editionSlug: string,
  publicUrl: string
): void {
  // This is a passthrough — the ingestStudioMock handles run state.
  // We store metadata here for cross-lookup.
  try {
    const meta = {
      runId,
      editionId,
      editionSlug,
      publicUrl,
      committedAt: new Date().toISOString(),
    };
    const existing = JSON.parse(localStorage.getItem("wkcharts_committed_runs_v1") || "{}") as Record<string, unknown>;
    existing[runId] = meta;
    localStorage.setItem("wkcharts_committed_runs_v1", JSON.stringify(existing));
  } catch {
    // ignore
  }
}

export function getCommittedRunMeta(runId: string): {
  editionId: string;
  editionSlug: string;
  publicUrl: string;
  committedAt: string;
} | null {
  try {
    const existing = JSON.parse(localStorage.getItem("wkcharts_committed_runs_v1") || "{}") as Record<string, unknown>;
    const meta = existing[runId];
    if (!meta || typeof meta !== "object") return null;
    return meta as { editionId: string; editionSlug: string; publicUrl: string; committedAt: string };
  } catch {
    return null;
  }
}