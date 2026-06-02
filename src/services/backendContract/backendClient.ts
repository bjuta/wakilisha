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
import { backendFail, backendOk, createBackendMeta, endpointNotImplemented } from "./backendTypes";
import { apiBackendAdapter } from "./apiBackendAdapter";
import { localBackendAdapter } from "./localBackendAdapter";

const activeAdapter = isLocalRuntime() ? localBackendAdapter : apiBackendAdapter;

function contractMeta() {
  return createBackendMeta({
    runtimeMode: backendConfig.runtimeMode,
    backendProvider: backendConfig.backendProvider,
    repositoryMode: backendConfig.repositoryMode,
    source: backendConfig.runtimeMode === "local" ? "local_fallback" : "backend",
    warnings: [],
  });
}

function unavailable<T>(endpoint: string, fallback?: unknown): BackendResult<T> {
  return backendFail<T>(endpointNotImplemented(endpoint, "/admin/settings"), contractMeta(), fallback);
}

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

    createProgram(_payload: Partial<BackendChartProgram>): Promise<BackendResult<BackendChartProgram>> {
      return Promise.resolve(unavailable<BackendChartProgram>("POST /api/charts/programs"));
    },

    getEligibilityProfiles(): Promise<BackendResult<BackendChartEligibilityProfile[]>> {
      if ("getEligibilityProfiles" in activeAdapter.charts && typeof activeAdapter.charts.getEligibilityProfiles === "function") {
        return activeAdapter.charts.getEligibilityProfiles();
      }
      return Promise.resolve(unavailable<BackendChartEligibilityProfile[]>("GET /api/charts/eligibility-profiles", []));
    },

    getEligibilityProfile(idOrSlug: string): Promise<BackendResult<BackendChartEligibilityProfile | null>> {
      if ("getEligibilityProfile" in activeAdapter.charts && typeof activeAdapter.charts.getEligibilityProfile === "function") {
        return activeAdapter.charts.getEligibilityProfile(idOrSlug);
      }
      return Promise.resolve(unavailable<BackendChartEligibilityProfile | null>(`GET /api/charts/eligibility-profiles/${idOrSlug}`, null));
    },

    createEligibilityProfile(payload: BackendCreateChartEligibilityProfileRequest): Promise<BackendResult<BackendChartEligibilityProfile>> {
      if ("createEligibilityProfile" in activeAdapter.charts && typeof activeAdapter.charts.createEligibilityProfile === "function") {
        return activeAdapter.charts.createEligibilityProfile(payload);
      }
      return Promise.resolve(unavailable<BackendChartEligibilityProfile>("POST /api/charts/eligibility-profiles"));
    },

    updateEligibilityProfile(payload: BackendUpdateChartEligibilityProfileRequest): Promise<BackendResult<BackendChartEligibilityProfile>> {
      if ("updateEligibilityProfile" in activeAdapter.charts && typeof activeAdapter.charts.updateEligibilityProfile === "function") {
        return activeAdapter.charts.updateEligibilityProfile(payload);
      }
      return Promise.resolve(unavailable<BackendChartEligibilityProfile>(`PATCH /api/charts/eligibility-profiles/${payload.id}`));
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

    createRun(_payload: Partial<BackendIngestRun>): Promise<BackendResult<BackendIngestRun>> {
      return Promise.resolve(unavailable<BackendIngestRun>("POST /api/charts/ingest/runs"));
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

    applyMatchDecision(payload: { runId: string; rowId: string; action: string; canonicalTrackId?: string }): Promise<BackendResult<BackendIngestRun | null>> {
      if ("applyMatchDecision" in activeAdapter.ingestion && typeof activeAdapter.ingestion.applyMatchDecision === "function") {
        return activeAdapter.ingestion.applyMatchDecision(payload);
      }
      return Promise.resolve(unavailable<BackendIngestRun | null>("POST /api/charts/ingest/rows/:rowId/match-decision", null));
    },
  },

  settings: {
    getSettings(_domain?: string): Promise<BackendResult<BackendAdminSettings>> {
      return Promise.resolve(unavailable<BackendAdminSettings>("GET /api/admin/settings", {}));
    },

    saveSettings(_domain: string, _payload: BackendAdminSettings): Promise<BackendResult<BackendAdminSettings>> {
      return Promise.resolve(unavailable<BackendAdminSettings>("POST /api/admin/settings/:domain", {}));
    },
  },

  integrations: {
    getProviderHealth(): Promise<BackendResult<BackendProviderHealth[]>> {
      return wakilishaBackend.health.getSystemHealth().then((result) => {
        if (!result.ok) return result as BackendResult<BackendProviderHealth[]>;
        return backendOk(result.data.providerCredentialStatus, result.meta);
      });
    },

    testProvider(providerKey: string): Promise<BackendResult<BackendProviderHealth>> {
      return Promise.resolve(unavailable<BackendProviderHealth>(`POST /api/admin/integrations/${providerKey}/test`));
    },

    saveProviderConfig(providerKey: string, _payload: Record<string, unknown>): Promise<BackendResult<BackendProviderHealth>> {
      return Promise.resolve(unavailable<BackendProviderHealth>(`POST /api/admin/integrations/${providerKey}/config`));
    },

    clearProviderConfig(providerKey: string): Promise<BackendResult<BackendProviderHealth>> {
      return Promise.resolve(unavailable<BackendProviderHealth>(`POST /api/admin/integrations/${providerKey}/clear`));
    },
  },

  registry: {
    getHealth(): Promise<BackendResult<BackendHealth>> {
      return wakilishaBackend.health.getSystemHealth();
    },
  },
};

export type WakilishaBackendClient = typeof wakilishaBackend;
export { activeAdapter as wakilishaBackendAdapter };
