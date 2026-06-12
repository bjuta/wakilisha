import type {
  ChartFamily,
  IngestJob,
  IngestSource,
  RawSourceItem,
  IngestCandidate,
  IngestMatch,
  ReviewIssue,
  DraftEntry,
  IngestJobLog,
  ChartEdition,
  Snapshot,
  DashboardKpis,
  CreateIngestJobPayload,
  AddSourcePayload,
  ResolveIssuePayload,
  RankOverridePayload,
  IngestJobStatus,
  IssueStatus,
  DiscoveredCsvSource,
  SourceType,
  Provider,
  CsvImportSession,
  CandidateSourceType,
} from "./types";
import {
  getStore,
  commit,
  getJob,
  getJobs,
  getJobSources,
  getJobCandidates,
  getJobMatches,
  getJobIssues,
  getJobDraftEntries,
  getJobSummary,
  getEditions,
  getDashboardKpis,
  updateJobStatus,
  updateJob,
  addJob,
  deleteJob,
  addSource,
  updateSource,
  removeSource,
  fetchAllSources,
  updateCandidate,
  updateMatch,
  updateIssue,
  addIssue,
  setJobDraftEntries,
  addSnapshot,
  addEdition,
  resetStore as resetStoreInternal,
  getRawItemsForJob,
  getLogsForJob,
  appendJobLog,
  DEMO_JOB_ID,
  addCsvImportSession,
  getJobCsvImportSessions,
  clearCsvImportSessions,
} from "./store";
import { getDiscoveredCsvs } from "./mockData";

// ─── Store Operations ───
export function resetStore(): void {
  resetStoreInternal();
}
export function resetDemo(): void {
  resetStoreInternal();
}
export function refreshStore(): void {
  // no-op in mock; real store reload happens via loadStore
}

// ─── Chart Families ───
export function getChartFamilies(): Promise<ChartFamily[]> {
  const seen = new Set<string>();
  const families: ChartFamily[] = [];
  for (const j of getStore().jobs) {
    if (!seen.has(j.chartFamilyId) && j.chartFamily) {
      seen.add(j.chartFamilyId);
      families.push(j.chartFamily as ChartFamily);
    }
  }
  return Promise.resolve(families);
}

// ─── Ingest Jobs ───
export function getIngestJobs(): Promise<IngestJob[]> {
  return Promise.resolve(getJobs());
}

export function getIngestJob(jobId: string): Promise<IngestJob | null> {
  return Promise.resolve(getJob(jobId));
}

export function createIngestJob(payload: CreateIngestJobPayload): Promise<IngestJob> {
  const newJob: IngestJob = {
    id: `job-${Date.now()}`,
    chartFamilyId: payload.chartFamilyId,
    editionId: null,
    editionSlug: null,
    status: "draft",
    editionDate: payload.editionDate,
    periodStart: payload.periodStart,
    periodEnd: payload.periodEnd,
    chartSize: payload.chartSize,
    rulesetKey: payload.rulesetKey,
    scoringModelKey: payload.scoringModelKey,
    createdBy: "Current User",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    sourceSummary: {
      totalSources: 0, completedSources: 0, failedSources: 0, totalRawItems: 0, totalNormalized: 0,
    },
    jobSummary: {
      totalCandidates: 0, approvedMatches: 0, unresolvedMatches: 0, newEntities: 0,
      highIssues: 0, mediumIssues: 0, lowIssues: 0, eligibleCandidates: 0,
      excludedCandidates: 0, finalChartSize: 0,
    },
    errorMessage: null,
  };
  addJob(newJob);
  appendJobLog(newJob.id, "job_created", "success", "Job created", {
    chartFamilyId: payload.chartFamilyId,
    editionDate: payload.editionDate,
    chartSize: payload.chartSize,
  });
  return Promise.resolve(newJob);
}

export function updateJobStatusApi(
  jobId: string,
  status: IngestJobStatus,
  errorMessage?: string
): Promise<IngestJob | null> {
  updateJobStatus(jobId, status, errorMessage);
  return getIngestJob(jobId);
}

export function cancelJob(jobId: string): Promise<IngestJob | null> {
  return updateJobStatusApi(jobId, "cancelled");
}

export function retryJob(jobId: string): Promise<IngestJob | null> {
  return updateJobStatusApi(jobId, "draft");
}

export function deleteJobApi(jobId: string): Promise<boolean> {
  const before = getStore().jobs.length;
  deleteJob(jobId);
  return Promise.resolve(getStore().jobs.length < before);
}

// ─── Sources ───
export function getSources(jobId: string): Promise<IngestSource[]> {
  return Promise.resolve(getJobSources(jobId));
}

