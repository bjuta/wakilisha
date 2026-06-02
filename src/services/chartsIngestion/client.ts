/**
 * Chart Ingestion Client Adapter
 * Single boundary between the React app and the chart ingestion backend.
 * Selects between mock adapter and WordPress adapter based on environment.
 * No component should import from api.ts or store.ts directly.
 */

import type {
  ChartFamily,
  IngestJob,
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
  IngestJobStatus,
} from "./types";

import * as mockAdapter from "./api";
import * as wpAdapter from "./wpAdapter";
import * as ingestStudioMock from "./ingestStudioMock";

// ─── Configuration ───
export type IngestionMode = "mock" | "wordpress";

const CHARTS_INGESTION_MODE: IngestionMode =
  (import.meta.env.VITE_CHARTS_INGESTION_MODE as IngestionMode) || "mock";

export function getIngestionMode(): IngestionMode {
  return CHARTS_INGESTION_MODE;
}

export function setIngestionMode(mode: IngestionMode): void {
  // This is a runtime-only setter. In production, the mode is set at build time.
  // For dev, you can toggle via localStorage if needed.
  try {
    localStorage.setItem("wkcharts_ingestion_mode", mode);
  } catch {
    // ignore
  }
}

// Dev warning if wordpress mode is active but no base URL is configured
if (CHARTS_INGESTION_MODE === "wordpress" && import.meta.env.DEV) {
  if (!import.meta.env.VITE_WAKILISHA_WP_API_BASE) {
    // eslint-disable-next-line no-console
    console.warn(
      "[client.ts] CHARTS_INGESTION_MODE is 'wordpress' but VITE_WAKILISHA_WP_API_BASE is not set."
    );
  }
}

// ─── Adapter Selector ───
const adapter = CHARTS_INGESTION_MODE === "wordpress" ? wpAdapter : mockAdapter;

// ─── Ingest Studio Adapter Selector ───
const ingestStudioAdapter = CHARTS_INGESTION_MODE === "wordpress" ? wpAdapter : ingestStudioMock;

// ─── WordPress Endpoint Definitions ───
export type EndpointStatus =
  | "not_configured"
  | "planned"
  | "mocked"
  | "ready"
  | "deprecated";

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

