/**
 * Chart Ingestion Workflow
 * Centralized stage transition guards and workflow state machine.
 * Mirrors the expected backend workflow logic so the frontend can enforce
 * the same rules the WordPress plugin will eventually enforce.
 */

import type { IngestJob, IngestJobStatus, IngestCandidate, IngestSource, IngestMatch, ReviewIssue, DraftEntry } from "./types";

export interface WorkflowState {
  job: IngestJob;
  sources: IngestSource[];
  candidates: IngestCandidate[];
  matches: IngestMatch[];
  issues: ReviewIssue[];
  draftEntries: DraftEntry[];
}

export type WorkflowStep =
  | "setup"
  | "sources"
  | "fetch"
  | "candidates"
  | "matching"
  | "issues"
  | "ranking"
  | "draft"
  | "publish";

export interface GuardResult {
  allowed: boolean;
  reason: string | null;
  severity: "error" | "warning" | "info";
}

const STEPS: WorkflowStep[] = [
  "setup",
  "sources",
  "fetch",
  "candidates",
  "matching",
  "issues",
  "ranking",
  "draft",
  "publish",
];

export function getWorkflowStepIndex(step: WorkflowStep): number {
  return STEPS.indexOf(step);
}

export function getJobStage(job: IngestJob): WorkflowStep {
  const map: Record<IngestJobStatus, WorkflowStep> = {
    draft: "setup",
    fetching: "fetch",
    normalizing: "candidates",
    matching: "matching",
    scoring: "ranking",
    review: "issues",
    ready_to_draft: "draft",
    drafted: "draft",
    published: "publish",
    failed: "setup",
    cancelled: "setup",
  };
  return map[job.status] ?? "setup";
}

export function getJobStageIndex(job: IngestJob): number {
  return getWorkflowStepIndex(getJobStage(job));
}

// ─── Guard Functions ───

export function canFetchSources(state: WorkflowState): GuardResult {
  if (state.job.status === "published") {
    return { allowed: false, reason: "Cannot fetch sources after job is published", severity: "error" };
  }
  if (state.sources.length === 0) {
    return { allowed: false, reason: "No sources configured. Add at least one source before fetching.", severity: "error" };
  }
  return { allowed: true, reason: null, severity: "info" };
}

export function canCreateDraft(state: WorkflowState): GuardResult {
  if (state.job.status === "published") {
    return { allowed: false, reason: "Cannot create draft after job is published", severity: "error" };
  }
  const highIssues = state.issues.filter((i) => i.severity === "high" && i.status === "open");
  if (highIssues.length > 0) {
    return { allowed: false, reason: `${highIssues.length} high severity blocking issues must be resolved first`, severity: "error" };
  }
  const unresolvedMatches = state.matches.filter((m) => m.approvedBy === null && m.matchMethod !== "new_entity");
  if (unresolvedMatches.length > 0) {
    return { allowed: false, reason: `${unresolvedMatches.length} canonical matches still unresolved`, severity: "error" };
  }
  if (state.candidates.length === 0) {
    return { allowed: false, reason: "No candidates available. Run normalization first.", severity: "error" };
  }
  return { allowed: true, reason: null, severity: "info" };
}

export function canPublish(state: WorkflowState): GuardResult {
  if (state.job.status === "published") {
    return { allowed: false, reason: "This edition has already been published", severity: "error" };
  }
  const draftResult = canCreateDraft(state);
  if (!draftResult.allowed) {
    return { allowed: false, reason: draftResult.reason, severity: "error" };
  }
  if (state.draftEntries.length === 0) {
    return { allowed: false, reason: "No draft edition created. Create draft first.", severity: "error" };
  }
  return { allowed: true, reason: null, severity: "info" };
}

export function canApproveMatch(state: WorkflowState, candidateId: string): GuardResult {
  const candidate = state.candidates.find((c) => c.id === candidateId);
  if (!candidate) {
    return { allowed: false, reason: "Candidate not found", severity: "error" };
  }
  if (candidate.status === "excluded" || candidate.eligibilityStatus === "excluded") {
    return { allowed: false, reason: "Cannot approve match for an excluded candidate", severity: "error" };
  }
  return { allowed: true, reason: null, severity: "info" };
}

