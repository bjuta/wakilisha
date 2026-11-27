/** Server-only composition of existing chart admission, exact job gateway
 * and operational desk worker. No credential acquisition, grant issuance,
 * canonical write or alternate provider transport. Callers must supply real
 * independently authorized sessions and reviewed runtime configuration.
 */
import {randomUUID} from "node:crypto";
import {
 bindRecordingInvestigationGroups,
 type ChartInvestigationInput,
 type ChartInvestigationObservation,
} from "../../../../../src/services/chartsPrivate/recordingReviewSuggestions.ts";
import {admitExactCaseResearchJobV1,type ExactResearchQueryV1} from "./run-exact-case-research-job.ts";
import {runOperationalDeskResearchWorkerCycleV1} from "./adaptive-research-worker-handler-v1.ts";
import {createChartOriginalStorageReaderV1,type WorkerRpc,type ChartResearchScopeV1} from "./research-worker-cycle-v1.ts";
import type {TrustedResearchJobReceiptV1} from "./shared-job-adapter.ts";

const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const SHA=/^[a-f0-9]{64}$/;
const DEPTHS:Readonly<Record<string,number>>=Object.freeze({
 apple_ke:100,audiomack_ke:100,mdundo_ke:100,shazam_ke:200,youtube_ke:100,
});
const REASON="Investigate receipt-bound chart recording identity.";
const ACK="I authorize read-only investigation of this chart recording hypothesis.";
function fail(code:string):never{throw Error("MIZIZI_CHART_CALIBRATION_"+code);}
function object(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=="object"||Array.isArray(value))fail("RECEIPT_SHAPE");
 return value as Record<string,unknown>;
}
function integer(value:unknown,min=0,max=600):number{
 if(typeof value!=="number"||!Number.isSafeInteger(value)||value<min||value>max)fail("RECEIPT_COUNT");
 return value;
}
async function call(rpc:WorkerRpc,fn:string,args:Record<string,unknown>){
 const r=await rpc(fn,args);
 if(!r||r.error||r.data===null||r.data===undefined)fail("RPC_UNCONFIRMED");
 return r.data;
}
type Coordinate=Readonly<{source_key:string;receipt_id:string;original_sha256:string;rank:number}>;
type Group=Readonly<{disposition:"research"|"blocked";positions:readonly Coordinate[]}>;
type Target=Readonly<{title:string;artist:string|null}>;
export type ChartCalibrationPlanV1=Readonly<{
 inputSha256:string;groups:readonly Group[];selectedGroupIndices:readonly number[];
}>;
type AdmittedCase=Readonly<{caseId:string;revision:number;state:string;stage:string;
 membershipSha256:string;disposition:"research"|"blocked"}>;
export type ChartCalibrationAdmissionV1=Readonly<{
 inputSha256:string;positionCount:number;created:number;replayed:number;cases:readonly AdmittedCase[];
}>;

/** Read authoritative frozen receipt coordinates. No model, external search or
 * state change. Existing grouping is advisory, not identity resolution. */
export async function prepareChartCalibrationV1(input:Readonly<{
 serviceRpc:WorkerRpc;expectedInputSha256:string;targets:readonly Target[];
}>):Promise<ChartCalibrationPlanV1>{
 if(!SHA.test(input.expectedInputSha256)||!Array.isArray(input.targets)||
  input.targets.length<1||input.targets.length>20)fail("PLAN_SCOPE");
 const raw=object(await call(input.serviceRpc,"mizizi_charts_candidate_input_v1",{}));
 if(raw.contract!=="charts2-private-freeze-preflight/v1"||
  raw.input_sha256!==input.expectedInputSha256||raw.can_publish!==false||
  !Array.isArray(raw.source_receipts)||!Array.isArray(raw.investigation_positions))fail("SNAPSHOT");
 const unresolved=integer(raw.unresolved_count),conflicts=integer(raw.conflict_count);
 const positions=raw.investigation_positions as ChartInvestigationObservation[];
 if(positions.length!==unresolved+conflicts||positions.length>600)fail("SNAPSHOT_COUNT");
 const sources=raw.source_receipts.map(value=>{
  const r=object(value),source_key=String(r.source_key);
  if(!Object.hasOwn(DEPTHS,source_key)||!UUID.test(String(r.receipt_id))||!SHA.test(String(r.original_sha256)))fail("SOURCE");
  return {source_key,receipt_id:String(r.receipt_id),original_sha256:String(r.original_sha256),observed_depth:DEPTHS[source_key]};
 });
 const material:ChartInvestigationInput={
  contract:"charts2-investigation-input/v1",sources,total_positions:600,resolved_positions:600-positions.length,
  unresolved:positions.filter(x=>x.disposition==="research"),
  conflicts:positions.filter(x=>x.disposition==="blocked"),
 };
 if(material.unresolved.length!==unresolved||material.conflicts.length!==conflicts)fail("SNAPSHOT_COUNT");
 const bound=bindRecordingInvestigationGroups(material);
 const selected=input.targets.map(t=>{
  if(!t||typeof t.title!=="string"||!t.title.trim()||(t.artist!==null&&typeof t.artist!=="string"))fail("TARGET");
  const matches=bound.flatMap((g,i)=>g.disposition==="research"&&g.observations.some(o=>o.title===t.title&&o.artist===t.artist)?[i]:[]);
  if(matches.length!==1)fail("TARGET_AMBIGUOUS");
  return matches[0];
 });
 if(new Set(selected).size!==selected.length)fail("TARGET_OVERLAP");
 const groups=bound.map(g=>Object.freeze({disposition:g.disposition,positions:Object.freeze(g.observations.map(o=>Object.freeze({
  source_key:o.source_key,receipt_id:o.receipt_id,original_sha256:o.original_sha256,rank:o.rank,
 })))}));
 return Object.freeze({inputSha256:input.expectedInputSha256,groups:Object.freeze(groups),selectedGroupIndices:Object.freeze(selected)});
}

