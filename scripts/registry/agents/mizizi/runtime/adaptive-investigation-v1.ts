/** MIZIZI Slice 2: evidence-grounded, resumable, adaptive research.
 * A pass is not an investigation; inconclusive is not terminal.
 * No canonical writes, grants, source licences or model trust are created here.
 */
import {createHash} from "node:crypto";
export const ADAPTIVE_INVESTIGATION_CONTRACT="mizizi.adaptive_investigation.v1" as const;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const USE=new Set(["first_party","documented_consent","documented_contract","open_license"]);
export type SourceAuthorityV1=Readonly<{
 sourceId:string;workspaceId:string;originKey:string;lineageKey:string;
 fingerprint:string;authorityRef:string;
 useBasis:"first_party"|"documented_consent"|"documented_contract"|"open_license";
 observedAt:string;expiresAt:string|null;revokedAt:string|null;privateResearchAllowed:boolean;
}>;
export type SourceExcerptV1=Readonly<{source:SourceAuthorityV1;excerpt:string;citation:string}>;
export type ResearchClaimV1=Readonly<{
 statement:string;sourceIds:readonly string[];
 interpretation:"hypothesis"|"supported"|"contradicted"|"unknown";
 uncertainty:number;reasoningSummary:string;
}>;
export type ResearchLeadV1=Readonly<{
 question:string;rationale:string;expectedInformationGain:number;
 importance:number;estimatedCostUnits:number;
}>;
export type ResearchAnalysisV1=Readonly<{
 hypotheses:readonly ResearchClaimV1[];leads:readonly ResearchLeadV1[];
 passFinding:string;requestedDisposition:"continue"|"pause"|"conclude";
 modelVersion:string;promptFingerprint:string;
}>;
export type VerifiedClaimV1=Readonly<ResearchClaimV1&{
 independentlyVerified:boolean;verificationRef:string|null;
}>;
export type PassDecisionV1=Readonly<{
 action:"continue"|"pause"|"conclude";nextQuestion:string|null;
 rationale:string;revisitTrigger:string|null;
}>;
export type InvestigationIdentityV1=Readonly<{
 caseId:string;workspaceId:string;openingQuestion:string;
}>;
export type InvestigationPassV1=Readonly<{
 contract:typeof ADAPTIVE_INVESTIGATION_CONTRACT;
 caseId:string;workspaceId:string;ordinal:number;question:string;
 predecessorFingerprint:string|null;fingerprint:string;
 sourceReceipts:readonly Readonly<{
  sourceId:string;originKey:string;lineageKey:string;payloadFingerprint:string;
  useBasis:string;authorityRef:string;observedAt:string;
 }>[];
 findings:readonly VerifiedClaimV1[];
 passFinding:string;proposedLeads:readonly ResearchLeadV1[];
 decision:PassDecisionV1;
 modelVersion:string;promptFingerprint:string;
 recordedAt:string;costUnits:number;
}>;
export type InvestigationStoreV1=Readonly<{
 read:(identity:InvestigationIdentityV1)=>Promise<readonly InvestigationPassV1[]>;
 /** Must be transactional, compare-and-swap on ordinal and predecessor hash. */
 append:(identity:InvestigationIdentityV1,expectedOrdinal:number,
         predecessorFingerprint:string|null,pass:InvestigationPassV1)=>Promise<void>;
}>;
export type InvestigationReaderV1=(
 identity:InvestigationIdentityV1,question:string,history:readonly InvestigationPassV1[],
)=>Promise<readonly SourceExcerptV1[]>;
export type InvestigationAnalystV1=(
 question:string,sources:readonly SourceExcerptV1[],history:readonly InvestigationPassV1[],
)=>Promise<ResearchAnalysisV1>;
export type IndependentFindingVerifierV1=(
 claim:ResearchClaimV1,sources:readonly SourceAuthorityV1[],
)=>Promise<{verified:boolean;verificationRef:string|null}>;
export type InvestigationResultV1=Readonly<{
 caseId:string;workspaceId:string;passesAdded:number;totalPasses:number;
 disposition:"continue"|"paused"|"concluded";
 nextQuestion:string|null;lastFingerprint:string|null;
}>;
function requireText(v:unknown,label:string,max=2000):string{
 if(typeof v!=="string"||v!==v.trim()||v.length<8||v.length>max||
    /[\u0000-\u001f]/.test(v))throw new TypeError("MIZIZI_RESEARCH_INVALID_"+label);
 return v;
}
function bounded(v:unknown,label:string,min:number,max:number):number{
 if(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max)
  throw new TypeError("MIZIZI_RESEARCH_INVALID_"+label);
 return v;
}
function digest(v:unknown):string{
 return createHash("sha256").update(JSON.stringify(v)).digest("hex");
}
function questionKey(s:string):string{return s.normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();}
function verifyHistory(id:InvestigationIdentityV1,history:readonly InvestigationPassV1[]){
 let prior:string|null=null;
 for(let i=0;i<history.length;i++){
  const pass=history[i];
  if(pass.contract!==ADAPTIVE_INVESTIGATION_CONTRACT||pass.caseId!==id.caseId||
     pass.workspaceId!==id.workspaceId||pass.ordinal!==i+1||
     pass.predecessorFingerprint!==prior||!SHA.test(pass.fingerprint)||
     digest({...pass,fingerprint:undefined})!==pass.fingerprint)
   throw new Error("MIZIZI_RESEARCH_HISTORY_CORRUPT_OR_CONFLICTED");
  prior=pass.fingerprint;
 }
}
function verifySource(source:SourceAuthorityV1,id:InvestigationIdentityV1,nowMs:number){
 if(!UUID.test(source.sourceId)||source.workspaceId.toLowerCase()!==id.workspaceId||
    !USE.has(source.useBasis)||source.privateResearchAllowed!==true||
    !SHA.test(source.fingerprint)||!requireText(source.originKey,"ORIGIN",500)||
    !requireText(source.lineageKey,"LINEAGE",500)||
    !requireText(source.authorityRef,"AUTHORITY",500)||
    !Number.isFinite(Date.parse(source.observedAt))||
    Date.parse(source.observedAt)>nowMs||
    (source.expiresAt!==null&&(!Number.isFinite(Date.parse(source.expiresAt))||
      Date.parse(source.expiresAt)<=nowMs))||source.revokedAt!==null)
  throw new TypeError("MIZIZI_RESEARCH_SOURCE_AUTHORITY_UNVERIFIED");
}
function selectLead(leads:readonly ResearchLeadV1[],history:readonly InvestigationPassV1[],
 currentQuestion:string,remainingCost:number):ResearchLeadV1|null{
 const visited=new Set([questionKey(currentQuestion),...history.map(p=>questionKey(p.question))]);
 const eligible=leads.filter(lead=>{
  requireText(lead.question,"LEAD_QUESTION",500);
  requireText(lead.rationale,"LEAD_RATIONALE",1000);
  bounded(lead.expectedInformationGain,"INFORMATION_GAIN",0,1);
  bounded(lead.importance,"IMPORTANCE",0,1);
  bounded(lead.estimatedCostUnits,"ESTIMATED_COST",0,100000);
  return !visited.has(questionKey(lead.question))&&lead.expectedInformationGain>=.15&&
    lead.estimatedCostUnits<=remainingCost;
 });
 return [...eligible].sort((a,b)=>
  b.expectedInformationGain*b.importance/(1+b.estimatedCostUnits)-
  a.expectedInformationGain*a.importance/(1+a.estimatedCostUnits)||
  a.question.localeCompare(b.question))[0]||null;
}
/** Each appended pass is permanent. A continuation is determined from evidence,
 * not from a preselected number of turns or a mandatory human decision.
 */
