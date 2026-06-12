/**
 * Ingest Studio Mock Data & Store
 * LocalStorage-backed persistence for provider-based ingest runs.
 */

import type {
  IngestRun,
  IngestStageStatus,
  IngestResolvedRow,
  IngestRunSummary,
  IngestStudioKpi,
  RecentIngestActivity,
  ResourceGuardStatus,
  CreateIngestDryRunRequest,
  CreateIngestDryRunResponse,
  CommitIngestRunRequest,
  CommitIngestRunResponse,
} from "./ingestStudioTypes";
import type { IngestRowIntelligence, RelationalArtistCredit, RichTrackMetadata } from "../chartsIntelligence/intelligenceTypes";
import { fetchFromAllSources } from "./providerFetch";
import { normalizeToResolvedRows } from "./normalize";
import { detectProviderFromUrl } from "./providerDetection";
import { runCanonicalMatch } from "./canonicalMatch";
import { enrichRows, applyEnrichmentToRow, checkEnrichmentCredentials } from "./enrichment";
import { commitIngestRunToV2Edition, validateCommitReadiness } from "./commitService";
import { getChartMethodology } from "../chartsMethodology/methodologyStore";
import { scoreAndRankRows } from "../chartsMethodology/scoringEngine";
import { getEligibilityProfile } from "../chartsEligibility/eligibilityStore";
import { executeEligibility } from "../chartsEligibility/eligibilityEngine";
import { applyEntityResolutionToRows, createSeedEntityResolutionRegistry } from "../chartsEntityResolution/entityResolutionEngine";

const STUDIO_STORE_KEY = "wkcharts_ingest_studio_v2";

type EntityMetrics = { resolved: number; needsReview: number; shellCreated: number; duplicateCandidate: number; total: number };
type EligibilityMetrics = { profileId: string; eligibleRows: number; excludedRows: number; reviewRows: number; eligibilityRate: number };

function summarizeRows(rows: IngestResolvedRow[], methodologyVersion?: string, eligibility?: EligibilityMetrics, entities?: EntityMetrics): IngestRunSummary {
  const scores = rows.map((row) => row.methodologyScore?.finalScore).filter((score): score is number => typeof score === "number");
  return {
    totalRows: rows.length,
    canonicalMatches: rows.filter((r) => r.matchStatus === "canonical").length,
    shells: rows.filter((r) => r.matchStatus === "shell").length,
    gaps: rows.filter((r) => r.matchStatus === "no_match" || r.matchStatus === "needs_review").length,
    duplicateCandidates: rows.filter((r) => r.matchStatus === "duplicate_candidate").length,
    matchRate: rows.length ? (rows.filter((r) => r.matchStatus === "canonical").length / rows.length) * 100 : 0,
    entityResolvedRows: entities?.resolved,
    entityReviewRows: entities?.needsReview,
    entityShellRows: entities?.shellCreated,
    entityDuplicateRows: entities?.duplicateCandidate,
    eligibilityProfileId: eligibility?.profileId,
    eligibleRows: eligibility?.eligibleRows,
    excludedRows: eligibility?.excludedRows,
    reviewRows: eligibility?.reviewRows,
    eligibilityRate: eligibility?.eligibilityRate,
    scoringMethodologyVersion: methodologyVersion,
    averageMethodologyScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : undefined,
  };
}

function getInitialStages(): IngestStageStatus[] {
  return ["validate", "provider_detection", "resource_guard", "source_fetch", "normalize", "canonical_match", "enrichment", "entity_resolution", "eligibility_execution", "methodology_scoring", "snapshot_commit"].map((stage) => ({ stage: stage as IngestStageStatus["stage"], status: "idle" }));
}

