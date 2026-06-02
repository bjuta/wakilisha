import {
  backendFail,
  backendOk,
  createBackendMeta,
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
import {
  getIngestRuns,
  getIngestRun,
  runDryRun,
  commitIngestRun,
  cancelIngestRun,
  retryIngestRun,
  sendGapsToReview,
  applyRowMatchDecision,
  getIngestKpis,
} from "../chartsIngestion/ingestStudioMock";
import {
  V2_PROGRAMS,
  getAllV2Editions,
  getV2EditionBySlug,
  getV2EditionEntries,
} from "../chartsIngestion/client";
import type { IngestRun } from "../chartsIngestion/ingestStudioTypes";
import type { V2Edition, V2Entry } from "../chartsIngestion/commitTypes";

function localMeta(extraWarnings: string[] = []) {
  return createBackendMeta({
    runtimeMode: "local",
    backendProvider: backendConfig.backendProvider,
    repositoryMode: "localStorage",
    source: "local_fallback",
    warnings: [...getBackendModeWarnings({ ...backendConfig, runtimeMode: "local", repositoryMode: "localStorage" }), ...extraWarnings],
  });
}

function safeLocalFail<T>(error: unknown, fallback?: unknown): BackendResult<T> {
  return backendFail<T>(unknownBackendError(error), localMeta(), fallback);
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

function toBackendEdition(edition: V2Edition): BackendChartEdition {
  return {
    id: edition.id,
    programId: edition.programId,
    publicSlug: edition.publicSlug,
    editionSlug: edition.editionSlug,
    editionLabel: edition.editionLabel,
    editionDate: edition.editionDate,
    periodStart: edition.periodStart,
    periodEnd: edition.periodEnd,
    status: edition.status,
    entryCount: edition.entryCount,
    publicUrl: edition.publicUrl,
    apiUrl: edition.apiUrl,
    sourceRunId: edition.sourceRunId,
    snapshotId: edition.snapshotId,
  };
}

function toBackendEntry(entry: V2Entry): BackendChartEntry {
  return {
    id: entry.id,
    editionId: entry.editionId,
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

function normalizeCommitRequest(request: BackendCommitRequest) {
  return {
    runId: request.runId,
    publishImmediately: request.publishImmediately,
    notes: request.notes,
  };
}

export const localBackendAdapter = {
  health: {
    async getSystemHealth(): Promise<BackendResult<BackendHealth>> {
      try {
        const kpis = await getIngestKpis();
        return backendOk(
          {
            capability: "degraded",
            runtimeMode: "local",
            backendProvider: backendConfig.backendProvider,
            repositoryMode: "localStorage",
            apiReachable: true,
            v2ProgramsReachable: true,
            ingestEndpointsReachable: true,
            commitEndpointReachable: true,
            settingsEndpointReachable: false,
            providerCredentialStatus: [],
            checkedAt: new Date().toISOString(),
            warnings: [
              "Local mode is useful for UI testing but does not publish to the live WAKILISHA backend.",
              `Local ingest KPI sample: ${kpis.editionsThisWeek} editions this week.`,
            ],
          },
          localMeta()
        );
      } catch (error) {
        return safeLocalFail<BackendHealth>(error);
      }
    },
  },

  charts: {
    async getPrograms(): Promise<BackendResult<BackendChartProgram[]>> {
      try {
        return backendOk(V2_PROGRAMS.map((program) => ({ ...program, status: "active" as const })), localMeta());
      } catch (error) {
        return safeLocalFail<BackendChartProgram[]>(error, []);
      }
    },

    async getEditions(): Promise<BackendResult<BackendChartEdition[]>> {
      try {
        return backendOk(getAllV2Editions().map(toBackendEdition), localMeta(["Editions are loaded from the browser local V2 edition store."]));
      } catch (error) {
        return safeLocalFail<BackendChartEdition[]>(error, []);
      }
    },

    async getEdition(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEdition | null>> {
      try {
        const edition = getV2EditionBySlug(publicSlug, editionSlug);
        return backendOk(edition ? toBackendEdition(edition) : null, localMeta());
      } catch (error) {
        return safeLocalFail<BackendChartEdition | null>(error, null);
      }
    },

    async getEditionEntries(publicSlug: string, editionSlug: string): Promise<BackendResult<BackendChartEntry[]>> {
      try {
        const edition = getV2EditionBySlug(publicSlug, editionSlug);
        if (!edition) return backendOk([], localMeta([`No local edition found for ${publicSlug}/${editionSlug}.`]));
        return backendOk(getV2EditionEntries(edition.id).map(toBackendEntry), localMeta());
      } catch (error) {
        return safeLocalFail<BackendChartEntry[]>(error, []);
      }
    },
  },

  ingestion: {
    async getRuns(): Promise<BackendResult<BackendIngestRun[]>> {
      try {
        const runs = await getIngestRuns();
        return backendOk(runs.map(toBackendRun), localMeta());
      } catch (error) {
        return safeLocalFail<BackendIngestRun[]>(error, []);
      }
    },

    async getRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      try {
        const run = await getIngestRun(runId);
        return backendOk(run ? toBackendRun(run) : null, localMeta());
      } catch (error) {
        return safeLocalFail<BackendIngestRun | null>(error, null);
      }
    },

    async runDryRun(request: BackendDryRunRequest): Promise<BackendResult<BackendDryRunResponse>> {
      try {
        const response = await runDryRun(normalizeDryRunRequest(request));
        return backendOk(
          {
            runId: response.runId,
            status: response.status,
            rowCount: response.rows?.length ?? response.summary?.totalRows ?? 0,
            warnings: ["Dry run completed locally. This run is stored in this browser only."],
          },
          localMeta()
        );
      } catch (error) {
        return safeLocalFail<BackendDryRunResponse>(error);
      }
    },

    async commitRun(request: BackendCommitRequest): Promise<BackendResult<BackendCommitResponse>> {
      try {
        const response = await commitIngestRun(normalizeCommitRequest(request));
        return backendOk(
          {
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
            commitPersistence: "local_only",
            publicAvailability: "local_preview_only",
            integrity: response.integrity,
            auditEventId: response.auditEventId,
          },
          localMeta(["Locally committed only. This is not a public WAKILISHA publication."])
        );
      } catch (error) {
        return safeLocalFail<BackendCommitResponse>(error);
      }
    },

    async cancelRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      try {
        const run = await cancelIngestRun(runId);
        return backendOk(run ? toBackendRun(run) : null, localMeta());
      } catch (error) {
        return safeLocalFail<BackendIngestRun | null>(error, null);
      }
    },

    async retryRun(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      try {
        const run = await retryIngestRun(runId);
        return backendOk(run ? toBackendRun(run) : null, localMeta());
      } catch (error) {
        return safeLocalFail<BackendIngestRun | null>(error, null);
      }
    },

    async sendGapsToReview(runId: string): Promise<BackendResult<BackendIngestRun | null>> {
      try {
        const run = await sendGapsToReview(runId);
        return backendOk(run ? toBackendRun(run) : null, localMeta());
      } catch (error) {
        return safeLocalFail<BackendIngestRun | null>(error, null);
      }
    },

    async applyMatchDecision(payload: { runId: string; rowId: string; action: string; canonicalTrackId?: string }): Promise<BackendResult<BackendIngestRun | null>> {
      try {
        const run = await applyRowMatchDecision(payload.runId, payload.rowId, payload.action, payload.canonicalTrackId);
        return backendOk(run ? toBackendRun(run) : null, localMeta());
      } catch (error) {
        return safeLocalFail<BackendIngestRun | null>(error, null);
      }
    },
  },
};

export type LocalBackendAdapter = typeof localBackendAdapter;
