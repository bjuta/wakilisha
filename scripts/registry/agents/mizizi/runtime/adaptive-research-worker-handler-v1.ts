/** Connect adaptive research to the existing typed shared worker job.
 * A successful worker receipt means a bounded pass finished, NOT that the
 * investigation or cultural question is definitively resolved.
 */
import {createHash} from "node:crypto";
import {createCharts2RegistryCatalogueCohortV1} from "../../../../../supabase/functions/_shared/charts2-private-native-review-v1.mjs";
import type {DeskSearchScopeV1} from "./desk-research-gateway-v1.ts";
import {runAdaptiveInvestigationV1, type InvestigationIdentityV1,
 type InvestigationStoreV1,type InvestigationReaderV1,
 type InvestigationAnalystV1,type IndependentFindingVerifierV1,type DeskPassResearcherV1}
 from "./adaptive-investigation-v1.ts";
import type {ResearchJobHandlerV1,ResearchJobV1}
 from "./research-worker-cycle-v1.ts";
import {runResearchWorkerCycleV1, type WorkerRpc, type ResearchSourceVerifierV1, type ChartResearchScopeV1} from "./research-worker-cycle-v1.ts";
import {createLeasedResearchPassStoreV1,guardDeskResearchPassStoreV1} from "./leased-research-pass-store-v1.ts";
import {createAnthropicInvestigationAnalystV1, type AnthropicInvestigationOptionsV1}
 from "./anthropic-investigation-analyst-v1.ts";
import {createCostRoutedDeskAnthropicPassV1,createDurableDeskModelAuthorityV1} from "./desk-anthropic-tool-loop-v1.ts";
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


export type DurableDeskConfigurationV1=Readonly<
 Pick<Parameters<typeof createDeskResearchDispatcherV1>[0],
 "braveApiKey"|"discovery"|"nativeAccountFingerprint"|"authorizeAcquisition"|"authorizeExamination"|"browser">&
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
 /** Operational mode requires the current owner-issued standing policy. */
 operationalNativeOnly?:boolean;
 maxNewPasses:number;maxTotalPasses:number;costBudgetUnits:number;
 leaseSeconds?:number;now?:()=>number;
}>){
 if(!input?.chartScope||typeof input.rpc!=="function"||
  typeof input.configurationForJob!=="function"||typeof input.verifyFinding!=="function"||
  typeof input.openingQuestion!=="function")
   throw Error("MIZIZI_DURABLE_DESK_TRUSTED_CONFIGURATION_REQUIRED");
 // One bounded pass per lease gives the database an exact, complete
 // dependency set. A later adaptive pass needs a new authorized lease.
 if(input.maxNewPasses!==1)throw Error("MIZIZI_DURABLE_DESK_SINGLE_PASS_LEASE_REQUIRED");
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
   const operational=input.operationalNativeOnly?await readOperationalNativeDeskPolicyV1(input.rpc,scope,input.now??Date.now):null;
   if(input.operationalNativeOnly&&!operational)throw Error("MIZIZI_DESK_OPERATIONAL_POLICY_DENIED");
   if(operational&&config.browser)throw Error("MIZIZI_DESK_OPERATIONAL_BROWSER_UNQUALIFIED");
   const dispatcher=createDeskResearchDispatcherV1({
    rpc:input.rpc,scope,braveApiKey:config.braveApiKey,discovery:config.discovery,
    nativeAccountFingerprint:config.nativeAccountFingerprint,
    authorizeAcquisition:config.authorizeAcquisition,authorizeExamination:config.authorizeExamination,
    browser:config.browser,now:input.now});
   const anthropic={apiKey:config.anthropic.apiKey,workspaceId:config.anthropic.workspaceId};
   const finance=createDeskResourceBudgetV1({rpc:input.rpc,now:input.now}).modelFinance(anthropic);
   const modelAuthority=createDurableDeskModelAuthorityV1({rpc:input.rpc,scope,
    authorizeEnvelope:config.authorizeEnvelope,authorizeTool:config.authorizeTool,now:input.now});
   const deskPass=createCostRoutedDeskAnthropicPassV1({
    scope,anthropic,enabledTools:operational?dispatcher.enabledTools.filter(t=>operational.toolNames.includes(t)):dispatcher.enabledTools,
    readModelInventory:async()=>{
     const models=await config.readModelInventory();
     return operational?models.filter(m=>operational.modelIds.includes(m.model)):models;
    },
    assessRequirement:config.assessRequirement,...modelAuthority,...finance,executeTool:dispatcher.executeTool,
    verifyToolReceipt:dispatcher.verifyToolReceipt,authorizeSource:dispatcher.authorizeSource,now:input.now});
   const prepareDeskPass:DeskPassResearcherV1=async(id,question,history)=>{
    for(const pass of history)if(await dispatcher.verifyJournalPass(pass)!==true)
     throw Error("MIZIZI_DESK_HISTORY_CUSTODY_DENIED");
    return deskPass(id,question,history);
   };
   active={job,dispatcher};
   return createAdaptiveResearchWorkerHandlerV1({
    store:guardDeskResearchPassStoreV1(createLeasedResearchPassStoreV1(input.rpc,job,input.workerId),dispatcher.verifyJournalPass),
    openingQuestion:input.openingQuestion,readSources:async()=>{throw Error("MIZIZI_DESK_LEGACY_READER_DENIED");},
    analyze:async()=>{throw Error("MIZIZI_DESK_LEGACY_ANALYST_DENIED");},prepareDeskPass,
    verifyFinding:input.verifyFinding,authorizeModelProcessing:dispatcher.authorizeModelProcessing,
    maxNewPasses:input.maxNewPasses,maxTotalPasses:input.maxTotalPasses,costBudgetUnits:input.costBudgetUnits})(job);
  }
 });
}