interface StudioStore { runs: IngestRun[]; kpis: IngestStudioKpi; activity: RecentIngestActivity[]; }
function getInitialStudioStore(): StudioStore {
  return {
    runs: [],
    kpis: { editionsThisWeek: 0, canonicalMatchRate: 0, rowsAwaitingReview: 0, averageRunTimeMs: 0 },
    activity: [],
  };
}
function loadStudioStore(): StudioStore { try { const raw = localStorage.getItem(STUDIO_STORE_KEY); if (raw) { const parsed = JSON.parse(raw) as StudioStore; if (parsed.runs && parsed.kpis) return parsed; } } catch { /* ignore */ } const initial = getInitialStudioStore(); saveStudioStore(initial); return initial; }
function saveStudioStore(store: StudioStore): void { try { localStorage.setItem(STUDIO_STORE_KEY, JSON.stringify(store)); } catch { /* ignore */ } }
let studioStore = loadStudioStore();
export function getStudioStore(): StudioStore { return studioStore; }
export function refreshStudioStore(): StudioStore { studioStore = loadStudioStore(); return studioStore; }
export function resetStudioStore(): StudioStore { const initial = getInitialStudioStore(); saveStudioStore(initial); studioStore = initial; return studioStore; }
export function commitStudioStore(store: StudioStore): void { studioStore = store; saveStudioStore(store); }
export function getIngestRuns(): Promise<IngestRun[]> { return Promise.resolve(getStudioStore().runs); }
export function getIngestRun(runId: string): Promise<IngestRun | null> { const run = getStudioStore().runs.find((r) => r.id === runId); return Promise.resolve(run ?? null); }
export function getIngestKpis(): Promise<IngestStudioKpi> { return Promise.resolve(getStudioStore().kpis); }
export function getRecentIngestActivity(): Promise<RecentIngestActivity[]> { return Promise.resolve(getStudioStore().activity); }
export function createIngestRun(run: IngestRun): Promise<IngestRun> { const store = getStudioStore(); store.runs = [run, ...store.runs]; commitStudioStore(store); return Promise.resolve(run); }
export function updateIngestRun(runId: string, updater: (run: IngestRun) => IngestRun): Promise<IngestRun | null> { const store = getStudioStore(); const idx = store.runs.findIndex((r) => r.id === runId); if (idx === -1) return Promise.resolve(null); store.runs[idx] = updater(store.runs[idx]); commitStudioStore(store); return Promise.resolve(store.runs[idx]); }
export function addIngestActivity(activity: RecentIngestActivity): void { const store = getStudioStore(); store.activity = [activity, ...store.activity]; commitStudioStore(store); }
export function getResourceGuardStatus(runId: string): Promise<ResourceGuardStatus> { const run = getStudioStore().runs.find((r) => r.id === runId); const sourceCount = run?.sourceUrls.length ?? 0; return Promise.resolve({ sourceCount, providerBudgetRemaining: 100 - sourceCount * 10, workerConcurrency: 4, estimatedRowCount: sourceCount * 200, duplicateRunWarning: null, sameEditionDateWarning: null }); }

function rawObject(row: IngestResolvedRow): Record<string, unknown> { return row.raw && typeof row.raw === "object" ? row.raw as Record<string, unknown> : {}; }
function buildRowIntelligence(rows: IngestResolvedRow[], excludedRows: NonNullable<IngestRun["excludedRows"]>): Record<string, IngestRowIntelligence> {
  return Object.fromEntries(rows.map((row) => {
    const raw = rawObject(row);
    return [row.id, {
      rowId: row.id,
      richMetadata: raw.richMetadata as RichTrackMetadata | undefined,
      artistCredits: raw.artistCredits as RelationalArtistCredit[] | undefined,
      entityResolution: row.entityResolution ?? raw.entityResolution as IngestRowIntelligence["entityResolution"],
      eligibilityDecision: row.eligibilityDecision ?? undefined,
      excludedRow: excludedRows.find((excluded) => excluded.sourceRowId === row.id) ?? null,
    }];
  }));
}

