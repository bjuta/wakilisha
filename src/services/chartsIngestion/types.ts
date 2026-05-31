/**
 * Chart Ingestion Service Types
 * Mirrors the WAKILISHA Charts Ingestion System Brief database contract.
 * All fields match the expected backend schema so the mock API can be swapped
 * for real WordPress REST endpoints without changing the UI.
 */

export type IngestJobStatus =
  | "draft"
  | "fetching"
  | "normalizing"
  | "matching"
  | "scoring"
  | "review"
  | "ready_to_draft"
  | "drafted"
  | "published"
  | "failed"
  | "cancelled";

export type SourceType =
  | "spotify"
  | "apple_music"
  | "youtube"
  | "csv"
  | "manual"
  | "airplay"
  | "legacy_wakilisha"
  | "previous_edition";

export type SourceStatus = "pending" | "fetching" | "completed" | "failed";

export type Provider =
  | "spotify"
  | "apple"
  | "youtube"
  | "csv"
  | "manual"
  | "airplay"
  | "legacy"
  | "previous";

export type CandidateStatus = "candidate" | "excluded" | "needs_review" | "approved";

export type EligibilityStatus = "eligible" | "excluded" | "needs_review";

export type MatchMethod = "isrc" | "provider_id" | "title_artist" | "manual" | "new_entity";

export type IssueSeverity = "high" | "medium" | "low";

export type IssueType =
  | "duplicate_rank"
  | "duplicate_track"
  | "missing_artwork"
  | "missing_canonical_artist"
  | "missing_source_url"
  | "suspicious_new_number_one"
  | "huge_movement_jump"
  | "missing_title"
  | "missing_artist"
  | "provider_metadata_conflict"
  | "unresolved_canonical_track"
  | "unresolved_artist";

export type IssueStatus = "open" | "resolved" | "ignored";

export interface ChartFamily {
  id: string;
  familyKey: string;
  label: string;
  description: string;
  defaultChartSize: number;
  defaultRegion: string;
  editionFrequency: "weekly" | "monthly" | "daily";
  defaultRuleset: string;
  defaultScoringModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface IngestJob {
  id: string;
  chartFamilyId: string;
  chartFamily?: ChartFamily;
  editionId: string | null;
  editionSlug: string | null;
  status: IngestJobStatus;
  editionDate: string;
  periodStart: string;
  periodEnd: string;
  chartSize: number;
  rulesetKey: string;
  scoringModelKey: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  sourceSummary: SourceSummary;
  jobSummary: JobSummary;
  errorMessage: string | null;
}

export interface SourceSummary {
  totalSources: number;
  completedSources: number;
  failedSources: number;
  totalRawItems: number;
  totalNormalized: number;
}

export interface JobSummary {
  totalCandidates: number;
  approvedMatches: number;
  unresolvedMatches: number;
  newEntities: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  eligibleCandidates: number;
  excludedCandidates: number;
  finalChartSize: number;
}

export interface IngestSource {
  id: string;
  jobId: string;
  sourceType: SourceType;
  provider: Provider;
  sourceUrl: string | null;
  uploadedFileId: string | null;
  weight: number;
  priority: number;
  status: SourceStatus;
  rawCount: number;
  normalizedCount: number;
  errorCount: number;
  fetchedAt: string | null;
  rawResponseHash: string | null;
  errorMessage: string | null;
}

export interface RawSourceItem {
  id: string;
  jobId: string;
  sourceId: string;
  sourcePosition: number | null;
  providerTrackId: string | null;
  providerArtistId: string | null;
  isrc: string | null;
  titleRaw: string;
  artistRaw: string;
  releaseRaw: string | null;
  rawPayloadJson: Record<string, unknown>;
  rawHash: string;
  createdAt: string;
}

export interface IngestCandidate {
  id: string;
  jobId: string;
  rawItemIds: string[];
  normalizedTitle: string;
  normalizedArtistLine: string;
  normalizedArtists: string[];
  normalizedReleaseTitle: string | null;
  isrc: string | null;
  upc: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  externalUrls: Record<string, string>;
  durationMs: number | null;
  releaseDate: string | null;
  label: string | null;
  genre: string | null;
  sourcePositions: Record<string, number>;
  sourceMetrics: Record<string, number>;
  candidateHash: string;
  dedupeGroupKey: string | null;
  eligibilityStatus: EligibilityStatus;
  eligibilityReasons: string[];
  score: number;
  calculatedRank: number;
  manualRankOverride: number | null;
  finalRank: number | null;
  status: CandidateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IngestMatch {
  id: string;
  jobId: string;
  candidateId: string;
  canonicalTrackId: string | null;
  canonicalReleaseId: string | null;
  canonicalArtistIds: string[];
  matchConfidence: number;
  matchMethod: MatchMethod;
  matchNotes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface ReviewIssue {
  id: string;
  jobId: string;
  candidateId: string | null;
  severity: IssueSeverity;
  issueType: IssueType;
  message: string;
  status: IssueStatus;
  blocking: boolean;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface DraftEntry {
  id: string;
  jobId: string;
  candidateId: string;
  finalRank: number;
  canonicalTrackId: string;
  movement: "up" | "down" | "same" | "new" | "re_entry";
  previousRank: number | null;
  peakPosition: number | null;
  weeksOnChart: number | null;
  score: number;
  entryPayload: Record<string, unknown>;
  locked: boolean;
}

export interface ScoreBreakdown {
  spotify: number;
  apple: number;
  youtube: number;
  airplay: number;
  continuity: number;
  manualOverride: number;
  penalties: number;
  total: number;
}

export type LogLevel = "info" | "warning" | "error" | "success";

export interface IngestJobLog {
  id: string;
  jobId: string;
  stage: string;
  level: LogLevel;
  message: string;
  contextJson: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface CsvColumnMapping {
  csvColumn: string;
  detectedField: string;
  sampleValue: string;
  required: boolean;
  status: "mapped" | "ignored" | "unmapped";
}

export interface CsvMappingPreview {
  rowsDetected: number;
  missingTitles: number;
  missingArtists: number;
  missingIsrcs: number;
  duplicateRows: number;
  columns: CsvColumnMapping[];
  readyToNormalize: boolean;
}

export interface ChartEdition {
  id: string;
  familyId: string;
  slug: string;
  label: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "published";
  ingestJobId: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  entryCount: number;
  newEntries: number;
  reEntries: number;
}

export interface Snapshot {
  id: string;
  editionId: string;
  familyId: string;
  snapshotJson: Record<string, unknown>;
  publishedAt: string;
  publishedBy: string;
}

export interface CreateIngestJobPayload {
  chartFamilyId: string;
  editionDate: string;
  periodStart: string;
  periodEnd: string;
  chartSize: number;
  rulesetKey: string;
  scoringModelKey: string;
}

export interface AddSourcePayload {
  sourceType: SourceType;
  provider: Provider;
  sourceUrl: string | null;
  weight: number;
  priority: number;
}

export interface ResolveIssuePayload {
  resolution: "resolve" | "ignore" | "override";
  note: string;
}

export interface RankOverridePayload {
  rank: number;
  reason: string;
}

export interface DashboardKpis {
  activeJobs: number;
  failedJobs: number;
  pendingReviewIssues: number;
  latestPublishedEdition: ChartEdition | null;
  totalFamilies: number;
  totalPublishedEditions: number;
}