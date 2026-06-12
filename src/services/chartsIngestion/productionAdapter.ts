/**
 * Chart Ingest Production Adapter
 * Replaces ingestStudioMock for all production paths.
 * Calls the `chart-ingest-api` Supabase Edge Function and maps DB records
 * to the existing IngestRun shape expected by the UI.
 *
 * NO localStorage is used. All state lives in Supabase.
 */

import { supabase } from "@/lib/supabase";
import type {
  IngestRun,
  IngestRunStatus,
  IngestStageStatus,
  IngestStudioKpi,
  RecentIngestActivity,
  ResourceGuardStatus,
  CreateIngestDryRunRequest,
  CreateIngestDryRunResponse,
  CommitIngestRunRequest,
  CommitIngestRunResponse,
  ProviderName,
} from "./ingestStudioTypes";
import type { CommitValidationResult } from "./commitTypes";
import { CommitError } from "./commitTypes";

// ── Ordered list of all 21 pipeline stages ───────────────────────────────────
const STAGE_ORDER = [
  "validate","provider_detection","resource_guard","source_fetch","raw_persist",
  "normalize","dedupe","release_candidate_build","canonical_match","entity_resolution",
  "eligibility_execution","airplay_evidence","airplay_rescue","carry_forward",
  "methodology_scoring","anti_gaming","shortlist","review_gate",
  "commit_validate","commit_write","public_verify",
] as const;

// ── Internal DB row shapes ────────────────────────────────────────────────────
interface DbStageEvent {
  id: string;
  run_id: string;
  stage: string;
  status: string;
  message: string | null;
  duration_ms: number | null;
  started_at: string | null;
  finished_at: string | null;
  metrics_json: Record<string, unknown> | null;
}

interface DbRunSource {
  id: string;
  run_id: string;
  provider: string;
  source_url: string;
  enabled: boolean;
  fetch_status: string;
}

interface DbRun {
  id: string;
  program_id: string;
  series_slug: string | null;
  market_slug: string;
  chart_kind: string;
  edition_date: string;
  chart_size: number;
  status: string;
  rule_snapshot_json: Record<string, unknown> | null;
  eligibility_profile_id: string | null;
  market_scope_id: string | null;
  scoring_policy_version: string | null;
  methodology_version: string | null;
  created_by: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
  dry_run_completed_at: string | null;
  committed_at: string | null;
  commit_edition_id: string | null;
  error_message: string | null;
  notes: string | null;
  chart_ingest_run_sources?: DbRunSource[];
  chart_ingest_stage_events?: DbStageEvent[];
  candidateCounts?: {
    total: number;
    eligible: number;
    excluded: number;
    needsReview: number;
  };
}

// ── Core invocation helper ────────────────────────────────────────────────────
async function invokeApi<T>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("chart-ingest-api", {
    body: { action, ...params },
  });

  // Check the response body first — it contains the actual error from the edge function
  if (data?.error) {
    const detail = data.detail ? `: ${data.detail}` : "";
    const status = data.status ? ` (HTTP ${data.status})` : "";
    throw new Error(`${data.error}${detail}${status}`);
  }

  // Fallback: Supabase client-level error (network, CORS, etc.)
  if (error) {
    const ctx = (error as { context?: { status?: number } }).context;
    const statusSuffix = ctx?.status ? ` (HTTP ${ctx.status})` : "";
    throw new Error(`${error.message}${statusSuffix}`);
  }

  return data as T;
}

