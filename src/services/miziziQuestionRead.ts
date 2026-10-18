/**
 * MIZIZI v4 future authenticated question reader projection, issue #1247.
 * Shape validation is NOT authority. Only a reviewed server-side RPC may
 * establish workspace membership, independent sources, use/consent and review.
 * No RPC or browser read of mizizi_private is wired to this module.
 */
export const MIZIZI_QUESTION_READ_V1 = "mizizi.question_read.v1" as const;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const GRADES=new Set(["CC","C","N","I","II"]);
const USE=new Set(["first_party","documented_consent","documented_contract","open_license"]);
const object=(x:unknown):Record<string,unknown>=>{
  if(!x||typeof x!=="object"||Array.isArray(x))throw new TypeError("MZ_Q_OBJECT");
  return x as Record<string,unknown>;
};
const exact=(o:Record<string,unknown>,keys:string[])=>{
  if(Object.keys(o).sort().join("|")!==keys.sort().join("|"))throw new TypeError("MZ_Q_SHAPE");
};
const uuid=(x:unknown):string=>{
  if(typeof x!=="string"||!UUID.test(x))throw new TypeError("MZ_Q_UUID");
  return x.toLowerCase();
};
const sha=(x:unknown):string=>{
  if(typeof x!=="string"||!SHA.test(x))throw new TypeError("MZ_Q_SHA");
  return x;
};
const revision=(x:unknown):number=>{
  if(!Number.isSafeInteger(x)||Number(x)<1)throw new TypeError("MZ_Q_REVISION");
  return Number(x);
};
const label=(x:unknown,min:number,max:number):string=>{
  if(typeof x!=="string"||x!==x.trim()||x.length<min||x.length>max||/[\x00-\x1f\x7f]/.test(x))
    throw new TypeError("MZ_Q_TEXT");
  return x;
};
const distinct=<T>(xs:readonly T[],key:(v:T)=>string)=>{
  const s=new Set<string>();
  for(const x of xs){const k=key(x);if(s.has(k))throw new TypeError("MZ_Q_DUPLICATE");s.add(k);}
};
export type QuestionReadScopeV1=Readonly<{workspaceId:string;caseId:string;caseRevision:number}>;
export type QuestionSourceV1=Readonly<{
  sourceId:string;assertionId:string;assertionFingerprint:string;
  familyKey:string;familyVerified:boolean;
  useBasis:"first_party"|"documented_consent"|"documented_contract"|"open_license"|null;
  disclosure:"internal_authorized"|"withheld";
}>;
export type QuestionHypothesisV1=Readonly<{id:string;label:string}>;
export type QuestionAssessmentV1=Readonly<{
  sourceId:string;hypothesisId:string;consistency:"CC"|"C"|"N"|"I"|"II";
  assessedFingerprint:string;humanReviewReceiptId:string;reviewedAt:string;
}>;
export type QuestionDossierV1=Readonly<{
  questionId:string;questionRevision:number;caseId:string;caseRevision:number;
  question:string;hypotheses:readonly QuestionHypothesisV1[];
  sources:readonly QuestionSourceV1[];assessments:readonly QuestionAssessmentV1[];
}>;
export type QuestionReadV1=
  | Readonly<{kind:"ready";questions:readonly QuestionDossierV1[]}>
  | Readonly<{kind:"not_recorded"|"denied"|"stale"|"unavailable"}>;

