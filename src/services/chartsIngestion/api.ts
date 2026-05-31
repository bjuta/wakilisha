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
} from "./types";
import {
  getStore,
  refreshStore,
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
  addLog,
  addSnapshot,
  addEdition,
  resetStore as resetStoreInternal,
  resetDemoJob,
  getRawItemsForJob,
  getLogsForJob,
  appendJobLog,
  DEMO_JOB_ID,
} from "./store";

// ─── Store Operations ───
export function resetStore(): void {
  resetStoreInternal();
}
export function resetDemo(): void {
  resetDemoJob();
}
export function refreshStore(): void {
  refreshStore();
}

// ─── Chart Families ───
export function getChartFamilies(): Promise<ChartFamily[]> {
  // Re-export from mockData via store
  return Promise.resolve([...getStore().jobs.map((j) => ({ id: j.chartFamilyId, label: j.chartFamily?.label ?? "" })).filter((_, i, a) => a.findIndex((f) => f.id === _.id) === i).map((f) => ({ id: f.id, familyKey: f.id, label: f.label, description: "", defaultChartSize: 40, defaultRegion: "", editionFrequency: "weekly" as const, defaultRuleset: "", defaultScoringModel: "", createdAt: "", updatedAt: "" }))]);
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
      totalSources: 0,
      completedSources: 0,
      failedSources: 0,
      totalRawItems: 0,
      totalNormalized: 0,
    },
    jobSummary: {
      totalCandidates: 0,
      approvedMatches: 0,
      unresolvedMatches: 0,
      newEntities: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
      eligibleCandidates: 0,
      excludedCandidates: 0,
      finalChartSize: 0,
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
    sourceId,
    weight,
  });
  return Promise.resolve({ ...source, weight });
}

export function toggleSourceEnabled(sourceId: string): Promise<IngestSource | null> {
  const source = getStore().sources.find((s) => s.id === sourceId);
  if (!source) return Promise.resolve(null);
  const newStatus = source.status === "disabled" ? "pending" : "disabled";
  updateSource(sourceId, (s) => ({ ...s, status: newStatus as IngestSource["status"] }));
  appendJobLog(source.jobId, "source_updated", "info", `${source.provider} source ${newStatus === "disabled" ? "disabled" : "enabled"}`, {
    sourceId,
    status: newStatus,
  });
  return Promise.resolve({ ...source, status: newStatus as IngestSource["status"] });
}

