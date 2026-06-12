/**
 * Chart Ingestion Store
 * LocalStorage-backed persistence for chart ingestion workflow.
 * Starts empty — no mock data. Data only exists when created through the pipeline.
 */

import {
  DEMO_JOB_ID,
  getFamilyById,
} from "./mockData";
import type {
  ChartFamily,
  IngestJob,
  IngestSource,
  RawSourceItem,
  IngestCandidate,
  IngestMatch,
  ReviewIssue,
  DraftEntry,
  ChartEdition,
  IngestJobLog,
  Snapshot,
  DashboardKpis,
  IngestJobStatus,
  CsvImportSession,
} from "./types";

const STORE_KEY = "wkcharts_ingest_store_v2";

export interface StoreState {
  jobs: IngestJob[];
  sources: IngestSource[];
  candidates: IngestCandidate[];
  matches: IngestMatch[];
  issues: ReviewIssue[];
  draftEntries: DraftEntry[];
  editions: ChartEdition[];
  logs: IngestJobLog[];
  snapshots: Snapshot[];
  dashboardKpis: DashboardKpis;
  csvImportSessions: CsvImportSession[];
}

function getInitialState(): StoreState {
  return {
    jobs: [],
    sources: [],
    candidates: [],
    matches: [],
    issues: [],
    draftEntries: [],
    editions: [],
    logs: [],
    snapshots: [],
    dashboardKpis: {
      activeJobs: 0,
      failedJobs: 0,
      pendingReviewIssues: 0,
      latestPublishedEdition: null,
      totalFamilies: 0,
      totalPublishedEditions: 0,
    },
    csvImportSessions: [],
  };
}

export function loadStore(): StoreState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreState;
      if (parsed.jobs && parsed.sources && parsed.candidates) {
        if (!parsed.csvImportSessions) {
          parsed.csvImportSessions = [];
        }
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  const initial = getInitialState();
  saveStore(initial);
  return initial;
}

export function saveStore(state: StoreState): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function resetStore(): StoreState {
  const initial = getInitialState();
  saveStore(initial);
  return initial;
}

// ─── Mutable store with getters ───
let mutableStore = loadStore();

export function getStore(): StoreState {
  return mutableStore;
}

export function refreshStore(): StoreState {
  mutableStore = loadStore();
  return mutableStore;
}

export function commit(state: StoreState): void {
  mutableStore = state;
  saveStore(state);
}

// ─── Job helpers ───
export function getJob(jobId: string): IngestJob | null {
  const j = mutableStore.jobs.find((job) => job.id === jobId);
  if (!j) return null;
  return { ...j, chartFamily: getFamilyById(j.chartFamilyId) };
}

export function getJobs(): IngestJob[] {
  return mutableStore.jobs.map((j) => ({ ...j, chartFamily: getFamilyById(j.chartFamilyId) }));
}

export function updateJob(jobId: string, updater: (job: IngestJob) => IngestJob): void {
  const state = mutableStore;
  const idx = state.jobs.findIndex((j) => j.id === jobId);
  if (idx === -1) return;
  const updated = updater(state.jobs[idx]);
  state.jobs[idx] = updated;
  commit(state);
}

export function updateJobStatus(
  jobId: string,
  status: IngestJobStatus,
  errorMessage?: string
): void {
  updateJob(jobId, (j) => ({
    ...j,
    status,
    errorMessage: errorMessage ?? j.errorMessage,
    updatedAt: new Date().toISOString(),
  }));
}

export function addJob(job: IngestJob): void {
  const state = mutableStore;
  state.jobs = [job, ...state.jobs];
  commit(state);
}

export function deleteJob(jobId: string): void {
  const state = mutableStore;
  state.jobs = state.jobs.filter((j) => j.id !== jobId);
  commit(state);
}

// ─── Source helpers ───
export function getJobSources(jobId: string): IngestSource[] {
  return mutableStore.sources.filter((s) => s.jobId === jobId);
}

export function addSource(source: IngestSource): void {
  const state = mutableStore;
  state.sources = [source, ...state.sources];
  commit(state);
}

export function updateSource(sourceId: string, updater: (source: IngestSource) => IngestSource): void {
  const state = mutableStore;
  const idx = state.sources.findIndex((s) => s.id === sourceId);
  if (idx === -1) return;
  state.sources[idx] = updater(state.sources[idx]);
  commit(state);
}

export function removeSource(sourceId: string): void {
  const state = mutableStore;
  state.sources = state.sources.filter((s) => s.id !== sourceId);
  commit(state);
}