export function projectMiziziQuestionReadV1(scope:QuestionReadScopeV1,raw:unknown):QuestionReadV1 {
  const workspaceId=uuid(scope.workspaceId),caseId=uuid(scope.caseId);
  const caseRevision=revision(scope.caseRevision),root=object(raw);
  if(root.kind!=="ready"){
    exact(root,["kind"]);
    if(!["not_recorded","denied","stale","unavailable"].includes(String(root.kind)))
      throw new TypeError("MZ_Q_STATE");
    return Object.freeze({kind:root.kind}) as QuestionReadV1;
  }
  exact(root,["kind","contract","workspaceId","caseId","caseRevision","questions"]);
  if(root.contract!==MIZIZI_QUESTION_READ_V1||uuid(root.workspaceId)!==workspaceId||
    uuid(root.caseId)!==caseId||revision(root.caseRevision)!==caseRevision)
    throw new TypeError("MZ_Q_SCOPE");
  if(!Array.isArray(root.questions)||root.questions.length<1||root.questions.length>100)
    throw new TypeError("MZ_Q_COLLECTION");
  const questions=root.questions.map(rawQuestion=>{
    const q=object(rawQuestion);
    exact(q,["questionId","questionRevision","caseId","caseRevision","question","hypotheses","sources","assessments"]);
    const questionId=uuid(q.questionId),questionRevision=revision(q.questionRevision);
    if(uuid(q.caseId)!==caseId||revision(q.caseRevision)!==caseRevision)
      throw new TypeError("MZ_Q_CASE");
    const question=label(q.question,20,500);
    if(!Array.isArray(q.hypotheses)||q.hypotheses.length<2||q.hypotheses.length>12)
      throw new TypeError("MZ_Q_HYPOTHESES");
    const hypotheses=q.hypotheses.map(rawHyp=>{
      const h=object(rawHyp);exact(h,["id","label"]);
      return Object.freeze({id:uuid(h.id),label:label(h.label,3,200)});
    });
    distinct(hypotheses,h=>h.id);
    if(!Array.isArray(q.sources)||q.sources.length>100)throw new TypeError("MZ_Q_SOURCES");
    const sources=q.sources.map(rawSource=>{
      const s=object(rawSource);
      exact(s,["sourceId","assertionId","assertionFingerprint","familyKey","familyVerified","useBasis","disclosure"]);
      if(typeof s.familyVerified!=="boolean"||
         (s.useBasis!==null&&!USE.has(String(s.useBasis)))||
         !["internal_authorized","withheld"].includes(String(s.disclosure)))
        throw new TypeError("MZ_Q_SOURCE_POLICY");
      if(s.familyVerified&&s.useBasis===null)throw new TypeError("MZ_Q_SOURCE_USE");
      return Object.freeze({
        sourceId:uuid(s.sourceId),assertionId:uuid(s.assertionId),
        assertionFingerprint:sha(s.assertionFingerprint),
        familyKey:label(s.familyKey,3,200),familyVerified:s.familyVerified,
        useBasis:s.useBasis,disclosure:s.disclosure,
      }) as QuestionSourceV1;
    });
    distinct(sources,s=>s.sourceId);distinct(sources,s=>s.assertionId);
    if(!Array.isArray(q.assessments)||q.assessments.length>1200)
      throw new TypeError("MZ_Q_ASSESSMENTS");
    const sourceMap=new Map(sources.map(s=>[s.sourceId,s]));
    const hypothesisIds=new Set(hypotheses.map(h=>h.id));
    const assessments=q.assessments.map(rawAssessment=>{
      const a=object(rawAssessment);
      exact(a,["sourceId","hypothesisId","consistency","assessedFingerprint","humanReviewReceiptId","reviewedAt"]);
      const sourceId=uuid(a.sourceId),hypothesisId=uuid(a.hypothesisId);
      const s=sourceMap.get(sourceId);
      if(!s||!hypothesisIds.has(hypothesisId)||!GRADES.has(String(a.consistency)))
        throw new TypeError("MZ_Q_CELL_REFERENCE");
      if(!s.familyVerified||s.disclosure!=="internal_authorized"||
         s.useBasis===null||sha(a.assessedFingerprint)!==s.assertionFingerprint)
        throw new TypeError("MZ_Q_CELL_SOURCE");
      if(typeof a.reviewedAt!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(a.reviewedAt)||
         !Number.isFinite(Date.parse(a.reviewedAt)))
        throw new TypeError("MZ_Q_CELL_DATE");
      return Object.freeze({
        sourceId,hypothesisId,consistency:a.consistency,assessedFingerprint:s.assertionFingerprint,
        humanReviewReceiptId:uuid(a.humanReviewReceiptId),reviewedAt:a.reviewedAt,
      }) as QuestionAssessmentV1;
    });
    distinct(assessments,a=>a.sourceId+"|"+a.hypothesisId);
    return Object.freeze({questionId,questionRevision,caseId,caseRevision,question,
      hypotheses:Object.freeze(hypotheses),sources:Object.freeze(sources),
      assessments:Object.freeze(assessments)});
  });
  distinct(questions,q=>q.questionId);
  return Object.freeze({kind:"ready",questions:Object.freeze(questions)});
}