export function addSourceApi(jobId: string, payload: AddSourcePayload): Promise<IngestSource> {
  const newSource: IngestSource = {
    id: `src-${Date.now()}`,
    jobId,
    sourceType: payload.sourceType,
    provider: payload.provider,
    sourceUrl: payload.sourceUrl,
    uploadedFileId: null,
    weight: payload.weight,
    priority: payload.priority,
    status: "pending",
    rawCount: 0,
    normalizedCount: 0,
    errorCount: 0,
    fetchedAt: null,
    rawResponseHash: null,
    errorMessage: null,
  };
  addSource(newSource);
  appendJobLog(jobId, "source_added", "info", `${payload.provider} source added`, {
    sourceId: newSource.id,
    provider: payload.provider,
    weight: payload.weight,
  });
  return Promise.resolve(newSource);
}

export function removeSourceApi(sourceId: string): Promise<void> {
  const source = getStore().sources.find((s) => s.id === sourceId);
  removeSource(sourceId);
  if (source) {
    appendJobLog(source.jobId, "source_removed", "warning", `${source.provider} source removed`, {
      sourceId: source.id,
      provider: source.provider,
    });
  }
  return Promise.resolve();
}

export function updateSourceWeight(sourceId: string, weight: number): Promise<IngestSource | null> {
  const source = getStore().sources.find((s) => s.id === sourceId);
  if (!source) return Promise.resolve(null);
  updateSource(sourceId, (s) => ({ ...s, weight }));
  appendJobLog(source.jobId, "source_updated", "info", `${source.provider} source weight updated to ${Math.round(weight * 100)}%`, {
    sourceId, weight,
  });
  return Promise.resolve({ ...source, weight });
}

export function toggleSourceEnabled(sourceId: string): Promise<IngestSource | null> {
  const source = getStore().sources.find((s) => s.id === sourceId);
  if (!source) return Promise.resolve(null);
  const newStatus = source.status === "disabled" ? "pending" : "disabled";
  updateSource(sourceId, (s) => ({ ...s, status: newStatus as IngestSource["status"] }));
  appendJobLog(source.jobId, "source_updated", "info", `${source.provider} source ${newStatus === "disabled" ? "disabled" : "enabled"}`, {
    sourceId, status: newStatus,
  });
  return Promise.resolve({ ...source, status: newStatus as IngestSource["status"] });
}

export function fetchSources(jobId: string): Promise<IngestSource[]> {
  fetchAllSources(jobId);
  const sources = getJobSources(jobId);
  const totalRaw = sources.reduce((sum, s) => sum + s.rawCount, 0);
  appendJobLog(jobId, "fetch_sources", "success", `Sources fetched: ${sources.length} sources, ${totalRaw} raw items`, {
    sourceCount: sources.length, totalRaw,
  });
  return Promise.resolve(sources);
}

// ─── Raw Items ───
export function getRawItems(jobId: string): Promise<RawSourceItem[]> {
  return Promise.resolve(getRawItemsForJob(jobId));
}

// ─── Candidates ───
export function getCandidates(jobId: string): Promise<IngestCandidate[]> {
  return Promise.resolve(getJobCandidates(jobId));
}

export function getCandidateById(jobId: string, candidateId: string): Promise<IngestCandidate | null> {
  const c = getJobCandidates(jobId).find((c) => c.id === candidateId);
  return Promise.resolve(c ?? null);
}

export function approveCandidate(candidateId: string): Promise<IngestCandidate | null> {
  const candidate = getStore().candidates.find((c) => c.id === candidateId);
  if (!candidate) return Promise.resolve(null);
  updateCandidate(candidateId, (c) => ({ ...c, status: "approved" as const }));
  appendJobLog(candidate.jobId, "candidate_review", "info", `Candidate "${candidate.normalizedTitle}" approved`, {
    candidateId, title: candidate.normalizedTitle,
  });
  return Promise.resolve(getStore().candidates.find((c) => c.id === candidateId) ?? null);
}

export function excludeCandidate(candidateId: string): Promise<IngestCandidate | null> {
  const candidate = getStore().candidates.find((c) => c.id === candidateId);
  if (!candidate) return Promise.resolve(null);
  updateCandidate(candidateId, (c) => ({
    ...c,
    status: "excluded" as const,
    eligibilityStatus: "excluded" as const,
    eligibilityReasons: [...c.eligibilityReasons, "Manually excluded by admin"],
  }));
  appendJobLog(candidate.jobId, "candidate_review", "warning", `Candidate "${candidate.normalizedTitle}" excluded`, {
    candidateId, title: candidate.normalizedTitle,
  });
  return Promise.resolve(getStore().candidates.find((c) => c.id === candidateId) ?? null);
}

export function restoreCandidate(candidateId: string): Promise<IngestCandidate | null> {
  const candidate = getStore().candidates.find((c) => c.id === candidateId);
  if (!candidate) return Promise.resolve(null);
  updateCandidate(candidateId, (c) => ({
    ...c,
    status: "needs_review" as const,
    eligibilityStatus: "needs_review" as const,
  }));
  appendJobLog(candidate.jobId, "candidate_review", "info", `Candidate "${candidate.normalizedTitle}" restored to review`, {
    candidateId, title: candidate.normalizedTitle,
  });
  return Promise.resolve(getStore().candidates.find((c) => c.id === candidateId) ?? null);
}