/** Submit only the complete partition through an actual steward session.
 * The SQL gateway is authoritative and independently rechecks every coordinate.
 * Returned cases are in the submitted group order by SQL contract. */
export async function admitChartCalibrationV1(operatorRpc:WorkerRpc,plan:ChartCalibrationPlanV1):Promise<ChartCalibrationAdmissionV1>{
 const raw=object(await call(operatorRpc,"admin_mizizi_admit_chart_candidates_v1",{
  p_expected_input_sha256:plan.inputSha256,p_groups:plan.groups,
 }));
 const positionCount=plan.groups.reduce((n,g)=>n+g.positions.length,0);
 if(raw.contract!=="mizizi-charts-candidate-admission/v1"||raw.input_sha256!==plan.inputSha256||
  raw.position_count!==positionCount||raw.jobs_dispatched!==0||raw.can_publish!==false||
  !Array.isArray(raw.cases)||raw.cases.length!==plan.groups.length)fail("ADMISSION_RECEIPT");
 const created=integer(raw.created),replayed=integer(raw.replayed);
 if(created+replayed!==plan.groups.length)fail("ADMISSION_COUNT");
 const cases=raw.cases.map((value,i)=>{
  const r=object(value),g=plan.groups[i];
  if(!UUID.test(String(r.case_id))||!SHA.test(String(r.membership_sha256))||
   r.disposition!==g.disposition||!["created","replayed"].includes(String(r.status))||
   typeof r.state!=="string"||typeof r.stage!=="string"||
   (r.status==="created"&&(r.revision!==1||r.stage!=="triage"||r.state!==(g.disposition==="research"?"open":"held"))))
   fail("ADMISSION_CASE");
  return Object.freeze({caseId:String(r.case_id),revision:integer(r.revision,1,2147483647),state:r.state,
   stage:r.stage,membershipSha256:String(r.membership_sha256),disposition:g.disposition});
 });
 if(new Set(cases.map(c=>c.caseId)).size!==cases.length||
  new Set(cases.map(c=>c.membershipSha256)).size!==cases.length||
  raw.cases.filter(r=>object(r).status==="created").length!==created)fail("ADMISSION_DUPLICATE");
 return Object.freeze({inputSha256:plan.inputSha256,positionCount,created,replayed,cases:Object.freeze(cases)});
}

/** Explicit operator decision, never implicit in planning or worker execution.
 * A replayed case already in research must resume from a verified transition
 * receipt; this function never fabricates or repeats that decision. */
export async function beginChartCalibrationCaseV1(input:Readonly<{
 operatorRpc:WorkerRpc;admission:ChartCalibrationAdmissionV1;caseId:string;
 workspaceId:string;acknowledgement:string;
}>){
 const c=input.admission.cases.find(c=>c.caseId===input.caseId);
 if(!c||c.disposition!=="research"||c.stage!=="triage"||c.state!=="open"||
  !UUID.test(input.workspaceId)||input.acknowledgement!==ACK)fail("TRANSITION_SCOPE");
 const r=object(await call(input.operatorRpc,"admin_mizizi_begin_chart_case_research_v1",{
  p_case_id:c.caseId,p_expected_revision:c.revision,p_expected_input_sha256:input.admission.inputSha256,
  p_acknowledgement:input.acknowledgement,
 }));
 if(r.caseId!==c.caseId||r.workspaceId!==input.workspaceId||r.revision!==c.revision+1||
  r.state!=="in_progress"||r.stage!=="research"||r.researchReason!==REASON||
  r.jobsDispatched!==0||r.canPublish!==false)fail("TRANSITION_RECEIPT");
 return Object.freeze({caseId:c.caseId,workspaceId:input.workspaceId,expectedRevision:c.revision+1,reason:REASON});
}