// ── DB → UI mapper ────────────────────────────────────────────────────────────
function mapDbRunToUi(dbRun: DbRun): IngestRun {
  const snapshot = dbRun.rule_snapshot_json ?? {};
  const sources = (dbRun.chart_ingest_run_sources ?? []).filter((s) => s.enabled);
  const dbStages = dbRun.chart_ingest_stage_events ?? [];
  const counts = dbRun.candidateCounts;

  // Build ordered stages
  const stageMap = new Map<string, DbStageEvent>(
    dbStages.map((s) => [s.stage, s])
  );
  const stages: IngestStageStatus[] = STAGE_ORDER.map((name) => {
    const db = stageMap.get(name);
    if (!db) return { stage: name as IngestStageStatus["stage"], status: "idle" };
    return {
      stage: name as IngestStageStatus["stage"],
      status: db.status as IngestStageStatus["status"],
      message: db.message ?? undefined,
      durationMs: db.duration_ms ?? undefined,
      startedAt: db.started_at ?? undefined,
      finishedAt: db.finished_at ?? undefined,
      metrics: db.metrics_json ?? undefined,
    };
  });

  // Derive provider list from sources
  const providerSet = new Set(
    sources
      .map((s) => s.provider)
      .filter((p) => p === "spotify" || p === "apple_music")
  );
  const detectedProviders = Array.from(providerSet) as ProviderName[];

  const sourceUrls = sources.map((s) => s.source_url);

  // Summary from DB counts (will be populated once pipeline runs)
  const total = counts?.total ?? 0;
  const eligible = counts?.eligible ?? 0;
  const excluded = counts?.excluded ?? 0;
  const review = counts?.needsReview ?? 0;
  const matchRate = total > 0 ? (eligible / total) * 100 : 0;

  return {
    id: dbRun.id,
    chartTitle:
      (snapshot.chartTitle as string) || `Run ${dbRun.id.slice(0, 8)}`,
    chartSlug:
      (snapshot.chartSlug as string) || dbRun.series_slug || "",
    editionDate: dbRun.edition_date,
    chartSize: dbRun.chart_size,
    market: dbRun.market_slug ?? "KE",
    chartKind: (dbRun.chart_kind as IngestRun["chartKind"]) ?? "tracks",
    coverStyle: (snapshot.coverStyle as string) ?? "default",
    sourceUrls,
    detectedProviders,
    saveAsRecurringSeries: !!(snapshot.saveAsRecurringSeries as boolean),
    existingSeriesId: dbRun.series_slug ?? null,
    eligibilityProfileId: dbRun.eligibility_profile_id ?? null,
    methodologyVersion:
      (snapshot.methodologyVersion as string) ??
      dbRun.methodology_version ??
      "1.0.0",
    marketScopeId: dbRun.market_scope_id ?? null,
    marketScopeSnapshot: null,
    enrichmentOptions: null,
    status: dbRun.status as IngestRunStatus,
    stages,
    summary: {
      totalRows: total,
      canonicalMatches: eligible,
      shells: 0,
      gaps: review,
      duplicateCandidates: 0,
      matchRate,
      eligibleRows: eligible,
      excludedRows: excluded,
      reviewRows: review,
      eligibilityRate: total > 0 ? (eligible / total) * 100 : 0,
      scoringMethodologyVersion:
        dbRun.methodology_version ?? "1.0.0",
    },
    rows: [],          // Populated from chart_ingest_candidates via separate call
    excludedRows: [],
    commercialReadiness: null,
    rowIntelligence: {},
    createdBy: dbRun.created_by_email ?? dbRun.created_by ?? "Unknown",
    createdAt: dbRun.created_at,
    updatedAt: dbRun.updated_at,
    dryRunCompletedAt: dbRun.dry_run_completed_at ?? null,
    committedAt: dbRun.committed_at ?? null,
    editionId: dbRun.commit_edition_id ?? null,
    editionSlug: dbRun.committed_at
      ? dbRun.edition_date
      : null,
    snapshotId: null,
    notes: (dbRun.notes as string) ?? "",
    errorMessage: dbRun.error_message ?? null,
  };
}

// ── Exported API surface (matches ingestStudioMock exports) ──────────────────

/** Fetch all runs from DB, ordered by created_at DESC. */
export async function getIngestRuns(): Promise<IngestRun[]> {
  const { runs } = await invokeApi<{ runs: DbRun[] }>("list_runs", {
    limit: 100,
  });
  return (runs ?? []).map(mapDbRunToUi);
}

/** Fetch a single run by ID. Returns null if not found. */
export async function getIngestRun(runId: string): Promise<IngestRun | null> {
  try {
    const { run } = await invokeApi<{ run: DbRun }>("get_run", { runId });
    return run ? mapDbRunToUi(run) : null;
  } catch (err) {
    if (err instanceof Error && err.message.includes("run_not_found")) {
      return null;
    }
    throw err;
  }
}

/**
 * Create a new dry-run record in the DB and return the initial run state.
 * The run starts as 'queued' — the pipeline runs asynchronously on the backend.
 * Rows will be populated once the pipeline completes.
 */
export async function runDryRun(
  request: CreateIngestDryRunRequest
): Promise<CreateIngestDryRunResponse> {
  const result = await invokeApi<{
    runId: string;
    status: string;
    pollUrl: string;
  }>("create_dry_run", { request });

  // Fetch the freshly created run from DB to get full shape
  const run = await getIngestRun(result.runId);

  return {
    runId: result.runId,
    status: (result.status as IngestRunStatus) ?? "queued",
    stages: run?.stages ?? [],
    summary: run?.summary ?? {
      totalRows: 0,
      canonicalMatches: 0,
      shells: 0,
      gaps: 0,
      duplicateCandidates: 0,
      matchRate: 0,
    },
    rows: [],
    excludedRows: [],
    commercialReadiness: null,
    rowIntelligence: {},
  };
}

