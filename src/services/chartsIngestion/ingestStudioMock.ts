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
import { fetchFromAllSources } from "./providerFetch";
import { normalizeToResolvedRows } from "./normalize";
import { detectProviderFromUrl } from "./providerDetection";
import { runCanonicalMatch } from "./canonicalMatch";
import { enrichRows, applyEnrichmentToRow, checkEnrichmentCredentials } from "./enrichment";
import { commitIngestRunToV2Edition, validateCommitReadiness } from "./commitService";

const STUDIO_STORE_KEY = "wkcharts_ingest_studio_v1";

const mockResolvedRows: IngestResolvedRow[] = [
  { id: "row-001", rank: 1, previousRank: 3, movement: "up", sourceProvider: "spotify", sourceUrl: "https://open.spotify.com/playlist/top40", title: "Ojuelegba", artistNames: ["WizKid"], artworkUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop", matchStatus: "canonical", confidence: 98, canonicalTrackId: "track-wiz-001", canonicalReleaseId: "release-wiz-001", canonicalArtistIds: ["artist-wiz-001"], warnings: [] },
  { id: "row-002", rank: 2, previousRank: 1, movement: "down", sourceProvider: "apple_music", sourceUrl: "https://music.apple.com/ug/playlist/top40", title: "Last Last", artistNames: ["Burna Boy"], artworkUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop", matchStatus: "canonical", confidence: 97, canonicalTrackId: "track-burna-001", canonicalReleaseId: "release-burna-001", canonicalArtistIds: ["artist-burna-001"], warnings: [] },
  { id: "row-003", rank: 3, previousRank: null, movement: "new", sourceProvider: "spotify", sourceUrl: "https://open.spotify.com/playlist/top40", title: "Essence", artistNames: ["WizKid", "Tems"], artworkUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop", matchStatus: "canonical", confidence: 95, canonicalTrackId: "track-wiz-002", canonicalReleaseId: "release-wiz-002", canonicalArtistIds: ["artist-wiz-001", "artist-tems-001"], warnings: [] },
  { id: "row-004", rank: 4, previousRank: 4, movement: "same", sourceProvider: "apple_music", sourceUrl: "https://music.apple.com/ug/playlist/top40", title: "Rush", artistNames: ["Ayra Starr"], artworkUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop", matchStatus: "canonical", confidence: 96, canonicalTrackId: "track-ayra-001", canonicalReleaseId: "release-ayra-001", canonicalArtistIds: ["artist-ayra-001"], warnings: [] },
  { id: "row-005", rank: 5, previousRank: 7, movement: "up", sourceProvider: "spotify", sourceUrl: "https://open.spotify.com/playlist/top40", title: "Calm Down", artistNames: ["Rema"], artworkUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=200&h=200&fit=crop", matchStatus: "shell", confidence: 72, canonicalTrackId: null, canonicalReleaseId: null, canonicalArtistIds: [], releaseShellId: "shell-rema-001", warnings: ["Low confidence — release shell created"] },
  { id: "row-006", rank: 6, previousRank: 12, movement: "up", sourceProvider: "spotify", sourceUrl: "https://open.spotify.com/playlist/top40", title: "Sability", artistNames: ["Yemi Alade"], artworkUrl: null, matchStatus: "no_match", confidence: 0, canonicalTrackId: null, canonicalReleaseId: null, canonicalArtistIds: [], warnings: ["No canonical match found — needs review"] },
  { id: "row-007", rank: 7, previousRank: 5, movement: "down", sourceProvider: "apple_music", sourceUrl: "https://music.apple.com/ug/playlist/top40", title: "Buga", artistNames: ["Kizz Daniel", "Tekno"], artworkUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop", matchStatus: "canonical", confidence: 94, canonicalTrackId: "track-kizz-001", canonicalReleaseId: "release-kizz-001", canonicalArtistIds: ["artist-kizz-001", "artist-tekno-001"], warnings: [] },
  { id: "row-008", rank: 8, previousRank: 6, movement: "down", sourceProvider: "spotify", sourceUrl: "https://open.spotify.com/playlist/top40", title: "Gwagwalada", artistNames: ["Bnxn", "Kizz Daniel", "Seyi Vibez"], artworkUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop", matchStatus: "needs_review", confidence: 55, canonicalTrackId: null, canonicalReleaseId: null, canonicalArtistIds: [], warnings: ["Ambiguous match — multiple possible canonical tracks"] },
  { id: "row-009", rank: 9, previousRank: 9, movement: "same", sourceProvider: "apple_music", sourceUrl: "https://music.apple.com/ug/playlist/top40", title: "Terminator", artistNames: ["King Promise"], artworkUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop", matchStatus: "canonical", confidence: 93, canonicalTrackId: "track-king-001", canonicalReleaseId: "release-king-001", canonicalArtistIds: ["artist-king-001"], warnings: [] },
  { id: "row-010", rank: 10, previousRank: null, movement: "new", sourceProvider: "spotify", sourceUrl: "https://open.spotify.com/playlist/top40", title: "Unavailable", artistNames: ["Davido"], artworkUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=200&h=200&fit=crop", matchStatus: "duplicate_candidate", confidence: 88, canonicalTrackId: "track-davido-001", canonicalReleaseId: null, canonicalArtistIds: ["artist-davido-001"], warnings: ["Possible duplicate of existing chart entry"] },
];

const mockSummary: IngestRunSummary = {
  totalRows: mockResolvedRows.length,
  canonicalMatches: mockResolvedRows.filter((r) => r.matchStatus === "canonical").length,
  shells: mockResolvedRows.filter((r) => r.matchStatus === "shell").length,
  gaps: mockResolvedRows.filter((r) => r.matchStatus === "no_match" || r.matchStatus === "needs_review").length,
  duplicateCandidates: mockResolvedRows.filter((r) => r.matchStatus === "duplicate_candidate").length,
  matchRate: 70,
};

function getInitialStages(): IngestStageStatus[] {
  return ["validate", "provider_detection", "resource_guard", "source_fetch", "normalize", "canonical_match", "enrichment", "snapshot_commit"].map((stage) => ({ stage: stage as IngestStageStatus["stage"], status: "idle" }));
}
function getDryRunCompleteStages(): IngestStageStatus[] { return getInitialStages().map((s) => ({ ...s, status: s.stage === "snapshot_commit" ? "idle" : "done", durationMs: 1000 + Math.floor(Math.random() * 4000) })); }
function getCommittedStages(): IngestStageStatus[] { return getInitialStages().map((s) => ({ ...s, status: "done", durationMs: 1000 + Math.floor(Math.random() * 4000) })); }
function getRunningStages(): IngestStageStatus[] { return getInitialStages().map((s, i) => ({ ...s, status: i < 3 ? "done" : i === 3 ? "running" : "idle", durationMs: i < 3 ? 500 : undefined })); }

const mockRuns: IngestRun[] = [
  { id: "run-001", chartTitle: "WAKILISHA Top 40 — Week 22, 2026", chartSlug: "wakilisha-top-40-week-22-2026", editionDate: "2026-05-30", chartSize: 40, market: "KE", chartKind: "tracks", coverStyle: "default", sourceUrls: ["https://open.spotify.com/playlist/37i9dQZF1DXc2aWXf7eND5", "https://music.apple.com/ug/playlist/afrobeats-2026/pl.123456789"], detectedProviders: ["spotify", "apple_music"], saveAsRecurringSeries: true, existingSeriesId: "series-top-40", eligibilityProfileId: "elig_all_artists", status: "dry_run_complete", stages: getDryRunCompleteStages(), summary: mockSummary, rows: mockResolvedRows, createdBy: "James", createdAt: "2026-05-30T10:00:00Z", updatedAt: "2026-05-30T10:15:00Z", dryRunCompletedAt: "2026-05-30T10:15:00Z", committedAt: null, editionId: null, editionSlug: null, snapshotId: null, notes: "", errorMessage: null },
  { id: "run-002", chartTitle: "WAKILISHA Top 100 — Week 22, 2026", chartSlug: "wakilisha-top-100-week-22-2026", editionDate: "2026-05-30", chartSize: 100, market: "KE", chartKind: "tracks", coverStyle: "default", sourceUrls: ["https://open.spotify.com/playlist/37i9dQZF1DXc2aWXf7eND5", "https://music.apple.com/ug/playlist/top-100/pl.123456789"], detectedProviders: ["spotify", "apple_music"], saveAsRecurringSeries: true, existingSeriesId: "series-top-100", eligibilityProfileId: "elig_kenyan_artists_only", status: "committed", stages: getCommittedStages(), summary: { totalRows: 847, canonicalMatches: 781, shells: 32, gaps: 20, duplicateCandidates: 14, matchRate: 92.2 }, rows: mockResolvedRows, createdBy: "Sarah", createdAt: "2026-05-30T09:30:00Z", updatedAt: "2026-05-30T12:30:00Z", dryRunCompletedAt: "2026-05-30T10:00:00Z", committedAt: "2026-05-30T12:30:00Z", editionId: "ed-2026-w22", editionSlug: "2026-week-22", snapshotId: "snap-2026-w22", notes: "Published immediately after commit", errorMessage: null },
  { id: "run-003", chartTitle: "WAKILISHA Top 40 — Week 21, 2026", chartSlug: "wakilisha-top-40-week-21-2026", editionDate: "2026-05-23", chartSize: 40, market: "KE", chartKind: "tracks", coverStyle: "default", sourceUrls: ["https://open.spotify.com/playlist/37i9dQZF1DXc2aWXf7eND5", "https://music.apple.com/ug/playlist/afrobeats-2026/pl.123456789"], detectedProviders: ["spotify", "apple_music"], saveAsRecurringSeries: true, existingSeriesId: "series-top-40", eligibilityProfileId: "elig_all_artists", status: "committed", stages: getCommittedStages(), summary: { totalRows: 398, canonicalMatches: 356, shells: 22, gaps: 16, duplicateCandidates: 4, matchRate: 89.4 }, rows: mockResolvedRows, createdBy: "James", createdAt: "2026-05-23T10:00:00Z", updatedAt: "2026-05-23T12:15:00Z", dryRunCompletedAt: "2026-05-23T10:45:00Z", committedAt: "2026-05-23T12:15:00Z", editionId: "ed-2026-w21", editionSlug: "2026-week-21", snapshotId: "snap-2026-w21", notes: "", errorMessage: null },
  { id: "run-004", chartTitle: "Afrobeats Top 20 — Week 22, 2026", chartSlug: "afrobeats-top-20-week-22-2026", editionDate: "2026-05-30", chartSize: 20, market: "KE", chartKind: "tracks", coverStyle: "genre", sourceUrls: ["https://open.spotify.com/playlist/afrobeats"], detectedProviders: ["spotify"], saveAsRecurringSeries: true, existingSeriesId: "series-afrobeats-20", eligibilityProfileId: "elig_all_artists", status: "failed", stages: [{ stage: "validate", status: "done", durationMs: 100 }, { stage: "provider_detection", status: "done", durationMs: 60 }, { stage: "resource_guard", status: "done", durationMs: 120 }, { stage: "source_fetch", status: "failed", durationMs: 5000, message: "Spotify API rate limit exceeded" }, { stage: "normalize", status: "idle" }, { stage: "canonical_match", status: "idle" }, { stage: "enrichment", status: "idle" }, { stage: "snapshot_commit", status: "idle" }], summary: { totalRows: 0, canonicalMatches: 0, shells: 0, gaps: 0, duplicateCandidates: 0, matchRate: 0 }, rows: [], createdBy: "Michael", createdAt: "2026-05-30T08:30:00Z", updatedAt: "2026-05-30T08:45:00Z", dryRunCompletedAt: null, committedAt: null, editionId: null, editionSlug: null, snapshotId: null, notes: "", errorMessage: "Spotify API rate limit exceeded during source fetch. Retry after 15 minutes." },
  { id: "run-005", chartTitle: "WAKILISHA Top 40 — Week 23, 2026", chartSlug: "wakilisha-top-40-week-23-2026", editionDate: "2026-06-06", chartSize: 40, market: "KE", chartKind: "tracks", coverStyle: "default", sourceUrls: ["https://open.spotify.com/playlist/37i9dQZF1DXc2aWXf7eND5", "https://music.apple.com/ug/playlist/afrobeats-2026/pl.123456789"], detectedProviders: ["spotify", "apple_music"], saveAsRecurringSeries: true, existingSeriesId: "series-top-40", eligibilityProfileId: "elig_kenyan_artists_only", status: "running", stages: getRunningStages(), summary: { totalRows: 0, canonicalMatches: 0, shells: 0, gaps: 0, duplicateCandidates: 0, matchRate: 0 }, rows: [], createdBy: "James", createdAt: "2026-05-31T09:00:00Z", updatedAt: "2026-05-31T09:00:30Z", dryRunCompletedAt: null, committedAt: null, editionId: null, editionSlug: null, snapshotId: null, notes: "", errorMessage: null },
];
const mockIngestKpis: IngestStudioKpi = { editionsThisWeek: 3, canonicalMatchRate: 88.7, rowsAwaitingReview: 36, averageRunTimeMs: 18500 };
const mockRecentActivity: RecentIngestActivity[] = [
  { id: "act-001", type: "commit", chartTitle: "WAKILISHA Top 100 — Week 22", runId: "run-002", status: "committed", actor: "Sarah", createdAt: "2026-05-30T12:30:00Z", summary: mockRuns[1].summary },
  { id: "act-002", type: "dry_run", chartTitle: "WAKILISHA Top 40 — Week 22", runId: "run-001", status: "dry_run_complete", actor: "James", createdAt: "2026-05-30T10:15:00Z", summary: mockRuns[0].summary },
  { id: "act-003", type: "retry", chartTitle: "Afrobeats Top 20 — Week 22", runId: "run-004", status: "failed", actor: "Michael", createdAt: "2026-05-30T08:45:00Z" },
];
interface StudioStore { runs: IngestRun[]; kpis: IngestStudioKpi; activity: RecentIngestActivity[]; }
function getInitialStudioStore(): StudioStore { return { runs: [...mockRuns], kpis: { ...mockIngestKpis }, activity: [...mockRecentActivity] }; }
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
    marketScopeId: request.marketScopeId ?? null,
    marketScopeSnapshot: request.marketScopeSnapshot ?? null,
    enrichmentOptions: request.enrichmentOptions ?? null,
    status: "running",
    stages: getInitialStages(),
    summary: { totalRows: 0, canonicalMatches: 0, shells: 0, gaps: 0, duplicateCandidates: 0, matchRate: 0 },
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
  const validateStage: IngestStageStatus = { stage: "validate", status: "done", durationMs: 80 + Math.floor(Math.random() * 60), startedAt: new Date().toISOString(), finishedAt: new Date(Date.now() + 100).toISOString(), message: run.eligibilityProfileId ? `Source URLs and eligibility profile ${run.eligibilityProfileId} validated` : "Source URLs validated" };
  const providers = sourceUrls.map(detectProviderFromUrl).filter((p) => p !== "unknown");
  const providerDetectionStage: IngestStageStatus = { stage: "provider_detection", status: providers.length > 0 ? "done" : "warning", durationMs: 60 + Math.floor(Math.random() * 40), message: providers.length > 0 ? `Detected ${providers.join(", ")}` : "No supported providers detected", metrics: { providers } };
  const resourceGuardStage: IngestStageStatus = { stage: "resource_guard", status: "done", durationMs: 100 + Math.floor(Math.random() * 100), message: `Estimated ${sourceUrls.length * chartSize} rows`, metrics: { sourceCount: sourceUrls.length, chartSize, eligibilityProfileId: run.eligibilityProfileId ?? "elig_all_artists", marketScopeId: run.marketScopeId ?? null } };
  let rows: IngestResolvedRow[] = [];
  const startedFetch = Date.now();
  const fetched = await fetchFromAllSources(sourceUrls, { chartSize, market });
  const sourceFetchStage: IngestStageStatus = { stage: "source_fetch", status: fetched.overallError ? "warning" : "done", durationMs: Date.now() - startedFetch, message: fetched.overallError ?? `Fetched ${fetched.overallMetrics.totalFetched} rows from ${fetched.sourceResults.length} source(s)`, metrics: { totalRows: fetched.overallMetrics.totalFetched, providers: fetched.sourceResults.map((r) => r.provider), warnings: fetched.sourceResults.flatMap((r) => r.warnings ?? []) } };
  const fetchedRows = fetched.allNormalizedRows;
  const startedNormalize = Date.now();
  const normalizeResult = normalizeToResolvedRows(fetchedRows);
  const normalizeStage: IngestStageStatus = { stage: "normalize", status: normalizeResult.resolvedRows.length > 0 ? "done" : "warning", durationMs: Date.now() - startedNormalize, message: `Normalized ${normalizeResult.resolvedRows.length} rows`, metrics: { rows: normalizeResult.resolvedRows.length } };
  const startedMatch = Date.now();
  const matchResult = runCanonicalMatch(fetchedRows);
  rows = matchResult.resolvedRows;
  const summary: IngestRunSummary = { totalRows: rows.length, canonicalMatches: rows.filter((r) => r.matchStatus === "canonical").length, shells: rows.filter((r) => r.matchStatus === "shell").length, gaps: rows.filter((r) => r.matchStatus === "no_match" || r.matchStatus === "needs_review").length, duplicateCandidates: rows.filter((r) => r.matchStatus === "duplicate_candidate").length, matchRate: rows.length ? (rows.filter((r) => r.matchStatus === "canonical").length / rows.length) * 100 : 0 };
  const canonicalMatchStage: IngestStageStatus = { stage: "canonical_match", status: summary.gaps > 0 ? "warning" : "done", durationMs: Date.now() - startedMatch, message: `${summary.canonicalMatches}/${summary.totalRows} canonical matches`, metrics: { matchRate: summary.matchRate, gaps: summary.gaps } };
  const startedEnrich = Date.now();
  const enriched = await enrichRows(rows);
  const enrichedMap = new Map(enriched.results.map((r) => [r.rowId, r]));
  rows = rows.map((row) => { const result = enrichedMap.get(row.id); if (!result) return row; return applyEnrichmentToRow(row, result.enriched); });
  const credentialErrors = checkEnrichmentCredentials();
  const totalProviderHits = enriched.metrics.spotifyHits + enriched.metrics.appleMusicHits + enriched.metrics.youtubeHits + enriched.metrics.acrCloudHits;
  const enrichmentStage: IngestStageStatus = { stage: "enrichment", status: credentialErrors.length > 0 ? "warning" : "done", durationMs: Date.now() - startedEnrich, message: credentialErrors.length > 0 ? `Enrichment completed with ${credentialErrors.length} credential warning(s)` : "Enrichment completed", metrics: { providerHits: totalProviderHits, credentialErrors: credentialErrors.length } };
  const finalStages = [validateStage, providerDetectionStage, resourceGuardStage, sourceFetchStage, normalizeStage, canonicalMatchStage, enrichmentStage, { stage: "snapshot_commit" as const, status: "idle" as const, message: "Ready for commit" }];
  await updateIngestRun(runId, (current) => ({ ...current, status: summary.gaps > 0 ? "needs_review" : "dry_run_complete", stages: finalStages, summary, rows: rows.slice(0, chartSize), updatedAt: new Date().toISOString(), dryRunCompletedAt: new Date().toISOString() }));
  addIngestActivity({ id: `act-${Date.now()}`, type: "dry_run", chartTitle: run.chartTitle, runId, status: summary.gaps > 0 ? "needs_review" : "dry_run_complete", actor: "Current User", createdAt: new Date().toISOString(), summary });
}

export async function commitIngestRun(request: CommitIngestRunRequest): Promise<CommitIngestRunResponse> { const run = await getIngestRun(request.runId); return commitIngestRunToV2Edition(run, request, true); }
export function validateRunReadiness(runId: string) { const run = getStudioStore().runs.find((r) => r.id === runId); return validateCommitReadiness(run ?? null); }
export async function cancelIngestRun(runId: string): Promise<IngestRun | null> { return updateIngestRun(runId, (run) => ({ ...run, status: "cancelled", updatedAt: new Date().toISOString(), errorMessage: "Run cancelled by admin" })); }
export async function retryIngestRun(runId: string): Promise<IngestRun | null> { const run = await updateIngestRun(runId, (r) => ({ ...r, status: "running", stages: getInitialStages(), errorMessage: null, updatedAt: new Date().toISOString() })); if (run) await simulateStageProgress(runId); return getIngestRun(runId); }
export async function sendGapsToReview(runId: string): Promise<IngestRun | null> { return updateIngestRun(runId, (run) => ({ ...run, status: "needs_review", updatedAt: new Date().toISOString(), notes: `${run.notes ?? ""}\nGaps sent to review queue at ${new Date().toISOString()}` })); }
export async function applyRowMatchDecision(runId: string, rowId: string, action: string, canonicalTrackId?: string): Promise<IngestRun | null> { return updateIngestRun(runId, (run) => ({ ...run, rows: run.rows.map((row) => row.id === rowId ? { ...row, matchStatus: action === "accept_canonical" || action === "attach_existing" ? "canonical" : action === "create_shell" ? "shell" : action === "mark_duplicate" ? "duplicate_candidate" : row.matchStatus, canonicalTrackId: canonicalTrackId ?? row.canonicalTrackId, confidence: action === "accept_canonical" ? Math.max(row.confidence, 90) : row.confidence, warnings: [...(row.warnings ?? []), `Decision applied: ${action}`] } : row), updatedAt: new Date().toISOString() })); }
