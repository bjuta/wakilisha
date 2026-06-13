/**
 * Request/Response Normalizers
 * Converts between React camelCase and WordPress snake_case.
 * All toWp* functions convert React payloads to WordPress format.
 * All fromWp* functions convert WordPress responses to React format.
 */

import { ChartFamily } from "./types";
import type {
  IngestJob,
  IngestSource,
  IngestCandidate,
  IngestMatch,
  ReviewIssue,
  DraftEntry,
  ChartEdition,
  Snapshot,
  DashboardKpis,
  CreateIngestJobPayload,
  AddSourcePayload,
  RankOverridePayload,
  LogLevel,
  IngestJobStatus,
  SourceType,
  Provider,
  SourceStatus,
  CandidateStatus,
  EligibilityStatus,
  MatchMethod,
  IssueSeverity,
  IssueType,
  IssueStatus,
} from "./types";

// ─── Generic Helpers ───

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function keysToSnakeCase<T>(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[snakeKey] = keysToSnakeCase(value as Record<string, unknown>);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

export function keysToCamelCase<T>(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[camelKey] = keysToCamelCase(value as Record<string, unknown>);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

// ─── Enum Normalizers ───

function normalizeIngestJobStatus(status: unknown): IngestJobStatus {
  const valid: IngestJobStatus[] = [
    "draft", "fetching", "normalizing", "matching", "scoring",
    "review", "ready_to_draft", "drafted", "published", "failed", "cancelled",
  ];
  if (typeof status === "string" && valid.includes(status as IngestJobStatus)) {
    return status as IngestJobStatus;
  }
  return "draft";
}

function normalizeSourceType(type: unknown): SourceType {
  const valid: SourceType[] = [
    "spotify", "apple_music", "youtube", "csv", "manual", "airplay", "legacy_wakilisha", "previous_edition",
  ];
  if (typeof type === "string" && valid.includes(type as SourceType)) {
    return type as SourceType;
  }
  return "manual";
}

function normalizeProvider(provider: unknown): Provider {
  const valid: Provider[] = [
    "spotify", "apple", "youtube", "csv", "manual", "airplay", "legacy", "previous",
  ];
  if (typeof provider === "string" && valid.includes(provider as Provider)) {
    return provider as Provider;
  }
  return "manual";
}

function normalizeSourceStatus(status: unknown): SourceStatus {
  const valid: SourceStatus[] = ["pending", "fetching", "completed", "failed"];
  if (typeof status === "string" && valid.includes(status as SourceStatus)) {
    return status as SourceStatus;
  }
  return "pending";
}

function normalizeCandidateStatus(status: unknown): CandidateStatus {
  const valid: CandidateStatus[] = ["candidate", "excluded", "needs_review", "approved"];
  if (typeof status === "string" && valid.includes(status as CandidateStatus)) {
    return status as CandidateStatus;
  }
  return "candidate";
}

function normalizeEligibilityStatus(status: unknown): EligibilityStatus {
  const valid: EligibilityStatus[] = ["eligible", "excluded", "needs_review"];
  if (typeof status === "string" && valid.includes(status as EligibilityStatus)) {
    return status as EligibilityStatus;
  }
  return "needs_review";
}

function normalizeMatchMethod(method: unknown): MatchMethod {
  const valid: MatchMethod[] = ["isrc", "provider_id", "title_artist", "manual", "new_entity"];
  if (typeof method === "string" && valid.includes(method as MatchMethod)) {
    return method as MatchMethod;
  }
  return "manual";
}

function normalizeIssueSeverity(severity: unknown): IssueSeverity {
  const valid: IssueSeverity[] = ["high", "medium", "low"];
  if (typeof severity === "string" && valid.includes(severity as IssueSeverity)) {
    return severity as IssueSeverity;
  }
  return "low";
}

function normalizeIssueType(type: unknown): IssueType {
  const valid: IssueType[] = [
    "duplicate_rank", "duplicate_track", "missing_artwork", "missing_canonical_artist",
    "missing_source_url", "suspicious_new_number_one", "huge_movement_jump", "missing_title",
    "missing_artist", "provider_metadata_conflict", "unresolved_canonical_track", "unresolved_artist",
  ];
  if (typeof type === "string" && valid.includes(type as IssueType)) {
    return type as IssueType;
  }
  return "missing_title";
}

function normalizeIssueStatus(status: unknown): IssueStatus {
  const valid: IssueStatus[] = ["open", "resolved", "ignored"];
  if (typeof status === "string" && valid.includes(status as IssueStatus)) {
    return status as IssueStatus;
  }
  return "open";
}

function normalizeLogLevel(level: unknown): LogLevel {
  const valid: LogLevel[] = ["info", "warning", "error", "success"];
  if (typeof level === "string" && valid.includes(level as LogLevel)) {
    return level as LogLevel;
  }
  return "info";
}

// ─── Payload Normalizers (React → WordPress) ───

export function toWpIngestJobPayload(payload: CreateIngestJobPayload): Record<string, unknown> {
  return {
    chart_family_id: payload.chartFamilyId,
    edition_date: payload.editionDate,
    period_start: payload.periodStart,
    period_end: payload.periodEnd,
    chart_size: payload.chartSize,
    ruleset_key: payload.rulesetKey,
    scoring_model_key: payload.scoringModelKey,
  };
}

export function toWpSourcePayload(payload: AddSourcePayload): Record<string, unknown> {
  return {
    source_type: payload.sourceType,
    provider: payload.provider,
    source_url: payload.sourceUrl,
    weight: payload.weight,
    priority: payload.priority,
  };
}

export function toWpResolveIssuePayload(payload: {
  resolution: "resolve" | "ignore" | "override";
  note: string;
}): Record<string, unknown> {
  return {
    resolution: payload.resolution,
    note: payload.note,
  };
}

export function toWpRankOverridePayload(payload: RankOverridePayload): Record<string, unknown> {
  return {
    rank: payload.rank,
    reason: payload.reason,
  };
}

// ─── Response Normalizers (WordPress → React) ───

export function fromWpChartFamily(data: unknown): ChartFamily {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid chart family data");
  }
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    familyKey: String(d.family_key ?? d.familyKey ?? d.id ?? ""),
    label: String(d.label ?? ""),
    description: String(d.description ?? ""),
    defaultChartSize: Number(d.default_chart_size ?? d.defaultChartSize ?? 40),
    defaultRegion: String(d.default_region ?? d.defaultRegion ?? ""),
    editionFrequency: (d.edition_frequency ?? d.editionFrequency ?? "weekly") as "weekly" | "monthly" | "daily",
    defaultRuleset: String(d.default_ruleset ?? d.defaultRuleset ?? ""),
    defaultScoringModel: String(d.default_scoring_model ?? d.defaultScoringModel ?? ""),
    publicSlug: String(d.public_slug ?? d.publicSlug ?? d.familyKey ?? d.id ?? ""),
    createdAt: String(d.created_at ?? d.createdAt ?? ""),
    updatedAt: String(d.updated_at ?? d.updatedAt ?? ""),
  };
}