export const WORDPRESS_CHART_ENDPOINTS: Record<string, EndpointDefinition> = {
  getChartFamilies: {
    key: "getChartFamilies",
    frontendFunction: "getChartFamilies()",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/families",
    status: "not_configured",
    tables: ["wkcharts_chart_families"],
    expectedResponse: ["id", "familyKey", "label", "defaultChartSize", "editionFrequency"],
    description: "Retrieve all chart families configured in the system.",
    payloadExample: {},
    responseExample: {
      families: [{ id: "top-40", label: "Top 40", defaultChartSize: 40 }],
    },
    capabilities: ["read_wakilisha_charts"],
  },
  createIngestJob: {
    key: "createIngestJob",
    frontendFunction: "createIngestJob(payload)",
    method: "POST",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs",
    status: "not_configured",
    tables: ["wkcharts_ingest_jobs"],
    expectedResponse: ["job", "logs", "summary"],
    description: "Create a new chart ingest job with family, edition date, and rules.",
    payloadExample: {
      chartFamilyId: "top-40",
      editionDate: "2026-05-31",
      periodStart: "2026-05-24",
      periodEnd: "2026-05-30",
      chartSize: 40,
      rulesetKey: "default",
      scoringModelKey: "weighted_streaming",
    },
    responseExample: {
      job: { id: "job-001", status: "draft" },
      logs: [{ stage: "job_created", level: "success" }],
      summary: { totalSources: 0, totalCandidates: 0 },
    },
    capabilities: ["create_wakilisha_charts"],
  },
  getIngestJob: {
    key: "getIngestJob",
    frontendFunction: "getIngestJob(jobId)",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}",
    status: "not_configured",
    tables: ["wkcharts_ingest_jobs"],
    expectedResponse: ["id", "chartFamilyId", "status", "editionDate", "sourceSummary", "jobSummary"],
    description: "Retrieve a single ingest job with all nested summaries.",
    payloadExample: {},
    responseExample: {
      job: { id: "job-001", status: "draft", chartSize: 40 },
    },
    capabilities: ["read_wakilisha_charts"],
  },
  getIngestJobs: {
    key: "getIngestJobs",
    frontendFunction: "getIngestJobs()",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs",
    status: "not_configured",
    tables: ["wkcharts_ingest_jobs"],
    expectedResponse: ["jobs", "count"],
    description: "List all ingest jobs with filtering and pagination.",
    payloadExample: {},
    responseExample: {
      jobs: [{ id: "job-001", status: "draft" }],
      count: 1,
    },
    capabilities: ["read_wakilisha_charts"],
  },
  updateJobStatus: {
    key: "updateJobStatus",
    frontendFunction: "updateJobStatusApi(jobId, status)",
    method: "PATCH",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/status",
    status: "not_configured",
    tables: ["wkcharts_ingest_jobs"],
    expectedResponse: ["job", "log"],
    description: "Update the status of an ingest job.",
    payloadExample: { status: "fetching", errorMessage: null },
    responseExample: { job: { id: "job-001", status: "fetching" } },
    capabilities: ["edit_wakilisha_charts"],
  },
  cancelJob: {
    key: "cancelJob",
    frontendFunction: "cancelJob(jobId)",
    method: "POST",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/cancel",
    status: "not_configured",
    tables: ["wkcharts_ingest_jobs"],
    expectedResponse: ["job", "log"],
    description: "Cancel an active ingest job.",
    payloadExample: {},
    responseExample: { job: { id: "job-001", status: "cancelled" } },
    capabilities: ["edit_wakilisha_charts"],
  },
  deleteJob: {
    key: "deleteJob",
    frontendFunction: "deleteJobApi(jobId)",
    method: "DELETE",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}",
    status: "not_configured",
    tables: ["wkcharts_ingest_jobs"],
    expectedResponse: ["success"],
    description: "Delete a draft or cancelled ingest job.",
    payloadExample: {},
    responseExample: { success: true },
    capabilities: ["delete_wakilisha_charts"],
  },
  addSource: {
    key: "addSource",
    frontendFunction: "addSourceApi(jobId, payload)",
    method: "POST",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/sources",
    status: "not_configured",
    tables: ["wkcharts_ingest_sources"],
    expectedResponse: ["source", "log"],
    description: "Add a source (Spotify, Apple, CSV, etc.) to a job.",
    payloadExample: {
      sourceType: "spotify",
      provider: "spotify",
      sourceUrl: "https://api.spotify.com/v1/charts",
      weight: 1.0,
      priority: 1,
    },
    responseExample: { source: { id: "src-001", status: "pending" } },
    capabilities: ["edit_wakilisha_charts"],
  },
  getSources: {
    key: "getSources",
    frontendFunction: "getSources(jobId)",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/sources",
    status: "not_configured",
    tables: ["wkcharts_ingest_sources"],
    expectedResponse: ["sources", "count"],
    description: "List all sources for an ingest job.",
    payloadExample: {},
    responseExample: {
      sources: [{ id: "src-001", provider: "spotify", status: "completed" }],
    },
    capabilities: ["read_wakilisha_charts"],
  },
  removeSource: {
    key: "removeSource",
    frontendFunction: "removeSourceApi(sourceId)",
    method: "DELETE",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/sources/{sourceId}",
    status: "not_configured",
    tables: ["wkcharts_ingest_sources"],
    expectedResponse: ["success", "log"],
    description: "Remove a source from an ingest job.",
    payloadExample: {},
    responseExample: { success: true },
    capabilities: ["edit_wakilisha_charts"],
  },
  fetchSources: {
    key: "fetchSources",
    frontendFunction: "fetchSources(jobId)",
    method: "POST",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/fetch-sources",
    status: "not_configured",
    tables: ["wkcharts_ingest_sources", "wkcharts_raw_source_items"],
    expectedResponse: ["sources", "rawItems", "log"],
    description: "Trigger fetch for all pending sources.",
    payloadExample: {},
    responseExample: {
      sources: [{ id: "src-001", rawCount: 150, status: "completed" }],
      rawItems: 150,
    },
    capabilities: ["edit_wakilisha_charts"],
  },
  getRawItems: {
    key: "getRawItems",
    frontendFunction: "getRawItems(jobId)",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/raw-items",
    status: "not_configured",
    tables: ["wkcharts_raw_source_items"],
    expectedResponse: ["rawItems", "count"],
    description: "List raw source items for a job.",
    payloadExample: {},
    responseExample: {
      rawItems: [{ id: "raw-001", titleRaw: "Song Title", artistRaw: "Artist Name" }],
    },
    capabilities: ["read_wakilisha_charts"],
  },
  getCandidates: {
    key: "getCandidates",
    frontendFunction: "getCandidates(jobId)",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates",
    status: "not_configured",
    tables: ["wkcharts_ingest_candidates"],
    expectedResponse: ["candidates", "count", "pagination"],
    description: "List normalized candidates for a job.",
    payloadExample: {},
    responseExample: {
      candidates: [{ id: "cand-001", normalizedTitle: "Song Title", score: 850.5 }],
    },
    capabilities: ["read_wakilisha_charts"],
  },
  approveCandidate: {
    key: "approveCandidate",
    frontendFunction: "approveCandidate(candidateId)",
    method: "PATCH",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates/{candidateId}/approve",
    status: "not_configured",
    tables: ["wkcharts_ingest_candidates"],
    expectedResponse: ["candidate", "log"],
    description: "Approve a candidate for inclusion.",
    payloadExample: {},
    responseExample: { candidate: { id: "cand-001", status: "approved" } },
    capabilities: ["edit_wakilisha_charts"],
  },
  excludeCandidate: {
    key: "excludeCandidate",
    frontendFunction: "excludeCandidate(candidateId)",
    method: "PATCH",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates/{candidateId}/exclude",
    status: "not_configured",
    tables: ["wkcharts_ingest_candidates"],
    expectedResponse: ["candidate", "log"],
    description: "Exclude a candidate from the chart.",
    payloadExample: { reason: "Duplicate track" },
    responseExample: { candidate: { id: "cand-001", status: "excluded" } },
    capabilities: ["edit_wakilisha_charts"],
  },
  getMatches: {
    key: "getMatches",
    frontendFunction: "getMatches(jobId)",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/matches",
    status: "not_configured",
    tables: ["wkcharts_ingest_matches"],
    expectedResponse: ["matches", "count"],
    description: "List canonical match proposals for a job.",
    payloadExample: {},
    responseExample: {
      matches: [{ id: "match-001", matchConfidence: 95, matchMethod: "isrc" }],
    },
    capabilities: ["read_wakilisha_charts"],
  },
  approveMatch: {
    key: "approveMatch",
    frontendFunction: "approveCandidateMatch(jobId, candidateId, matchId)",
    method: "POST",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/matches/{matchId}/approve",
    status: "not_configured",
    tables: ["wkcharts_ingest_matches"],
    expectedResponse: ["match", "log"],
    description: "Approve a canonical match for a candidate.",
    payloadExample: {},
    responseExample: { match: { id: "match-001", approvedBy: "user_id" } },
    capabilities: ["edit_wakilisha_charts"],
  },
  rejectMatch: {
    key: "rejectMatch",
    frontendFunction: "rejectCandidateMatch(jobId, matchId)",
    method: "POST",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/matches/{matchId}/reject",
    status: "not_configured",
    tables: ["wkcharts_ingest_matches"],
    expectedResponse: ["match", "log"],
    description: "Reject a canonical match proposal.",
    payloadExample: { reason: "Wrong track" },
    responseExample: { match: { id: "match-001", matchConfidence: 45 } },
    capabilities: ["edit_wakilisha_charts"],
  },
  rematch: {
    key: "rematch",
    frontendFunction: "rematchCandidate(jobId, candidateId, canonicalTrackId, confidence, method)",
    method: "POST",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates/{candidateId}/rematch",
    status: "not_configured",
    tables: ["wkcharts_ingest_matches"],
    expectedResponse: ["match", "log"],
    description: "Manually rematch a candidate to a different canonical track.",
    payloadExample: {
      canonicalTrackId: "track-123",
      confidence: 92,
      method: "manual",
    },
    responseExample: { match: { id: "match-002", matchConfidence: 92 } },
    capabilities: ["edit_wakilisha_charts"],
  },
  markNewEntity: {
    key: "markNewEntity",
    frontendFunction: "markAsNewEntity(jobId, candidateId)",
    method: "POST",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates/{candidateId}/new-entity",
    status: "not_configured",
    tables: ["wkcharts_ingest_matches", "wkcharts_canonical_tracks"],
    expectedResponse: ["match", "log"],
    description: "Mark candidate as a new canonical track entity.",
    payloadExample: {},
    responseExample: { match: { id: "match-001", matchMethod: "new_entity" } },
    capabilities: ["edit_wakilisha_charts"],
  },
  getReviewIssues: {
    key: "getReviewIssues",
    frontendFunction: "getReviewIssues(jobId)",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/issues",
    status: "not_configured",
    tables: ["wkcharts_review_issues"],
    expectedResponse: ["issues", "count", "bySeverity"],
    description: "List review issues for a job grouped by severity.",
    payloadExample: {},
    responseExample: {
      issues: [{ id: "issue-001", severity: "high", issueType: "duplicate_rank" }],
    },
    capabilities: ["read_wakilisha_charts"],
  },
  resolveIssue: {
    key: "resolveIssue",
    frontendFunction: "resolveReviewIssue(jobId, issueId, payload)",
    method: "PATCH",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/issues/{issueId}",
    status: "not_configured",
    tables: ["wkcharts_review_issues"],
    expectedResponse: ["issue", "log"],
    description: "Resolve, ignore, or override a review issue.",
    payloadExample: {
      resolution: "resolve",
      note: "Verified with second source",
    },
    responseExample: { issue: { id: "issue-001", status: "resolved" } },
    capabilities: ["edit_wakilisha_charts"],
  },
  applyRankOverride: {
    key: "applyRankOverride",
    frontendFunction: "applyRankOverride(jobId, candidateId, payload)",
    method: "PATCH",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates/{candidateId}/rank",
    status: "not_configured",
    tables: ["wkcharts_ingest_candidates"],
    expectedResponse: ["candidate", "log"],
    description: "Apply a manual rank override to a candidate.",
    payloadExample: {
      rank: 1,
      reason: "Editorial decision: track of the week",
    },
    responseExample: { candidate: { id: "cand-001", finalRank: 1 } },
    capabilities: ["edit_wakilisha_charts"],
  },
  createDraft: {
    key: "createDraft",
    frontendFunction: "createDraftEdition(jobId)",
    method: "POST",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/draft",
    status: "not_configured",
    tables: ["wkcharts_draft_entries", "wkcharts_chart_editions"],
    expectedResponse: ["draft", "edition", "log"],
    description: "Create a draft edition from ranked candidates.",
    payloadExample: {},
    responseExample: {
      draft: [{ id: "draft-001", finalRank: 1 }],
      edition: { id: "ed-001", status: "draft" },
    },
    capabilities: ["create_wakilisha_charts"],
  },
  publishEdition: {
    key: "publishEdition",
    frontendFunction: "publishEdition(jobId)",
    method: "POST",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/publish",
    status: "not_configured",
    tables: ["wkcharts_chart_editions", "wkcharts_snapshots"],
    expectedResponse: ["edition", "snapshot", "log"],
    description: "Publish the edition and create an immutable snapshot.",
    payloadExample: {},
    responseExample: {
      edition: { id: "ed-001", status: "published" },
      snapshot: { id: "snap-001", checksum: "sha256:..." },
    },
    capabilities: ["publish_wakilisha_charts"],
  },
  getJobLogs: {
    key: "getJobLogs",
    frontendFunction: "getJobLogs(jobId)",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/logs",
    status: "not_configured",
    tables: ["wkcharts_ingest_logs"],
    expectedResponse: ["logs", "count"],
    description: "List audit logs for a job.",
    payloadExample: {},
    responseExample: {
      logs: [{ id: "log-001", stage: "fetch_sources", level: "success" }],
    },
    capabilities: ["read_wakilisha_charts"],
  },
  getEditions: {
    key: "getEditions",
    frontendFunction: "getEditionsApi()",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/editions",
    status: "not_configured",
    tables: ["wkcharts_chart_editions"],
    expectedResponse: ["editions", "count"],
    description: "List all published editions.",
    payloadExample: {},
    responseExample: {
      editions: [{ id: "ed-001", status: "published", label: "Week 22" }],
    },
    capabilities: ["read_wakilisha_charts"],
  },
  getSnapshots: {
    key: "getSnapshots",
    frontendFunction: "getSnapshots()",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/snapshots",
    status: "not_configured",
    tables: ["wkcharts_snapshots"],
    expectedResponse: ["snapshots", "count"],
    description: "List all immutable snapshots.",
    payloadExample: {},
    responseExample: {
      snapshots: [{ id: "snap-001", editionId: "ed-001", checksum: "sha256:..." }],
    },
    capabilities: ["read_wakilisha_charts"],
  },
  getDashboardKpis: {
    key: "getDashboardKpis",
    frontendFunction: "getDashboardKpisApi()",
    method: "GET",
    path: "/wp-json/wakilisha/v1/charts/dashboard",
    status: "not_configured",
    tables: ["wkcharts_ingest_jobs", "wkcharts_chart_editions"],
    expectedResponse: ["activeJobs", "failedJobs", "latestEdition", "totalEditions"],
    description: "Retrieve dashboard KPIs.",
    payloadExample: {},
    responseExample: {
      activeJobs: 3,
      failedJobs: 1,
      latestEdition: { id: "ed-001", label: "Week 22" },
    },
    capabilities: ["read_wakilisha_charts"],
  },
  preflightCheck: {
    key: "preflightCheck",
    frontendFunction: "runPreflightCheck(jobId)",
    method: "POST",
    path: "/wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/preflight",
    status: "not_configured",
    tables: ["wkcharts_ingest_jobs"],
    expectedResponse: ["checklist", "pass", "fail", "warning"],
    description: "Run preflight validation before publishing.",
    payloadExample: {},
    responseExample: {
      checklist: [{ label: "Sources fetched", pass: true }],
      pass: 7,
      fail: 0,
      warning: 1,
    },
    capabilities: ["publish_wakilisha_charts"],
  },
};

