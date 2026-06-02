import {
  getIngestRunsWp,
  getIngestRunWp,
  runDryRunWp,
  commitIngestRunWp,
  cancelIngestRunWp,
  retryIngestRunWp,
  sendGapsToReviewWp,
  getIngestHealthWp,
} from "../chartsIngestion/wpAdapter";
import {
  getV2ChartFamilies,
  getV2ChartEditionsForFamily,
  getV2ChartEditionEntries,
} from "../chartsPublic/v2Adapter";
import type { IngestRun } from "../chartsIngestion/ingestStudioTypes";
import type { CommitIngestRunResponse as LegacyCommitResponse } from "../chartsIngestion/commitTypes";
import {
  backendFail,
  backendOk,
  createBackendMeta,
  backendError,
  endpointNotImplemented,
  unknownBackendError,
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

function backendMeta(extraWarnings: string[] = []) {
  return createBackendMeta({
    runtimeMode: "backend",
    backendProvider: backendConfig.backendProvider === "unknown" ? "wordpress" : backendConfig.backendProvider,
    repositoryMode: backendConfig.repositoryMode === "localStorage" ? "api" : backendConfig.repositoryMode,
    source: "backend",
    warnings: [...getBackendModeWarnings({ ...backendConfig, runtimeMode: "backend" }), ...extraWarnings],
  });
}

function toSafeError(error: unknown, expectedEndpoint?: string) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown backend error");

  if (message.includes("WordPress endpoint not implemented") || message.includes("not implemented")) {
    return endpointNotImplemented(expectedEndpoint ?? "WordPress endpoint not implemented");
  }

  if (message.includes("Network error") || message.includes("unable to reach")) {
    return backendError("network_error", "Unable to reach the WAKILISHA backend.", {
      detail: message,
      retryable: true,
      action: { label: "Open API Health", href: "/admin/settings/charts/ingest-health" },
    });
  }

  if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
    return backendError("unauthorized", "The backend rejected this request as unauthorized.", {
      detail: message,
      retryable: false,
      action: { label: "Check Admin Session", href: "/admin/settings/audit" },
    });
  }

  if (message.includes("403") || message.toLowerCase().includes("forbidden")) {
    return backendError("forbidden", "The backend rejected this request because the current user lacks permission.", {
      detail: message,
      retryable: false,
    });
  }

  return unknownBackendError(error);
}

function safeFail<T>(error: unknown, expectedEndpoint?: string, fallback?: unknown): BackendResult<T> {
  return backendFail<T>(toSafeError(error, expectedEndpoint), backendMeta(), fallback);
}

function toBackendRun(run: IngestRun): BackendIngestRun {
  return {
    id: run.id,
    chartTitle: run.chartTitle,
    chartSlug: run.chartSlug,
    editionDate: run.editionDate,
    status: run.status,
    publicSlug: run.editionSlug ?? run.existingSeriesId ?? null,
    programId: run.existingSeriesId ?? null,
    sourceUrls: run.sourceUrls,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    errorMessage: run.errorMessage ?? null,
  };
}

function normalizeDryRunRequest(request: BackendDryRunRequest) {
  return {
    chartTitle: request.chartTitle,
    chartSlug: request.chartSlug,
    editionDate: request.editionDate,
    chartSize: request.chartSize,
    market: request.market,
    chartKind: request.chartKind === "releases" ? "releases" as const : "tracks" as const,
    coverStyle: request.coverStyle,
    sourceUrls: request.sourceUrls,
    saveAsRecurringSeries: request.saveAsRecurringSeries,
    existingSeriesId: request.existingSeriesId,
  };
}

function normalizeCommitResponse(response: LegacyCommitResponse): BackendCommitResponse {
  const persistence: BackendCommitResponse["commitPersistence"] = response.status === "committed" ? "backend_persisted" : "local_only";
  const availability: BackendCommitResponse["publicAvailability"] = response.integrity?.ok ? "api_verified" : "not_public";

  return {
    runId: response.runId,
    status: "committed",
    programId: response.programId,
    publicSlug: response.publicSlug,
    editionId: response.editionId,
    editionSlug: response.editionSlug,
    editionDate: response.editionDate,
    entryCount: response.entryCount,
    publicUrl: response.publicUrl,
    apiUrl: response.apiUrl,
    snapshotId: response.snapshotId,
    commitPersistence: persistence,
    publicAvailability: availability,
    integrity: response.integrity,
    auditEventId: response.auditEventId,
  };
}

