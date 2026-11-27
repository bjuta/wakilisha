import {describe,it,expect,vi} from "vitest";
import {
 prepareChartCalibrationV1,admitChartCalibrationV1,beginChartCalibrationCaseV1,
 dispatchChartCalibrationCaseV1,runChartCalibrationFlowV1,runChartCalibrationJobV1,driveProductiveChartResearchV1,
} from "../../scripts/registry/agents/mizizi/runtime/chart-calibration-flow-v1";
import type {WorkerRpc} from "../../scripts/registry/agents/mizizi/runtime/research-worker-cycle-v1";
import type {ExactResearchQueryV1} from "../../scripts/registry/agents/mizizi/runtime/run-exact-case-research-job";

const uuid=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const HASH="a".repeat(64),WS=uuid(80),CASE=uuid(81),JOB=uuid(82),COMMAND=uuid(83);
const ACK="I authorize read-only investigation of this chart recording hypothesis.";
const REASON="Investigate receipt-bound chart recording identity.";
const sources=["apple_ke","audiomack_ke","mdundo_ke","shazam_ke","youtube_ke"].map((source_key,i)=>({
 source_key,receipt_id:uuid(i+1),original_sha256:"b".repeat(64),
}));
const position=(index:number,title:string,artist:string,disposition:"research"|"blocked")=>({
 ...sources[index],rank:1,title,artist,provider_track_id:null,disposition,reason:"Unresolved receipt-bound observation",
});
const snapshot={contract:"charts2-private-freeze-preflight/v1",input_sha256:HASH,can_publish:false,
 source_receipts:sources,unresolved_count:2,conflict_count:1,investigation_positions:[
  position(0,"Unresolved song","Artist A","research"),
  position(1,"Unresolved song","Artist A","research"),
  position(2,"Other recording","Artist B","blocked"),
 ]};
const receipt={caseId:CASE,workspaceId:WS,resourceId:CASE,caseRevision:2,
 commandReceiptId:COMMAND,jobId:JOB,jobStatus:"queued" as const,outcome:"created" as const};
