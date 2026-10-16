import { describe, expect, it, vi } from "vitest";
import {runAdaptiveInvestigationV1, type InvestigationPassV1} from "../../scripts/registry/agents/mizizi/runtime/adaptive-investigation-v1";
import {createAnthropicInvestigationAnalystV1,resolveInstituteAnthropicConfigurationV1,discoverAnthropicResearchModelV1} from "../../scripts/registry/agents/mizizi/runtime/anthropic-investigation-analyst-v1";
import {createWikidataInvestigationReaderV1} from "../../scripts/registry/agents/mizizi/runtime/wikidata-investigation-reader-v1";
import {createMusicBrainzWorkReaderV1} from "../../scripts/registry/agents/mizizi/runtime/musicbrainz-work-reader-v1";
import {createAdaptiveResearchWorkerHandlerV1,runAdaptiveResearchWorkerCycleV1,runAnthropicAdaptiveResearchWorkerCycleV1} from "../../scripts/registry/agents/mizizi/runtime/adaptive-research-worker-handler-v1";
import {
  runResearchWorkerCycleV1,
  researchRetryDecisionV1,
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
   (overrides.completed??done):(overrides.failed??(args.p_retryable===false?
    {...failed,job_status:"dead_letter",command_receipt_status:"failed"}:failed)),error:null};
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
 it("binds external public research authority to the exact immutable job reason",async()=>{
  const question='Which original evidence supports the credits for "Suzanna" by Sauti Sol?';
  const approved={...row,input_payload:{...row.input_payload,
   reason:'PUBLIC_CC0_RESEARCH: '+question}};
  const a=harness({claimed:[approved]});
  await expect(cycle(a.rpc,async job=>{
   expect(job).toMatchObject({publicSourceSearchApproved:true,
    researchQuestion:question});
   return finding;
  })).resolves.toMatchObject({succeeded:1});
  const unapproved=harness({claimed:[{...row,input_payload:{
   ...row.input_payload,reason:question}}]});
  await expect(cycle(unapproved.rpc,async job=>{
   expect(job).toMatchObject({publicSourceSearchApproved:false,
    researchQuestion:null});
   return finding;
  })).resolves.toMatchObject({succeeded:1});
  const invalid=harness({claimed:[{...row,input_payload:{
   ...row.input_payload,reason:'PUBLIC_CC0_RESEARCH: private\nunauthorized'}}]});
  const handler=vi.fn(async()=>finding);
  await expect(cycle(invalid.rpc,handler)).rejects.toThrow('UNSAFE_PUBLIC_RESEARCH_QUESTION');
  expect(handler).not.toHaveBeenCalled();
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
  expect(calls.at(-1)?.args.p_retryable).toBe(false);
  expect(JSON.stringify(calls)).not.toContain("PRIVATE source details");
 });
 it("backs off transient research failures while stopping permanent errors",async()=>{
  const transient=harness({claimed:[{...row,attempt_count:3,max_attempts:25}]});
  const outcome=await cycle(transient.rpc,async()=>{
   throw new Error("MIZIZI_WIKIDATA_MAXLAG_DEFERRED");
  });
  expect(outcome).toMatchObject({failed:1,succeeded:0});
  expect(transient.calls.at(-1)?.args).toMatchObject({
   p_retryable:true,p_retry_delay_seconds:240
  });
  const provider=researchRetryDecisionV1(
   new Error("MIZIZI_ANALYST_UPSTREAM_UNAVAILABLE"),20);
  expect(provider).toMatchObject({retryable:true,delaySeconds:3600});
  for(const error of [
   new Error("MIZIZI_PASS_INVALID_APPEND_HASH"),
   new Error("MIZIZI_WIKIDATA_PUBLIC_QUERY_NOT_AUTHORIZED"),
   new Error("MIZIZI_ANALYST_EXTERNAL_SOURCE_PROCESSING_DENIED"),
   new TypeError("untrusted details")
  ]){
   expect(researchRetryDecisionV1(error,2).retryable).toBe(false);
  }
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
  privateResearchAllowed:true,externalModelProcessingAllowed:true,
  privateEvidenceRetentionAllowed:true};
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
  expect(store.rows[0].sourceReceipts[0]).toMatchObject({
   citation:source.citation,excerpt:source.excerpt,
   lineageKey:'session-record-family'
  });
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
 it("runs the full leased worker -> private pass-store -> adaptive investigator -> completion loop",async()=>{
  const backing=harness(),memory=new Map<number,{body_text:string;fingerprint:string;ordinal:number}>();
  const seen:string[]=[];
  const rpc:WorkerRpc=async(fn,args)=>{
   seen.push(fn);
   if(fn==="mizizi_read_research_passes_v1")return {
    data:[...memory.values()].sort((a,b)=>a.ordinal-b.ordinal),error:null};
   if(fn==="mizizi_append_research_pass_v1"){
    const raw=String(args.p_body_text),ordinal=JSON.parse(raw).ordinal;
    const fingerprint=String(args.p_fingerprint);
    if(ordinal!==memory.size+1)throw new Error("STALE_PERSISTENCE_TEST");
    memory.set(ordinal,{ordinal,body_text:raw,fingerprint});
    return {data:[{case_id:CASE,ordinal,fingerprint,outcome:"created"}],error:null};
   }
   return backing.rpc(fn,args);
  };
  const second="Was the producer independently credited in the original liner notes?";
  const modelCalls:{question:string;request:Record<string,unknown>}[]=[];
  const result=await runAnthropicAdaptiveResearchWorkerCycleV1({
   rpc,workerId:"scoped-worker",now:()=>NOW,maxNewPasses:4,maxTotalPasses:20,
   costBudgetUnits:10,openingQuestion:async()=>identity.openingQuestion,
   readSources:async()=>[source],
   anthropic:{apiKey:"test-anthropic-key-not-real",model:"claude-opus-4-8",
    transport:async(url,init)=>{
     expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
     const request=JSON.parse(String(init?.body)) as Record<string,unknown>;
     const packets=request.messages as Array<{role:string;content:string}>;
     const packet=JSON.parse(packets[0].content) as {
      question:string;history:unknown[];
     };
     modelCalls.push({question:packet.question,request});
     const parsed=packet.history.length===0?
      answer([lead(second)],"continue"):answer([],"pause");
     const {hypotheses,leads,passFinding,requestedDisposition}=parsed;
     return new Response(JSON.stringify({stop_reason:"end_turn",
      content:[{type:"text",text:JSON.stringify({
       hypotheses,leads,passFinding,requestedDisposition
      })}]}),{status:200,headers:{"Content-Type":"application/json"}});
    }
   },
   verifyFinding:async()=>({verified:false,verificationRef:null}),
   verifySources:async()=>[verifiedSource]
  });
  expect(result).toMatchObject({claimed:1,failed:0,succeeded:1});
  expect(memory.size).toBe(2);
  expect(JSON.parse(memory.get(2)!.body_text).question).toBe(second);
  expect(seen.filter(fn=>fn==="mizizi_append_research_pass_v1")).toHaveLength(2);
  expect(modelCalls.map(x=>x.question)).toEqual([identity.openingQuestion,second]);
  expect(modelCalls.every(x=>JSON.stringify(x.request).includes("test-anthropic-key-not-real")===false)).toBe(true);
  expect(seen.at(-1)).toBe("mizizi_complete_case_research_job_v1");
 });


 it("requires documented commercial MusicBrainz API permission before any source request",async()=>{
  const work="56950dba-94f8-46a9-aaaf-f2f59bbeed04";
  const requests=vi.fn(async()=>{throw Error("NO_NETWORK_EXPECTED");});
  const rates=vi.fn(async()=>true);
  const reader=createMusicBrainzWorkReaderV1({
   workId:work,authorizeCommercialAccess:async()=>null,
   acquireSharedRateSlot:rates,transport:requests as unknown as typeof fetch,
   now:()=>NOW
  });
  await expect(reader(identity,identity.openingQuestion,[]))
   .rejects.toThrow("MIZIZI_MUSICBRAINZ_COMMERCIAL_SOURCE_PERMISSION_REQUIRED");
  expect(rates).not.toHaveBeenCalled();
  expect(requests).not.toHaveBeenCalled();
  const permit={contractReference:"contract:mb-commercial-api-reviewed-v1",
   commercialApiAccessAllowed:true,coreDataOnly:true,
   privateResearchAllowed:true,externalModelProcessingAllowed:true,
   privateEvidenceRetentionAllowed:true,expiresAt:null,revokedAt:null};
  for(const denied of [
   {...permit,commercialApiAccessAllowed:false},
   {...permit,coreDataOnly:false},
   {...permit,externalModelProcessingAllowed:false},
   {...permit,privateEvidenceRetentionAllowed:false},
   {...permit,contractReference:""},
   {...permit,expiresAt:new Date(NOW-1).toISOString()},
   {...permit,revokedAt:new Date(NOW-1).toISOString()}
  ]){
   const blocked=createMusicBrainzWorkReaderV1({
    workId:work,authorizeCommercialAccess:async()=>denied,
    acquireSharedRateSlot:rates,transport:requests as unknown as typeof fetch,
    now:()=>NOW
   });
   await expect(blocked(identity,identity.openingQuestion,[]))
    .rejects.toThrow("MIZIZI_MUSICBRAINZ_COMMERCIAL_SOURCE_PERMISSION_REQUIRED");
  }
  expect(requests).not.toHaveBeenCalled();
  expect(rates).not.toHaveBeenCalled();
 });
 it("requires a shared rate slot and strictly projects licensed Work core fields",async()=>{
  const work="56950dba-94f8-46a9-aaaf-f2f59bbeed04";
  const permission={contractReference:"contract:mb-commercial-api-reviewed-v1",
   commercialApiAccessAllowed:true,coreDataOnly:true,
   privateResearchAllowed:true,externalModelProcessingAllowed:true,
   privateEvidenceRetentionAllowed:true,expiresAt:null,revokedAt:null};
  const spy=vi.fn(async(url:unknown,init?:RequestInit)=>{
   expect(String(url)).toBe("https://musicbrainz.org/ws/2/work/"+work+"?fmt=json");
   expect(init?.method).toBe("GET");
   expect(init?.redirect).toBe("error");
   expect((init?.headers as Record<string,string>)["User-Agent"]).toContain("WAKILISHA");
   return new Response(JSON.stringify({
    id:work,title:"Jerusalema",type:"Song",iswcs:["T-313.777.835-5"],
    annotation:"SUPPLEMENTARY_NON_CC0_CONTENT",tags:[{name:"private"}],
    ratings:{value:5},relations:[{url:"no_unverified_rights"}]
   }),{status:200,headers:{"Content-Type":"application/json"}});
  });
  const denied=createMusicBrainzWorkReaderV1({
   workId:work,authorizeCommercialAccess:async()=>permission,
   acquireSharedRateSlot:async()=>false,transport:spy as typeof fetch,now:()=>NOW
  });
  await expect(denied(identity,identity.openingQuestion,[]))
   .rejects.toThrow("MIZIZI_MUSICBRAINZ_SHARED_RATE_SLOT_REQUIRED");
  expect(spy).not.toHaveBeenCalled();
  const allowed=createMusicBrainzWorkReaderV1({
   workId:work,authorizeCommercialAccess:async()=>permission,
   acquireSharedRateSlot:async()=>true,transport:spy as typeof fetch,now:()=>NOW
  });
  const [result]=await allowed(identity,identity.openingQuestion,[]);
  expect(spy).toHaveBeenCalledTimes(1);
  const projection=JSON.parse(result.excerpt);
  expect(projection).toMatchObject({workId:work,title:"Jerusalema",type:"Song",
   iswcs:["T-313.777.835-5"],iswcsFieldPresent:true});
  expect(JSON.stringify(result)).not.toContain("SUPPLEMENTARY_NON_CC0_CONTENT");
  expect(JSON.stringify(result)).not.toContain("no_unverified_rights");
  expect(JSON.stringify(result)).not.toContain("private");
  expect(result.source).toMatchObject({
   caseId:CASE,workspaceId:WORKSPACE,
   lineageKey:"musicbrainz:community-core-work-data",
   useBasis:"documented_contract",
   authorityRef:"contract:mb-commercial-api-reviewed-v1"
  });
  expect(result.source.fingerprint).toMatch(/^[a-f0-9]{64}$/);
 });
 it("rejects spoofed Work identity and never treats the API response as rights verification",async()=>{
  const work="56950dba-94f8-46a9-aaaf-f2f59bbeed04";
  const permit={contractReference:"contract:mb-commercial-api-reviewed-v1",
   commercialApiAccessAllowed:true,coreDataOnly:true,
   privateResearchAllowed:true,externalModelProcessingAllowed:true,
   privateEvidenceRetentionAllowed:true,expiresAt:null,revokedAt:null};
  for(const payload of [{id:JOB,title:"Jerusalema",type:"Song"},
   {id:work,title:"Jerusalema",iswcs:["INVALID_ISWC"]},
   {id:work,title:"",iswcs:[]}]){
   const reader=createMusicBrainzWorkReaderV1({
    workId:work,authorizeCommercialAccess:async()=>permit,
    acquireSharedRateSlot:async()=>true,now:()=>NOW,
    transport:async()=>new Response(JSON.stringify(payload),{
     status:200,headers:{"Content-Type":"application/json"}})
   });
   await expect(reader(identity,identity.openingQuestion,[]))
    .rejects.toThrow("MIZIZI_MUSICBRAINZ_CORE_WORK_IDENTITY_UNVERIFIED");
  }
 });
 it("retains Work identifier properties in a newly versioned Wikidata evidence projection",async()=>{
  const query="Does the Q97652493 single include an explicit MusicBrainz Work ID or ISWC?";
  const observed:string[]=[];
  const source= createWikidataInvestigationReaderV1({
   authorizePublicQuery:async()=>true,now:()=>NOW,
   transport:async(url)=>{
    const parsed=new URL(String(url));
    expect(parsed.origin).toBe("https://www.wikidata.org");
    expect(parsed.pathname).toBe("/w/api.php");
    observed.push(parsed.searchParams.get("action")||"");
    expect(parsed.searchParams.get("ids")).toBe("Q97652493");
    return new Response(JSON.stringify({entities:{Q97652493:{
     id:"Q97652493",lastrevid:2438162423,
     labels:{en:{value:"Jerusalema"}},claims:{
      P31:[{mainsnak:{datatype:"wikibase-item",
       datavalue:{type:"wikibase-entityid",value:{id:"Q134556"}}}}],
      P435:[{mainsnak:{datatype:"external-id",datavalue:{
       type:"string",value:"56950dba-94f8-46a9-aaaf-f2f59bbeed04"}}}],
      P1827:[{mainsnak:{datatype:"external-id",datavalue:{
       type:"string",value:"T-313.777.835-5"}}}],
      P99999:[{mainsnak:{datatype:"string",datavalue:{value:"NOT_IN_PROJECTION"}}}]
     }
    }}}),{status:200,headers:{"Content-Type":"application/json"}});
   }
  });
  const results=await source(identity,query,[]);
  expect(observed).toEqual(["wbgetentities"]);
  expect(results).toHaveLength(1);
  const body=JSON.parse(results[0].excerpt);
  expect(body.projection).toBe("wikidata:structured:entity:v2");
  expect(body.inspectedProperties).toEqual(expect.arrayContaining(["P435","P1827"]));
  expect(body.claims.P435[0].datavalue.value).toBe(
   "56950dba-94f8-46a9-aaaf-f2f59bbeed04");
  expect(body.claims.P1827[0].datavalue.value).toBe("T-313.777.835-5");
  expect(body.absentProperties).not.toContain("P435");
  expect(body.absentProperties).not.toContain("P1827");
  expect(body.claims.P99999).toBeUndefined();
  expect(results[0].source.lineageKey).toBe("wikidata:community-structured-data");
  // Old production Preview passes are immutable and retain the v1 source ID.
  expect(results[0].source.sourceId).not.toBe("ef082219-f90b-519a-9d47-297d527c0608");
  expect(results[0].source.fingerprint).toMatch(/^[a-f0-9]{64}$/);
 });
 it("acquires revision-pinned CC0 structured evidence without external query leakage",async()=>{
  const calls:string[]=[];
  const transport:typeof fetch=async(url,init)=>{
   const parsed=new URL(String(url));calls.push(parsed.toString());
   expect(parsed.origin).toBe("https://www.wikidata.org");
   expect(parsed.pathname).toBe("/w/api.php");
   expect(init?.method).toBe("GET");
   expect((init?.headers as Record<string,string>)["User-Agent"])
    .toContain("WAKILISHA-MIZIZI");
   const data=parsed.searchParams.get("action")==="wbsearchentities"?
    {search:[{id:"Q1422"}]}:
    {entities:{Q1422:{id:"Q1422",lastrevid:812345,
     labels:{en:{value:"Test cultural source"}},
     descriptions:{en:{value:"Test recording identity"}},
     claims:{P175:[{id:"Q1422$1",rank:"normal",
      mainsnak:{datatype:"wikibase-item",
       datavalue:{type:"wikibase-entityid",value:{id:"Q99"}}},
      references:[{snaks:{}}]}]}}}};
   return new Response(JSON.stringify(data),{
    status:200,headers:{"Content-Type":"application/json"}});
  };
  let permission=false;
  const reader=createWikidataInvestigationReaderV1({
   authorizePublicQuery:async()=>permission,transport,now:()=>NOW
  });
  await expect(reader(identity,identity.openingQuestion,[]))
   .rejects.toThrow("PUBLIC_QUERY_NOT_AUTHORIZED");
  expect(calls).toHaveLength(0);
  permission=true;
  const out=await reader(identity,identity.openingQuestion,[]);
  expect(calls).toHaveLength(2);
  expect(out).toHaveLength(1);
  expect(out[0].source).toMatchObject({
   caseId:CASE,workspaceId:WORKSPACE,
   useBasis:"open_license",
   privateResearchAllowed:true,
   externalModelProcessingAllowed:true,
   privateEvidenceRetentionAllowed:true,
   lineageKey:"wikidata:community-structured-data",
   originKey:"wikidata:Q1422:revision:812345"
  });
  expect(out[0].citation).toBe("https://www.wikidata.org/wiki/Q1422?oldid=812345");
  expect(out[0].excerpt).toContain("Q99");
  expect(out[0].source.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  // Revisions are distinct immutable source observations, not overwritten
  // evidence. All Wikidata items share one lineage, never independent votes.
  const searchTerms:string[]=[];
  const nextReader=createWikidataInvestigationReaderV1({
   authorizePublicQuery:async()=>true,now:()=>NOW,
   transport:async(url,init)=>{
    const parsed=new URL(String(url));
    if(parsed.searchParams.get('action')==='wbsearchentities')
     searchTerms.push(parsed.searchParams.get('search')||'');
    const data=parsed.searchParams.get("action")==="wbsearchentities"?
     {search:[{id:"Q1422"},{id:"Q1422"}]}:
     {entities:{Q1422:{id:"Q1422",lastrevid:812346,
      labels:{en:{value:"Test cultural source"}},claims:{}}}};
    return new Response(JSON.stringify(data),{status:200,
     headers:{"Content-Type":"application/json"}});
   }
  });
  const revised=await nextReader(identity,identity.openingQuestion,[]);
  expect(revised).toHaveLength(1);
  expect(revised[0].source.sourceId).not.toBe(out[0].source.sourceId);
  expect(revised[0].source.lineageKey).toBe(out[0].source.lineageKey);
  const anchored=await nextReader(identity,
   "Which original songwriter credits establish the work identity?",
   [{question:'What is the original identity of "Jerusalema"?' } as InvestigationPassV1]);
  expect(anchored).toHaveLength(1);
  expect(searchTerms.at(-1)).toBe('Jerusalema');
 });
 it("follows an explicit Wikidata Work QID without title ambiguity and preserves it on later passes",async()=>{
  const actions:string[]=[];
  const read=createWikidataInvestigationReaderV1({
   authorizePublicQuery:async()=>true,now:()=>NOW,
   transport:async url=>{
    const query=new URL(String(url)).searchParams;
    actions.push(query.get("action")||"");
    expect(query.get("action")).toBe("wbgetentities");
    expect(query.get("ids")).toBe("Q97652493");
    return new Response(JSON.stringify({entities:{Q97652493:{
     id:"Q97652493",lastrevid:3123456789,
     labels:{en:{value:"Jerusalema"}},
     descriptions:{en:{value:"2019 single by Master KG"}},
     claims:{P31:[{id:"Q97652493$1",rank:"normal",
      mainsnak:{datatype:"wikibase-item",datavalue:{value:{id:"Q134556"}}}}]}
    }}}),{status:200,headers:{"Content-Type":"application/json"}});
   }
  });
  const root='Does Wikidata Q97652493 identify the musical work "Jerusalema"?';
  const first=await read(identity,root,[]);
  const second=await read(identity,
   "What competing creator and release identities remain unresolved?",
   [{question:root} as InvestigationPassV1]);
  expect(actions).toEqual(["wbgetentities","wbgetentities"]);
  expect(first[0].source.sourceId).toBe(second[0].source.sourceId);
  expect(first[0].source.lineageKey).toBe("wikidata:community-structured-data");
 });
 it("defers a MediaWiki maxlag response rather than mistaking it for cultural evidence",async()=>{
  let attempts=0;
  const read=createWikidataInvestigationReaderV1({
   authorizePublicQuery:async()=>true,
   transport:async()=>{
    attempts++;
    return new Response(JSON.stringify({error:{code:"maxlag",lag:21}}),{
     status:200,headers:{"Content-Type":"application/json","Retry-After":"21"}});
   }
  });
  await expect(read(identity,"What identifies Wikidata Q97652493 as a Work?",[]))
   .rejects.toThrow("MIZIZI_WIKIDATA_MAXLAG_DEFERRED");
  expect(attempts).toBe(1);
  const other=createWikidataInvestigationReaderV1({
   authorizePublicQuery:async()=>true,
   transport:async()=>new Response(JSON.stringify({error:{code:"badvalue"}}),{
    status:200,headers:{"Content-Type":"application/json"}})
  });
  await expect(other(identity,"What identifies Wikidata Q97652493 as a Work?",[]))
   .rejects.toThrow("MIZIZI_WIKIDATA_PROVIDER_ERROR_badvalue");
 });
 it("refuses sending private excerpts to the existing provider without explicit permission",async()=>{
  let sent=false;
  const analyze=createAnthropicInvestigationAnalystV1({
   apiKey:"test-anthropic-key-not-real",model:"claude-opus-4-8",
   transport:async()=>{sent=true;throw new Error("must not send");}
  });
  await expect(analyze(identity.openingQuestion,
   [{...source,source:{...authority,externalModelProcessingAllowed:false}}],[]))
   .rejects.toThrow("EXTERNAL_SOURCE_PROCESSING_DENIED");
  expect(sent).toBe(false);
 });
 it("reuses Institute's existing environment/setting names without creating another credential path",async()=>{
  const forbiddenSetting=vi.fn(async()=>{throw new Error("must prefer existing environment");});
  const env=await resolveInstituteAnthropicConfigurationV1({
   readEnvironment:name=>name==="ANTHROPIC_API_KEY"?"test-existing-provider-key":
    name==="INSTITUTE_ASSISTANT_MODEL"?"claude-opus-4-8":null,
   readAdminSetting:forbiddenSetting
  });
  expect(env.model).toBe("claude-opus-4-8");
  expect(env.apiKey).toBe("test-existing-provider-key");
  expect(forbiddenSetting).not.toHaveBeenCalled();
  const fallback=await resolveInstituteAnthropicConfigurationV1({
   readEnvironment:()=>null,
   readAdminSetting:async key=>key==="anthropic_api_key"?
    "test-database-provider-key":key==="institute_assistant_model"?
    "claude-opus-4-8":null
  });
  expect(fallback.apiKey).toBe("test-database-provider-key");
  await expect(resolveInstituteAnthropicConfigurationV1({
   readEnvironment:()=>null,readAdminSetting:async()=>null
  })).rejects.toThrow("EXISTING_PROVIDER_NOT_READY");
 });

 it("selects the most recent compatible Opus when the configured 4.8 is missing",async()=>{
  const models=[
   {id:"claude-opus-older",line:"opus",created_at:"2026-01-01",
    lifecycle:"active",capabilities:{structured_outputs:{supported:true},
     thinking:{types:{adaptive:{supported:true}}}}},
   {id:"claude-opus-newer",line:"opus",created_at:"2026-09-01",
    lifecycle:"active",capabilities:{structured_outputs:{supported:true},
     thinking:{types:{adaptive:{supported:true}}}}},
   {id:"claude-opus-incompatible",line:"opus",created_at:"2026-10-01",
    lifecycle:"active",capabilities:{structured_outputs:{supported:false},
     thinking:{types:{adaptive:{supported:true}}}}}
  ];
  const transport:typeof fetch=async()=>new Response(JSON.stringify({
   data:models,has_more:false}),{status:200});
  const config=await resolveInstituteAnthropicConfigurationV1({
   readEnvironment:name=>name==="ANTHROPIC_API_KEY"?"test-provider-key":null,
   readAdminSetting:async()=>null
  });
  expect(config.model).toBe("");
  expect(await discoverAnthropicResearchModelV1(config,transport)).toMatchObject({
   ok:true,model:"claude-opus-newer",preferenceMatched:false
  });
  expect(await discoverAnthropicResearchModelV1({...config,
   model:"claude-opus-older"},transport)).toMatchObject({
   ok:true,model:"claude-opus-older",preferenceMatched:true
  });
 });
 it("reports missing workspace authority instead of guessing models",async()=>{
  const workspace="wrkspc_0123456789ABCDEFGHIJKLMNOP";
  let calls=0;
  const config={apiKey:"test-provider-key",model:"claude-opus-4-8",
   workspaceId:workspace};
  const failed=await discoverAnthropicResearchModelV1(config,async(_url,init)=>{
   calls++;
   expect((init?.headers as Record<string,string>)["anthropic-workspace-id"]).toBe(workspace);
   return new Response(JSON.stringify({error:{
    message:"Workspace ID header required for this API key"
   }}),{status:400});
  });
  expect(failed).toEqual({ok:false,providerHttpStatus:400,
   reason:"workspace_header_required"});
  expect(calls).toBe(1);
  expect(await discoverAnthropicResearchModelV1({...config,
   workspaceId:undefined},async()=>new Response("",{status:401})))
    .toMatchObject({ok:false,reason:"credential_rejected"});
 });
 it("uses Institute's Anthropic Messages contract but never confuses model output with verification",async()=>{
  const key="test-anthropic-key-not-real";
  const calls:{url:string;request:Record<string,unknown>;headers:Record<string,string>}[]=[];
  const analyse=createAnthropicInvestigationAnalystV1({
   apiKey:key,model:"claude-opus-4-8",
   transport:async(url,init)=>{
    const request=JSON.parse(String(init?.body)) as Record<string,unknown>;
    const headers=init?.headers as Record<string,string>;
    calls.push({url:String(url),request,headers});
    return new Response(JSON.stringify({
     stop_reason:"end_turn",
     content:[{type:"text",text:JSON.stringify({
      ...answer([lead("Which independent source names the original performers?")],"continue"),
      hypotheses:[hypothesis]
     })}]
    }),{status:200,headers:{"Content-Type":"application/json"}});
   }
  });
  const actual=await analyse(identity.openingQuestion,[source],[]);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages");
  expect(calls[0].headers["x-api-key"]).toBe(key);
  expect(calls[0].headers["anthropic-version"]).toBe("2023-06-01");
  expect(calls[0].request).toMatchObject({
   model:"claude-opus-4-8",max_tokens:2500,
   thinking:{type:"adaptive"},
   output_config:{format:{type:"json_schema"}},
  });
  expect(JSON.stringify(calls[0].request)).not.toContain(key);
  expect(actual).toMatchObject({
   modelVersion:"claude-opus-4-8",
   requestedDisposition:"continue",
   hypotheses:[{interpretation:"hypothesis",sourceIds:[EVENT]}]
  });
  expect(actual.promptFingerprint).toMatch(/^[a-f0-9]{64}$/);
 });
 it("rejects incomplete Anthropic provider output, not converting it into a cultural conclusion",async()=>{
  const analyse=createAnthropicInvestigationAnalystV1({
   apiKey:"test-anthropic-key-not-real",model:"claude-opus-4-8",
   transport:async()=>new Response(JSON.stringify({
    stop_reason:"max_tokens",
    content:[{type:"text",text:JSON.stringify(answer([],"conclude"))}]
   }),{status:200,headers:{"Content-Type":"application/json"}})
  });
  await expect(analyse(identity.openingQuestion,[source],[]))
   .rejects.toThrow("INCOMPLETE_OR_REFUSED");
 });
});
