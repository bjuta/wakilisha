import { describe, expect, it, vi } from "vitest";
import {runAdaptiveInvestigationV1, type InvestigationPassV1} from "../../scripts/registry/agents/mizizi/runtime/adaptive-investigation-v1";
import {createOpenAIInvestigationAnalystV1} from "../../scripts/registry/agents/mizizi/runtime/openai-investigation-analyst-v1";
import {createAdaptiveResearchWorkerHandlerV1} from "../../scripts/registry/agents/mizizi/runtime/adaptive-research-worker-handler-v1";
import {
  runResearchWorkerCycleV1,
  type WorkerRpc,
  type ResearchJobV1,
  type VerifiedResearchSourceV1,
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
const verifiedSource:VerifiedResearchSourceV1={
 sourceId:EVENT,caseId:CASE,workspaceId:WORKSPACE,
 sourceUseBasis:"documented_contract",permissionAuthorityRef:"contract:research-use-1",
 privateResearchAllowed:true,sourceOriginRef:"original:source-a",
 lineageKey:"origin:source-a",sourcePayloadFingerprint:"a".repeat(64),
 observedAt:new Date(NOW-60000).toISOString(),validUntil:null,revokedAt:null,
};
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
    return [verifiedSource];
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
    await expect(cycle(rpc,async()=>evidence,{verifySources:async()=>[]}))
      .resolves.toMatchObject({failed:1,succeeded:0});
    expect(calls.map(x=>x.fn)).not.toContain("mizizi_complete_case_research_job_v1");
  }
  const evidence={...finding,status:"evidence_recorded" as const,sourceReferences:[EVENT]};
  // The trusted verifier must return actual bound, permitted, non-revoked
  // source authority. A bare true, copied model output, or missing licence
  // metadata must never complete a claimed investigation.
  for(const damaged of [
    {...verifiedSource,sourceUseBasis:"unknown"},
    {...verifiedSource,privateResearchAllowed:false},
    {...verifiedSource,permissionAuthorityRef:""},
    {...verifiedSource,lineageKey:""},
    {...verifiedSource,sourcePayloadFingerprint:"invalid"},
    {...verifiedSource,caseId:WORKSPACE},
    {...verifiedSource,workspaceId:CASE},
    {...verifiedSource,sourceId:JOB},
    {...verifiedSource,observedAt:new Date(NOW+1000).toISOString()},
    {...verifiedSource,validUntil:new Date(NOW-1000).toISOString()},
    {...verifiedSource,revokedAt:new Date(NOW-1000).toISOString()},
  ]){
    const {rpc,calls}=harness();
    await expect(cycle(rpc,async()=>evidence,{verifySources:async()=>[damaged]}))
      .resolves.toMatchObject({failed:1,succeeded:0});
    expect(calls.map(x=>x.fn)).not.toContain("mizizi_complete_case_research_job_v1");
  }
  const unconfirmed=harness();
  await expect(cycle(unconfirmed.rpc,async()=>evidence,{
    verifySources:async()=>true,
  })).resolves.toMatchObject({failed:1,succeeded:0});
  expect(unconfirmed.calls.map(x=>x.fn)).not.toContain("mizizi_complete_case_research_job_v1");
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