export async function runDryRun(request: CreateIngestDryRunRequest): Promise<CreateIngestDryRunResponse> {
  const runId = `run-${Date.now()}`;
  const now = new Date().toISOString();
  const run: IngestRun = {
    id: runId,
    chartTitle: request.chartTitle,
    chartSlug: request.chartSlug,
    editionDate: request.editionDate,
    chartSize: request.chartSize,
    market: request.market,
    chartKind: request.chartKind,
    coverStyle: request.coverStyle ?? "default",
    sourceUrls: request.sourceUrls,
    detectedProviders: [...new Set(request.sourceUrls.map((u) => { const l = u.toLowerCase(); if (l.includes("spotify.com")) return "spotify"; if (l.includes("apple.com")) return "apple_music"; return "unknown"; }))].filter((p) => p !== "unknown") as IngestRun["detectedProviders"],
    saveAsRecurringSeries: request.saveAsRecurringSeries ?? false,
    existingSeriesId: request.existingSeriesId ?? null,
    eligibilityProfileId: request.eligibilityProfileId ?? "elig_all_artists",
    methodologyVersion: request.methodologyVersion ?? "top_songs_weighted_v1",
    marketScopeId: request.marketScopeId ?? null,
    marketScopeSnapshot: request.marketScopeSnapshot ?? null,
    enrichmentOptions: request.enrichmentOptions ?? null,
    status: "running",
    stages: getInitialStages(),
    summary: { totalRows: 0, canonicalMatches: 0, shells: 0, gaps: 0, duplicateCandidates: 0, matchRate: 0, eligibilityProfileId: request.eligibilityProfileId ?? "elig_all_artists", scoringMethodologyVersion: request.methodologyVersion ?? "top_songs_weighted_v1" },
    rows: [],
    excludedRows: [],
    commercialReadiness: null,
    rowIntelligence: {},
    createdBy: "Current User",
    createdAt: now,
    updatedAt: now,
  };
  await createIngestRun(run);
  await simulateStageProgress(runId);
  const updatedRun = getStudioStore().runs.find((r) => r.id === runId);
  if (!updatedRun) throw new Error("Run not found after simulation");
  return { runId, status: updatedRun.status, stages: updatedRun.stages, summary: updatedRun.summary, rows: updatedRun.rows, excludedRows: updatedRun.excludedRows, commercialReadiness: updatedRun.commercialReadiness, rowIntelligence: updatedRun.rowIntelligence };
}