/**
 * Read-only bridge to the existing authenticated QV1 SQL projection.
 * Server RLS/capability checks, not this client parser, decide access.
 * A missing RPC, malformed response or network failure is unavailable,
 * never an empty or independently verified dossier.
 */
export type QuestionRpcV1 = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{data: unknown;error: {code?: string | null;message:string} | null}>;

export async function loadMiziziCaseQuestionsV1(
  scope:QuestionReadScopeV1,
  rpc?:QuestionRpcV1,
):Promise<QuestionReadV1> {
  try {
    const call:QuestionRpcV1=rpc ?? (async(name,args)=>{
      const {supabase}=await import("@/lib/supabase");
      const result=await supabase.rpc(name,args);
      return {data:result.data,error:result.error};
    });
    const {data,error}=await call("admin_mizizi_case_questions_v1",{
      p_case_id:scope.caseId,
      p_expected_case_revision:scope.caseRevision,
    });
    if(error){
      if(error.code==="42501")return {kind:"denied"};
      if(error.code==="PT409")return {kind:"stale"};
      return {kind:"unavailable"};
    }
    return projectMiziziQuestionReadV1(scope,data);
  }catch{
    return {kind:"unavailable"};
  }
}


/** QV2 steward-only append, authorized and serialized by the existing server RPC.
 * The same stable question and hypothesis IDs must be retained on ambiguous retry.
 * This client cannot issue Registry, ACH, publication, or rights authority.
 */
export type QuestionFreezeInputV1=Readonly<{
 questionId:string;expectedQuestionRevision:number;question:string;
 hypotheses:readonly Readonly<{id:string;label:string}>[];reason:string;
}>;
export type QuestionFreezeResultV1=
 | Readonly<{kind:"recorded";questionId:string;questionRevision:number;fingerprint:string;outcome:"created"|"revised"|"replayed"}>
 | Readonly<{kind:"denied"|"stale"|"unavailable"|"invalid"}>;

export async function freezeMiziziQuestionV1(
 scope:QuestionReadScopeV1,
 input:QuestionFreezeInputV1,
 rpc?:QuestionRpcV1,
):Promise<QuestionFreezeResultV1>{
 let caseId:string,questionId:string,questionText:string,reason:string;
 let hypotheses:{id:string;label:string}[];
 try {
  caseId=uuid(scope.caseId);
  revision(scope.caseRevision);uuid(scope.workspaceId);
  questionId=uuid(input.questionId);
  if(!Number.isSafeInteger(input.expectedQuestionRevision)||
     input.expectedQuestionRevision<0||input.expectedQuestionRevision>=20)
   throw new TypeError("Invalid expected question revision");
  questionText=label(input.question,20,500);
  reason=label(input.reason,12,1000);
  if(!Array.isArray(input.hypotheses)||input.hypotheses.length<2||
     input.hypotheses.length>12)throw new TypeError("Invalid hypothesis count");
  hypotheses=input.hypotheses.map(h=>({id:uuid(h.id),label:label(h.label,3,200)}));
  distinct(hypotheses,h=>h.id);
  distinct(hypotheses,h=>h.label.toLocaleLowerCase());
 }catch{return {kind:"invalid"};}
 try{
  const call:QuestionRpcV1=rpc??(async(name,args)=>{
   const {supabase}=await import("@/lib/supabase");
   const result=await supabase.rpc(name,args);
   return {data:result.data,error:result.error};
  });
  const {data,error}=await call("admin_mizizi_freeze_case_question_v1",{
   p_case_id:caseId,p_expected_case_revision:scope.caseRevision,
   p_question_id:questionId,
   p_expected_question_revision:input.expectedQuestionRevision,
   p_question_text:questionText,p_hypotheses:hypotheses,p_reason:reason,
  });
  if(error){
   if(error.code==="42501")return {kind:"denied"};
   if(error.code==="PT409")return {kind:"stale"};
   return {kind:"unavailable"};
  }
  const result=object(data);
  exact(result,["questionId","questionRevision","caseId","caseRevision","questionFingerprint","outcome"]);
  if(uuid(result.questionId)!==questionId||uuid(result.caseId)!==caseId||
   revision(result.caseRevision)!==scope.caseRevision||
   revision(result.questionRevision)!==input.expectedQuestionRevision+1||
   !["created","revised","replayed"].includes(String(result.outcome)))
   return {kind:"unavailable"};
  return {kind:"recorded",questionId,
   questionRevision:input.expectedQuestionRevision+1,
   fingerprint:sha(result.questionFingerprint),
   outcome:result.outcome as "created"|"revised"|"replayed"};
 }catch{return {kind:"unavailable"};}
}

