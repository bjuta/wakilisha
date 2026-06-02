/**
 * Ingest Studio Types — Provider-based ingestion pipeline
 * Matches the WAKILISHA Admin Build Brief data contracts.
 * These types are used for the new provider-based ingestion flow (Spotify, Apple Music, etc.)
 * distinct from the legacy CSV-focused IngestJob types.
 */

export type IngestRunStatus =
  | "draft"
  | "queued"
  | "running"
  | "dry_run_complete"
  | "ready_to_commit"
  | "committing"
  | "committed"
  | "failed"
  | "cancelled"
  | "needs_review";

export type IngestStage =
  | "validate"
  | "provider_detection"
  | "resource_guard"
  | "source_fetch"
  | "normalize"
  | "canonical_match"
  | "enrichment"
  | "snapshot_commit";

export type IngestStageStatus = {
  stage: IngestStage;
  status: "idle" | "running" | "done" | "warning" | "failed";
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  message?: string;
  metrics?: Record<string, unknown>;
};

export type ProviderName = "spotify" | "apple_music" | "unknown";

export type NormalizedChartRow = {
  sourceProvider: "spotify" | "apple_music";
  sourceUrl: string;
  sourceRowId?: string;
  rank: number;
  previousRank?: number | null;
  movement?: "up" | "down" | "same" | "new" | "reentry" | null;
  trackTitle?: string;
  releaseTitle?: string;
  artistNames: string[];
  providerTrackId?: string;
  providerReleaseId?: string;
  providerArtistIds?: string[];
  artworkUrl?: string | null;
  previewUrl?: string | null;
  externalUrl?: string | null;
  raw: unknown;
};

export type MatchStatus = "canonical" | "shell" | "no_match" | "duplicate_candidate" | "needs_review";

export type IngestResolvedRow = {
  id: string;
  rank: number;
  previousRank?: number | null;
  movement?: string | null;
  sourceProvider: "spotify" | "apple_music";
  sourceUrl: string;
  title: string;
  artistNames: string[];
  artworkUrl?: string | null;
  matchStatus: MatchStatus;
  confidence: number;
  canonicalTrackId?: string | null;
  canonicalReleaseId?: string | null;
  canonicalArtistIds?: string[];
  releaseShellId?: string | null;
  warnings?: string[];
  raw?: unknown;
};

export type IngestRunSummary = {
  totalRows: number;
  canonicalMatches: number;
  shells: number;
  gaps: number;
  duplicateCandidates: number;
  matchRate: number;
};

export interface IngestRun {
  id: string;
  chartTitle: string;
  chartSlug: string;
  editionDate: string;
  chartSize: number;
  market: string;
  chartKind: "tracks" | "releases";
  coverStyle?: string;
  sourceUrls: string[];
  detectedProviders: ProviderName[];
  saveAsRecurringSeries: boolean;
  existingSeriesId?: string | null;
  eligibilityProfileId?: string | null;
  status: IngestRunStatus;
  stages: IngestStageStatus[];
  summary: IngestRunSummary;
  rows: IngestResolvedRow[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dryRunCompletedAt?: string | null;
  committedAt?: string | null;
  editionId?: string | null;
  editionSlug?: string | null;
  snapshotId?: string | null;
  notes?: string;
  errorMessage?: string | null;
}

export type CreateIngestDryRunRequest = {
  chartTitle: string;
  chartSlug: string;
  editionDate: string;
  chartSize: number;
  market: string;
  chartKind: "tracks" | "releases";
  coverStyle?: string;
  sourceUrls: string[];
  saveAsRecurringSeries?: boolean;
  existingSeriesId?: string | null;
  eligibilityProfileId?: string | null;
};

export type CreateIngestDryRunResponse = {
  runId: string;
  status: IngestRunStatus;
  stages: IngestStageStatus[];
  summary: IngestRunSummary;
  rows: IngestResolvedRow[];
};

export type CommitIngestRunRequest = {
  runId: string;
  publishImmediately?: boolean;
  notes?: string;
};

export type CommitIngestRunResponse = {
  runId: string;
  status: "committed";
  programId: string;
  publicSlug: string;
  editionId: string;
  editionSlug: string;
  editionDate: string;
  entryCount: number;
  snapshotId: string | null;
  publicUrl: string;
  apiUrl: string;
  integrity: {
    ok: boolean;
    warnings: string[];
    errors: string[];
  };
  auditEventId: string | null;
  committedAt: string;
  committedBy: string;
};

export type ApiEnvelope<T> = {
  data: T;
  meta: {
    apiVersion: "v2";
    generatedAt: string;
    source: string;
    repository: "database" | "fixture";
    warnings?: string[];
  };
};

export type IngestStudioKpi = {
  editionsThisWeek: number;
  canonicalMatchRate: number;
  rowsAwaitingReview: number;
  averageRunTimeMs: number;
};

export type RecentIngestActivity = {
  id: string;
  type: "dry_run" | "commit" | "cancel" | "retry" | "review";
  chartTitle: string;
  runId: string;
  status: IngestRunStatus;
  actor: string;
  createdAt: string;
  summary?: IngestRunSummary;
};

export type ResourceGuardStatus = {
  sourceCount: number;
  providerBudgetRemaining: number;
  workerConcurrency: number;
  estimatedRowCount: number;
  duplicateRunWarning?: string | null;
  sameEditionDateWarning?: string | null;
};
