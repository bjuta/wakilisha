/** MIZIZI Slice 2: evidence-grounded, resumable, adaptive research.
 * A pass is not an investigation; inconclusive is not terminal.
 * No canonical writes, grants, source licences or model trust are created here.
 */
import {createHash} from "node:crypto";
import {validFactualNoteReferencesV1,type DeskFactualNoteReferenceV1} from "./desk-factual-note-readback-v1.ts";
export const ADAPTIVE_INVESTIGATION_CONTRACT="mizizi.adaptive_investigation.v1" as const;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const USE=new Set(["first_party","documented_consent","documented_contract","open_license"]);
export type SourceAuthorityV1=Readonly<{
 sourceId:string;caseId:string;workspaceId:string;originKey:string;lineageKey:string;
 fingerprint:string;authorityRef:string;
 useBasis:"first_party"|"documented_consent"|"documented_contract"|"open_license";
 observedAt:string;expiresAt:string|null;revokedAt:string|null;privateResearchAllowed:boolean;
 externalModelProcessingAllowed:boolean;privateEvidenceRetentionAllowed:boolean;
}>;
export type SourceExcerptV1=Readonly<{source:SourceAuthorityV1;excerpt:string;citation:string}>;
export const NOTEBOOK_FIELDS_V1=["subject_version","release_date","performer","composition_credits","recording_production","label_distribution"] as const;
export const NOTEBOOK_KINDS_V1=["direct_observation","attributed_claim","inference"] as const;
/** Digest/locator-only record of text lawfully examined by the model but
 * not retained as publisher expression or admitted as source evidence. */
export type DeskConsultationRefV1=Readonly<{receiptId:string;textSha256:string;textBytes:number;citation:string;observedAt:string}>;
export function validDeskConsultationRefV1(v:unknown):v is DeskConsultationRefV1{
 if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).sort().join(",")!=="citation,observedAt,receiptId,textBytes,textSha256")return false;
 const r=v as DeskConsultationRefV1;
 return typeof r.receiptId==="string"&&UUID.test(r.receiptId)&&typeof r.textSha256==="string"&&SHA.test(r.textSha256)&&
  Number.isSafeInteger(r.textBytes)&&r.textBytes>=1&&r.textBytes<=16000&&
  typeof r.citation==="string"&&r.citation.startsWith("https://")&&r.citation.length>=12&&r.citation.length<=1000&&
  typeof r.observedAt==="string"&&Number.isFinite(Date.parse(r.observedAt));
}
export type ResearchClaimV1=Readonly<{
 statement:string;sourceIds:readonly string[];
 interpretation:"hypothesis"|"supported"|"contradicted"|"unknown";
 uncertainty:number;reasoningSummary:string;
 /** Optional original agent notebook classification. Not evidence or independent verification. */
 fieldKey?:typeof NOTEBOOK_FIELDS_V1[number];noteKind?:typeof NOTEBOOK_KINDS_V1[number];
 consultationIds?:readonly string[];
}>;
export function notebookClaimCurrentV1(claim:ResearchClaimV1,sources:readonly {sourceId:string;excerpt:string}[],
 consultations:readonly (DeskConsultationRefV1&{text?:string})[]=[]):boolean{
 if(claim.fieldKey===undefined&&claim.noteKind===undefined)return claim.consultationIds===undefined;
 if(!NOTEBOOK_FIELDS_V1.includes(claim.fieldKey!)||!NOTEBOOK_KINDS_V1.includes(claim.noteKind!)||
  typeof claim.statement!=="string"||claim.statement.length<8||claim.statement.length>1200||
  !Array.isArray(claim.sourceIds)||!Array.isArray(claim.consultationIds)||
  claim.sourceIds.length+claim.consultationIds.length<1||claim.sourceIds.length+claim.consultationIds.length>12||
  new Set([...claim.sourceIds,...claim.consultationIds]).size!==claim.sourceIds.length+claim.consultationIds.length)return false;
 const normalized=(v:string)=>v.trim().replace(/\s+/g," ").toLowerCase();
 const statement=normalized(claim.statement);
 const original=(excerpt:string)=>!(statement.length>=80&&normalized(excerpt).includes(statement));
 return claim.sourceIds.every(id=>{
  const s=sources.find(x=>x.sourceId===id);
  return !!s&&s.excerpt!=="Visual derivative for examination; no textual claim is verified."&&original(s.excerpt);
 })&&claim.consultationIds.every(id=>{
  const c=consultations.find(x=>x.receiptId===id);
  return !!c&&(c.text===undefined||original(c.text));
 });
}
function consultationRefsCurrentV1(refs:unknown,deps:InvestigationPassV1["deskToolReceipts"]):refs is readonly DeskConsultationRefV1[]{
 if(!Array.isArray(refs)||refs.length<1||refs.length>4||!Array.isArray(deps))return false;
 return refs.every(validDeskConsultationRefV1)&&new Set(refs.map(r=>r.receiptId)).size===refs.length&&
  refs.every(r=>deps.some(d=>d.receiptId===r.receiptId));
}
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
/** A trusted event reader must independently bind this exact event to the
 * case, paused predecessor, question and current authority. An opaque UUID
 * and digest alone confer no permission or ability to dispatch a new job. */