export function getEndpointDefinitions(): EndpointDefinition[] {
  return Object.values(WORDPRESS_CHART_ENDPOINTS);
}

export function getEndpointByKey(key: string): EndpointDefinition | undefined {
  return WORDPRESS_CHART_ENDPOINTS[key];
}

export function getEndpointGroups(): Record<string, EndpointDefinition[]> {
  return {
    "Jobs & Setup": [
      WORDPRESS_CHART_ENDPOINTS.getChartFamilies,
      WORDPRESS_CHART_ENDPOINTS.createIngestJob,
      WORDPRESS_CHART_ENDPOINTS.getIngestJob,
      WORDPRESS_CHART_ENDPOINTS.getIngestJobs,
      WORDPRESS_CHART_ENDPOINTS.updateJobStatus,
      WORDPRESS_CHART_ENDPOINTS.cancelJob,
      WORDPRESS_CHART_ENDPOINTS.deleteJob,
    ],
    "Sources": [
      WORDPRESS_CHART_ENDPOINTS.addSource,
      WORDPRESS_CHART_ENDPOINTS.getSources,
      WORDPRESS_CHART_ENDPOINTS.removeSource,
      WORDPRESS_CHART_ENDPOINTS.fetchSources,
      WORDPRESS_CHART_ENDPOINTS.getRawItems,
    ],
    "Candidates": [
      WORDPRESS_CHART_ENDPOINTS.getCandidates,
      WORDPRESS_CHART_ENDPOINTS.approveCandidate,
      WORDPRESS_CHART_ENDPOINTS.excludeCandidate,
    ],
    "Matching": [
      WORDPRESS_CHART_ENDPOINTS.getMatches,
      WORDPRESS_CHART_ENDPOINTS.approveMatch,
      WORDPRESS_CHART_ENDPOINTS.rejectMatch,
      WORDPRESS_CHART_ENDPOINTS.rematch,
      WORDPRESS_CHART_ENDPOINTS.markNewEntity,
    ],
    "Review Issues": [
      WORDPRESS_CHART_ENDPOINTS.getReviewIssues,
      WORDPRESS_CHART_ENDPOINTS.resolveIssue,
    ],
    "Ranking": [
      WORDPRESS_CHART_ENDPOINTS.applyRankOverride,
    ],
    "Draft & Publish": [
      WORDPRESS_CHART_ENDPOINTS.createDraft,
      WORDPRESS_CHART_ENDPOINTS.publishEdition,
      WORDPRESS_CHART_ENDPOINTS.preflightCheck,
    ],
    "Audit & Snapshots": [
      WORDPRESS_CHART_ENDPOINTS.getJobLogs,
      WORDPRESS_CHART_ENDPOINTS.getEditions,
      WORDPRESS_CHART_ENDPOINTS.getSnapshots,
      WORDPRESS_CHART_ENDPOINTS.getDashboardKpis,
    ],
  };
}

