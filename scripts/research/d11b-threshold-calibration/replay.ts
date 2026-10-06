import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  buildCalibrationModelInput,
  type CalibrationObservation,
  type CalibrationSourceRun,
  type ExternalIdentityResolution,
} from "./input";
import {
  buildCalibrationReport,
  type CalibrationReport,
} from "./calibrate";
import type { D11BSourceKey } from "./models";

export const D11B_CALIBRATION_SNAPSHOT_VERSION =
  "d11b-calibration-snapshot-v1";
export const D11B_CALIBRATION_REPLAY_VERSION =
  "d11b-calibration-replay-v1";

export interface D11BCalibrationSnapshot {
  snapshotVersion: typeof D11B_CALIBRATION_SNAPSHOT_VERSION;
  windowId: string;
  phase: "engineering_pilot";
  sourcePolicyVersion: string;
  analysisCommit: string;
  expectedSourceKeys: D11BSourceKey[];
  sourceRuns: CalibrationSourceRun[];
  observations: CalibrationObservation[];
  admittedSourceRunIds: string[];
  externalIdentityResolutions?: ExternalIdentityResolution[];
  identitySnapshotHash?: string | null;
}

export type CalibrationReadinessState =
  | "PARTIAL_WINDOW"
  | "BLOCKED_IDENTITY_STRUCTURE"
  | "CALIBRATION_ONLY";

export interface D11BCalibrationReplay {
  replayVersion: typeof D11B_CALIBRATION_REPLAY_VERSION;
  snapshotHash: string;
  windowId: string;
  phase: "engineering_pilot";
  sourcePolicyVersion: string;
  analysisCommit: string;
  identitySnapshotHash: string | null;
  evidenceCompleteness: {
    expectedSourceCount: number;
    sourceReceiptCount: number;
    completeWindowEvidence: boolean;
    missingSourceKeys: D11BSourceKey[];
  };
  identityCoverage: ReturnType<
    typeof buildCalibrationModelInput
  >["sourceCoverage"];
  inputReceipt: {
    observationCount: number;
    nativeResolvedObservationCount: number;
    externalResolutionCount: number;
    effectiveResolvedObservationCount: number;
    unresolvedObservationCount: number;
    quarantinedObservationCount: number;
    admittedSourceRunCount: number;
  };
  readiness: {
    state: CalibrationReadinessState;
    reasons: string[];
    l036IdentityThresholdStatus: "UNRESOLVED";
    confirmatoryAuthority: false;
  };
  calibrationReport: CalibrationReport;
  replayHash: string;
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

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256")
    .update(canonicalJson(value))
    .digest("hex");
}

function validateSnapshot(snapshot: D11BCalibrationSnapshot): void {
  if (
    snapshot.snapshotVersion !== D11B_CALIBRATION_SNAPSHOT_VERSION
  ) {
    throw new Error("unsupported_calibration_snapshot_version");
  }
  if (snapshot.phase !== "engineering_pilot") {
    throw new Error("calibration_snapshot_not_engineering_pilot");
  }
  if (!snapshot.windowId.trim()) {
    throw new Error("calibration_snapshot_window_id_required");
  }
  if (!snapshot.sourcePolicyVersion.trim()) {
    throw new Error("calibration_snapshot_source_policy_required");
  }
  if (!snapshot.analysisCommit.trim()) {
    throw new Error("calibration_snapshot_analysis_commit_required");
  }

  const sourceRunIds = new Set(
    snapshot.sourceRuns.map((run) => run.id),
  );
  for (const id of snapshot.admittedSourceRunIds) {
    if (!sourceRunIds.has(id)) {
      throw new Error("calibration_snapshot_unknown_admitted_source_run");
    }
  }

  const admitted = new Set(snapshot.admittedSourceRunIds);
  for (const run of snapshot.sourceRuns) {
    if (!admitted.has(run.id)) continue;

    if (
      run.fetchStatus !== undefined &&
      run.fetchStatus !== null &&
      run.fetchStatus !== "succeeded"
    ) {
      throw new Error(
        `admitted_source_fetch_not_succeeded:${run.sourceKey}`,
      );
    }
    if (
      run.parseStatus !== undefined &&
      run.parseStatus !== null &&
      run.parseStatus !== "succeeded"
    ) {
      throw new Error(
        `admitted_source_parse_not_succeeded:${run.sourceKey}`,
      );
    }
  }
}

