import {
  backendFail,
  backendOk,
  createBackendMeta,
  endpointNotImplemented,
  type BackendAdminSettings,
  type BackendChartEdition,
  type BackendChartEligibilityProfile,
  type BackendChartEntry,
  type BackendChartProgram,
  type BackendCommitRequest,
  type BackendCommitResponse,
  type BackendCreateChartEligibilityProfileRequest,
  type BackendDryRunRequest,
  type BackendDryRunResponse,
  type BackendHealth,
  type BackendIngestRun,
  type BackendProviderHealth,
  type BackendResult,
  type BackendUpdateChartEligibilityProfileRequest,
} from "./backendTypes";
import { backendConfig, getBackendModeWarnings } from "./backendConfig";
import { WAKILISHA_RUNTIME_ENDPOINTS, type BackendCreateProgramRequest, type BackendMatchDecisionRequest, type RuntimeBackendAdapter } from "./runtimeContract";
import type {
  CreateChartMarketScopeRequest,
  StoredChartMarketScope,
  UpdateChartMarketScopeRequest,
} from "../chartsMarkets/marketScopeStore";

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
  return backendFail<T>(
    endpointNotImplemented(endpoint, "/admin/settings/backend"),
    apiMeta(["Production API adapter is not implemented yet. WordPress is no longer a runtime backend."]),
    fallback
  );
}

export const apiBackendAdapter: RuntimeBackendAdapter = {
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
    async getPrograms(): Promise<BackendResult<BackendChartProgram[]>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.charts.programs, []); },
    async createProgram(_payload: BackendCreateProgramRequest): Promise<BackendResult<BackendChartProgram>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.charts.createProgram); },
    async getEditions(): Promise<BackendResult<BackendChartEdition[]>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.charts.editions, []); },
    async getEdition(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEdition | null>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.charts.edition} (${publicSlug}/${editionSlug})`, null); },
    async getEditionEntries(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEntry[]>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.charts.editionEntries} (${publicSlug}/${editionSlug})`, []); },
    async getEligibilityProfiles(): Promise<BackendResult<BackendChartEligibilityProfile[]>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.charts.eligibilityProfiles, []); },
    async getEligibilityProfile(idOrSlug: string): Promise<BackendResult<BackendChartEligibilityProfile | null>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.charts.eligibilityProfile} (${idOrSlug})`, null); },
    async createEligibilityProfile(_payload: BackendCreateChartEligibilityProfileRequest): Promise<BackendResult<BackendChartEligibilityProfile>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.charts.createEligibilityProfile); },
    async updateEligibilityProfile(payload: BackendUpdateChartEligibilityProfileRequest): Promise<BackendResult<BackendChartEligibilityProfile>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.charts.updateEligibilityProfile} (${payload.id})`); },
    async getMarketScopes(): Promise<BackendResult<StoredChartMarketScope[]>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.charts.marketScopes, []); },
    async getMarketScope(idOrSlug: string): Promise<BackendResult<StoredChartMarketScope | null>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.charts.marketScope} (${idOrSlug})`, null); },
    async createMarketScope(_payload: CreateChartMarketScopeRequest): Promise<BackendResult<StoredChartMarketScope>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.charts.createMarketScope); },
    async updateMarketScope(payload: UpdateChartMarketScopeRequest): Promise<BackendResult<StoredChartMarketScope>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.charts.updateMarketScope} (${payload.id})`); },
  },

  ingestion: {
    async getRuns(): Promise<BackendResult<BackendIngestRun[]>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.ingestion.runs, []); },
    async getRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.ingestion.run} (${runId})`, null); },
    async runDryRun(_request: BackendDryRunRequest): Promise<BackendResult<BackendDryRunResponse>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.ingestion.dryRun); },
    async commitRun(_request: BackendCommitRequest): Promise<BackendResult<BackendCommitResponse>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.ingestion.commit); },
    async cancelRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.ingestion.cancel} (${runId})`, null); },
    async retryRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.ingestion.retry} (${runId})`, null); },
    async sendGapsToReview(runId: string): Promise<BackendResult<BackendIngestRun | null>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.ingestion.sendGapsToReview} (${runId})`, null); },
    async applyMatchDecision(_payload: BackendMatchDecisionRequest): Promise<BackendResult<BackendIngestRun | null>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.ingestion.applyMatchDecision, null); },
  },

  settings: {
    async getSettings(domain?: string): Promise<BackendResult<BackendAdminSettings>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.settings.readDomain} (${domain ?? "all"})`, {}); },
    async saveSettings(domain: string, _payload: BackendAdminSettings): Promise<BackendResult<BackendAdminSettings>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.settings.saveDomain} (${domain})`, {}); },
  },

  integrations: {
    async getProviderHealth(): Promise<BackendResult<BackendProviderHealth[]>> { return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.integrations.providerHealth, []); },
    async testProvider(providerKey: string): Promise<BackendResult<BackendProviderHealth>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.integrations.testProvider} (${providerKey})`); },
    async saveProviderConfig(providerKey: string, _payload: Record<string, unknown>): Promise<BackendResult<BackendProviderHealth>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.integrations.saveProviderConfig} (${providerKey})`); },
    async clearProviderConfig(providerKey: string): Promise<BackendResult<BackendProviderHealth>> { return unavailable(`${WAKILISHA_RUNTIME_ENDPOINTS.integrations.clearProviderConfig} (${providerKey})`); },
  },

  registry: {
    async getHealth(): Promise<BackendResult<BackendHealth>> {
      return unavailable(WAKILISHA_RUNTIME_ENDPOINTS.registry.health);
    },
  },
};