/** Commit a run to a V2 chart edition. */
export async function commitIngestRun(
  request: CommitIngestRunRequest
): Promise<CommitIngestRunResponse> {
  return invokeApi<CommitIngestRunResponse>("commit_run", {
    runId: request.runId,
    publishImmediately: request.publishImmediately ?? true,
    notes: request.notes ?? null,
  });
}

/** Validate whether a run is ready to commit.
 *  Returns a PENDING result immediately — callers must use validateRunReadinessAsync
 *  for production commit validation. This synchronous façade satisfies the commitService
 *  type contract but should not be used to gate actual commits. */
export function validateRunReadiness(runId: string): CommitValidationResult {
  // The synchronous contract cannot perform async DB validation.
  // For commit gating, always use validateRunReadinessAsync instead.
  // This method only exists because commitService.ts requires a sync result;
  // the production UI commit flow always calls validateRunReadinessAsync first.
  return {
    canCommit: false,
    errors: [
      new CommitError(
        "async_validation_required",
        "Production commit validation requires the async validate_commit endpoint. Call validateRunReadinessAsync() before committing.",
        true, // retryable
        { runId, hint: "Call validateRunReadinessAsync(runId) for real validation" }
      ),
    ],
    warnings: ["Synchronous validateRunReadiness is a no-op in production — use validateRunReadinessAsync()"],
  };
}

/** Async commit readiness validation (preferred in production). */
export async function validateRunReadinessAsync(runId: string): Promise<{
  canCommit: boolean;
  errors: Array<{ code: string; message: string }>;
  warnings: string[];
}> {
  return invokeApi("validate_commit", { runId });
}

/** Cancel a run (only works for draft/queued/running/needs_review states). */
export async function cancelIngestRun(
  runId: string
): Promise<IngestRun | null> {
  await invokeApi("cancel_run", { runId });
  return getIngestRun(runId);
}

/** Retry a failed or cancelled run (resets to queued + idle stages). */
export async function retryIngestRun(
  runId: string
): Promise<IngestRun | null> {
  await invokeApi("retry_run", { runId });
  return getIngestRun(runId);
}

/** Send gap rows to review (sets run status to needs_review). */
export async function sendGapsToReview(
  runId: string
): Promise<IngestRun | null> {
  await invokeApi("send_gaps_to_review", { runId });
  return getIngestRun(runId);
}

/** Apply a manual match decision to a candidate row.
 *  Persists to chart_ingest_review_issues AND chart_ingest_matches so
 *  decisions survive page refresh. */
export async function applyRowMatchDecision(
  runId: string,
  rowId: string,
  action: string,
  canonicalEntityId?: string,
  note?: string
): Promise<IngestRun | null> {
  await invokeApi("apply_row_decision", {
    runId,
    candidateId: rowId,
    action,
    canonicalEntityId: canonicalEntityId ?? null,
    note: note ?? null,
  });
  return getIngestRun(runId);
}

/** Aggregate KPI metrics from the DB. */
export async function getIngestKpis(): Promise<IngestStudioKpi> {
  return invokeApi<IngestStudioKpi>("get_kpis");
}

/** Recent pipeline activity from audit events. */
export async function getRecentIngestActivity(): Promise<
  RecentIngestActivity[]
> {
  const { activity } = await invokeApi<{
    activity: RecentIngestActivity[];
  }>("get_activity");
  return activity ?? [];
}

/** Resource guard status for a specific run. */
export async function getResourceGuardStatus(
  runId: string
): Promise<ResourceGuardStatus> {
  return invokeApi<ResourceGuardStatus>("get_resource_guard", { runId });
}

/** Run the normalization stage for a run — populates chart_ingest_normalized_rows. */
export async function normalizeRun(runId: string): Promise<{
  ok: boolean;
  runId: string;
  stage: string;
  rawCount: number;
  uniqueCount: number;
  dedupedCount: number;
  warningCount: number;
  durationMs: number;
}> {
  return invokeApi("normalize_run", { runId });
}

/** Fetch normalized rows for a run (after normalization stage completes). */
export async function getNormalizedRows(runId: string): Promise<unknown[]> {
  const { normalized_rows } = await invokeApi<{ normalized_rows: unknown[] }>(
    "get_normalized",
    { runId }
  );
  return normalized_rows ?? [];
}