/** Server-only native operational entrypoint. Reuses the existing exact job
 * worker. No second queue, transport override, owner credential, or default
 * live entitlement. Its chartScope preflight must independently prove the
 * deployed environment, provider account and constrained runtime.
 */
type OperationalNativeDeskPolicyV1=Readonly<{
 revision:number;scope:DeskSearchScopeV1;credentialSha256:string;modelIds:readonly string[];
 questionSha256s:readonly string[];toolNames:readonly string[];maxRounds:number;maxRequestBytes:number;
 accessRules:readonly Readonly<{host:string;pathPrefix:string;custodyRevision:number;operations:readonly string[]}>[];
 validUntil:string;
}>;
const operationalHash=(value:string)=>createHash("sha256").update(value).digest("hex");
async function readOperationalNativeDeskPolicyV1(rpc:WorkerRpc,scope:DeskSearchScopeV1,now:()=>number):Promise<OperationalNativeDeskPolicyV1|null>{
 const reply=await rpc("mizizi_read_desk_operational_policy_v1",{p_scope:scope});
 if(!reply||reply.error||!reply.data)return null;
 const p=reply.data as OperationalNativeDeskPolicyV1;
 const sha=/^[0-9a-f]{64}$/;
 if(!p.scope||Object.keys(scope).some(k=>p.scope[k as keyof DeskSearchScopeV1]!==scope[k as keyof DeskSearchScopeV1])||
  !Number.isSafeInteger(p.revision)||p.revision<1||!sha.test(p.credentialSha256)||
  !Array.isArray(p.modelIds)||p.modelIds.length<1||p.modelIds.length>5||p.modelIds.some(m=>! /^[A-Za-z0-9._:-]{3,100}$/.test(m))||
  !Array.isArray(p.questionSha256s)||p.questionSha256s.length<1||p.questionSha256s.length>8||p.questionSha256s.some(q=>!sha.test(q))||
  !Array.isArray(p.toolNames)||p.toolNames.length<1||p.toolNames.some(t=>!["search_web","search_news","read_page","read_document"].includes(t))||
  !Number.isSafeInteger(p.maxRounds)||p.maxRounds<1||p.maxRounds>5||
  !Number.isSafeInteger(p.maxRequestBytes)||p.maxRequestBytes<1||p.maxRequestBytes>3200000||
  !Array.isArray(p.accessRules)||p.accessRules.length>20||p.accessRules.some(x=>!x||typeof x.host!=="string"||
   typeof x.pathPrefix!=="string"||!/^\/[A-Za-z0-9_./~-]+\/$/.test(x.pathPrefix)||
   !Number.isSafeInteger(x.custodyRevision)||x.custodyRevision<1||!Array.isArray(x.operations)||
   x.operations.some(op=>!["native_acquire","native_text"].includes(op)))||
  !Number.isFinite(Date.parse(p.validUntil))||Date.parse(p.validUntil)<=now()||
  Date.parse(p.validUntil)>Date.parse(scope.leaseExpiresAt))return null;
 return p;
}
export function runOperationalNativeDeskResearchWorkerCycleV1(input:Readonly<
 Omit<Parameters<typeof runDurableDeskResearchWorkerCycleV1>[0],"configurationForJob"|"operationalNativeOnly"|"maxNewPasses">&{
  credentials:Pick<DurableDeskConfigurationV1,"anthropic"|"braveApiKey"|"discovery"|"nativeAccountFingerprint">;
  readModelInventory:DurableDeskConfigurationV1["readModelInventory"];
  assessRequirement:DurableDeskConfigurationV1["assessRequirement"];
 }
>){
 const {credentials,readModelInventory,assessRequirement,...worker}=input;
 const now=input.now??Date.now;
 // The owner policy and existing monetary/entitlement ledgers remain
 // independent of the worker. Do not accept self-issued grants or browser
 // fallback in this native qualification path.
 return runDurableDeskResearchWorkerCycleV1({...worker,operationalNativeOnly:true,maxNewPasses:1,
  configurationForJob:async job=>{
   const scope={jobId:job.jobId,caseId:job.caseId,workspaceId:job.workspaceId,expectedRevision:job.expectedRevision,
    workerId:input.workerId,leaseExpiresAt:job.leaseExpiresAt};
   const initial=await readOperationalNativeDeskPolicyV1(input.rpc,scope,now);
   const credentialSha256=operationalHash(JSON.stringify(["mizizi:anthropic:credential:v1",
    credentials.anthropic.workspaceId??null,credentials.anthropic.apiKey]));
   if(!initial||initial.credentialSha256!==credentialSha256||!job.chartContext)
    throw Error("MIZIZI_DESK_OPERATIONAL_CONFIGURATION_DENIED");
   const fresh=async(candidate:DeskSearchScopeV1)=>{
    if(Object.keys(scope).some(k=>candidate[k as keyof DeskSearchScopeV1]!==scope[k as keyof DeskSearchScopeV1]))return null;
    const p=await readOperationalNativeDeskPolicyV1(input.rpc,scope,now);
    return p&&p.revision===initial.revision&&p.credentialSha256===credentialSha256?p:null;
   };
   const allowedUrl=(p:OperationalNativeDeskPolicyV1,url:string,operation:string)=>{
    try{
     const u=new URL(url);
     return u.href===url&&u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&
      /^\/[A-Za-z0-9_./~-]+$/.test(u.pathname)&&!u.pathname.split("/").some(x=>x==="."||x==="..")&&
      p.accessRules.some(x=>x.host===u.hostname&&u.pathname.startsWith(x.pathPrefix)&&x.operations.includes(operation));
    }catch{return false;}
   };
   const publicQueries=new Set(job.chartContext.positions.flatMap(x=>[x.title,...(x.artist?[x.title+" "+x.artist]:[])]));
   return {...credentials,readModelInventory,assessRequirement,
    authorizeAcquisition:async(candidate,url)=>{
     const p=await fresh(candidate);
     return p&&allowedUrl(p,url,"native_acquire")?{policyRef:"desk-operational:"+p.revision,
      validUntil:p.validUntil,acquisitionAllowed:true as const,zeroIncrementalSpendAllowed:true as const}:null;
    },
    authorizeExamination:async(candidate,binding)=>{
     const p=await fresh(candidate);
     return !!p&&binding.representation==="native_response_bytes"&&typeof binding.finalUrl==="string"&&
      typeof binding.sha256==="string"&&/^[0-9a-f]{64}$/.test(binding.sha256)&&
      allowedUrl(p,binding.finalUrl,"native_text");
    },
    authorizeEnvelope:async(binding,body)=>{
     const p=await fresh(binding.scope);
     return p&&binding.credentialSha256===credentialSha256&&p.modelIds.includes(binding.model)&&
      p.questionSha256s.includes(operationalHash(binding.question))&&binding.round<=p.maxRounds&&
      binding.requestBytes<=p.maxRequestBytes&&Buffer.byteLength(body,"utf8")===binding.requestBytes&&
      operationalHash(body)===binding.bodySha256?
      {requestSha256:binding.requestSha256,policyRef:"desk-operational:"+p.revision,
       validUntil:p.validUntil,modelDisclosureAllowed:true as const}:null;
    },
    authorizeTool:async(candidate,call,callSha256)=>{
     const p=await fresh(candidate);
     return !!p&&p.toolNames.includes(call.name)&&operationalHash(JSON.stringify({scope:candidate,call}))===callSha256&&
      (!["search_web","search_news"].includes(call.name)||typeof call.input.query==="string"&&publicQueries.has(call.input.query));
    }
   };
  }
 });
}

