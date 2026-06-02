import type { IngestRun } from "../chartsIngestion/ingestStudioTypes";
import { assembleIngestRunIntelligence } from "./runIntelligence";
import type { IngestRunIntelligence } from "./intelligenceTypes";

const INTELLIGENCE_STORE_KEY = "wkcharts_ingest_intelligence_v1";

type StoredIntelligenceRecord = {
  runId: string;
  generatedAt: string;
  intelligence: IngestRunIntelligence;
};

type IntelligenceStore = {
  records: Record<string, StoredIntelligenceRecord>;
};

function emptyStore(): IntelligenceStore {
  return { records: {} };
}

function readStore(): IntelligenceStore {
  if (typeof window === "undefined") return emptyStore();

  try {
    const raw = localStorage.getItem(INTELLIGENCE_STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<IntelligenceStore>;
    return parsed.records && typeof parsed.records === "object" ? { records: parsed.records as IntelligenceStore["records"] } : emptyStore();
  } catch {
    return emptyStore();
  }
}

function writeStore(store: IntelligenceStore): boolean {
  if (typeof window === "undefined") return false;

  try {
    localStorage.setItem(INTELLIGENCE_STORE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function getIngestRunIntelligence(runId: string): IngestRunIntelligence | null {
  const record = readStore().records[runId];
  return record?.intelligence ?? null;
}

export function getIngestRunIntelligenceRecord(runId: string): StoredIntelligenceRecord | null {
  return readStore().records[runId] ?? null;
}

export function listIngestRunIntelligenceRecords(): StoredIntelligenceRecord[] {
  return Object.values(readStore().records).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export function persistIngestRunIntelligence(runId: string, intelligence: IngestRunIntelligence): StoredIntelligenceRecord {
  const store = readStore();
  const record: StoredIntelligenceRecord = {
    runId,
    generatedAt: new Date().toISOString(),
    intelligence,
  };
  store.records[runId] = record;
  writeStore(store);
  return record;
}

export function generateAndPersistIngestRunIntelligence(
  run: IngestRun,
  options: { marketScopeId?: string | null; marketScopeSnapshot?: Record<string, unknown> | null } = {}
): StoredIntelligenceRecord {
  const intelligence = assembleIngestRunIntelligence(run, options);
  return persistIngestRunIntelligence(run.id, intelligence);
}

export function deleteIngestRunIntelligence(runId: string): boolean {
  const store = readStore();
  if (!store.records[runId]) return false;
  delete store.records[runId];
  return writeStore(store);
}

export function resetIngestRunIntelligenceStore(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(INTELLIGENCE_STORE_KEY);
}
