/** Connect adaptive research to the existing typed shared worker job.
 * A successful worker receipt means a bounded pass finished, NOT that the
 * investigation or cultural question is definitively resolved.
 */
import {runAdaptiveInvestigationV1, type InvestigationIdentityV1,
 type InvestigationStoreV1,type InvestigationReaderV1,
 type InvestigationAnalystV1,type IndependentFindingVerifierV1}
 from "./adaptive-investigation-v1.ts";
import type {ResearchJobHandlerV1,ResearchJobV1}
 from "./research-worker-cycle-v1.ts";
import {runResearchWorkerCycleV1, type WorkerRpc, type ResearchSourceVerifierV1} from "./research-worker-cycle-v1.ts";
import {createLeasedResearchPassStoreV1} from "./leased-research-pass-store-v1.ts";
import {createAnthropicInvestigationAnalystV1, type AnthropicInvestigationOptionsV1}
 from "./anthropic-investigation-analyst-v1.ts";
export type AdaptiveWorkerDependenciesV1=Readonly<{
 store:InvestigationStoreV1;
 openingQuestion:(job:ResearchJobV1)=>Promise<string>;
 readSources:InvestigationReaderV1;
 analyze:InvestigationAnalystV1;
 verifyFinding:IndependentFindingVerifierV1;
 maxNewPasses:number;maxTotalPasses:number;costBudgetUnits:number;
 measureCostUnits?:()=>number;
}>;
export function createAdaptiveResearchWorkerHandlerV1(
 deps:AdaptiveWorkerDependenciesV1,
):ResearchJobHandlerV1{
 if(typeof deps?.openingQuestion!=="function")
  throw new TypeError("MIZIZI_WORKER_TRUSTED_CASE_QUESTION_REQUIRED");
 return async(job:ResearchJobV1)=>{
  const openingQuestion=await deps.openingQuestion(job);
  const identity:InvestigationIdentityV1={
   caseId:job.caseId,workspaceId:job.workspaceId,openingQuestion
  };
  await runAdaptiveInvestigationV1({
   identity,store:deps.store,readSources:deps.readSources,
   analyze:deps.analyze,verifyFinding:deps.verifyFinding,
   maxNewPasses:deps.maxNewPasses,maxTotalPasses:deps.maxTotalPasses,
   costBudgetUnits:deps.costBudgetUnits,measureCostUnits:deps.measureCostUnits
  });
  // Re-read durable case history: never trust an ephemeral in-memory claim
  // of success after the append transport potentially timed out.
  const passes=await deps.store.read(identity);
  const ids=[...new Set(passes.flatMap(p=>p.sourceReceipts.map(s=>s.sourceId)))];
  if(ids.length>20)throw new Error("MIZIZI_WORKER_EVIDENCE_REFERENCE_BUDGET");
  // Existing research-worker-cycle independently rechecks each of these
  // source IDs and their source-use permissions before job completion.
  return {contract:"mizizi.read_only_research_result.v1",caseId:job.caseId,
   status:ids.length?"evidence_recorded":"insufficient_evidence",
   sourceReferences:ids};
 };
}

/** The actual service-only composition: existing queue and lease -> immutable
 * case-scoped pass store -> adaptive analyst -> independent source verifier ->
 * existing completion receipt. No second scheduler or Queue authority.
 */
export async function runAdaptiveResearchWorkerCycleV1(input:Readonly<{
 rpc:WorkerRpc;workerId:string;verifySources:ResearchSourceVerifierV1;
 openingQuestion:AdaptiveWorkerDependenciesV1["openingQuestion"];
 readSources:InvestigationReaderV1;analyze:InvestigationAnalystV1;
 verifyFinding:IndependentFindingVerifierV1;
 maxNewPasses:number;maxTotalPasses:number;costBudgetUnits:number;
 measureCostUnits?:()=>number;leaseSeconds?:number;limit?:number;now?:()=>number;
}>){
 if(!input||typeof input.verifySources!=="function")
  throw new TypeError("MIZIZI_ADAPTIVE_WORKER_SOURCE_VERIFIER_REQUIRED");
 return runResearchWorkerCycleV1({
  rpc:input.rpc,workerId:input.workerId,verifySources:input.verifySources,
  leaseSeconds:input.leaseSeconds,limit:input.limit,now:input.now,
  research:async(job)=>{
   const store=createLeasedResearchPassStoreV1(input.rpc,job,input.workerId);
   const handler=createAdaptiveResearchWorkerHandlerV1({store,
    openingQuestion:input.openingQuestion,readSources:input.readSources,
    analyze:input.analyze,verifyFinding:input.verifyFinding,
    maxNewPasses:input.maxNewPasses,maxTotalPasses:input.maxTotalPasses,
    costBudgetUnits:input.costBudgetUnits,measureCostUnits:input.measureCostUnits});
   return handler(job);
  }
 });
}

/** Reuse the Production Institute assistant's Anthropic Messages provider
 * contract from an authorized server runtime. A model key remains in server
 * configuration and is never sent in the shared worker job or SQL receipts.
 * The actual source reader and independent verifier must be provided by
 * independently trusted components, not the model.
 */
export function runAnthropicAdaptiveResearchWorkerCycleV1(input:Readonly<
 Omit<Parameters<typeof runAdaptiveResearchWorkerCycleV1>[0],"analyze"|"measureCostUnits">&{
  anthropic:AnthropicInvestigationOptionsV1
 }
>){
 const {anthropic,...worker}=input;
 let unconsumedTokenUnits=0;
 const analyze=createAnthropicInvestigationAnalystV1({
  ...anthropic,onUsage:(units)=>{
   unconsumedTokenUnits+=units;
   anthropic.onUsage?.(units);
  }
 });
 return runAdaptiveResearchWorkerCycleV1({
  ...worker,analyze,
  // Consume only the preceding completed provider response. The generic
  // investigation engine's costBudgetUnits are 1,000-token units here,
  // NOT dollars and not complete billing for failed/retried requests.
  measureCostUnits:()=>{
   const used=unconsumedTokenUnits;
   unconsumedTokenUnits=0;
   if(!Number.isSafeInteger(used)||used<1)
    throw new Error("MIZIZI_ANALYST_UNMETERED_PASS_DENIED");
   return used;
  }
 });
}