export function fromWpIngestJob(data: unknown): IngestJob {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid ingest job data");
  }
  const d = data as Record<string, unknown>;

  const sourceSummary = (d.source_summary ?? d.sourceSummary ?? {}) as Record<string, unknown>;
  const jobSummary = (d.job_summary ?? d.jobSummary ?? {}) as Record<string, unknown>;

  return {
    id: String(d.id ?? ""),
    chartFamilyId: String(d.chart_family_id ?? d.chartFamilyId ?? ""),
    chartFamily: d.chart_family ? fromWpChartFamily(d.chart_family) : undefined,
    editionId: d.edition_id !== undefined ? String(d.edition_id) : (d.editionId !== undefined ? String(d.editionId) : null),
    editionSlug: d.edition_slug !== undefined ? String(d.edition_slug) : (d.editionSlug !== undefined ? String(d.editionSlug) : null),
    status: normalizeIngestJobStatus(d.status),
    editionDate: String(d.edition_date ?? d.editionDate ?? ""),
    periodStart: String(d.period_start ?? d.periodStart ?? ""),
    periodEnd: String(d.period_end ?? d.periodEnd ?? ""),
    chartSize: Number(d.chart_size ?? d.chartSize ?? 40),
    rulesetKey: String(d.ruleset_key ?? d.rulesetKey ?? ""),
    scoringModelKey: String(d.scoring_model_key ?? d.scoringModelKey ?? ""),
    createdBy: String(d.created_by ?? d.createdBy ?? ""),
    createdAt: String(d.created_at ?? d.createdAt ?? ""),
    updatedAt: String(d.updated_at ?? d.updatedAt ?? ""),
    completedAt: d.completed_at !== undefined ? String(d.completed_at) : (d.completedAt !== undefined ? String(d.completedAt) : null),
    sourceSummary: {
      totalSources: Number(sourceSummary.total_sources ?? sourceSummary.totalSources ?? 0),
      completedSources: Number(sourceSummary.completed_sources ?? sourceSummary.completedSources ?? 0),
      failedSources: Number(sourceSummary.failed_sources ?? sourceSummary.failedSources ?? 0),
      totalRawItems: Number(sourceSummary.total_raw_items ?? sourceSummary.totalRawItems ?? 0),
      totalNormalized: Number(sourceSummary.total_normalized ?? sourceSummary.totalNormalized ?? 0),
    },
    jobSummary: {
      totalCandidates: Number(jobSummary.total_candidates ?? jobSummary.totalCandidates ?? 0),
      approvedMatches: Number(jobSummary.approved_matches ?? jobSummary.approvedMatches ?? 0),
      unresolvedMatches: Number(jobSummary.unresolved_matches ?? jobSummary.unresolvedMatches ?? 0),
      newEntities: Number(jobSummary.new_entities ?? jobSummary.newEntities ?? 0),
      highIssues: Number(jobSummary.high_issues ?? jobSummary.highIssues ?? 0),
      mediumIssues: Number(jobSummary.medium_issues ?? jobSummary.mediumIssues ?? 0),
      lowIssues: Number(jobSummary.low_issues ?? jobSummary.lowIssues ?? 0),
      eligibleCandidates: Number(jobSummary.eligible_candidates ?? jobSummary.eligibleCandidates ?? 0),
      excludedCandidates: Number(jobSummary.excluded_candidates ?? jobSummary.excludedCandidates ?? 0),
      finalChartSize: Number(jobSummary.final_chart_size ?? jobSummary.finalChartSize ?? 0),
    },
    errorMessage: d.error_message !== undefined ? String(d.error_message) : (d.errorMessage !== undefined ? String(d.errorMessage) : null),
  };
}

