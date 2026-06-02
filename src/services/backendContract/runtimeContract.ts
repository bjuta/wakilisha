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
import type {
  CreateChartMarketScopeRequest,
  StoredChartMarketScope,
  UpdateChartMarketScopeRequest,
} from "../chartsMarkets/marketScopeStore";

export const WAKILISHA_RUNTIME_ENDPOINTS = {
  health: { system: "GET /api/wakilisha/health" },
  settings: {
    readDomain: "GET /api/wakilisha/admin/settings/:domain",
    saveDomain: "PUT /api/wakilisha/admin/settings/:domain",
  },
  integrations: {
    providerHealth: "GET /api/wakilisha/admin/integrations/provider-health",
    testProvider: "POST /api/wakilisha/admin/integrations/:providerKey/test",
    saveProviderConfig: "PUT /api/wakilisha/admin/integrations/:providerKey/config",
    clearProviderConfig: "DELETE /api/wakilisha/admin/integrations/:providerKey/config",
  },
  charts: {
    programs: "GET /api/wakilisha/charts/programs",
    createProgram: "POST /api/wakilisha/charts/programs",
    editions: "GET /api/wakilisha/charts/editions",
    edition: "GET /api/wakilisha/charts/:publicSlug/:editionSlug",
    editionEntries: "GET /api/wakilisha/charts/:publicSlug/:editionSlug/entries",
    eligibilityProfiles: "GET /api/wakilisha/charts/eligibility-profiles",
    eligibilityProfile: "GET /api/wakilisha/charts/eligibility-profiles/:idOrSlug",
    createEligibilityProfile: "POST /api/wakilisha/charts/eligibility-profiles",
    updateEligibilityProfile: "PATCH /api/wakilisha/charts/eligibility-profiles/:id",
    marketScopes: "GET /api/wakilisha/charts/market-scopes",
    marketScope: "GET /api/wakilisha/charts/market-scopes/:idOrSlug",
    createMarketScope: "POST /api/wakilisha/charts/market-scopes",
    updateMarketScope: "PATCH /api/wakilisha/charts/market-scopes/:id",
  },
  ingestion: {
    runs: "GET /api/wakilisha/charts/ingest/runs",
    run: "GET /api/wakilisha/charts/ingest/runs/:runId",
    createRun: "POST /api/wakilisha/charts/ingest/runs",
    dryRun: "POST /api/wakilisha/charts/ingest/dry-run",
    commit: "POST /api/wakilisha/charts/ingest/runs/:runId/commit",
    cancel: "POST /api/wakilisha/charts/ingest/runs/:runId/cancel",
    retry: "POST /api/wakilisha/charts/ingest/runs/:runId/retry",
    sendGapsToReview: "POST /api/wakilisha/charts/ingest/runs/:runId/send-gaps",
    applyMatchDecision: "POST /api/wakilisha/charts/ingest/runs/:runId/rows/:rowId/match-decision",
  },
  registry: { health: "GET /api/wakilisha/registry/health" },
} as const;

export type BackendCreateProgramRequest = Partial<BackendChartProgram> & {
  label: string;
  seriesSlug: string;
  marketSlug: string;
  publicSlug?: string;
};

export type BackendCreateRunRequest = Partial<BackendIngestRun> & {
  chartTitle: string;
  chartSlug: string;
  editionDate: string;
  sourceUrls: string[];
};

export type BackendMatchDecisionRequest = {
  runId: string;
  rowId: string;
  action: string;
  canonicalTrackId?: string;
};

export type RuntimeBackendAdapter = {
  health: { getSystemHealth(): Promise<BackendResult<BackendHealth>> };
  charts: {
    getPrograms(): Promise<BackendResult<BackendChartProgram[]>>;
    createProgram(payload: BackendCreateProgramRequest): Promise<BackendResult<BackendChartProgram>>;
    getEditions(): Promise<BackendResult<BackendChartEdition[]>>;
    getEdition(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEdition | null>>;
    getEditionEntries(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEntry[]>>;
    getEligibilityProfiles(): Promise<BackendResult<BackendChartEligibilityProfile[]>>;
    getEligibilityProfile(idOrSlug: string): Promise<BackendResult<BackendChartEligibilityProfile | null>>;
    createEligibilityProfile(payload: BackendCreateChartEligibilityProfileRequest): Promise<BackendResult<BackendChartEligibilityProfile>>;
    updateEligibilityProfile(payload: BackendUpdateChartEligibilityProfileRequest): Promise<BackendResult<BackendChartEligibilityProfile>>;
    getMarketScopes(): Promise<BackendResult<StoredChartMarketScope[]>>;
    getMarketScope(idOrSlug: string): Promise<BackendResult<StoredChartMarketScope | null>>;
    createMarketScope(payload: CreateChartMarketScopeRequest): Promise<BackendResult<StoredChartMarketScope>>;
    updateMarketScope(payload: UpdateChartMarketScopeRequest): Promise<BackendResult<StoredChartMarketScope>>;
  };
  ingestion: {
    getRuns(): Promise<BackendResult<BackendIngestRun[]>>;
    getRun(runId: string): Promise<BackendResult<BackendIngestRun | null>>;
    createRun(payload: BackendCreateRunRequest): Promise<BackendResult<BackendIngestRun>>;
    runDryRun(request: BackendDryRunRequest): Promise<BackendResult<BackendDryRunResponse>>;
    commitRun(request: BackendCommitRequest): Promise<BackendResult<BackendCommitResponse>>;
    cancelRun(runId: string): Promise<BackendResult<BackendIngestRun | null>>;
    retryRun(runId: string): Promise<BackendResult<BackendIngestRun | null>>;
    sendGapsToReview(runId: string): Promise<BackendResult<BackendIngestRun | null>>;
    applyMatchDecision(payload: BackendMatchDecisionRequest): Promise<BackendResult<BackendIngestRun | null>>;
  };
  settings: {
    getSettings(domain?: string): Promise<BackendResult<BackendAdminSettings>>;
    saveSettings(domain: string, payload: BackendAdminSettings): Promise<BackendResult<BackendAdminSettings>>;
  };
  integrations: {
    getProviderHealth(): Promise<BackendResult<BackendProviderHealth[]>>;
    testProvider(providerKey: string): Promise<BackendResult<BackendProviderHealth>>;
    saveProviderConfig(providerKey: string, payload: Record<string, unknown>): Promise<BackendResult<BackendProviderHealth>>;
    clearProviderConfig(providerKey: string): Promise<BackendResult<BackendProviderHealth>>;
  };
  registry: { getHealth(): Promise<BackendResult<BackendHealth>> };
};

export type RuntimeBackendDomain = keyof typeof WAKILISHA_RUNTIME_ENDPOINTS;