export function fetchSources(jobId: string): Promise<IngestSource[]> {
  fetchAllSources(jobId);
  const sources = getJobSources(jobId);
  const totalRaw = sources.reduce((sum, s) => sum + s.rawCount, 0);
  appendJobLog(jobId, "fetch_sources", "success", `Sources fetched: ${sources.length} sources, ${totalRaw} raw items`, {
    sourceCount: sources.length,
    totalRaw,
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

export function getCandidateById(
  jobId: string,
  candidateId: string
): Promise<IngestCandidate | null> {
  const c = getJobCandidates(jobId).find((c) => c.id === candidateId);
  return Promise.resolve(c ?? null);
}

export function approveCandidate(
  candidateId: string
): Promise<IngestCandidate | null> {
  const candidate = getStore().candidates.find((c) => c.id === candidateId);
  if (!candidate) return Promise.resolve(null);
  updateCandidate(candidateId, (c) => ({ ...c, status: "approved" as const }));
  appendJobLog(candidate.jobId, "candidate_review", "info", `Candidate "${candidate.normalizedTitle}" approved`, {
    candidateId,
    title: candidate.normalizedTitle,
  });
  return Promise.resolve(getStore().candidates.find((c) => c.id === candidateId) ?? null);
}

export function excludeCandidate(
  candidateId: string
): Promise<IngestCandidate | null> {
  const candidate = getStore().candidates.find((c) => c.id === candidateId);
  if (!candidate) return Promise.resolve(null);
  updateCandidate(candidateId, (c) => ({
    ...c,
    status: "excluded" as const,
    eligibilityStatus: "excluded" as const,
    eligibilityReasons: [...c.eligibilityReasons, "Manually excluded by admin"],
  }));
  appendJobLog(candidate.jobId, "candidate_review", "warning", `Candidate "${candidate.normalizedTitle}" excluded`, {
    candidateId,
    title: candidate.normalizedTitle,
  });
  return Promise.resolve(getStore().candidates.find((c) => c.id === candidateId) ?? null);
}

export function restoreCandidate(
  candidateId: string
): Promise<IngestCandidate | null> {
  const candidate = getStore().candidates.find((c) => c.id === candidateId);
  if (!candidate) return Promise.resolve(null);
  updateCandidate(candidateId, (c) => ({
    ...c,
    status: "needs_review" as const,
    eligibilityStatus: "needs_review" as const,
  }));
  appendJobLog(candidate.jobId, "candidate_review", "info", `Candidate "${candidate.normalizedTitle}" restored to review`, {
    candidateId,
    title: candidate.normalizedTitle,
  });
  return Promise.resolve(getStore().candidates.find((c) => c.id === candidateId) ?? null);
}

// ─── Matches ───
export function getMatches(jobId: string): Promise<IngestMatch[]> {
  return Promise.resolve(getJobMatches(jobId));
}

export function approveCandidateMatch(
  jobId: string,
  candidateId: string,
  matchId: string
): Promise<IngestMatch | null> {
  const match = getStore().matches.find((m) => m.id === matchId && m.jobId === jobId);
  if (!match) return Promise.resolve(null);
  updateMatch(matchId, (m) => ({
    ...m,
    approvedBy: "Current User",
    approvedAt: new Date().toISOString(),
  }));
  appendJobLog(jobId, "matching", "success", "Match approved", {
    matchId,
    candidateId,
    canonicalTrackId: match.canonicalTrackId,
  });
  return Promise.resolve(getStore().matches.find((m) => m.id === matchId) ?? null);
}

export function rejectCandidateMatch(
  jobId: string,
  matchId: string
): Promise<IngestMatch | null> {
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
    matchId,
    candidateId: match.candidateId,
  });
  return Promise.resolve(getStore().matches.find((m) => m.id === matchId) ?? null);
}

export function rematchCandidate(
  jobId: string,
  candidateId: string,
  canonicalTrackId: string,
  confidence: number,
  method: string
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
    matchId: match.id,
    candidateId,
    canonicalTrackId,
    confidence,
  });
  return Promise.resolve(getStore().matches.find((m) => m.id === match.id) ?? null);
}

export function markAsNewEntity(
  jobId: string,
  candidateId: string
): Promise<IngestMatch | null> {
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
    matchId: match.id,
    candidateId,
  });
  return Promise.resolve(getStore().matches.find((m) => m.id === match.id) ?? null);
}

// ─── Review Issues ───
export function getReviewIssues(jobId: string): Promise<ReviewIssue[]> {
  return Promise.resolve(getJobIssues(jobId));
}

export function resolveReviewIssue(
  jobId: string,
  issueId: string,
  payload: ResolveIssuePayload
): Promise<ReviewIssue | null> {
  const issue = getStore().issues.find((i) => i.id === issueId && i.jobId === jobId);
  if (!issue) return Promise.resolve(null);
  const status: IssueStatus =
    payload.resolution === "resolve" || payload.resolution === "override"
      ? "resolved"
      : "ignored";
  updateIssue(issueId, (i) => ({
    ...i,
    status,
    resolutionNote: payload.note,
    resolvedBy: "Current User",
    resolvedAt: new Date().toISOString(),
  }));
  const actionLabel = payload.resolution === "override" ? "overridden" : payload.resolution === "resolve" ? "resolved" : "ignored";
  appendJobLog(jobId, "review", payload.resolution === "override" ? "warning" : "success", `Issue ${actionLabel}: ${issue.issueType}`, {
    issueId,
    issueType: issue.issueType,
    resolution: payload.resolution,
  });
  return Promise.resolve(getStore().issues.find((i) => i.id === issueId) ?? null);
}