function harness(){
 const order:string[]=[];
 const serviceRpc:WorkerRpc=vi.fn(async(fn,args)=>{
  order.push(fn);
  if(fn==="mizizi_charts_candidate_input_v1")return {data:snapshot,error:null};
  if(fn==="mizizi_recover_expired_chart_research_job_v1")return {data:0,error:null};
  if(fn==="mizizi_claim_exact_chart_research_job_v1"){
   expect(args).toMatchObject({p_job_id:JOB,p_case_id:CASE,p_workspace_id:WS,p_expected_revision:2});
   expect(args.p_worker_id).toMatch(/^mizizi-chart:/);
   return {data:[],error:null}; // no available lease; never simulate paid research
  }
  throw Error("UNEXPECTED_SERVICE_RPC");
 });
 const operatorRpc:WorkerRpc=vi.fn(async(fn,args)=>{
  order.push(fn);
  if(fn==="admin_mizizi_admit_chart_candidates_v1"){
   const groups=args.p_groups as Array<{disposition:string;positions:unknown[]}>;
   expect(args.p_expected_input_sha256).toBe(HASH);
   expect(groups.flatMap(g=>g.positions)).toHaveLength(3);
   expect(groups.every(g=>g.positions.every(p=>Object.keys(p as object).sort().join(",")==="original_sha256,rank,receipt_id,source_key"))).toBe(true);
   const cases=groups.map((g,i)=>({case_id:g.disposition==="research"?CASE:uuid(90+i),
    revision:1,state:g.disposition==="research"?"open":"held",stage:"triage",
    membership_sha256:String(i+1).repeat(64),disposition:g.disposition,status:"created"}));
   return {data:{contract:"mizizi-charts-candidate-admission/v1",input_sha256:HASH,position_count:3,
    created:groups.length,replayed:0,cases,jobs_dispatched:0,can_publish:false},error:null};
  }
  if(fn==="admin_mizizi_begin_chart_case_research_v1"){
   expect(args).toEqual({p_case_id:CASE,p_expected_revision:1,p_expected_input_sha256:HASH,p_acknowledgement:ACK});
   return {data:{caseId:CASE,workspaceId:WS,revision:2,state:"in_progress",stage:"research",
    researchReason:REASON,jobsDispatched:0,canPublish:false},error:null};
  }
  throw Error("UNEXPECTED_OPERATOR_RPC");
 });
 const executorQuery:ExactResearchQueryV1=vi.fn(async(sql,values)=>{
  if(sql.includes("session_user")){
   order.push("jit_identity");return {rows:[{login_role:"mizizi_executor"}],rowCount:1};
  }
  expect(sql).toContain("mizizi_private.admit_case_research_job_v1");
  expect(values.slice(0,4)).toEqual([CASE,WS,2,"system:mizizi"]);
  expect(values[6]).toBe(REASON);
  order.push("jit_dispatch");
  return {rows:[{case_id:CASE,workspace_id:WS,resource_id:CASE,case_revision:2,
   command_receipt_id:COMMAND,job_id:JOB,job_status:"queued",outcome:"created"}],rowCount:1};
 });
 const worker={
  serviceRpc,storage:{from:vi.fn(()=>({download:async()=>{throw Error("NO_STORAGE_WITHOUT_LEASE");}}))},
  registryClient:{from:vi.fn(()=>{throw Error("NO_REGISTRY_WITHOUT_LEASE");})},
  preflight:vi.fn(async()=>{order.push("worker_preflight");return true;}),
  runtime:{credentials:{anthropic:{apiKey:"synthetic-fixture-only"},nativeAccountFingerprint:HASH},
   readModelInventory:async()=>{throw Error("NO_MODEL_WITHOUT_LEASE");},
   assessRequirement:async()=>{throw Error("NO_MODEL_WITHOUT_LEASE");},
   openingQuestion:async()=>{throw Error("NO_QUESTION_WITHOUT_LEASE");},
   verifyFinding:async()=>({verified:false,verificationRef:null}),maxTotalPasses:3,costBudgetUnits:500000},
 };
 const prepare=()=>prepareChartCalibrationV1({serviceRpc,expectedInputSha256:HASH,
  targets:[{title:"Unresolved song",artist:"Artist A"}]});
 return {serviceRpc,operatorRpc,executorQuery,worker,prepare,order};
}
describe("MIZIZI receipt-bound calibration composition",()=>{
 it("connects the existing admission, exact operator transition, JIT job and real scoped worker with ordered checkpoints",async()=>{
  const h=harness(),plan=await h.prepare();
  expect(plan.groups).toHaveLength(2);
  const result=await runChartCalibrationFlowV1({plan,selectedGroupIndex:plan.selectedGroupIndices[0],
   workspaceId:WS,acknowledgement:ACK,operatorRpc:h.operatorRpc,executorQuery:h.executorQuery,
   worker:h.worker,preflightCase:async c=>{expect(c).toMatchObject({caseId:CASE,expectedRevision:2,inputSha256:HASH});
    h.order.push("case_policy");return true;},
   checkpoint:async e=>{h.order.push(e.stage);}
  });
  expect(result.job).toEqual(receipt);
  expect(result.worker).toMatchObject({claimed:0,succeeded:0,failed:0});
  expect(h.order).toEqual(["mizizi_charts_candidate_input_v1","admin_mizizi_admit_chart_candidates_v1",
   "admitted","case_policy","admin_mizizi_begin_chart_case_research_v1","transitioned",
   "jit_identity","jit_dispatch","dispatched","worker_preflight",
   "mizizi_recover_expired_chart_research_job_v1","mizizi_claim_exact_chart_research_job_v1","worker_returned"]);
  expect(h.worker.storage.from).not.toHaveBeenCalled();
  expect(h.worker.registryClient.from).not.toHaveBeenCalled();
 });
 it("rejects stale snapshot, unknown and overlapping selection before mutation",async()=>{
  const h=harness();
  for(const targets of [[{title:"Other recording",artist:"Artist B"}],
    [{title:"Unresolved song",artist:"Artist A"},{title:"Unresolved song",artist:"Artist A"}]]){
   await expect(prepareChartCalibrationV1({serviceRpc:h.serviceRpc,expectedInputSha256:HASH,targets})).rejects.toThrow(/TARGET/);
  }
  await expect(prepareChartCalibrationV1({serviceRpc:h.serviceRpc,expectedInputSha256:"c".repeat(64),
   targets:[{title:"Unresolved song",artist:"Artist A"}]})).rejects.toThrow("SNAPSHOT");
  expect(h.operatorRpc).not.toHaveBeenCalled();
 });
 it("stops after admission if independent case policy is denied or its checkpoint fails",async()=>{
  for(const checkpointFailure of [false,true]){
   const h=harness(),plan=await h.prepare();
   await expect(runChartCalibrationFlowV1({plan,selectedGroupIndex:plan.selectedGroupIndices[0],
    workspaceId:WS,acknowledgement:ACK,operatorRpc:h.operatorRpc,executorQuery:h.executorQuery,
    worker:h.worker,preflightCase:async()=>false,checkpoint:async()=>{if(checkpointFailure)throw Error("CHECKPOINT_FAILED");}
   })).rejects.toThrow(checkpointFailure?"CHECKPOINT_FAILED":"FLOW_POLICY_DENIED");
   expect(h.operatorRpc).toHaveBeenCalledTimes(1);
   expect(h.executorQuery).not.toHaveBeenCalled();
   expect(h.worker.preflight).not.toHaveBeenCalled();
  }
 });
 it("does not transition held cases or substitute missing explicit acknowledgement",async()=>{
  const h=harness(),plan=await h.prepare(),admission=await admitChartCalibrationV1(h.operatorRpc,plan);
  for(const [caseId,acknowledgement] of [[CASE,""],[admission.cases.find(c=>c.disposition==="blocked")!.caseId,ACK]]){
   await expect(beginChartCalibrationCaseV1({operatorRpc:h.operatorRpc,admission,caseId,workspaceId:WS,acknowledgement})).rejects.toThrow("TRANSITION_SCOPE");
  }
  expect(h.operatorRpc).toHaveBeenCalledTimes(1);
 });
 it("requires genuine executor identity and fails closed before claiming when worker preflight denies",async()=>{
  const h=harness(),plan=await h.prepare(),admission=await admitChartCalibrationV1(h.operatorRpc,plan);
  const transition=await beginChartCalibrationCaseV1({operatorRpc:h.operatorRpc,admission,caseId:CASE,workspaceId:WS,acknowledgement:ACK});
  const wrong=vi.fn(async()=>({rows:[{login_role:"postgres"}],rowCount:1}));
  await expect(dispatchChartCalibrationCaseV1(wrong,transition)).rejects.toThrow("REAL_JIT_LOGIN_REQUIRED");
  expect(wrong).toHaveBeenCalledTimes(1);
  const before=h.order.length;
  await expect(runChartCalibrationJobV1({...h.worker,receipt,preflight:async()=>false})).rejects.toThrow("PREFLIGHT_DENIED");
  expect(h.order.length).toBe(before);
 });
});

