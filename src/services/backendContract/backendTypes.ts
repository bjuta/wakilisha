/*
 * WAKILISHA Backend Contract — Commit 1
 *
 * This file defines the one safe result shape that frontend code should use
 * when talking to any WAKILISHA backend implementation. Adapters may be local,
 * WordPress, Node, Supabase, or something else later; UI code should receive
 * typed success/failure data instead of raw thrown errors.
 */

import type { ChartEligibilityProfile, CreateChartEligibilityProfileRequest, UpdateChartEligibilityProfileRequest } from "../chartsEligibility/eligibilityTypes";

export type WakilishaRuntimeMode = "local" | "backend";
export type WakilishaBackendProvider = "wordpress" | "node" | "supabase" | "unknown";
export type WakilishaRepositoryMode = "localStorage" | "api" | "database" | "unknown";
export type BackendCapability = "available" | "degraded" | "unavailable";
export type BackendResultSource = "backend" | "local_fallback" | "cache" | "fixture";

export type BackendErrorCode =
  | "backend_unavailable"
  | "endpoint_not_implemented"
  | "network_error"
  | "unauthorized"
  | "forbidden"
  | "validation_failed"
  | "provider_credentials_missing"
  | "program_not_found"
  | "eligibility_profile_not_found"
  | "duplicate_edition"
  | "commit_not_ready"
  | "public_api_verification_failed"
  | "local_only"
  | "unknown_error";

export type BackendSuggestedAction = {
  label: string;
  href?: string;
  actionKey?: string;
};

export type BackendError = {
  code: BackendErrorCode;
  message: string;
  detail?: string;
  retryable: boolean;
  action?: BackendSuggestedAction;
};

export type BackendResultMeta = {
  runtimeMode: WakilishaRuntimeMode;
  backendProvider: WakilishaBackendProvider;
  repositoryMode: WakilishaRepositoryMode;
  source: BackendResultSource;
  servedAt: string;
  requestId?: string;
  warnings: string[];
};

export type BackendResult<T> =
  | {
      ok: true;
      data: T;
      meta: BackendResultMeta;
    }
  | {
      ok: false;
      error: BackendError;
      fallback?: unknown;
      meta: BackendResultMeta;
    };

export type BackendHealth = {
  capability: BackendCapability;
  runtimeMode: WakilishaRuntimeMode;
  backendProvider: WakilishaBackendProvider;
  repositoryMode: WakilishaRepositoryMode;
  apiReachable: boolean;
  v2ProgramsReachable: boolean;
  ingestEndpointsReachable: boolean;
  commitEndpointReachable: boolean;
  settingsEndpointReachable: boolean;
  providerCredentialStatus: BackendProviderHealth[];
  checkedAt: string;
  warnings: string[];
};

export type BackendProviderHealth = {
  providerKey: "spotify" | "apple_music" | "acrcloud" | "youtube" | "airplay" | string;
  capability: BackendCapability;
  isConfigured: boolean;
  missingFields: string[];
  lastTestedAt?: string | null;
  message?: string;
};

export type BackendChartProgram = {
  id: string;
  publicSlug: string;
  seriesSlug: string;
  marketSlug: string;
  label: string;
  eligibilityProfileId?: string | null;
  chartKind?: "tracks" | "releases" | "artists" | "videos";
  visibility?: "public" | "private" | "internal_only";
  defaultMethodologyVersion?: string;
  defaultEligibilityRulesVersion?: string;
  status?: "active" | "draft" | "paused" | "archived";
};

export type BackendChartEdition = {
  id: string;
  programId: string;
  publicSlug: string;
  editionSlug: string;
  editionLabel: string;
  editionDate: string;
  periodStart?: string;
  periodEnd?: string;
  status: "draft" | "staged" | "published" | "archived";
  entryCount: number;
  publicUrl?: string;
  apiUrl?: string;
  sourceRunId?: string | null;
  snapshotId?: string | null;
};

