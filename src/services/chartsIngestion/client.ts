/**
 * Chart Ingestion Client Adapter
 * Single boundary between the React app and the chart ingestion backend.
 *
 * Runtime WordPress ingestion support has been removed. WordPress is only allowed
 * as a legacy import source, not as the active ingestion/publishing backend.
 */

import * as mockAdapter from "./api";
import * as ingestStudioMock from "./ingestStudioMock";
import {
  detectProvidersFromUrls,
  isValidProviderUrl,
} from "./providerDetection";

export type IngestionMode = "local";
export const CHARTS_INGESTION_MODE: IngestionMode = "local";

export function getIngestionMode(): IngestionMode {
  return CHARTS_INGESTION_MODE;
}

export function setIngestionMode(_mode: IngestionMode): void {
  try {
    localStorage.setItem("wkcharts_ingestion_mode", "local");
  } catch {
    // ignore
  }
}

if (import.meta.env.DEV) {
  const oldMode = (import.meta.env.VITE_CHARTS_INGESTION_MODE as string | undefined)?.trim().toLowerCase();
  if (oldMode === "wordpress") {
    // eslint-disable-next-line no-console
    console.warn("[chartsIngestion/client] WordPress ingestion mode is ignored. WordPress is legacy-import only.");
  }
}

const adapter = mockAdapter;
const ingestStudioAdapter = ingestStudioMock;

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
    status: "planned",
    tables: ["chart_programs", "chart_series", "chart_markets"],
    expectedResponse: ["id", "familyKey", "label", "defaultChartSize", "editionFrequency"],
    description: "Retrieve all chart programs/families from the new runtime backend.",
    payloadExample: {},
    responseExample: { families: [{ id: "top-songs-kenya", label: "Top Songs Kenya", defaultChartSize: 100 }] },
    capabilities: ["read_wakilisha_charts"],
  },
  runDryRun: {
    key: "runDryRun",
    frontendFunction: "runDryRun(request)",
    method: "POST",
    path: "/api/charts/ingest/dry-run",
    status: "planned",
    tables: ["chart_ingest_runs", "chart_ingest_rows", "chart_ingest_row_intelligence"],
    expectedResponse: ["runId", "status", "stages", "summary", "rows"],
    description: "Execute a provider-backed chart dry run in the new runtime backend.",
    payloadExample: { chartTitle: "Top Songs Kenya", sourceUrls: [], marketScopeId: "scope_kenya" },
    responseExample: { runId: "run-001", status: "dry_run_complete" },
    capabilities: ["create_wakilisha_charts"],
  },
  commitIngestRun: {
    key: "commitIngestRun",
    frontendFunction: "commitIngestRun(request)",
    method: "POST",
    path: "/api/charts/ingest/runs/{runId}/commit",
    status: "planned",
    tables: ["chart_editions", "chart_entries", "chart_snapshots", "chart_audit_events"],
    expectedResponse: ["runId", "editionId", "status", "integrity"],
    description: "Commit a dry run into a real edition, snapshot, and audit trail.",
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
      status: "planned",
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
  const allExports = [adapter, ingestStudioAdapter];
  const hasFunction = allExports.some((candidate) => typeof (candidate as Record<string, unknown>)[cleanName] === "function");
  if (hasFunction) return "local";
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


export const runDryRun = ingestStudioAdapter.runDryRun;
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
export const getReviewIssues = adapter.getReviewIssues;
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
export { attachCsvAsSource, createDraftFromCsvCandidates, exportDraftJson, getCsvImportSessions, getDiscoveredCsvSources, normalizeCsvCandidates, validateCsvDraftIntegrity } from "./api";
export { validateCommitReadiness } from "./commitService";
export { getIngestRun } from "./ingestStudioMock";
export { detectProvidersFromUrls, isValidProviderUrl } from "./providerDetection";
export { clearAllSimulations, getActiveSimulations, getLastErrorMessage, isSimulated, retry, simulate } from "./simulation";
export { appendJobLog, getStore } from "./store";
export { getStepStatus } from "./workflow";
