/**
 * Sprint 5: Commit Service Types
 * V2 Ingest → Edition Bridge contracts
 * These types define the commit boundary between a trusted ingest run
 * and a published V2 chart edition.
 */

import type { IngestResolvedRow, IngestRunSummary } from "./ingestStudioTypes";

export type CommitErrorCode =
  | "run_not_found"
  | "program_not_found"
  | "commit_not_ready"
  | "duplicate_edition"
  | "no_rows_to_commit"
  | "unresolved_required_gaps"
  | "registry_write_failed"
  | "edition_write_failed"
  | "entry_write_failed"
  | "source_coverage_write_failed"
  | "public_api_verification_failed"
  | "snapshot_integrity_failed"
  | "commit_failed";

export class CommitError extends Error {
  code: CommitErrorCode;
  recoverable: boolean;
  context?: Record<string, unknown>;

  constructor(
    code: CommitErrorCode,
    message: string,
    recoverable = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "CommitError";
    this.code = code;
    this.recoverable = recoverable;
    this.context = context;
  }
}

export type CommitReadyIngestRun = {
  runId: string;
  status: "ready_to_commit" | "dry_run_complete";
  programId: string;
  publicSlug: string;
  seriesSlug: string;
  marketSlug: string;
  editionSlug: string;
  editionLabel: string;
  editionDate: string;
  periodStart: string;
  periodEnd: string;
  chartKind: "tracks" | "releases" | "artists" | "videos";
  sourceUrls: string[];
  rows: IngestResolvedRow[];
  summary: IngestRunSummary;
  readiness: PublishReadinessChecklist;
};

export type PublishReadinessChecklist = {
  dryRunCompleted: boolean;
  sourcesValid: boolean;
  metadataComplete: boolean;
  programResolved: boolean;
  canonicalMatchingDone: boolean;
  noFailedStages: boolean;
  requiredGapsResolved: boolean;
  chartSizeValid: boolean;
  duplicateEditionCheck: boolean;
  enrichmentDone: boolean;
};

export type CommitIngestRunRequest = {
  runId: string;
  publishImmediately?: boolean;
  overwriteExisting?: false;
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

// ─── V2 Edition shapes for mock persistence ───

export type V2Edition = {
  id: string;
  programId: string;
  publicSlug: string;
  sourceEditionId: string; // runId
  editionSlug: string;
  editionLabel: string;
  editionDate: string;
  periodStart: string;
  periodEnd: string;
  status: "published" | "draft" | "staged";
  entryCount: number;
  snapshotId: string | null;
  committedAt: string;
  committedBy: string;
  runId: string;
};

export type V2Entry = {
  id: string;
  editionId: string;
  rank: number;
  previousRank: number | null;
  movement: string | null;
  trackSlug: string;
  trackTitle: string;
  artistName: string;
  artistSlug: string | null;
  artworkUrl: string | null;
  sourceEntryId: string;
  rawPayload: Record<string, unknown>;
};

export type V2SourceCoverage = {
  id: string;
  editionId: string;
  sourceName: string;
  coverageStatus: "complete" | "partial" | "failed";
  coveragePayload: Record<string, unknown>;
};

export type V2Program = {
  id: string;
  publicSlug: string;
  seriesSlug: string;
  marketSlug: string;
  label: string;
  defaultMethodologyVersion: string;
  defaultEligibilityRulesVersion: string;
};

export type V2AuditEvent = {
  id: string;
  actor: string;
  runId: string;
  programId: string;
  publicSlug: string;
  editionId: string;
  editionSlug: string;
  sourceUrls: string[];
  entryCount: number;
  reviewGapCounts: {
    noMatch: number;
    needsReview: number;
    shell: number;
    duplicate: number;
  };
  committedAt: string;
};

export type CommitValidationResult = {
  canCommit: boolean;
  errors: CommitError[];
  warnings: string[];
};

export type BuildCommitReadyResult =
  | { ok: true; run: CommitReadyIngestRun }
  | { ok: false; errors: CommitError[] };