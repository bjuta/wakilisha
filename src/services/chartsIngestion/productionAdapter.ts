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

interface DbCandidate {
  id: string;
  run_id: string;
  normalized_key: string | null;
  lead_artist_key: string | null;
  title: string | null;
  artist_display: string | null;
  status: string | null;
  source_count: number | null;
  occurrence_count: number | null;
  artwork_url: string | null;
  external_url: string | null;
  preview_url: string | null;
  source_urls_seen: string[] | null;
  created_at: string | null;
}

interface DbExclusion {
  id: string;
  run_id: string;
  candidate_id: string | null;
  reason_code?: string | null;
  reason?: string | null;
  reason_label?: string | null;
  details_json?: Record<string, unknown> | null;
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
  chart_ingest_candidates?: DbCandidate[];
  chart_ingest_exclusions?: DbExclusion[];
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
function detectedProviderFromSources(sources: DbRunSource[]): "spotify" | "apple_music" {
  const provider = sources.find((source) => source.provider === "spotify" || source.provider === "apple_music")?.provider;
  return provider === "apple_music" ? "apple_music" : "spotify";
}

function mapDbRunToUi(dbRun: DbRun): IngestRun {
  const snapshot = dbRun.rule_snapshot_json ?? {};
  const sources = (dbRun.chart_ingest_run_sources ?? []).filter((s) => s.enabled);
  const dbStages = dbRun.chart_ingest_stage_events ?? [];
  const counts = dbRun.candidateCounts;
  const exclusions = dbRun.chart_ingest_exclusions ?? [];
  const exclusionByCandidateId = new Map(
    exclusions
      .filter((exclusion) => Boolean(exclusion.candidate_id))
      .map((exclusion) => [exclusion.candidate_id as string, exclusion])
  );

  const candidateRows = (dbRun.chart_ingest_candidates ?? []).map((candidate, index) => {
    const exclusion = exclusionByCandidateId.get(candidate.id);
    const status = (candidate.status ?? "").toLowerCase();
    const reason = exclusion?.reason_code ?? exclusion?.reason ?? "";
    const isDuplicate = reason === "duplicate_track";
    const isExcluded = status === "excluded";

    return {
      id: candidate.id,
      rank: index + 1,
      sourceProvider: detectedProviderFromSources(dbRun.chart_ingest_run_sources ?? []),
      sourceUrl: candidate.source_urls_seen?.[0] ?? dbRun.chart_ingest_run_sources?.[0]?.source_url ?? "",
      title: candidate.title ?? "Untitled",
      artistNames: (candidate.artist_display ?? "Unknown Artist")
        .split(/\s*,\s*|\s+&\s+|\s+x\s+/i)
        .map((artist) => artist.trim())
        .filter(Boolean),
      artworkUrl: candidate.artwork_url ?? null,
      previewUrl: candidate.preview_url ?? null,
      externalUrl: candidate.external_url ?? null,
      matchStatus: isDuplicate
        ? "duplicate_candidate"
        : status === "needs_review"
        ? "needs_review"
        : isExcluded
        ? "no_match"
        : "canonical",
      confidence: isExcluded ? 0 : Math.min(100, Math.max(0, Number(candidate.source_count ?? 1) * 50)),
      warnings: [
        reason || null,
        exclusion?.reason_label ?? null,
      ].filter(Boolean) as string[],
      excludedRowId: exclusion?.id ?? null,
      raw: {
        status,
        reasonCode: reason,
        reasonLabel: exclusion?.reason_label ?? null,
        occurrenceCount: candidate.occurrence_count,
        sourceCount: candidate.source_count,
        details: exclusion?.details_json ?? null,
      },
      normalized_key: candidate.normalized_key ?? "",
      lead_artist_key: candidate.lead_artist_key ?? "",
    };
  });

  // Build ordered stages
  const stageMap = new Map<string, DbStageEvent>(
    dbStages.map((s) => [s.stage, s])
  );
  const stages: IngestStageStatus[] = STAGE_ORDER.map((name) => {
    const db = stageMap.get(name);
    if (!db) return { stage: name as IngestStageStatus["stage"], status: "idle" };
    // Map DB status 'completed' to UI status 'done' so PipelinePanel recognizes finished stages
    const uiStatus: IngestStageStatus["status"] =
      db.status === "completed" || db.status === "done" ? "done"
      : db.status === "running" ? "running"
      : db.status === "failed" ? "failed"
      : db.status === "warning" ? "warning"
      : "idle";
    return {
      stage: name as IngestStageStatus["stage"],
      status: uiStatus,
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
    rows: candidateRows,
    excludedRows: candidateRows.filter((row) => row.matchStatus === "no_match" || row.matchStatus === "duplicate_candidate"),
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

    if (!run) return null;

    const [{ candidates }, { exclusions }] = await Promise.all([
      invokeApi<{ candidates: DbCandidate[] }>("get_candidates", { runId, limit: 500 }),
      invokeApi<{ exclusions: DbExclusion[] }>("get_exclusions", { runId, limit: 500 }).catch(() => ({ exclusions: [] })),
    ]);

    return mapDbRunToUi({
      ...run,
      chart_ingest_candidates: candidates ?? [],
      chart_ingest_exclusions: exclusions ?? [],
    });
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
  const raw = await invokeApi<{
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    committedRuns: number;
    activeRuns: number;
    avgDurationMs: number;
    pipelineHealth: string;
  }>("get_kpis");

  // Map edge function response to the UI's IngestStudioKpi shape
  return {
    editionsThisWeek: raw.completedRuns ?? 0,
    canonicalMatchRate: raw.totalRuns > 0 ? ((raw.committedRuns ?? 0) / raw.totalRuns) * 100 : 0,
    rowsAwaitingReview: raw.activeRuns ?? 0,
    averageRunTimeMs: raw.avgDurationMs ?? 0,
  };
}

/** Recent pipeline activity from audit events. */
export async function getRecentIngestActivity(): Promise<
  RecentIngestActivity[]
> {
  const raw = await invokeApi<{
    activity: Array<{
      id: string;
      runId: string;
      actor: string;
      action: string;
      timestamp: string;
      message: string;
    }>;
  }>("get_activity");

  // Map edge function response to the UI's RecentIngestActivity shape
  return (raw.activity ?? []).map((item) => ({
    id: item.id,
    type: mapActionToActivityType(item.action),
    chartTitle: item.message || item.action,
    runId: item.runId,
    status: mapActionToStatus(item.action),
    actor: item.actor,
    createdAt: item.timestamp,
  }));
}

function mapActionToActivityType(actionValue: unknown): RecentIngestActivity["type"] {
  const action = typeof actionValue === "string" ? actionValue : "";
  if (action.includes("commit") || action === "run_committed" || action === "published") return "commit";
  if (action.includes("cancel")) return "cancel";
  if (action.includes("retry")) return "retry";
  if (action.includes("review") || action.includes("gap")) return "review";
  return "dry_run";
}

function mapActionToStatus(actionValue: unknown): IngestRunStatus {
  const action = typeof actionValue === "string" ? actionValue : "";
  if (action.includes("commit") || action === "run_committed") return "committed";
  if (action === "published") return "published";
  if (action.includes("cancel")) return "cancelled";
  if (action.includes("failed") || action.includes("error")) return "failed";
  if (action.includes("review")) return "needs_review";
  if (action.includes("dry_run_complete")) return "dry_run_complete";
  if (action.includes("running")) return "running";
  return "queued";
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

/** Trigger run_carry_forward: reads previous edition entries, identifies tracks
 *  with NO fresh evidence this week, and creates synthetic carry_forward_only
 *  candidates in chart_ingest_candidates. Must run BEFORE scoring so
 *  carry-forward-only tracks participate in scoring with the §4.6 bonus. */
export async function runCarryForward(runId: string): Promise<{
  ok: boolean;
  runId: string;
  stage: string;
  carryForwardCount: number;
  freshEvidenceCount: number;
  previousEntryCount: number;
  skippedExistingCount: number;
  previousEditionFound: boolean;
  durationMs: number;
}> {
  return invokeApi("run_carry_forward", { runId });
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

/** Run the full pipeline: source_fetch → normalize → carry_forward → eligibility → scoring → shortlist.
 *  Marks the run as dry_run_complete when all stages succeed. */
export async function runFullPipeline(runId: string): Promise<{
  ok: boolean;
  runId: string;
  status: string;
  pipelineStages: Array<{ stage: string; result: string }>;
  totalDurationMs: number;
}> {
  return invokeApi("run_full_pipeline", { runId });
}

// ════════════════════════════════════════════════════════════════════════
// v18: Registry-first actions — fix artist slugs & reingest editions
// ════════════════════════════════════════════════════════════════════════

export interface FixArtistSlugsResult {
  ok: boolean;
  dry_run?: boolean;
  total_entries: number;
  to_fix?: number;
  fixed?: number;
  skipped: number;
  fix_preview?: Array<{ id: string; track_title: string; artist_name: string; current_slug: string; correct_slug: string; method: string }>;
  skipped_samples?: string[];
}

/** Fix corrupt artist_slug values in chart entries — resolves through registry_track_artists. */
export async function fixChartArtistSlugs(params: {
  editionId?: string;
  dryRun?: boolean;
}): Promise<FixArtistSlugsResult> {
  return invokeApi<FixArtistSlugsResult>("fix_chart_artist_slugs", {
    editionId: params.editionId ?? null,
    dryRun: params.dryRun ?? true,
  });
}

export interface ReingestEditionResult {
  ok: boolean;
  dry_run: boolean;
  edition_slug: string;
  stats: {
    total: number;
    tracks_found: number;
    tracks_created: number;
    artists_found: number;
    artists_created: number;
    links_created: number;
    artist_slugs_fixed: number;
    canonical_ids_set: number;
    errors: number;
  };
  repairs?: Array<{ id: string; track_title: string; artist_name: string; action: string }>;
}

/** Re-process an existing chart edition through registry resolution.
 *  For each entry: looks up or creates registry tracks + artists, links them,
 *  and populates canonical_track_id, track_slug, and artist_slug. */
export async function reingestEdition(params: {
  editionId: string;
  dryRun?: boolean;
}): Promise<ReingestEditionResult> {
  return invokeApi<ReingestEditionResult>("reingest_edition", {
    editionId: params.editionId,
    dryRun: params.dryRun ?? true,
  });
}
export interface OriginReviewQueueRow {
  reviewKey: string;
  issueType: "unresolved_artist" | "missing_origin" | "country_mismatch" | string;
  sourceSlug: string;
  sourceName: string;
  canonicalArtistId: string | null;
  canonicalSlug: string | null;
  canonicalName: string | null;
  currentOriginIso2: string | null;
  targetIso2: string;
  impactedCandidateCount: number;
  topScore: number;
  examples: Array<{
    candidateId: string;
    title: string;
    artistDisplay: string;
    finalScore: number;
    candidateStatus?: string;
    reasonCode?: string | null;
    reasonLabel?: string | null;
    resolvedVia?: string;
  }>;
}

interface DbOriginReviewQueueRow {
  review_key: string;
  issue_type: string;
  source_slug: string;
  source_name: string;
  canonical_artist_id: string | null;
  canonical_slug: string | null;
  canonical_name: string | null;
  current_origin_iso2: string | null;
  target_iso2: string;
  impacted_candidate_count: number;
  top_score: number;
  examples: OriginReviewQueueRow["examples"];
}

function mapOriginReviewRow(row: DbOriginReviewQueueRow): OriginReviewQueueRow {
  return {
    reviewKey: row.review_key,
    issueType: row.issue_type,
    sourceSlug: row.source_slug,
    sourceName: row.source_name,
    canonicalArtistId: row.canonical_artist_id,
    canonicalSlug: row.canonical_slug,
    canonicalName: row.canonical_name,
    currentOriginIso2: row.current_origin_iso2,
    targetIso2: row.target_iso2,
    impactedCandidateCount: Number(row.impacted_candidate_count ?? 0),
    topScore: Number(row.top_score ?? 0),
    examples: Array.isArray(row.examples) ? row.examples : [],
  };
}

export async function getOriginReviewQueue(runId: string): Promise<OriginReviewQueueRow[]> {
  const { rows } = await invokeApi<{ rows: DbOriginReviewQueueRow[] }>("get_origin_review_queue", { runId });
  return (rows ?? []).map(mapOriginReviewRow);
}

export async function setArtistOriginForRun(input: {
  runId: string;
  artistId: string;
  originIso2: string;
  candidateId?: string;
  note?: string;
}): Promise<void> {
  await invokeApi("set_artist_origin_for_run", input);
}

export async function createOriginArtistShell(input: {
  runId: string;
  artistName: string;
  originIso2: string;
  candidateId?: string;
}): Promise<void> {
  await invokeApi("create_origin_artist_shell", input);
}

export interface OriginCountryOption {
  originIso2: string;
  label: string;
  artistCount: number;
}

interface DbOriginCountryOption {
  originIso2: string;
  label: string;
  artistCount: number;
}

export async function getOriginCountryOptions(includeIso2?: string): Promise<OriginCountryOption[]> {
  const { options } = await invokeApi<{ options: DbOriginCountryOption[] }>("get_origin_country_options", {
    includeIso2,
  });

  return (options ?? []).map((option) => ({
    originIso2: option.originIso2,
    label: option.label,
    artistCount: Number(option.artistCount ?? 0),
  }));
}

export async function resetAfterOriginResolution(runId: string): Promise<void> {
  await invokeApi("reset_after_origin_resolution", { runId });
}