/** Bounded cohort invocation of the existing durable worker. The caller
 * supplies already authorized exact job scopes; this does not admit jobs,
 * combine recording identities, reuse cross-case evidence, or create a queue.
 * Sequential execution preserves existing per-case lease and finance checks.
 * The only shared state is the active Registry title discovery index.
 */
export async function runDurableDeskResearchWorkerCohortV1(input:Readonly<
 Omit<Parameters<typeof runDurableDeskResearchWorkerCycleV1>[0],"chartScope">&{
  chartScopes:readonly ChartResearchScopeV1[];
 }
>){
 const {chartScopes,...worker}=input;
 if(!Array.isArray(chartScopes)||chartScopes.length<1||chartScopes.length>1000||
  chartScopes.some(s=>!s||s.registryCatalogueCohort!==undefined||
    s.workspaceId!==chartScopes[0].workspaceId||s.registryClient!==chartScopes[0].registryClient)||
  new Set(chartScopes.map(s=>s.jobId)).size!==chartScopes.length||
  new Set(chartScopes.map(s=>s.caseId)).size!==chartScopes.length)
   throw Error("MIZIZI_DESK_COHORT_SCOPE_DENIED");
 const catalogue=createCharts2RegistryCatalogueCohortV1(chartScopes[0].registryClient,{now:input.now??Date.now});
 const totals={recovered:0,claimed:0,succeeded:0,failed:0};
 for(const scope of chartScopes){
  const result=await runDurableDeskResearchWorkerCycleV1({...worker,
    chartScope:{...scope,registryCatalogueCohort:catalogue}});
  totals.recovered+=result.recovered;totals.claimed+=result.claimed;
  totals.succeeded+=result.succeeded;totals.failed+=result.failed;
 }
 return Object.freeze({contract:"mizizi.durable_desk_cohort.v1" as const,
  requested:chartScopes.length,...totals});
}
