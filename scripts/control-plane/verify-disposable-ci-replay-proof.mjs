import path from "node:path";
import { spawnSync } from "node:child_process";

export const DISPOSABLE_CI_REPLAY_PROOF_MODE = "disposable_ci_clean_replay_v1";
export const DISPOSABLE_CI_SCHEMA_SEAL_MODE = "disposable_ci";
export const DISPOSABLE_CI_SOURCE = "unlinked-local-ci";
const MIGRATIONS_DIR = "supabase/migrations";
const TYPE_FILE = "src/types/database.types.ts";
const WORKFLOW = "WK100 Disposable SQL Concurrency and Signed-in Storage ACL";
const CI_MARKERS = Object.freeze([
  "WK100_CI_DISPOSABLE_NO_REMOTE_TARGET=PASS",
  "WK100_CI_LOCAL_FULL_MIGRATION_REPLAY=PASS",
  "WK100_DISPOSABLE_EXACT_ACTIVE_MIGRATION_LEDGER=PASS",
  "WK100_GENUINE_AUTH_EXACT_ACTIVE_LEDGER_AND_ZERO_DATA=PASS",
  "WK100_GOTRUE_SUPERADMIN_ADMISSION_AND_IMMUTABLE_ENROLLMENT=PASS",
  "WK100_GOTRUE_METHOD_PAUSE_AND_LIVE_ROLE_REVOCATION=PASS",
  "WK100_LOCAL_PRIVATE_SERVICE_BYTE_READBACK_SHA256=PASS",
  "WK100_CI_LOCAL_AUTH_STORAGE_CONTRACT_AND_LEASE_VOLUME_DESTROYED=PASS",
]);
const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
function git(args,{allowFailure=false}={}) {
  const r=spawnSync("git",args,{encoding:"utf8"});
  if(r.status!==0 && !allowFailure)throw Error("WK100 local proof Git check failed: "+args[0]);
  return {status:r.status,stdout:r.stdout??""};
}
export function isDisposableCiReplayProof(proof){
  return proof?.proof_mode===DISPOSABLE_CI_REPLAY_PROOF_MODE;
}
export function validateDisposableCiReplayProof({proof,migrationFile,migrationSha256,baseMainSha}){
  const e=[];
  if(!isDisposableCiReplayProof(proof))e.push("wrong disposable CI proof mode");
  if(proof?.migration_file!==migrationFile)e.push("disposable CI migration file mismatch");
  if(proof?.migration_sha256!==migrationSha256 || !HEX64.test(proof?.migration_sha256??""))
    e.push("disposable CI migration digest mismatch");
  if(proof?.base_main_sha!==baseMainSha || !HEX40.test(proof?.base_main_sha??""))
    e.push("disposable CI merge base mismatch");
  if(!HEX40.test(proof?.replay_candidate_head_sha??""))e.push("disposable CI replay head SHA missing");
  if(proof?.replay_environment!=="supabase-local-unlinked" || proof?.hosted_preview_used!==false ||
      proof?.production_mutation!==false)e.push("disposable CI must be unlinked, not hosted or Production");
  if(proof?.workflow_name!==WORKFLOW || !Number.isInteger(proof?.workflow_run_id)||
      proof.workflow_run_id<1 || proof?.workflow_run_url!==
      "https://github.com/bjuta/wakilisha/actions/runs/"+proof.workflow_run_id)
    e.push("disposable CI workflow evidence URL/identity mismatch");
  if(proof?.workflow_conclusion!=="success" || proof?.workflow_event!=="pull_request")
    e.push("disposable CI requires successful pull-request workflow evidence");
  if(!Array.isArray(proof?.ci_markers) || proof.ci_markers.length!==CI_MARKERS.length ||
      !CI_MARKERS.every((marker,index)=>proof.ci_markers[index]===marker))
    e.push("disposable CI missing ordered independent replay/auth/storage/cleanup markers");
  if(proof?.baseline_replay!=="pass" || proof?.candidate_apply!=="pass" ||
      proof?.verifier!=="pass" || proof?.cleanup!=="pass")
    e.push("disposable CI results must all pass");
  if(!HEX64.test(proof?.schema_types_sha256??""))
    e.push("disposable CI schema types digest invalid");
  if(!Number.isInteger(proof?.schema_migration_count)||proof.schema_migration_count<1)
    e.push("disposable CI migration count invalid");
  const version=path.basename(migrationFile).match(/^(\d{14})_/ )?.[1];
  if(proof?.schema_migration_head!==version)e.push("disposable CI migration head mismatch");
  if(!Number.isFinite(Date.parse(proof?.verified_at??"")))
    e.push("disposable CI proof timestamp invalid");
  return e;
}
export function validateDisposableCiReplayRepositoryState({
  changedActive,proofs,mergeBase,baseline,migrations,latestMigration,actualTypesSha256,
}){
  const errors=[];
  // The newest changed migration owns the full current-set clean replay.
  // Earlier CI and offline receipts remain immutable historical evidence,
  // and may legitimately cover smaller additive migration filename sets.
  const latestEntry=changedActive.at(-1);
  const latestProof=proofs.get(latestEntry?.path);
  if(!isDisposableCiReplayProof(latestProof)){
    errors.push("latest active migration must carry current unlinked CI proof");
    return errors;
  }
  for(const entry of changedActive){
    const proof=proofs.get(entry.path);
    if(!isDisposableCiReplayProof(proof) &&
       proof?.proof_mode!=="offline_operator_clean_replay_v1")continue;
    const replay=proof.replay_candidate_head_sha;
    if(!HEX40.test(replay??"") ||
       git(["merge-base","--is-ancestor",replay,"HEAD"],{allowFailure:true}).status!==0)
      errors.push("disposable/earlier offline replay head must be ancestor of current head");
    const atReplay=git(["rev-parse",replay+":"+entry.path],{allowFailure:true});
    const atHead=git(["hash-object",entry.path],{allowFailure:true});
    if(atReplay.status!==0 || atHead.status!==0 ||
       atReplay.stdout.trim()!==atHead.stdout.trim())
      errors.push(entry.path+": migration bytes changed since accepted replay");
    const typesReplay=git(["rev-parse",replay+":"+TYPE_FILE],{allowFailure:true});
    const typesNow=git(["hash-object",TYPE_FILE],{allowFailure:true});
    if(typesReplay.status!==0 || typesNow.status!==0 ||
       typesReplay.stdout.trim()!==typesNow.stdout.trim())
      errors.push("replay-accepted database types changed since verification");
    const atReplayNames=git(["ls-tree","-r","--name-only",replay,"--",MIGRATIONS_DIR],
      {allowFailure:true}).stdout.split(/\r?\n/).filter(x=>x.endsWith(".sql"))
      .map(x=>path.basename(x)).sort();
    if(proof.schema_types_sha256!==actualTypesSha256 ||
       proof.schema_migration_count!==atReplayNames.length ||
       proof.schema_migration_head!==path.basename(entry.path).slice(0,14))
      errors.push(entry.path+": proof metadata does not match its actual accepted replay");
    if(entry.path===latestEntry.path){
      if(JSON.stringify(atReplayNames)!==JSON.stringify(migrations))
        errors.push("disposable CI migration filename set changed since latest replay");
      // A CLI-minted migration can be earlier than a newer version already
      // on main. Prove its exact identity AND the full unchanged 249-file
      // manifest rather than conflating the two version numbers.
      if(proof.schema_migration_count!==migrations.length ||
         proof.schema_migration_head!==path.basename(entry.path).slice(0,14))
        errors.push("disposable CI latest proof does not bind its changed migration version");
    }else{
      const changes=git(["diff","--name-status",replay,"HEAD","--",MIGRATIONS_DIR],
        {allowFailure:true});
      if(changes.status!==0 || changes.stdout.split(/\r?\n/)
         .filter(Boolean).some(line=>!/^A\t(?:supabase\/migrations\/)\d{14}_[\w-]+\.sql$/.test(line)))
        errors.push(entry.path+": historical replay migration set changed non-additively");
    }
  }
  const seal=baseline.schemaSeal??{};
  const newest=proofs.get(changedActive.at(-1).path);
  if(seal.mode!==DISPOSABLE_CI_SCHEMA_SEAL_MODE ||
      seal.sourceProjectRef!==DISPOSABLE_CI_SOURCE ||
      seal.baseMainSha!==mergeBase ||
      seal.replayCandidateHeadSha!==newest.replay_candidate_head_sha ||
      seal.workflowRunId!==newest.workflow_run_id ||
      // The schema seal describes the newest version of the FULL replayed
      // manifest; the proof above separately pins the added migration.
      seal.migrationHead!==path.basename(latestMigration).slice(0,14) ||
      baseline.typesSha256!==actualTypesSha256 ||
      baseline.migrationCount!==migrations.length ||
      baseline.latestMigration!==latestMigration)
    errors.push("disposable CI schema seal does not match clean replay candidate, base, and current schema");
  return errors;
}
