/**
 * Chart Ingestion Failure Simulation
 * Allows injection of realistic failure states into the demo job.
 * Every simulation persists to the store, appends error logs, and blocks
 * the relevant next step. Retry actions clear the state and restore progress.
 */

import { getStore, commit, appendJobLog, updateJobStatus, getJob, updateJob, updateSource, updateCandidate, addIssue, removeSource } from "./store";
import type { IngestJob, IngestSource, ReviewIssue } from "./types";

export type SimulationType =
  | "source_fetch_failure"
  | "normalization_failure"
  | "matching_failure"
  | "duplicate_rank"
  | "duplicate_canonical"
  | "publish_failure"
  | "snapshot_failure"
  | "api_timeout"
  | "permission_denied";

export interface SimulationState {
  activeSimulations: SimulationType[];
  lastErrorMessage: string | null;
}

const SIM_KEY = "wkcharts_simulations_v1";

function getSimState(): SimulationState {
  try {
    const raw = localStorage.getItem(SIM_KEY);
    if (raw) return JSON.parse(raw) as SimulationState;
  } catch {
    // ignore
  }
  return { activeSimulations: [], lastErrorMessage: null };
}

function saveSimState(state: SimulationState): void {
  try {
    localStorage.setItem(SIM_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function getActiveSimulations(): SimulationType[] {
  return getSimState().activeSimulations;
}

export function isSimulated(type: SimulationType): boolean {
  return getSimState().activeSimulations.includes(type);
}

export function getLastErrorMessage(): string | null {
  return getSimState().lastErrorMessage;
}

// ─── Simulation Injectors ───

export function simulateSourceFetchFailure(jobId: string, sourceId: string): void {
  const state = getStore();
  const source = state.sources.find((s) => s.id === sourceId && s.jobId === jobId);
  if (!source) return;

  updateSource(sourceId, (s) => ({
    ...s,
    status: "failed",
    errorMessage: "Simulated: Spotify API returned 500 Internal Server Error",
    errorCount: 42,
    rawCount: 0,
    normalizedCount: 0,
  }));

  appendJobLog(jobId, "fetch_sources", "error", `Source fetch failed: ${source.provider}`, {
    sourceId,
    provider: source.provider,
    error: "Simulated 500 from Spotify API",
    simulated: true,
  });

  updateJobStatus(jobId, "failed", "Source fetch failed. Retry required.");

  const sim = getSimState();
  sim.activeSimulations = [...sim.activeSimulations, "source_fetch_failure"];
  sim.lastErrorMessage = "Source fetch failure simulated. Retry to recover.";
  saveSimState(sim);
}

export function simulateNormalizationFailure(jobId: string): void {
  const state = getStore();
  const sources = state.sources.filter((s) => s.jobId === jobId);

  sources.forEach((s) => {
    updateSource(s.id, (src) => ({
      ...src,
      normalizedCount: 0,
      errorCount: src.rawCount,
      errorMessage: "Simulated: Normalization engine failed to parse raw items",
    }));
  });

  appendJobLog(jobId, "normalization", "error", "Normalization failed: engine unable to parse raw payload", {
    simulated: true,
    sourcesAffected: sources.length,
  });

  updateJobStatus(jobId, "failed", "Normalization failed. Check source payloads and retry.");

  const sim = getSimState();
  sim.activeSimulations = [...sim.activeSimulations, "normalization_failure"];
  sim.lastErrorMessage = "Normalization failure simulated. Retry to recover.";
  saveSimState(sim);
}

export function simulateMatchingFailure(jobId: string): void {
  const state = getStore();
  const matches = state.matches.filter((m) => m.jobId === jobId);

  matches.forEach((m) => {
    const idx = state.matches.findIndex((x) => x.id === m.id);
    if (idx !== -1) {
      state.matches[idx] = {
        ...m,
        matchConfidence: 0,
        matchMethod: "manual" as const,
        matchNotes: "Simulated: Canonical match engine returned no results",
        approvedBy: null,
        approvedAt: null,
      };
    }
  });

  commit(state);

  appendJobLog(jobId, "matching", "error", "Matching failed: canonical engine returned no results", {
    simulated: true,
    matchesAffected: matches.length,
  });

  updateJobStatus(jobId, "failed", "Canonical matching failed. Review candidates and retry.");

  const sim = getSimState();
  sim.activeSimulations = [...sim.activeSimulations, "matching_failure"];
  sim.lastErrorMessage = "Matching failure simulated. Retry to recover.";
  saveSimState(sim);
}

export function simulateDuplicateRank(jobId: string): void {
  const state = getStore();
  const candidates = state.candidates.filter((c) => c.jobId === jobId);
  if (candidates.length < 2) return;

  const target = candidates[0];
  const duplicate = candidates[1];

  updateCandidate(target.id, (c) => ({ ...c, finalRank: 1, manualRankOverride: 1 }));
  updateCandidate(duplicate.id, (c) => ({ ...c, finalRank: 1, manualRankOverride: 1 }));

  const issue: ReviewIssue = {
    id: `sim-issue-${Date.now()}`,
    jobId,
    candidateId: duplicate.id,
    severity: "high",
    issueType: "duplicate_rank",
    message: "Simulated: Rank 1 is assigned to multiple candidates.",
    status: "open",
    blocking: true,
    resolutionNote: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
  };
  addIssue(issue);

  appendJobLog(jobId, "scoring", "error", "Duplicate rank detected: rank 1 assigned to multiple candidates", {
    simulated: true,
    candidateIds: [target.id, duplicate.id],
  });

  const sim = getSimState();
  sim.activeSimulations = [...sim.activeSimulations, "duplicate_rank"];
  sim.lastErrorMessage = "Duplicate rank issue simulated. Resolve before publish.";
  saveSimState(sim);
}

export function simulateDuplicateCanonical(jobId: string): void {
  const state = getStore();
  const candidates = state.candidates.filter((c) => c.jobId === jobId);
  if (candidates.length < 2) return;

  const target = candidates[0];
  const duplicate = candidates[2];
  const matches = state.matches.filter((m) => m.jobId === jobId);
  const targetMatch = matches.find((m) => m.candidateId === target.id);

  if (targetMatch) {
    const dupMatch = matches.find((m) => m.candidateId === duplicate.id);
    if (dupMatch) {
      const dupIdx = state.matches.findIndex((m) => m.id === dupMatch.id);
      if (dupIdx !== -1) {
        state.matches[dupIdx] = {
          ...dupMatch,
          canonicalTrackId: targetMatch.canonicalTrackId,
          matchConfidence: 95,
          matchMethod: "isrc",
          matchNotes: "Simulated: Duplicate canonical track assignment",
        };
        commit(state);
      }
    }
  }

  const issue: ReviewIssue = {
    id: `sim-issue-dup-${Date.now()}`,
    jobId,
    candidateId: duplicate.id,
    severity: "high",
    issueType: "duplicate_track",
    message: "Simulated: Multiple candidates matched to the same canonical track.",
    status: "open",
    blocking: true,
    resolutionNote: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
  };
  addIssue(issue);

  appendJobLog(jobId, "matching", "error", "Duplicate canonical track detected", {
    simulated: true,
    candidateIds: [target.id, duplicate.id],
  });

  const sim = getSimState();
  sim.activeSimulations = [...sim.activeSimulations, "duplicate_canonical"];
  sim.lastErrorMessage = "Duplicate canonical track issue simulated. Resolve before publish.";
  saveSimState(sim);
}

export function simulatePublishFailure(jobId: string): void {
  appendJobLog(jobId, "publish", "error", "Publish failed: WordPress edition creation returned 403", {
    simulated: true,
    error: "WordPress REST API returned 403 Forbidden",
  });

  updateJobStatus(jobId, "failed", "Publish failed: WordPress edition creation returned 403. Check permissions.");

  const sim = getSimState();
  sim.activeSimulations = [...sim.activeSimulations, "publish_failure"];
  sim.lastErrorMessage = "Publish failure simulated. Retry to recover.";
  saveSimState(sim);
}

export function simulateSnapshotFailure(jobId: string): void {
  appendJobLog(jobId, "publish", "error", "Snapshot creation failed: database write error", {
    simulated: true,
    error: "Database write timeout during snapshot creation",
  });

  const sim = getSimState();
  sim.activeSimulations = [...sim.activeSimulations, "snapshot_failure"];
  sim.lastErrorMessage = "Snapshot failure simulated. Retry to recover.";
  saveSimState(sim);
}

export function simulateApiTimeout(jobId: string): void {
  appendJobLog(jobId, "fetch_sources", "error", "API timeout: Spotify Charts API did not respond within 30s", {
    simulated: true,
    error: "Request timeout after 30000ms",
    status: 504,
  });

  updateJobStatus(jobId, "failed", "API timeout: external source did not respond. Retry or check source URL.");

  const sim = getSimState();
  sim.activeSimulations = [...sim.activeSimulations, "api_timeout"];
  sim.lastErrorMessage = "API timeout simulated. Retry to recover.";
  saveSimState(sim);
}

export function simulatePermissionDenied(jobId: string): void {
  appendJobLog(jobId, "publish", "error", "Permission denied: user lacks publish_wakilisha_charts capability", {
    simulated: true,
    error: "403 Forbidden - insufficient WordPress capabilities",
  });

  updateJobStatus(jobId, "failed", "Permission denied. Contact an admin to grant publish_wakilisha_charts.");

  const sim = getSimState();
  sim.activeSimulations = [...sim.activeSimulations, "permission_denied"];
  sim.lastErrorMessage = "Permission denied simulated. Retry will not help — requires admin intervention.";
  saveSimState(sim);
}

// ─── Retry Functions ───

export function retrySourceFetch(jobId: string, sourceId: string): void {
  const state = getStore();
  const source = state.sources.find((s) => s.id === sourceId && s.jobId === jobId);
  if (!source) return;

  updateSource(sourceId, (s) => ({
    ...s,
    status: "completed",
    errorMessage: null,
    errorCount: 0,
    rawCount: Math.floor(Math.random() * 200 + 50),
    normalizedCount: Math.floor(Math.random() * 180 + 40),
  }));

  appendJobLog(jobId, "fetch_sources", "success", `Source fetch retry succeeded: ${source.provider}`, {
    sourceId,
    provider: source.provider,
    simulated: true,
  });

  updateJobStatus(jobId, "draft", null);
  clearSimulation("source_fetch_failure");
}

export function retryNormalization(jobId: string): void {
  const state = getStore();
  const sources = state.sources.filter((s) => s.jobId === jobId);

  sources.forEach((s) => {
    updateSource(s.id, (src) => ({
      ...src,
      normalizedCount: Math.floor(src.rawCount * (0.85 + Math.random() * 0.12)),
      errorCount: Math.floor(src.rawCount * 0.05),
      errorMessage: null,
    }));
  });

  appendJobLog(jobId, "normalization", "success", "Normalization retry succeeded", {
    simulated: true,
    sourcesAffected: sources.length,
  });

  updateJobStatus(jobId, "normalizing", null);
  clearSimulation("normalization_failure");
}

export function retryMatching(jobId: string): void {
  const state = getStore();
  const matches = state.matches.filter((m) => m.jobId === jobId);

  matches.forEach((m) => {
    const idx = state.matches.findIndex((x) => x.id === m.id);
    if (idx !== -1) {
      state.matches[idx] = {
        ...m,
        matchConfidence: Math.floor(Math.random() * 40 + 60),
        matchMethod: "isrc" as const,
        matchNotes: "Retry succeeded: canonical match found via ISRC",
      };
    }
  });

  commit(state);

  appendJobLog(jobId, "matching", "success", "Matching retry succeeded: canonical matches restored", {
    simulated: true,
    matchesAffected: matches.length,
  });

  updateJobStatus(jobId, "matching", null);
  clearSimulation("matching_failure");
}

export function retryPublish(jobId: string): void {
  appendJobLog(jobId, "publish", "success", "Publish retry succeeded", {
    simulated: true,
  });

  updateJobStatus(jobId, "drafted", null);
  clearSimulation("publish_failure");
}

export function retrySnapshotCreation(jobId: string): void {
  appendJobLog(jobId, "publish", "success", "Snapshot creation retry succeeded", {
    simulated: true,
  });

  clearSimulation("snapshot_failure");
}

export function clearSimulation(type: SimulationType): void {
  const sim = getSimState();
  sim.activeSimulations = sim.activeSimulations.filter((s) => s !== type);
  if (sim.activeSimulations.length === 0) {
    sim.lastErrorMessage = null;
  }
  saveSimState(sim);
}

export function clearAllSimulations(): void {
  saveSimState({ activeSimulations: [], lastErrorMessage: null });
}

// ─── Simulation API ───

export function simulate(type: SimulationType, jobId: string, sourceId?: string): void {
  switch (type) {
    case "source_fetch_failure":
      if (sourceId) simulateSourceFetchFailure(jobId, sourceId);
      break;
    case "normalization_failure":
      simulateNormalizationFailure(jobId);
      break;
    case "matching_failure":
      simulateMatchingFailure(jobId);
      break;
    case "duplicate_rank":
      simulateDuplicateRank(jobId);
      break;
    case "duplicate_canonical":
      simulateDuplicateCanonical(jobId);
      break;
    case "publish_failure":
      simulatePublishFailure(jobId);
      break;
    case "snapshot_failure":
      simulateSnapshotFailure(jobId);
      break;
    case "api_timeout":
      simulateApiTimeout(jobId);
      break;
    case "permission_denied":
      simulatePermissionDenied(jobId);
      break;
  }
}

export function retry(type: SimulationType, jobId: string, sourceId?: string): void {
  switch (type) {
    case "source_fetch_failure":
      if (sourceId) retrySourceFetch(jobId, sourceId);
      break;
    case "normalization_failure":
      retryNormalization(jobId);
      break;
    case "matching_failure":
      retryMatching(jobId);
      break;
    case "publish_failure":
      retryPublish(jobId);
      break;
    case "snapshot_failure":
      retrySnapshotCreation(jobId);
      break;
    case "api_timeout":
      retrySourceFetch(jobId, sourceId ?? "");
      break;
    case "duplicate_rank":
      clearSimulation("duplicate_rank");
      break;
    case "duplicate_canonical":
      clearSimulation("duplicate_canonical");
      break;
    case "permission_denied":
      clearSimulation("permission_denied");
      break;
  }
}