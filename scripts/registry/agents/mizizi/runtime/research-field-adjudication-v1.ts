/** Independent, post-investigation scoring. This module never imports a model,
 * provider, credential, database or worker. The private evaluator supplies
 * exact reviewed field decisions and evidence spans after research; neither
 * the answers nor the review packet belongs in a model request.
 */
import {createHash} from "node:crypto";
import {lstat,readFile,open} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {verifyInvestigationHistoryV1,type InvestigationIdentityV1,type InvestigationPassV1} from "./adaptive-investigation-v1.ts";
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const RECORDING_RESEARCH_FIELDS_V1=["subject_version","release_date","performer","composition_credits","recording_production","label_distribution"] as const;
type Field=typeof RECORDING_RESEARCH_FIELDS_V1[number];
type ReviewEvidence=Readonly<{sourceId:string;payloadFingerprint:string;lineageKey:string;excerptSha256:string;spanStart:number;spanLength:number;spanSha256:string}>;
/** Evaluator-only original observation, not a source excerpt, model claim,
 * or automatic source grant. The independently controlled review packet
 * attests permitted consultation; its digest authenticates bytes, not rights,
 * truth or the reviewer. Do not retain publisher expression here. */
type IndependentObservation=Readonly<{sourceLocator:string;observedAt:string;method:"manual_public_consultation"|"manual_first_party_consultation";
 authorityRef:string;originKey:string;lineageKey:string;originalFactualNote:string}>;
type ReviewedConsultation=Readonly<{receiptId:string;textSha256:string;textBytes:number;citation:string;observedAt:string;callSha256:string;resultSha256:string}>;
type FieldReview=Readonly<{field:Field;disposition:"correct"|"incorrect"|"unresolved"|"unreviewable";reviewRef:string;
 finding?:Readonly<{passFingerprint:string;claimIndex:number;statementSha256:string}>;
 evidence:readonly ReviewEvidence[];rationale:string;
 reviewedConsultations?:readonly ReviewedConsultation[];
 independentObservations?:readonly IndependentObservation[]}>;
export type IndependentRecordingReviewV1=Readonly<{
 contract:"mizizi.recording_field_review.v1";caseId:string;workspaceId:string;subjectVersionSha256:string;
 rubricSha256:string;lastFingerprint:string|null;reviewerRef:string;reviewedAt:string;fields:readonly FieldReview[];
}>;
const hash=(value:string)=>createHash("sha256").update(value,"utf8").digest("hex");
const fail=(code:string):never=>{throw Error("MIZIZI_FIELD_REVIEW_"+code);};
const text=(v:unknown,max=2000):v is string=>typeof v==="string"&&v===v.trim()&&v.length>=8&&v.length<=max&&!/[\p{Cc}\p{Cf}]/u.test(v);
const shape=(v:unknown,keys:string[])=>!!v&&typeof v==="object"&&!Array.isArray(v)&&
 Object.keys(v).sort().join(",")===keys.sort().join(",");
/** No automatic truth inference. A human/evaluator decision is accepted as
 * an input only when a trusted out-of-band digest binds the exact packet,
 * exact subject/version, frozen rubric, journal head and reviewed evidence.
 * Hash binding is integrity, not authentication of the reviewer.
 */
