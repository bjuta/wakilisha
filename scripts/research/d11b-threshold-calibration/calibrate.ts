import { createHash } from "node:crypto";
import type {
  D11BModelInput,
  D11BSourceKey,
  RankedModelRow,
} from "./models";
import {
  fitM6,
  runM1,
  runM2,
  runM4,
} from "./models";
import {
  compareRankings,
  rankingOutputHash,
  type RankComparisonMetrics,
} from "./metrics";
import {
  M6_RANK_UNCERTAINTY_DRAWS,
  simulateM6RankUncertainty,
} from "./m6-uncertainty";
import {
  coordinatedProviderSpike,
  deleteProviderSource,
  injectOrganicTrackFlood,
  maskDepth,
  removeCanonicalIdentities,
  spikeProviderSource,
  splitCanonicalIdentity,
  thresholdEdgeSwap,
  type D11BProviderSource,
} from "./stress";

export const D11B_CALIBRATION_SPEC_VERSION =
  "d11b-threshold-calibration-v1";

export const D11B_MODEL_VERSIONS = {
  M1: "d11b-m1-equal-source-rank-v1",
  M2: "d11b-m2-equal-family-rank-v1",
  M4: "d11b-m4-borda-v1",
  M6: "d11b-m6-pl-v1",
} as const;

export type D11BModelId = keyof typeof D11B_MODEL_VERSIONS;

export interface ModelResult {
  modelId: D11BModelId;
  modelVersion: string;
  rows: RankedModelRow[];
  outputHash: string;
  diagnostics: Record<string, unknown>;
}

export interface StressResult {
  stressId: string;
  stressType:
    | "source_deletion"
    | "censoring_mask"
    | "integrity_attack"
    | "identity_perturbation";
  modelId: D11BModelId;
  parameters: Record<string, unknown>;
  metrics: RankComparisonMetrics;
  stressedOutputHash: string;
}

export interface StressGap {
  stressId: string;
  reason: string;
  parameters: Record<string, unknown>;
}

export interface ThresholdProposal {
  status: "UNRESOLVED";
  metric: string;
  rationale: string;
  requiredEvidence: string[];
}