async function simulateStageProgress(runId: string): Promise<void> {
  const store = getStudioStore();
  const idx = store.runs.findIndex((r) => r.id === runId);
  if (idx === -1) return;
  const run = store.runs[idx];
  const chartSize = run.chartSize;
  const market = run.market;
  const sourceUrls = run.sourceUrls;
  const methodology = getChartMethodology(run.methodologyVersion ?? "top_songs_weighted_v1");
  const eligibilityProfile = getEligibilityProfile(run.eligibilityProfileId ?? "elig_all_artists") ?? getEligibilityProfile("elig_all_artists");
  const validateStage: IngestStageStatus = { stage: "validate", status: eligibilityProfile ? "done" : "failed", durationMs: 80 + Math.floor(Math.random() * 60), startedAt: new Date().toISOString(), finishedAt: new Date(Date.now() + 100).toISOString(), message: eligibilityProfile ? `Source URLs and eligibility profile ${eligibilityProfile.id} validated` : `Eligibility profile ${run.eligibilityProfileId} was not found` };
  if (!eligibilityProfile) {
    await updateIngestRun(runId, (current) => ({ ...current, status: "failed", stages: [validateStage, ...getInitialStages().filter((stage) => stage.stage !== "validate")], errorMessage: validateStage.message, updatedAt: new Date().toISOString() }));
    return;
  }
  const providers = sourceUrls.map(detectProviderFromUrl).filter((p) => p !== "unknown");
  const providerDetectionStage: IngestStageStatus = { stage: "provider_detection", status: providers.length > 0 ? "done" : "warning", durationMs: 60 + Math.floor(Math.random() * 40), message: providers.length > 0 ? `Detected ${providers.join(", ")}` : "No supported providers detected", metrics: { providers } };
  const resourceGuardStage: IngestStageStatus = { stage: "resource_guard", status: "done", durationMs: 100 + Math.floor(Math.random() * 100), message: `Estimated ${sourceUrls.length * chartSize} rows`, metrics: { sourceCount: sourceUrls.length, chartSize, eligibilityProfileId: eligibilityProfile.id, marketScopeId: run.marketScopeId ?? null, methodologyVersion: methodology.version } };

  const startedFetch = Date.now();
  const fetched = await fetchFromAllSources(sourceUrls, { chartSize, market });
  const sourceFetchStage: IngestStageStatus = { stage: "source_fetch", status: fetched.overallError ? "warning" : "done", durationMs: Date.now() - startedFetch, message: fetched.overallError ?? `Fetched ${fetched.overallMetrics.totalFetched} rows from ${fetched.sourceResults.length} source(s)`, metrics: { totalRows: fetched.overallMetrics.totalFetched, providers: fetched.sourceResults.map((r) => r.provider), warnings: fetched.sourceResults.flatMap((r) => r.warnings ?? []) } };

  const startedNormalize = Date.now();
  const normalizeResult = normalizeToResolvedRows(fetched.allNormalizedRows);
  const normalizeStage: IngestStageStatus = { stage: "normalize", status: normalizeResult.resolvedRows.length > 0 ? "done" : "warning", durationMs: Date.now() - startedNormalize, message: `Normalized ${normalizeResult.resolvedRows.length} rows with rich metadata`, metrics: { rows: normalizeResult.resolvedRows.length, richMetadataRows: normalizeResult.summary.richMetadataRows, artistCreditRows: normalizeResult.summary.artistCreditRows } };

  const startedMatch = Date.now();
  const matchResult = runCanonicalMatch(fetched.allNormalizedRows);
  let rows: IngestResolvedRow[] = matchResult.resolvedRows.map((matchedRow) => {
    const normalizedRow = normalizeResult.resolvedRows.find((row) => row.id === matchedRow.id) ?? normalizeResult.resolvedRows.find((row) => row.rank === matchedRow.rank && row.title === matchedRow.title);
    return normalizedRow ? { ...matchedRow, raw: { ...rawObject(normalizedRow), ...rawObject(matchedRow) } } : matchedRow;
  });
  let summary: IngestRunSummary = summarizeRows(rows, methodology.version);
  const canonicalMatchStage: IngestStageStatus = { stage: "canonical_match", status: summary.gaps > 0 ? "warning" : "done", durationMs: Date.now() - startedMatch, message: `${summary.canonicalMatches}/${summary.totalRows} canonical matches`, metrics: { matchRate: summary.matchRate, gaps: summary.gaps } };

  const startedEnrich = Date.now();
  const enriched = await enrichRows(rows);
  const enrichedMap = new Map(enriched.results.map((r) => [r.rowId, r]));
  rows = rows.map((row) => { const result = enrichedMap.get(row.id); if (!result) return row; return applyEnrichmentToRow(row, result.enriched); });
  const credentialErrors = checkEnrichmentCredentials();
  const totalProviderHits = enriched.metrics.spotifyHits + enriched.metrics.appleMusicHits + enriched.metrics.youtubeHits + enriched.metrics.acrCloudHits;
  const enrichmentStage: IngestStageStatus = { stage: "enrichment", status: credentialErrors.length > 0 ? "warning" : "done", durationMs: Date.now() - startedEnrich, message: credentialErrors.length > 0 ? `Enrichment completed with ${credentialErrors.length} credential warning(s)` : "Enrichment completed", metrics: { providerHits: totalProviderHits, credentialErrors: credentialErrors.length } };

  const startedResolution = Date.now();
  const registry = createSeedEntityResolutionRegistry(rows);
  const entityResolution = applyEntityResolutionToRows(rows, registry);
  rows = entityResolution.rows;
  const entityResolutionStage: IngestStageStatus = { stage: "entity_resolution", status: entityResolution.metrics.needsReview > 0 || entityResolution.metrics.shellCreated > 0 || entityResolution.metrics.duplicateCandidate > 0 ? "warning" : "done", durationMs: Date.now() - startedResolution, message: `${entityResolution.metrics.resolved}/${entityResolution.metrics.total} rows resolved across track, release, artist and label entities`, metrics: entityResolution.metrics };

  const startedEligibility = Date.now();
  const eligibility = executeEligibility(rows, { runId, market, profile: eligibilityProfile });
  rows = eligibility.eligibleRows;
  const eligibilityStage: IngestStageStatus = { stage: "eligibility_execution", status: eligibility.metrics.excludedRows > 0 || eligibility.metrics.reviewRows > 0 ? "warning" : "done", durationMs: Date.now() - startedEligibility, message: `${eligibility.metrics.eligibleRows}/${eligibility.metrics.totalRows} rows passed ${eligibilityProfile.name}`, metrics: eligibility.metrics };

  const startedScoring = Date.now();
  rows = scoreAndRankRows(rows, { chartSize, editionDate: run.editionDate, market }, methodology).slice(0, chartSize);
  summary = summarizeRows(rows, methodology.version, eligibility.metrics, entityResolution.metrics);
  const scoringStage: IngestStageStatus = { stage: "methodology_scoring", status: "done", durationMs: Date.now() - startedScoring, message: `Scored ${rows.length} rows using ${methodology.name}`, metrics: { methodologyVersion: methodology.version, averageScore: summary.averageMethodologyScore ?? 0, formula: methodology.formula.plainText } };

  const intelligenceRows = [...entityResolution.rows, ...eligibility.allRows];
  const rowIntelligence = buildRowIntelligence(intelligenceRows, eligibility.excludedRows);
  const needsReview = summary.gaps > 0 || eligibility.metrics.reviewRows > 0 || entityResolution.metrics.needsReview > 0 || entityResolution.metrics.shellCreated > 0 || entityResolution.metrics.duplicateCandidate > 0;
  const finalStages = [validateStage, providerDetectionStage, resourceGuardStage, sourceFetchStage, normalizeStage, canonicalMatchStage, enrichmentStage, entityResolutionStage, eligibilityStage, scoringStage, { stage: "snapshot_commit" as const, status: "idle" as const, message: "Ready for commit" }];
  await updateIngestRun(runId, (current) => ({ ...current, methodologyVersion: methodology.version, status: needsReview ? "needs_review" : "dry_run_complete", stages: finalStages, summary, rows, excludedRows: eligibility.excludedRows, rowIntelligence, updatedAt: new Date().toISOString(), dryRunCompletedAt: new Date().toISOString() }));
  addIngestActivity({ id: `act-${Date.now()}`, type: "dry_run", chartTitle: run.chartTitle, runId, status: needsReview ? "needs_review" : "dry_run_complete", actor: "Current User", createdAt: new Date().toISOString(), summary });
}

