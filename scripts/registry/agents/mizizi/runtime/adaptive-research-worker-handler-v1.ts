/** Connect adaptive research to the existing typed shared worker job.
 * A successful worker receipt means a bounded pass finished, NOT that the
 * investigation or cultural question is definitively resolved.
 */
import {runAdaptiveInvestigationV1, type InvestigationIdentityV1,
 type InvestigationStoreV1,type InvestigationReaderV1,
 type InvestigationAnalystV1,type IndependentFindingVerifierV1,type DeskPassResearcherV1}
 from "./adaptive-investigation-v1.ts";
import type {ResearchJobHandlerV1,ResearchJobV1}
 from "./research-worker-cycle-v1.ts";
import {runResearchWorkerCycleV1, type WorkerRpc, type ResearchSourceVerifierV1, type ChartResearchScopeV1} from "./research-worker-cycle-v1.ts";
import {createLeasedResearchPassStoreV1} from "./leased-research-pass-store-v1.ts";
import {createAnthropicInvestigationAnalystV1, type AnthropicInvestigationOptionsV1}
 from "./anthropic-investigation-analyst-v1.ts";
import {createCostRoutedDeskAnthropicPassV1} from "./desk-anthropic-tool-loop-v1.ts";
import {createDeskResearchDispatcherV1} from "./desk-research-dispatcher-v1.ts";
import {createDeskResourceBudgetV1} from "./desk-resource-budget-v1.ts";
export type AdaptiveWorkerDependenciesV1=Readonly<{
 store:InvestigationStoreV1;
 openingQuestion:(job:ResearchJobV1)=>Promise<string>;
 readSources:InvestigationReaderV1;
 analyze:InvestigationAnalystV1;
 prepareDeskPass?:DeskPassResearcherV1;
 verifyFinding:IndependentFindingVerifierV1;
 maxNewPasses:number;maxTotalPasses:number;costBudgetUnits:number;
 measureCostUnits?:()=>number;
 /** Trusted case-scoped grant checker; never inferred from the source reader. */
 authorizeModelProcessing?:Parameters<typeof runAdaptiveInvestigationV1>[0]["authorizeModelProcessing"];
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
   analyze:deps.analyze,prepareDeskPass:deps.prepareDeskPass,verifyFinding:deps.verifyFinding,
   maxNewPasses:deps.maxNewPasses,maxTotalPasses:deps.maxTotalPasses,
   costBudgetUnits:deps.costBudgetUnits,measureCostUnits:deps.measureCostUnits,
   authorizeModelProcessing:deps.authorizeModelProcessing
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
 measureCostUnits?:()=>number;
 authorizeModelProcessing?:AdaptiveWorkerDependenciesV1["authorizeModelProcessing"];
 chartScope?:ChartResearchScopeV1;
 /** Separate desk composition factory, invoked only after exact lease and
  * original/Registry verification by the existing worker. */
 prepareDeskPassForJob?:(job:ResearchJobV1)=>DeskPassResearcherV1;
 leaseSeconds?:number;limit?:number;now?:()=>number;
}>){
 if(!input||typeof input.verifySources!=="function")
  throw new TypeError("MIZIZI_ADAPTIVE_WORKER_SOURCE_VERIFIER_REQUIRED");
 return runResearchWorkerCycleV1({
  rpc:input.rpc,workerId:input.workerId,verifySources:input.verifySources,
  leaseSeconds:input.leaseSeconds,limit:input.limit,now:input.now,chartScope:input.chartScope,
  research:async(job)=>{
   const store=createLeasedResearchPassStoreV1(input.rpc,job,input.workerId);
   const handler=createAdaptiveResearchWorkerHandlerV1({store,
    openingQuestion:input.openingQuestion,readSources:input.readSources,
    analyze:input.analyze,prepareDeskPass:input.prepareDeskPassForJob?.(job),verifyFinding:input.verifyFinding,
    maxNewPasses:input.maxNewPasses,maxTotalPasses:input.maxTotalPasses,
    costBudgetUnits:input.costBudgetUnits,measureCostUnits:input.measureCostUnits,
    authorizeModelProcessing:input.authorizeModelProcessing});
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
 Omit<Parameters<typeof runAdaptiveResearchWorkerCycleV1>[0],"analyze"|"measureCostUnits"|"prepareDeskPassForJob">&{
  anthropic:AnthropicInvestigationOptionsV1
 }
>){
 // The scoped chart context expressly denies external model processing.
 // An open-licence excerpt is not permission to disclose the private question.
 // The future separately authorized chart provider/model composition must
 // establish that authority; never use this generic external-model shortcut.
 if(input?.chartScope!==undefined)
  throw new Error("MIZIZI_CHART_EXTERNAL_MODEL_PERMISSION_REQUIRED");
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


/** Desk-specific service composition. Keep the previous generic chart-model
 * denial in force. Every job gets its own scope, cost router and independent
 * source/case/envelope authority; no global unscoped analyst or queue.
 * This remains disabled until all trusted callbacks have live, durable
 * implementations and independently proven provider entitlement.
 */
export function runCostRoutedDeskResearchWorkerCycleV1(input:Readonly<
 Omit<Parameters<typeof runAdaptiveResearchWorkerCycleV1>[0],
  "analyze"|"readSources"|"measureCostUnits"|"prepareDeskPassForJob">&{
  deskForJob:(job:ResearchJobV1)=>Omit<Parameters<typeof createCostRoutedDeskAnthropicPassV1>[0],"scope">;
 }
>){
 if(typeof input?.deskForJob!=="function"||typeof input.authorizeModelProcessing!=="function")
  throw new Error("MIZIZI_DESK_INDEPENDENT_MODEL_AUTHORITY_REQUIRED");
 const {deskForJob,...worker}=input;
 return runAdaptiveResearchWorkerCycleV1({...worker,
  readSources:async()=>{throw Error("MIZIZI_DESK_LEGACY_READER_DENIED");},
  analyze:async()=>{throw Error("MIZIZI_DESK_LEGACY_ANALYST_DENIED");},
  prepareDeskPassForJob:job=>createCostRoutedDeskAnthropicPassV1({...deskForJob(job),
   scope:{jobId:job.jobId,caseId:job.caseId,workspaceId:job.workspaceId,
    expectedRevision:job.expectedRevision,workerId:input.workerId,leaseExpiresAt:job.leaseExpiresAt}})
 });
}


type DurableDeskConfigurationV1=Readonly<
 Pick<Parameters<typeof createDeskResearchDispatcherV1>[0],
 "braveApiKey"|"nativeAccountFingerprint"|"authorizeAcquisition"|"authorizeExamination"|"browser">&
 Pick<Parameters<typeof createCostRoutedDeskAnthropicPassV1>[0],
 "anthropic"|"readModelInventory"|"assessRequirement"|"authorizeEnvelope"|"authorizeTool">
>;
/** Actual first durable desk path, restricted to exact chart job. All
 * external finance, custody and tool readback use the real service RPCs.
 * No caller-supplied alternate transport, result receipt, cost callback
 * or source verifier. Trusted host still must provide independent access,
 * envelope, model inventory/quality and tool policy authority; activation
 * additionally requires real account/egress/process acceptance.
 */
export function runDurableDeskResearchWorkerCycleV1(input:Readonly<{
 rpc:WorkerRpc;workerId:string;chartScope:ChartResearchScopeV1;
 openingQuestion:AdaptiveWorkerDependenciesV1["openingQuestion"];
 verifyFinding:IndependentFindingVerifierV1;
 configurationForJob:(job:ResearchJobV1)=>Promise<DurableDeskConfigurationV1>;
 maxNewPasses:number;maxTotalPasses:number;costBudgetUnits:number;
 leaseSeconds?:number;now?:()=>number;
}>){
 if(!input?.chartScope||typeof input.rpc!=="function"||
  typeof input.configurationForJob!=="function"||typeof input.verifyFinding!=="function"||
  typeof input.openingQuestion!=="function")
   throw Error("MIZIZI_DURABLE_DESK_TRUSTED_CONFIGURATION_REQUIRED");
 let active:{job:ResearchJobV1;dispatcher:ReturnType<typeof createDeskResearchDispatcherV1>}|null=null;
 return runResearchWorkerCycleV1({
  rpc:input.rpc,workerId:input.workerId,chartScope:input.chartScope,
  leaseSeconds:input.leaseSeconds,limit:1,now:input.now,
  verifySources:async(job,refs)=>{
   if(!active||active.job.jobId!==job.jobId||active.job.caseId!==job.caseId||
    active.job.workspaceId!==job.workspaceId||active.job.expectedRevision!==job.expectedRevision||
    active.job.leaseExpiresAt!==job.leaseExpiresAt)throw Error("MIZIZI_DURABLE_DESK_SOURCE_SCOPE_DENIED");
   return active.dispatcher.verifySources(job,refs);
  },
  research:async(job)=>{
   if(!job.chartContext||!job.chartRegistryDiscovery)
    throw Error("MIZIZI_DURABLE_DESK_CHART_PREFLIGHT_REQUIRED");
   // Existing worker has independently verified chart originals and Registry
   // discovery before this callback. Never allow caller transport overrides.
   const config=await input.configurationForJob(job);
   const scope={jobId:job.jobId,caseId:job.caseId,workspaceId:job.workspaceId,
    expectedRevision:job.expectedRevision,workerId:input.workerId,leaseExpiresAt:job.leaseExpiresAt};
   const dispatcher=createDeskResearchDispatcherV1({
    rpc:input.rpc,scope,braveApiKey:config.braveApiKey,
    nativeAccountFingerprint:config.nativeAccountFingerprint,
    authorizeAcquisition:config.authorizeAcquisition,authorizeExamination:config.authorizeExamination,
    browser:config.browser,now:input.now});
   const anthropic={apiKey:config.anthropic.apiKey,workspaceId:config.anthropic.workspaceId};
   const finance=createDeskResourceBudgetV1({rpc:input.rpc,now:input.now}).modelFinance(anthropic);
   const prepareDeskPass=createCostRoutedDeskAnthropicPassV1({
    scope,anthropic,enabledTools:dispatcher.enabledTools,readModelInventory:config.readModelInventory,
    assessRequirement:config.assessRequirement,authorizeEnvelope:config.authorizeEnvelope,
    authorizeTool:config.authorizeTool,...finance,executeTool:dispatcher.executeTool,
    verifyToolReceipt:dispatcher.verifyToolReceipt,authorizeSource:dispatcher.authorizeSource,now:input.now});
   active={job,dispatcher};
   return createAdaptiveResearchWorkerHandlerV1({
    store:createLeasedResearchPassStoreV1(input.rpc,job,input.workerId),
    openingQuestion:input.openingQuestion,readSources:async()=>{throw Error("MIZIZI_DESK_LEGACY_READER_DENIED");},
    analyze:async()=>{throw Error("MIZIZI_DESK_LEGACY_ANALYST_DENIED");},prepareDeskPass,
    verifyFinding:input.verifyFinding,authorizeModelProcessing:dispatcher.authorizeModelProcessing,
    maxNewPasses:input.maxNewPasses,maxTotalPasses:input.maxTotalPasses,costBudgetUnits:input.costBudgetUnits})(job);
  }
 });
}