// ─── Matches ───
export function getMatches(jobId: string): Promise<IngestMatch[]> {
  return Promise.resolve(getJobMatches(jobId));
}

export function approveCandidateMatch(jobId: string, candidateId: string, matchId: string): Promise<IngestMatch | null> {
  const match = getStore().matches.find((m) => m.id === matchId && m.jobId === jobId);
  if (!match) return Promise.resolve(null);
  updateMatch(matchId, (m) => ({
    ...m, approvedBy: "Current User", approvedAt: new Date().toISOString(),
  }));
  appendJobLog(jobId, "matching", "success", "Match approved", {
    matchId, candidateId, canonicalTrackId: match.canonicalTrackId,
  });
  return Promise.resolve(getStore().matches.find((m) => m.id === matchId) ?? null);
}

export function rejectCandidateMatch(jobId: string, matchId: string): Promise<IngestMatch | null> {
  const match = getStore().matches.find((m) => m.id === matchId && m.jobId === jobId);
  if (!match) return Promise.resolve(null);
  updateMatch(matchId, (m) => ({
    ...m,
    approvedBy: null,
    approvedAt: null,
    matchConfidence: Math.max(0, m.matchConfidence - 20),
    matchNotes: m.matchNotes ? `${m.matchNotes} (rejected)` : "Rejected by admin",
  }));
  appendJobLog(jobId, "matching", "warning", "Match rejected", {
    matchId, candidateId: match.candidateId,
  });
  return Promise.resolve(getStore().matches.find((m) => m.id === matchId) ?? null);
}

export function rematchCandidate(
  jobId: string, candidateId: string, canonicalTrackId: string, confidence: number, method: string
): Promise<IngestMatch | null> {
  const match = getStore().matches.find((m) => m.candidateId === candidateId && m.jobId === jobId);
  if (!match) return Promise.resolve(null);
  updateMatch(match.id, (m) => ({
    ...m,
    canonicalTrackId,
    matchConfidence: confidence,
    matchMethod: method as IngestMatch["matchMethod"],
    matchNotes: `Manual rematch to ${canonicalTrackId}`,
    approvedBy: "Current User",
    approvedAt: new Date().toISOString(),
  }));
  appendJobLog(jobId, "matching", "success", "Match rematched", {
    matchId: match.id, candidateId, canonicalTrackId, confidence,
  });
  return Promise.resolve(getStore().matches.find((m) => m.id === match.id) ?? null);
}

export function markAsNewEntity(jobId: string, candidateId: string): Promise<IngestMatch | null> {
  const match = getStore().matches.find((m) => m.candidateId === candidateId && m.jobId === jobId);
  if (!match) return Promise.resolve(null);
  updateMatch(match.id, (m) => ({
    ...m,
    canonicalTrackId: null,
    canonicalReleaseId: null,
    canonicalArtistIds: [],
    matchConfidence: 0,
    matchMethod: "new_entity" as const,
    matchNotes: "Marked as new canonical entity",
    approvedBy: "Current User",
    approvedAt: new Date().toISOString(),
  }));
  appendJobLog(jobId, "matching", "success", "Marked as new canonical entity", {
    matchId: match.id, candidateId,
  });
  return Promise.resolve(getStore().matches.find((m) => m.id === match.id) ?? null);
}

// ─── Review Issues ───
export function getReviewIssues(jobId: string): Promise<ReviewIssue[]> {
  return Promise.resolve(getJobIssues(jobId));
}

export function resolveReviewIssue(
  jobId: string, issueId: string, payload: ResolveIssuePayload
): Promise<ReviewIssue | null> {
  const issue = getStore().issues.find((i) => i.id === issueId && i.jobId === jobId);
  if (!issue) return Promise.resolve(null);
  const status: IssueStatus =
    payload.resolution === "resolve" || payload.resolution === "override" ? "resolved" : "ignored";
  updateIssue(issueId, (i) => ({
    ...i, status, resolutionNote: payload.note, resolvedBy: "Current User", resolvedAt: new Date().toISOString(),
  }));
  const actionLabel = payload.resolution === "override" ? "overridden" : payload.resolution === "resolve" ? "resolved" : "ignored";
  appendJobLog(jobId, "review", payload.resolution === "override" ? "warning" : "success", `Issue ${actionLabel}: ${issue.issueType}`, {
    issueId, issueType: issue.issueType, resolution: payload.resolution,
  });
  return Promise.resolve(getStore().issues.find((i) => i.id === issueId) ?? null);
}

