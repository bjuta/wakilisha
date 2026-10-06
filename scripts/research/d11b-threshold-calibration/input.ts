import type {
  D11BModelInput,
  D11BSourceKey,
  RankedObservation,
} from "./models";

export interface CalibrationSourceRun {
  id: string;
  sourceKey: D11BSourceKey;
  chartDepth: number | null;
}

export interface CalibrationObservation {
  sourceRunId: string;
  providerRowKey: string;
  providerTrackId: string | null;
  rank: number;
  identityStatus: "resolved" | "unresolved" | "quarantined";
  canonicalTrackId: string | null;
}

export interface ExternalIdentityResolution {
  providerRowKey: string;
  canonicalTrackId: string;
  authority: string;
}

export interface CalibrationInputReceipt {
  modelInput: D11BModelInput;
  observationCount: number;
  resolvedObservationCount: number;
  unresolvedObservationCount: number;
  quarantinedObservationCount: number;
  externalResolutionCount: number;
  admittedSourceRunCount: number;
  expectedSourceCount: number;
}

export function buildCalibrationModelInput(args: {
  expectedSourceKeys: D11BSourceKey[];
  sourceRuns: CalibrationSourceRun[];
  observations: CalibrationObservation[];
  admittedSourceRunIds: Iterable<string>;
  externalIdentityResolutions?: ExternalIdentityResolution[];
}): CalibrationInputReceipt {
  const admittedIds = new Set(args.admittedSourceRunIds);
  const external = new Map(
    (args.externalIdentityResolutions ?? []).map((resolution) => [
      resolution.providerRowKey,
      resolution,
    ]),
  );

  const admittedRuns = args.sourceRuns.filter((run) =>
    admittedIds.has(run.id)
  );
  if (admittedRuns.length !== admittedIds.size) {
    throw new Error("unknown_admitted_source_run");
  }

  const expected = new Set(args.expectedSourceKeys);
  const sourceKeys = new Set<string>();
  for (const run of admittedRuns) {
    if (!expected.has(run.sourceKey)) {
      throw new Error(`admitted_source_not_expected:${run.sourceKey}`);
    }
    if (sourceKeys.has(run.sourceKey)) {
      throw new Error(`duplicate_admitted_source_key:${run.sourceKey}`);
    }
    if (!Number.isInteger(run.chartDepth) || (run.chartDepth ?? 0) <= 0) {
      throw new Error(`admitted_source_missing_chart_depth:${run.sourceKey}`);
    }
    sourceKeys.add(run.sourceKey);
  }

  const observationsByRun = new Map<string, CalibrationObservation[]>();
  for (const observation of args.observations) {
    const rows = observationsByRun.get(observation.sourceRunId) ?? [];
    rows.push(observation);
    observationsByRun.set(observation.sourceRunId, rows);
  }

  let resolvedObservationCount = 0;
  let unresolvedObservationCount = 0;
  let quarantinedObservationCount = 0;
  let externalResolutionCount = 0;

  for (const observation of args.observations) {
    if (observation.identityStatus === "resolved" && observation.canonicalTrackId) {
      resolvedObservationCount++;
    } else if (observation.identityStatus === "quarantined") {
      quarantinedObservationCount++;
    } else {
      unresolvedObservationCount++;
    }
  }

  const rankings: RankedObservation[] = admittedRuns.map((run) => {
    const sourceRows = observationsByRun.get(run.id) ?? [];
    const ranks = new Set<number>();
    const tracks = new Set<string>();

    const rows = sourceRows.flatMap((observation) => {
      let canonicalTrackId: string | null = null;

      if (
        observation.identityStatus === "resolved" &&
        observation.canonicalTrackId
      ) {
        canonicalTrackId = observation.canonicalTrackId;
      } else if (observation.identityStatus !== "quarantined") {
        const resolution = external.get(observation.providerRowKey);
        if (resolution) {
          canonicalTrackId = resolution.canonicalTrackId;
          externalResolutionCount++;
        }
      }

      if (!canonicalTrackId) return [];

      if (ranks.has(observation.rank)) {
        throw new Error(`duplicate_resolved_rank:${run.sourceKey}:${observation.rank}`);
      }
      if (tracks.has(canonicalTrackId)) {
        throw new Error(`duplicate_resolved_track:${run.sourceKey}:${canonicalTrackId}`);
      }

      ranks.add(observation.rank);
      tracks.add(canonicalTrackId);

      return [{
        canonicalTrackId,
        rank: observation.rank,
      }];
    });

    return {
      sourceKey: run.sourceKey,
      depth: run.chartDepth!,
      rows: rows.sort((a, b) => a.rank - b.rank),
    };
  });

  return {
    modelInput: {
      expectedSourceKeys: [...args.expectedSourceKeys],
      rankings,
    },
    observationCount: args.observations.length,
    resolvedObservationCount,
    unresolvedObservationCount,
    quarantinedObservationCount,
    externalResolutionCount,
    admittedSourceRunCount: admittedRuns.length,
    expectedSourceCount: args.expectedSourceKeys.length,
  };
}