export function fromWpSource(data: unknown): IngestSource {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid source data");
  }
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    jobId: String(d.job_id ?? d.jobId ?? ""),
    sourceType: normalizeSourceType(d.source_type ?? d.sourceType),
    provider: normalizeProvider(d.provider ?? ""),
    sourceUrl: d.source_url !== undefined ? String(d.source_url) : (d.sourceUrl !== undefined ? String(d.sourceUrl) : null),
    uploadedFileId: d.uploaded_file_id !== undefined ? String(d.uploaded_file_id) : (d.uploadedFileId !== undefined ? String(d.uploadedFileId) : null),
    weight: Number(d.weight ?? 1),
    priority: Number(d.priority ?? 1),
    status: normalizeSourceStatus(d.status),
    rawCount: Number(d.raw_count ?? d.rawCount ?? 0),
    normalizedCount: Number(d.normalized_count ?? d.normalizedCount ?? 0),
    errorCount: Number(d.error_count ?? d.errorCount ?? 0),
    fetchedAt: d.fetched_at !== undefined ? String(d.fetched_at) : (d.fetchedAt !== undefined ? String(d.fetchedAt) : null),
    rawResponseHash: d.raw_response_hash !== undefined ? String(d.raw_response_hash) : (d.rawResponseHash !== undefined ? String(d.rawResponseHash) : null),
    errorMessage: d.error_message !== undefined ? String(d.error_message) : (d.errorMessage !== undefined ? String(d.errorMessage) : null),
  };
}