/** Fetch review issues for a run. */
export async function getReviewIssues(
  runId: string
): Promise<Array<{
  id: string;
  run_id: string;
  candidate_id: string | null;
  issue_type: string;
  severity: string;
  blocking: boolean;
  message: string;
  status: string;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}>> {
  const { review_issues } = await invokeApi<{ review_issues: unknown[] }>(
    "get_review_issues",
    { runId }
  );
  return (review_issues ?? []) as Array<{
    id: string;
    run_id: string;
    candidate_id: string | null;
    issue_type: string;
    severity: string;
    blocking: boolean;
    message: string;
    status: string;
    resolution_note: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

/** Fetch all matches for a run. */
export async function getMatchesForRun(
  runId: string
): Promise<Array<{
  id: string;
  run_id: string;
  candidate_id: string;
  entity_type: string;
  canonical_entity_id: string | null;
  match_method: string | null;
  confidence: number | null;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}>> {
  const { matches } = await invokeApi<{ matches: unknown[] }>(
    "get_matches_for_run",
    { runId }
  );
  return (matches ?? []) as Array<{
    id: string;
    run_id: string;
    candidate_id: string;
    entity_type: string;
    canonical_entity_id: string | null;
    match_method: string | null;
    confidence: number | null;
    status: string;
    decided_by: string | null;
    decided_at: string | null;
    decision_note: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

/** Run preflight validation before creating a dry run. */
export async function runPreflightCheck(params: {
  programId: string;
  editionDate: string;
  sources: Array<{ provider: string; sourceUrl?: string }>;
}): Promise<{
  ok: boolean;
  blockers: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  estimates: Record<string, unknown>;
}> {
  return invokeApi("preflight", params);
}

// ════════════════════════════════════════════════════════════════════════
// PR 6: Pipeline Stage Triggers — source_fetch → eligibility → scoring → shortlist
// Each triggers a single stage in the edge function pipeline.
// ════════════════════════════════════════════════════════════════════════

/** Trigger source_fetch: generates simulated chart data into chart_ingest_raw_rows. */
export async function sourceFetch(runId: string): Promise<{
  ok: boolean;
  runId: string;
  stage: string;
  sourceCount: number;
  rawRowCount: number;
  sourceResults: Array<{ sourceId: string; fetchedCount: number; droppedCount: number }>;
  durationMs: number;
}> {
  return invokeApi("source_fetch", { runId });
}

/** Trigger run_eligibility: creates candidates from normalized rows in chart_ingest_candidates. */
export async function runEligibility(runId: string): Promise<{
  ok: boolean;
  runId: string;
  stage: string;
  candidateCount: number;
  excludedCount: number;
  inputRowCount: number;
  durationMs: number;
}> {
  return invokeApi("run_eligibility", { runId });
}

/** Trigger run_scoring: scores all candidates and writes to chart_ingest_candidate_scores. */
export async function runScoring(runId: string): Promise<{
  ok: boolean;
  runId: string;
  stage: string;
  scoredCount: number;
  overflowCount: number;
  durationMs: number;
}> {
  return invokeApi("run_scoring", { runId });
}

/** Trigger run_shortlist: sorts scored candidates, assigns ranks, updates statuses to eligible/excluded. */
export async function runShortlist(runId: string): Promise<{
  ok: boolean;
  runId: string;
  stage: string;
  shortlistedCount: number;
  totalScored: number;
  excludedCount: number;
  chartSize: number;
  durationMs: number;
}> {
  return invokeApi("run_shortlist", { runId });
}

/** Trigger run_airplay_detection: fetches ACRCloud detections for enabled airplay stations,
 *  inserts into airplay_detections, and aggregates into airplay_evidence_weekly. */
export async function runAirplayEvidence(runId: string): Promise<{
  ok: boolean;
  runId: string;
  stage: string;
  sourceCount: number;
  detectionCount: number;
  evidenceBucketCount: number;
  sourceResults: Array<{ sourceId: string; stationName: string; detectionCount: number; error: string | null }>;
  durationMs: number;
}> {
  return invokeApi("run_airplay_detection", { runId });
}

/** Reset pipeline: clears all stage results back to idle, wipes all output tables, resets run to draft. */
export async function resetPipeline(runId: string): Promise<{
  ok: boolean;
  runId: string;
  status: string;
  previousStatus: string;
  cleared: {
    stages: boolean;
    rawRows: boolean;
    normalizedRows: boolean;
    candidates: boolean;
    exclusions: boolean;
    candidateScores: boolean;
    matches: boolean;
    reviewIssues: boolean;
    sources: boolean;
  };
}> {
  return invokeApi("reset_pipeline", { runId });
}