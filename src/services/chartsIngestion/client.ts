/**
 * Chart Ingestion Client Adapter
 * Single boundary between the React app and the chart ingestion backend.
 *
 * All mock paths have been removed. Both the legacy ingest-studio UI and the
 * new production pipeline now call real Supabase tables via their respective
 * adapters.
 */

import * as realLegacyAdapter from "./realLegacyAdapter";
import * as productionAdapter from "./productionAdapter";
import {
  detectProvidersFromUrls,
  isValidProviderUrl,
} from "./providerDetection";
import { getEligibilityProfile } from "../chartsEligibility/eligibilityStore";

export type IngestionMode = "production";

export const CHARTS_INGESTION_MODE: IngestionMode = "production";

export function getIngestionMode(): IngestionMode {
  return CHARTS_INGESTION_MODE;
}

export function setIngestionMode(_mode: IngestionMode): void {
  // No-op — mode is always production
}

const adapter = realLegacyAdapter;
const ingestStudioAdapter = productionAdapter;

export type EndpointStatus = "not_configured" | "planned" | "local" | "ready" | "deprecated";

export interface EndpointDefinition {
  key: string;
  frontendFunction: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  status: EndpointStatus;
  tables: string[];
  expectedResponse: string[];
  description: string;
  payloadExample: Record<string, unknown>;
  responseExample: Record<string, unknown>;
  capabilities: string[];
}

export interface IngestStudioEndpointDef extends EndpointDefinition {
  group: string;
}

export const RUNTIME_CHART_ENDPOINTS: Record<string, EndpointDefinition> = {
  getChartFamilies: {
    key: "getChartFamilies",
    frontendFunction: "getChartFamilies()",
    method: "GET",
    path: "/api/charts/families",
    status: "ready",
    tables: ["wk_chart_programs_v2"],
    expectedResponse: ["id", "familyKey", "label", "defaultChartSize", "editionFrequency"],
    description: "Retrieve all chart programs/families from the runtime backend.",
    payloadExample: {},
    responseExample: { families: [{ id: "program_kenya_kenya", label: "Top 100 Songs in Kenya", defaultChartSize: 100 }] },
    capabilities: ["read_wakilisha_charts"],
  },
  runDryRun: {
    key: "runDryRun",
    frontendFunction: "runDryRun(request)",
    method: "POST",
    path: "/api/charts/ingest/dry-run",
    status: "ready",
    tables: ["chart_ingest_runs", "chart_ingest_run_sources", "chart_ingest_candidates"],
    expectedResponse: ["runId", "status", "stages", "summary", "rows"],
    description: "Execute a provider-backed chart dry run in the runtime backend.",
    payloadExample: { chartTitle: "Top Songs Kenya", sourceUrls: [], marketScopeId: "scope_kenya" },
    responseExample: { runId: "run-001", status: "dry_run_complete" },
    capabilities: ["create_wakilisha_charts"],
  },
  commitIngestRun: {
    key: "commitIngestRun",
    frontendFunction: "commitIngestRun(request)",
    method: "POST",
    path: "/api/charts/ingest/runs/{runId}/commit",
    status: "ready",
    tables: ["wk_chart_editions_v2", "wk_chart_entries_v2", "chart_ingest_runs"],
    expectedResponse: ["runId", "editionId", "status", "integrity"],
    description: "Commit a dry run into a real edition and audit trail.",
    payloadExample: { runId: "run-001", publishImmediately: false },
    responseExample: { runId: "run-001", editionId: "ed-001", status: "committed" },
    capabilities: ["publish_wakilisha_charts"],
  },
};

export const WORDPRESS_CHART_ENDPOINTS = RUNTIME_CHART_ENDPOINTS;
export const WP_API_BASE = "/legacy-import-only/wordpress-runtime-disabled";
export const API_BASE = "/api/v1";

function withGroup(endpoint: EndpointDefinition, group: string): IngestStudioEndpointDef {
  return { ...endpoint, group };
}

export const INGEST_STUDIO_WP_ENDPOINTS: IngestStudioEndpointDef[] = [
  withGroup(
    {
      key: "getIngestRuns",
      frontendFunction: "getIngestRuns()",
      method: "GET",
      path: "/api/charts/ingest/runs",
      status: "ready",
      tables: ["chart_ingest_runs"],
      expectedResponse: ["runs"],
      description: "List all provider-based ingest runs.",
      payloadExample: {},
      responseExample: { runs: [{ id: "run-001", status: "dry_run_complete" }] },
      capabilities: ["read_wakilisha_charts"],
    },
    "Ingest Studio Runtime API"
  ),
  withGroup(RUNTIME_CHART_ENDPOINTS.runDryRun, "Ingest Studio Runtime API"),
  withGroup(RUNTIME_CHART_ENDPOINTS.commitIngestRun, "Ingest Studio Runtime API"),
];

export async function testWordPressConnection(): Promise<{ ok: boolean; plugin: string; charts_ingestion: boolean; version: string }> {
  return {
    ok: false,
    plugin: "wordpress-runtime-disabled",
    charts_ingestion: false,
    version: "legacy-import-only",
  };
}