// ─── Adapter Exports ───
// All components should import from this file only.

export const resetStore = adapter.resetStore;
export const resetDemo = adapter.resetDemo;
export const refreshStore = adapter.refreshStore;

// Chart Families
export const getChartFamilies = adapter.getChartFamilies;

// Ingest Jobs
export const getIngestJobs = adapter.getIngestJobs;
export const getIngestJob = adapter.getIngestJob;
export const createIngestJob = adapter.createIngestJob;
export const updateJobStatusApi = adapter.updateJobStatusApi;
export const cancelJob = adapter.cancelJob;
export const retryJob = adapter.retryJob;
export const deleteJobApi = adapter.deleteJobApi;

// Sources
export const getSources = adapter.getSources;
export const addSourceApi = adapter.addSourceApi;
export const removeSourceApi = adapter.removeSourceApi;
export const updateSourceWeight = adapter.updateSourceWeight;
export const toggleSourceEnabled = adapter.toggleSourceEnabled;
export const fetchSources = adapter.fetchSources;

// Raw Items
export const getRawItems = adapter.getRawItems;

// Candidates
export const getCandidates = adapter.getCandidates;
export const getCandidateById = adapter.getCandidateById;
export const approveCandidate = adapter.approveCandidate;
export const excludeCandidate = adapter.excludeCandidate;
export const restoreCandidate = adapter.restoreCandidate;