export async function commitIngestRun(request: CommitIngestRunRequest): Promise<CommitIngestRunResponse> { const run = await getIngestRun(request.runId); return commitIngestRunToV2Edition(run, request, true); }
export function validateRunReadiness(runId: string) { const run = getStudioStore().runs.find((r) => r.id === runId); return validateCommitReadiness(run ?? null); }
export async function cancelIngestRun(runId: string): Promise<IngestRun | null> { return updateIngestRun(runId, (run) => ({ ...run, status: "cancelled", updatedAt: new Date().toISOString(), errorMessage: "Run cancelled by admin" })); }
export async function retryIngestRun(runId: string): Promise<IngestRun | null> { const run = await updateIngestRun(runId, (r) => ({ ...r, status: "running", stages: getInitialStages(), errorMessage: null, updatedAt: new Date().toISOString() })); if (run) await simulateStageProgress(runId); return getIngestRun(runId); }
export async function sendGapsToReview(runId: string): Promise<IngestRun | null> { return updateIngestRun(runId, (run) => ({ ...run, status: "needs_review", updatedAt: new Date().toISOString(), notes: `${run.notes ?? ""}\nGaps sent to review queue at ${new Date().toISOString()}` })); }
export async function applyRowMatchDecision(runId: string, rowId: string, action: string, canonicalTrackId?: string): Promise<IngestRun | null> { return updateIngestRun(runId, (run) => ({ ...run, rows: run.rows.map((row) => row.id === rowId ? { ...row, matchStatus: action === "accept_canonical" || action === "attach_existing" ? "canonical" : action === "create_shell" ? "shell" : action === "mark_duplicate" ? "duplicate_candidate" : row.matchStatus, canonicalTrackId: canonicalTrackId ?? row.canonicalTrackId, confidence: action === "accept_canonical" ? Math.max(row.confidence, 90) : row.confidence, warnings: [...(row.warnings ?? []), `Decision applied: ${action}`] } : row), updatedAt: new Date().toISOString() })); }
