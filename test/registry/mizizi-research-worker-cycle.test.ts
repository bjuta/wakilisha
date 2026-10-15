import { describe, expect, it, vi } from "vitest";
import {
  runResearchWorkerCycleV1,
  type WorkerRpc,
  type ResearchJobV1,
} from "../../scripts/registry/agents/mizizi/runtime/research-worker-cycle-v1";

const JOB="11111111-1111-4111-8111-111111111111";
const CASE="22222222-2222-4222-8222-222222222222";
const RECEIPT="33333333-3333-4333-8333-333333333333";
const WORKSPACE="44444444-4444-4444-8444-444444444444";
const EVENT="55555555-5555-4555-8555-555555555555";
const NOW=Date.parse("2026-10-13T12:00:00Z");
const row={
 job_id:JOB,command_receipt_id:RECEIPT,resource_id:CASE,
 command_type:"mizizi.case_research_v1",job_type:"mizizi.case_research_v1",
 attempt_count:1,max_attempts:3,lease_expires_at:new Date(NOW+300000).toISOString(),
 input_payload:{case_id:CASE,workspace_id:WORKSPACE,expected_case_revision:2,
   operation:"read_only_research"},
};
const finding={contract:"mizizi.read_only_research_result.v1" as const,
 caseId:CASE,status:"insufficient_evidence" as const,sourceReferences:[]};
const done={job_id:JOB,case_id:CASE,command_receipt_id:RECEIPT,
 job_status:"succeeded",success_event_id:EVENT};
const failed={job_id:JOB,case_id:CASE,job_status:"retry_wait",
 command_receipt_status:"accepted",outbox_event_id:EVENT};

function harness(overrides:{claimed?:unknown;recovered?:unknown;
 completed?:unknown;failed?:unknown;reject?:string}={}){
 const calls:Array<{fn:string;args:Record<string,unknown>}>=[];
 const rpc:WorkerRpc=vi.fn(async(fn,args)=>{
  calls.push({fn,args});
  if(fn===overrides.reject)return {data:null,error:{message:"Network unknown"}};
  return {data:fn==="mizizi_recover_expired_case_research_jobs_v1"?
   (overrides.recovered??0):fn==="mizizi_claim_case_research_jobs_v1"?
   (overrides.claimed??[row]):fn==="mizizi_complete_case_research_job_v1"?
   (overrides.completed??done):(overrides.failed??failed),error:null};
 });
 return {rpc,calls};
}
const cycle=(rpc:WorkerRpc,handler:()=>Promise<any>=async()=>finding,
 extra:Record<string,unknown>={})=>
 runResearchWorkerCycleV1({rpc,research:handler,workerId:"scoped-worker",now:()=>NOW,...extra});

