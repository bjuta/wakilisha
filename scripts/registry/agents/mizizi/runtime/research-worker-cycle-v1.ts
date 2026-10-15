/**
 * Scoped lifecycle adapter for the four existing MIZIZI service-only RPCs.
 * A caller must supply a genuine, authorized read-only researcher. No
 * default result, new queue, Registry writer or credential handling exists.
 */
export const RESEARCH_WORKER_CYCLE_CONTRACT = "mizizi.research_worker_cycle.v1" as const;
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const WORKER=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const JOB_TYPE="mizizi.case_research_v1";
export type WorkerRpcResult=Readonly<{data:unknown;error:{message:string}|null}>;
export type WorkerRpc=(fn:string,args:Record<string,unknown>)=>Promise<WorkerRpcResult>;
export type ResearchJobV1=Readonly<{
 jobId:string;receiptId:string;caseId:string;workspaceId:string;
 expectedRevision:number;attempt:number;maxAttempts:number;leaseExpiresAt:string;
}>;
export type ReadOnlyResearchResultV1=Readonly<{
 contract:"mizizi.read_only_research_result.v1";caseId:string;
 status:"insufficient_evidence"|"evidence_recorded";
 sourceReferences:readonly string[];
}>;
export type ResearchJobHandlerV1=(job:ResearchJobV1)=>Promise<ReadOnlyResearchResultV1>;
/** Independent source authority, supplied only by a trusted server-side reader.
 * A model or research callback cannot vouch for its own source identities. */
export type ResearchSourceVerifierV1=(
 job:ResearchJobV1,sourceReferences:readonly string[],
)=>Promise<boolean>;
export type WorkerCycleResultV1=Readonly<{
 contract:typeof RESEARCH_WORKER_CYCLE_CONTRACT;
 recovered:number;claimed:number;succeeded:number;failed:number;
}>;
function record(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=="object"||Array.isArray(value))
   throw new TypeError("MIZIZI_WORKER_INVALID_RECORD");
 return value as Record<string,unknown>;
}
function uuid(value:unknown):string{
 if(typeof value!=="string"||!UUID.test(value))
   throw new TypeError("MIZIZI_WORKER_INVALID_ID");
 return value.toLowerCase();
}
function positive(value:unknown):number{
 if(typeof value!=="number"||!Number.isSafeInteger(value)||value<1)
   throw new TypeError("MIZIZI_WORKER_INVALID_INTEGER");
 return value;
}
function confirmed(result:WorkerRpcResult,operation:string):unknown{
 if(!result||result.error)throw new Error("MIZIZI_WORKER_"+operation+"_RPC_UNCONFIRMED");
 return result.data;
}
function validateClaim(raw:unknown,nowMs:number):ResearchJobV1{
 const row=record(raw),payload=record(row.input_payload);
 const jobId=uuid(row.job_id),receiptId=uuid(row.command_receipt_id);
 const caseId=uuid(row.resource_id),workspaceId=uuid(payload.workspace_id);
 if(row.command_type!==JOB_TYPE||row.job_type!==JOB_TYPE||
    uuid(payload.case_id)!==caseId||payload.operation!=="read_only_research")
   throw new TypeError("MIZIZI_WORKER_UNBOUND_JOB");
 const expectedRevision=positive(payload.expected_case_revision);
 const attempt=positive(row.attempt_count),maxAttempts=positive(row.max_attempts);
 if(attempt>maxAttempts)throw new TypeError("MIZIZI_WORKER_ATTEMPT_OVERFLOW");
 const expires=Date.parse(String(row.lease_expires_at));
 if(!Number.isFinite(expires)||expires<=nowMs)
   throw new TypeError("MIZIZI_WORKER_STALE_LEASE");
 return Object.freeze({jobId,receiptId,caseId,workspaceId,expectedRevision,
   attempt,maxAttempts,leaseExpiresAt:new Date(expires).toISOString()});
}
async function validatedResult(
 value:unknown,job:ResearchJobV1,verifySources?:ResearchSourceVerifierV1,
):Promise<Readonly<Record<string,unknown>>>{
 const result=record(value);
 if(result.contract!=="mizizi.read_only_research_result.v1"||
    uuid(result.caseId)!==job.caseId||
    !["insufficient_evidence","evidence_recorded"].includes(String(result.status))||
    !Array.isArray(result.sourceReferences)||result.sourceReferences.length>20||
    result.sourceReferences.some((s:unknown)=>typeof s!=="string"||!UUID.test(s))||
    (result.status==="evidence_recorded"&&result.sourceReferences.length===0))
   throw new TypeError("MIZIZI_WORKER_UNVERIFIED_RESEARCH_RESULT");
 // Result fields must remain bounded and never forward a researcher's
 // arbitrary payload or source notes. A bare UUID is NOT source authority.
 const sourceReferences=(result.sourceReferences as string[]).map(s=>s.toLowerCase());
 if(new Set(sourceReferences).size!==sourceReferences.length||
    (result.status==="insufficient_evidence"&&sourceReferences.length!==0))
   throw new TypeError("MIZIZI_WORKER_UNVERIFIED_RESEARCH_RESULT");
 const safe={contract:result.contract,caseId:job.caseId,status:result.status,
   sourceReferences};
 if(new TextEncoder().encode(JSON.stringify(safe)).length>8192)
   throw new TypeError("MIZIZI_WORKER_RESULT_TOO_LARGE");
 if(result.status==="evidence_recorded"){
   if(typeof verifySources!=="function")
     throw new TypeError("MIZIZI_WORKER_SOURCE_VERIFIER_REQUIRED");
   const verified=await verifySources(job,Object.freeze([...sourceReferences]));
   if(verified!==true)
     throw new TypeError("MIZIZI_WORKER_SOURCE_PROVENANCE_UNVERIFIED");
 }
 return Object.freeze(safe);
}
/**
 * One bounded recover/claim/handle cycle. The SQL functions remain the sole
 * lease, retry and dead-letter authority. A completion RPC timeout is
 * indeterminate and MUST NOT trigger a contradictory fail request.
 */