export function fetchAllSources(jobId: string): void {
  const state = mutableStore;
  const jobSources = state.sources.filter((s) => s.jobId === jobId);
  const updated = jobSources.map((s) => {
    const baseRaw = Math.max(0, s.rawCount || Math.floor(Math.random() * 200 + 50));
    const normalized = Math.floor(baseRaw * (0.85 + Math.random() * 0.12));
    const errors = baseRaw - normalized;
    return {
      ...s,
      status: "completed" as const,
      rawCount: baseRaw,
      normalizedCount: normalized,
      errorCount: errors,
      fetchedAt: new Date().toISOString(),
    };
  });
  state.sources = state.sources.map((s) => {
    const found = updated.find((u) => u.id === s.id);
    return found ?? s;
  });
  commit(state);
}

// ─── Candidate helpers ───
export function getJobCandidates(jobId: string): IngestCandidate[] {
  return mutableStore.candidates.filter((c) => c.jobId === jobId);
}

export function updateCandidate(
  candidateId: string,
  updater: (candidate: IngestCandidate) => IngestCandidate
): void {
  const state = mutableStore;
  const idx = state.candidates.findIndex((c) => c.id === candidateId);
  if (idx === -1) return;
  state.candidates[idx] = updater(state.candidates[idx]);
  commit(state);
}

// ─── Match helpers ───
export function getJobMatches(jobId: string): IngestMatch[] {
  return mutableStore.matches.filter((m) => m.jobId === jobId);
}

export function updateMatch(
  matchId: string,
  updater: (match: IngestMatch) => IngestMatch
): void {
  const state = mutableStore;
  const idx = state.matches.findIndex((m) => m.id === matchId);
  if (idx === -1) return;
  state.matches[idx] = updater(state.matches[idx]);
  commit(state);
}

// ─── Issue helpers ───
export function getJobIssues(jobId: string): ReviewIssue[] {
  return mutableStore.issues.filter((i) => i.jobId === jobId);
}

export function updateIssue(
  issueId: string,
  updater: (issue: ReviewIssue) => ReviewIssue
): void {
  const state = mutableStore;
  const idx = state.issues.findIndex((i) => i.id === issueId);
  if (idx === -1) return;
  state.issues[idx] = updater(state.issues[idx]);
  commit(state);
}

export function addIssue(issue: ReviewIssue): void {
  const state = mutableStore;
  state.issues = [issue, ...state.issues];
  commit(state);
}

// ─── Draft helpers ───
export function getJobDraftEntries(jobId: string): DraftEntry[] {
  return mutableStore.draftEntries.filter((d) => d.jobId === jobId);
}

export function setJobDraftEntries(jobId: string, entries: DraftEntry[]): void {
  const state = mutableStore;
  state.draftEntries = state.draftEntries.filter((d) => d.jobId !== jobId);
  state.draftEntries = [...state.draftEntries, ...entries];
  commit(state);
}

// ─── Log helpers ───
export function addLog(log: IngestJobLog): void {
  const state = mutableStore;
  state.logs = [log, ...state.logs];
  commit(state);
}

export function appendJobLog(
  jobId: string,
  stage: string,
  level: IngestJobLog["level"],
  message: string,
  contextJson: Record<string, unknown> = {},
  createdBy = "Current User"
): void {
  const log: IngestJobLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    jobId,
    stage,
    level,
    message,
    contextJson,
    createdBy,
    createdAt: new Date().toISOString(),
  };
  addLog(log);
}

// ─── Snapshot helpers ───
export function addSnapshot(snapshot: Snapshot): void {
  const state = mutableStore;
  state.snapshots = [snapshot, ...state.snapshots];
  commit(state);
}

// ─── Edition helpers ───
export function getEditions(): ChartEdition[] {
  return mutableStore.editions;
}

export function addEdition(edition: ChartEdition): void {
  const state = mutableStore;
  state.editions = [edition, ...state.editions];
  commit(state);
}

// ─── Dashboard KPIs ───
export function getDashboardKpis(): DashboardKpis {
  return mutableStore.dashboardKpis;
}

// ─── CSV Import Session helpers ───
export function getJobCsvImportSessions(jobId: string): CsvImportSession[] {
  return mutableStore.csvImportSessions.filter((s) => s.jobId === jobId);
}

export function addCsvImportSession(session: CsvImportSession): void {
  const state = mutableStore;
  state.csvImportSessions = [session, ...state.csvImportSessions];
  commit(state);
}

export function clearCsvImportSessions(jobId: string): void {
  const state = mutableStore;
  state.csvImportSessions = state.csvImportSessions.filter((s) => s.jobId !== jobId);
  commit(state);
}