export function reopenIssue(
  jobId: string,
  issueId: string
): Promise<ReviewIssue | null> {
  const issue = getStore().issues.find((i) => i.id === issueId && i.jobId === jobId);
  if (!issue) return Promise.resolve(null);
  updateIssue(issueId, (i) => ({
    ...i,
    status: "open" as const,
    resolutionNote: null,
    resolvedBy: null,
    resolvedAt: null,
  }));
  appendJobLog(jobId, "review", "warning", `Issue reopened: ${issue.issueType}`, {
    issueId,
    issueType: issue.issueType,
  });
  return Promise.resolve(getStore().issues.find((i) => i.id === issueId) ?? null);
}

// ─── Ranking ───
export function applyRankOverride(
  jobId: string,
  candidateId: string,
  payload: RankOverridePayload
): Promise<IngestCandidate | null> {
  const candidate = getStore().candidates.find((c) => c.id === candidateId && c.jobId === jobId);
  if (!candidate) return Promise.resolve(null);
  updateCandidate(candidateId, (c) => ({
    ...c,
    manualRankOverride: payload.rank,
    finalRank: payload.rank,
  }));

  // Check for duplicate ranks
  const candidates = getJobCandidates(jobId);
  const dupRanks = candidates.filter((c) => c.finalRank === payload.rank && c.id !== candidateId);
  if (dupRanks.length > 0 && dupRanks.some((c) => c.manualRankOverride !== null)) {
    // Add blocking issue for duplicate ranks
    const newIssue: ReviewIssue = {
      id: `issue-${Date.now()}`,
      jobId,
      candidateId,
      severity: "high",
      issueType: "duplicate_rank",
      message: `Rank ${payload.rank} is assigned to multiple candidates. Manual overrides create conflict.`,
      status: "open",
      blocking: true,
      resolutionNote: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };
    addIssue(newIssue);
    appendJobLog(jobId, "scoring", "warning", `Duplicate rank detected: ${payload.rank}`, {
      candidateId,
      rank: payload.rank,
    });
  }

  appendJobLog(jobId, "scoring", "info", `Manual rank override applied: ${candidate.normalizedTitle} → rank ${payload.rank}`, {
    candidateId,
    rank: payload.rank,
    reason: payload.reason,
  });
  return Promise.resolve(getStore().candidates.find((c) => c.id === candidateId) ?? null);
}

export function clearRankOverride(
  jobId: string,
  candidateId: string
): Promise<IngestCandidate | null> {
  const candidate = getStore().candidates.find((c) => c.id === candidateId && c.jobId === jobId);
  if (!candidate) return Promise.resolve(null);
  updateCandidate(candidateId, (c) => ({
    ...c,
    manualRankOverride: null,
    finalRank: c.calculatedRank,
  }));
  appendJobLog(jobId, "scoring", "info", `Rank override cleared for ${candidate.normalizedTitle}`, {
    candidateId,
  });
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
    movement: i < 3 ? "up" : i > 35 ? "new" : "same",
    previousRank: i < 3 ? i + 3 : null,
    peakPosition: i + 1,
    weeksOnChart: i < 10 ? 5 + i : 2,
    score: c.score,
    entryPayload: { track: c },
    locked: false,
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
    ...j,
    status: "published",
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  }));

  // Create edition
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

  // Create snapshot
  const snapshot: Snapshot = {
    id: `snap-${Date.now()}`,
    editionId: newEdition.id,
    familyId: job.chartFamilyId,
    snapshotJson: {
      edition: { id: newEdition.id, label: newEdition.label },
      entries: summary.draftEntries,
      chartFamily: { id: job.chartFamilyId, label: job.chartFamily?.label ?? "" },
    },
    publishedAt: newEdition.publishedAt!,
    publishedBy: "Current User",
  };
  addSnapshot(snapshot);

  appendJobLog(jobId, "publish", "success", `Edition published successfully with ${summary.finalChartSize} entries`, {
    entryCount: summary.finalChartSize,
    editionId: newEdition.id,
    snapshotId: snapshot.id,
  });
  return getIngestJob(jobId);
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
    .map((c) => ({
      id: c.id,
      title: c.normalizedTitle,
      artist: c.normalizedArtistLine,
    }));
  return Promise.resolve(results);
}