export async function testAPIConnection(): Promise<{ ok: boolean; plugin: string; charts_ingestion: boolean; version: string }> {
  return testWordPressConnection();
}

function getEndpointStatus(fnName: string): EndpointStatus {
  const cleanName = fnName.replace(/\([^)]*\)/g, "").trim();
  const allExports = [adapter, productionAdapter];
  const hasFunction = allExports.some((candidate) => typeof (candidate as Record<string, unknown>)[cleanName] === "function");
  if (typeof (productionAdapter as Record<string, unknown>)[cleanName] === "function") return "ready";
  if (hasFunction) return "ready";
  return "planned";
}

export function getEndpointDefinitions(): EndpointDefinition[] {
  return Object.values(RUNTIME_CHART_ENDPOINTS).map((endpoint) => ({ ...endpoint, status: getEndpointStatus(endpoint.frontendFunction) }));
}

export function getEndpointByKey(key: string): EndpointDefinition | undefined {
  return RUNTIME_CHART_ENDPOINTS[key];
}

export function getEndpointGroups(): Record<string, EndpointDefinition[]> {
  return {
    "Runtime API Contract": getEndpointDefinitions(),
  };
}

export function getIngestStudioEndpointGroups(): Record<string, EndpointDefinition[]> {
  return {
    "Ingest Studio Runtime API": INGEST_STUDIO_WP_ENDPOINTS.map((endpoint) => ({ ...endpoint, status: getEndpointStatus(endpoint.frontendFunction) })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Production pipeline (new 21-stage ingest run system)
// ═══════════════════════════════════════════════════════════════════════════════

export const runDryRun: typeof ingestStudioAdapter.runDryRun = (request) => {
  const payload = request as Parameters<typeof ingestStudioAdapter.runDryRun>[0] & Record<string, unknown>;
  const profileId = typeof payload.eligibilityProfileId === "string" ? payload.eligibilityProfileId : "";
  const profile = profileId ? getEligibilityProfile(profileId) : null;
  const releaseEligibility = profile?.releaseEligibility;

  return ingestStudioAdapter.runDryRun({
    ...payload,
    eligibilityProfileSnapshot: payload.eligibilityProfileSnapshot ?? profile ?? null,
    releaseWindowStart: payload.releaseWindowStart ?? releaseEligibility?.releaseWindowFrom ?? null,
    releaseWindowEnd: payload.releaseWindowEnd ?? releaseEligibility?.releaseWindowTo ?? null,
  } as Parameters<typeof ingestStudioAdapter.runDryRun>[0]);
};
export const commitIngestRun = ingestStudioAdapter.commitIngestRun;
export const cancelIngestRun = ingestStudioAdapter.cancelIngestRun;
export const retryIngestRun = ingestStudioAdapter.retryIngestRun;
export const getIngestRuns = ingestStudioAdapter.getIngestRuns;
export const getIngestKpis = ingestStudioAdapter.getIngestKpis;
export const getRecentIngestActivity = ingestStudioAdapter.getRecentIngestActivity;
export const getResourceGuardStatus = ingestStudioAdapter.getResourceGuardStatus;
export const sendGapsToReview = ingestStudioAdapter.sendGapsToReview;
export const applyRowMatchDecision = ingestStudioAdapter.applyRowMatchDecision;
export const validateRunReadiness = ingestStudioAdapter.validateRunReadiness;
export const getReviewIssues = ingestStudioAdapter.getReviewIssues;
export const getMatchesForRun = ingestStudioAdapter.getMatchesForRun;
export const normalizeRun = ingestStudioAdapter.normalizeRun;
export const getNormalizedRows = ingestStudioAdapter.getNormalizedRows;
export const sourceFetch = ingestStudioAdapter.sourceFetch;
export const runEligibility = ingestStudioAdapter.runEligibility;
export const runCarryForward = ingestStudioAdapter.runCarryForward;
export const runScoring = ingestStudioAdapter.runScoring;
export const runShortlist = ingestStudioAdapter.runShortlist;
export const resetPipeline = ingestStudioAdapter.resetPipeline;
export const runFullPipeline = ingestStudioAdapter.runFullPipeline;
export const getOriginReviewQueue = ingestStudioAdapter.getOriginReviewQueue;
export const setArtistOriginForRun = ingestStudioAdapter.setArtistOriginForRun;
export const createOriginArtistShell = ingestStudioAdapter.createOriginArtistShell;
export const getOriginCountryOptions = ingestStudioAdapter.getOriginCountryOptions;
export const resetAfterOriginResolution = ingestStudioAdapter.resetAfterOriginResolution;
export const getChartBackfillPresets = ingestStudioAdapter.getChartBackfillPresets;
export const saveChartBackfillPreset = ingestStudioAdapter.saveChartBackfillPreset;
export const getWeeklyBackfillPlan = ingestStudioAdapter.getWeeklyBackfillPlan;
export type { ChartBackfillPreset, ChartBackfillPresetConfig, WeeklyBackfillPlanRow } from "./productionAdapter";
export type { OriginReviewQueueRow, OriginCountryOption } from "./productionAdapter";

// ═══════════════════════════════════════════════════════════════════════════════
// Legacy ingest studio (9-phase UI) — now backed by real DB tables
// ═══════════════════════════════════════════════════════════════════════════════

export const resetStore = adapter.resetStore;
export const resetDemo = adapter.resetDemo;
export const refreshStore = adapter.refreshStore;
export const getChartFamilies = adapter.getChartFamilies;
export const getIngestJobs = adapter.getIngestJobs;
export const getIngestJob = adapter.getIngestJob;
export const createIngestJob = adapter.createIngestJob;
export const updateJobStatusApi = adapter.updateJobStatusApi;
export const cancelJob = adapter.cancelJob;
export const retryJob = adapter.retryJob;
export const deleteJobApi = adapter.deleteJobApi;
export const getSources = adapter.getSources;
export const addSourceApi = adapter.addSourceApi;
export const removeSourceApi = adapter.removeSourceApi;
export const updateSourceWeight = adapter.updateSourceWeight;
export const toggleSourceEnabled = adapter.toggleSourceEnabled;
export const fetchSources = adapter.fetchSources;
export const getRawItems = adapter.getRawItems;
export const getCandidates = adapter.getCandidates;
export const getCandidateById = adapter.getCandidateById;
export const approveCandidate = adapter.approveCandidate;
export const excludeCandidate = adapter.excludeCandidate;
export const restoreCandidate = adapter.restoreCandidate;
export const getMatches = adapter.getMatches;
export const approveCandidateMatch = adapter.approveCandidateMatch;
export const rejectCandidateMatch = adapter.rejectCandidateMatch;
export const rematchCandidate = adapter.rematchCandidate;
export const markAsNewEntity = adapter.markAsNewEntity;
export const resolveReviewIssue = adapter.resolveReviewIssue;
export const reopenIssue = adapter.reopenIssue;
export const applyRankOverride = adapter.applyRankOverride;
export const clearRankOverride = adapter.clearRankOverride;
export const createDraftEdition = adapter.createDraftEdition;
export const publishEdition = adapter.publishEdition;
export const runPreflightCheck = adapter.runPreflightCheck;
export const getJobLogs = adapter.getJobLogs;
export const getDraftEntries = adapter.getDraftEntries;
export const getEditionsApi = adapter.getEditionsApi;
export const getEditionById = adapter.getEditionById;
export const getSnapshots = adapter.getSnapshots;
export const getDashboardKpisApi = adapter.getDashboardKpisApi;
export const getJobSummaryApi = adapter.getJobSummaryApi;
export const getDemoJobId = adapter.getDemoJobId;
export const searchCanonicalTracks = adapter.searchCanonicalTracks;
export const getDiscoveredCsvSources = adapter.getDiscoveredCsvSources;
export const getCsvImportSessions = adapter.getCsvImportSessions;

export type { UserRole } from "./roles";
export {
  ROLE_PERMISSIONS,
  getCurrentRole,
  setCurrentRole,
  hasCapability,
  getRoleLabel,
  getRoleDescription,
  getDisabledReason,
  ALL_ROLES,
} from "./roles";

// ─── Auto-restored chart admin barrel exports ───
export { validateCommitReadiness } from "./commitService";
export { getIngestRun, runPreflightCheck as preflight, validateRunReadinessAsync } from "./productionAdapter";
export { fixChartArtistSlugs, reingestEdition } from "./productionAdapter";
export type { FixArtistSlugsResult, ReingestEditionResult } from "./productionAdapter";
export { detectProvidersFromUrls, isValidProviderUrl } from "./providerDetection";
export { clearAllSimulations, getActiveSimulations, getLastErrorMessage, isSimulated, retry, simulate } from "./simulation";
export { getStepStatus } from "./workflow";

// ─── CSV operations — now backed by real adapter via chart-ingest-api edge function ───
export { attachCsvAsSource, normalizeCsvCandidates, csvUpload } from "./realLegacyAdapter";
// CSV functions that still process data client-side (validation, draft generation, JSON export)
export { validateCsvDraftIntegrity, createDraftFromCsvCandidates, exportDraftJson } from "./api";
export { appendJobLog, getStore } from "./store";

// ─── Re-export from contracts for runtime shape validation ───
export {
  assertIngestJobShape,
  assertSourceShape,
  assertCandidateShape,
  assertIssueShape,
  assertDraftEntryShape,
  assertSnapshotShape,
  assertChartEditionShape,
  assertChartFamilyShape,
  assertIngestJobArray,
  assertSourceArray,
  assertCandidateArray,
  assertIssueArray,
} from "./contracts";
export { getChartPlaybackReadiness } from "./playbackReadiness";
export type { ChartPlaybackReadiness, ChartPlaybackMissingRow } from "./playbackReadiness";