export type BackendChartEntry = {
  id: string;
  editionId: string;
  rank: number;
  previousRank?: number | null;
  movement?: "up" | "down" | "same" | "new" | "reentry" | null;
  trackSlug?: string | null;
  trackTitle: string;
  artistName: string;
  artistSlug?: string | null;
  artworkUrl?: string | null;
  sourceEntryId?: string | null;
  rawPayload?: Record<string, unknown>;
};

export type BackendIngestRun = {
  id: string;
  chartTitle: string;
  chartSlug: string;
  editionDate: string;
  status: "draft" | "running" | "dry_run_complete" | "ready_to_commit" | "needs_review" | "committed" | "failed" | "cancelled";
  publicSlug?: string | null;
  programId?: string | null;
  eligibilityProfileId?: string | null;
  sourceUrls: string[];
  createdAt: string;
  updatedAt: string;
  errorMessage?: string | null;
};

export type BackendDryRunRequest = {
  chartTitle: string;
  chartSlug: string;
  editionDate: string;
  chartSize: number;
  market: string;
  chartKind: "tracks" | "releases" | "artists" | "videos";
  coverStyle?: string;
  sourceUrls: string[];
  saveAsRecurringSeries?: boolean;
  existingSeriesId?: string | null;
  eligibilityProfileId?: string | null;
};

export type BackendDryRunResponse = {
  runId: string;
  status: BackendIngestRun["status"];
  publicSlug?: string | null;
  rowCount?: number;
  warnings: string[];
};

export type CommitPersistence = "local_only" | "backend_persisted" | "database_persisted";
export type PublicAvailability = "not_public" | "local_preview_only" | "api_verified";

export type BackendCommitRequest = {
  runId: string;
  publishImmediately?: boolean;
  overwriteExisting?: false;
  notes?: string;
};

export type BackendCommitResponse = {
  runId: string;
  status: "committed";
  programId: string;
  publicSlug: string;
  editionId: string;
  editionSlug: string;
  editionDate: string;
  entryCount: number;
  publicUrl: string;
  apiUrl: string;
  snapshotId?: string | null;
  commitPersistence: CommitPersistence;
  publicAvailability: PublicAvailability;
  integrity: {
    ok: boolean;
    warnings: string[];
    errors: string[];
  };
  auditEventId?: string | null;
};

export type BackendAdminSettings = Record<string, unknown>;
export type BackendChartEligibilityProfile = ChartEligibilityProfile;
export type BackendCreateChartEligibilityProfileRequest = CreateChartEligibilityProfileRequest;
export type BackendUpdateChartEligibilityProfileRequest = UpdateChartEligibilityProfileRequest;

export function createBackendMeta(
  overrides: Partial<BackendResultMeta> & Pick<BackendResultMeta, "runtimeMode" | "backendProvider" | "repositoryMode" | "source">
): BackendResultMeta {
  return {
    servedAt: new Date().toISOString(),
    warnings: [],
    ...overrides,
  };
}

export function backendOk<T>(data: T, meta: BackendResultMeta): BackendResult<T> {
  return { ok: true, data, meta };
}

export function backendFail<T = never>(error: BackendError, meta: BackendResultMeta, fallback?: unknown): BackendResult<T> {
  return { ok: false, error, meta, fallback };
}

export function backendError(
  code: BackendErrorCode,
  message: string,
  options: Partial<Omit<BackendError, "code" | "message">> = {}
): BackendError {
  return {
    code,
    message,
    retryable: false,
    ...options,
  };
}

export function endpointNotImplemented(endpoint: string, actionHref = "/admin/charts/ingest-health"): BackendError {
  return backendError("endpoint_not_implemented", "The backend endpoint is not implemented.", {
    detail: `Expected endpoint: ${endpoint}`,
    retryable: false,
    action: { label: "Open API Health", href: actionHref },
  });
}

export function unknownBackendError(error: unknown): BackendError {
  return backendError("unknown_error", error instanceof Error ? error.message : "Unknown backend error.", {
    retryable: false,
  });
}