describe("MIZIZI productive investigation driver",()=>{
 const cycleResult=(continued:number,succeeded=0,failed=0)=>({contract:"mizizi.research_worker_cycle.v1" as const,
  recovered:0,claimed:continued+succeeded+failed,succeeded,failed,continued});
 it("continues the exact job only after durable checkpoint and stops on completion",async()=>{
  const events:string[]=[];
  const cycle=vi.fn(async r=>{events.push(r.jobStatus);expect(r.jobId).toBe(receipt.jobId);
   expect(r.commandReceiptId).toBe(receipt.commandReceiptId);return cycleResult(events.length===1?1:0,events.length===1?0:1);});
  const result=await driveProductiveChartResearchV1({receipt,maxLeases:3,cycle,
   checkpoint:async n=>{events.push("checkpoint:"+n);}});
  expect(events).toEqual(["queued","checkpoint:1","retry_wait","checkpoint:2"]);
  expect(result).toMatchObject({disposition:"completed"});
 });
 it("never retries a failure, zero claim, or unconfirmed checkpoint and respects the lease bound",async()=>{
  for(const outcome of [cycleResult(0,0,1),cycleResult(0)]){
   const cycle=vi.fn(async()=>outcome);
   await driveProductiveChartResearchV1({receipt,maxLeases:3,cycle,checkpoint:async()=>{}});
   expect(cycle).toHaveBeenCalledTimes(1);
  }
  const cycle=vi.fn(async()=>cycleResult(1));
  await expect(driveProductiveChartResearchV1({receipt,maxLeases:3,cycle,checkpoint:async()=>{throw Error("CHECKPOINT");}})).rejects.toThrow("CHECKPOINT");
  expect(cycle).toHaveBeenCalledTimes(1);cycle.mockClear();
  expect(await driveProductiveChartResearchV1({receipt,maxLeases:2,cycle,checkpoint:async()=>{}})).toMatchObject({disposition:"lease_limit"});
  expect(cycle).toHaveBeenCalledTimes(2);
 });
});