export function canApplyRankOverride(state: WorkflowState, candidateId: string): GuardResult {
  const candidate = state.candidates.find((c) => c.id === candidateId);
  if (!candidate) {
    return { allowed: false, reason: "Candidate not found", severity: "error" };
  }
  if (candidate.status === "excluded" || candidate.eligibilityStatus === "excluded") {
    return { allowed: false, reason: "Cannot apply rank override to an excluded candidate", severity: "error" };
  }
  return { allowed: true, reason: null, severity: "info" };
}

export function canDeleteSource(state: WorkflowState): GuardResult {
  if (state.job.status === "published") {
    return { allowed: false, reason: "Cannot delete sources after job is published", severity: "error" };
  }
  if (state.draftEntries.length > 0) {
    return { allowed: false, reason: "Cannot delete sources after draft is created. Reset job to modify sources.", severity: "error" };
  }
  return { allowed: true, reason: null, severity: "info" };
}

// ─── Checklist & Blocking ───

export interface PublishChecklistItem {
  label: string;
  pass: boolean;
  required: boolean;
  reason?: string;
}

export function getPublishChecklist(state: WorkflowState): PublishChecklistItem[] {
  const unresolvedMatches = state.matches.filter((m) => m.approvedBy === null && m.matchMethod !== "new_entity");
  const highOpenIssues = state.issues.filter((i) => i.severity === "high" && i.status === "open");
  const duplicateRanks = getDuplicateRanks(state.candidates);

  return [
    { label: "Sources fetched", pass: state.sources.length > 0 && state.sources.every((s) => s.status === "completed"), required: true },
    { label: "Candidates normalized", pass: state.candidates.length > 0, required: true },
    { label: "Canonical matches approved", pass: unresolvedMatches.length === 0, required: true, reason: unresolvedMatches.length > 0 ? `${unresolvedMatches.length} unresolved` : undefined },
    { label: "No duplicate ranks", pass: duplicateRanks.length === 0, required: true, reason: duplicateRanks.length > 0 ? `${duplicateRanks.length} duplicates` : undefined },
    { label: "No duplicate tracks", pass: true, required: false },
    { label: "No high blocking issues", pass: highOpenIssues.length === 0, required: true, reason: highOpenIssues.length > 0 ? `${highOpenIssues.length} blocking` : undefined },
    { label: "Draft edition created", pass: state.draftEntries.length > 0, required: true },
    { label: "Snapshot ready", pass: state.draftEntries.length > 0, required: true },
  ];
}

export function getBlockingReasons(state: WorkflowState): string[] {
  const reasons: string[] = [];
  const checklist = getPublishChecklist(state);
  for (const item of checklist) {
    if (item.required && !item.pass) {
      reasons.push(item.reason ? `${item.label}: ${item.reason}` : item.label);
    }
  }
  return reasons;
}