export type InvestigationReopenAuthorityV1=Readonly<{
 sourceEventRef:string;eventSha256:string;predecessorFingerprint:string;question:string;
}>;
export type DeskBatchReceiptV1=Readonly<{reservationId:string;bodySha256:string;resultSha256:string}>;
// Only bounded availability failures from the trusted native transport.
// Permission, custody, finance, identity and ambiguous model errors are not
// eligible. This is a diagnostic, never a source or retry authorization.
export type DeskAvailabilityFailureV1=`MIZIZI_DESK_NATIVE_SOURCE_UNAVAILABLE_HTTP_${404|408|410|429|500|502|503|504}`;
export function isDeskAvailabilityFailureV1(value:unknown):value is DeskAvailabilityFailureV1{
 return typeof value==="string"&&/^MIZIZI_DESK_NATIVE_SOURCE_UNAVAILABLE_HTTP_(404|408|410|429|500|502|503|504)$/.test(value);
}
export type InvestigationPassV1=Readonly<{
 contract:typeof ADAPTIVE_INVESTIGATION_CONTRACT;
 caseId:string;workspaceId:string;ordinal:number;question:string;
 predecessorFingerprint:string|null;fingerprint:string;
 sourceReceipts:readonly Readonly<{
  sourceId:string;originKey:string;lineageKey:string;payloadFingerprint:string;
  useBasis:string;authorityRef:string;observedAt:string;
  citation:string;excerpt:string;
  /** Missing on older immutable passes; never infer their disclosure status. */
  modelDisclosed?:boolean;
  /** Optional original custodian digest for human-only material. */
  custodyFingerprint?:string;
 }>[];
 deskToolReceipts?:readonly Readonly<{receiptId:string;callSha256:string;resultSha256:string}>[];
 deskConsultationReceipts?:readonly DeskConsultationRefV1[];
 /** Original human-note context, never a source excerpt or verified finding. */
 factualNoteReferences?:readonly DeskFactualNoteReferenceV1[];
 deskBatchReceipt?:DeskBatchReceiptV1;
 /** First pass after a separately verified new event; no event payload. */
 reopenEvent?:Readonly<Pick<InvestigationReopenAuthorityV1,"sourceEventRef"|"eventSha256"|"predecessorFingerprint">>;
 /** Trustworthy runtime diagnostic, not model analysis or source evidence. */
 interruptionCode?:DeskAvailabilityFailureV1;
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
/** Trusted desk pass executes independently authorized model/tool calls and
 * returns only current, independently admitted evidence. The engine still
 * verifies source rights, citations, findings and journal CAS. */
export type PreparedDeskPassV1=Readonly<{
 sources:readonly SourceExcerptV1[];analysis:ResearchAnalysisV1;costUnits:number;
 /** Explicit zero-inference discovery pass, not an unmetered model response. */
 method?:"discovery_only"|"interrupted";
 interruptionCode?:DeskAvailabilityFailureV1;
 deskToolReceipts?:InvestigationPassV1["deskToolReceipts"];
 deskConsultationReceipts?:InvestigationPassV1["deskConsultationReceipts"];
 factualNoteReferences?:InvestigationPassV1["factualNoteReferences"];
 deskBatchReceipt?:DeskBatchReceiptV1;
}>;
export type DeskPassResearcherV1=(identity:InvestigationIdentityV1,question:string,
 history:readonly InvestigationPassV1[])=>Promise<PreparedDeskPassV1>;
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
export function verifyInvestigationHistoryV1(id:InvestigationIdentityV1,history:readonly InvestigationPassV1[]){
 let prior:string|null=null;
 const reopenEvents=new Set<string>();
 for(let i=0;i<history.length;i++){
  const pass=history[i];
  if(pass.contract!==ADAPTIVE_INVESTIGATION_CONTRACT||pass.caseId!==id.caseId||
     pass.workspaceId!==id.workspaceId||pass.ordinal!==i+1||
     pass.predecessorFingerprint!==prior||!SHA.test(pass.fingerprint)||
     digest({...pass,fingerprint:undefined})!==pass.fingerprint)
   throw new Error("MIZIZI_RESEARCH_HISTORY_CORRUPT_OR_CONFLICTED");
  if(pass.factualNoteReferences!==undefined&&!validFactualNoteReferencesV1(pass.factualNoteReferences))
   throw Error("MIZIZI_RESEARCH_NOTE_HISTORY_INVALID");
  if(pass.deskConsultationReceipts!==undefined&&!consultationRefsCurrentV1(pass.deskConsultationReceipts,pass.deskToolReceipts))
   throw Error("MIZIZI_RESEARCH_CONSULTATION_HISTORY_INVALID");
  if(pass.findings.some(f=>!notebookClaimCurrentV1(f,pass.sourceReceipts,pass.deskConsultationReceipts)))
   throw Error("MIZIZI_RESEARCH_NOTEBOOK_HISTORY_INVALID");
  const event=pass.reopenEvent;
  if(event!==undefined){
   if(!event||Object.keys(event).sort().join(",")!=="eventSha256,predecessorFingerprint,sourceEventRef"||
    !UUID.test(event.sourceEventRef)||event.sourceEventRef!==event.sourceEventRef.toLowerCase()||
    !SHA.test(event.eventSha256)||event.predecessorFingerprint!==prior||
    history[i-1]?.decision.action!=="pause"||reopenEvents.has(event.sourceEventRef))
    throw Error("MIZIZI_RESEARCH_REOPEN_HISTORY_INVALID");
   reopenEvents.add(event.sourceEventRef);
  }
  prior=pass.fingerprint;
 }
}
export function verifyInvestigationSourceV1(source:SourceAuthorityV1,id:InvestigationIdentityV1,nowMs:number){
 if(!UUID.test(source.sourceId)||source.caseId.toLowerCase()!==id.caseId||
    source.workspaceId.toLowerCase()!==id.workspaceId||
    !USE.has(source.useBasis)||source.privateResearchAllowed!==true||
    typeof source.externalModelProcessingAllowed!=="boolean"||
    source.privateEvidenceRetentionAllowed!==true||
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
 prepareDeskPass?:DeskPassResearcherV1;
 /** Trusted, read-only restart gate. False defers without a fabricated pass. */
 canPrepareDeskPass?:(...args:Parameters<DeskPassResearcherV1>)=>Promise<boolean>;
 maxNewPasses:number;maxTotalPasses:number;costBudgetUnits:number;
 reopen?:InvestigationReopenAuthorityV1;
 verifyReopen?:(event:InvestigationReopenAuthorityV1,identity:InvestigationIdentityV1,
   previous:InvestigationPassV1)=>Promise<boolean>;
 /** Trusted runtime metering, never model-generated estimated usage. */
 measureCostUnits?:()=>number;now?:()=>number;
 /** Independently trusted, current external-model permission for non-open sources.
  * The reader's model-processing flag is necessary but never sufficient.
  * Do not implement this by echoing the source reader's own claim.
  */
 authorizeModelProcessing?:(identity:InvestigationIdentityV1,question:string,
  source:SourceAuthorityV1)=>Promise<boolean>;
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
 if(input.prepareDeskPass!==undefined&&(typeof input.prepareDeskPass!=="function"||
    typeof input.authorizeModelProcessing!=="function"))
  throw new Error("MIZIZI_DESK_INDEPENDENT_MODEL_AUTHORITY_REQUIRED");
 if(input.canPrepareDeskPass!==undefined&&(!input.prepareDeskPass||typeof input.canPrepareDeskPass!=="function"))
  throw Error("MIZIZI_DESK_RESTART_GATE_INVALID");
 const now=input.now??Date.now;
 const history=[...await store.read(identity)];
 verifyInvestigationHistoryV1(identity,history);
 let latest=history.at(-1);
 const reopen=input.reopen===undefined?undefined:Object.freeze({...input.reopen});
 if(reopen&&latest?.decision.action!=="pause")throw Error("MIZIZI_RESEARCH_REOPEN_NOT_PAUSED");
 if(latest?.decision.action==="conclude")return {
  caseId:identity.caseId,workspaceId:identity.workspaceId,passesAdded:0,
  totalPasses:history.length,disposition:"concluded",nextQuestion:null,
  lastFingerprint:latest.fingerprint};
 if(latest?.decision.action==="pause"){
  if(!input.reopen)return {
   caseId:identity.caseId,workspaceId:identity.workspaceId,passesAdded:0,
   totalPasses:history.length,disposition:"paused",nextQuestion:null,
   lastFingerprint:latest.fingerprint};
  if(!reopen||Object.keys(reopen).sort().join(",")!=="eventSha256,predecessorFingerprint,question,sourceEventRef"||
   !UUID.test(reopen.sourceEventRef)||reopen.sourceEventRef!==reopen.sourceEventRef.toLowerCase()||
   !SHA.test(reopen.eventSha256)||reopen.predecessorFingerprint!==latest.fingerprint||
   history.some(p=>p.reopenEvent?.sourceEventRef===reopen.sourceEventRef)||
   typeof input.verifyReopen!=="function")
   throw Error("MIZIZI_RESEARCH_REOPEN_AUTHORITY_UNVERIFIED");
  requireText(reopen.question,"REOPEN_QUESTION",500);
 }
 const reopenPrevious=latest?.decision.action==="pause"?latest:undefined;
 let question=(reopenPrevious?reopen?.question:null)||
     latest?.decision.nextQuestion||identity.openingQuestion;
 // Desk token units are a cumulative investigation budget across leases.
 // The monetary ledger independently precharges actual and uncertain calls.
 const historicCost=input.prepareDeskPass?history.reduce((total,pass)=>{
  if(!Number.isSafeInteger(pass.costUnits)||pass.costUnits<0||pass.costUnits>1000000)
   throw Error("MIZIZI_DESK_HISTORY_COST_UNCONFIRMED");
  return total+pass.costUnits;
 },0):0;
 let remainingCost=Math.max(0,input.costBudgetUnits-historicCost),added=0;
 let disposition:InvestigationResultV1["disposition"]=reopenPrevious?"paused":"continue";
 while(added<input.maxNewPasses&&history.length<input.maxTotalPasses){
  // Do not enter an externally metered desk pass with an exhausted budget.
  if(input.prepareDeskPass&&remainingCost<=0)break;
  const snapshot=Object.freeze([...history]);
  const activeReopen=added===0&&reopenPrevious?reopen:undefined;
  if(activeReopen&&await input.verifyReopen!(activeReopen,identity,reopenPrevious!)!==true)
   throw Error("MIZIZI_RESEARCH_REOPEN_AUTHORITY_UNVERIFIED");
  if(input.canPrepareDeskPass&&await input.canPrepareDeskPass(identity,question,snapshot)!==true)break;
  const prepared=input.prepareDeskPass?
   await input.prepareDeskPass(identity,question,snapshot):null;
  if(prepared?.factualNoteReferences!==undefined&&(!validFactualNoteReferencesV1(prepared.factualNoteReferences)||
   prepared.deskBatchReceipt!==undefined||prepared.method==="discovery_only"))throw Error("MIZIZI_RESEARCH_NOTE_CONTEXT_INVALID");
  if(prepared?.deskConsultationReceipts!==undefined&&(!consultationRefsCurrentV1(prepared.deskConsultationReceipts,prepared.deskToolReceipts)||
   prepared.deskBatchReceipt!==undefined||prepared.method==="discovery_only"))throw Error("MIZIZI_RESEARCH_CONSULTATION_CONTEXT_INVALID");
  const discoveryOnly=prepared?.method==="discovery_only";
  const interrupted=prepared?.method==="interrupted";
  if(interrupted?(!prepared||!isDeskAvailabilityFailureV1(prepared.interruptionCode)||
   !prepared.deskToolReceipts?.length||prepared.deskBatchReceipt!==undefined||
   prepared.analysis.modelVersion!=="mizizi.interrupted_desk_method.v1"||
   prepared.analysis.hypotheses.length!==0||prepared.analysis.leads.length!==0||
   prepared.analysis.requestedDisposition!=="pause"):
   prepared?.interruptionCode!==undefined)throw Error("MIZIZI_DESK_INTERRUPTION_INVALID");
  if(discoveryOnly&&(!prepared||prepared.costUnits!==0||prepared.sources.length!==0||
   prepared.deskBatchReceipt!==undefined||prepared.deskToolReceipts?.length!==1||
   prepared.analysis.modelVersion!=="mizizi.deterministic_discovery_only.v1"||
   prepared.analysis.hypotheses.length!==0||prepared.analysis.leads.length!==0||
   prepared.analysis.requestedDisposition!=="pause"))
   throw Error("MIZIZI_DESK_DISCOVERY_ONLY_INVALID");
  if(interrupted&&prepared!.costUnits===0&&(prepared!.sources.length||prepared!.deskToolReceipts!.length!==1))throw Error("MIZIZI_DESK_INTERRUPTION_INVALID");
  if(prepared)bounded(prepared.costUnits,"DESK_MEASURED_COST",discoveryOnly||interrupted?0:1,1000000);
  const sources=prepared?[...prepared.sources]:[...await readSources(identity,question,Object.freeze([...history]))];
  if(sources.length>30)throw new Error("MIZIZI_RESEARCH_SOURCE_BUDGET_EXCEEDED");
  const known=new Set<string>();
  const authorities:SourceAuthorityV1[]=[];
  for(const entry of sources){
   verifyInvestigationSourceV1(entry.source,identity,now());
   if(known.has(entry.source.sourceId.toLowerCase()))
    throw new Error("MIZIZI_RESEARCH_DUPLICATE_SOURCE");
   known.add(entry.source.sourceId.toLowerCase());
   requireText(entry.citation,"CITATION",1000);
   if(typeof entry.excerpt!=="string"||entry.excerpt.length>10000)
    throw new TypeError("MIZIZI_RESEARCH_EXCERPT_TOO_LARGE");
   authorities.push(entry.source);
  }
  // A valid private source can forbid hosted-model processing. Such material
  // stays in the immutable internal receipt, never in the analyst packet.
  const modelVisibleIds=new Set<string>();
  for(const {source} of sources){
   if(!source.externalModelProcessingAllowed)continue;
   // An attestation's sharing flags do not grant hosted-LLM disclosure.
   // Only a reviewed open-license reader uses the established default path.
   // All other sources require a distinct trusted current-use decision.
   const permitted=(!prepared&&source.useBasis==="open_license")||
    (typeof input.authorizeModelProcessing==="function"&&
     await input.authorizeModelProcessing(identity,question,source)===true);
   if(permitted)modelVisibleIds.add(source.sourceId.toLowerCase());
  }
  const modelSources=sources.filter(s=>
   modelVisibleIds.has(s.source.sourceId.toLowerCase()));
  // Historic analysis and citations are not facts or disclosure consent.
  // Pass only method metadata, not excerpts, findings, or narrative that
  // could quote a privately retained witness or artifact.
  const analystHistory=history.map(p=>Object.freeze({...p,
   question:"Prior research question withheld from external processing.",
   sourceReceipts:[],findings:[],proposedLeads:[],reopenEvent:undefined,factualNoteReferences:undefined,deskConsultationReceipts:undefined,
   passFinding:"Unverified prior analysis withheld from external processing.",
   decision:{...p.decision,nextQuestion:null,
    rationale:"Prior method decision; previous claims are not evidence.",
    revisitTrigger:null}
  }));
  // Repeated identical source receipts, even under paraphrased questions,
  // are not independent new evidence. Two previous same-family passes are
  // sufficient to stop another paid interpretation of identical material.
  const alreadySeen=new Set(history.flatMap(p=>
   p.sourceReceipts.map(r=>r.lineageKey+"|"+r.originKey+"|"+r.payloadFingerprint)));
  const sameEvidence=sources.length>0&&sources.every(s=>
   alreadySeen.has(s.source.lineageKey+"|"+s.source.originKey+"|"+s.source.fingerprint));
  const prior=history.at(-1);
  const earlier=new Set(history.slice(0,-1).flatMap(p=>
   p.sourceReceipts.map(r=>r.lineageKey+"|"+r.originKey+"|"+r.payloadFingerprint)));
  const priorRepeated=history.length>1&&!!prior&&prior.sourceReceipts.length>0&&
   prior.sourceReceipts.every(r=>
    earlier.has(r.lineageKey+"|"+r.originKey+"|"+r.payloadFingerprint));
  const evidenceExhausted=sameEvidence&&priorRepeated&&!prepared?.deskConsultationReceipts?.length;
  // Mixed public and restricted packets are also human-only. The case
  // question may itself disclose a protected witness or investigation lead;
  // filtering excerpts alone cannot safely authorize sending that question.
  const humanOnly=sources.some(s=>
   !modelVisibleIds.has(s.source.sourceId.toLowerCase()));
  // A lawful reader returning no evidence is a method result, not a prompt
  // for a source-free model answer. Absence never establishes nonexistence.
  // A desk pass already disclosed only independently authorized material.
  // If rights changed before journal append, fail closed; never relabel it
  // human-only and falsely claim no model received the evidence.
  if(prepared&&humanOnly)throw new Error("MIZIZI_DESK_MODEL_AUTHORITY_REVOKED");
  const noEvidence=sources.length===0&&!prepared?.deskConsultationReceipts?.length;
  const noModel=humanOnly||evidenceExhausted||noEvidence;
  // Discovery may legitimately run without admitted evidence. Persist
  // the model's next questions (not unsupported cultural conclusions).
  // Repeated evidence can stop continuation, but cannot erase metering
  // or pretend the already executed model call was withheld.
  const method=humanOnly?"human_review_required":
   noEvidence?"no_authorized_evidence":"evidence_exhausted";
  const methodFingerprintSeed=humanOnly?"mizizi.human_only_method.v1":
   noEvidence?"mizizi.no_authorized_evidence_method.v1":
   "mizizi.exhausted_evidence_method.v1";
  const analysis:ResearchAnalysisV1=prepared?{
   ...prepared.analysis,
   ...(noEvidence&&!discoveryOnly&&!interrupted?{hypotheses:[],passFinding:"No authorized evidence was located; absence cannot establish that a cultural claim is false.",
    requestedDisposition:"pause" as const}:{}),
   ...(evidenceExhausted&&!interrupted?{hypotheses:[],leads:[],passFinding:"No new independent source evidence; further interpretation paused.",
    requestedDisposition:"pause" as const}:{})
  }:noModel?{
   hypotheses:[],leads:[],
   passFinding:humanOnly?
    "Authorized evidence retained solely for private human review; no model received it.":
    noEvidence?
    "No authorized evidence was located; absence cannot establish that a cultural claim is false.":
    "No new independent source evidence; repeat model interpretation withheld.",
   requestedDisposition:"pause",
   modelVersion:"mizizi."+method+".v1",
   promptFingerprint:digest(methodFingerprintSeed)
  }:await analyze(question,Object.freeze(modelSources),
   Object.freeze(analystHistory));
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
      claim.sourceIds.some(ref=>!modelVisibleIds.has(ref.toLowerCase())))
    throw new TypeError("MIZIZI_RESEARCH_UNOBSERVED_EVIDENCE_CITATION");
   if(!notebookClaimCurrentV1(claim,sources.map(s=>({sourceId:s.source.sourceId,excerpt:s.excerpt})),prepared?.deskConsultationReceipts))
    throw Error("MIZIZI_RESEARCH_NOTEBOOK_CLAIM_INVALID");
   const refs=authorities.filter(a=>modelVisibleIds.has(a.sourceId.toLowerCase())&&
    claim.sourceIds.some(id=>id.toLowerCase()===a.sourceId.toLowerCase()));
   const independent=await verifyFinding(claim,Object.freeze(refs));
   if(typeof independent?.verified!=="boolean"||
      (independent.verified&&!independent.verificationRef))
    throw new Error("MIZIZI_RESEARCH_INDEPENDENT_VERIFIER_INVALID");
   const verified=independent.verified&&refs.length>0&&!claim.consultationIds?.length;
   findings.push({...claim,sourceIds:[...claim.sourceIds],
    interpretation:claim.interpretation==="supported"&&!verified?"hypothesis":claim.interpretation,
    independentlyVerified:verified,
    verificationRef:verified?independent.verificationRef:null});
  }
  const supported=findings.some(f=>f.interpretation==="supported"&&
    f.independentlyVerified&&f.uncertainty<=.2);
  const nextBudget=prepared?Math.max(0,remainingCost-prepared.costUnits):remainingCost;
  const next=prepared&&nextBudget<=0?null:selectLead(analysis.leads,history,question,nextBudget);
  let decision:PassDecisionV1;
  if(interrupted){
   decision={action:"pause",nextQuestion:null,
    rationale:"External availability interrupted the investigation; preserve confirmed receipts without attributing claims.",
    revisitTrigger:"Independently confirmed available authorized research avenue; never replay a consumed request automatically."};
   disposition="paused";
  }else if(analysis.requestedDisposition==="conclude"&&supported){
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
  const costUnits=prepared?prepared.costUnits:noModel?0:(input.measureCostUnits?.()??0);
  bounded(costUnits,"MEASURED_COST",0,1000000);
  remainingCost=Math.max(0,remainingCost-costUnits);
  const previous=history.at(-1)?.fingerprint??null;
  const REDACTED="[Source content withheld: custodian-controlled human-only evidence]";
  const redactedFingerprint=createHash("sha256").update(REDACTED,"utf8").digest("hex");
  // The source UUID is an opaque pointer, not a copy of the evidence or a
  // grant to resolve it. Source/custody metadata and the original payload
  // digest must stay with the independently authorized custodian.
  const restrictedReceipt=(source:SourceAuthorityV1)=>
   !modelVisibleIds.has(source.sourceId.toLowerCase());
  // A private witness can be named in the question itself. The custodian,
  // not the permanent research-pass journal, must retain that context.
  const receiptQuestion=humanOnly?
   "Private research question held by authorized evidence custodian.":question;
  const body={contract:ADAPTIVE_INVESTIGATION_CONTRACT,caseId:identity.caseId,
   workspaceId:identity.workspaceId,ordinal:history.length+1,
   question:receiptQuestion,
   predecessorFingerprint:previous,
   sourceReceipts:sources.map(({source:a,citation,excerpt})=>({
    sourceId:a.sourceId,
    originKey:restrictedReceipt(a)?"custodian:restricted":a.originKey,
    lineageKey:restrictedReceipt(a)?"custodian:restricted":a.lineageKey,
    // This hashes the REDACTED pass excerpt only. It does not claim
    // integrity or independent provenance of the custodian-held source.
    payloadFingerprint:restrictedReceipt(a)?redactedFingerprint:a.fingerprint,
    useBasis:a.useBasis,
    authorityRef:restrictedReceipt(a)?"custodian:access-controlled":a.authorityRef,
    observedAt:a.observedAt,
    citation:restrictedReceipt(a)?"custodian:source-held":citation,
    excerpt:restrictedReceipt(a)?REDACTED:excerpt,
    modelDisclosed:modelVisibleIds.has(a.sourceId.toLowerCase())&&(!noModel||!!prepared)})),
   ...(prepared?.deskToolReceipts!==undefined?{deskToolReceipts:prepared.deskToolReceipts}:{}),
   ...(prepared?.deskConsultationReceipts!==undefined?{deskConsultationReceipts:prepared.deskConsultationReceipts}:{}),
   ...(prepared?.factualNoteReferences!==undefined?{factualNoteReferences:prepared.factualNoteReferences}:{}),
   ...(prepared?.deskBatchReceipt!==undefined?{deskBatchReceipt:prepared.deskBatchReceipt}:{}),
   ...(activeReopen?{reopenEvent:{sourceEventRef:activeReopen.sourceEventRef,eventSha256:activeReopen.eventSha256,
    predecessorFingerprint:activeReopen.predecessorFingerprint}}:{}),
   ...(interrupted?{interruptionCode:prepared!.interruptionCode}:{}),
   findings,passFinding:analysis.passFinding,proposedLeads:analysis.leads.map(l=>({...l})),
   decision,modelVersion:analysis.modelVersion,
   promptFingerprint:analysis.promptFingerprint,
   recordedAt:new Date(now()).toISOString(),costUnits};
  // Only source-authorized, exact evidence snippets are persisted.
  if(new TextEncoder().encode(JSON.stringify(body)).length>30000)
   throw new Error('MIZIZI_RESEARCH_EVIDENCE_SNAPSHOT_BUDGET');
  const pass:InvestigationPassV1=Object.freeze({...body,
   fingerprint:digest({...body,fingerprint:undefined})});
  if(activeReopen&&await input.verifyReopen!(activeReopen,identity,reopenPrevious!)!==true)
   throw Error("MIZIZI_RESEARCH_REOPEN_AUTHORITY_CHANGED");
  await store.append(identity,pass.ordinal,previous,pass);
  history.push(pass);added++;
  // Do not label an interrupted worker as succeeded merely because the
  // independently checked partial pass was safely persisted. The existing
  // failure lifecycle retains the bounded diagnostic and consumed costs.
  if(interrupted)throw Error(prepared!.interruptionCode);
  if(decision.action!=="continue"||remainingCost<=0)break;
  question=decision.nextQuestion!;
 }
 latest=history.at(-1);
 return {caseId:identity.caseId,workspaceId:identity.workspaceId,
  passesAdded:added,totalPasses:history.length,disposition,
  nextQuestion:latest?.decision.nextQuestion??null,
  lastFingerprint:latest?.fingerprint??null};
}