export async function runResearchWorkerCycleV1(input:Readonly<{
 rpc:WorkerRpc;research:ResearchJobHandlerV1;workerId:string;
 verifySources?:ResearchSourceVerifierV1;
 limit?:number;leaseSeconds?:number;retryDelaySeconds?:number;now?:()=>number;
}>):Promise<WorkerCycleResultV1>{
 const {rpc,research,workerId}=input||{} as typeof input;
 const limit=input?.limit??1,leaseSeconds=input?.leaseSeconds??300;
 const retryDelay=input?.retryDelaySeconds??60;
 const now=input?.now??Date.now;
 if(typeof rpc!=="function"||typeof research!=="function"||typeof now!=="function"||
    typeof workerId!=="string"||!WORKER.test(workerId)||
    !Number.isInteger(limit)||limit<1||limit>10||
    !Number.isInteger(leaseSeconds)||leaseSeconds<30||leaseSeconds>3600||
    !Number.isInteger(retryDelay)||retryDelay<1||retryDelay>3600)
   throw new TypeError("MIZIZI_WORKER_INVALID_CONFIG");
 const recovered=confirmed(await rpc("mizizi_recover_expired_case_research_jobs_v1",{
   p_limit:100,p_retry_delay_seconds:retryDelay,
 }),"RECOVERY");
 if(typeof recovered!=="number"||!Number.isSafeInteger(recovered)||recovered<0||recovered>100)
   throw new TypeError("MIZIZI_WORKER_UNTRUSTED_RECOVERY_RECEIPT");
 const raw=confirmed(await rpc("mizizi_claim_case_research_jobs_v1",{
   p_worker_id:workerId,p_limit:limit,p_lease_seconds:leaseSeconds,
 }),"CLAIM");
 if(!Array.isArray(raw)||raw.length>limit)
   throw new TypeError("MIZIZI_WORKER_UNTRUSTED_CLAIM_SET");
 const jobs=raw.map(row=>validateClaim(row,now()));
 if(new Set(jobs.map(j=>j.jobId)).size!==jobs.length)
   throw new TypeError("MIZIZI_WORKER_DUPLICATE_LEASE");
 let succeeded=0,failed=0;
 for(const job of jobs){
   let researchResult:Readonly<Record<string,unknown>>;
   try{
     researchResult=await validatedResult(await research(job),job,input.verifySources);
   }catch(error){
     const failedReceipt=record(confirmed(await rpc("mizizi_fail_case_research_job_v1",{
       p_job_id:job.jobId,p_worker_id:workerId,
       p_error:error instanceof Error?error.name:"Research handler failed",
       p_retryable:true,p_retry_delay_seconds:retryDelay,
     }),"FAIL"));
     if(uuid(failedReceipt.job_id)!==job.jobId||uuid(failedReceipt.case_id)!==job.caseId||
       !uuid(failedReceipt.outbox_event_id)||
       !["retry_wait","dead_letter"].includes(String(failedReceipt.job_status))||
       (failedReceipt.job_status==="retry_wait"&&failedReceipt.command_receipt_status!=="accepted")||
       (failedReceipt.job_status==="dead_letter"&&failedReceipt.command_receipt_status!=="failed"))
       throw new TypeError("MIZIZI_WORKER_UNTRUSTED_FAILURE_RECEIPT");
     failed++;
     continue;
   }
   if(now()>=Date.parse(job.leaseExpiresAt))
     throw new Error("MIZIZI_WORKER_LEASE_EXPIRED_BEFORE_COMPLETION");
   // Never call fail if completion may already have committed.
   const receipt=record(confirmed(await rpc("mizizi_complete_case_research_job_v1",{
     p_job_id:job.jobId,p_worker_id:workerId,p_result:researchResult,
   }),"COMPLETION"));
   if(uuid(receipt.job_id)!==job.jobId||uuid(receipt.case_id)!==job.caseId||
      uuid(receipt.command_receipt_id)!==job.receiptId||
      receipt.job_status!=="succeeded"||!uuid(receipt.success_event_id))
     throw new TypeError("MIZIZI_WORKER_UNTRUSTED_COMPLETION_RECEIPT");
   succeeded++;
 }
 return Object.freeze({contract:RESEARCH_WORKER_CYCLE_CONTRACT,
   recovered,claimed:jobs.length,succeeded,failed});
}
