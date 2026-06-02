import { backendConfig, isLocalRuntime } from "./backendConfig";
import type {
  BackendAdminSettings,
  BackendChartEdition,
  BackendChartEntry,
  BackendChartProgram,
  BackendCommitRequest,
  BackendCommitResponse,
  BackendDryRunRequest,
  BackendDryRunResponse,
  BackendHealth,
  BackendIngestRun,
  BackendProviderHealth,
  BackendResult,
} from "./backendTypes";
import { backendFail, backendOk, createBackendMeta, endpointNotImplemented } from "./backendTypes";
import { localBackendAdapter } from "./localBackendAdapter";
import { wordpressBackendAdapter } from "./wordpressBackendAdapter";

const activeAdapter = isLocalRuntime() ? localBackendAdapter : wordpressBackendAdapter;

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
      return Promise.resolve(unavailable<BackendChartProgram>("POST /wp-json/wakilisha/v2/charts/programs"));
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
      return Promise.resolve(unavailable<BackendIngestRun>("POST /wp-json/wakilisha/v2/charts/ingest/runs"));
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
      return Promise.resolve(unavailable<BackendIngestRun | null>("POST /wp-json/wakilisha/v2/charts/ingest/rows/:rowId/match-decision", null));
    },
  },

  settings: {
    getSettings(_domain?: string): Promise<BackendResult<BackendAdminSettings>> {
      return Promise.resolve(unavailable<BackendAdminSettings>("GET /wp-json/wakilisha/v2/admin/settings", {}));
    },

    saveSettings(_domain: string, _payload: BackendAdminSettings): Promise<BackendResult<BackendAdminSettings>> {
      return Promise.resolve(unavailable<BackendAdminSettings>("POST /wp-json/wakilisha/v2/admin/settings/:domain", {}));
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
      return Promise.resolve(unavailable<BackendProviderHealth>(`POST /wp-json/wakilisha/v2/admin/integrations/${providerKey}/test`));
    },

    saveProviderConfig(providerKey: string, _payload: Record<string, unknown>): Promise<BackendResult<BackendProviderHealth>> {
      return Promise.resolve(unavailable<BackendProviderHealth>(`POST /wp-json/wakilisha/v2/admin/integrations/${providerKey}/config`));
    },

    clearProviderConfig(providerKey: string): Promise<BackendResult<BackendProviderHealth>> {
      return Promise.resolve(unavailable<BackendProviderHealth>(`POST /wp-json/wakilisha/v2/admin/integrations/${providerKey}/clear`));
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