export async function runAdaptiveInvestigationV1(input:Readonly<{
 identity:InvestigationIdentityV1;store:InvestigationStoreV1;
 readSources:InvestigationReaderV1;analyze:InvestigationAnalystV1;
 verifyFinding:IndependentFindingVerifierV1;
 maxNewPasses:number;maxTotalPasses:number;costBudgetUnits:number;
 reopen?:Readonly<{sourceEventRef:string;question:string}>;
 verifyReopen?:(sourceEventRef:string,identity:InvestigationIdentityV1,
   previous:InvestigationPassV1)=>Promise<boolean>;
 /** Trusted runtime metering, never model-generated estimated usage. */
 measureCostUnits?:()=>number;now?:()=>number;
}>):Promise<InvestigationResultV1>{
 const {identity,store,readSources,analyze,verifyFinding}=input;
 if(!identity||!UUID.test(identity.caseId)||!UUID.test(identity.workspaceId)||
    typeof store?.read!=="function"||typeof store?.append!=="function"||
    typeof readSources!=="function"||typeof analyze!=="function"||
    typeof verifyFinding!=="function")
  throw new TypeError("MIZIZI_RESEARCH_INVALID_RUNTIME");
 requireText(identity.openingQuestion,"OPENING_QUESTION",1000);
 bounded(input.maxNewPasses,"MAX_NEW_PASSES",1,20);
 bounded(input.maxTotalPasses,"MAX_TOTAL_PASSES",1,10000);
 bounded(input.costBudgetUnits,"COST_BUDGET",0,1000000);
 if(!Number.isInteger(input.maxNewPasses)||!Number.isInteger(input.maxTotalPasses))
  throw new TypeError("MIZIZI_RESEARCH_INVALID_PASS_LIMIT");
 const now=input.now??Date.now;
 const history=[...await store.read(identity)];
 verifyHistory(identity,history);
 let latest=history.at(-1);
 if(latest?.decision.action==="conclude")return {
  caseId:identity.caseId,workspaceId:identity.workspaceId,passesAdded:0,
  totalPasses:history.length,disposition:"concluded",nextQuestion:null,
  lastFingerprint:latest.fingerprint};
 if(latest?.decision.action==="pause"){
  if(!input.reopen)return {
   caseId:identity.caseId,workspaceId:identity.workspaceId,passesAdded:0,
   totalPasses:history.length,disposition:"paused",nextQuestion:null,
   lastFingerprint:latest.fingerprint};
  requireText(input.reopen.sourceEventRef,"REOPEN_REF",500);
  requireText(input.reopen.question,"REOPEN_QUESTION",500);
  if(typeof input.verifyReopen!=="function"||
     await input.verifyReopen(input.reopen.sourceEventRef,identity,latest)!==true)
   throw new Error("MIZIZI_RESEARCH_REOPEN_AUTHORITY_UNVERIFIED");
 }
 let question=(latest?.decision.action==="pause"?input.reopen?.question:null)||
     latest?.decision.nextQuestion||identity.openingQuestion;
 let remainingCost=input.costBudgetUnits,added=0;
 let disposition:InvestigationResultV1["disposition"]="continue";
 while(added<input.maxNewPasses&&history.length<input.maxTotalPasses){
  const sources=[...await readSources(identity,question,Object.freeze([...history]))];
  if(sources.length>30)throw new Error("MIZIZI_RESEARCH_SOURCE_BUDGET_EXCEEDED");
  const known=new Set<string>();
  const authorities:SourceAuthorityV1[]=[];
  for(const entry of sources){
   verifySource(entry.source,identity,now());
   if(known.has(entry.source.sourceId.toLowerCase()))
    throw new Error("MIZIZI_RESEARCH_DUPLICATE_SOURCE");
   known.add(entry.source.sourceId.toLowerCase());
   requireText(entry.citation,"CITATION",1000);
   if(typeof entry.excerpt!=="string"||entry.excerpt.length>10000)
    throw new TypeError("MIZIZI_RESEARCH_EXCERPT_TOO_LARGE");
   authorities.push(entry.source);
  }
  const analysis=await analyze(question,Object.freeze(sources),Object.freeze([...history]));
  requireText(analysis.passFinding,"PASS_FINDING",3000);
  requireText(analysis.modelVersion,"MODEL_VERSION",150);
  if(!SHA.test(analysis.promptFingerprint)||analysis.hypotheses.length>20||
     analysis.leads.length>20||
     !["continue","pause","conclude"].includes(analysis.requestedDisposition))
   throw new TypeError("MIZIZI_RESEARCH_UNTRUSTED_ANALYSIS");
  const findings:VerifiedClaimV1[]=[];
  for(const claim of analysis.hypotheses){
   requireText(claim.statement,"CLAIM",1800);
   requireText(claim.reasoningSummary,"REASONING",2000);
   bounded(claim.uncertainty,"UNCERTAINTY",0,1);
   if(claim.sourceIds.length>20||
      claim.sourceIds.some(ref=>!known.has(ref.toLowerCase())))
    throw new TypeError("MIZIZI_RESEARCH_UNOBSERVED_EVIDENCE_CITATION");
   const refs=authorities.filter(a=>claim.sourceIds.some(id=>id.toLowerCase()===a.sourceId.toLowerCase()));
   const independent=await verifyFinding(claim,Object.freeze(refs));
   if(typeof independent?.verified!=="boolean"||
      (independent.verified&&!independent.verificationRef))
    throw new Error("MIZIZI_RESEARCH_INDEPENDENT_VERIFIER_INVALID");
   const verified=independent.verified&&refs.length>0;
   findings.push({...claim,sourceIds:[...claim.sourceIds],
    interpretation:claim.interpretation==="supported"&&!verified?"hypothesis":claim.interpretation,
    independentlyVerified:verified,
    verificationRef:verified?independent.verificationRef:null});
  }
  const supported=findings.some(f=>f.interpretation==="supported"&&
    f.independentlyVerified&&f.uncertainty<=.2);
  const next=selectLead(analysis.leads,history,question,remainingCost);
  let decision:PassDecisionV1;
  if(analysis.requestedDisposition==="conclude"&&supported){
   decision={action:"conclude",nextQuestion:null,
    rationale:"Independent claim verifier confirmed the bounded outcome.",
    revisitTrigger:null}; disposition="concluded";
  }else if(next){
   decision={action:"continue",nextQuestion:next.question,rationale:next.rationale,
    revisitTrigger:null};disposition="continue";
  }else{
   decision={action:"pause",nextQuestion:null,
    rationale:"No eligible new research lead within present source and cost constraints.",
    revisitTrigger:"Independent new source, permission, or contradictory evidence"};
   disposition="paused";
  }
  const costUnits=input.measureCostUnits?.()??0;
  bounded(costUnits,"MEASURED_COST",0,1000000);
  remainingCost=Math.max(0,remainingCost-costUnits);
  const previous=history.at(-1)?.fingerprint??null;
  const body={contract:ADAPTIVE_INVESTIGATION_CONTRACT,caseId:identity.caseId,
   workspaceId:identity.workspaceId,ordinal:history.length+1,question,
   predecessorFingerprint:previous,
   sourceReceipts:authorities.map(a=>({sourceId:a.sourceId,originKey:a.originKey,
    lineageKey:a.lineageKey,payloadFingerprint:a.fingerprint,useBasis:a.useBasis,
    authorityRef:a.authorityRef,observedAt:a.observedAt})),
   findings,passFinding:analysis.passFinding,proposedLeads:analysis.leads.map(l=>({...l})),
   decision,modelVersion:analysis.modelVersion,
   promptFingerprint:analysis.promptFingerprint,
   recordedAt:new Date(now()).toISOString(),costUnits};
  const pass:InvestigationPassV1=Object.freeze({...body,
   fingerprint:digest({...body,fingerprint:undefined})});
  await store.append(identity,pass.ordinal,previous,pass);
  history.push(pass);added++;
  if(decision.action!=="continue"||remainingCost<=0)break;
  question=decision.nextQuestion!;
 }
 latest=history.at(-1);
 return {caseId:identity.caseId,workspaceId:identity.workspaceId,
  passesAdded:added,totalPasses:history.length,disposition,
  nextQuestion:latest?.decision.nextQuestion??null,
  lastFingerprint:latest?.fingerprint??null};
}