export function getStepStatus(
  state: WorkflowState,
  stepIndex: number
): "completed" | "active" | "blocked" | "warning" | "pending" {
  const currentStageIndex = getJobStageIndex(state.job);
  const summary = getWorkflowSummary(state);

  // Step 0: Setup
  if (stepIndex === 0) {
    if (stepIndex === currentStageIndex) return "active";
    if (stepIndex < currentStageIndex) return "completed";
    return "pending";
  }

  // Step 1: Sources
  if (stepIndex === 1) {
    if (currentStageIndex < 0) return "blocked";
    if (stepIndex === currentStageIndex) return "active";
    if (stepIndex < currentStageIndex) return "completed";
    return "pending";
  }

  // Step 2: Fetch
  if (stepIndex === 2) {
    if (summary.totalSources === 0) return "blocked";
    if (currentStageIndex < 2) return "pending";
    if (stepIndex === currentStageIndex) return "active";
    if (stepIndex < currentStageIndex) return "completed";
    return "pending";
  }

  // Step 3: Candidates
  if (stepIndex === 3) {
    if (summary.totalSources === 0) return "blocked";
    if (summary.totalRawItems === 0) return "blocked";
    if (currentStageIndex < 3) return "pending";
    if (stepIndex === currentStageIndex) return "active";
    if (stepIndex < currentStageIndex) return "completed";
    return "pending";
  }

  // Step 4: Matching
  if (stepIndex === 4) {
    if (summary.totalCandidates === 0) return "blocked";
    if (summary.unresolvedMatches > 0 && stepIndex === currentStageIndex) return "warning";
    if (currentStageIndex < 4) return "pending";
    if (stepIndex === currentStageIndex) return "active";
    if (stepIndex < currentStageIndex) return "completed";
    return "pending";
  }

  // Step 5: Issues
  if (stepIndex === 5) {
    if (summary.unresolvedMatches > 0) return "blocked";
    if (summary.hasBlockingIssues && stepIndex === currentStageIndex) return "warning";
    if (currentStageIndex < 5) return "pending";
    if (stepIndex === currentStageIndex) return "active";
    if (stepIndex < currentStageIndex) return "completed";
    return "pending";
  }

  // Step 6: Ranking
  if (stepIndex === 6) {
    if (summary.hasBlockingIssues) return "blocked";
    if (currentStageIndex < 6) return "pending";
    if (stepIndex === currentStageIndex) return "active";
    if (stepIndex < currentStageIndex) return "completed";
    return "pending";
  }

  // Step 7: Draft
  if (stepIndex === 7) {
    if (summary.hasBlockingIssues) return "blocked";
    if (currentStageIndex < 7 && !summary.hasDraft) return "pending";
    if (stepIndex === currentStageIndex || (summary.hasDraft && currentStageIndex < 8)) return "active";
    if (stepIndex < currentStageIndex) return "completed";
    return "pending";
  }

  // Step 8: Publish
  if (stepIndex === 8) {
    if (summary.hasBlockingIssues) return "blocked";
    if (!summary.hasDraft) return "blocked";
    if (state.job.status === "published") return "completed";
    if (stepIndex === currentStageIndex) return "active";
    if (stepIndex < currentStageIndex) return "completed";
    return "pending";
  }

  return "pending";
}

// ─── Helpers ───

function getWorkflowSummary(state: WorkflowState) {
  const highIssues = state.issues.filter((i) => i.severity === "high" && i.status === "open");
  const unresolvedMatches = state.matches.filter((m) => m.approvedBy === null && m.matchMethod !== "new_entity");

  return {
    totalSources: state.sources.length,
    totalRawItems: state.sources.reduce((sum, s) => sum + s.rawCount, 0),
    totalCandidates: state.candidates.length,
    approvedMatches: state.matches.filter((m) => m.approvedBy !== null).length,
    unresolvedMatches: unresolvedMatches.length,
    newEntities: state.matches.filter((m) => m.matchMethod === "new_entity").length,
    highIssues: highIssues.length,
    mediumIssues: state.issues.filter((i) => i.severity === "medium" && i.status === "open").length,
    lowIssues: state.issues.filter((i) => i.severity === "low" && i.status === "open").length,
    eligibleCandidates: state.candidates.filter((c) => c.eligibilityStatus === "eligible").length,
    excludedCandidates: state.candidates.filter((c) => c.status === "excluded").length,
    finalChartSize: state.draftEntries.length,
    draftEntries: state.draftEntries,
    isPublishable: highIssues.length === 0 && unresolvedMatches.length === 0 && state.draftEntries.length > 0,
    hasBlockingIssues: highIssues.length > 0,
    hasUnresolvedMatches: unresolvedMatches.length > 0,
    hasDraft: state.draftEntries.length > 0,
  };
}

function getDuplicateRanks(candidates: IngestCandidate[]): Array<{ rank: number; candidates: string[] }> {
  const rankMap = new Map<number, string[]>();
  for (const c of candidates) {
    const rank = c.finalRank ?? c.calculatedRank;
    if (rank > 0) {
      const existing = rankMap.get(rank) ?? [];
      existing.push(c.id);
      rankMap.set(rank, existing);
    }
  }
  return Array.from(rankMap.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([rank, candidates]) => ({ rank, candidates }));
}