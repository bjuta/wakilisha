// RNB18-only two-stage release evidence, not a fake 237-file clean replay.
// This validator deliberately does not grant an exception to other migrations.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const RNB18_STAGED_MODE = "rnb18_two_stage_retirement";
export const RNB18_STAGE1 = "20261101210335_rnb18_stage1_archive_replay_authority_v1.sql";
export const RNB18_OLD = "20261030062819_retire_18_kenya_rnb_editions.sql";
export const RNB18_BASE = "4ecf39a6b295d2012f37e918771b9aad692e0d72";
export const RNB18_PAIRED_COMMIT = "905455ba985b25814a6ad45b9b92229510a2abe4";
export const RNB18_OLD_BLOB = "b3c2b412ea8bb594d22f61858fb40c5c4a6553f5";
export const RNB18_PAIRED_PROOF_BLOB = "95a897fa628cf5ca702fcbcc03ddf4bceb9f04c3";
export const RNB18_TYPES_SHA256 = "eed74587624364062f6d4cee1d2b0a16d530aa86865d2493476994061e8a9cf6";
export const RNB18_PREVIEW_REF = "uummbxewahdozsjkubez";
export const RNB18_PREVIEW_BRANCH = "c00bfe1e-fcc8-4a10-86b3-c2af1d249776";
export const RNB18_VERIFIER = "scripts/control-plane/verify-rnb18-stage1-replay-authority.sql";
const MIGRATIONS = "supabase/migrations";
const PROOF_PATH = "docs/engineering/replay-proofs/" + RNB18_STAGE1 + ".json";
const BASELINE = "docs/engineering/live-schema-baseline.json";
const TYPES = "src/types/database.types.ts";
const OLD_ACTIVE = MIGRATIONS + "/" + RNB18_OLD;
const OLD_RETIRED = "docs/engineering/replay-baseline/retired-active-migrations/" + RNB18_OLD;
const FORWARD = MIGRATIONS + "/" + RNB18_STAGE1;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trimEnd() : null;
}
function gitBytes(ref, file) {
  const r = spawnSync("git", ["show", ref + ":" + file], { encoding: "buffer" });
  return r.status === 0 ? r.stdout : null;
}
function blob(ref, file) {
  const r = git(["rev-parse", ref + ":" + file]);
  return /^[0-9a-f]{40}$/.test(r ?? "") ? r : null;
}
function activeAt(ref) {
  const value = git(["ls-tree", "-r", "--name-only", ref, "--", MIGRATIONS]);
  if (value === null) return null;
  return value.split(/\r?\n/).filter(x=>x.endsWith(".sql")).map(x=>path.basename(x)).sort();
}
function equal(a,b) {
  return Array.isArray(a) && Array.isArray(b) &&
    a.length === b.length && a.every((x,i)=>x===b[i]);
}
export function isRnb18StagedProof(proof) {
  return proof?.proof_mode === RNB18_STAGED_MODE;
}

// Pure negative-case test surface. Each proof's values are compared to actual
// repository and immutable Git evidence separately below.
export function validateRnb18StagedFields({ proof, migrationFile, migrationSha256, baseMainSha }) {
  const errors = [];
  const expected = {
    proof_mode: RNB18_STAGED_MODE,
    migration_file: FORWARD,
    migration_sha256: migrationSha256,
    base_main_sha: baseMainSha,
    stage1_migration_count: 237,
    stage1_migration_head: "20261101210335",
    original_historical_migration_file: OLD_ACTIVE,
    original_historical_git_blob_sha: RNB18_OLD_BLOB,
    paired_replay_commit_sha: RNB18_PAIRED_COMMIT,
    paired_replay_proof_blob_sha: RNB18_PAIRED_PROOF_BLOB,
    paired_replay_migration_count: 236,
    paired_replay_migration_head: "20261101210335",
    paired_preview_project_ref: RNB18_PREVIEW_REF,
    paired_preview_branch_id: RNB18_PREVIEW_BRANCH,
    schema_types_sha256: RNB18_TYPES_SHA256,
    verifier_file: RNB18_VERIFIER,
    stage1_clean_replay: "not_claimed",
    paired_stage2_hosted_replay: "pass",
  };
  if (migrationFile !== FORWARD) errors.push("RNB18 staged mode is only for the exact forward migration");
  if (baseMainSha !== RNB18_BASE) errors.push("RNB18 staged mode requires the accepted main merge base");
  if (!proof || typeof proof !== "object") return ["RNB18 staged proof is required", ...errors];
  for (const [key,value] of Object.entries(expected)) {
    if (proof[key] !== value) errors.push(key + " must equal the sealed RNB18 stage authority");
  }
  if (proof.baseline_replay === "pass") errors.push("Stage 1 must not claim a 237-file clean replay");
  if (!Number.isFinite(Date.parse(proof.verified_at ?? ""))) errors.push("verified_at must be ISO");
  return errors;
}

