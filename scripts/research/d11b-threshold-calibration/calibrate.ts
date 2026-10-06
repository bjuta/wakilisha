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
  coordinatedSourceSpike,
  deleteSource,
  maskDepth,
  removeCanonicalIdentities,
  singleSourceSpike,
  splitCanonicalIdentity,
  thresholdEdgeSwap,
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

function runModel(
  modelId: D11BModelId,
  input: D11BModelInput,
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
  return {
    modelId,
    modelVersion: D11B_MODEL_VERSIONS.M6,
    rows: fit.rows,
    outputHash: rankingOutputHash(fit.rows),
    diagnostics: {
      converged: fit.converged,
      iterations: fit.iterations,
      maxLogWorthDelta: fit.maxLogWorthDelta,
      npseudo: 0.5,
    },
  };
}

function allModels(input: D11BModelInput): ModelResult[] {
  return (["M1", "M2", "M4", "M6"] as const)
    .map((modelId) => runModel(modelId, input));
}

function stressAcrossModels(args: {
  baseline: ModelResult[];
  stressedInput: D11BModelInput;
  stressId: string;
  stressType: StressResult["stressType"];
  parameters: Record<string, unknown>;
}): StressResult[] {
  return args.baseline.map((base) => {
    const stressed = runModel(base.modelId, args.stressedInput);
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
  const baseline = allModels(input);
  const stresses: StressResult[] = [];

  for (const sourceKey of capturedSourceKeys(input)) {
    stresses.push(...stressAcrossModels({
      baseline,
      stressedInput: deleteSource(input, sourceKey),
      stressId: `source-deletion:${sourceKey}`,
      stressType: "source_deletion",
      parameters: { sourceKey },
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
    stresses.push(...stressAcrossModels({
      baseline,
      stressedInput: thresholdEdgeSwap(
        input,
        ranking.sourceKey,
        boundaryRank,
      ),
      stressId: `threshold-edge:${ranking.sourceKey}:${boundaryRank}`,
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
  const sources = capturedSourceKeys(input);
  if (attackTrack && sources.length > 0) {
    stresses.push(...stressAcrossModels({
      baseline,
      stressedInput: singleSourceSpike(
        input,
        sources[0],
        attackTrack,
        1,
      ),
      stressId: `attack-single-source:${sources[0]}:${attackTrack}`,
      stressType: "integrity_attack",
      parameters: {
        attack: "D09-A1-single-source-jump",
        sourceKey: sources[0],
        canonicalTrackId: attackTrack,
        targetRank: 1,
      },
    }));
  }

  if (attackTrack && sources.length >= 2) {
    stresses.push(...stressAcrossModels({
      baseline,
      stressedInput: coordinatedSourceSpike(
        input,
        sources.slice(0, 2),
        attackTrack,
        1,
      ),
      stressId: `attack-coordinated-two-source:${attackTrack}`,
      stressType: "integrity_attack",
      parameters: {
        attack: "D09-A3-coordinated-two-source-spike",
        sourceKeys: sources.slice(0, 2),
        canonicalTrackId: attackTrack,
        targetRank: 1,
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
    thresholdProposals,
    winner: null,
    confirmatory: false,
  };

  return {
    ...reportWithoutHash,
    reportHash: sha256(canonicalJson(reportWithoutHash)),
  };
}
