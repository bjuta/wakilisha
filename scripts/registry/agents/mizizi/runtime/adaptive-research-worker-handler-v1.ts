/** Connect adaptive research to the existing typed shared worker job.
 * A successful worker receipt means a bounded pass finished, NOT that the
 * investigation or cultural question is definitively resolved.
 */
import {runAdaptiveInvestigationV1, type InvestigationIdentityV1,
 type InvestigationStoreV1,type InvestigationReaderV1,
 type InvestigationAnalystV1,type IndependentFindingVerifierV1}
 from "./adaptive-investigation-v1";
import type {ResearchJobHandlerV1,ResearchJobV1}
 from "./research-worker-cycle-v1";
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
