import { backendConfig, isLocalRuntime } from "./backendConfig";
import type {
  BackendAdminSettings,
  BackendChartEdition,
  BackendChartEligibilityProfile,
  BackendChartEntry,
  BackendChartProgram,
  BackendCommitRequest,
  BackendCommitResponse,
  BackendCreateChartEligibilityProfileRequest,
  BackendDryRunRequest,
  BackendDryRunResponse,
  BackendHealth,
  BackendIngestRun,
  BackendProviderHealth,
  BackendResult,
  BackendUpdateChartEligibilityProfileRequest,
} from "./backendTypes";
import { backendOk } from "./backendTypes";
import { apiBackendAdapter } from "./apiBackendAdapter";
import { localBackendAdapter } from "./localBackendAdapter";
import type {
  BackendCreateProgramRequest,
  BackendCreateRunRequest,
  BackendMatchDecisionRequest,
  RuntimeBackendAdapter,
} from "./runtimeContract";
import type {
  CreateChartMarketScopeRequest,
  StoredChartMarketScope,
  UpdateChartMarketScopeRequest,
} from "../chartsMarkets/marketScopeStore";

const activeAdapter: RuntimeBackendAdapter = isLocalRuntime() ? localBackendAdapter : apiBackendAdapter;

export const wakilishaBackend = {
  config: backendConfig,

  health: {
    getSystemHealth(): Promise<BackendResult<BackendHealth>> {
      return activeAdapter.health.getSystemHealth();
    },
  },

  charts: {
    getPrograms(): Promise<BackendResult<BackendChartProgram[]>> {
      return activeAdapter.charts.getPrograms();
    },

    getProgram(publicSlug: string): Promise<BackendResult<BackendChartProgram | null>> {
      return activeAdapter.charts.getPrograms().then((result) => {
        if (!result.ok) return result as BackendResult<BackendChartProgram | null>;
        return backendOk(result.data.find((program) => program.publicSlug === publicSlug) ?? null, result.meta);
      });
    },

    createProgram(payload: BackendCreateProgramRequest): Promise<BackendResult<BackendChartProgram>> {
      return activeAdapter.charts.createProgram(payload);
    },

    getEligibilityProfiles(): Promise<BackendResult<BackendChartEligibilityProfile[]>> {
      return activeAdapter.charts.getEligibilityProfiles();
    },

    getEligibilityProfile(idOrSlug: string): Promise<BackendResult<BackendChartEligibilityProfile | null>> {
      return activeAdapter.charts.getEligibilityProfile(idOrSlug);
    },

    createEligibilityProfile(payload: BackendCreateChartEligibilityProfileRequest): Promise<BackendResult<BackendChartEligibilityProfile>> {
      return activeAdapter.charts.createEligibilityProfile(payload);
    },

    updateEligibilityProfile(payload: BackendUpdateChartEligibilityProfileRequest): Promise<BackendResult<BackendChartEligibilityProfile>> {
      return activeAdapter.charts.updateEligibilityProfile(payload);
    },

    getMarketScopes(): Promise<BackendResult<StoredChartMarketScope[]>> {
      return activeAdapter.charts.getMarketScopes();
    },

    getMarketScope(idOrSlug: string): Promise<BackendResult<StoredChartMarketScope | null>> {
      return activeAdapter.charts.getMarketScope(idOrSlug);
    },

    createMarketScope(payload: CreateChartMarketScopeRequest): Promise<BackendResult<StoredChartMarketScope>> {
      return activeAdapter.charts.createMarketScope(payload);
    },

    updateMarketScope(payload: UpdateChartMarketScopeRequest): Promise<BackendResult<StoredChartMarketScope>> {
      return activeAdapter.charts.updateMarketScope(payload);
    },

    getEditions(): Promise<BackendResult<BackendChartEdition[]>> {
      return activeAdapter.charts.getEditions();
    },

    getEdition(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEdition | null>> {
      return activeAdapter.charts.getEdition(publicSlug, editionSlug);
    },

    getEditionEntries(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEntry[]>> {
      return activeAdapter.charts.getEditionEntries(publicSlug, editionSlug);
    },
  },

  ingestion: {
    getRuns(): Promise<BackendResult<BackendIngestRun[]>> {
      return activeAdapter.ingestion.getRuns();
    },

    getRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      return activeAdapter.ingestion.getRun(runId);
    },

    createRun(payload: BackendCreateRunRequest): Promise<BackendResult<BackendIngestRun>> {
      return activeAdapter.ingestion.createRun(payload);
    },

    runDryRun(request: BackendDryRunRequest): Promise<BackendResult<BackendDryRunResponse>> {
      return activeAdapter.ingestion.runDryRun(request);
    },

    commitRun(request: BackendCommitRequest): Promise<BackendResult<BackendCommitResponse>> {
      return activeAdapter.ingestion.commitRun(request);
    },

    cancelRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      return activeAdapter.ingestion.cancelRun(runId);
    },

    retryRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      return activeAdapter.ingestion.retryRun(runId);
    },

    sendGapsToReview(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      return activeAdapter.ingestion.sendGapsToReview(runId);
    },

    applyMatchDecision(payload: BackendMatchDecisionRequest): Promise<BackendResult<BackendIngestRun | null>> {
      return activeAdapter.ingestion.applyMatchDecision(payload);
    },
  },

  settings: {
    getSettings(domain?: string): Promise<BackendResult<BackendAdminSettings>> {
      return activeAdapter.settings.getSettings(domain);
    },

    saveSettings(domain: string, payload: BackendAdminSettings): Promise<BackendResult<BackendAdminSettings>> {
      return activeAdapter.settings.saveSettings(domain, payload);
    },
  },

  integrations: {
    getProviderHealth(): Promise<BackendResult<BackendProviderHealth[]>> {
      return activeAdapter.integrations.getProviderHealth();
    },

    testProvider(providerKey: string): Promise<BackendResult<BackendProviderHealth>> {
      return activeAdapter.integrations.testProvider(providerKey);
    },

    saveProviderConfig(providerKey: string, payload: Record<string, unknown>): Promise<BackendResult<BackendProviderHealth>> {
      return activeAdapter.integrations.saveProviderConfig(providerKey, payload);
    },

    clearProviderConfig(providerKey: string): Promise<BackendResult<BackendProviderHealth>> {
      return activeAdapter.integrations.clearProviderConfig(providerKey);
    },
  },

  registry: {
    getHealth(): Promise<BackendResult<BackendHealth>> {
      return activeAdapter.registry.getHealth();
    },
  },
};

export type WakilishaBackendClient = typeof wakilishaBackend;
export { activeAdapter as wakilishaBackendAdapter };
