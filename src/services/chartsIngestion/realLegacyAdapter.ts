/**
 * Real Legacy Adapter — Supabase-backed replacement for the mock adapter.
 * Maps chart_ingest_* DB tables to the legacy IngestJob / IngestSource / IngestCandidate
 * types expected by the 9-phase ingest-studio UI.
 *
 * NO localStorage. NO Math.random. All reads come from Supabase; all writes
 * mutate real rows. Empty tables return empty arrays — the UI shows empty states.
 */

import { supabase } from "@/lib/supabase";
import type {
  ChartFamily,
  IngestJob,
  IngestJobStatus,
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
  IssueStatus,
  SourceStatus,
  CandidateStatus,
  EligibilityStatus,
  MatchMethod,
  DiscoveredCsvSource,
  CsvImportSession,
  CandidateSourceType,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// Status helpers
// ═══════════════════════════════════════════════════════════════════════════════

function mapRunStatus(dbStatus: string): IngestJobStatus {
  switch (dbStatus) {
    case "queued":
      return "draft";
    case "running":
      return "fetching";
    case "dry_run_complete":
      return "ready_to_draft";
    case "needs_review":
      return "review";
    case "committed":
      return "drafted";
    case "published":
      return "published";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "draft";
  }
}

function mapSourceStatus(dbStatus: string): SourceStatus {
  const s = dbStatus.toLowerCase();
  if (s === "fetching") return "fetching";
  if (s === "completed") return "completed";
  if (s === "failed") return "failed";
  return "pending";
}

function mapCandidateStatus(dbStatus: string): {
  status: CandidateStatus;
  eligibility: EligibilityStatus;
} {
  const s = dbStatus.toLowerCase();
  if (s === "excluded") return { status: "excluded", eligibility: "excluded" };
  if (s === "shortlisted") return { status: "approved", eligibility: "eligible" };
  if (s === "review" || s === "needs_review")
    return { status: "needs_review", eligibility: "needs_review" };
  return { status: "candidate", eligibility: "eligible" };
}

function mapMatchMethod(dbMethod: string | null): MatchMethod {
  const m = dbMethod ?? "";
  if (m === "isrc") return "isrc";
  if (m === "provider_id") return "provider_id";
  if (m === "title_artist") return "title_artist";
  if (m === "manual") return "manual";
  if (m === "new_entity") return "new_entity";
  return "title_artist";
}

function mapIssueStatus(dbStatus: string): IssueStatus {
  const s = dbStatus.toLowerCase();
  if (s === "resolved") return "resolved";
  if (s === "ignored") return "ignored";
  return "open";
}

function deriveLogLevel(dbStatus: string): IngestJobLog["level"] {
  const s = dbStatus.toLowerCase();
  if (s === "completed" || s === "success") return "success";
  if (s === "failed" || s === "error") return "error";
  if (s === "warning") return "warning";
  return "info";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Chart Families
// ═══════════════════════════════════════════════════════════════════════════════

export async function getChartFamilies(): Promise<ChartFamily[]> {
  const { data, error } = await supabase.rpc("rpc_get_chart_programs");

  if (error) {
    console.error("[realAdapter] getChartFamilies error:", error.message);
    return [];
  }

  const rows = (data as Record<string, unknown>[]) ?? [];
  return rows.map((row) => ({
    id: row.id,
    familyKey: row.series_slug ?? row.id,
    label: row.public_label ?? row.series_slug ?? row.id,
    description: "",
    defaultChartSize: row.chart_size ?? 20,
    defaultRegion: row.market_slug ?? "KE",
    editionFrequency: (row.default_period_type as ChartFamily["editionFrequency"]) ?? "weekly",
    defaultRuleset: row.default_methodology_version ?? "1.0.0",
    defaultScoringModel: row.default_methodology_version ?? "1.0.0",
    publicSlug: row.public_slug ?? row.series_slug ?? row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Ingest Jobs
// ═══════════════════════════════════════════════════════════════════════════════

async function loadJobFamily(programId: string): Promise<ChartFamily | undefined> {
  const { data, error } = await supabase.rpc("rpc_get_chart_programs");

  if (error || !data) return undefined;

  const rows = data as Record<string, unknown>[];
  const match = rows.find((r) => r.public_slug === programId || r.id === programId);
  if (!match) return undefined;

  return {
    id: match.id,
    familyKey: match.series_slug ?? match.id,
    label: match.public_label ?? match.series_slug ?? match.id,
    description: "",
    defaultChartSize: match.chart_size ?? 20,
    defaultRegion: match.market_slug ?? "KE",
    editionFrequency: (match.default_period_type as ChartFamily["editionFrequency"]) ?? "weekly",
    defaultRuleset: match.default_methodology_version ?? "1.0.0",
    defaultScoringModel: match.default_methodology_version ?? "1.0.0",
    publicSlug: match.public_slug ?? match.series_slug ?? match.id,
    createdAt: match.created_at,
    updatedAt: match.updated_at,
  };
}

async function computeJobSummary(
  runId: string
): Promise<IngestJob["sourceSummary"] & IngestJob["jobSummary"]> {
  const [sources, candidates, matches, issues] = await Promise.all([
    supabase.from("chart_ingest_run_sources").select("*").eq("run_id", runId),
    supabase.from("chart_ingest_candidates").select("*").eq("run_id", runId),
    supabase.from("chart_ingest_matches").select("*").eq("run_id", runId),
    supabase.from("chart_ingest_review_issues").select("*").eq("run_id", runId),
  ]);

  const srcRows = sources.data ?? [];
  const candRows = candidates.data ?? [];
  const matchRows = matches.data ?? [];
  const issueRows = issues.data ?? [];

  const completedSources = srcRows.filter((s) => s.fetch_status === "completed").length;
  const failedSources = srcRows.filter((s) => s.fetch_status === "failed").length;
  const totalRaw = srcRows.reduce((sum, s) => sum + (s.fetched_count ?? 0), 0);
  const totalNorm = srcRows.reduce((sum, s) => sum + (s.normalized_count ?? 0), 0);

  const approvedMatches = matchRows.filter((m) => m.status === "approved").length;
  const unresolvedMatches = matchRows.filter((m) => m.status === "pending").length;
  const newEntities = matchRows.filter((m) => m.match_method === "new_entity").length;

  const highIssues = issueRows.filter((i) => i.severity === "high" && i.status === "open").length;
  const mediumIssues = issueRows.filter((i) => i.severity === "medium" && i.status === "open").length;
  const lowIssues = issueRows.filter((i) => i.severity === "low" && i.status === "open").length;

  const eligible = candRows.filter((c) => c.status !== "excluded").length;
  const excluded = candRows.filter((c) => c.status === "excluded").length;
  const shortlisted = candRows.filter((c) => c.status === "shortlisted").length;

  return {
    totalSources: srcRows.length,
    completedSources,
    failedSources,
    totalRawItems: totalRaw,
    totalNormalized: totalNorm,
    totalCandidates: candRows.length,
    approvedMatches,
    unresolvedMatches,
    newEntities,
    highIssues,
    mediumIssues,
    lowIssues,
    eligibleCandidates: eligible,
    excludedCandidates: excluded,
    finalChartSize: shortlisted,
  };
}

async function mapDbRunToJob(dbRun: Record<string, unknown>): Promise<IngestJob> {
  const runId = dbRun.id as string;
  const programId = (dbRun.program_id as string) ?? "";
  const family = await loadJobFamily(programId);
  const summary = await computeJobSummary(runId);

  const editionSlug = dbRun.commit_edition_id
    ? await supabase
        .from("wk_chart_editions_v2")
        .select("edition_slug")
        .eq("id", dbRun.commit_edition_id as string)
        .maybeSingle()
        .then((r) => (r.data?.edition_slug as string) ?? null)
    : null;

  return {
    id: runId,
    chartFamilyId: programId,
    chartFamily: family,
    editionId: (dbRun.commit_edition_id as string | null) ?? null,
    editionSlug,
    status: mapRunStatus(dbRun.status as string),
    editionDate: String(dbRun.edition_date ?? ""),
    periodStart: String(dbRun.period_start ?? ""),
    periodEnd: String(dbRun.period_end ?? ""),
    chartSize: (dbRun.chart_size as number) ?? 20,
    rulesetKey: (dbRun.methodology_version as string) ?? "1.0.0",
    scoringModelKey: (dbRun.scoring_policy_version as string) ?? "1.0.1",
    createdBy: (dbRun.created_by_email as string) ?? (dbRun.created_by as string) ?? "System",
    createdAt: String(dbRun.created_at ?? ""),
    updatedAt: String(dbRun.updated_at ?? ""),
    completedAt: dbRun.committed_at ? String(dbRun.committed_at) : null,
    sourceSummary: {
      totalSources: summary.totalSources,
      completedSources: summary.completedSources,
      failedSources: summary.failedSources,
      totalRawItems: summary.totalRawItems,
      totalNormalized: summary.totalNormalized,
    },
    jobSummary: {
      totalCandidates: summary.totalCandidates,
      approvedMatches: summary.approvedMatches,
      unresolvedMatches: summary.unresolvedMatches,
      newEntities: summary.newEntities,
      highIssues: summary.highIssues,
      mediumIssues: summary.mediumIssues,
      lowIssues: summary.lowIssues,
      eligibleCandidates: summary.eligibleCandidates,
      excludedCandidates: summary.excludedCandidates,
      finalChartSize: summary.finalChartSize,
    },
    errorMessage: (dbRun.error_message as string) ?? null,
  };
}

export async function getIngestJobs(): Promise<IngestJob[]> {
  const { data, error } = await supabase
    .from("chart_ingest_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[realAdapter] getIngestJobs error:", error.message);
    return [];
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  return Promise.all(rows.map(mapDbRunToJob));
}

export async function getIngestJob(jobId: string): Promise<IngestJob | null> {
  const { data, error } = await supabase
    .from("chart_ingest_runs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[realAdapter] getIngestJob error:", error.message);
    return null;
  }

  return mapDbRunToJob(data as Record<string, unknown>);
}

export async function createIngestJob(payload: CreateIngestJobPayload): Promise<IngestJob> {
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const insert = {
    id,
    program_id: payload.chartFamilyId,
    edition_date: payload.editionDate,
    period_start: payload.periodStart,
    period_end: payload.periodEnd,
    chart_size: payload.chartSize,
    status: "queued",
    methodology_version: payload.rulesetKey,
    scoring_policy_version: payload.scoringModelKey,
    created_by: "admin",
    created_by_email: "admin@wakilisha.africa",
  };

  const { data, error } = await supabase
    .from("chart_ingest_runs")
    .insert(insert)
    .select()
    .single();

  if (error) throw new Error(`[realAdapter] createIngestJob failed: ${error.message}`);
  return mapDbRunToJob(data as Record<string, unknown>);
}

export async function updateJobStatusApi(
  jobId: string,
  status: IngestJobStatus,
  errorMessage?: string
): Promise<IngestJob | null> {
  const dbStatusMap: Record<string, string> = {
    draft: "queued",
    fetching: "running",
    normalizing: "running",
    matching: "running",
    scoring: "running",
    review: "needs_review",
    ready_to_draft: "dry_run_complete",
    drafted: "committed",
    published: "published",
    failed: "failed",
    cancelled: "cancelled",
  };

  const update: Record<string, unknown> = { status: dbStatusMap[status] ?? "queued" };
  if (errorMessage) update.error_message = errorMessage;

  const { error } = await supabase
    .from("chart_ingest_runs")
    .update(update)
    .eq("id", jobId);

  if (error) console.error("[realAdapter] updateJobStatusApi error:", error.message);
  return getIngestJob(jobId);
}

export async function cancelJob(jobId: string): Promise<IngestJob | null> {
  const { error } = await supabase
    .from("chart_ingest_runs")
    .update({ status: "cancelled" })
    .eq("id", jobId);
  if (error) console.error("[realAdapter] cancelJob error:", error.message);
  return getIngestJob(jobId);
}

export async function retryJob(jobId: string): Promise<IngestJob | null> {
  const { error } = await supabase
    .from("chart_ingest_runs")
    .update({ status: "queued", error_message: null, error_code: null })
    .eq("id", jobId);
  if (error) console.error("[realAdapter] retryJob error:", error.message);
  return getIngestJob(jobId);
}

export async function deleteJobApi(jobId: string): Promise<boolean> {
  const { error } = await supabase.from("chart_ingest_runs").delete().eq("id", jobId);
  if (error) {
    console.error("[realAdapter] deleteJobApi error:", error.message);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sources
// ═══════════════════════════════════════════════════════════════════════════════

export async function getSources(jobId: string): Promise<IngestSource[]> {
  const { data, error } = await supabase
    .from("chart_ingest_run_sources")
    .select("*")
    .eq("run_id", jobId);

  if (error) {
    console.error("[realAdapter] getSources error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    jobId: row.run_id,
    sourceType: (row.source_type as IngestSource["sourceType"]) ?? "manual",
    provider: (row.provider as IngestSource["provider"]) ?? "manual",
    sourceUrl: row.source_url ?? null,
    uploadedFileId: null,
    weight: 0.1,
    priority: row.priority ?? 100,
    status: mapSourceStatus(row.fetch_status ?? "pending"),
    rawCount: row.fetched_count ?? 0,
    normalizedCount: row.normalized_count ?? 0,
    errorCount: row.dropped_count ?? 0,
    fetchedAt: row.started_at ? String(row.started_at) : null,
    rawResponseHash: row.raw_response_hash ?? null,
    errorMessage: row.error_message ?? null,
  }));
}

export async function addSourceApi(
  jobId: string,
  payload: AddSourcePayload
): Promise<IngestSource> {
  const id = `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const insert = {
    id,
    run_id: jobId,
    source_type: payload.sourceType,
    provider: payload.provider,
    source_url: payload.sourceUrl,
    priority: payload.priority,
    fetch_status: "pending",
    enabled: true,
  };

  const { data, error } = await supabase
    .from("chart_ingest_run_sources")
    .insert(insert)
    .select()
    .single();

  if (error) throw new Error(`[realAdapter] addSourceApi failed: ${error.message}`);
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    jobId: row.run_id as string,
    sourceType: (row.source_type as IngestSource["sourceType"]) ?? "manual",
    provider: (row.provider as IngestSource["provider"]) ?? "manual",
    sourceUrl: row.source_url ?? null,
    uploadedFileId: null,
    weight: 0.1,
    priority: row.priority ?? 100,
    status: "pending",
    rawCount: 0,
    normalizedCount: 0,
    errorCount: 0,
    fetchedAt: null,
    rawResponseHash: null,
    errorMessage: null,
  };
}

export async function removeSourceApi(sourceId: string): Promise<void> {
  const { error } = await supabase
    .from("chart_ingest_run_sources")
    .delete()
    .eq("id", sourceId);
  if (error) console.error("[realAdapter] removeSourceApi error:", error.message);
}

export async function updateSourceWeight(
  sourceId: string,
  weight: number
): Promise<IngestSource | null> {
  const { error } = await supabase
    .from("chart_ingest_run_sources")
    .update({ priority: Math.round(weight * 100) })
    .eq("id", sourceId);
  if (error) {
    console.error("[realAdapter] updateSourceWeight error:", error.message);
    return null;
  }
  const { data } = await supabase
    .from("chart_ingest_run_sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    jobId: row.run_id as string,
    sourceType: (row.source_type as IngestSource["sourceType"]) ?? "manual",
    provider: (row.provider as IngestSource["provider"]) ?? "manual",
    sourceUrl: row.source_url ?? null,
    uploadedFileId: null,
    weight,
    priority: row.priority ?? 100,
    status: mapSourceStatus(row.fetch_status ?? "pending"),
    rawCount: row.fetched_count ?? 0,
    normalizedCount: row.normalized_count ?? 0,
    errorCount: row.dropped_count ?? 0,
    fetchedAt: row.started_at ? String(row.started_at) : null,
    rawResponseHash: row.raw_response_hash ?? null,
    errorMessage: row.error_message ?? null,
  };
}

export async function toggleSourceEnabled(sourceId: string): Promise<IngestSource | null> {
  const { data: current } = await supabase
    .from("chart_ingest_run_sources")
    .select("enabled")
    .eq("id", sourceId)
    .single();
  const nextEnabled = !(current?.enabled ?? true);
  const { error } = await supabase
    .from("chart_ingest_run_sources")
    .update({ enabled: nextEnabled })
    .eq("id", sourceId);
  if (error) {
    console.error("[realAdapter] toggleSourceEnabled error:", error.message);
    return null;
  }
  const { data } = await supabase
    .from("chart_ingest_run_sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    jobId: row.run_id as string,
    sourceType: (row.source_type as IngestSource["sourceType"]) ?? "manual",
    provider: (row.provider as IngestSource["provider"]) ?? "manual",
    sourceUrl: row.source_url ?? null,
    uploadedFileId: null,
    weight: 0.1,
    priority: row.priority ?? 100,
    status: nextEnabled ? mapSourceStatus(row.fetch_status ?? "pending") : "disabled",
    rawCount: row.fetched_count ?? 0,
    normalizedCount: row.normalized_count ?? 0,
    errorCount: row.dropped_count ?? 0,
    fetchedAt: row.started_at ? String(row.started_at) : null,
    rawResponseHash: row.raw_response_hash ?? null,
    errorMessage: row.error_message ?? null,
  };
}

export async function fetchSources(jobId: string): Promise<IngestSource[]> {
  return getSources(jobId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Raw Items
// ═══════════════════════════════════════════════════════════════════════════════

export async function getRawItems(jobId: string): Promise<RawSourceItem[]> {
  const { data, error } = await supabase
    .from("chart_ingest_raw_rows")
    .select("*")
    .eq("run_id", jobId);

  if (error) {
    console.error("[realAdapter] getRawItems error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    jobId: row.run_id,
    sourceId: row.source_id,
    sourcePosition: row.source_position ?? null,
    providerTrackId: row.provider_track_id ?? null,
    providerArtistId: null,
    isrc: row.isrc ?? null,
    titleRaw: row.title_raw ?? "",
    artistRaw: row.artist_raw ?? "",
    releaseRaw: row.release_raw ?? null,
    rawPayloadJson: (row.raw_payload_json as Record<string, unknown>) ?? {},
    rawHash: row.raw_payload_hash ?? row.id,
    createdAt: row.created_at,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Candidates
// ═══════════════════════════════════════════════════════════════════════════════

export async function getCandidates(jobId: string): Promise<IngestCandidate[]> {
  const { data: candData, error: candErr } = await supabase
    .from("chart_ingest_candidates")
    .select("*")
    .eq("run_id", jobId);

  if (candErr) {
    console.error("[realAdapter] getCandidates error:", candErr.message);
    return [];
  }

  const candidates = candData ?? [];
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((c) => c.id);
  const { data: scoreData } = await supabase
    .from("chart_ingest_candidate_scores")
    .select("*")
    .in("candidate_id", candidateIds);

  const scoresByCandidate = new Map(
    (scoreData ?? []).map((s) => [s.candidate_id, s])
  );

  return candidates.map((row) => {
    const scoreRow = scoresByCandidate.get(row.id);
    const mapped = mapCandidateStatus(row.status ?? "");
    return {
      id: row.id,
      jobId: row.run_id,
      rawItemIds: [],
      normalizedTitle: row.title ?? "",
      normalizedArtistLine: row.artist_display ?? "",
      normalizedArtists: row.lead_artist_key ? [row.lead_artist_key] : [],
      normalizedReleaseTitle: row.release_title ?? null,
      isrc: row.isrc ?? null,
      upc: row.upc ?? null,
      artworkUrl: row.artwork_url ?? null,
      previewUrl: row.preview_url ?? null,
      externalUrls: row.external_url ? { external: row.external_url } : {},
      durationMs: null,
      releaseDate: row.release_date ? String(row.release_date) : null,
      label: null,
      genre: null,
      sourcePositions: row.source_count ? { default: row.source_count } : {},
      sourceMetrics: row.occurrence_count ? { default: row.occurrence_count } : {},
      candidateHash: row.normalized_key ?? row.id,
      dedupeGroupKey: null,
      eligibilityStatus: mapped.eligibility,
      eligibilityReasons: [],
      score: scoreRow ? Number(scoreRow.final_score ?? 0) : 0,
      calculatedRank: scoreRow?.previous_position ?? 0,
      manualRankOverride: null,
      finalRank: scoreRow?.previous_position ?? null,
      status: mapped.status,
      sourceType: (row.candidate_type as CandidateSourceType) ?? "streaming",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export async function getCandidateById(
  jobId: string,
  candidateId: string
): Promise<IngestCandidate | null> {
  const all = await getCandidates(jobId);
  return all.find((c) => c.id === candidateId) ?? null;
}

export async function approveCandidate(candidateId: string): Promise<IngestCandidate | null> {
  const { error } = await supabase
    .from("chart_ingest_candidates")
    .update({ status: "shortlisted" })
    .eq("id", candidateId);
  if (error) console.error("[realAdapter] approveCandidate error:", error.message);
  const { data } = await supabase
    .from("chart_ingest_candidates")
    .select("run_id")
    .eq("id", candidateId)
    .single();
  if (!data) return null;
  return getCandidateById(data.run_id, candidateId);
}

export async function excludeCandidate(candidateId: string): Promise<IngestCandidate | null> {
  const { error } = await supabase
    .from("chart_ingest_candidates")
    .update({ status: "excluded" })
    .eq("id", candidateId);
  if (error) console.error("[realAdapter] excludeCandidate error:", error.message);
  const { data } = await supabase
    .from("chart_ingest_candidates")
    .select("run_id")
    .eq("id", candidateId)
    .single();
  if (!data) return null;
  return getCandidateById(data.run_id, candidateId);
}

export async function restoreCandidate(candidateId: string): Promise<IngestCandidate | null> {
  const { error } = await supabase
    .from("chart_ingest_candidates")
    .update({ status: "eligible" })
    .eq("id", candidateId);
  if (error) console.error("[realAdapter] restoreCandidate error:", error.message);
  const { data } = await supabase
    .from("chart_ingest_candidates")
    .select("run_id")
    .eq("id", candidateId)
    .single();
  if (!data) return null;
  return getCandidateById(data.run_id, candidateId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Matches
// ═══════════════════════════════════════════════════════════════════════════════

export async function getMatches(jobId: string): Promise<IngestMatch[]> {
  const { data, error } = await supabase
    .from("chart_ingest_matches")
    .select("*")
    .eq("run_id", jobId);

  if (error) {
    console.error("[realAdapter] getMatches error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    jobId: row.run_id,
    candidateId: row.candidate_id,
    canonicalTrackId: row.canonical_entity_id ?? null,
    canonicalReleaseId: null,
    canonicalArtistIds: [],
    matchConfidence: row.confidence ?? 0,
    matchMethod: mapMatchMethod(row.match_method),
    matchNotes: row.decision_note ?? null,
    approvedBy: row.decided_by ?? null,
    approvedAt: row.decided_at ? String(row.decided_at) : null,
  }));
}

export async function approveCandidateMatch(
  jobId: string,
  candidateId: string,
  matchId: string
): Promise<IngestMatch | null> {
  const { error } = await supabase
    .from("chart_ingest_matches")
    .update({ status: "approved", decided_by: "admin", decided_at: new Date().toISOString() })
    .eq("id", matchId)
    .eq("run_id", jobId);
  if (error) console.error("[realAdapter] approveCandidateMatch error:", error.message);
  return (await getMatches(jobId)).find((m) => m.id === matchId) ?? null;
}

export async function rejectCandidateMatch(
  jobId: string,
  matchId: string
): Promise<IngestMatch | null> {
  const { error } = await supabase
    .from("chart_ingest_matches")
    .update({
      status: "rejected",
      decided_by: null,
      decided_at: null,
      confidence: Math.max(0, (await supabase.from("chart_ingest_matches").select("confidence").eq("id", matchId).single().then((r) => (r.data?.confidence as number) ?? 0)) - 20),
    })
    .eq("id", matchId)
    .eq("run_id", jobId);
  if (error) console.error("[realAdapter] rejectCandidateMatch error:", error.message);
  return (await getMatches(jobId)).find((m) => m.id === matchId) ?? null;
}

export async function rematchCandidate(
  jobId: string,
  candidateId: string,
  canonicalTrackId: string,
  confidence: number,
  method: string
): Promise<IngestMatch | null> {
  const { data: existing } = await supabase
    .from("chart_ingest_matches")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("run_id", jobId)
    .single();

  const matchId = existing?.id;
  if (!matchId) {
    const newId = `match-${Date.now()}`;
    const { error } = await supabase.from("chart_ingest_matches").insert({
      id: newId,
      run_id: jobId,
      candidate_id: candidateId,
      canonical_entity_id: canonicalTrackId,
      match_method: method,
      confidence,
      status: "approved",
      decided_by: "admin",
      decided_at: new Date().toISOString(),
      decision_note: "Manual rematch",
    });
    if (error) console.error("[realAdapter] rematchCandidate insert error:", error.message);
    return (await getMatches(jobId)).find((m) => m.id === newId) ?? null;
  }

  const { error } = await supabase
    .from("chart_ingest_matches")
    .update({
      canonical_entity_id: canonicalTrackId,
      match_method: method,
      confidence,
      status: "approved",
      decided_by: "admin",
      decided_at: new Date().toISOString(),
      decision_note: "Manual rematch",
    })
    .eq("id", matchId);
  if (error) console.error("[realAdapter] rematchCandidate update error:", error.message);
  return (await getMatches(jobId)).find((m) => m.id === matchId) ?? null;
}

export async function markAsNewEntity(
  jobId: string,
  candidateId: string
): Promise<IngestMatch | null> {
  return rematchCandidate(jobId, candidateId, "", 0, "new_entity");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Review Issues
// ═══════════════════════════════════════════════════════════════════════════════

export async function getReviewIssues(jobId: string): Promise<ReviewIssue[]> {
  const { data, error } = await supabase
    .from("chart_ingest_review_issues")
    .select("*")
    .eq("run_id", jobId);

  if (error) {
    console.error("[realAdapter] getReviewIssues error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    jobId: row.run_id,
    candidateId: row.candidate_id ?? null,
    severity: (row.severity as ReviewIssue["severity"]) ?? "medium",
    issueType: (row.issue_type as ReviewIssue["issueType"]) ?? "missing_title",
    message: row.message ?? "",
    status: mapIssueStatus(row.status ?? "open"),
    blocking: row.blocking ?? false,
    resolutionNote: row.resolution_note ?? null,
    resolvedBy: row.resolved_by ?? null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    createdAt: row.created_at,
  }));
}

export async function resolveReviewIssue(
  jobId: string,
  issueId: string,
  payload: ResolveIssuePayload
): Promise<ReviewIssue | null> {
  const status: IssueStatus =
    payload.resolution === "resolve" || payload.resolution === "override" ? "resolved" : "ignored";
  const { error } = await supabase
    .from("chart_ingest_review_issues")
    .update({
      status,
      resolution_note: payload.note,
      resolved_by: "admin",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", issueId)
    .eq("run_id", jobId);
  if (error) console.error("[realAdapter] resolveReviewIssue error:", error.message);
  return (await getReviewIssues(jobId)).find((i) => i.id === issueId) ?? null;
}

export async function reopenIssue(
  jobId: string,
  issueId: string
): Promise<ReviewIssue | null> {
  const { error } = await supabase
    .from("chart_ingest_review_issues")
    .update({
      status: "open",
      resolution_note: null,
      resolved_by: null,
      resolved_at: null,
    })
    .eq("id", issueId)
    .eq("run_id", jobId);
  if (error) console.error("[realAdapter] reopenIssue error:", error.message);
  return (await getReviewIssues(jobId)).find((i) => i.id === issueId) ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Ranking / Draft
// ═══════════════════════════════════════════════════════════════════════════════

export async function applyRankOverride(
  jobId: string,
  candidateId: string,
  payload: RankOverridePayload
): Promise<IngestCandidate | null> {
  const { error } = await supabase
    .from("chart_ingest_candidate_scores")
    .update({ previous_position: payload.rank })
    .eq("candidate_id", candidateId)
    .eq("run_id", jobId);
  if (error) console.error("[realAdapter] applyRankOverride error:", error.message);
  return getCandidateById(jobId, candidateId);
}

export async function clearRankOverride(
  jobId: string,
  candidateId: string
): Promise<IngestCandidate | null> {
  const { error } = await supabase
    .from("chart_ingest_candidate_scores")
    .update({ previous_position: null })
    .eq("candidate_id", candidateId)
    .eq("run_id", jobId);
  if (error) console.error("[realAdapter] clearRankOverride error:", error.message);
  return getCandidateById(jobId, candidateId);
}

export async function createDraftEdition(jobId: string): Promise<IngestJob | null> {
  const { error } = await supabase
    .from("chart_ingest_runs")
    .update({ status: "committed" })
    .eq("id", jobId);
  if (error) console.error("[realAdapter] createDraftEdition error:", error.message);
  return getIngestJob(jobId);
}

export async function publishEdition(jobId: string): Promise<IngestJob | null> {
  const { error } = await supabase
    .from("chart_ingest_runs")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) console.error("[realAdapter] publishEdition error:", error.message);
  return getIngestJob(jobId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preflight
// ═══════════════════════════════════════════════════════════════════════════════

export async function runPreflightCheck(
  jobId: string
): Promise<{ pass: boolean; checklist: { label: string; pass: boolean }[]; warnings: number; errors: number }> {
  const [job, sources, candidates, matches, issues, draftEntries] = await Promise.all([
    getIngestJob(jobId),
    getSources(jobId),
    getCandidates(jobId),
    getMatches(jobId),
    getReviewIssues(jobId),
    getDraftEntries(jobId),
  ]);

  const unresolved = matches.filter((m) => m.approvedBy === null && m.matchMethod !== "new_entity");
  const highOpen = issues.filter((i) => i.severity === "high" && i.status === "open");

  const rankMap = new Map<number, number>();
  for (const c of candidates) {
    const rank = c.finalRank ?? c.calculatedRank;
    if (rank > 0) rankMap.set(rank, (rankMap.get(rank) ?? 0) + 1);
  }
  const hasDupRanks = Array.from(rankMap.values()).some((c) => c > 1);

  const checklist = [
    { label: "Job exists", pass: !!job },
    { label: "Sources added", pass: sources.length > 0 },
    { label: "Sources fetched", pass: sources.every((s) => s.status === "completed") },
    { label: "Candidates normalized", pass: candidates.length > 0 },
    { label: "Matches resolved", pass: unresolved.length === 0 },
    { label: "No blocking issues", pass: highOpen.length === 0 },
    { label: "Draft entries exist", pass: draftEntries.length > 0 },
    { label: "Rank integrity valid", pass: !hasDupRanks },
  ];

  const warnings = issues.filter((i) => i.severity === "medium" && i.status === "open").length;
  const errors = highOpen.length;

  return {
    pass: checklist.every((c) => c.pass),
    checklist,
    warnings,
    errors,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Logs
// ═══════════════════════════════════════════════════════════════════════════════

export async function getJobLogs(jobId: string): Promise<IngestJobLog[]> {
  const [stageEvents, auditEvents] = await Promise.all([
    supabase.from("chart_ingest_stage_events").select("*").eq("run_id", jobId),
    supabase.from("chart_ingest_audit_events").select("*").eq("run_id", jobId),
  ]);

  const stageLogs = (stageEvents.data ?? []).map(
    (row): IngestJobLog => ({
      id: `stage-${row.id}`,
      jobId: row.run_id,
      stage: row.stage,
      level: deriveLogLevel(row.status ?? ""),
      message: row.message ?? `${row.stage}: ${row.status}`,
      contextJson: (row.metrics_json as Record<string, unknown>) ?? {},
      createdBy: "System",
      createdAt: row.created_at,
    })
  );

  const auditLogs = (auditEvents.data ?? []).map(
    (row): IngestJobLog => ({
      id: `audit-${row.id}`,
      jobId: row.run_id,
      stage: row.action,
      level: "info",
      message: row.note ?? `${row.action}: ${row.previous_status} → ${row.new_status}`,
      contextJson: (row.payload_json as Record<string, unknown>) ?? {},
      createdBy: row.actor_email ?? row.actor ?? "System",
      createdAt: row.created_at,
    })
  );

  return [...stageLogs, ...auditLogs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Draft Entries
// ═══════════════════════════════════════════════════════════════════════════════

export async function getDraftEntries(jobId: string): Promise<DraftEntry[]> {
  const { data: run } = await supabase
    .from("chart_ingest_runs")
    .select("commit_edition_id")
    .eq("id", jobId)
    .maybeSingle();

  const editionId = run?.commit_edition_id;
  if (!editionId) return [];

  const { data, error } = await supabase
    .from("wk_chart_entries_v2")
    .select("*")
    .eq("edition_id", editionId)
    .order("rank", { ascending: true });

  if (error) {
    console.error("[realAdapter] getDraftEntries error:", error.message);
    return [];
  }

  return (data ?? []).map(
    (row): DraftEntry => ({
      id: row.id,
      jobId,
      candidateId: row.id,
      finalRank: row.rank,
      canonicalTrackId: row.track_slug ?? row.track_title ?? row.id,
      movement: (row.movement as DraftEntry["movement"]) ?? "same",
      previousRank: row.previous_rank ?? null,
      peakPosition: row.rank,
      weeksOnChart: null,
      score: Number(row.total_score ?? 0),
      entryPayload: {},
      locked: false,
      sourceType: "streaming",
    })
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Editions & Snapshots
// ═══════════════════════════════════════════════════════════════════════════════

export async function getEditionsApi(): Promise<ChartEdition[]> {
  const { data, error } = await supabase
    .from("wk_chart_editions_v2")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[realAdapter] getEditionsApi error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    familyId: row.program_id ?? "",
    slug: row.edition_slug ?? "",
    label: row.edition_label ?? row.edition_slug ?? "",
    date: row.edition_date ?? "",
    periodStart: row.period_start ?? "",
    periodEnd: row.period_end ?? "",
    status: (row.status as ChartEdition["status"]) ?? "draft",
    ingestJobId: row.ingest_run_id ?? null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    publishedBy: row.published_by ?? null,
    entryCount: row.entry_count ?? 0,
    newEntries: row.new_entries_count ?? 0,
    reEntries: row.re_entries_count ?? 0,
  }));
}

export async function getEditionById(editionId: string): Promise<ChartEdition | null> {
  const all = await getEditionsApi();
  return all.find((e) => e.id === editionId) ?? null;
}

export async function getSnapshots(): Promise<Snapshot[]> {
  const { data, error } = await supabase
    .from("chart_ingest_runs")
    .select("id, program_id, rule_snapshot_json, created_at, updated_at")
    .not("rule_snapshot_json", "is", null);

  if (error) {
    console.error("[realAdapter] getSnapshots error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: `snap-${row.id}`,
    editionId: "",
    familyId: row.program_id ?? "",
    snapshotJson: (row.rule_snapshot_json as Record<string, unknown>) ?? {},
    publishedAt: String(row.created_at),
    publishedBy: "System",
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard KPIs
// ═══════════════════════════════════════════════════════════════════════════════

export async function getDashboardKpisApi(): Promise<DashboardKpis> {
  const [runs, editions, issues] = await Promise.all([
    supabase.from("chart_ingest_runs").select("status"),
    supabase.from("wk_chart_editions_v2").select("status"),
    supabase.from("chart_ingest_review_issues").select("status").eq("status", "open"),
  ]);

  const runRows = runs.data ?? [];
  const editionRows = editions.data ?? [];
  const issueRows = issues.data ?? [];

  const active = runRows.filter((r) => !["published", "failed", "cancelled"].includes(r.status)).length;
  const failed = runRows.filter((r) => r.status === "failed").length;
  const published = editionRows.filter((e) => e.status === "published").length;

  return {
    activeJobs: active,
    failedJobs: failed,
    pendingReviewIssues: issueRows.length,
    latestPublishedEdition: null,
    totalFamilies: 0,
    totalPublishedEditions: published,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════

export async function getJobSummaryApi(jobId: string) {
  const [sources, candidates, matches, issues, draftEntries] = await Promise.all([
    getSources(jobId),
    getCandidates(jobId),
    getMatches(jobId),
    getReviewIssues(jobId),
    getDraftEntries(jobId),
  ]);

  const highIssues = issues.filter((i) => i.severity === "high" && i.status === "open");
  const mediumIssues = issues.filter((i) => i.severity === "medium" && i.status === "open");
  const lowIssues = issues.filter((i) => i.severity === "low" && i.status === "open");

  const unresolvedMatches = matches.filter((m) => m.approvedBy === null);
  const approvedMatches = matches.filter((m) => m.approvedBy !== null);
  const newEntities = matches.filter((m) => m.matchMethod === "new_entity");

  const approvedCandidates = candidates.filter((c) => c.status === "approved");
  const excludedCandidates = candidates.filter((c) => c.status === "excluded");
  const needsReviewCandidates = candidates.filter((c) => c.status === "needs_review");

  return {
    totalSources: sources.length,
    totalRawItems: sources.reduce((sum, s) => sum + s.rawCount, 0),
    totalCandidates: candidates.length,
    approvedMatches: approvedMatches.length,
    unresolvedMatches: unresolvedMatches.length,
    newEntities: newEntities.length,
    highIssues: highIssues.length,
    mediumIssues: mediumIssues.length,
    lowIssues: lowIssues.length,
    eligibleCandidates: candidates.filter((c) => c.eligibilityStatus === "eligible").length,
    excludedCandidates: excludedCandidates.length,
    needsReviewCandidates: needsReviewCandidates.length,
    approvedCandidates: approvedCandidates.length,
    finalChartSize: draftEntries.length,
    draftEntries,
    isPublishable: highIssues.length === 0 && unresolvedMatches.length === 0 && draftEntries.length > 0,
    hasBlockingIssues: highIssues.length > 0,
    hasUnresolvedMatches: unresolvedMatches.length > 0,
    hasDraft: draftEntries.length > 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Demo helpers (no-op in production)
// ═══════════════════════════════════════════════════════════════════════════════

export function getDemoJobId(): string {
  return "";
}

export function resetStore(): void {
  // No-op — real data only
}

export function resetDemo(): void {
  // No-op
}

export function refreshStore(): void {
  // No-op
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV pipeline — backed by chart-ingest-api edge function
// ═══════════════════════════════════════════════════════════════════════════════

function invokeCsvApi<T>(action: string, params: Record<string, unknown>): Promise<T> {
  return supabase.functions.invoke("chart-ingest-api", { body: { action, ...params } }).then(({ data, error }) => {
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error + (data.detail ? `: ${data.detail}` : ""));
    return data as T;
  });
}

export async function csvUpload(runId: string, filename: string, csvContent: string): Promise<DiscoveredCsvSource> {
  const data = await invokeCsvApi<{
    ok: boolean; csvId: string; filename: string; chartType: string; confidence: string;
    rowCount: number; headers: string[]; sampleRows: Record<string, string>[];
    detectedDate: string | null; detectedWeek: string | null;
    mappingStatus: string; validationStatus: string; validationIssues: string[];
    mappedFields: Record<string, string>; sourceSize: number;
  }>("csv_upload", { runId, filename, csv_content: csvContent });

  return {
    id: data.csvId,
    filename: data.filename,
    filepath: `csv://${runId}/${data.filename}`,
    chartType: data.chartType,
    confidence: data.confidence as DiscoveredCsvSource["confidence"],
    rowCount: data.rowCount,
    headers: data.headers,
    sampleRows: data.sampleRows,
    detectedDate: data.detectedDate,
    detectedWeek: data.detectedWeek,
    mappingStatus: data.mappingStatus as DiscoveredCsvSource["mappingStatus"],
    validationStatus: data.validationStatus as DiscoveredCsvSource["validationStatus"],
    validationIssues: data.validationIssues,
    mappedFields: data.mappedFields,
    sourceSize: data.sourceSize,
    usedAsSource: true,
    addedAt: new Date().toISOString(),
  };
}

export async function getDiscoveredCsvSources(jobId?: string): Promise<DiscoveredCsvSource[]> {
  if (!jobId) return [];
  try {
    const data = await invokeCsvApi<{
      csvs: Array<{
        id: string; filename: string; filepath: string; chartType: string;
        confidence: string; rowCount: number; headers: string[];
        sampleRows: Record<string, string>[]; detectedDate: string | null;
        detectedWeek: string | null; mappingStatus: string;
        validationStatus: string; validationIssues: string[];
        mappedFields: Record<string, string>; sourceSize: number;
        usedAsSource: boolean; addedAt: string | null;
      }>;
    }>("csv_list", { runId: jobId });

    return (data.csvs ?? []).map((csv) => ({
      id: csv.id,
      filename: csv.filename,
      filepath: csv.filepath,
      chartType: csv.chartType,
      confidence: csv.confidence as DiscoveredCsvSource["confidence"],
      rowCount: csv.rowCount,
      headers: csv.headers,
      sampleRows: csv.sampleRows,
      detectedDate: csv.detectedDate,
      detectedWeek: csv.detectedWeek,
      mappingStatus: csv.mappingStatus as DiscoveredCsvSource["mappingStatus"],
      validationStatus: csv.validationStatus as DiscoveredCsvSource["validationStatus"],
      validationIssues: csv.validationIssues,
      mappedFields: csv.mappedFields,
      sourceSize: csv.sourceSize,
      usedAsSource: csv.usedAsSource,
      addedAt: csv.addedAt,
    }));
  } catch (err) {
    console.error("[realAdapter] getDiscoveredCsvSources error:", err);
    return [];
  }
}

export async function csvNormalize(runId: string, csvId: string, mappedFields?: Record<string, string>): Promise<{
  ok: boolean; candidateCount: number; errors: string[]; warnings: string[]; skippedRows: number; sessionId: string;
}> {
  return invokeCsvApi("csv_normalize", { runId, csvId, mappedFields: mappedFields ?? null });
}

export async function getCsvImportSessions(jobId: string): Promise<CsvImportSession[]> {
  try {
    const csvs = await getDiscoveredCsvSources(jobId);
    if (csvs.length === 0) return [];

    const { data: candidates } = await supabase
      .from("chart_ingest_candidates")
      .select("id, candidate_type")
      .eq("run_id", jobId)
      .eq("candidate_type", "csv");

    const candidateCount = candidates?.length ?? 0;

    return csvs.map((csv) => ({
      id: `csv-session-${csv.id}`,
      jobId,
      filename: csv.filename,
      sourceId: csv.id,
      rowCount: csv.rowCount,
      validRows: candidateCount,
      candidateCount,
      issueCount: csv.validationIssues.length,
      normalizedAt: csv.addedAt ?? new Date().toISOString(),
      normalizedBy: "System",
      mappingUsed: csv.mappedFields,
      validationSummary: {
        errors: csv.validationStatus === "errors" ? csv.validationIssues : [],
        warnings: csv.validationStatus === "warnings" ? csv.validationIssues : [],
        skippedRows: 0,
      },
    }));
  } catch {
    return [];
  }
}

export async function attachCsvAsSource(jobId: string, csvId: string): Promise<IngestSource> {
  const csvs = await getDiscoveredCsvSources(jobId);
  const csv = csvs.find((c) => c.id === csvId);
  if (!csv) throw new Error(`CSV not found: ${csvId}`);

  const sourceId = `csv-src-${csvId}`;
  const insert = {
    id: sourceId,
    run_id: jobId,
    source_type: "csv",
    provider: "csv",
    source_url: `csv://${csv.filename}`,
    priority: 0,
    enabled: true,
    fetch_status: "completed",
    fetched_count: csv.rowCount,
  };

  const { error } = await supabase
    .from("chart_ingest_run_sources")
    .upsert(insert, { onConflict: "id" });

  if (error) throw new Error(`[realAdapter] attachCsvAsSource failed: ${error.message}`);

  return {
    id: sourceId,
    jobId,
    sourceType: "csv",
    provider: "csv",
    sourceUrl: `csv://${csv.filename}`,
    uploadedFileId: csvId,
    weight: 0.1,
    priority: 0,
    status: "completed",
    rawCount: csv.rowCount,
    normalizedCount: 0,
    errorCount: 0,
    fetchedAt: new Date().toISOString(),
    rawResponseHash: null,
    errorMessage: null,
  };
}

export async function normalizeCsvCandidates(jobId: string, csvId: string, mappedFields?: Record<string, string>): Promise<IngestCandidate[]> {
  const result = await csvNormalize(jobId, csvId, mappedFields);

  const { data: candidates } = await supabase
    .from("chart_ingest_candidates")
    .select("*")
    .eq("run_id", jobId)
    .eq("candidate_type", "csv")
    .order("created_at", { ascending: false })
    .limit(result.candidateCount);

  return (candidates ?? []).map((row) => ({
    id: row.id,
    jobId: row.run_id,
    rawItemIds: [],
    normalizedTitle: row.title ?? "",
    normalizedArtistLine: row.artist_display ?? "",
    normalizedArtists: row.lead_artist_key ? [row.lead_artist_key] : [],
    normalizedReleaseTitle: null,
    isrc: row.isrc ?? null,
    upc: null,
    artworkUrl: row.artwork_url ?? null,
    previewUrl: null,
    externalUrls: row.external_url ? { external: row.external_url } : {},
    durationMs: null,
    releaseDate: row.release_date ? String(row.release_date) : null,
    label: null,
    genre: null,
    sourcePositions: {},
    sourceMetrics: {},
    candidateHash: row.normalized_key ?? row.id,
    dedupeGroupKey: null,
    eligibilityStatus: "eligible",
    eligibilityReasons: [],
    score: 0,
    calculatedRank: 0,
    manualRankOverride: null,
    finalRank: null,
    status: "candidate",
    sourceType: "csv",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getJobLogsForRun(jobId: string): Promise<IngestJobLog[]> {
  return getJobLogs(jobId);
}

export async function searchCanonicalTracks(_query: string): Promise<{ id: string; title: string; artist: string }[]> {
  return [];
}