describe("MIZIZI adaptive unfamiliar investigation (same accepted worker boundary)",()=>{
 const identity={caseId:CASE,workspaceId:WORKSPACE,
  openingQuestion:"Who actually performed on the disputed version of this recording?"};
 const authority={sourceId:EVENT,caseId:CASE,workspaceId:WORKSPACE,originKey:"original-session-record",
  lineageKey:"session-record-family",fingerprint:"a".repeat(64),
  authorityRef:"firstparty:research-allowed",
  useBasis:"first_party" as const,
  observedAt:new Date(NOW-60000).toISOString(),expiresAt:null,revokedAt:null,
  privateResearchAllowed:true,externalModelProcessingAllowed:true};
 const source={source:authority,excerpt:"The original paperwork is incomplete.",
  citation:"source:first-party-session-record"};
 const hypothesis={statement:"The historical performer identity is not yet established.",
  sourceIds:[EVENT],interpretation:"hypothesis" as const,uncertainty:.8,
  reasoningSummary:"There are two explanations but no original direct confirmation."};
 const lead=(question:string)=>({question,
  rationale:"This source could distinguish two competing interpretations.",
  expectedInformationGain:.8,importance:.9,estimatedCostUnits:1});
 const answer=(leads:any[],requestedDisposition:"continue"|"pause"|"conclude")=>({
  hypotheses:[hypothesis],leads,
  passFinding:"The first evidence does not establish the credited performer.",
  requestedDisposition,modelVersion:"test-analyst",promptFingerprint:"b".repeat(64)
 });
 const memory=()=>{
  const rows:InvestigationPassV1[]=[];
  return {rows,
   read:async()=>[...rows],
   append:async(_:unknown,ordinal:number,prior:string|null,pass:InvestigationPassV1)=>{
    if(ordinal!==rows.length+1||(rows.at(-1)?.fingerprint??null)!==prior)
      throw new Error("STALE_APPEND");
    rows.push(structuredClone(pass));
   }
  };
 };
 it("chooses a second and third question, persists each pass and pauses rather than fabricating a conclusion",async()=>{
  const store=memory(),asked:string[]=[];
  const q2="Were these recordings made in different recording sessions?";
  const q3="Is there original performer documentation for the alternate version?";
  const result=await runAdaptiveInvestigationV1({identity,store,maxNewPasses:5,
   maxTotalPasses:20,costBudgetUnits:20,now:()=>NOW,
   readSources:async(_,question)=>{asked.push(question);return [source];},
   analyze:async(_,__,history)=>history.length===0?answer([lead(q2)],"continue"):
     history.length===1?answer([lead(q3)],"continue"):answer([],"pause"),
   verifyFinding:async()=>({verified:false,verificationRef:null}),
  });
  expect(result).toMatchObject({passesAdded:3,totalPasses:3,disposition:"paused"});
  expect(asked).toEqual([identity.openingQuestion,q2,q3]);
  expect(store.rows.map(p=>p.decision.action)).toEqual(["continue","continue","pause"]);
  expect(store.rows[2].findings[0].independentlyVerified).toBe(false);
  expect(store.rows[1].predecessorFingerprint).toBe(store.rows[0].fingerprint);
  expect(store.rows[0].proposedLeads[0].question).toBe(q2);
 });
 it("resumes an interrupted investigation at its next question, not pass one",async()=>{
  const store=memory();const reader=vi.fn(async()=>[source]);
  const q2="Can the original release liner notes resolve this discrepancy?";
  const base={identity,store,maxTotalPasses:20,costBudgetUnits:20,
   now:()=>NOW,readSources:reader,
   verifyFinding:async()=>({verified:false,verificationRef:null})};
  await runAdaptiveInvestigationV1({...base,maxNewPasses:1,
   analyze:async()=>answer([lead(q2)],"continue")});
  const result=await runAdaptiveInvestigationV1({...base,maxNewPasses:3,
   analyze:async()=>answer([],"pause")});
  expect(result).toMatchObject({totalPasses:2,passesAdded:1,disposition:"paused"});
  expect(reader.mock.calls).toHaveLength(2);
  expect(store.rows[1].question).toBe(q2);
 });
 it("rejects false citations, unauthorized model processing and tampered memory",async()=>{
  const store=memory(),base={identity,store,maxNewPasses:3,maxTotalPasses:20,
   costBudgetUnits:20,now:()=>NOW,readSources:async()=>[source],
   verifyFinding:async()=>({verified:false,verificationRef:null})};
  await expect(runAdaptiveInvestigationV1({...base,analyze:async()=>({
   ...answer([],"conclude"),
   hypotheses:[{...hypothesis,sourceIds:[JOB],interpretation:"supported" as const}]
  })})).rejects.toThrow("UNOBSERVED_EVIDENCE_CITATION");
  expect(store.rows).toHaveLength(0);
  await expect(runAdaptiveInvestigationV1({...base,readSources:async()=>[
   {...source,source:{...authority,externalModelProcessingAllowed:false}}
  ],analyze:async()=>answer([],"pause")})).rejects.toThrow("SOURCE_AUTHORITY_UNVERIFIED");
  await runAdaptiveInvestigationV1({...base,analyze:async()=>answer([],"pause")});
  const tampered={...store,read:async()=>store.rows.map(p=>({...p,question:"Tampered claim direction"}))};
  await expect(runAdaptiveInvestigationV1({...base,store:tampered,
   analyze:async()=>answer([],"pause")})).rejects.toThrow("HISTORY_CORRUPT");
 });
 it("executes two adaptive research passes through the existing actual worker RPC lifecycle",async()=>{
  const store=memory(),rpc=harness();
  const followup="Did the disputed credits originate from an alternate recording session?";
  const handler=createAdaptiveResearchWorkerHandlerV1({
   store,openingQuestion:async(job)=>{expect(job.caseId).toBe(CASE);
    return identity.openingQuestion;},
   readSources:async()=>[source],
   analyze:async(_,__,history)=>history.length===0?
    answer([lead(followup)],"continue"):answer([],"pause"),
   verifyFinding:async()=>({verified:false,verificationRef:null}),
   maxNewPasses:5,maxTotalPasses:20,costBudgetUnits:20,
  });
  const done=await cycle(rpc.rpc,handler,{
   verifySources:async()=>[verifiedSource],
  });
  expect(done).toMatchObject({claimed:1,succeeded:1,failed:0});
  expect(store.rows.map(p=>p.question)).toEqual([identity.openingQuestion,followup]);
  expect(store.rows.map(p=>p.decision.action)).toEqual(["continue","pause"]);
  expect(rpc.calls.at(-1)?.fn).toBe("mizizi_complete_case_research_job_v1");
  expect(rpc.calls.at(-1)?.args.p_result).toMatchObject({
   contract:"mizizi.read_only_research_result.v1",
   status:"evidence_recorded",sourceReferences:[EVENT],
  });
 });
 it("refuses sending private excerpts to the model without explicit external processing authority",async()=>{
  let sent=false;
  const analyze=createOpenAIInvestigationAnalystV1({
   apiKey:"test-api-key-not-real",model:"gpt-6",
   transport:async()=>{sent=true;throw new Error("must not send");}
  });
  await expect(analyze(identity.openingQuestion,
   [{...source,source:{...authority,externalModelProcessingAllowed:false}}],[]))
   .rejects.toThrow("EXTERNAL_SOURCE_PROCESSING_DENIED");
  expect(sent).toBe(false);
 });
});