function evidenceCompleteness(
  snapshot: D11BCalibrationSnapshot,
): D11BCalibrationReplay["evidenceCompleteness"] {
  const receipts = new Set(
    snapshot.sourceRuns.map((run) => run.sourceKey),
  );
  const missingSourceKeys = snapshot.expectedSourceKeys
    .filter((sourceKey) => !receipts.has(sourceKey));

  return {
    expectedSourceCount: snapshot.expectedSourceKeys.length,
    sourceReceiptCount:
      snapshot.expectedSourceKeys.length - missingSourceKeys.length,
    completeWindowEvidence: missingSourceKeys.length === 0,
    missingSourceKeys,
  };
}

function readiness(args: {
  completeWindowEvidence: boolean;
  sourceCoverage: ReturnType<
    typeof buildCalibrationModelInput
  >["sourceCoverage"];
}): D11BCalibrationReplay["readiness"] {
  const reasons: string[] = [];

  if (!args.completeWindowEvidence) {
    reasons.push("engineering_pilot_window_receipts_incomplete");
  }

  const structurallySparse = args.sourceCoverage
    .filter((coverage) => coverage.usableModelRows < 2);

  for (const coverage of structurallySparse) {
    reasons.push(
      `fewer_than_two_usable_identity_rows:${coverage.sourceKey}`,
    );
  }

  let state: CalibrationReadinessState = "CALIBRATION_ONLY";
  if (!args.completeWindowEvidence) {
    state = "PARTIAL_WINDOW";
  } else if (structurallySparse.length > 0) {
    state = "BLOCKED_IDENTITY_STRUCTURE";
  }

  return {
    state,
    reasons,
    l036IdentityThresholdStatus: "UNRESOLVED",
    confirmatoryAuthority: false,
  };
}

export function buildCalibrationReplay(
  snapshot: D11BCalibrationSnapshot,
): D11BCalibrationReplay {
  validateSnapshot(snapshot);

  const snapshotHash = sha256Canonical(snapshot);
  const receipt = buildCalibrationModelInput({
    expectedSourceKeys: snapshot.expectedSourceKeys,
    sourceRuns: snapshot.sourceRuns,
    observations: snapshot.observations,
    admittedSourceRunIds: snapshot.admittedSourceRunIds,
    externalIdentityResolutions:
      snapshot.externalIdentityResolutions ?? [],
  });
  const completeness = evidenceCompleteness(snapshot);
  const calibrationReport = buildCalibrationReport(
    receipt.modelInput,
  );

  const withoutReplayHash = {
    replayVersion: D11B_CALIBRATION_REPLAY_VERSION,
    snapshotHash,
    windowId: snapshot.windowId,
    phase: snapshot.phase,
    sourcePolicyVersion: snapshot.sourcePolicyVersion,
    analysisCommit: snapshot.analysisCommit,
    identitySnapshotHash: snapshot.identitySnapshotHash ?? null,
    evidenceCompleteness: completeness,
    identityCoverage: receipt.sourceCoverage,
    inputReceipt: {
      observationCount: receipt.observationCount,
      nativeResolvedObservationCount:
        receipt.resolvedObservationCount,
      externalResolutionCount: receipt.externalResolutionCount,
      effectiveResolvedObservationCount:
        receipt.effectiveResolvedObservationCount,
      unresolvedObservationCount:
        receipt.unresolvedObservationCount,
      quarantinedObservationCount:
        receipt.quarantinedObservationCount,
      admittedSourceRunCount:
        receipt.admittedSourceRunCount,
    },
    readiness: readiness({
      completeWindowEvidence:
        completeness.completeWindowEvidence,
      sourceCoverage: receipt.sourceCoverage,
    }),
    calibrationReport,
  };

  return {
    ...withoutReplayHash,
    replayHash: sha256Canonical(withoutReplayHash),
  };
}

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function runCli(): void {
  const inputPath = arg("input");
  if (!inputPath) {
    throw new Error(
      "Provide --input=<frozen-calibration-snapshot.json>",
    );
  }

  const resolvedInput = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Missing input snapshot: ${resolvedInput}`);
  }

  const snapshot = JSON.parse(
    fs.readFileSync(resolvedInput, "utf8"),
  ) as D11BCalibrationSnapshot;

  const replay = buildCalibrationReplay(snapshot);
  const serialized = JSON.stringify(replay, null, 2) + "\n";
  const outputPath = arg("output");

  if (outputPath) {
    const resolvedOutput = path.resolve(process.cwd(), outputPath);
    fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
    fs.writeFileSync(resolvedOutput, serialized);
    console.log(`D11B_CALIBRATION_REPLAY=${resolvedOutput}`);
    console.log(`REPLAY_HASH=${replay.replayHash}`);
    console.log(`READINESS=${replay.readiness.state}`);
    return;
  }

  process.stdout.write(serialized);
}

const invokedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : null;
const currentPath = fileURLToPath(import.meta.url);

if (invokedPath === currentPath) {
  try {
    runCli();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  }
}