describe("MIZIZI Preview executable runtime scope",()=>{
 it("accepts only the reviewed Preview session pooler JIT login and exact option",async()=>{
  const {validatePreviewCalibrationJitUrlV1}=await import(
   "../../scripts/registry/agents/mizizi/runtime/run-preview-chart-calibration-v1");
  const host="fixture-region.pooler.supabase.com";
  const u=new URL("postgresql://mizizi_executor.ehkmjrjjhzyjkxdfsqdc:fixture-only@"+host+":5432/postgres");
  u.searchParams.set("options","-c jit=true");
  expect(()=>validatePreviewCalibrationJitUrlV1(u.toString(),host,5432)).not.toThrow();
  for(const change of [
   (x:URL)=>{x.username="mizizi_executor.pgzizndxdyhqmtyywjmt";},
   (x:URL)=>{x.username="postgres.ehkmjrjjhzyjkxdfsqdc";},
   (x:URL)=>{x.hostname="other-region.pooler.supabase.com";},
   (x:URL)=>{x.port="6543";},
   (x:URL)=>{x.searchParams.delete("options");},
   (x:URL)=>{x.searchParams.set("sslmode","disable");},
   (x:URL)=>{x.searchParams.append("options","-c jit=true");},
   (x:URL)=>{x.password="";},
  ]){
   const bad=new URL(u);change(bad);
   expect(()=>validatePreviewCalibrationJitUrlV1(bad.toString(),host,5432)).toThrow("JIT_ENDPOINT_SCOPE");
  }
 });

 it("requires independently digest-bound private configuration and rejects another project, expired authority and excess calibration allowance",async()=>{
  const {mkdtemp,writeFile,chmod,rm}=await import("node:fs/promises");
  const {tmpdir}=await import("node:os");
  const {join}=await import("node:path");
  const {createHash}=await import("node:crypto");
  const {readPreviewCalibrationManifestV1,runPreviewCalibrationCommandV1}=await import(
   "../../scripts/registry/agents/mizizi/runtime/run-preview-chart-calibration-v1");
  const dir=await mkdtemp(join(tmpdir(),"mizizi-runtime-review-"));
  try{
   const manifestPath=join(dir,"manifest.json"),out=join(dir,"checkpoint");
   const validUntil=new Date(Date.now()+120000).toISOString();
   const model={model:"fixture-haiku",family:"haiku",active:true,toolUse:true,structuredOutput:true,
    vision:true,ordinaryToolTranscript:true,qualityGateRef:"fixture:review",pricingRef:"fixture:price",
    maxInputTokens:1000000,maxOutputTokens:128000,worstCaseInputMicrousdPerMillion:500000,
    worstCaseOutputMicrousdPerMillion:2500000,batchEligible:false,validUntil};
   const m={contract:"mizizi-preview-calibration-runtime/v1",projectRef:"ehkmjrjjhzyjkxdfsqdc",
    inputSha256:HASH,operatorUserId:uuid(90),workspaceId:WS,validUntil,
    targets:[{title:"Unresolved song",artist:"Artist A"}],
    case:{caseId:CASE,membershipSha256:HASH,admissionSha256:HASH,question:"Investigate the recording identity.",
     policyReviewRef:"fixture:policy",sourceReviewRef:"fixture:source",financeReviewRef:"fixture:finance",
     runtimeReviewRef:"fixture:runtime",model,credentialSha256:HASH,nativeAccountFingerprint:HASH,
     maximumCostMicrousd:600000,costBudgetUnits:20,maxTotalPasses:3,
     executorHost:"fixture-region.pooler.supabase.com",executorPort:5432}};
   const put=async(value:unknown)=>{
    const b=JSON.stringify(value);await writeFile(manifestPath,b,{mode:0o600});await chmod(manifestPath,0o600);
    return createHash("sha256").update(b).digest("hex");};
   const digest=await put(m);
   await expect(readPreviewCalibrationManifestV1(manifestPath,digest,"execute")).resolves.toEqual(m);
   await expect(readPreviewCalibrationManifestV1(manifestPath,"f".repeat(64),"execute")).rejects.toThrow("REVIEW_DIGEST_MISMATCH");
   await chmod(manifestPath,0o644);
   await expect(readPreviewCalibrationManifestV1(manifestPath,digest,"execute")).rejects.toThrow("PRIVATE_FILE_REQUIRED");
   for(const [bad,code] of [
    [{...m,projectRef:"other-project"},"MANIFEST_SCOPE"],
    [{...m,validUntil:new Date(Date.now()-1).toISOString()},"MANIFEST_SCOPE"],
    [{...m,case:{...m.case,maximumCostMicrousd:600001}},"CASE_RUNTIME_SCOPE"],
    [{...m,case:{...m.case,executorHost:"db.other-project.supabase.co"}},"CASE_RUNTIME_SCOPE"],
    [{...m,case:{...m.case,model:{...model,batchEligible:true}}},"MODEL_REVIEW_REQUIRED"],
   ] as const){
    const d=await put(bad);
    await expect(readPreviewCalibrationManifestV1(manifestPath,d,"execute")).rejects.toThrow(code);
   }
   const d=await put(m);
   await writeFile(out+".admission.json","{}",{mode:0o600});
   await expect(runPreviewCalibrationCommandV1(["admit",manifestPath,d,out])).rejects.toThrow("CHECKPOINT_ALREADY_EXISTS");
  }finally{await rm(dir,{recursive:true,force:true});}
 });
});
