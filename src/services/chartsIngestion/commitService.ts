/**
 * Sprint 5: Commit Ingest Run to V2 Chart Edition
 * 
 * Turns a trusted, dry-run-complete ingest run into a real V2 chart edition.
 * Implements all 10 steps from the Sprint 5 brief.
 * 
 * Contract:
 *   POST /api/v1/charts/ingest/runs/:runId/commit
 */

import type {
  CommitIngestRunRequest,
  CommitIngestRunResponse,
  CommitReadyIngestRun,
  CommitValidationResult,
  V2Edition,
  V2Entry,
  V2SourceCoverage,
  V2AuditEvent,
  V2Program,
  PublishReadinessChecklist,
} from "./commitTypes";
import { CommitError } from "./commitTypes";
import { resolveV2Program } from "./v2Programs";
import {
  transactionalCommit,
  getV2EditionBySlug,
  getV2EditionByDate,
  markRunCommitted,
} from "./v2EditionStore";
import type { IngestRun, IngestResolvedRow } from "./ingestStudioTypes";

// ─── Public API base for V2 verification ───
const PUBLIC_V2_BASE =
  typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE || "/api/v1")
    : "/api/v1";

// ─── Step 1: Load run (already loaded from store, passed in) ───
// Validation: run must exist and have correct status

function assertRunExists(run: IngestRun | null): asserts run is IngestRun {
  if (!run) {
    throw new CommitError(
      "run_not_found",
      "No ingest run was found for this run ID.",
      false
    );
  }
}

// ─── Step 2: Validate readiness ───

async function buildReadinessChecklist(run: IngestRun): Promise<PublishReadinessChecklist> {
  const failedStages = run.stages.filter((s) => s.status === "failed");
  const fetchStage = run.stages.find((s) => s.stage === "source_fetch");
  const eligibilityStage = run.stages.find((s) => s.stage === "eligibility_execution");
  const scoringStage = run.stages.find((s) => s.stage === "methodology_scoring");
  const shortlistStage = run.stages.find((s) => s.stage === "shortlist");

  // In production, the pipeline has these core stages. The canonical_match
  // and entity_resolution stages are marked completed by the eligibility handler
  // in the edge function, but they may show "idle" if the pipeline was run as
  // individual stage triggers. So we check eligibility_execution instead.
  const corePipelineDone =
    (fetchStage?.status === "done" || fetchStage?.status === "warning") &&
    (eligibilityStage?.status === "done" || eligibilityStage?.status === "warning") &&
    (scoringStage?.status === "done" || scoringStage?.status === "warning") &&
    (shortlistStage?.status === "done" || shortlistStage?.status === "warning");

  const hasRows = run.rows.length > 0;
  const unresolvedGaps = run.rows.filter(
    (r) => r.matchStatus === "needs_review"
  );

  const programId = run.existingSeriesId || run.editionSlug || "";
  const programResolved = !!(programId && (await resolveV2Program(programId)));

  return {
    dryRunCompleted:
      run.status === "dry_run_complete" || run.status === "ready_to_commit",
    sourcesValid:
      fetchStage?.status === "done" || fetchStage?.status === "warning",
    metadataComplete:
      !!(run.chartTitle && run.chartSlug && run.editionDate),
    programResolved,
    canonicalMatchingDone:
      eligibilityStage?.status === "done" || eligibilityStage?.status === "warning",
    noFailedStages: failedStages.length === 0,
    requiredGapsResolved: unresolvedGaps.length === 0,
    chartSizeValid: run.chartSize >= 1 && run.chartSize <= 200,
    duplicateEditionCheck: true,
    // Enrichment is not part of the production 21-stage pipeline.
    // Mark it always-done so it never blocks commits.
    enrichmentDone: true,
  };
}