// Matches
export const getMatches = adapter.getMatches;
export const approveCandidateMatch = adapter.approveCandidateMatch;
export const rejectCandidateMatch = adapter.rejectCandidateMatch;
export const rematchCandidate = adapter.rematchCandidate;
export const markAsNewEntity = adapter.markAsNewEntity;

// Review Issues
export const getReviewIssues = adapter.getReviewIssues;
export const resolveReviewIssue = adapter.resolveReviewIssue;
export const reopenIssue = adapter.reopenIssue;

// Ranking
export const applyRankOverride = adapter.applyRankOverride;
export const clearRankOverride = adapter.clearRankOverride;

// Draft & Publish
export const createDraftEdition = adapter.createDraftEdition;
export const publishEdition = adapter.publishEdition;

// Logs
export const getJobLogs = adapter.getJobLogs;

// Draft Entries
export const getDraftEntries = adapter.getDraftEntries;

// Editions
export const getEditionsApi = adapter.getEditionsApi;
export const getEditionById = adapter.getEditionById;

// Snapshots
export const getSnapshots = adapter.getSnapshots;

// Dashboard
export const getDashboardKpisApi = adapter.getDashboardKpisApi;

// Summary
export const getJobSummaryApi = adapter.getJobSummaryApi;

// Helpers
export const getDemoJobId = adapter.getDemoJobId;
export const searchCanonicalTracks = adapter.searchCanonicalTracks;