export function reopenIssue(jobId: string, issueId: string): Promise<ReviewIssue | null> {
  const issue = getStore().issues.find((i) => i.id === issueId && i.jobId === jobId);
  if (!issue) return Promise.resolve(null);
  updateIssue(issueId, (i) => ({
    ...i, status: "open" as const, resolutionNote: null, resolvedBy: null, resolvedAt: null,
  }));
  appendJobLog(jobId, "review", "warning", `Issue reopened: ${issue.issueType}`, {
    issueId, issueType: issue.issueType,
  });
  return Promise.resolve(getStore().issues.find((i) => i.id === issueId) ?? null);
}

// ─── Ranking ───
export function applyRankOverride(
  jobId: string, candidateId: string, payload: RankOverridePayload
): Promise<IngestCandidate | null> {
  const candidate = getStore().candidates.find((c) => c.id === candidateId && c.jobId === jobId);
  if (!candidate) return Promise.resolve(null);
  updateCandidate(candidateId, (c) => ({
    ...c, manualRankOverride: payload.rank, finalRank: payload.rank,
  }));
  const candidates = getJobCandidates(jobId);
  const dupRanks = candidates.filter((c) => c.finalRank === payload.rank && c.id !== candidateId);
  if (dupRanks.length > 0 && dupRanks.some((c) => c.manualRankOverride !== null)) {
    const newIssue: ReviewIssue = {
      id: `issue-${Date.now()}`, jobId, candidateId, severity: "high", issueType: "duplicate_rank",
      message: `Rank ${payload.rank} is assigned to multiple candidates. Manual overrides create conflict.`,
      status: "open", blocking: true, resolutionNote: null, resolvedBy: null, resolvedAt: null,
      createdAt: new Date().toISOString(),
    };
    addIssue(newIssue);
    appendJobLog(jobId, "scoring", "warning", `Duplicate rank detected: ${payload.rank}`, {
      candidateId, rank: payload.rank,
    });
  }
  appendJobLog(jobId, "scoring", "info", `Manual rank override applied: ${candidate.normalizedTitle} → rank ${payload.rank}`, {
    candidateId, rank: payload.rank, reason: payload.reason,
  });
  return Promise.resolve(getStore().candidates.find((c) => c.id === candidateId) ?? null);
}

export function clearRankOverride(jobId: string, candidateId: string): Promise<IngestCandidate | null> {
  const candidate = getStore().candidates.find((c) => c.id === candidateId && c.jobId === jobId);
  if (!candidate) return Promise.resolve(null);
  updateCandidate(candidateId, (c) => ({
    ...c, manualRankOverride: null, finalRank: c.calculatedRank,
  }));
  appendJobLog(jobId, "scoring", "info", `Rank override cleared for ${candidate.normalizedTitle}`, { candidateId });
  return Promise.resolve(getStore().candidates.find((c) => c.id === candidateId) ?? null);
}

// ─── Draft & Publish ───
export function createDraftEdition(jobId: string): Promise<IngestJob | null> {
  const job = getJob(jobId);
  if (!job) return Promise.resolve(null);
  const candidates = getJobCandidates(jobId);
  const eligibleCandidates = candidates
    .filter((c) => c.status !== "excluded" && c.eligibilityStatus !== "excluded")
    .sort((a, b) => {
      const rankA = a.manualRankOverride ?? a.calculatedRank;
      const rankB = b.manualRankOverride ?? b.calculatedRank;
      return rankA - rankB;
    })
    .slice(0, job.chartSize);

  const entries: DraftEntry[] = eligibleCandidates.map((c, i) => ({
    id: `draft-${c.id}`,
    jobId,
    candidateId: c.id,
    finalRank: i + 1,
    canonicalTrackId: c.id,
    movement: (i < 3 ? "up" : i > 35 ? "new" : "same") as DraftEntry["movement"],
    previousRank: i < 3 ? i + 3 : null,
    peakPosition: i + 1,
    weeksOnChart: i < 10 ? 5 + i : 2,
    score: c.score,
    entryPayload: { track: c },
    locked: false,
    sourceType: (c.sourceType ?? "mock") as CandidateSourceType,
  }));

  setJobDraftEntries(jobId, entries);
  updateJobStatus(jobId, "drafted");
  appendJobLog(jobId, "draft", "success", `Draft edition created with ${entries.length} entries`, {
    entryCount: entries.length,
  });
  return getIngestJob(jobId);
}