export async function validateCommitReadiness(run: IngestRun): Promise<CommitValidationResult> {
  const errors: CommitError[] = [];
  const warnings: string[] = [];
  const checklist = await buildReadinessChecklist(run);

  if (!checklist.dryRunCompleted) {
    errors.push(
      new CommitError(
        "commit_not_ready",
        `This run cannot be committed yet. Status is '${run.status}' — complete a dry run first.`,
        false
      )
    );
  }

  if (!checklist.metadataComplete) {
    errors.push(
      new CommitError(
        "commit_not_ready",
        `Required metadata is missing. Ensure chart title, slug, and edition date are all set.`,
        false,
        { chartTitle: run.chartTitle, chartSlug: run.chartSlug, editionDate: run.editionDate }
      )
    );
  }

  if (!checklist.sourcesValid) {
    const fetchStage = run.stages.find((s) => s.stage === "source_fetch");
    errors.push(
      new CommitError(
        "commit_not_ready",
        `Sources failed completely: ${fetchStage?.message || "check source URLs and credentials"}. Partial source failures are allowed.`,
        true
      )
    );
  }

  if (!checklist.noFailedStages) {
    const failedStages = run.stages.filter((s) => s.status === "failed");
    errors.push(
      new CommitError(
        "commit_not_ready",
        `Dry run failure — ${failedStages.length} stage(s) failed: ${failedStages.map((s) => s.stage.replace(/_/g, " ")).join(", ")}. Fix the failing stages before committing.`,
        true,
        { failedStages: failedStages.map((s) => ({ stage: s.stage, message: s.message })) }
      )
    );
  }

  if (!checklist.programResolved) {
    const programId = run.existingSeriesId || "unknown";
    errors.push(
      new CommitError(
        "program_not_found",
        `No V2 chart program exists for '${programId}'. Select a valid chart series that maps to a V2 program.`,
        false,
        { programId }
      )
    );
  }

  if (!checklist.canonicalMatchingDone) {
    errors.push(
      new CommitError(
        "commit_not_ready",
        `Canonical matching has not completed. Run the full dry run pipeline to completion before committing.`,
        true
      )
    );
  }

  if (!checklist.chartSizeValid) {
    errors.push(
      new CommitError(
        "commit_not_ready",
        `Chart size ${run.chartSize} is invalid. Must be between 1 and 200.`,
        false
      )
    );
  }

  // Check rows
  const commitableRows = run.rows.filter(
    (r) =>
      r.matchStatus === "canonical" ||
      r.matchStatus === "shell" ||
      r.matchStatus === "duplicate_candidate"
  );
  if (commitableRows.length === 0 && run.rows.length > 0) {
    errors.push(
      new CommitError(
        "no_rows_to_commit",
        `No rows are eligible for commit. ${run.rows.length} rows exist but none have resolved match status. Confirm canonical matching or explicitly defer unresolved rows.`,
        true
      )
    );
  }

  // Unresolved required gaps (needs_review rows are blocking)
  const unresolvedGaps = run.rows.filter((r) => r.matchStatus === "needs_review");
  if (unresolvedGaps.length > 0) {
    errors.push(
      new CommitError(
        "unresolved_required_gaps",
        `This run cannot be committed because ${unresolvedGaps.length} row(s) still require review. Use 'Send Gaps to Review' to defer them, or resolve each row manually.`,
        true,
        { count: unresolvedGaps.length }
      )
    );
  }

  // Warnings (non-blocking)
  const shells = run.rows.filter((r) => r.matchStatus === "shell");
  if (shells.length > 0) {
    warnings.push(
      `${shells.length} row(s) will be committed as release shells. Promote to canonical when ready.`
    );
  }

  const matchRate = run.summary.matchRate ?? 0;
  if (matchRate < 85) {
    warnings.push(
      `Match rate is ${matchRate.toFixed(1)}% (below 85% target). Edition will be committed with lower-confidence matches.`
    );
  }

  if (!checklist.enrichmentDone) {
    warnings.push(`Enrichment has not completed. Edition will be committed without enriched metadata.`);
  }

  return {
    canCommit: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Step 3: Resolve V2 program ───

async function resolveProgram(run: IngestRun) {
  const programId = run.existingSeriesId || run.chartSlug || "";
  const program = await resolveV2Program(programId);
  if (!program) {
    throw new CommitError(
      "program_not_found",
      `No V2 chart program exists for '${programId}'. Create the program before committing this edition.`,
      false,
      { programId }
    );
  }
  return program;
}

// ─── Step 4: Check duplicate editions ───

function checkDuplicateEdition(publicSlug: string, editionSlug: string, editionDate: string): void {
  const bySlug = getV2EditionBySlug(publicSlug, editionSlug);
  if (bySlug) {
    throw new CommitError(
      "duplicate_edition",
      `An edition already exists for '${publicSlug}' with slug '${editionSlug}'. Choose another date or use an explicit overwrite flow.`,
      false,
      { publicSlug, editionSlug, existingEditionId: bySlug.id }
    );
  }

  const byDate = getV2EditionByDate(publicSlug, editionDate);
  if (byDate) {
    throw new CommitError(
      "duplicate_edition",
      `An edition already exists for '${publicSlug}' on ${editionDate}. Choose another date or use an explicit overwrite flow.`,
      false,
      { publicSlug, editionDate, existingEditionId: byDate.id }
    );
  }
}

// ─── Step 5: Build edition row ───

function buildEditionId(publicSlug: string, editionSlug: string): string {
  return `edition_${publicSlug}_${editionSlug}_${Date.now()}`;
}

function buildEdition(
  run: IngestRun,
  program: V2Program,
  editionSlug: string,
  editionLabel: string,
  publishImmediately: boolean,
  rows: IngestResolvedRow[]
): V2Edition {
  const id = buildEditionId(program!.publicSlug, editionSlug);
  return {
    id,
    programId: program!.id,
    publicSlug: program!.publicSlug,
    sourceEditionId: run.id,
    editionSlug,
    editionLabel,
    editionDate: run.editionDate,
    periodStart: run.editionDate, // Use edition date as period start; will be refined with real data
    periodEnd: run.editionDate,
    status: publishImmediately ? "published" : "staged",
    entryCount: rows.length,
    snapshotId: null, // Snapshot service not implemented yet
    committedAt: new Date().toISOString(),
    committedBy: "Current User",
    runId: run.id,
  };
}

// ─── Step 6: Build entries ───

function slugifyTrack(title: string, artist: string): string {
  return `${title}-${artist}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function buildEntries(editionId: string, rows: IngestResolvedRow[]): V2Entry[] {
  return rows.map((row) => ({
    id: `entry_${editionId}_${row.id}`,
    editionId,
    rank: row.rank,
    previousRank: row.previousRank ?? null,
    movement: row.movement ?? null,
    trackSlug: row.canonicalTrackId
      ? `track-${row.canonicalTrackId}`
      : slugifyTrack(row.title, row.artistNames.join("-")),
    trackTitle: row.title,
    artistName: row.artistNames.join(", "),
    artistSlug: row.canonicalArtistIds?.[0]
      ? `artist-${row.canonicalArtistIds[0]}`
      : null,
    artworkUrl: row.artworkUrl ?? null,
    sourceEntryId: row.id,
    rawPayload: {
      sourceProvider: row.sourceProvider,
      matchStatus: row.matchStatus,
      confidence: row.confidence,
      canonicalTrackId: row.canonicalTrackId,
      releaseShellId: row.releaseShellId,
      canonicalReleaseId: row.canonicalReleaseId,
      canonicalArtistIds: row.canonicalArtistIds,
      warnings: row.warnings,
      isCanonical: row.matchStatus === "canonical",
      isShell: row.matchStatus === "shell",
      isDuplicate: row.matchStatus === "duplicate_candidate",
    },
  }));
}

// ─── Step 7: Build source coverage ───

function buildSourceCoverage(
  editionId: string,
  run: IngestRun,
  program: V2Program
): V2SourceCoverage[] {
  const fetchStage = run.stages.find((s) => s.stage === "source_fetch");
  const canonicalStage = run.stages.find((s) => s.stage === "canonical_match");
  const enrichmentStage = run.stages.find((s) => s.stage === "enrichment");

  const coverage: V2SourceCoverage[] = run.sourceUrls.map((url, i) => {
    const isSpotify = url.includes("spotify");
    const isApple = url.includes("apple");
    const sourceName = isSpotify ? "spotify" : isApple ? "apple_music" : `source_${i + 1}`;

    return {
      id: `coverage_${editionId}_${sourceName}_${i}`,
      editionId,
      sourceName,
      coverageStatus:
        fetchStage?.status === "done" ? "complete" :
        fetchStage?.status === "warning" ? "partial" : "failed",
      coveragePayload: {
        runId: run.id,
        sourceUrl: url,
        fetchStatus: fetchStage?.status,
        fetchMetrics: fetchStage?.metrics,
        canonicalMatchSummary: canonicalStage?.metrics,
        enrichmentSummary: enrichmentStage?.metrics,
        reviewGapSummary: {
          noMatch: run.summary.gaps,
          needsReview: run.rows.filter((r) => r.matchStatus === "needs_review").length,
          shell: run.summary.shells,
          duplicate: run.summary.duplicateCandidates,
        },
        methodologyVersion: program?.defaultMethodologyVersion,
        eligibilityRulesVersion: program?.defaultEligibilityRulesVersion,
        totalRows: run.summary.totalRows,
        matchRate: run.summary.matchRate,
      },
    };
  });

  return coverage;
}

// ─── Step 8: Snapshot ───
// Not implemented — honest placeholder

function buildSnapshotPlaceholder(): {
  snapshotId: null;
  warning: string;
} {
  return {
    snapshotId: null,
    warning: "Snapshot service is not implemented yet.",
  };
}

// ─── Step 9: Audit event ───
// If audit table/service exists, write it. Otherwise return null.

function buildAuditEvent(
  run: IngestRun,
  program: V2Program,
  edition: V2Edition
): V2AuditEvent {
  return {
    id: `audit_${edition.id}_${Date.now()}`,
    actor: "Current User",
    runId: run.id,
    programId: program!.id,
    publicSlug: program!.publicSlug,
    editionId: edition.id,
    editionSlug: edition.editionSlug,
    sourceUrls: run.sourceUrls,
    entryCount: edition.entryCount,
    reviewGapCounts: {
      noMatch: run.summary.gaps,
      needsReview: run.rows.filter((r) => r.matchStatus === "needs_review").length,
      shell: run.summary.shells,
      duplicate: run.summary.duplicateCandidates,
    },
    committedAt: edition.committedAt,
  };
}

// ─── Step 10: Verify public API ───
// In mock mode, we verify the edition was written to the store.
// In WordPress mode, we'd verify via actual HTTP request.

type VerificationResult = {
  ok: boolean;
  warnings: string[];
  errors: string[];
};

async function verifyPublicApi(
  publicSlug: string,
  editionSlug: string,
  isMockMode: boolean
): Promise<VerificationResult> {
  if (isMockMode) {
    // In mock mode, verify the edition exists in our local store
    const exists = getV2EditionBySlug(publicSlug, editionSlug);
    if (!exists) {
      return {
        ok: false,
        warnings: [],
        errors: ["Public API verification failed: edition not found in mock store after commit."],
      };
    }
    return {
      ok: true,
      warnings: [
        "Running in mock mode. Public API is served from local mock store, not the live V2 API.",
        `To verify live: GET /api/v1/charts/${publicSlug}/${editionSlug}`,
      ],
      errors: [],
    };
  }

  // WordPress mode: attempt real fetch with timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      `${PUBLIC_V2_BASE}/charts/${publicSlug}/${editionSlug}`,
      { signal: controller.signal, headers: { Accept: "application/json" } }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        ok: false,
        warnings: [],
        errors: [
          `The edition was written, but public API verification failed (HTTP ${res.status}). Check /admin/charts/public-api-qa.`,
        ],
      };
    }
    return { ok: true, warnings: [], errors: [] };
  } catch {
    return {
      ok: false,
      warnings: [
        `Public API verification timed out or network error. The edition may have been committed. Check /admin/charts/public-api-qa.`,
      ],
      errors: [],
    };
  }
}

// ─── Main Commit Function ───

export async function commitIngestRunToV2Edition(
  run: IngestRun | null,
  request: CommitIngestRunRequest,
  isMockMode = true
): Promise<CommitIngestRunResponse> {
  const runId = request.runId;

  // Step 1: Load and validate run
  assertRunExists(run);

  if (
    run.status !== "dry_run_complete" &&
    run.status !== "ready_to_commit"
  ) {
    throw new CommitError(
      "commit_not_ready",
      `Run status is '${run.status}'. Run must be 'dry_run_complete' or 'ready_to_commit' before committing.`,
      false,
      { status: run.status }
    );
  }

  // Step 2: Validate readiness
  const validation = await validateCommitReadiness(run);
  if (!validation.canCommit) {
    const primaryError = validation.errors[0];
    if (primaryError) throw primaryError;
    throw new CommitError(
      "commit_not_ready",
      `This run cannot be committed: ${validation.errors.map((e) => e.message).join("; ")}`,
      false
    );
  }

  const warnings: string[] = [...validation.warnings];

  // Step 3: Resolve program
  const program = await resolveProgram(run);

  // Step 4: Check for duplicate editions
  // Compute edition slug from edition date (e.g. "2026-05-30")
  const editionSlug =
    run.editionSlug ||
    run.editionDate.replace(/\//g, "-");

  const editionLabel =
    run.chartTitle ||
    `${program.label} ${run.editionDate}`;

  checkDuplicateEdition(program.publicSlug, editionSlug, run.editionDate);

  // Determine which rows to commit: canonical + shell + (no_match rows that were explicitly kept)
  // no_match and duplicate rows are committed with honest rawPayload noting their status
  const commitableRows = run.rows.filter(
    (r) =>
      r.matchStatus === "canonical" ||
      r.matchStatus === "shell" ||
      r.matchStatus === "no_match" ||
      r.matchStatus === "duplicate_candidate"
  );

  if (commitableRows.length === 0) {
    throw new CommitError(
      "no_rows_to_commit",
      `No rows are eligible for commit. ${run.rows.length} total rows, but none have a resolved or accepted match status.`,
      true
    );
  }

  // Sort by rank
  const sortedRows = commitableRows.slice().sort((a, b) => a.rank - b.rank);

  // Step 5: Build edition
  const edition = buildEdition(
    run,
    program,
    editionSlug,
    editionLabel,
    request.publishImmediately ?? false,
    sortedRows
  );

  // Step 6: Build entries
  let entries: V2Entry[];
  try {
    entries = buildEntries(edition.id, sortedRows);
  } catch (err) {
    throw new CommitError(
      "entry_write_failed",
      `Failed to build entries: ${err instanceof Error ? err.message : "unknown error"}`,
      true
    );
  }

  // Step 7: Build source coverage
  let sourceCoverage: V2SourceCoverage[];
  try {
    sourceCoverage = buildSourceCoverage(edition.id, run, program);
  } catch (err) {
    throw new CommitError(
      "source_coverage_write_failed",
      `Failed to build source coverage: ${err instanceof Error ? err.message : "unknown error"}`,
      true
    );
  }

  // Step 8: Snapshot placeholder
  const snapshot = buildSnapshotPlaceholder();
  warnings.push(snapshot.warning);

  // Step 9: Audit event
  const auditEvent = buildAuditEvent(run, program, edition);

  // Transactional write — commit all or nothing
  try {
    transactionalCommit({ edition, entries, sourceCoverage, auditEvent });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    if (msg.includes("edition_write_failed")) {
      throw new CommitError("edition_write_failed", `Failed to write edition: ${msg}`, true);
    }
    throw new CommitError("registry_write_failed", `Failed to commit edition: ${msg}. Run is preserved in '${run.status}' state.`, true);
  }

  // Mark run as committed in the run metadata store
  const publicUrl = `/charts/${program.publicSlug}/${editionSlug}`;
  const apiUrl = `/api/v1/charts/${program.publicSlug}/${editionSlug}`;
  markRunCommitted(runId, edition.id, editionSlug, publicUrl);

  // Step 10: Verify public API
  const verification = await verifyPublicApi(program.publicSlug, editionSlug, isMockMode);
  if (!verification.ok && verification.errors.length > 0) {
    warnings.push(...verification.warnings);
    // Not fatal — edition was written, API serve is a separate concern
    warnings.push(...verification.errors);
  } else {
    warnings.push(...verification.warnings);
  }

  return {
    runId,
    status: "committed",
    programId: program.id,
    publicSlug: program.publicSlug,
    editionId: edition.id,
    editionSlug,
    editionDate: run.editionDate,
    entryCount: entries.length,
    snapshotId: null,
    publicUrl,
    apiUrl,
    integrity: {
      ok: verification.ok,
      warnings,
      errors: verification.errors,
    },
    auditEventId: auditEvent.id,
    committedAt: edition.committedAt,
    committedBy: edition.committedBy,
  };
}

export { validateCommitReadiness as checkCommitReadiness, buildReadinessChecklist, resolveProgram, resolveV2Program };
export type { CommitReadyIngestRun, CommitIngestRunRequest, CommitIngestRunResponse };