// ─── Re-export types ───
export type { IngestionMode };
export { CHARTS_INGESTION_MODE };

// ─── Re-export endpoint definitions ───
export type { EndpointDefinition, EndpointStatus };

// ─── Re-export roles ───
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

// ─── Re-export simulation ───
export type { SimulationType } from "./simulation";
export {
  getActiveSimulations,
  isSimulated,
  getLastErrorMessage,
  simulate,
  retry,
  clearSimulation,
  clearAllSimulations,
  retrySourceFetch,
  retryNormalization,
  retryMatching,
  retryPublish,
  retrySnapshotCreation,
} from "./simulation";

// ─── Re-export contract assertions ───
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

// ─── Re-export normalizers ───
export {
  keysToSnakeCase,
  keysToCamelCase,
  toWpIngestJobPayload,
  toWpSourcePayload,
  toWpResolveIssuePayload,
  toWpRankOverridePayload,
  fromWpChartFamily,
  fromWpIngestJob,
  fromWpSource,
  fromWpCandidate,
  fromWpMatch,
  fromWpReviewIssue,
  fromWpDraftEntry,
  fromWpChartEdition,
  fromWpSnapshot,
  fromWpDashboardKpis,
} from "./normalizers";

// ─── Re-export workflow helpers ───
export {
  canFetchSources,
  canCreateDraft,
  canPublish,
  canApproveMatch,
  canApplyRankOverride,
  canDeleteSource,
  getPublishChecklist,
  getBlockingReasons,
  getStepStatus,
  getWorkflowStepIndex,
  getJobStage,
  getJobStageIndex,
} from "./workflow";

