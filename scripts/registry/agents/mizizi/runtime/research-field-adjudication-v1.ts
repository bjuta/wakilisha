/** Independent, post-investigation scoring. This module never imports a model,
 * provider, credential, database or worker. The private evaluator supplies
 * exact reviewed field decisions and evidence spans after research; neither
 * the answers nor the review packet belongs in a model request.
 */
import {createHash} from "node:crypto";
import {verifyInvestigationHistoryV1,type InvestigationIdentityV1,type InvestigationPassV1} from "./adaptive-investigation-v1.ts";
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const RECORDING_RESEARCH_FIELDS_V1=["subject_version","release_date","performer","composition_credits","recording_production","label_distribution"] as const;
type Field=typeof RECORDING_RESEARCH_FIELDS_V1[number];
type ReviewEvidence=Readonly<{sourceId:string;payloadFingerprint:string;lineageKey:string;excerptSha256:string;spanStart:number;spanLength:number;spanSha256:string}>;
type FieldReview=Readonly<{field:Field;disposition:"correct"|"incorrect"|"unresolved"|"unreviewable";reviewRef:string;
 finding?:Readonly<{passFingerprint:string;claimIndex:number;statementSha256:string}>;
 evidence:readonly ReviewEvidence[];rationale:string}>;
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
  if(!shape(f,["field","disposition","reviewRef","evidence","rationale",...(f?.finding!==undefined?["finding"]:[])])||
   !RECORDING_RESEARCH_FIELDS_V1.includes(f.field)||byField.has(f.field)||
   !["correct","incorrect","unresolved","unreviewable"].includes(f.disposition)||!text(f.reviewRef,500)||!text(f.rationale)||
   !Array.isArray(f.evidence)||f.evidence.length>20)fail("FIELD");
  const accepted=f.disposition==="correct"||f.disposition==="incorrect";
  if(accepted&&(!f.finding||!f.evidence.length)||!accepted&&f.finding!==undefined)fail("CLAIM_REQUIRED");
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
  byField.set(f.field,Object.freeze({...f,evidence:Object.freeze([...f.evidence])}));
 }
 const fields=RECORDING_RESEARCH_FIELDS_V1.map(field=>byField.get(field)!);
 const correct=fields.filter(f=>f.disposition==="correct").length,incorrect=fields.filter(f=>f.disposition==="incorrect").length;
 const unresolved=fields.filter(f=>f.disposition==="unresolved").length,unreviewable=fields.filter(f=>f.disposition==="unreviewable").length;
 return Object.freeze({contract:"mizizi.recording_field_score.v1" as const,caseId:identity.caseId,workspaceId:identity.workspaceId,
  subjectVersionSha256:input.subjectVersionSha256,rubricSha256:input.rubricSha256,lastFingerprint:last,reviewSha256:input.reviewSha256,
  fields:Object.freeze(fields.map(f=>Object.freeze({field:f.field,disposition:f.disposition,reviewRef:f.reviewRef,
   reviewedLineages:new Set(f.evidence.map(e=>e.lineageKey)).size}))),
  correct,incorrect,unresolved,unreviewable,precision:correct+incorrect?correct/(correct+incorrect):null,
  reviewedCoverage:(correct+incorrect)/fields.length,recordingFullyCorrect:correct===fields.length,
  journalCostUnits:history.reduce((sum,p)=>{if(!Number.isSafeInteger(p.costUnits)||p.costUnits<0)fail("COST");return sum+p.costUnits;},0)});
}