/** Existing JIT executor must already be independently authorized. No login
 * creation, role switching, management token or secret retrieval here. */
export async function dispatchChartCalibrationCaseV1(query:ExactResearchQueryV1,
 transition:Awaited<ReturnType<typeof beginChartCalibrationCaseV1>>){
 if(transition.reason!==REASON)fail("DISPATCH_SCOPE");
 return admitExactCaseResearchJobV1(query,transition);
}

type WorkerOptions=Parameters<typeof runOperationalDeskResearchWorkerCycleV1>[0];
type Storage=Parameters<typeof createChartOriginalStorageReaderV1>[0];
/** Actual operational worker entrypoint from an exact shared job receipt.
 * No test transport or custom finance/source receipt callbacks. The real
 * worker rechecks live standing policies and original bytes before research.
 * The preflight is independently supplied by the runtime authority. */
export async function runChartCalibrationJobV1(input:Readonly<{
 receipt:TrustedResearchJobReceiptV1;serviceRpc:WorkerRpc;storage:Storage;
 registryClient:ChartResearchScopeV1["registryClient"];
 preflight:(receipt:TrustedResearchJobReceiptV1)=>Promise<boolean>;
 runtime:Pick<WorkerOptions,"credentials"|"readModelInventory"|"assessRequirement"|"localBrowser"|
  "openingQuestion"|"verifyFinding"|"maxTotalPasses"|"costBudgetUnits"|"leaseSeconds">;
}>){
 const r=input.receipt;
 if(!r||r.caseId!==r.resourceId||![r.caseId,r.workspaceId,r.jobId,r.commandReceiptId].every(x=>UUID.test(x))||
  !Number.isSafeInteger(r.caseRevision)||r.caseRevision<2||
  !["queued","retry_wait"].includes(r.jobStatus)||typeof input.preflight!=="function")fail("WORKER_SCOPE");
 const runtime=input.runtime;
 // Never pass an open-ended object spread to the worker. Only explicit
 // production composition fields are forwarded.
 return runOperationalDeskResearchWorkerCycleV1({
  rpc:input.serviceRpc,workerId:"mizizi-chart:"+randomUUID(),
  chartScope:{jobId:r.jobId,caseId:r.caseId,workspaceId:r.workspaceId,expectedRevision:r.caseRevision,
   preflight:()=>input.preflight(r),readOriginal:createChartOriginalStorageReaderV1(input.storage),
   registryClient:input.registryClient},
  credentials:runtime.credentials,readModelInventory:runtime.readModelInventory,
  assessRequirement:runtime.assessRequirement,localBrowser:runtime.localBrowser,
  openingQuestion:runtime.openingQuestion,verifyFinding:runtime.verifyFinding,
  maxTotalPasses:runtime.maxTotalPasses,costBudgetUnits:runtime.costBudgetUnits,leaseSeconds:runtime.leaseSeconds,
 });
}

/** Drive only confirmed productive yields of the same existing job. A failed,
 * zero-claim or ambiguous cycle is a stop, not retry authority. Every cycle
 * receives a durable checkpoint before another lease can be claimed. The
 * worker independently revalidates the case, originals, policy and finance.
 */
