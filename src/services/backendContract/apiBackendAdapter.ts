import {
  backendFail,
  backendOk,
  createBackendMeta,
  endpointNotImplemented,
  type BackendChartEdition,
  type BackendChartEntry,
  type BackendChartProgram,
  type BackendCommitRequest,
  type BackendCommitResponse,
  type BackendDryRunRequest,
  type BackendDryRunResponse,
  type BackendHealth,
  type BackendIngestRun,
  type BackendResult,
} from "./backendTypes";
import { backendConfig, getBackendModeWarnings } from "./backendConfig";

function apiMeta(extraWarnings: string[] = []) {
  return createBackendMeta({
    runtimeMode: "backend",
    backendProvider: backendConfig.backendProvider,
    repositoryMode: backendConfig.repositoryMode === "localStorage" ? "api" : backendConfig.repositoryMode,
    source: "backend",
    warnings: [...getBackendModeWarnings({ ...backendConfig, runtimeMode: "backend" }), ...extraWarnings],
  });
}

function unavailable<T>(endpoint: string, fallback?: unknown): BackendResult<T> {
  return backendFail<T>(endpointNotImplemented(endpoint, "/admin/settings/backend"), apiMeta(["Production API adapter is not implemented yet. WordPress is no longer a runtime backend."]), fallback);
}

export const apiBackendAdapter = {
  health: {
    async getSystemHealth(): Promise<BackendResult<BackendHealth>> {
      return backendOk(
        {
          capability: "unavailable",
          runtimeMode: "backend",
          backendProvider: backendConfig.backendProvider,
          repositoryMode: backendConfig.repositoryMode,
          apiReachable: false,
          v2ProgramsReachable: false,
          ingestEndpointsReachable: false,
          commitEndpointReachable: false,
          settingsEndpointReachable: false,
          providerCredentialStatus: [],
          checkedAt: new Date().toISOString(),
          warnings: [
            "Production API backend is not connected yet.",
            "WordPress runtime support has been removed; WordPress should only be used through legacy import tooling.",
          ],
        },
        apiMeta()
      );
    },
  },

  charts: {
    async getPrograms(): Promise<BackendResult<BackendChartProgram[]>> { return unavailable("GET /api/charts/programs", []); },
    async getEditions(): Promise<BackendResult<BackendChartEdition[]>> { return unavailable("GET /api/charts/editions", []); },
    async getEdition(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEdition | null>> { return unavailable(`GET /api/charts/${publicSlug}/${editionSlug}`, null); },
    async getEditionEntries(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEntry[]>> { return unavailable(`GET /api/charts/${publicSlug}/${editionSlug}/entries`, []); },
  },

  ingestion: {
    async getRuns(): Promise<BackendResult<BackendIngestRun[]>> { return unavailable("GET /api/charts/ingest/runs", []); },
    async getRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> { return unavailable(`GET /api/charts/ingest/runs/${runId}`, null); },
    async runDryRun(_request: BackendDryRunRequest): Promise<BackendResult<BackendDryRunResponse>> { return unavailable("POST /api/charts/ingest/dry-run"); },
    async commitRun(_request: BackendCommitRequest): Promise<BackendResult<BackendCommitResponse>> { return unavailable("POST /api/charts/ingest/runs/:runId/commit"); },
    async cancelRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> { return unavailable(`POST /api/charts/ingest/runs/${runId}/cancel`, null); },
    async retryRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> { return unavailable(`POST /api/charts/ingest/runs/${runId}/retry`, null); },
    async sendGapsToReview(runId: string): Promise<BackendResult<BackendIngestRun | null>> { return unavailable(`POST /api/charts/ingest/runs/${runId}/send-gaps`, null); },
    async applyMatchDecision(_payload: { runId: string; rowId: string; action: string; canonicalTrackId?: string }): Promise<BackendResult<BackendIngestRun | null>> { return unavailable("POST /api/charts/ingest/rows/:rowId/match-decision", null); },
  },
};