describe("Actual MIZIZI shared worker transport lifecycle adapter",()=>{
 it("runs recover, claim and completion, forwarding only validated research fields",async()=>{
  const {rpc,calls}=harness();
  const handler=vi.fn(async(job:ResearchJobV1)=>{
   expect(job).toMatchObject({jobId:JOB,receiptId:RECEIPT,caseId:CASE,expectedRevision:2});
   return {...finding,privatePayload:"DO_NOT_EXPORT"};
  });
  await expect(cycle(rpc,handler)).resolves.toMatchObject({recovered:0,claimed:1,succeeded:1,failed:0});
  expect(handler).toHaveBeenCalledTimes(1);
  expect(calls.map(v=>v.fn)).toEqual([
   "mizizi_recover_expired_case_research_jobs_v1",
   "mizizi_claim_case_research_jobs_v1",
   "mizizi_complete_case_research_job_v1",
  ]);
  expect(calls[2].args.p_result).toEqual(finding);
  expect(JSON.stringify(calls)).not.toContain("DO_NOT_EXPORT");
 });
 it("does not invent work when the queue is empty",async()=>{
  const {rpc,calls}=harness({claimed:[]});const handler=vi.fn(async()=>finding);
  await expect(cycle(rpc,handler)).resolves.toMatchObject({claimed:0,succeeded:0,failed:0});
  expect(handler).not.toHaveBeenCalled();expect(calls).toHaveLength(2);
 });
 it("sends research exceptions to the typed retry RPC without leaking raw errors",async()=>{
  const {rpc,calls}=harness();
  await expect(cycle(rpc,async()=>{throw new TypeError("PRIVATE source details");}))
   .resolves.toMatchObject({claimed:1,succeeded:0,failed:1});
  expect(calls.at(-1)?.fn).toBe("mizizi_fail_case_research_job_v1");
  expect(calls.at(-1)?.args.p_error).toBe("TypeError");
  expect(JSON.stringify(calls)).not.toContain("PRIVATE source details");
 });
 it("never issues a contradictory failure after an indeterminate completion",async()=>{
  const {rpc,calls}=harness({reject:"mizizi_complete_case_research_job_v1"});
  await expect(cycle(rpc)).rejects.toThrow("COMPLETION_RPC_UNCONFIRMED");
  expect(calls.map(v=>v.fn)).not.toContain("mizizi_fail_case_research_job_v1");
 });
 it("stops before claiming when recovery cannot be confirmed",async()=>{
  const {rpc,calls}=harness({reject:"mizizi_recover_expired_case_research_jobs_v1"});
  await expect(cycle(rpc)).rejects.toThrow("RECOVERY_RPC_UNCONFIRMED");
  expect(calls).toHaveLength(1);
 });
 it.each([null,-1,101,1.4,"0",{},[]])("refuses untrusted recovery count %j",async count=>{
  const {rpc,calls}=harness();
  const wrapper:WorkerRpc=async(fn,args)=>fn==="mizizi_recover_expired_case_research_jobs_v1"?
   {data:count,error:null}:rpc(fn,args);
  await expect(cycle(wrapper)).rejects.toThrow("UNTRUSTED_RECOVERY_RECEIPT");
  expect(calls).toHaveLength(0);
 });
 it.each([
  {command_type:"unrelated.job"},{job_type:"unrelated.job"},
  {resource_id:WORKSPACE},{job_id:"not-uuid"},
  {attempt_count:0},{attempt_count:4},{max_attempts:0},
  {lease_expires_at:new Date(NOW-1000).toISOString()},
  {lease_expires_at:"nonsense"},{command_receipt_id:null},
  {input_payload:{...row.input_payload,case_id:WORKSPACE}},
  {input_payload:{...row.input_payload,workspace_id:"bad"}},
  {input_payload:{...row.input_payload,expected_case_revision:0}},
  {input_payload:{...row.input_payload,operation:"registry_mutation"}},
 ])("rejects stale or cross-authority claims before dispatch: %j",async patch=>{
  const {rpc,calls}=harness({claimed:[{...row,...patch}]});
  const handler=vi.fn(async()=>finding);
  await expect(cycle(rpc,handler)).rejects.toThrow();
  expect(handler).not.toHaveBeenCalled();expect(calls).toHaveLength(2);
 });
 it("rejects duplicate leases before any handler runs",async()=>{
  const {rpc,calls}=harness({claimed:[row,row]});
  const handler=vi.fn(async()=>finding);
  await expect(cycle(rpc,handler,{limit:2})).rejects.toThrow("DUPLICATE_LEASE");
  expect(handler).not.toHaveBeenCalled();expect(calls).toHaveLength(2);
 });
 it("refuses to treat unproven or cross-case findings as successful research",async()=>{
  const bad=[null,{},[],{...finding,caseId:WORKSPACE},
    {...finding,status:"evidence_recorded"},{...finding,status:"canonical_merge"},
    {...finding,sourceReferences:["free-form-secret"]},
    {...finding,sourceReferences:Array(21).fill(JOB)}];
  for(const raw of bad){
    const {rpc,calls}=harness();
    await expect(cycle(rpc,async()=>raw)).resolves.toMatchObject({succeeded:0,failed:1});
    expect(calls.map(v=>v.fn)).not.toContain("mizizi_complete_case_research_job_v1");
  }
 });
 it("rejects false completion receipts without issuing another mutation",async()=>{
  for(const patch of [{job_id:WORKSPACE},{case_id:WORKSPACE},
    {command_receipt_id:WORKSPACE},{job_status:"queued"},{success_event_id:null}]){
    const {rpc,calls}=harness({completed:{...done,...patch}});
    await expect(cycle(rpc)).rejects.toThrow();
    expect(calls.map(v=>v.fn)).not.toContain("mizizi_fail_case_research_job_v1");
  }
 });
 it("refuses completion when the research callback consumed the lease",async()=>{
  const {rpc,calls}=harness();let clock=NOW;
  await expect(cycle(rpc,async()=>{clock=NOW+301000;return finding;},{now:()=>clock}))
   .rejects.toThrow("LEASE_EXPIRED_BEFORE_COMPLETION");
  expect(calls.map(v=>v.fn)).not.toContain("mizizi_complete_case_research_job_v1");
 });
 it.each([{workerId:"x"},{limit:11},{limit:0},{leaseSeconds:29},
    {leaseSeconds:3601},{retryDelaySeconds:0},{retryDelaySeconds:3601},
    {research:null},{rpc:null}])("rejects invalid setup before network calls: %j",async patch=>{
   const {rpc,calls}=harness();
   await expect(runResearchWorkerCycleV1({rpc,research:async()=>finding,
     workerId:"good-worker",now:()=>NOW,...patch} as never)).rejects.toThrow("INVALID_CONFIG");
   expect(calls).toHaveLength(0);
 });
 it("requires independent provenance validation for evidence-recorded results",async()=>{
  const evidence={...finding,status:"evidence_recorded" as const,sourceReferences:[EVENT]};
  const {rpc,calls}=harness();
  await expect(cycle(rpc,async()=>evidence)).resolves.toMatchObject({failed:1,succeeded:0});
  expect(calls.map(x=>x.fn)).not.toContain("mizizi_complete_case_research_job_v1");
  const v=vi.fn(async(job:ResearchJobV1,refs:readonly string[])=>{
    expect(job.caseId).toBe(CASE);
    expect(refs).toEqual([EVENT]);
    return true;
  });
  const approved=harness();
  await expect(cycle(approved.rpc,async()=>evidence,{verifySources:v}))
    .resolves.toMatchObject({failed:0,succeeded:1});
  expect(v).toHaveBeenCalledTimes(1);
  expect(approved.calls.at(-1)?.args.p_result).toEqual(evidence);
 });
 it("refuses unverified, duplicate or self-inconsistent evidence without completing jobs",async()=>{
  const bad=[
    {...finding,status:"evidence_recorded",sourceReferences:[EVENT]},
    {...finding,status:"evidence_recorded",sourceReferences:[EVENT,EVENT]},
    {...finding,sourceReferences:[EVENT]},
  ];
  for(const evidence of bad){
    const {rpc,calls}=harness();
    await expect(cycle(rpc,async()=>evidence,{verifySources:async()=>false}))
      .resolves.toMatchObject({failed:1,succeeded:0});
    expect(calls.map(x=>x.fn)).not.toContain("mizizi_complete_case_research_job_v1");
  }
 });
 it("does not accept forged failure receipts for retry or terminal outcomes",async()=>{
  for(const patch of [
    {command_receipt_status:"failed"},
    {outbox_event_id:"not-a-uuid"},
    {job_status:"dead_letter",command_receipt_status:"accepted"},
    {job_status:"unknown"},
  ]){
    const {rpc}=harness({failed:{...failed,...patch}});
    await expect(cycle(rpc,async()=>{throw new Error("bounded");}))
      .rejects.toThrow();
  }
  const {rpc,calls}=harness({failed:{...failed,job_status:"dead_letter",command_receipt_status:"failed"}});
  await expect(cycle(rpc,async()=>{throw new Error("bounded");}))
    .resolves.toMatchObject({failed:1,succeeded:0});
  expect(calls.at(-1)?.fn).toBe("mizizi_fail_case_research_job_v1");
 });

});
