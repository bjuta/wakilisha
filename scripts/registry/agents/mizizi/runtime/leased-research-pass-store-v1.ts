/** Service-only PostgREST bridge to the leased, immutable research-pass SQL RPCs.
 * No private schema USAGE, arbitrary SQL, or second queue for the worker.
 */
import {createHash} from "node:crypto";
import type {WorkerRpc,ResearchJobV1} from "./research-worker-cycle-v1.ts";
import type {InvestigationStoreV1,InvestigationIdentityV1,
 InvestigationPassV1} from "./adaptive-investigation-v1.ts";
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
function expectResult(result:Awaited<ReturnType<WorkerRpc>>,label:string):unknown{
 if(!result||result.error)throw new Error("MIZIZI_PASS_"+label+"_RPC_UNCONFIRMED");
 return result.data;
}
export function createLeasedResearchPassStoreV1(
 rpc:WorkerRpc,job:ResearchJobV1,workerId:string,
):InvestigationStoreV1{
 if(typeof rpc!=="function"||!UUID.test(job?.jobId)||!UUID.test(job?.caseId)||
    !UUID.test(job?.workspaceId)||!workerId||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(workerId))
  throw new TypeError("MIZIZI_PASS_INVALID_LEASE_CONTEXT");
 function verifyIdentity(id:InvestigationIdentityV1){
  if(id.caseId!==job.caseId||id.workspaceId!==job.workspaceId)
   throw new Error("MIZIZI_PASS_CROSS_CASE_DENIED");
 }
 return {
  read:async(identity)=>{
   verifyIdentity(identity);
   const result=expectResult(await rpc("mizizi_read_research_passes_v1",{
    p_job_id:job.jobId,p_worker_id:workerId
   }),"READ");
   if(!Array.isArray(result)||result.length>10000)
    throw new Error("MIZIZI_PASS_UNTRUSTED_READ");
   return result.map(row=>{
    if(!row||typeof row!=="object"||Array.isArray(row))
     throw new Error("MIZIZI_PASS_UNTRUSTED_ROW");
    const rec=row as Record<string,unknown>;
    if(typeof rec.body_text!=="string"||typeof rec.fingerprint!=="string"||
       !SHA.test(rec.fingerprint)||rec.body_text.length>32768)
     throw new Error("MIZIZI_PASS_INVALID_STORED_BYTES");
    const hash=createHash("sha256").update(rec.body_text,"utf8").digest("hex");
    if(hash!==rec.fingerprint)
     throw new Error("MIZIZI_PASS_PERSISTED_HASH_MISMATCH");
    let body:unknown;
    try{body=JSON.parse(rec.body_text);}catch{
     throw new Error("MIZIZI_PASS_INVALID_STORED_JSON");
    }
    if(!body||typeof body!=="object"||Array.isArray(body)||
       (body as Record<string,unknown>).fingerprint!==undefined||
       (body as Record<string,unknown>).ordinal!==rec.ordinal)
     throw new Error("MIZIZI_PASS_INVALID_STORED_CONTRACT");
    return {...body,fingerprint:hash} as InvestigationPassV1;
   });
  },
  append:async(identity,expectedOrdinal,previous,pass)=>{
   verifyIdentity(identity);
   if(pass.caseId!==job.caseId||pass.workspaceId!==job.workspaceId||
      pass.ordinal!==expectedOrdinal||pass.predecessorFingerprint!==previous)
    throw new Error("MIZIZI_PASS_INVALID_APPEND_IDENTITY");
   const body=JSON.stringify({...pass,fingerprint:undefined});
   const hash=createHash("sha256").update(body,"utf8").digest("hex");
   if(hash!==pass.fingerprint)
    throw new Error("MIZIZI_PASS_INVALID_APPEND_HASH");
   const result=expectResult(await rpc("mizizi_append_research_pass_v1",{
    p_job_id:job.jobId,p_worker_id:workerId,
    p_body_text:body,p_fingerprint:hash,p_predecessor:previous
   }),"APPEND");
   if(!Array.isArray(result)||result.length!==1)
    throw new Error("MIZIZI_PASS_APPEND_RECEIPT_UNCONFIRMED");
   const receipt=result[0] as Record<string,unknown>;
   if(receipt?.case_id!==job.caseId||receipt.ordinal!==expectedOrdinal||
      receipt.fingerprint!==hash||!["created","replayed"].includes(String(receipt.outcome)))
    throw new Error("MIZIZI_PASS_APPEND_RECEIPT_MISMATCH");
  }
 };
}