// ─── Summary counts ───
export function getJobSummary(jobId: string) {
  const sources = getJobSources(jobId);
  const candidates = getJobCandidates(jobId);
  const matches = getJobMatches(jobId);
  const issues = getJobIssues(jobId);
  const draftEntries = getJobDraftEntries(jobId);

  const highIssues = issues.filter((i) => i.severity === "high" && i.status === "open");
  const mediumIssues = issues.filter((i) => i.severity === "medium" && i.status === "open");
  const lowIssues = issues.filter((i) => i.severity === "low" && i.status === "open");

  const unresolvedMatches = matches.filter((m) => m.approvedBy === null);
  const approvedMatches = matches.filter((m) => m.approvedBy !== null);
  const newEntities = matches.filter((m) => m.matchMethod === "new_entity");

  const approvedCandidates = candidates.filter((c) => c.status === "approved");
  const excludedCandidates = candidates.filter((c) => c.status === "excluded");
  const needsReviewCandidates = candidates.filter((c) => c.status === "needs_review");

  return {
    totalSources: sources.length,
    totalRawItems: sources.reduce((sum, s) => sum + s.rawCount, 0),
    totalCandidates: candidates.length,
    approvedMatches: approvedMatches.length,
    unresolvedMatches: unresolvedMatches.length,
    newEntities: newEntities.length,
    highIssues: highIssues.length,
    mediumIssues: mediumIssues.length,
    lowIssues: lowIssues.length,
    eligibleCandidates: candidates.filter((c) => c.eligibilityStatus === "eligible").length,
    excludedCandidates: excludedCandidates.length,
    needsReviewCandidates: needsReviewCandidates.length,
    approvedCandidates: approvedCandidates.length,
    finalChartSize: draftEntries.length,
    draftEntries,
    isPublishable: highIssues.length === 0 && unresolvedMatches.length === 0 && draftEntries.length > 0,
    hasBlockingIssues: highIssues.length > 0,
    hasUnresolvedMatches: unresolvedMatches.length > 0,
    hasDraft: draftEntries.length > 0,
  };
}

// ─── Step blocking logic ───
export function getStepStatus(
  jobId: string,
  jobStatus: IngestJobStatus,
  stepIndex: number
): "completed" | "active" | "blocked" | "warning" | "pending" {
  const summary = getJobSummary(jobId);
  const currentStepIndex = getJobStatusStepIndex(jobStatus);

  if (stepIndex === 0) return stepIndex === currentStepIndex ? "active" : stepIndex < currentStepIndex ? "completed" : "pending";

  if (stepIndex === 1) {
    if (jobStatus === "draft" && stepIndex === 1) return "active";
    if (currentStepIndex < 1) return "blocked";
  }

  if (stepIndex === 2) {
    if (summary.totalSources === 0) return "blocked";
    if (currentStepIndex < 2) return "pending";
  }

  if (stepIndex === 3) {
    if (summary.totalRawItems === 0) return "blocked";
    if (currentStepIndex < 3) return "pending";
  }

  if (stepIndex === 4) {
    if (summary.totalCandidates === 0) return "blocked";
    if (summary.unresolvedMatches > 0 && stepIndex === 4) return "warning";
    if (currentStepIndex < 4) return "pending";
  }

  if (stepIndex === 5) {
    if (summary.unresolvedMatches > 0) return "blocked";
    if (summary.hasBlockingIssues && stepIndex === 5) return "warning";
    if (currentStepIndex < 5) return "pending";
  }

  if (stepIndex === 6) {
    if (summary.hasBlockingIssues) return "blocked";
    if (currentStepIndex < 6) return "pending";
  }

  if (stepIndex === 7) {
    if (summary.hasBlockingIssues) return "blocked";
    if (currentStepIndex < 7) return "pending";
  }

  if (stepIndex === 8) {
    if (summary.hasBlockingIssues) return "blocked";
    if (!summary.hasDraft) return "blocked";
    if (currentStepIndex < 8) return "pending";
  }

  return stepIndex === currentStepIndex ? "active" : stepIndex < currentStepIndex ? "completed" : "pending";
}

function getJobStatusStepIndex(status: IngestJobStatus): number {
  switch (status) {
    case "draft": return 0;
    case "fetching": return 2;
    case "normalizing": return 3;
    case "matching": return 4;
    case "scoring": return 6;
    case "review": return 5;
    case "ready_to_draft": return 7;
    case "drafted": return 7;
    case "published": return 8;
    case "failed": return -1;
    case "cancelled": return -1;
    default: return 0;
  }
}

// ─── Raw Items (from store, not mock data) ───
export function getRawItemsForJob(jobId: string): RawSourceItem[] {
  return []; // Raw items are only created during live pipeline runs
}

// ─── Logs (from store, not mock data) ───
export function getLogsForJob(jobId: string): IngestJobLog[] {
  return mutableStore.logs.filter((l) => l.jobId === jobId);
}

// ─── Re-export helpers ───
export {
  getFamilyById,
  DEMO_JOB_ID,
};