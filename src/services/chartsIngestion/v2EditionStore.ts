/**
 * V2 Edition Store
 * In-memory store for V2 editions used in DEV/mock mode only.
 * In production, all edition data is stored in Supabase:
 *   wk_chart_editions_v2, wk_chart_entries_v2, wk_chart_source_coverage_v2.
 *
 * This store is ONLY active when import.meta.env.DEV === true.
 * It does NOT use localStorage — no run state is persisted to browser storage.
 */

import type { V2Edition, V2Entry, V2SourceCoverage, V2AuditEvent } from "./commitTypes";

interface V2EditionStore {
  editions: V2Edition[];
  entries: V2Entry[];
  sourceCoverage: V2SourceCoverage[];
  auditEvents: V2AuditEvent[];
}

function emptyStore(): V2EditionStore {
  return { editions: [], entries: [], sourceCoverage: [], auditEvents: [] };
}

// In-memory only — no localStorage, no persistence across page refreshes
// This is intentional: mock data should not bleed into real state
let store = emptyStore();

function saveStore(_store: V2EditionStore): void {
  // No-op — in-memory store only, no localStorage
}

export function getV2EditionStore(): V2EditionStore {
  return store;
}

export function refreshV2EditionStore(): V2EditionStore {
  // In-memory store: no reload needed
  return store;
}

export function resetV2EditionStore(): void {
  store = emptyStore();
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
// NOTE: In production, run commit state is tracked in Supabase chart_ingest_runs
// via the productionAdapter. These functions are retained for DEV/local mode only.
// They MUST NOT be called in any production ingest flow.

// In-memory map for DEV use only — no localStorage
const _devCommittedRuns = new Map<string, {
  editionId: string; editionSlug: string; publicUrl: string; committedAt: string;
}>();

export function markRunCommitted(
  runId: string,
  editionId: string,
  editionSlug: string,
  publicUrl: string
): void {
  if (!import.meta.env.DEV) {
    // In production, run commit state is managed by Supabase — not in-memory
    return;
  }
  _devCommittedRuns.set(runId, {
    editionId,
    editionSlug,
    publicUrl,
    committedAt: new Date().toISOString(),
  });
}

export function getCommittedRunMeta(runId: string): {
  editionId: string;
  editionSlug: string;
  publicUrl: string;
  committedAt: string;
} | null {
  if (!import.meta.env.DEV) return null;
  return _devCommittedRuns.get(runId) ?? null;
}