export function adjudicateRecordingFieldsV1(input:Readonly<{
 identity:InvestigationIdentityV1;history:readonly InvestigationPassV1[];
 subjectVersionSha256:string;rubricSha256:string;reviewText:string;reviewSha256:string;now?:number;
}>){
 const {identity,history,reviewText}=input;
 if(!UUID.test(identity.caseId)||!UUID.test(identity.workspaceId)||!SHA.test(input.subjectVersionSha256)||
  !SHA.test(input.rubricSha256)||!SHA.test(input.reviewSha256)||typeof reviewText!=="string"||
  Buffer.byteLength(reviewText)>128000||hash(reviewText)!==input.reviewSha256)fail("PACKET_BINDING");
 verifyInvestigationHistoryV1(identity,history);
 let review:IndependentRecordingReviewV1;
 try{review=JSON.parse(reviewText);}catch{fail("PACKET_JSON");}
 const last=history.at(-1)?.fingerprint??null;
 if(!shape(review,["contract","caseId","workspaceId","subjectVersionSha256","rubricSha256","lastFingerprint","reviewerRef","reviewedAt","fields"])||
  review.contract!=="mizizi.recording_field_review.v1"||review.caseId!==identity.caseId||review.workspaceId!==identity.workspaceId||
  review.subjectVersionSha256!==input.subjectVersionSha256||review.rubricSha256!==input.rubricSha256||review.lastFingerprint!==last||
  !text(review.reviewerRef,500)||!Number.isFinite(Date.parse(review.reviewedAt))||Date.parse(review.reviewedAt)>(input.now??Date.now())||
  (history.length>0&&Date.parse(review.reviewedAt)<Date.parse(history.at(-1)!.recordedAt))||
  !Array.isArray(review.fields)||review.fields.length!==RECORDING_RESEARCH_FIELDS_V1.length)fail("SCOPE");
 const byField=new Map<Field,FieldReview>(),claimed=new Set<string>();
 for(const f of review.fields){
  if(!shape(f,["field","disposition","reviewRef","evidence","rationale",...(f?.finding!==undefined?["finding"]:[]),...(f?.reviewedConsultations!==undefined?["reviewedConsultations"]:[]),...(f?.independentObservations!==undefined?["independentObservations"]:[])])||
   !RECORDING_RESEARCH_FIELDS_V1.includes(f.field)||byField.has(f.field)||
   !["correct","incorrect","unresolved","unreviewable"].includes(f.disposition)||!text(f.reviewRef,500)||!text(f.rationale)||
   !Array.isArray(f.evidence)||f.evidence.length>20)fail("FIELD");
  const accepted=f.disposition==="correct"||f.disposition==="incorrect";
  if(accepted&&!f.finding||!accepted&&(f.finding!==undefined||f.reviewedConsultations!==undefined||f.independentObservations!==undefined))fail("CLAIM_REQUIRED");
  const pass=f.finding?history.find(p=>p.fingerprint===f.finding!.passFingerprint):undefined;
  const claim=pass&&f.finding&&Number.isSafeInteger(f.finding.claimIndex)&&f.finding.claimIndex>=0?pass.findings[f.finding.claimIndex]:undefined;
  if(f.finding&&(!shape(f.finding,["passFingerprint","claimIndex","statementSha256"])||!claim||
   hash(claim.statement)!==f.finding.statementSha256))fail("CLAIM_BINDING");
  // A compound statement cannot silently cover multiple separate fields.
  if(f.finding){const key=f.finding.passFingerprint+":"+f.finding.claimIndex;if(claimed.has(key))fail("COMPOUND_CLAIM");claimed.add(key);}
  const ids=new Set<string>(),lineages=new Set<string>();
  for(const e of f.evidence){
   if(!shape(e,["sourceId","payloadFingerprint","lineageKey","excerptSha256","spanStart","spanLength","spanSha256"])||
    !UUID.test(e.sourceId)||ids.has(e.sourceId)||!SHA.test(e.payloadFingerprint)||!SHA.test(e.excerptSha256)||!SHA.test(e.spanSha256)||
    !Number.isSafeInteger(e.spanStart)||!Number.isSafeInteger(e.spanLength)||e.spanStart<0||e.spanLength<1)fail("EVIDENCE_SHAPE");
   const s=(pass?[pass]:history).flatMap(p=>p.sourceReceipts).find(r=>r.sourceId===e.sourceId);
   if(!s||s.modelDisclosed!==true||s.payloadFingerprint!==e.payloadFingerprint||s.lineageKey!==e.lineageKey||
    hash(s.excerpt)!==e.excerptSha256||e.spanStart+e.spanLength>s.excerpt.length||
    hash(s.excerpt.slice(e.spanStart,e.spanStart+e.spanLength))!==e.spanSha256||
    (claim&&!claim.sourceIds.includes(e.sourceId)))fail("EVIDENCE_BINDING");
   ids.add(e.sourceId);lineages.add(e.lineageKey);
  }
  if(accepted&&claim&&claim.sourceIds.some(id=>!ids.has(id)))fail("UNREVIEWED_CITATION");
  const consultationIds=claim?.consultationIds??[];
  if(consultationIds.length){
   // A transient digest does not prove a fact, the consulted bytes are
   // absent, and neither an agent note nor its review is factual evidence.
   // Require exact journal bindings AND a separately attested original
   // observation in the independently controlled review packet.
   if(!accepted||claim?.fieldKey!==f.field||claim.independentlyVerified!==false||claim.verificationRef!==null||
    !Array.isArray(f.reviewedConsultations)||f.reviewedConsultations.length!==consultationIds.length||
    !Array.isArray(f.independentObservations)||f.independentObservations.length<1||f.independentObservations.length>20)fail("CONSULTATION_REVIEW_REQUIRED");
   const seenConsultations=new Set<string>();
   for(const c of f.reviewedConsultations!){
    if(!shape(c,["receiptId","textSha256","textBytes","citation","observedAt","callSha256","resultSha256"])||
     !consultationIds.includes(c.receiptId)||seenConsultations.has(c.receiptId))fail("CONSULTATION_BINDING");
    const original=pass?.deskConsultationReceipts?.find(x=>x.receiptId===c.receiptId);
    const dep=pass?.deskToolReceipts?.find(x=>x.receiptId===c.receiptId);
    if(!original||!dep||c.textSha256!==original.textSha256||c.textBytes!==original.textBytes||
     c.citation!==original.citation||c.observedAt!==original.observedAt||
     c.callSha256!==dep.callSha256||c.resultSha256!==dep.resultSha256||
     !SHA.test(c.callSha256)||!SHA.test(c.resultSha256))fail("CONSULTATION_BINDING");
    seenConsultations.add(c.receiptId);
   }
   const seenObservations=new Set<string>();
   for(const observation of f.independentObservations!){
    if(!shape(observation,["sourceLocator","observedAt","method","authorityRef","originKey","lineageKey","originalFactualNote"])||
     !text(observation.sourceLocator,1000)||!text(observation.originalFactualNote,1200)||
     !text(observation.authorityRef,500)||!text(observation.originKey,500)||!text(observation.lineageKey,500)||
     !["manual_public_consultation","manual_first_party_consultation"].includes(observation.method)||
     !Number.isFinite(Date.parse(observation.observedAt))||
     Date.parse(observation.observedAt)<Date.parse(pass!.recordedAt)||
     Date.parse(observation.observedAt)>Date.parse(review.reviewedAt))fail("INDEPENDENT_OBSERVATION");
    // Only public HTTPS locators without credentials or query parameters;
    // this is a reference, never a network request or permission to fetch.
    let url:URL;
    try{url=new URL(observation.sourceLocator);}catch{fail("INDEPENDENT_OBSERVATION");}
    if(url!.protocol!=="https:"||url!.username||url!.password||url!.port||url!.search||
     url!.hostname.indexOf(".")<0||url!.hostname.endsWith(".")||
     /(?:^|\.)(localhost|local|internal|test|invalid|example|onion|home|lan|arpa)$/i.test(url!.hostname)||
     /^[0-9.]+$/.test(url!.hostname)||url!.hostname.includes(":")||
     url!.href!==observation.sourceLocator||seenObservations.has(observation.sourceLocator))fail("INDEPENDENT_OBSERVATION");
    seenObservations.add(observation.sourceLocator);
   }
  }else{
   if(f.reviewedConsultations!==undefined||f.independentObservations!==undefined)fail("UNBOUND_CONSULTATION_REVIEW");
   if(accepted&&!f.evidence.length)fail("CLAIM_REQUIRED");
  }
  byField.set(f.field,Object.freeze({...f,evidence:Object.freeze([...f.evidence])}));
 }
 const fields=RECORDING_RESEARCH_FIELDS_V1.map(field=>byField.get(field)!);
 const correct=fields.filter(f=>f.disposition==="correct").length,incorrect=fields.filter(f=>f.disposition==="incorrect").length;
 const unresolved=fields.filter(f=>f.disposition==="unresolved").length,unreviewable=fields.filter(f=>f.disposition==="unreviewable").length;
 return Object.freeze({contract:"mizizi.recording_field_score.v1" as const,caseId:identity.caseId,workspaceId:identity.workspaceId,
  subjectVersionSha256:input.subjectVersionSha256,rubricSha256:input.rubricSha256,lastFingerprint:last,reviewSha256:input.reviewSha256,
  fields:Object.freeze(fields.map(f=>Object.freeze({field:f.field,disposition:f.disposition,reviewRef:f.reviewRef,
   reviewedLineages:new Set([...f.evidence.map(e=>e.lineageKey),...(f.independentObservations??[]).map(e=>e.lineageKey)]).size}))),
  correct,incorrect,unresolved,unreviewable,precision:correct+incorrect?correct/(correct+incorrect):null,
  reviewedCoverage:(correct+incorrect)/fields.length,recordingFullyCorrect:correct===fields.length,
  journalCostUnits:history.reduce((sum,p)=>{if(!Number.isSafeInteger(p.costUnits)||p.costUnits<0)fail("COST");return sum+p.costUnits;},0)});
}