// ─── Re-export WordPress adapter utilities ───
export {
  WpApiError,
  testWordPressConnection,
  retryWithBackoff,
  WP_API_BASE,
  WP_API_BASE_V2,
  INGEST_STUDIO_WP_ENDPOINTS,
  getIngestHealthWp,
} from "./wpAdapter";
export type { IngestStudioEndpointDef } from "./wpAdapter";

// ─── Store internals (mock only) ───
// These are exported for backward compatibility with components that need direct store access.
// In WordPress mode, they return empty values or no-op.
export { getStore, appendJobLog, getJobSummary } from "./store";

// ─── CSV Discovery ───
export const getDiscoveredCsvSources = adapter.getDiscoveredCsvSources;
export const getDiscoveredCsvSourceById = adapter.getDiscoveredCsvSourceById;
export const attachCsvAsSource = adapter.attachCsvAsSource;
export const normalizeCsvCandidates = adapter.normalizeCsvCandidates;
export const useCsvAsSource = adapter.attachCsvAsSource;

// ─── CSV Import Sessions ───
export const getCsvImportSessions = adapter.getCsvImportSessions;
export const createCsvImportSession = adapter.createCsvImportSession;
export const clearCsvImportSessions = adapter.clearCsvImportSessions;

// ─── CSV Draft Integrity ───
export const validateCsvDraftIntegrity = adapter.validateCsvDraftIntegrity;