export function validateRnb18StagedRepositoryState({ proof, changedActive, mergeBase, baseline, migrations, latestMigration, actualTypesSha256 }) {
  const errors = [];
  if (!isRnb18StagedProof(proof)) return ["RNB18 staged proof mode is required"];
  if (mergeBase !== RNB18_BASE) errors.push("RNB18 merge base drift");
  if (changedActive.length !== 1 ||
      changedActive[0].status !== "A" ||
      changedActive[0].path !== FORWARD) errors.push("RNB18 Stage 1 must add exactly its canonical forward migration");
  if (migrations.length !== 237 || latestMigration !== RNB18_STAGE1 ||
      !migrations.includes(RNB18_OLD)) errors.push("RNB18 Stage 1 active history must be exactly 237 with old retirement present");
  if (!fs.existsSync(OLD_ACTIVE) || blob("HEAD", OLD_ACTIVE)!==RNB18_OLD_BLOB ||
      blob(mergeBase, OLD_ACTIVE)!==RNB18_OLD_BLOB) errors.push("RNB18 original applied retirement source blob drift");
  if (blob(RNB18_PAIRED_COMMIT, OLD_RETIRED)!==RNB18_OLD_BLOB ||
      blob(RNB18_PAIRED_COMMIT, OLD_ACTIVE)!==null) errors.push("RNB18 paired Stage 2 historical archive is not an exact retirement");
  if (blob("HEAD",FORWARD) !== blob(RNB18_PAIRED_COMMIT,FORWARD)) errors.push("RNB18 paired Stage 2 forward SQL bytes drift");
  if (blob("HEAD",RNB18_VERIFIER) !== blob(RNB18_PAIRED_COMMIT,RNB18_VERIFIER)) errors.push("RNB18 paired read-only verifier bytes drift");
  const pairedFiles = activeAt(RNB18_PAIRED_COMMIT);
  if (!equal(migrations.filter(x=>x!==RNB18_OLD),pairedFiles)) errors.push("RNB18 paired Stage 2 manifest is not exactly Stage 1 minus one historical migration");
  if (blob(RNB18_PAIRED_COMMIT, PROOF_PATH)!==RNB18_PAIRED_PROOF_BLOB) errors.push("RNB18 accepted Stage 2 hosted proof blob drift");
  const proofBytes = gitBytes(RNB18_PAIRED_COMMIT, PROOF_PATH);
  let pairedProof = null;
  try { pairedProof = JSON.parse(proofBytes?.toString("utf8")??""); }
  catch { errors.push("RNB18 accepted hosted replay JSON unavailable"); }
  if (pairedProof) {
    if (pairedProof.baseline_replay!=="pass" ||
        pairedProof.schema_migration_count!==236 ||
        pairedProof.schema_migration_head!=="20261101210335" ||
        pairedProof.preview_project_ref!==RNB18_PREVIEW_REF ||
        pairedProof.preview_branch_id!==RNB18_PREVIEW_BRANCH ||
        pairedProof.schema_types_sha256!==RNB18_TYPES_SHA256 ||
        pairedProof.hosted_replay_evidence?.provider!=="Supabase Preview" ||
        pairedProof.hosted_replay_evidence?.provider_check_id!=="124999299478" ||
        pairedProof.hosted_replay_evidence?.verified_migration_count!==236 ||
        pairedProof.hosted_replay_evidence?.archived_rows!==0 ||
        pairedProof.hosted_replay_evidence?.receipts!==0 ||
        pairedProof.hosted_replay_evidence?.independent_postflight!=="WK_RNB18_HOSTED_PREVIEW_VERIFIER_PASS"
       ) errors.push("RNB18 Stage 2 hosted acceptance metadata drift");
    if (pairedProof.migration_sha256!==sha256(fs.readFileSync(FORWARD))) errors.push("RNB18 paired hosted proof migration hash drift");
  }
  if (actualTypesSha256!==RNB18_TYPES_SHA256 ||
      blob("HEAD",TYPES)!==blob(RNB18_PAIRED_COMMIT,TYPES)) errors.push("RNB18 types are not byte-identical to accepted Stage 2 Preview output");
  const pairedBaselineBytes = gitBytes(RNB18_PAIRED_COMMIT,BASELINE);
  let pairedBaseline = null;
  try { pairedBaseline=JSON.parse(pairedBaselineBytes?.toString("utf8")??""); }
  catch { errors.push("RNB18 accepted Stage 2 Preview schema seal unavailable"); }
  if(pairedBaseline && (
      pairedBaseline.migrationCount!==236 ||
      pairedBaseline.schemaSeal?.mode!=="preview" ||
      pairedBaseline.schemaSeal?.sourceProjectRef!==RNB18_PREVIEW_REF ||
      pairedBaseline.schemaSeal?.previewBranchId!==RNB18_PREVIEW_BRANCH ||
      pairedBaseline.typesSha256!==RNB18_TYPES_SHA256
    )) errors.push("RNB18 paired hosted Preview schema seal drift");
  const seal=baseline?.schemaSeal;
  if (baseline?.migrationCount!==237 ||
      baseline?.latestMigration!==RNB18_STAGE1 ||
      baseline?.typesSha256!==RNB18_TYPES_SHA256 ||
      seal?.mode!==RNB18_STAGED_MODE ||
      seal?.sourceProjectRef!==RNB18_PREVIEW_REF ||
      seal?.previewBranchId!==RNB18_PREVIEW_BRANCH ||
      seal?.pairedReplayCommitSha!==RNB18_PAIRED_COMMIT ||
      seal?.pairedReplayMigrationCount!==236 ||
      seal?.retiredHistoricalVersion!=="20261030062819" ||
      seal?.migrationHead!=="20261101210335" ||
      seal?.baseMainSha!==RNB18_BASE) errors.push("RNB18 Stage 1 schema snapshot must explicitly disclose paired 236-file seal; never claim a 237-file Preview");
  return errors;
}