export function publishEdition(jobId: string): Promise<IngestJob | null> {
  const job = getJob(jobId);
  if (!job) return Promise.resolve(null);
  const summary = getJobSummary(jobId);
  if (summary.hasBlockingIssues) {
    appendJobLog(jobId, "publish", "error", "Publish blocked: high severity issues exist", {
      highIssues: summary.highIssues,
    });
    return Promise.resolve(null);
  }
  updateJob(jobId, (j) => ({
    ...j, status: "published", updatedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
  }));
  const csvSessions = getJobCsvImportSessions(jobId);
  const newEdition: ChartEdition = {
    id: `ed-${Date.now()}`,
    familyId: job.chartFamilyId,
    slug: `week-${job.editionDate}`,
    label: `Week ${job.editionDate}`,
    date: job.editionDate,
    periodStart: job.periodStart,
    periodEnd: job.periodEnd,
    status: "published",
    ingestJobId: jobId,
    publishedAt: new Date().toISOString(),
    publishedBy: "Current User",
    entryCount: summary.finalChartSize,
    newEntries: summary.draftEntries.filter((d) => d.movement === "new").length,
    reEntries: summary.draftEntries.filter((d) => d.movement === "re_entry").length,
  };
  addEdition(newEdition);
  const snapshot = {
    id: `snap-${Date.now()}`,
    editionId: newEdition.id,
    familyId: job.chartFamilyId,
    snapshotJson: {
      edition: { id: newEdition.id, label: newEdition.label },
      entries: summary.draftEntries,
      chartFamily: { id: job.chartFamilyId, label: job.chartFamily?.label ?? "" },
      sourceSummary: {
        totalCandidates: summary.totalCandidates,
        csvImportSessions: csvSessions.length,
        csvCandidateCount: summary.draftEntries.filter((d) => d.sourceType === "csv").length,
      },
      csvImportSessions: csvSessions,
      validationSummary: {
        highIssues: summary.highIssues,
        mediumIssues: summary.mediumIssues,
        lowIssues: summary.lowIssues,
      },
    },
    publishedAt: newEdition.publishedAt!,
    publishedBy: "Current User",
  };
  addSnapshot(snapshot);
  appendJobLog(jobId, "publish", "success", `Edition published successfully with ${summary.finalChartSize} entries`, {
    entryCount: summary.finalChartSize, editionId: newEdition.id, snapshotId: snapshot.id,
  });
  return getIngestJob(jobId);
}

// ─── Preflight Check ───
export function runPreflightCheck(
  jobId: string
): Promise<{ pass: boolean; checklist: { label: string; pass: boolean }[]; warnings: number; errors: number }> {
  const job = getJob(jobId);
  const sources = getJobSources(jobId);
  const candidates = getJobCandidates(jobId);
  const issues = getJobIssues(jobId);
  const matches = getJobMatches(jobId);
  const draftEntries = getJobDraftEntries(jobId);

  const unresolvedMatches = matches.filter(
    (m) => m.approvedBy === null && m.matchMethod !== "new_entity"
  );
  const highOpenIssues = issues.filter((i) => i.severity === "high" && i.status === "open");

  const rankMap = new Map<number, number>();
  for (const c of candidates) {
    const rank = c.finalRank ?? c.calculatedRank;
    if (rank > 0) rankMap.set(rank, (rankMap.get(rank) ?? 0) + 1);
  }
  const hasDuplicateRanks = Array.from(rankMap.values()).some((count) => count > 1);

  const checklist = [
    { label: "Job exists", pass: !!job },
    { label: "Sources added", pass: sources.length > 0 },
    { label: "Sources fetched", pass: sources.every((s) => s.status === "completed") },
    { label: "Candidates normalized", pass: candidates.length > 0 },
    { label: "Matches resolved", pass: unresolvedMatches.length === 0 },
    { label: "No blocking issues", pass: highOpenIssues.length === 0 },
    { label: "Draft entries exist", pass: draftEntries.length > 0 },
    { label: "Rank integrity valid", pass: !hasDuplicateRanks },
  ];

  const warnings = issues.filter((i) => i.severity === "medium" && i.status === "open").length;
  const errors = highOpenIssues.length;

  appendJobLog(jobId, "preflight", "info", `Preflight check completed: ${checklist.filter((c) => c.pass).length}/${checklist.length} passed`, {
    pass: checklist.every((c) => c.pass),
    warnings,
    errors,
  });

  return Promise.resolve({
    pass: checklist.every((c) => c.pass),
    checklist,
    warnings,
    errors,
  });
}

// ─── Logs ───
export function getJobLogs(jobId: string): Promise<IngestJobLog[]> {
  return Promise.resolve(getLogsForJob(jobId));
}

// ─── Draft entries ───
export function getDraftEntries(jobId: string): Promise<DraftEntry[]> {
  return Promise.resolve(getJobDraftEntries(jobId));
}

// ─── Editions ───
export function getEditionsApi(): Promise<ChartEdition[]> {
  return Promise.resolve(getEditions());
}

export function getEditionById(editionId: string): Promise<ChartEdition | null> {
  const e = getStore().editions.find((e) => e.id === editionId);
  return Promise.resolve(e ?? null);
}

// ─── Snapshots ───
export function getSnapshots(): Promise<Snapshot[]> {
  return Promise.resolve(getStore().snapshots);
}

