/**
 * WordPress Chart Ingestion Adapter
 * Implements the same API surface as the mock adapter, but routes all calls
 * to the WAKILISHA WordPress REST API.
 *
 * For endpoints not yet implemented on the backend, throws a descriptive error
 * so the frontend knows exactly what is missing.
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

import {
  toWpIngestJobPayload,
  toWpSourcePayload,
  fromWpIngestJob,
  fromWpSource,
  fromWpCandidate,
  fromWpMatch,
  fromWpReviewIssue,
  fromWpDraftEntry,
  fromWpSnapshot,
  fromWpChartEdition,
  fromWpChartFamily,
  fromWpDashboardKpis,
} from "./normalizers";

// ─── Configuration ───
const WP_API_BASE =
  import.meta.env.VITE_WAKILISHA_WP_API_BASE ||
  "/wp-json/wakilisha/v1";

const WP_NONCE =
  typeof window !== "undefined"
    ? (window as unknown as Record<string, string>).WAKILISHA_REST_NONCE
    : undefined;

// ─── Dev warning ───
if (import.meta.env.DEV && !import.meta.env.VITE_WAKILISHA_WP_API_BASE) {
  // eslint-disable-next-line no-console
  console.warn(
    "[wpAdapter] VITE_WAKILISHA_WP_API_BASE is not set. WordPress adapter will use default '/wp-json/wakilisha/v1'"
  );
}

// ─── HTTP Helpers ───

interface WpErrorResponse {
  error: string;
  code?: string;
  retryable?: boolean;
}

class WpApiError extends Error {
  status: number;
  code?: string;
  retryable: boolean;

  constructor(message: string, status: number, code?: string, retryable = false) {
    super(message);
    this.name = "WpApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.pathname + url.search;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (WP_NONCE) {
    headers["X-WP-Nonce"] = WP_NONCE;
  }
  return headers;
}

async function wpRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean>
): Promise<T> {
  const url = buildUrl(`${WP_API_BASE}${path}`, params);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method,
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: "same-origin",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody: WpErrorResponse | string = "";
      try {
        errorBody = (await response.json()) as WpErrorResponse;
      } catch {
        errorBody = await response.text();
      }

      const message =
        typeof errorBody === "object" && errorBody.error
          ? errorBody.error
          : `WordPress API returned ${response.status}`;

      throw new WpApiError(
        message,
        response.status,
        typeof errorBody === "object" ? errorBody.code : undefined,
        response.status === 504 || response.status === 502 || response.status === 503
      );
    }

    // Handle empty responses (e.g., 204)
    if (response.status === 204) {
      return undefined as T;
    }

    const data = (await response.json()) as T;
    return data;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof WpApiError) {
      throw err;
    }

    if (err instanceof Error && err.name === "AbortError") {
      throw new WpApiError("Request timed out after 30 seconds", 504, "timeout", true);
    }

    if (err instanceof TypeError) {
      // Network error (offline, CORS, DNS failure)
      throw new WpApiError(
        "Network error: unable to reach WordPress API. Check connection and CORS settings.",
        0,
        "network_error",
        true
      );
    }

    throw new WpApiError(
      err instanceof Error ? err.message : "Unknown API error",
      500,
      "unknown"
    );
  }
}

export function wpGet<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  return wpRequest<T>("GET", path, undefined, params);
}

export function wpPost<T>(path: string, body?: unknown): Promise<T> {
  return wpRequest<T>("POST", path, body);
}

export function wpPatch<T>(path: string, body?: unknown): Promise<T> {
  return wpRequest<T>("PATCH", path, body);
}

export function wpDelete<T>(path: string, body?: unknown): Promise<T> {
  return wpRequest<T>("DELETE", path, body);
}

export function wpPut<T>(path: string, body?: unknown): Promise<T> {
  return wpRequest<T>("PUT", path, body);
}

// ─── Not Implemented Helper ───
function notImplemented(methodName: string): Promise<never> {
  return Promise.reject(
    new Error(`WordPress endpoint not implemented: ${methodName}`)
  );
}

// ─── Store Operations ───
export function resetStore(): void {
  // In WordPress mode, the store is server-side. Reset is a no-op.
  // eslint-disable-next-line no-console
  console.warn("[wpAdapter] resetStore() is not applicable in WordPress mode.");
}

export function resetDemo(): void {
  // eslint-disable-next-line no-console
  console.warn("[wpAdapter] resetDemo() is not applicable in WordPress mode.");
}

export function refreshStore(): void {
  // eslint-disable-next-line no-console
  console.warn("[wpAdapter] refreshStore() is not applicable in WordPress mode.");
}

// ─── Chart Families ───
export function getChartFamilies(): Promise<ChartFamily[]> {
  return wpGet<{ families: unknown[] }>("/charts/families")
    .then((res) => (res.families || []).map(fromWpChartFamily))
    .catch(() => notImplemented("getChartFamilies GET /charts/families"));
}

// ─── Ingest Jobs ───
export function getIngestJobs(): Promise<IngestJob[]> {
  return wpGet<{ jobs: unknown[] }>("/charts/ingest-jobs")
    .then((res) => (res.jobs || []).map(fromWpIngestJob))
    .catch(() => notImplemented("getIngestJobs GET /charts/ingest-jobs"));
}

export function getIngestJob(jobId: string): Promise<IngestJob | null> {
  return wpGet<{ job: unknown }>(`/charts/ingest-jobs/${jobId}`)
    .then((res) => {
      if (!res.job) return null;
      return fromWpIngestJob(res.job);
    })
    .catch(() => notImplemented("getIngestJob GET /charts/ingest-jobs/{jobId}"));
}

export function createIngestJob(payload: CreateIngestJobPayload): Promise<IngestJob> {
  return wpPost<{ job: unknown }>("/charts/ingest-jobs", toWpIngestJobPayload(payload))
    .then((res) => fromWpIngestJob(res.job))
    .catch(() => notImplemented("createIngestJob POST /charts/ingest-jobs"));
}

export function updateJobStatusApi(
  jobId: string,
  status: IngestJobStatus,
  errorMessage?: string
): Promise<IngestJob | null> {
  return wpPatch<{ job: unknown }>(`/charts/ingest-jobs/${jobId}/status`, {
    status,
    error_message: errorMessage ?? null,
  })
    .then((res) => (res.job ? fromWpIngestJob(res.job) : null))
    .catch(() => notImplemented("updateJobStatusApi PATCH /charts/ingest-jobs/{jobId}/status"));
}

export function cancelJob(jobId: string): Promise<IngestJob | null> {
  return wpPost<{ job: unknown }>(`/charts/ingest-jobs/${jobId}/cancel`)
    .then((res) => (res.job ? fromWpIngestJob(res.job) : null))
    .catch(() => notImplemented("cancelJob POST /charts/ingest-jobs/{jobId}/cancel"));
}

export function retryJob(jobId: string): Promise<IngestJob | null> {
  return wpPost<{ job: unknown }>(`/charts/ingest-jobs/${jobId}/retry`)
    .then((res) => (res.job ? fromWpIngestJob(res.job) : null))
    .catch(() => notImplemented("retryJob POST /charts/ingest-jobs/{jobId}/retry"));
}

export function deleteJobApi(jobId: string): Promise<boolean> {
  return wpDelete<{ success: boolean }>(`/charts/ingest-jobs/${jobId}`)
    .then((res) => res.success ?? true)
    .catch(() => notImplemented("deleteJobApi DELETE /charts/ingest-jobs/{jobId}"));
}

// ─── Sources ───
export function getSources(jobId: string): Promise<IngestSource[]> {
  return wpGet<{ sources: unknown[] }>(`/charts/ingest-jobs/${jobId}/sources`)
    .then((res) => (res.sources || []).map(fromWpSource))
    .catch(() => notImplemented("getSources GET /charts/ingest-jobs/{jobId}/sources"));
}

export function addSourceApi(jobId: string, payload: AddSourcePayload): Promise<IngestSource> {
  return wpPost<{ source: unknown }>(`/charts/ingest-jobs/${jobId}/sources`, toWpSourcePayload(payload))
    .then((res) => fromWpSource(res.source))
    .catch(() => notImplemented("addSourceApi POST /charts/ingest-jobs/{jobId}/sources"));
}

export function removeSourceApi(sourceId: string): Promise<void> {
  // Note: We need jobId to construct the path. In WordPress mode, this may need to be
  // fetched differently or the endpoint may accept just sourceId.
  return wpDelete<void>(`/charts/ingest-jobs/-/sources/${sourceId}`)
    .then(() => undefined)
    .catch(() => notImplemented("removeSourceApi DELETE /charts/ingest-jobs/{jobId}/sources/{sourceId}"));
}

export function updateSourceWeight(sourceId: string, weight: number): Promise<IngestSource | null> {
  return wpPatch<{ source: unknown }>(`/charts/sources/${sourceId}/weight`, { weight })
    .then((res) => (res.source ? fromWpSource(res.source) : null))
    .catch(() => notImplemented("updateSourceWeight PATCH /charts/sources/{sourceId}/weight"));
}

export function toggleSourceEnabled(sourceId: string): Promise<IngestSource | null> {
  return wpPatch<{ source: unknown }>(`/charts/sources/${sourceId}/toggle`, {})
    .then((res) => (res.source ? fromWpSource(res.source) : null))
    .catch(() => notImplemented("toggleSourceEnabled PATCH /charts/sources/{sourceId}/toggle"));
}

export function fetchSources(jobId: string): Promise<IngestSource[]> {
  return wpPost<{ sources: unknown[] }>(`/charts/ingest-jobs/${jobId}/fetch-sources`)
    .then((res) => (res.sources || []).map(fromWpSource))
    .catch(() => notImplemented("fetchSources POST /charts/ingest-jobs/{jobId}/fetch-sources"));
}

// ─── Raw Items ───
export function getRawItems(jobId: string): Promise<RawSourceItem[]> {
  return wpGet<{ raw_items: unknown[] }>(`/charts/ingest-jobs/${jobId}/raw-items`)
    .then((res) => (res.raw_items || []) as RawSourceItem[])
    .catch(() => notImplemented("getRawItems GET /charts/ingest-jobs/{jobId}/raw-items"));
}

// ─── Candidates ───
export function getCandidates(jobId: string): Promise<IngestCandidate[]> {
  return wpGet<{ candidates: unknown[] }>(`/charts/ingest-jobs/${jobId}/candidates`)
    .then((res) => (res.candidates || []).map(fromWpCandidate))
    .catch(() => notImplemented("getCandidates GET /charts/ingest-jobs/{jobId}/candidates"));
}

export function getCandidateById(
  jobId: string,
  candidateId: string
): Promise<IngestCandidate | null> {
  return wpGet<{ candidate: unknown }>(`/charts/ingest-jobs/${jobId}/candidates/${candidateId}`)
    .then((res) => (res.candidate ? fromWpCandidate(res.candidate) : null))
    .catch(() => notImplemented("getCandidateById GET /charts/ingest-jobs/{jobId}/candidates/{candidateId}"));
}

export function approveCandidate(candidateId: string): Promise<IngestCandidate | null> {
  return wpPatch<{ candidate: unknown }>(`/charts/candidates/${candidateId}/approve`, {})
    .then((res) => (res.candidate ? fromWpCandidate(res.candidate) : null))
    .catch(() => notImplemented("approveCandidate PATCH /charts/candidates/{candidateId}/approve"));
}

export function excludeCandidate(candidateId: string): Promise<IngestCandidate | null> {
  return wpPatch<{ candidate: unknown }>(`/charts/candidates/${candidateId}/exclude`, { reason: "Manually excluded by admin" })
    .then((res) => (res.candidate ? fromWpCandidate(res.candidate) : null))
    .catch(() => notImplemented("excludeCandidate PATCH /charts/candidates/{candidateId}/exclude"));
}

export function restoreCandidate(candidateId: string): Promise<IngestCandidate | null> {
  return wpPatch<{ candidate: unknown }>(`/charts/candidates/${candidateId}/restore`, {})
    .then((res) => (res.candidate ? fromWpCandidate(res.candidate) : null))
    .catch(() => notImplemented("restoreCandidate PATCH /charts/candidates/{candidateId}/restore"));
}

// ─── Matches ───
export function getMatches(jobId: string): Promise<IngestMatch[]> {
  return wpGet<{ matches: unknown[] }>(`/charts/ingest-jobs/${jobId}/matches`)
    .then((res) => (res.matches || []).map(fromWpMatch))
    .catch(() => notImplemented("getMatches GET /charts/ingest-jobs/{jobId}/matches"));
}

export function approveCandidateMatch(
  jobId: string,
  candidateId: string,
  matchId: string
): Promise<IngestMatch | null> {
  return wpPost<{ match: unknown }>(`/charts/ingest-jobs/${jobId}/matches/${matchId}/approve`)
    .then((res) => (res.match ? fromWpMatch(res.match) : null))
    .catch(() => notImplemented("approveCandidateMatch POST /charts/ingest-jobs/{jobId}/matches/{matchId}/approve"));
}

export function rejectCandidateMatch(
  jobId: string,
  matchId: string
): Promise<IngestMatch | null> {
  return wpPost<{ match: unknown }>(`/charts/ingest-jobs/${jobId}/matches/${matchId}/reject`, { reason: "Wrong track" })
    .then((res) => (res.match ? fromWpMatch(res.match) : null))
    .catch(() => notImplemented("rejectCandidateMatch POST /charts/ingest-jobs/{jobId}/matches/{matchId}/reject"));
}

export function rematchCandidate(
  jobId: string,
  candidateId: string,
  canonicalTrackId: string,
  confidence: number,
  method: string
): Promise<IngestMatch | null> {
  return wpPost<{ match: unknown }>(`/charts/ingest-jobs/${jobId}/candidates/${candidateId}/rematch`, {
    canonical_track_id: canonicalTrackId,
    confidence,
    method,
  })
    .then((res) => (res.match ? fromWpMatch(res.match) : null))
    .catch(() => notImplemented("rematchCandidate POST /charts/ingest-jobs/{jobId}/candidates/{candidateId}/rematch"));
}

export function markAsNewEntity(
  jobId: string,
  candidateId: string
): Promise<IngestMatch | null> {
  return wpPost<{ match: unknown }>(`/charts/ingest-jobs/${jobId}/candidates/${candidateId}/new-entity`, {})
    .then((res) => (res.match ? fromWpMatch(res.match) : null))
    .catch(() => notImplemented("markAsNewEntity POST /charts/ingest-jobs/{jobId}/candidates/{candidateId}/new-entity"));
}

// ─── Review Issues ───
export function getReviewIssues(jobId: string): Promise<ReviewIssue[]> {
  return wpGet<{ issues: unknown[] }>(`/charts/ingest-jobs/${jobId}/issues`)
    .then((res) => (res.issues || []).map(fromWpReviewIssue))
    .catch(() => notImplemented("getReviewIssues GET /charts/ingest-jobs/{jobId}/issues"));
}

export function resolveReviewIssue(
  jobId: string,
  issueId: string,
  payload: ResolveIssuePayload
): Promise<ReviewIssue | null> {
  return wpPatch<{ issue: unknown }>(`/charts/ingest-jobs/${jobId}/issues/${issueId}`, {
    resolution: payload.resolution,
    note: payload.note,
  })
    .then((res) => (res.issue ? fromWpReviewIssue(res.issue) : null))
    .catch(() => notImplemented("resolveReviewIssue PATCH /charts/ingest-jobs/{jobId}/issues/{issueId}"));
}

export function reopenIssue(
  jobId: string,
  issueId: string
): Promise<ReviewIssue | null> {
  return wpPatch<{ issue: unknown }>(`/charts/ingest-jobs/${jobId}/issues/${issueId}/reopen`, {})
    .then((res) => (res.issue ? fromWpReviewIssue(res.issue) : null))
    .catch(() => notImplemented("reopenIssue PATCH /charts/ingest-jobs/{jobId}/issues/{issueId}/reopen"));
}

// ─── Ranking ───
export function applyRankOverride(
  jobId: string,
  candidateId: string,
  payload: RankOverridePayload
): Promise<IngestCandidate | null> {
  return wpPatch<{ candidate: unknown }>(`/charts/ingest-jobs/${jobId}/candidates/${candidateId}/rank`, {
    rank: payload.rank,
    reason: payload.reason,
  })
    .then((res) => (res.candidate ? fromWpCandidate(res.candidate) : null))
    .catch(() => notImplemented("applyRankOverride PATCH /charts/ingest-jobs/{jobId}/candidates/{candidateId}/rank"));
}

export function clearRankOverride(
  jobId: string,
  candidateId: string
): Promise<IngestCandidate | null> {
  return wpPatch<{ candidate: unknown }>(`/charts/ingest-jobs/${jobId}/candidates/${candidateId}/rank`, {
    rank: null,
    reason: null,
  })
    .then((res) => (res.candidate ? fromWpCandidate(res.candidate) : null))
    .catch(() => notImplemented("clearRankOverride PATCH /charts/ingest-jobs/{jobId}/candidates/{candidateId}/rank"));
}

// ─── Draft & Publish ───
export function createDraftEdition(jobId: string): Promise<IngestJob | null> {
  return wpPost<{ job: unknown }>(`/charts/ingest-jobs/${jobId}/draft`)
    .then((res) => (res.job ? fromWpIngestJob(res.job) : null))
    .catch(() => notImplemented("createDraftEdition POST /charts/ingest-jobs/{jobId}/draft"));
}

export function publishEdition(jobId: string): Promise<IngestJob | null> {
  return wpPost<{ job: unknown }>(`/charts/ingest-jobs/${jobId}/publish`)
    .then((res) => (res.job ? fromWpIngestJob(res.job) : null))
    .catch(() => notImplemented("publishEdition POST /charts/ingest-jobs/{jobId}/publish"));
}

// ─── Logs ───
export function getJobLogs(jobId: string): Promise<IngestJobLog[]> {
  return wpGet<{ logs: unknown[] }>(`/charts/ingest-jobs/${jobId}/logs`)
    .then((res) => (res.logs || []) as IngestJobLog[])
    .catch(() => notImplemented("getJobLogs GET /charts/ingest-jobs/{jobId}/logs"));
}

// ─── Draft Entries ───
export function getDraftEntries(jobId: string): Promise<DraftEntry[]> {
  return wpGet<{ draft_entries: unknown[] }>(`/charts/ingest-jobs/${jobId}/draft`)
    .then((res) => (res.draft_entries || []).map(fromWpDraftEntry))
    .catch(() => notImplemented("getDraftEntries GET /charts/ingest-jobs/{jobId}/draft"));
}

// ─── Editions ───
export function getEditionsApi(): Promise<ChartEdition[]> {
  return wpGet<{ editions: unknown[] }>("/charts/editions")
    .then((res) => (res.editions || []).map(fromWpChartEdition))
    .catch(() => notImplemented("getEditionsApi GET /charts/editions"));
}

export function getEditionById(editionId: string): Promise<ChartEdition | null> {
  return wpGet<{ edition: unknown }>(`/charts/editions/${editionId}`)
    .then((res) => (res.edition ? fromWpChartEdition(res.edition) : null))
    .catch(() => notImplemented("getEditionById GET /charts/editions/{editionId}"));
}

// ─── Snapshots ───
export function getSnapshots(): Promise<Snapshot[]> {
  return wpGet<{ snapshots: unknown[] }>("/charts/snapshots")
    .then((res) => (res.snapshots || []).map(fromWpSnapshot))
    .catch(() => notImplemented("getSnapshots GET /charts/snapshots"));
}

// ─── Dashboard ───
export function getDashboardKpisApi(): Promise<DashboardKpis> {
  return wpGet<{ kpis: unknown }>("/charts/dashboard")
    .then((res) => (res.kpis ? fromWpDashboardKpis(res.kpis) : {
      activeJobs: 0,
      failedJobs: 0,
      pendingReviewIssues: 0,
      latestPublishedEdition: null,
      totalFamilies: 0,
      totalPublishedEditions: 0,
    }))
    .catch(() => notImplemented("getDashboardKpisApi GET /charts/dashboard"));
}

// ─── Summary ───
export function getJobSummaryApi(jobId: string): Promise<Record<string, unknown>> {
  return wpGet<{ summary: Record<string, unknown> }>(`/charts/ingest-jobs/${jobId}/summary`)
    .then((res) => res.summary || {})
    .catch(() => notImplemented("getJobSummaryApi GET /charts/ingest-jobs/{jobId}/summary"));
}

// ─── Demo data helpers ───
export function getDemoJobId(): string {
  return "demo-job-001";
}

// ─── Canonical tracks for rematch search ───
export function searchCanonicalTracks(query: string): Promise<{ id: string; title: string; artist: string }[]> {
  return wpGet<{ results: unknown[] }>("/charts/canonical-tracks/search", { query })
    .then((res) => (res.results || []) as { id: string; title: string; artist: string }[])
    .catch(() => notImplemented("searchCanonicalTracks GET /charts/canonical-tracks/search"));
}

// ─── Health Check ───
export function testWordPressConnection(): Promise<{
  ok: boolean;
  plugin: string;
  charts_ingestion: boolean;
  version: string;
}> {
  return wpGet<{
    ok: boolean;
    plugin: string;
    charts_ingestion: boolean;
    version: string;
  }>("/charts/health");
}

// ─── Retry Helpers ───
export function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let attempt = 0;

  const tryFn = async (): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;

      const isRetryable =
        err instanceof WpApiError && err.retryable;
      if (!isRetryable) throw err;

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((res) => setTimeout(res, delay));
      return tryFn();
    }
  };

  return tryFn();
}

export { WpApiError };
export { WP_API_BASE };

// ─── Ingest Studio (Provider-based Runs) — WordPress v2 endpoints ───
export const WP_API_BASE_V2 = WP_API_BASE.replace(/\/v1/, "/v2");

import type {
  IngestRun,
  IngestStudioKpi,
  RecentIngestActivity,
  ResourceGuardStatus,
  CreateIngestDryRunResponse,
  CommitIngestRunResponse,
} from "./ingestStudioTypes";

export function getIngestRunsWp(): Promise<IngestRun[]> {
  return wpGet<{ runs: unknown[] }>(`${WP_API_BASE_V2}/charts/ingest/runs`)
    .then((res) => (res.runs || []) as IngestRun[])
    .catch(() => notImplemented("getIngestRunsWp GET /wp-json/wakilisha/v2/charts/ingest/runs"));
}

export function getIngestRunWp(runId: string): Promise<IngestRun | null> {
  return wpGet<{ run: unknown }>(`${WP_API_BASE_V2}/charts/ingest/runs/${runId}`)
    .then((res) => (res.run ?? null) as IngestRun | null)
    .catch(() => notImplemented("getIngestRunWp GET /wp-json/wakilisha/v2/charts/ingest/runs/{runId}"));
}

export function getIngestKpisWp(): Promise<IngestStudioKpi> {
  return wpGet<{ kpis: IngestStudioKpi }>(`${WP_API_BASE_V2}/charts/ingest/kpis`)
    .then((res) => res.kpis || { editionsThisWeek: 0, canonicalMatchRate: 0, rowsAwaitingReview: 0, averageRunTimeMs: 0 })
    .catch(() => notImplemented("getIngestKpisWp GET /wp-json/wakilisha/v2/charts/ingest/kpis"));
}

export function getRecentIngestActivityWp(): Promise<RecentIngestActivity[]> {
  return wpGet<{ activity: unknown[] }>(`${WP_API_BASE_V2}/charts/ingest/activity`)
    .then((res) => (res.activity || []) as RecentIngestActivity[])
    .catch(() => notImplemented("getRecentIngestActivityWp GET /wp-json/wakilisha/v2/charts/ingest/activity"));
}

export function runDryRunWp(request: {
  chartTitle: string;
  chartSlug: string;
  editionDate: string;
  chartSize: number;
  market: string;
  chartKind: "tracks" | "releases";
  coverStyle?: string;
  sourceUrls: string[];
  saveAsRecurringSeries?: boolean;
  existingSeriesId?: string | null;
}): Promise<CreateIngestDryRunResponse> {
  return wpPost<CreateIngestDryRunResponse>(`${WP_API_BASE_V2}/charts/ingest/dry-run`, {
    chart_title: request.chartTitle,
    chart_slug: request.chartSlug,
    edition_date: request.editionDate,
    chart_size: request.chartSize,
    market: request.market,
    chart_kind: request.chartKind,
    cover_style: request.coverStyle ?? "default",
    source_urls: request.sourceUrls,
    save_as_recurring_series: request.saveAsRecurringSeries ?? false,
    existing_series_id: request.existingSeriesId ?? null,
  }).catch(() => notImplemented("runDryRunWp POST /wp-json/wakilisha/v2/charts/ingest/dry-run"));
}

export function commitIngestRunWp(request: {
  runId: string;
  publishImmediately?: boolean;
  notes?: string;
}): Promise<CommitIngestRunResponse> {
  return wpPost<CommitIngestRunResponse>(`${WP_API_BASE_V2}/charts/ingest/runs/${request.runId}/commit`, {
    publish_immediately: request.publishImmediately ?? false,
    notes: request.notes ?? "",
  }).catch(() => notImplemented("commitIngestRunWp POST /wp-json/wakilisha/v2/charts/ingest/runs/{runId}/commit"));
}

export function cancelIngestRunWp(runId: string): Promise<IngestRun | null> {
  return wpPost<{ run: IngestRun }>(`${WP_API_BASE_V2}/charts/ingest/runs/${runId}/cancel`)
    .then((res) => res.run ?? null)
    .catch(() => notImplemented("cancelIngestRunWp POST /wp-json/wakilisha/v2/charts/ingest/runs/{runId}/cancel"));
}

export function retryIngestRunWp(runId: string): Promise<IngestRun | null> {
  return wpPost<{ run: IngestRun }>(`${WP_API_BASE_V2}/charts/ingest/runs/${runId}/retry`)
    .then((res) => res.run ?? null)
    .catch(() => notImplemented("retryIngestRunWp POST /wp-json/wakilisha/v2/charts/ingest/runs/{runId}/retry"));
}

export function sendGapsToReviewWp(runId: string): Promise<IngestRun | null> {
  return wpPost<{ run: IngestRun }>(`${WP_API_BASE_V2}/charts/ingest/runs/${runId}/send-gaps`)
    .then((res) => res.run ?? null)
    .catch(() => notImplemented("sendGapsToReviewWp POST /wp-json/wakilisha/v2/charts/ingest/runs/{runId}/send-gaps"));
}

export function getResourceGuardStatusWp(runId: string): Promise<ResourceGuardStatus> {
  return wpGet<{ guard: ResourceGuardStatus }>(`${WP_API_BASE_V2}/charts/ingest/runs/${runId}/resource-guard`)
    .then((res) => res.guard || {
      sourceCount: 0,
      providerBudgetRemaining: 100,
      workerConcurrency: 4,
      estimatedRowCount: 0,
      duplicateRunWarning: null,
      sameEditionDateWarning: null,
    })
    .catch(() => notImplemented("getResourceGuardStatusWp GET /wp-json/wakilisha/v2/charts/ingest/runs/{runId}/resource-guard"));
}

export function getIngestHealthWp(): Promise<{
  ok: boolean;
  plugin: string;
  charts_ingestion: boolean;
  version: string;
}> {
  return wpGet<{
    ok: boolean;
    plugin: string;
    charts_ingestion: boolean;
    version: string;
  }>(`${WP_API_BASE_V2}/charts/health`);
}

// ─── WordPress Ingest Studio endpoint definitions for Health page ───
export interface IngestStudioEndpointDef {
  key: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  status: "planned" | "not_configured";
  group: string;
}

// ─── Stub store functions for WordPress mode (server-side) ───
// These are no-ops in WordPress mode as state is server-side.
export function getStudioStore(): { runs: IngestRun[]; kpis: { editionsThisWeek: number; canonicalMatchRate: number; rowsAwaitingReview: number; averageRunTimeMs: number }; activity: unknown[] } {
  return { runs: [], kpis: { editionsThisWeek: 0, canonicalMatchRate: 0, rowsAwaitingReview: 0, averageRunTimeMs: 0 }, activity: [] };
}

export function refreshStudioStore(): ReturnType<typeof getStudioStore> {
  return getStudioStore();
}

export function resetStudioStore(): ReturnType<typeof getStudioStore> {
  // eslint-disable-next-line no-console
  console.warn("[wpAdapter] resetStudioStore() is a no-op in WordPress mode.");
  return getStudioStore();
}

export function commitStudioStore(_store: unknown): void {
  // eslint-disable-next-line no-console
  console.warn("[wpAdapter] commitStudioStore() is a no-op in WordPress mode.");
}

export const INGEST_STUDIO_WP_ENDPOINTS: IngestStudioEndpointDef[] = [
  { key: "getIngestRuns", method: "GET", path: "/wp-json/wakilisha/v2/charts/ingest/runs", description: "List all provider-based ingest runs", status: "planned", group: "Runs" },
  { key: "getIngestRun", method: "GET", path: "/wp-json/wakilisha/v2/charts/ingest/runs/{runId}", description: "Get a single ingest run with stages and resolved rows", status: "planned", group: "Runs" },
  { key: "runDryRun", method: "POST", path: "/wp-json/wakilisha/v2/charts/ingest/dry-run", description: "Create and execute a new dry run from source URLs", status: "planned", group: "Runs" },
  { key: "commitIngestRun", method: "POST", path: "/wp-json/wakilisha/v2/charts/ingest/runs/{runId}/commit", description: "Commit a dry-run-complete run to a published edition", status: "planned", group: "Runs" },
  { key: "cancelIngestRun", method: "POST", path: "/wp-json/wakilisha/v2/charts/ingest/runs/{runId}/cancel", description: "Cancel a running or pending ingest run", status: "planned", group: "Runs" },
  { key: "retryIngestRun", method: "POST", path: "/wp-json/wakilisha/v2/charts/ingest/runs/{runId}/retry", description: "Retry a failed ingest run", status: "planned", group: "Runs" },
  { key: "sendGapsToReview", method: "POST", path: "/wp-json/wakilisha/v2/charts/ingest/runs/{runId}/send-gaps", description: "Flag gap rows for manual review", status: "planned", group: "Runs" },
  { key: "getResourceGuard", method: "GET", path: "/wp-json/wakilisha/v2/charts/ingest/runs/{runId}/resource-guard", description: "Get resource guard / budget status for a run", status: "planned", group: "Runs" },
  { key: "getIngestKpis", method: "GET", path: "/wp-json/wakilisha/v2/charts/ingest/kpis", description: "Dashboard KPIs for the ingest studio", status: "planned", group: "Studio" },
  { key: "getIngestActivity", method: "GET", path: "/wp-json/wakilisha/v2/charts/ingest/activity", description: "Recent activity feed for the ingest studio", status: "planned", group: "Studio" },
  { key: "healthCheck", method: "GET", path: "/wp-json/wakilisha/v2/charts/health", description: "Plugin health check — verifies plugin is active and ingestion module is enabled", status: "planned", group: "System" },
];