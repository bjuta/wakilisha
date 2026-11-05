import { spawnSync } from "node:child_process";
import path from "node:path";

// Operator-pasted terminal evidence is NEVER represented as GitHub Actions CI.
export const OFFLINE_OPERATOR_PROOF_MODE="offline_operator_clean_replay_v1";
export const OFFLINE_OPERATOR_SCHEMA_SEAL_MODE="offline_operator";
export const OFFLINE_OPERATOR_SOURCE="unlinked-local-operator";
export const OFFLINE_REQUIRED_MARKERS=Object.freeze([
  "WK100_SOURCE_CONTROLLED_245TH_MIGRATION_AND_SHA=PASS",
  "WK100_EXACT_PR_HEAD_AND_ISOLATED_TOOLS=PASS",
  "WK100_DISPOSABLE_EXACT_ACTIVE_MIGRATION_LEDGER=PASS",
  "WK100_TWO_INDEPENDENT_POSTGRES_BACKENDS=PASS",
  "WK100_TRUE_OVERLAP_AND_ROW_LOCK_WITNESSED=PASS",
  "WK100_ONE_LEASE_SECOND_SQLSTATE_55P03=PASS",
  "WK100_COLLECT_NOW_ACTIVE_245TH_MIGRATION_EXACT_SHA_SQL_AND_ACL=PASS",
  "WK100_GENUINE_LOCAL_GOTRUE_SIGNED_IN_USER=PASS",
  "WK100_COLLECT_NOW_ANON_SIGNED_UNPRIVILEGED_AND_SERVICE_DENIED=PASS",
  "WK100_COLLECT_NOW_GENUINE_JWT_REQUEST_REPLAY_SERVICE_READ_AND_DENIAL=PASS",
  "WK100_COLLECT_NOW_SECOND_REAL_JWT_DENIED_AND_CROSS_ACTOR_REPLAY=PASS",
  "WK100_COLLECT_NOW_REVOKED_JWT_AND_PAUSED_METHOD_FAIL_CLOSED=PASS",
  "WK100_LOCAL_PRIVATE_SERVICE_BYTE_READBACK_SHA256=PASS",
  "WK100_GENUINE_AUTHENTICATED_USER_PRIVATE_DOWNLOAD_AND_LIST_DENIED=PASS",
  "WK100_ANONYMOUS_PRIVATE_DOWNLOAD_DENIED=PASS",
  "WK100_DISPOSABLE_TWO_REAL_GOTRUE_USERS_COLLECT_NOW_STORAGE=PASS",
  "WK100_ISOLATED_PROJECT_CLEANUP=PASS",
]);
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const OWNER_RECEIPT=/^https:\/\/github\.com\/bjuta\/wakilisha\/pull\/1345#issuecomment-[1-9][0-9]+$/;

function git(args,{allowFailure=false}={}){
  const r=spawnSync("git",args,{encoding:"utf8"});
  if((r.error||r.status!==0)&&!allowFailure)
    throw Error("OFFLINE_GIT_READ_FAILED_"+args[0]);
  return {status:r.status,stdout:r.stdout??""};
}

export function isOfflineOperatorReplayProof(proof){
  return proof?.proof_mode===OFFLINE_OPERATOR_PROOF_MODE;
}