/** QV3 private metadata projection. Human family attestation is never
 * independently verified evidence or a permission to grade an ACH cell.
 */
export type QuestionAttestationReadV1=
 | Readonly<{kind:"not_recorded"|"denied"|"stale"|"unavailable"}>
 | Readonly<{kind:"requires_review";rows:readonly Readonly<{
    attestationId:string;assertionId:string;sourceVersionId:string;
    sourceFamilyKey:string;reviewRevision:number;
    decision:"human_reviewed"|"unavailable_or_revoked";
    receiptFingerprint:string;
   }>[];independentlyVerifiedFamilies:0;achAssessmentsAllowed:0}>;

export async function loadMiziziSourceAttestationsV1(
 scope:QuestionReadScopeV1,questionId:string,questionRevision:number,
 rpc?:QuestionRpcV1,
):Promise<QuestionAttestationReadV1>{
 let id:string;
 try{uuid(scope.workspaceId);uuid(scope.caseId);revision(scope.caseRevision);
  id=uuid(questionId);revision(questionRevision);}
 catch{return {kind:"unavailable"};}
 try {
  const call:QuestionRpcV1=rpc??(async(name,args)=>{
   const {supabase}=await import("@/lib/supabase");
   const result=await supabase.rpc(name,args);
   return {data:result.data,error:result.error};
  });
  const {data,error}=await call("admin_mizizi_question_source_attestations_v1",{
   p_case_id:scope.caseId,p_expected_case_revision:scope.caseRevision,
   p_question_id:id,p_question_revision:questionRevision,
  });
  if(error){
   if(error.code==="42501")return {kind:"denied"};
   if(error.code==="PT409")return {kind:"stale"};
   return {kind:"unavailable"};
  }
  const record=object(data);
  exact(record,["contract","kind","caseId","caseRevision","questionId","questionRevision","rows","independentlyVerifiedFamilies","achAssessmentsAllowed"]);
  if(record.contract!=="mizizi.source_attestation_read.v1"||
    uuid(record.caseId)!==uuid(scope.caseId)||
    revision(record.caseRevision)!==scope.caseRevision||
    uuid(record.questionId)!==id||
    revision(record.questionRevision)!==questionRevision||
    record.independentlyVerifiedFamilies!==0||record.achAssessmentsAllowed!==0||
    !Array.isArray(record.rows)||record.rows.length>100)
   return {kind:"unavailable"};
  const rows=record.rows.map(raw=>{
   const row=object(raw);
   exact(row,["attestationId","assertionId","sourceVersionId","sourceFamilyKey","reviewRevision","decision","receiptFingerprint"]);
   if(!["human_reviewed","unavailable_or_revoked"].includes(String(row.decision)))
    throw new TypeError("Unknown source status");
   return Object.freeze({
    attestationId:uuid(row.attestationId),assertionId:uuid(row.assertionId),
    sourceVersionId:uuid(row.sourceVersionId),sourceFamilyKey:label(row.sourceFamilyKey,8,140),
    reviewRevision:revision(row.reviewRevision),
    decision:row.decision as "human_reviewed"|"unavailable_or_revoked",
    receiptFingerprint:sha(row.receiptFingerprint),
   });
  });
  distinct(rows,r=>r.assertionId);
  if(record.kind==="not_recorded"&&rows.length===0)return {kind:"not_recorded"};
  if(record.kind!=="requires_review"||rows.length===0)return {kind:"unavailable"};
  return {kind:"requires_review",rows:Object.freeze(rows),
   independentlyVerifiedFamilies:0,achAssessmentsAllowed:0};
 }catch{return {kind:"unavailable"};}
}