export function fromWpCandidate(data: unknown): IngestCandidate {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid candidate data");
  }
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    jobId: String(d.job_id ?? d.jobId ?? ""),
    rawItemIds: Array.isArray(d.raw_item_ids ?? d.rawItemIds) ? (d.raw_item_ids ?? d.rawItemIds) as string[] : [],
    normalizedTitle: String(d.normalized_title ?? d.normalizedTitle ?? ""),
    normalizedArtistLine: String(d.normalized_artist_line ?? d.normalizedArtistLine ?? ""),
    normalizedArtists: Array.isArray(d.normalized_artists ?? d.normalizedArtists) ? (d.normalized_artists ?? d.normalizedArtists) as string[] : [],
    normalizedReleaseTitle: d.normalized_release_title !== undefined ? String(d.normalized_release_title) : (d.normalizedReleaseTitle !== undefined ? String(d.normalizedReleaseTitle) : null),
    isrc: d.isrc !== undefined ? String(d.isrc) : null,
    upc: d.upc !== undefined ? String(d.upc) : null,
    artworkUrl: d.artwork_url !== undefined ? String(d.artwork_url) : (d.artworkUrl !== undefined ? String(d.artworkUrl) : null),
    previewUrl: d.preview_url !== undefined ? String(d.preview_url) : (d.previewUrl !== undefined ? String(d.previewUrl) : null),
    externalUrls: (d.external_urls ?? d.externalUrls ?? {}) as Record<string, string>,
    durationMs: d.duration_ms !== undefined ? Number(d.duration_ms) : (d.durationMs !== undefined ? Number(d.durationMs) : null),
    releaseDate: d.release_date !== undefined ? String(d.release_date) : (d.releaseDate !== undefined ? String(d.releaseDate) : null),
    label: d.label !== undefined ? String(d.label) : null,
    genre: d.genre !== undefined ? String(d.genre) : null,
    sourcePositions: (d.source_positions ?? d.sourcePositions ?? {}) as Record<string, number>,
    sourceMetrics: (d.source_metrics ?? d.sourceMetrics ?? {}) as Record<string, number>,
    candidateHash: String(d.candidate_hash ?? d.candidateHash ?? ""),
    dedupeGroupKey: d.dedupe_group_key !== undefined ? String(d.dedupe_group_key) : (d.dedupeGroupKey !== undefined ? String(d.dedupeGroupKey) : null),
    eligibilityStatus: normalizeEligibilityStatus(d.eligibility_status ?? d.eligibilityStatus),
    eligibilityReasons: Array.isArray(d.eligibility_reasons ?? d.eligibilityReasons) ? (d.eligibility_reasons ?? d.eligibilityReasons) as string[] : [],
    score: Number(d.score ?? 0),
    calculatedRank: Number(d.calculated_rank ?? d.calculatedRank ?? 0),
    manualRankOverride: d.manual_rank_override !== undefined ? (d.manual_rank_override === null ? null : Number(d.manual_rank_override)) : (d.manualRankOverride !== undefined ? (d.manualRankOverride === null ? null : Number(d.manualRankOverride)) : null),
    finalRank: d.final_rank !== undefined ? (d.final_rank === null ? null : Number(d.final_rank)) : (d.finalRank !== undefined ? (d.finalRank === null ? null : Number(d.finalRank)) : null),
    status: normalizeCandidateStatus(d.status),
    createdAt: String(d.created_at ?? d.createdAt ?? ""),
    updatedAt: String(d.updated_at ?? d.updatedAt ?? ""),
  };
}