// ─── CSV Draft Creation ───
export const createDraftFromCsvCandidates = adapter.createDraftFromCsvCandidates;
export const exportDraftJson = adapter.exportDraftJson;

// ─── Ingest Studio (Provider-based) ───
// Routed through ingestStudioAdapter so mock vs WordPress is correctly selected
export const getIngestRuns = ingestStudioAdapter.getIngestRunsWp || ingestStudioAdapter.getIngestRuns;
export const getIngestRun = ingestStudioAdapter.getIngestRunWp || ingestStudioAdapter.getIngestRun;
export const getIngestKpis = ingestStudioAdapter.getIngestKpisWp || ingestStudioAdapter.getIngestKpis;
export const getRecentIngestActivity = ingestStudioAdapter.getRecentIngestActivityWp || ingestStudioAdapter.getRecentIngestActivity;
export const createIngestRun = ingestStudioAdapter.createIngestRun;
export const updateIngestRun = ingestStudioAdapter.updateIngestRun;
export const runDryRun = ingestStudioAdapter.runDryRunWp || ingestStudioAdapter.runDryRun;
export const commitIngestRun = ingestStudioAdapter.commitIngestRunWp || ingestStudioAdapter.commitIngestRun;
export const cancelIngestRun = ingestStudioAdapter.cancelIngestRunWp || ingestStudioAdapter.cancelIngestRun;
export const retryIngestRun = ingestStudioAdapter.retryIngestRunWp || ingestStudioAdapter.retryIngestRun;
export const sendGapsToReview = ingestStudioAdapter.sendGapsToReviewWp || ingestStudioAdapter.sendGapsToReview;
export const getResourceGuardStatus = ingestStudioAdapter.getResourceGuardStatusWp || ingestStudioAdapter.getResourceGuardStatus;
export const getStudioStore = ingestStudioAdapter.getStudioStore;
export const refreshStudioStore = ingestStudioAdapter.refreshStudioStore;
export const resetStudioStore = ingestStudioAdapter.resetStudioStore;
export const commitStudioStore = ingestStudioAdapter.commitStudioStore;

// ─── Provider Detection ───
export {
  detectProviderFromUrl,
  detectProvidersFromUrls,
  getProviderLabel,
  getProviderColorClass,
  getProviderIcon,
  getProviderBgColor,
  isValidProviderUrl,
} from "./providerDetection";

// ─── Sprint 3: Provider Fetch & Normalization ───
export { fetchFromAllSources, getProviderFetchStatusSummary } from "./providerFetch";
export { normalizeToResolvedRows, mergeNormalizedRows } from "./normalize";
export { fetchFromSpotify, parseSpotifyPlaylistUrl } from "./spotifyFetch";
export { fetchFromAppleMusic, parseAppleMusicUrl } from "./appleMusicFetch";
export { generateMockProviderRows, getMockProviderError } from "./mockTracks";
export type { SourceFetchResult, ProviderFetchAggregateResult, ProviderFetchConfig } from "./providerFetch";
export type { NormalizeResult } from "./normalize";
export type { SpotifyFetchResult } from "./spotifyFetch";
export type { AppleMusicFetchResult } from "./appleMusicFetch";

// ─── Ingest Studio Types ───
export type {
  IngestRun,
  IngestRunStatus,
  IngestStage,
  IngestStageStatus,
  ProviderName,
  NormalizedChartRow,
  MatchStatus,
  IngestResolvedRow,
  IngestRunSummary,
  IngestStudioKpi,
  RecentIngestActivity,
  ResourceGuardStatus,
  CreateIngestDryRunRequest,
  CreateIngestDryRunResponse,
  CommitIngestRunRequest,
  CommitIngestRunResponse,
  ApiEnvelope,
} from "./ingestStudioTypes";