// ─── Dashboard ───
export function getDashboardKpisApi(): Promise<DashboardKpis> {
  return Promise.resolve(getDashboardKpis());
}

// ─── Summary ───
export function getJobSummaryApi(jobId: string): Promise<ReturnType<typeof getJobSummary>> {
  return Promise.resolve(getJobSummary(jobId));
}

// ─── Demo data helpers ───
export function getDemoJobId(): string {
  return DEMO_JOB_ID;
}

// ─── Canonical tracks for rematch search ───
export function searchCanonicalTracks(query: string): Promise<{ id: string; title: string; artist: string }[]> {
  const candidates = getStore().candidates;
  const results = candidates
    .filter((c) =>
      c.normalizedTitle.toLowerCase().includes(query.toLowerCase()) ||
      c.normalizedArtistLine.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 10)
    .map((c) => ({ id: c.id, title: c.normalizedTitle, artist: c.normalizedArtistLine }));
  return Promise.resolve(results);
}

// ─── Discovered CSVs ───
export function getDiscoveredCsvSources(): Promise<DiscoveredCsvSource[]> {
  return Promise.resolve(getDiscoveredCsvs());
}

export function getDiscoveredCsvSourceById(id: string): Promise<DiscoveredCsvSource | undefined> {
  return Promise.resolve(getDiscoveredCsvs().find((c) => c.id === id));
}

export function attachCsvAsSource(jobId: string, csvId: string): Promise<IngestSource> {
  const csv = getDiscoveredCsvs().find((c) => c.id === csvId);
  if (!csv) throw new Error(`CSV not found: ${csvId}`);
  const newSource: IngestSource = {
    id: `src-${Date.now()}`, jobId,
    sourceType: "csv" as SourceType, provider: "csv" as Provider,
    sourceUrl: null, uploadedFileId: csv.id, weight: 0.1, priority: 100,
    status: "completed", rawCount: csv.rowCount, normalizedCount: 0, errorCount: 0,
    fetchedAt: new Date().toISOString(), rawResponseHash: null, errorMessage: null,
  };
  addSource(newSource);
  appendJobLog(jobId, "source_added", "info", `CSV source added from discovered file: ${csv.filename}`, {
    sourceId: newSource.id, csvId: csv.id, filename: csv.filename, rowCount: csv.rowCount,
  });
  return Promise.resolve(newSource);
}