export interface CalibrationReport {
  specVersion: string;
  modelVersions: typeof D11B_MODEL_VERSIONS;
  inputHash: string;
  models: ModelResult[];
  stresses: StressResult[];
  stressGaps: StressGap[];
  thresholdProposals: ThresholdProposal[];
  winner: null;
  confirmatory: false;
  reportHash: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function m6SensitivityDiagnostics(
  input: D11BModelInput,
  primaryFit: ReturnType<typeof fitM6>,
): Array<Record<string, unknown>> {
  return [0, 0.25, 0.5, 1].map((npseudo) => {
    try {
      const fit =
        npseudo === 0.5
          ? primaryFit
          : fitM6(input, { npseudo });
      return {
        npseudo,
        state: "completed",
        converged: fit.converged,
        iterations: fit.iterations,
        maxLogWorthDelta: fit.maxLogWorthDelta,
        outputHash: rankingOutputHash(fit.rows),
      };
    } catch (error) {
      return {
        npseudo,
        state: "failed",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      };
    }
  });
}

function runModel(
  modelId: D11BModelId,
  input: D11BModelInput,
  options: {
    modelInputHash?: string;
    includeM6Uncertainty?: boolean;
    includeM6Sensitivity?: boolean;
  } = {},
): ModelResult {
  if (modelId === "M1") {
    const rows = runM1(input);
    return {
      modelId,
      modelVersion: D11B_MODEL_VERSIONS.M1,
      rows,
      outputHash: rankingOutputHash(rows),
      diagnostics: {},
    };
  }

  if (modelId === "M2") {
    const rows = runM2(input);
    return {
      modelId,
      modelVersion: D11B_MODEL_VERSIONS.M2,
      rows,
      outputHash: rankingOutputHash(rows),
      diagnostics: {},
    };
  }

  if (modelId === "M4") {
    const rows = runM4(input);
    return {
      modelId,
      modelVersion: D11B_MODEL_VERSIONS.M4,
      rows,
      outputHash: rankingOutputHash(rows),
      diagnostics: {},
    };
  }

  const fit = fitM6(input);

  if (options.includeM6Uncertainty && !fit.converged) {
    throw new Error("m6_primary_fit_not_converged");
  }

  let rows = fit.rows;
  const diagnostics: Record<string, unknown> = {
    converged: fit.converged,
    iterations: fit.iterations,
    maxLogWorthDelta: fit.maxLogWorthDelta,
    npseudo: 0.5,
  };

  if (options.includeM6Uncertainty) {
    if (!options.modelInputHash) {
      throw new Error("m6_uncertainty_input_hash_required");
    }

    const uncertainty = simulateM6RankUncertainty({
      input,
      fit,
      modelInputHash: options.modelInputHash,
      npseudo: 0.5,
      draws: M6_RANK_UNCERTAINTY_DRAWS,
    });

    rows = fit.rows.map((row) => {
      const track = uncertainty.byTrack[row.canonicalTrackId];
      if (!track) {
        throw new Error(
          `m6_uncertainty_missing_track:${row.canonicalTrackId}`,
        );
      }
      return {
        ...row,
        rankIntervalLower: track.rankIntervalLower,
        rankIntervalUpper: track.rankIntervalUpper,
        top10Probability: track.top10Probability,
        top40Probability: track.top40Probability,
      };
    });

    diagnostics.uncertainty = {
      version: uncertainty.version,
      seedHash: uncertainty.seedHash,
      drawCount: uncertainty.drawCount,
      covarianceState: uncertainty.covarianceState,
      covarianceMethod: uncertainty.covarianceMethod,
      informationCholeskyMinDiagonal:
        uncertainty.informationCholeskyMinDiagonal,
    };
  }

  if (options.includeM6Sensitivity) {
    diagnostics.npseudoSensitivity =
      m6SensitivityDiagnostics(input, fit);
  }

  return {
    modelId,
    modelVersion: D11B_MODEL_VERSIONS.M6,
    rows,
    outputHash: rankingOutputHash(rows),
    diagnostics,
  };
}

function allModels(
  input: D11BModelInput,
  inputHash: string,
): ModelResult[] {
  return (["M1", "M2", "M4", "M6"] as const)
    .map((modelId) =>
      runModel(modelId, input, {
        modelInputHash: inputHash,
        includeM6Uncertainty: modelId === "M6",
        includeM6Sensitivity: modelId === "M6",
      })
    );
}

function stressAcrossModels(args: {
  baseline: ModelResult[];
  stressedInput: D11BModelInput;
  stressId: string;
  stressType: StressResult["stressType"];
  parameters: Record<string, unknown>;
}): StressResult[] {
  return args.baseline.map((base) => {
    const stressed = runModel(
      base.modelId,
      args.stressedInput,
      {
        includeM6Uncertainty: false,
        includeM6Sensitivity: false,
      },
    );
    return {
      stressId: args.stressId,
      stressType: args.stressType,
      modelId: base.modelId,
      parameters: args.parameters,
      metrics: compareRankings(base.rows, stressed.rows),
      stressedOutputHash: stressed.outputHash,
    };
  });
}

function capturedSourceKeys(input: D11BModelInput): D11BSourceKey[] {
  return input.rankings.map((ranking) => ranking.sourceKey);
}

function capturedProviders(
  input: D11BModelInput,
): D11BProviderSource[] {
  const providers: D11BProviderSource[] = [];
  if (
    input.rankings.some((ranking) =>
      ranking.sourceKey === "youtube_weekly_ke"
    )
  ) {
    providers.push("youtube");
  }
  if (
    input.rankings.some((ranking) =>
      ranking.sourceKey === "audiomack_weekly100_ke"
    )
  ) {
    providers.push("audiomack");
  }
  if (
    input.rankings.some((ranking) =>
      ranking.sourceKey.startsWith("apple_top100_ke:")
    )
  ) {
    providers.push("apple");
  }
  return providers;
}

function providerPairs(
  providers: D11BProviderSource[],
): Array<[D11BProviderSource, D11BProviderSource]> {
  const pairs: Array<[D11BProviderSource, D11BProviderSource]> = [];
  for (let i = 0; i < providers.length; i++) {
    for (let j = i + 1; j < providers.length; j++) {
      pairs.push([providers[i], providers[j]]);
    }
  }
  return pairs;
}

function candidateIdentityTargets(
  baseline: ModelResult[],
): string[] {
  const primary = baseline.find((model) => model.modelId === "M1");
  if (!primary) return [];
  return primary.rows
    .filter((row) => row.rank <= 10)
    .slice(0, 3)
    .map((row) => row.canonicalTrackId);
}

function attackCandidate(
  baseline: ModelResult[],
): string | null {
  const primary = baseline.find((model) => model.modelId === "M1");
  if (!primary || primary.rows.length === 0) return null;
  return (
    primary.rows.find((row) => row.rank > 40)?.canonicalTrackId ??
    primary.rows[primary.rows.length - 1]?.canonicalTrackId ??
    null
  );
}

function thresholdProposalSkeleton(): ThresholdProposal[] {
  return [
    {
      status: "UNRESOLVED",
      metric: "required_source_availability",
      rationale:
        "Must be calibrated from complete engineering-pilot source behavior before L036.",
      requiredEvidence: [
        "complete engineering-pilot week",
        "missed/degraded source receipts",
      ],
    },
    {
      status: "UNRESOLVED",
      metric: "apple_checkpoint_completeness",
      rationale:
        "Must reflect observed current-only checkpoint reliability without post-hoc relaxation.",
      requiredEvidence: [
        "seven scheduled Apple checkpoints",
        "partial-window receipts",
      ],
    },
    {
      status: "UNRESOLVED",
      metric: "identity_resolution_minimum",
      rationale:
        "Must be derived from pilot identity coverage and controlled identity perturbations.",
      requiredEvidence: [
        "observation-level resolved share",
        "candidate-universe resolved share",
        "identity perturbation matrix",
      ],
    },
    {
      status: "UNRESOLVED",
      metric: "source_deletion_robustness",
      rationale:
        "Requires the observed leave-one-source-out displacement distribution.",
      requiredEvidence: [
        "Top-10/40/100 overlap",
        "median displacement",
        "maximum displacement",
        "Top-100 entry/exit count",
      ],
    },
    {
      status: "UNRESOLVED",
      metric: "censoring_depth_robustness",
      rationale:
        "Requires Top-50/Top-20 masking and threshold-edge stress distributions.",
      requiredEvidence: [
        "depth masking matrix",
        "threshold-edge perturbation matrix",
      ],
    },
    {
      status: "UNRESOLVED",
      metric: "integrity_attack_tolerance",
      rationale:
        "Requires D09 attack and organic-spike negative-control behavior.",
      requiredEvidence: [
        "single-source spike",
        "coordinated-source spike",
        "identity split",
        "organic demand negative control",
      ],
    },
    {
      status: "UNRESOLVED",
      metric: "reproducibility_tolerance",
      rationale:
        "Requires independent rerun evidence under canonical serialization.",
      requiredEvidence: [
        "two independent reruns",
        "M6 deterministic convergence diagnostics",
      ],
    },
    {
      status: "UNRESOLVED",
      metric: "publication_green_amber_red",
      rationale:
        "Publication-state mapping can only be frozen after the component thresholds are justified.",
      requiredEvidence: [
        "all L036 component thresholds",
        "independent methodological review",
      ],
    },
  ];
}

export function buildCalibrationReport(
  input: D11BModelInput,
): CalibrationReport {
  const inputHash = sha256(canonicalJson(input));
  const baseline = allModels(input, inputHash);
  const stresses: StressResult[] = [];
  const stressGaps: StressGap[] = [];

  const providers = capturedProviders(input);

  for (const provider of providers) {
    stresses.push(...stressAcrossModels({
      baseline,
      stressedInput: deleteProviderSource(input, provider),
      stressId: `source-deletion:${provider}`,
      stressType: "source_deletion",
      parameters: {
        provider,
        deletionScope: "qualified-provider-source",
      },
    }));
  }

  for (const maximumDepth of [50, 20]) {
    stresses.push(...stressAcrossModels({
      baseline,
      stressedInput: maskDepth(input, maximumDepth),
      stressId: `depth-mask:${maximumDepth}`,
      stressType: "censoring_mask",
      parameters: { maximumDepth },
    }));
  }

  for (const ranking of input.rankings) {
    if (ranking.depth < 2) continue;
    const boundaryRank = Math.min(
      ranking.depth - 1,
      Math.max(1, Math.floor(ranking.depth / 2)),
    );
    const stressId =
      `threshold-edge:${ranking.sourceKey}:${boundaryRank}`;
    const hasAt = ranking.rows.some((row) =>
      row.rank === boundaryRank
    );
    const hasBelow = ranking.rows.some((row) =>
      row.rank === boundaryRank + 1
    );

    if (!hasAt || !hasBelow) {
      stressGaps.push({
        stressId,
        reason: "boundary_pair_unavailable_after_identity_filtering",
        parameters: {
          sourceKey: ranking.sourceKey,
          boundaryRank,
        },
      });
      continue;
    }

    stresses.push(...stressAcrossModels({
      baseline,
      stressedInput: thresholdEdgeSwap(
        input,
        ranking.sourceKey,
        boundaryRank,
      ),
      stressId,
      stressType: "censoring_mask",
      parameters: {
        sourceKey: ranking.sourceKey,
        boundaryRank,
      },
    }));
  }

  const identityTargets = candidateIdentityTargets(baseline);
  if (identityTargets.length > 0) {
    stresses.push(...stressAcrossModels({
      baseline,
      stressedInput: removeCanonicalIdentities(input, identityTargets),
      stressId: "identity-unresolved:top-baseline-candidates",
      stressType: "identity_perturbation",
      parameters: { canonicalTrackIds: identityTargets },
    }));

    const splitTarget = identityTargets[0];
    stresses.push(...stressAcrossModels({
      baseline,
      stressedInput: splitCanonicalIdentity(
        input,
        splitTarget,
        [`${splitTarget}:split-a`, `${splitTarget}:split-b`],
      ),
      stressId: `identity-split:${splitTarget}`,
      stressType: "identity_perturbation",
      parameters: { canonicalTrackId: splitTarget },
    }));
  }

  const attackTrack = attackCandidate(baseline);

  if (attackTrack) {
    for (const provider of providers) {
      stresses.push(...stressAcrossModels({
        baseline,
        stressedInput: spikeProviderSource(
          input,
          provider,
          attackTrack,
          1,
        ),
        stressId: `attack-single-source:${provider}:${attackTrack}`,
        stressType: "integrity_attack",
        parameters: {
          attack: "D09-A1-single-source-jump",
          provider,
          canonicalTrackId: attackTrack,
          targetRank: 1,
        },
      }));
    }

    for (const pair of providerPairs(providers)) {
      stresses.push(...stressAcrossModels({
        baseline,
        stressedInput: coordinatedProviderSpike(
          input,
          pair,
          attackTrack,
          1,
        ),
        stressId:
          `attack-coordinated-two-source:${pair.join("+")}:${attackTrack}`,
        stressType: "integrity_attack",
        parameters: {
          attack: "D09-A3-coordinated-two-source-spike",
          providers: pair,
          canonicalTrackId: attackTrack,
          targetRank: 1,
        },
      }));
    }
  }

  const sourceKeys = capturedSourceKeys(input);
  if (sourceKeys.length > 0) {
    const organicTrackIds = [
      "organic-flood-1",
      "organic-flood-2",
      "organic-flood-3",
      "organic-flood-4",
    ];
    stresses.push(...stressAcrossModels({
      baseline,
      stressedInput: injectOrganicTrackFlood(
        input,
        sourceKeys,
        organicTrackIds,
        1,
      ),
      stressId: "negative-control:organic-multi-track-demand",
      stressType: "integrity_attack",
      parameters: {
        negativeControl: true,
        scenario: "D09-organic-artist-release-flood",
        canonicalTrackIds: organicTrackIds,
        expectedPolicy:
          "valid corroborated demand remains measurable; no concentration penalty",
      },
    }));
  }

  const thresholdProposals = thresholdProposalSkeleton();

  const reportWithoutHash = {
    specVersion: D11B_CALIBRATION_SPEC_VERSION,
    modelVersions: D11B_MODEL_VERSIONS,
    inputHash,
    models: baseline,
    stresses,
    stressGaps,
    thresholdProposals,
    winner: null,
    confirmatory: false,
  };

  return {
    ...reportWithoutHash,
    reportHash: sha256(canonicalJson(reportWithoutHash)),
  };
}