export function fromWpMatch(data: unknown): IngestMatch {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid match data");
  }
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    jobId: String(d.job_id ?? d.jobId ?? ""),
    candidateId: String(d.candidate_id ?? d.candidateId ?? ""),
    canonicalTrackId: d.canonical_track_id !== undefined ? String(d.canonical_track_id) : (d.canonicalTrackId !== undefined ? String(d.canonicalTrackId) : null),
    canonicalReleaseId: d.canonical_release_id !== undefined ? String(d.canonical_release_id) : (d.canonicalReleaseId !== undefined ? String(d.canonicalReleaseId) : null),
    canonicalArtistIds: Array.isArray(d.canonical_artist_ids ?? d.canonicalArtistIds) ? (d.canonical_artist_ids ?? d.canonicalArtistIds) as string[] : [],
    matchConfidence: Number(d.match_confidence ?? d.matchConfidence ?? 0),
    matchMethod: normalizeMatchMethod(d.match_method ?? d.matchMethod),
    matchNotes: d.match_notes !== undefined ? String(d.match_notes) : (d.matchNotes !== undefined ? String(d.matchNotes) : null),
    approvedBy: d.approved_by !== undefined ? (d.approved_by === null ? null : String(d.approved_by)) : (d.approvedBy !== undefined ? (d.approvedBy === null ? null : String(d.approvedBy)) : null),
    approvedAt: d.approved_at !== undefined ? (d.approved_at === null ? null : String(d.approved_at)) : (d.approvedAt !== undefined ? (d.approvedAt === null ? null : String(d.approvedAt)) : null),
  };
}

export function fromWpReviewIssue(data: unknown): ReviewIssue {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid review issue data");
  }
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    jobId: String(d.job_id ?? d.jobId ?? ""),
    candidateId: d.candidate_id !== undefined ? String(d.candidate_id) : (d.candidateId !== undefined ? String(d.candidateId) : null),
    severity: normalizeIssueSeverity(d.severity),
    issueType: normalizeIssueType(d.issue_type ?? d.issueType),
    message: String(d.message ?? ""),
    status: normalizeIssueStatus(d.status),
    blocking: Boolean(d.blocking ?? false),
    resolutionNote: d.resolution_note !== undefined ? String(d.resolution_note) : (d.resolutionNote !== undefined ? String(d.resolutionNote) : null),
    resolvedBy: d.resolved_by !== undefined ? (d.resolved_by === null ? null : String(d.resolved_by)) : (d.resolvedBy !== undefined ? (d.resolvedBy === null ? null : String(d.resolvedBy)) : null),
    resolvedAt: d.resolved_at !== undefined ? (d.resolved_at === null ? null : String(d.resolved_at)) : (d.resolvedAt !== undefined ? (d.resolvedAt === null ? null : String(d.resolvedAt)) : null),
    createdAt: String(d.created_at ?? d.createdAt ?? ""),
  };
}

export function fromWpDraftEntry(data: unknown): DraftEntry {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid draft entry data");
  }
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    jobId: String(d.job_id ?? d.jobId ?? ""),
    candidateId: String(d.candidate_id ?? d.candidateId ?? ""),
    finalRank: Number(d.final_rank ?? d.finalRank ?? 0),
    canonicalTrackId: String(d.canonical_track_id ?? d.canonicalTrackId ?? ""),
    movement: (d.movement ?? "same") as "up" | "down" | "same" | "new" | "re_entry",
    previousRank: d.previous_rank !== undefined ? (d.previous_rank === null ? null : Number(d.previous_rank)) : (d.previousRank !== undefined ? (d.previousRank === null ? null : Number(d.previousRank)) : null),
    peakPosition: d.peak_position !== undefined ? (d.peak_position === null ? null : Number(d.peak_position)) : (d.peakPosition !== undefined ? (d.peakPosition === null ? null : Number(d.peakPosition)) : null),
    weeksOnChart: d.weeks_on_chart !== undefined ? (d.weeks_on_chart === null ? null : Number(d.weeks_on_chart)) : (d.weeksOnChart !== undefined ? (d.weeksOnChart === null ? null : Number(d.weeksOnChart)) : null),
    score: Number(d.score ?? 0),
    entryPayload: (d.entry_payload ?? d.entryPayload ?? {}) as Record<string, unknown>,
    locked: Boolean(d.locked ?? false),
  };
}