export async function driveProductiveChartResearchV1(input:Readonly<{
 receipt:TrustedResearchJobReceiptV1;maxLeases:number;
 cycle:(receipt:TrustedResearchJobReceiptV1)=>Promise<Awaited<ReturnType<typeof runChartCalibrationJobV1>>>;
 checkpoint:(ordinal:number,result:Awaited<ReturnType<typeof runChartCalibrationJobV1>>)=>Promise<void>;
}>){
 const {receipt,maxLeases,cycle,checkpoint}=input;
 if(!receipt||receipt.caseId!==receipt.resourceId||![receipt.caseId,receipt.workspaceId,receipt.jobId,receipt.commandReceiptId].every(x=>UUID.test(x))||
  !["queued","retry_wait"].includes(receipt.jobStatus)||!Number.isSafeInteger(maxLeases)||maxLeases<1||maxLeases>20||
  typeof cycle!=="function"||typeof checkpoint!=="function")fail("DRIVE_SCOPE");
 const results:Awaited<ReturnType<typeof runChartCalibrationJobV1>>[]=[];
 let next=receipt;
 for(let ordinal=1;ordinal<=maxLeases;ordinal++){
  const result=await cycle(next);
  const continued=result?.continued??0;
  if(!result||result.contract!=="mizizi.research_worker_cycle.v1"||
   ![result.claimed,result.succeeded,result.failed,continued].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1)||
   result.claimed!==result.succeeded+result.failed+continued)fail("DRIVE_RECEIPT");
  await checkpoint(ordinal,result);
  results.push(result);
  if(continued!==1)break;
  next=Object.freeze({...receipt,jobStatus:"retry_wait" as const});
 }
 const last=results.at(-1)!;
 return Object.freeze({cycles:Object.freeze(results),disposition:last.continued===1?"lease_limit":
  last.failed===1?"failed":last.succeeded===1?"completed":"not_claimed"});
}

/** One exact selected case, from fresh or replayed admission to the existing
 * leased worker. Each authoritative receipt is handed to the caller's durable
 * control-plane checkpoint before the next mutation. A thrown RPC/checkpoint
 * is an ambiguous stop, not permission to replay a human decision.
 *
 * The reviewed admission plan and operator acknowledgement are explicit.
 * The host must independently verify the proposed case policy and runtime
 * before transition/dispatch; no self-issued entitlement is accepted here.
 * To resume after a transition or dispatch, use the corresponding receipt
 * with dispatchChartCalibrationCaseV1 or runChartCalibrationJobV1 respectively.
 * Productive continuation remains the existing durable job's retry_wait state.
 */
export async function runChartCalibrationFlowV1(input:Readonly<{
 plan:ChartCalibrationPlanV1;selectedGroupIndex:number;workspaceId:string;
 acknowledgement:string;operatorRpc:WorkerRpc;executorQuery:ExactResearchQueryV1;
 worker:Omit<Parameters<typeof runChartCalibrationJobV1>[0],"receipt">;
 preflightCase:(candidate:Readonly<{caseId:string;workspaceId:string;
  expectedRevision:number;membershipSha256:string;inputSha256:string}>)=>Promise<boolean>;
 checkpoint:(event:
  |Readonly<{stage:"admitted";receipt:ChartCalibrationAdmissionV1}>
  |Readonly<{stage:"transitioned";receipt:Awaited<ReturnType<typeof beginChartCalibrationCaseV1>>}>
  |Readonly<{stage:"dispatched";receipt:TrustedResearchJobReceiptV1}>
  |Readonly<{stage:"worker_returned";receipt:Awaited<ReturnType<typeof runChartCalibrationJobV1>>}>
 )=>Promise<void>;
}>){
 if(input.acknowledgement!==ACK||!UUID.test(input.workspaceId)||
  !input.plan.selectedGroupIndices.includes(input.selectedGroupIndex)||
  input.plan.groups[input.selectedGroupIndex]?.disposition!=="research"||
  typeof input.preflightCase!=="function"||typeof input.checkpoint!=="function")fail("FLOW_SCOPE");
 const admission=await admitChartCalibrationV1(input.operatorRpc,input.plan);
 await input.checkpoint({stage:"admitted",receipt:admission});
 const candidate=admission.cases[input.selectedGroupIndex];
 if(!candidate||candidate.stage!=="triage"||candidate.state!=="open")fail("FLOW_RESUME_REQUIRED");
 if(await input.preflightCase({caseId:candidate.caseId,workspaceId:input.workspaceId,
  expectedRevision:candidate.revision+1,membershipSha256:candidate.membershipSha256,
  inputSha256:admission.inputSha256})!==true)fail("FLOW_POLICY_DENIED");
 const transition=await beginChartCalibrationCaseV1({
  operatorRpc:input.operatorRpc,admission,caseId:candidate.caseId,
  workspaceId:input.workspaceId,acknowledgement:input.acknowledgement});
 await input.checkpoint({stage:"transitioned",receipt:transition});
 const job=await dispatchChartCalibrationCaseV1(input.executorQuery,transition);
 await input.checkpoint({stage:"dispatched",receipt:job});
 if(job.jobStatus==="running"||job.jobStatus==="succeeded")
  return Object.freeze({admission,transition,job,worker:null});
 const result=await runChartCalibrationJobV1({...input.worker,receipt:job});
 await input.checkpoint({stage:"worker_returned",receipt:result});
 return Object.freeze({admission,transition,job,worker:result});
}