export const wordpressBackendAdapter = {
  health: {
    async getSystemHealth(): Promise<BackendResult<BackendHealth>> {
      try {
        const health = await getIngestHealthWp();
        return backendOk(
          {
            capability: health.ok ? "available" : "degraded",
            runtimeMode: "backend",
            backendProvider: "wordpress",
            repositoryMode: backendConfig.repositoryMode === "database" ? "database" : "api",
            apiReachable: health.ok,
            v2ProgramsReachable: health.ok,
            ingestEndpointsReachable: Boolean(health.charts_ingestion),
            commitEndpointReachable: Boolean(health.charts_ingestion),
            settingsEndpointReachable: false,
            providerCredentialStatus: [],
            checkedAt: new Date().toISOString(),
            warnings: health.charts_ingestion ? [] : ["Charts ingestion endpoint health is not confirmed."],
          },
          backendMeta()
        );
      } catch (error) {
        return safeFail<BackendHealth>(error, "GET /wp-json/wakilisha/v2/charts/health");
      }
    },
  },

  charts: {
    async getPrograms(): Promise<BackendResult<BackendChartProgram[]>> {
      try {
        const programs = await getV2ChartFamilies();
        return backendOk(
          programs.map((program) => ({
            id: program.id,
            publicSlug: program.familyKey,
            seriesSlug: program.familyKey,
            marketSlug: "unknown",
            label: program.label,
            status: "active" as const,
          })),
          backendMeta()
        );
      } catch (error) {
        return safeFail<BackendChartProgram[]>(error, "GET /wp-json/wakilisha/v2/charts", []);
      }
    },

    async getEditions(): Promise<BackendResult<BackendChartEdition[]>> {
      try {
        const programs = await getV2ChartFamilies();
        const groups = await Promise.all(
          programs.map(async (program) => ({ program, editions: await getV2ChartEditionsForFamily(program.familyKey) }))
        );
        const editions: BackendChartEdition[] = groups.flatMap(({ program, editions }) =>
          editions.map((edition) => ({
            id: edition.id,
            programId: program.id,
            publicSlug: program.familyKey,
            editionSlug: edition.editionKey,
            editionLabel: edition.label,
            editionDate: edition.publishedAt ?? edition.updatedAt ?? "",
            status: "published" as const,
            entryCount: edition.entryCount ?? 0,
            publicUrl: `/charts/${program.familyKey}/${edition.editionKey}`,
            apiUrl: `/wp-json/wakilisha/v2/charts/${program.familyKey}/${edition.editionKey}`,
            sourceRunId: null,
            snapshotId: null,
          }))
        );
        return backendOk(editions, backendMeta());
      } catch (error) {
        return safeFail<BackendChartEdition[]>(error, "GET /wp-json/wakilisha/v2/charts/{program}/{edition}", []);
      }
    },

    async getEdition(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEdition | null>> {
      try {
        const editions = await getV2ChartEditionsForFamily(publicSlug);
        const edition = editions.find((item) => item.editionKey === editionSlug || item.id === editionSlug);
        return backendOk(
          edition
            ? {
                id: edition.id,
                programId: publicSlug,
                publicSlug,
                editionSlug: edition.editionKey,
                editionLabel: edition.label,
                editionDate: edition.publishedAt ?? edition.updatedAt ?? "",
                status: "published",
                entryCount: edition.entryCount ?? 0,
                publicUrl: `/charts/${publicSlug}/${edition.editionKey}`,
                apiUrl: `/wp-json/wakilisha/v2/charts/${publicSlug}/${edition.editionKey}`,
                sourceRunId: null,
                snapshotId: null,
              }
            : null,
          backendMeta()
        );
      } catch (error) {
        return safeFail<BackendChartEdition | null>(error, `GET /wp-json/wakilisha/v2/charts/${publicSlug}/${editionSlug}`, null);
      }
    },

    async getEditionEntries(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEntry[]>> {
      try {
        const entries = await getV2ChartEditionEntries(publicSlug, editionSlug);
        return backendOk(
          entries.map((entry) => ({
            id: entry.id,
            editionId: editionSlug,
            rank: entry.rank,
            previousRank: entry.previousRank,
            movement: entry.movement,
            trackSlug: entry.trackSlug,
            trackTitle: entry.trackTitle,
            artistName: entry.artistName,
            artistSlug: entry.artistSlug,
            artworkUrl: entry.artworkUrl,
            sourceEntryId: entry.sourceEntryId,
            rawPayload: entry.rawPayload,
          })),
          backendMeta()
        );
      } catch (error) {
        return safeFail<BackendChartEntry[]>(error, `GET /wp-json/wakilisha/v2/charts/${publicSlug}/${editionSlug}/entries`, []);
      }
    },
  },

  ingestion: {
    async getRuns(): Promise<BackendResult<BackendIngestRun[]>> {
      try {
        const runs = await getIngestRunsWp();
        return backendOk(runs.map(toBackendRun), backendMeta());
      } catch (error) {
        return safeFail<BackendIngestRun[]>(error, "GET /wp-json/wakilisha/v2/charts/ingest/runs", []);
      }
    },

    async getRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      try {
        const run = await getIngestRunWp(runId);
        return backendOk(run ? toBackendRun(run) : null, backendMeta());
      } catch (error) {
        return safeFail<BackendIngestRun | null>(error, `GET /wp-json/wakilisha/v2/charts/ingest/runs/${runId}`, null);
      }
    },

    async runDryRun(request: BackendDryRunRequest): Promise<BackendResult<BackendDryRunResponse>> {
      try {
        const response = await runDryRunWp(normalizeDryRunRequest(request));
        return backendOk(
          {
            runId: response.runId,
            status: response.status,
            rowCount: response.rows?.length ?? response.summary?.totalRows ?? 0,
            warnings: [],
          },
          backendMeta()
        );
      } catch (error) {
        return safeFail<BackendDryRunResponse>(error, "POST /wp-json/wakilisha/v2/charts/ingest/dry-run");
      }
    },

    async commitRun(request: BackendCommitRequest): Promise<BackendResult<BackendCommitResponse>> {
      try {
        const response = await commitIngestRunWp({
          runId: request.runId,
          publishImmediately: request.publishImmediately,
          notes: request.notes,
        });
        return backendOk(normalizeCommitResponse(response), backendMeta());
      } catch (error) {
        return safeFail<BackendCommitResponse>(error, `POST /wp-json/wakilisha/v2/charts/ingest/runs/${request.runId}/commit`);
      }
    },

    async cancelRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      try {
        const run = await cancelIngestRunWp(runId);
        return backendOk(run ? toBackendRun(run) : null, backendMeta());
      } catch (error) {
        return safeFail<BackendIngestRun | null>(error, `POST /wp-json/wakilisha/v2/charts/ingest/runs/${runId}/cancel`, null);
      }
    },

    async retryRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      try {
        const run = await retryIngestRunWp(runId);
        return backendOk(run ? toBackendRun(run) : null, backendMeta());
      } catch (error) {
        return safeFail<BackendIngestRun | null>(error, `POST /wp-json/wakilisha/v2/charts/ingest/runs/${runId}/retry`, null);
      }
    },

    async sendGapsToReview(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      try {
        const run = await sendGapsToReviewWp(runId);
        return backendOk(run ? toBackendRun(run) : null, backendMeta());
      } catch (error) {
        return safeFail<BackendIngestRun | null>(error, `POST /wp-json/wakilisha/v2/charts/ingest/runs/${runId}/send-gaps`, null);
      }
    },
  },
};

export type WordPressBackendAdapter = typeof wordpressBackendAdapter;