export function fromWpChartEdition(data: unknown): ChartEdition {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid chart edition data");
  }
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    familyId: String(d.family_id ?? d.familyId ?? ""),
    slug: String(d.slug ?? ""),
    label: String(d.label ?? ""),
    date: String(d.date ?? ""),
    periodStart: String(d.period_start ?? d.periodStart ?? ""),
    periodEnd: String(d.period_end ?? d.periodEnd ?? ""),
    status: (d.status ?? "draft") as "draft" | "published",
    ingestJobId: d.ingest_job_id !== undefined ? String(d.ingest_job_id) : (d.ingestJobId !== undefined ? String(d.ingestJobId) : null),
    publishedAt: d.published_at !== undefined ? (d.published_at === null ? null : String(d.published_at)) : (d.publishedAt !== undefined ? (d.publishedAt === null ? null : String(d.publishedAt)) : null),
    publishedBy: d.published_by !== undefined ? (d.published_by === null ? null : String(d.published_by)) : (d.publishedBy !== undefined ? (d.publishedBy === null ? null : String(d.publishedBy)) : null),
    entryCount: Number(d.entry_count ?? d.entryCount ?? 0),
    newEntries: Number(d.new_entries ?? d.newEntries ?? 0),
    reEntries: Number(d.re_entries ?? d.reEntries ?? 0),
  };
}

export function fromWpSnapshot(data: unknown): Snapshot {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid snapshot data");
  }
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    editionId: String(d.edition_id ?? d.editionId ?? ""),
    familyId: String(d.family_id ?? d.familyId ?? ""),
    snapshotJson: (d.snapshot_json ?? d.snapshotJson ?? {}) as Record<string, unknown>,
    publishedAt: String(d.published_at ?? d.publishedAt ?? ""),
    publishedBy: String(d.published_by ?? d.publishedBy ?? ""),
  };
}

export function fromWpDashboardKpis(data: unknown): DashboardKpis {
  if (!data || typeof data !== "object") {
    return {
      activeJobs: 0,
      failedJobs: 0,
      pendingReviewIssues: 0,
      latestPublishedEdition: null,
      totalFamilies: 0,
      totalPublishedEditions: 0,
    };
  }
  const d = data as Record<string, unknown>;
  const latestEdition = d.latest_published_edition ?? d.latestPublishedEdition;
  return {
    activeJobs: Number(d.active_jobs ?? d.activeJobs ?? 0),
    failedJobs: Number(d.failed_jobs ?? d.failedJobs ?? 0),
    pendingReviewIssues: Number(d.pending_review_issues ?? d.pendingReviewIssues ?? 0),
    latestPublishedEdition: latestEdition && typeof latestEdition === "object"
      ? fromWpChartEdition(latestEdition)
      : null,
    totalFamilies: Number(d.total_families ?? d.totalFamilies ?? 0),
    totalPublishedEditions: Number(d.total_published_editions ?? d.totalPublishedEditions ?? 0),
  };
}

export function fromWpIngestJobLog(data: unknown): {
  id: string;
  jobId: string;
  stage: string;
  level: LogLevel;
  message: string;
  contextJson: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
} {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid log data");
  }
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    jobId: String(d.job_id ?? d.jobId ?? ""),
    stage: String(d.stage ?? ""),
    level: normalizeLogLevel(d.level),
    message: String(d.message ?? ""),
    contextJson: (d.context_json ?? d.contextJson ?? {}) as Record<string, unknown>,
    createdBy: String(d.created_by ?? d.createdBy ?? ""),
    createdAt: String(d.created_at ?? d.createdAt ?? ""),
  };
}