export async function normalizeCsvCandidates(
  jobId: string,
  csvId: string
): Promise<IngestCandidate[]> {
  const csv = getDiscoveredCsvs().find((c) => c.id === csvId);
  if (!csv) throw new Error(`CSV not found: ${csvId}`);

  const { normalizeCsvToCandidates: normalizeRows } = await import("./csv/parser");
  const result = normalizeRows(csv);

  const newCandidates: IngestCandidate[] = result.provenance.map((prov, i) => {
    const id = `csv-cand-${Date.now()}-${i}`;
    const title = prov.mappedFields["title"] || prov.mappedFields["track_title"] || "Unknown";
    const artist = prov.mappedFields["artist_line"] || prov.mappedFields["artist_name"] || "Unknown";
    const isrc = prov.mappedFields["isrc"] || null;
    const release = prov.mappedFields["release_title"] || prov.mappedFields["album"] || null;
    const artwork = prov.mappedFields["artwork_url"] || null;
    const position = prov.sourcePosition ?? i + 1;

    return {
      id, jobId,
      rawItemIds: [prov.rawRowHash],
      normalizedTitle: title,
      normalizedArtistLine: artist,
      normalizedArtists: [artist],
      normalizedReleaseTitle: release,
      isrc, upc: null, artworkUrl: artwork, previewUrl: null,
      externalUrls: {
        spotify: prov.mappedFields["spotify_url"] || "",
        apple: prov.mappedFields["apple_music_url"] || "",
        youtube: prov.mappedFields["youtube_url"] || "",
      },
      durationMs: null, releaseDate: null,
      label: prov.mappedFields["label"] || null,
      genre: null,
      sourcePositions: { csv: position },
      sourceMetrics: { csv: 100 },
      candidateHash: prov.rawRowHash,
      dedupeGroupKey: null,
      eligibilityStatus: "eligible",
      eligibilityReasons: [],
      score: Math.max(10, 50 - position * 1.2),
      calculatedRank: position,
      manualRankOverride: null,
      finalRank: position,
      status: "candidate" as const,
      sourceType: "csv" as CandidateSourceType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const state = getStore();
  state.candidates = [...state.candidates, ...newCandidates];
  commit(state);

  // Create import session
  const session: CsvImportSession = {
    id: `csv-session-${Date.now()}`,
    jobId, filename: csv.filename, sourceId: csv.id,
    rowCount: csv.rowCount, validRows: newCandidates.length,
    candidateCount: newCandidates.length,
    issueCount: result.errors.length + result.warnings.length,
    normalizedAt: new Date().toISOString(),
    normalizedBy: "Current User",
    mappingUsed: csv.mappedFields,
    validationSummary: {
      errors: result.errors, warnings: result.warnings, skippedRows: result.skippedRows,
    },
  };
  addCsvImportSession(session);

  appendJobLog(jobId, "csv_normalize", "success", `CSV validated and normalized: ${csv.filename}`, {
    csvId: csv.id, filename: csv.filename, candidateCount: newCandidates.length,
    skippedRows: result.skippedRows, sessionId: session.id,
  });
  appendJobLog(jobId, "csv_normalize", "info", `CSV normalized into ${newCandidates.length} candidates`, {
    sessionId: session.id,
  });

  if (result.errors.length > 0 || result.warnings.length > 0) {
    appendJobLog(jobId, "csv_normalize", "warning", `CSV review issues generated: ${result.errors.length} errors, ${result.warnings.length} warnings`, {
      errors: result.errors, warnings: result.warnings,
    });
  }

  // Add validation issues if any
  for (const err of result.errors) {
    addIssue({
      id: `csv-issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      jobId, candidateId: null, severity: "medium", issueType: "missing_title",
      message: `CSV validation: ${err}`, status: "open", blocking: false,
      resolutionNote: null, resolvedBy: null, resolvedAt: null,
      createdAt: new Date().toISOString(),
    });
  }
  for (const warn of result.warnings) {
    addIssue({
      id: `csv-issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      jobId, candidateId: null, severity: "low", issueType: "missing_source_url",
      message: `CSV warning: ${warn}`, status: "open", blocking: false,
      resolutionNote: null, resolvedBy: null, resolvedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  return Promise.resolve(newCandidates);
}

// ─── CSV Import Sessions ───
export function getCsvImportSessions(jobId: string): Promise<CsvImportSession[]> {
  return Promise.resolve(getJobCsvImportSessions(jobId));
}

export function createCsvImportSession(
  jobId: string,
  csv: DiscoveredCsvSource,
  candidateCount: number,
  issueCount: number,
  validationSummary: CsvImportSession["validationSummary"]
): Promise<CsvImportSession> {
  const session: CsvImportSession = {
    id: `csv-session-${Date.now()}`, jobId, filename: csv.filename, sourceId: csv.id,
    rowCount: csv.rowCount, validRows: candidateCount, candidateCount, issueCount,
    normalizedAt: new Date().toISOString(), normalizedBy: "Current User",
    mappingUsed: csv.mappedFields, validationSummary,
  };
  addCsvImportSession(session);
  appendJobLog(jobId, "csv_normalize", "success", `CSV import session created: ${csv.filename}`, {
    sessionId: session.id, candidateCount, issueCount,
  });
  return Promise.resolve(session);
}

export function clearCsvImportSessionsApi(jobId: string): Promise<void> {
  clearCsvImportSessions(jobId);
  appendJobLog(jobId, "csv_normalize", "info", "CSV import sessions cleared", {});
  return Promise.resolve();
}

// ─── CSV Draft Integrity ───
export interface CsvIntegrityViolation {
  type: string;
  message: string;
  severity: "high" | "medium";
  candidates: string[];
}

export function validateCsvDraftIntegrity(jobId: string, chartSize: number): CsvIntegrityViolation[] {
  const candidates = getJobCandidates(jobId).filter(
    (c) => c.sourceType === "csv" && c.status !== "excluded"
  );
  const violations: CsvIntegrityViolation[] = [];
  if (candidates.length === 0) return violations;

  // Duplicate ranks
  const rankMap = new Map<number, string[]>();
  for (const c of candidates) {
    const rank = c.finalRank ?? c.calculatedRank;
    if (rank > 0) {
      const existing = rankMap.get(rank) ?? [];
      existing.push(c.id);
      rankMap.set(rank, existing);
    }
  }
  for (const [rank, ids] of rankMap.entries()) {
    if (ids.length > 1) {
      violations.push({ type: "duplicate_rank", message: `Rank ${rank} is assigned to ${ids.length} CSV candidates`, severity: "high", candidates: ids });
    }
  }

  // Missing ranks
  for (const c of candidates) {
    const rank = c.finalRank ?? c.calculatedRank;
    if (!rank || rank < 1) {
      violations.push({ type: "missing_rank", message: `Candidate "${c.normalizedTitle}" has no valid rank`, severity: "high", candidates: [c.id] });
    }
  }

  // Rank above chart size
  for (const c of candidates) {
    const rank = c.finalRank ?? c.calculatedRank;
    if (rank > chartSize) {
      violations.push({ type: "rank_exceeds_chart_size", message: `Rank ${rank} exceeds chart size ${chartSize}`, severity: "medium", candidates: [c.id] });
    }
  }

  // Duplicate title + artist
  const titleArtistMap = new Map<string, string[]>();
  for (const c of candidates) {
    const key = `${c.normalizedTitle.toLowerCase()}|${c.normalizedArtistLine.toLowerCase()}`;
    const existing = titleArtistMap.get(key) ?? [];
    existing.push(c.id);
    titleArtistMap.set(key, existing);
  }
  for (const [key, ids] of titleArtistMap.entries()) {
    if (ids.length > 1) {
      const parts = key.split("|");
      violations.push({ type: "duplicate_track", message: `Duplicate track "${parts[0]}" by "${parts[1]}" appears ${ids.length} times`, severity: "high", candidates: ids });
    }
  }

  // Missing titles
  for (const c of candidates) {
    if (!c.normalizedTitle?.trim()) {
      violations.push({ type: "missing_title", message: "Candidate has no title", severity: "high", candidates: [c.id] });
    }
  }

  // Missing artists
  for (const c of candidates) {
    if (!c.normalizedArtistLine?.trim() || c.normalizedArtistLine === "Unknown") {
      violations.push({ type: "missing_artist", message: `Candidate "${c.normalizedTitle}" has no artist`, severity: "high", candidates: [c.id] });
    }
  }

  return violations;
}

// ─── CSV Draft Creation ───
export function createDraftFromCsvCandidates(
  jobId: string,
  chartSize: number
): Promise<{ success: boolean; entryCount: number; violations: CsvIntegrityViolation[]; editionId?: string }> {
  const violations = validateCsvDraftIntegrity(jobId, chartSize);
  const highViolations = violations.filter((v) => v.severity === "high");

  if (highViolations.length > 0) {
    appendJobLog(jobId, "draft", "error", `Draft creation blocked: ${highViolations.length} integrity violations`, {
      violations: highViolations.map((v) => v.message),
    });
    return Promise.resolve({ success: false, entryCount: 0, violations });
  }

  const candidates = getJobCandidates(jobId)
    .filter((c) => c.sourceType === "csv" && c.status !== "excluded")
    .sort((a, b) => (a.finalRank ?? a.calculatedRank) - (b.finalRank ?? b.calculatedRank))
    .slice(0, chartSize);

  const session = getJobCsvImportSessions(jobId)[0];

  const entries: DraftEntry[] = candidates.map((c, i) => ({
    id: `draft-${c.id}`, jobId, candidateId: c.id,
    finalRank: i + 1, canonicalTrackId: c.id,
    movement: "new" as DraftEntry["movement"],
    previousRank: null, peakPosition: i + 1, weeksOnChart: 1,
    score: c.score,
    entryPayload: {
      track: c,
      csvSource: session?.filename ?? "unknown",
      csvRowNumber: c.sourcePositions.csv ?? i + 1,
    },
    locked: false,
    sourceType: "csv" as CandidateSourceType,
    csvProvenance: {
      sourceFilename: session?.filename ?? "unknown",
      sourceRowNumber: c.sourcePositions.csv ?? i + 1,
      rawRowHash: c.candidateHash,
      mappedRankField: "rank",
      mappedTitleField: "title",
      mappedArtistField: "artist_line",
    },
  }));

  setJobDraftEntries(jobId, entries);
  updateJobStatus(jobId, "drafted");
  appendJobLog(jobId, "draft", "success", `Draft edition created from CSV candidates: ${entries.length} entries`, {
    entryCount: entries.length, sourceType: "csv",
  });

  return Promise.resolve({ success: true, entryCount: entries.length, violations, editionId: `draft-ed-${Date.now()}` });
}

export function exportDraftJson(jobId: string): Promise<string> {
  const entries = getJobDraftEntries(jobId);
  const job = getJob(jobId);
  const sessions = getJobCsvImportSessions(jobId);

  const payload = {
    edition: {
      jobId,
      chartFamilyId: job?.chartFamilyId,
      editionDate: job?.editionDate,
      periodStart: job?.periodStart,
      periodEnd: job?.periodEnd,
      chartSize: job?.chartSize,
      status: job?.status,
    },
    entries: entries.map((e) => ({
      rank: e.finalRank,
      title: (e.entryPayload?.track as Record<string, unknown>)?.normalizedTitle ?? "Unknown",
      artist: (e.entryPayload?.track as Record<string, unknown>)?.normalizedArtistLine ?? "Unknown",
      isrc: (e.entryPayload?.track as Record<string, unknown>)?.isrc ?? null,
      sourceType: e.sourceType,
      csvProvenance: e.csvProvenance,
      movement: e.movement,
      score: e.score,
    })),
    csvImportSessions: sessions.map((s) => ({
      filename: s.filename,
      rowCount: s.rowCount,
      candidateCount: s.candidateCount,
      normalizedAt: s.normalizedAt,
      validationSummary: s.validationSummary,
    })),
    generatedAt: new Date().toISOString(),
  };

  return Promise.resolve(JSON.stringify(payload, null, 2));
}