// Validates the declared operator receipt against the migration; not an
// independent attestation that the operator actually executed the tests.
export function validateOfflineOperatorReplayProof({
  proof,migrationFile,migrationSha256,baseMainSha,
}){
  const errors=[];
  if(!isOfflineOperatorReplayProof(proof))errors.push("offline proof mode invalid");
  if(proof?.migration_file!==migrationFile ||
     !/^supabase\/migrations\/\d{14}_[\w-]+\.sql$/.test(migrationFile))
    errors.push("offline migration path mismatch");
  if(proof?.migration_sha256!==migrationSha256 ||
     !HEX64.test(proof?.migration_sha256??""))
    errors.push("offline migration digest mismatch");
  if(!HEX40.test(baseMainSha??"") || proof?.base_main_sha!==baseMainSha)
    errors.push("offline merge base mismatch");
  if(!HEX40.test(proof?.replay_candidate_head_sha??""))
    errors.push("offline tested commit missing");
  if(proof?.replay_environment!=="supabase-local-unlinked" ||
     proof?.hosted_preview_used!==false ||
     proof?.production_mutation!==false ||
     proof?.provider_egress!==false)
    errors.push("offline isolation or no-egress assertion invalid");
  if(proof?.evidence_kind!=="operator_pasted_terminal_output" ||
     !OWNER_RECEIPT.test(proof?.operator_receipt_url??"") ||
     !Number.isFinite(Date.parse(proof?.verified_at??"")))
    errors.push("offline owner-reported evidence identity invalid");
  if(proof?.runner_file!=="wk100_245_migration_disposable_acceptance_f0813440.sh" ||
     proof?.runner_sha256!=="066ca51046c5615e430a09c8472614ccc46a9cef5deb570b3a92d6aeca38a1f5")
    errors.push("offline runner artifact identity mismatch");
  if(proof?.local_stack_id!=="wk100accept3becb12cc3" ||
     proof?.local_api_port!==41434 ||
     proof?.supabase_cli_version!=="2.121.0" ||
     proof?.node_major!==22)
    errors.push("offline tested environment identity mismatch");
  if(proof?.github_ci_claimed!==false ||
     proof?.workflow_run_id!=null ||
     proof?.workflow_conclusion!=null ||
     proof?.workflow_event!=null)
    errors.push("offline proof must never claim GitHub CI");
  if(!Array.isArray(proof?.operator_reported_markers) ||
     proof.operator_reported_markers.length!==OFFLINE_REQUIRED_MARKERS.length ||
     !OFFLINE_REQUIRED_MARKERS.every((marker,i)=>proof.operator_reported_markers[i]===marker))
    errors.push("offline required operator markers missing or reordered");
  if(proof?.baseline_replay!=="pass" ||
     proof?.candidate_apply!=="pass" ||
     proof?.verifier!=="pass" ||
     proof?.cleanup!=="pass")
    errors.push("offline replay or cleanup must pass");
  if(!HEX64.test(proof?.schema_types_sha256??"") ||
     proof?.schema_migration_count!==245 ||
     proof?.schema_migration_head!==path.basename(migrationFile).slice(0,14))
    errors.push("offline type and migration head mismatch");
  return errors;
}

export function validateOfflineOperatorReplayRepositoryState({
  changedActive,proofs,mergeBase,baseline,migrations,
  latestMigration,actualTypesSha256,
}){
  const errors=[];
  const offline=changedActive.filter(entry=>
    entry.status!=="D" && isOfflineOperatorReplayProof(proofs.get(entry.path)));
  const latestEntry=changedActive.at(-1);
  const latest=proofs.get(latestEntry?.path);
  if(offline.length!==1 || !isOfflineOperatorReplayProof(latest)){
    errors.push("offline proof must bind one latest changed active migration");
    return errors;
  }
  const candidate=latest.replay_candidate_head_sha;
  if(git(["merge-base","--is-ancestor",candidate,"HEAD"],{allowFailure:true}).status!==0)
    errors.push("offline tested commit is not an ancestor of current HEAD");
  if(git(["merge-base","--is-ancestor",mergeBase,candidate],{allowFailure:true}).status!==0)
    errors.push("offline tested commit predates the merge base");
  const atCandidate=git(["rev-parse",candidate+":"+latestEntry.path],{allowFailure:true});
  const atHead=git(["hash-object",latestEntry.path],{allowFailure:true});
  if(atCandidate.status!==0 || atHead.status!==0 ||
     atCandidate.stdout.trim()!==atHead.stdout.trim())
    errors.push("offline migration bytes changed after acceptance");
  const typesAtCandidate=git(["rev-parse",candidate+":src/types/database.types.ts"],{allowFailure:true});
  const typesAtHead=git(["hash-object","src/types/database.types.ts"],{allowFailure:true});
  if(typesAtCandidate.status!==0 || typesAtHead.status!==0 ||
     typesAtCandidate.stdout.trim()!==typesAtHead.stdout.trim())
    errors.push("offline database types changed after acceptance");
  const candidateNames=git(["ls-tree","-r","--name-only",candidate,"--","supabase/migrations"],
    {allowFailure:true}).stdout.split(/\r?\n/).filter(v=>v.endsWith(".sql"))
    .map(v=>path.basename(v)).sort();
  if(JSON.stringify(candidateNames)!==JSON.stringify(migrations))
    errors.push("offline active migration filename set changed after acceptance");
  const seal=baseline.schemaSeal??{};
  if(seal.mode!==OFFLINE_OPERATOR_SCHEMA_SEAL_MODE ||
     seal.sourceProjectRef!==OFFLINE_OPERATOR_SOURCE ||
     seal.baseMainSha!==mergeBase ||
     seal.replayCandidateHeadSha!==candidate ||
     seal.operatorReceiptUrl!==latest.operator_receipt_url ||
     seal.migrationHead!==latest.schema_migration_head ||
     baseline.typesSha256!==actualTypesSha256 ||
     latest.schema_types_sha256!==actualTypesSha256 ||
     baseline.migrationCount!==migrations.length ||
     latest.schema_migration_count!==migrations.length ||
     baseline.latestMigration!==latestMigration ||
     latestMigration!==path.basename(latestEntry.path) ||
     seal.workflowRunId!=null)
    errors.push("offline operator schema seal does not bind exact tested migration, types and receipt");
  return errors;
}