/** Frozen-cohort evaluation, isolated from the research runner. The caller
 * supplies evaluator-approved manifest and separately reconciled finance
 * packets via trusted digests. No internal claim of reviewer authentication,
 * representativeness, source rights or ledger completeness is manufactured.
 * Exclusions and missing outcomes remain visible; unknown costs never become zero.
 */
export type RecordingCohortManifestV1=Readonly<{
 contract:"mizizi.recording_cohort_manifest.v1";workspaceId:string;rubricSha256:string;frozenAt:string;
 recordings:readonly Readonly<{caseId:string;subjectVersionSha256:string;stratum:string}>[];
}>;
type CohortAttemptV1=Readonly<{
 caseId:string;subjectVersionSha256:string;disposition:"attempted"|"not_attempted"|"excluded";
 jobIds:readonly string[];resolutionSubmitted:boolean;review?:Readonly<{
  identity:InvestigationIdentityV1;history:readonly InvestigationPassV1[];reviewText:string;reviewSha256:string;
 }>;exclusionReason?:string;
}>;
type CohortFinanceV1=Readonly<{
 contract:"mizizi.recording_cohort_finance.v1";manifestSha256:string;
 entries:readonly Readonly<{caseId:string;jobIds:readonly string[];
  inferenceMicrousd:number|null;allInMicrousd:number|null;humanReviewMinutes:number|null;reconciliationRef:string}>[];
}>;
export function scoreFrozenRecordingCohortV1(input:Readonly<{
 manifestText:string;manifestSha256:string;financeText:string;financeSha256:string;
 outcomes:readonly CohortAttemptV1[];now?:number;
}>){
 const {manifestText,manifestSha256,financeText,financeSha256,outcomes}=input;
 if(!SHA.test(manifestSha256)||!SHA.test(financeSha256)||typeof manifestText!=="string"||typeof financeText!=="string"||
  Buffer.byteLength(manifestText)>500000||Buffer.byteLength(financeText)>1000000||
  hash(manifestText)!==manifestSha256||hash(financeText)!==financeSha256)fail("COHORT_DIGEST");
 let manifest:RecordingCohortManifestV1,finance:CohortFinanceV1;
 try{manifest=JSON.parse(manifestText);finance=JSON.parse(financeText);}catch{fail("COHORT_JSON");}
 const frozenAt=Date.parse(manifest.frozenAt),now=input.now??Date.now();
 if(!shape(manifest,["contract","workspaceId","rubricSha256","frozenAt","recordings"])||
  manifest.contract!=="mizizi.recording_cohort_manifest.v1"||!UUID.test(manifest.workspaceId)||!SHA.test(manifest.rubricSha256)||
  !Number.isFinite(frozenAt)||frozenAt>now||!Array.isArray(manifest.recordings)||manifest.recordings.length!==1000||
  !Array.isArray(outcomes)||outcomes.length!==1000||
  !shape(finance,["contract","manifestSha256","entries"])||finance.contract!=="mizizi.recording_cohort_finance.v1"||
  finance.manifestSha256!==manifestSha256||!Array.isArray(finance.entries)||finance.entries.length>1000)fail("COHORT_SCOPE");
 const records=new Map<string,RecordingCohortManifestV1["recordings"][number]>(),versions=new Set<string>();
 for(const item of manifest.recordings){
  if(!shape(item,["caseId","subjectVersionSha256","stratum"])||!UUID.test(item.caseId)||!SHA.test(item.subjectVersionSha256)||
   !text(item.stratum,100)||records.has(item.caseId)||versions.has(item.subjectVersionSha256))fail("COHORT_MEMBERSHIP");
  records.set(item.caseId,item);versions.add(item.subjectVersionSha256);
 }
 const safeUnits=(n:unknown)=>n===null||typeof n==="number"&&Number.isSafeInteger(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER/1000;
 const fin=new Map<string,CohortFinanceV1["entries"][number]>();
 for(const row of finance.entries){
  if(!shape(row,["caseId","jobIds","inferenceMicrousd","allInMicrousd","humanReviewMinutes","reconciliationRef"])||
   !records.has(row.caseId)||fin.has(row.caseId)||!Array.isArray(row.jobIds)||
   row.jobIds.some(id=>!UUID.test(id))||new Set(row.jobIds).size!==row.jobIds.length||
   !safeUnits(row.inferenceMicrousd)||!safeUnits(row.allInMicrousd)||!safeUnits(row.humanReviewMinutes)||
   row.inferenceMicrousd!==null&&row.allInMicrousd!==null&&row.allInMicrousd<row.inferenceMicrousd||
   !text(row.reconciliationRef,500))fail("COHORT_FINANCE");
  fin.set(row.caseId,row);
 }
 const blank=()=>({frozen:0,attempted:0,notAttempted:0,excluded:0,reviewed:0,acceptedCorrect:0,acceptedIncorrect:0,
  acceptedUnreviewable:0,acceptedUnreviewed:0,unresolved:0,unreviewable:0,fieldCorrect:0,fieldIncorrect:0,fieldUnresolved:0,fieldUnreviewable:0});
 const total=blank(),strata=new Map<string,ReturnType<typeof blank>>(),seenCases=new Set<string>(),seenJobs=new Set<string>();
 let inference=0,allIn=0,human=0,inferenceUnknown=0,allInUnknown=0,humanUnknown=0;
 for(const row of outcomes){
  if(!shape(row,["caseId","subjectVersionSha256","disposition","jobIds","resolutionSubmitted",
   ...(row?.review===undefined?[]:["review"]),...(row?.exclusionReason===undefined?[]:["exclusionReason"])])||
   !records.has(row.caseId)||seenCases.has(row.caseId)||records.get(row.caseId)!.subjectVersionSha256!==row.subjectVersionSha256||
   !["attempted","not_attempted","excluded"].includes(row.disposition)||typeof row.resolutionSubmitted!=="boolean"||
   !Array.isArray(row.jobIds)||row.jobIds.length>100||row.jobIds.some(id=>!UUID.test(id)||seenJobs.has(id))||
   new Set(row.jobIds).size!==row.jobIds.length)fail("COHORT_OUTCOME");
  const attempted=row.disposition==="attempted";
  if(attempted!==!!row.jobIds.length||!attempted&&(row.resolutionSubmitted||row.review!==undefined)||
   (row.disposition==="excluded"? !text(row.exclusionReason,500):row.exclusionReason!==undefined))fail("COHORT_DISPOSITION");
  seenCases.add(row.caseId);for(const job of row.jobIds)seenJobs.add(job);
  const f=fin.get(row.caseId);
  if(f&&JSON.stringify([...f.jobIds].sort())!==JSON.stringify([...row.jobIds].sort())||
   !attempted&&f&&(f.inferenceMicrousd!==null&&f.inferenceMicrousd!==0))fail("COHORT_FINANCE_SCOPE");
  const stratum=records.get(row.caseId)!.stratum,sub=strata.get(stratum)??blank();strata.set(stratum,sub);
  const inc=(key:keyof ReturnType<typeof blank>,n=1)=>{total[key]+=n;sub[key]+=n;};
  inc("frozen");inc(attempted?"attempted":row.disposition==="excluded"?"excluded":"notAttempted");
  if(attempted){
   if(f?.inferenceMicrousd==null)inferenceUnknown++;else inference+=f.inferenceMicrousd;
   if(f?.allInMicrousd==null)allInUnknown++;else allIn+=f.allInMicrousd;
  }else if(f){if(f.allInMicrousd==null)allInUnknown++;else allIn+=f.allInMicrousd;}
  if(f?.humanReviewMinutes==null){if(attempted||row.review!==undefined)humanUnknown++;}else human+=f.humanReviewMinutes;
  if(!attempted)continue;
  if(!row.review){inc(row.resolutionSubmitted?"acceptedUnreviewed":"unresolved");continue;}
  const review=row.review;
  if(!shape(review,["identity","history","reviewText","reviewSha256"])||
   review.identity.caseId!==row.caseId||review.identity.workspaceId!==manifest.workspaceId||
   !Array.isArray(review.history)||review.history.some(p=>!Number.isFinite(Date.parse(p.recordedAt))||Date.parse(p.recordedAt)<frozenAt))fail("COHORT_REVIEW_SCOPE");
  const score=adjudicateRecordingFieldsV1({...review,subjectVersionSha256:row.subjectVersionSha256,rubricSha256:manifest.rubricSha256,now});
  inc("reviewed");inc("fieldCorrect",score.correct);inc("fieldIncorrect",score.incorrect);
  inc("fieldUnresolved",score.unresolved);inc("fieldUnreviewable",score.unreviewable);
  if(row.resolutionSubmitted){
   if(score.recordingFullyCorrect)inc("acceptedCorrect");
   else if(score.incorrect)inc("acceptedIncorrect");
   else inc("acceptedUnreviewable");
  }else{inc(score.unreviewable?"unreviewable":"unresolved");}
 }
 const accepted=total.acceptedCorrect+total.acceptedIncorrect+total.acceptedUnreviewable+total.acceptedUnreviewed;
 const reviewedAccepted=total.acceptedCorrect+total.acceptedIncorrect;
 const precision=reviewedAccepted?total.acceptedCorrect/reviewedAccepted:null;
 const averageInferenceMicrousd=total.attempted&&!inferenceUnknown?inference/total.attempted:null;
 const allReviewed=total.attempted>0&&total.reviewed===total.attempted;
 const incompleteAccepted=total.acceptedUnreviewable+total.acceptedUnreviewed;
 const complete=total.attempted===1000&&allReviewed&&!incompleteAccepted&&!inferenceUnknown&&!allInUnknown&&!humanUnknown;
 return Object.freeze({contract:"mizizi.recording_cohort_score.v1" as const,manifestSha256,financeSha256,
  rubricSha256:manifest.rubricSha256,counts:Object.freeze(total),strata:Object.freeze([...strata].sort(([a],[b])=>a.localeCompare(b)).map(([stratum,counts])=>Object.freeze({stratum,...counts}))),
  accepted,reviewedAccepted,precision,coverage:accepted/1000,correctCoverage:total.acceptedCorrect/1000,
  averageInferenceMicrousd,knownInferenceMicrousd:inference,knownAllInMicrousd:allIn,knownHumanReviewMinutes:human,
  inferenceUnknown,allInUnknown,humanUnknown,costPerConfirmedCorrectMicrousd:total.acceptedCorrect&&!allInUnknown?allIn/total.acceptedCorrect:null,
  complete,precisionTargetMet:complete&&precision!==null&&precision>=.99,
  inferenceTargetMet:complete&&averageInferenceMicrousd!==null&&averageInferenceMicrousd<=1000});
}

/** Prepare the private review surface from verified journal bytes. The
 * evaluator selects a finding and exact evidence span; no field is assigned,
 * judged, signed, or accepted by the investigator or by this helper.
 */
export function prepareRecordingFieldReviewV1(input:Readonly<{
 identity:InvestigationIdentityV1;history:readonly InvestigationPassV1[];
 subjectVersionSha256:string;rubricSha256:string;
}>){
 const {identity,history}=input;
 if(!UUID.test(identity.caseId)||!UUID.test(identity.workspaceId)||!SHA.test(input.subjectVersionSha256)||
  !SHA.test(input.rubricSha256)||!Array.isArray(history)||history.length>100)fail("PREPARATION_SCOPE");
 verifyInvestigationHistoryV1(identity,history);
 const candidates=history.flatMap(pass=>pass.findings.map((claim,claimIndex)=>{
  const evidence=claim.sourceIds.map(id=>{
   const source=pass.sourceReceipts.find(s=>s.sourceId===id);
   if(!source||source.modelDisclosed!==true||!source.excerpt.length)fail("PREPARATION_CITATION");
   return {citation:source.citation,excerpt:source.excerpt,binding:{sourceId:source.sourceId,
    payloadFingerprint:source.payloadFingerprint,lineageKey:source.lineageKey,excerptSha256:hash(source.excerpt),
    spanStart:0,spanLength:source.excerpt.length,spanSha256:hash(source.excerpt)}};
  });
  const consultations=claim.consultationIds?.map(id=>{
   const c=pass.deskConsultationReceipts?.find(r=>r.receiptId===id);
   const dep=pass.deskToolReceipts?.find(r=>r.receiptId===id);
   if(!c||!dep||!SHA.test(dep.callSha256)||!SHA.test(dep.resultSha256))fail("PREPARATION_CONSULTATION");
   return {...c,callSha256:dep.callSha256,resultSha256:dep.resultSha256};
  });
  return {finding:{passFingerprint:pass.fingerprint,claimIndex,statementSha256:hash(claim.statement)},
   statement:claim.statement,interpretation:claim.interpretation,evidence,
   ...(consultations?.length?{fieldKey:claim.fieldKey,reviewedConsultations:consultations,independentObservations:[],
    independentObservationRequired:true}: {})};
 }));
 return {contract:"mizizi.recording_field_review_preparation.v1" as const,caseId:identity.caseId,workspaceId:identity.workspaceId,
  subjectVersionSha256:input.subjectVersionSha256,rubricSha256:input.rubricSha256,lastFingerprint:history.at(-1)?.fingerprint??null,
  fields:RECORDING_RESEARCH_FIELDS_V1.map(field=>({field,disposition:null})),candidates};
}

/** Separately run evaluator executable. Never invoked by the research
 * runner; no credentials, network or model. The caller supplies independently
 * authorized private journal export and independently reviewed packet digests.
 * This verifies the review binding, not the reviewer's identity or the
 * continued legal right to retain the exported bytes.
 */
export async function runPrivateFieldAdjudicationV1(args:readonly string[]){
 const prepare=args[0]==="--prepare";
 const [journalPath,journalSha256,reviewPath,reviewSha256,outputPath]=prepare?[args[1],args[2],undefined,undefined,args[3]]:args;
 if(prepare?(args.length!==4||!SHA.test(journalSha256??"")||!journalPath||!outputPath):
  (args.length!==5||![journalSha256,reviewSha256].every(x=>SHA.test(x??""))||
  ![journalPath,reviewPath,outputPath].every(x=>typeof x==="string"&&x.length>0)))fail("CLI_ARGS");
 const exactPrivate=async(path:string,digest:string,max:number)=>{
  const file=await lstat(path),parent=await lstat(dirname(resolve(path)));
  if(!file.isFile()||!parent.isDirectory()||(file.mode&0o077)!==0||(parent.mode&0o077)!==0||file.size<2||file.size>max)
   fail("PRIVATE_INPUT");
  const bytes=await readFile(path);
  if(createHash("sha256").update(bytes).digest("hex")!==digest)fail("FILE_DIGEST");
  const raw=bytes.toString("utf8");if(!Buffer.from(raw,"utf8").equals(bytes))fail("FILE_ENCODING");
  return raw;
 };
 const raw=await exactPrivate(journalPath!,journalSha256!,4_000_000);
 const journal=JSON.parse(raw);
 if(!shape(journal,["contract","identity","subjectVersionSha256","rubricSha256","history"])||
  journal.contract!=="mizizi.private_recording_journal_export.v1"||!Array.isArray(journal.history)||journal.history.length>100)
  fail("JOURNAL_EXPORT");
 const input={identity:journal.identity,history:journal.history,
  subjectVersionSha256:journal.subjectVersionSha256,rubricSha256:journal.rubricSha256};
 const result=prepare?prepareRecordingFieldReviewV1(input):adjudicateRecordingFieldsV1({...input,
  reviewText:await exactPrivate(reviewPath!,reviewSha256!,128000),reviewSha256:reviewSha256!});
 const parent=await lstat(dirname(resolve(outputPath!)));
 if(!parent.isDirectory()||(parent.mode&0o077)!==0)fail("PRIVATE_OUTPUT");
 const output=await open(outputPath!,"wx",0o600);
 try{await output.writeFile(JSON.stringify(result)+"\n");await output.sync();}finally{await output.close();}
 if(result.contract==="mizizi.recording_field_review_preparation.v1")
  return {contract:result.contract,candidates:result.candidates.length,fields:result.fields.length};
 return {contract:result.contract,correct:result.correct,incorrect:result.incorrect,unresolved:result.unresolved,unreviewable:result.unreviewable};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 runPrivateFieldAdjudicationV1(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result))).catch(error=>{
  const message=error instanceof Error?error.message:"";
  console.error(/^MIZIZI_FIELD_REVIEW_[A-Z_]+$/.test(message)?message:"MIZIZI_FIELD_REVIEW_UNCONFIRMED");
  process.exitCode=1;
 });
}
