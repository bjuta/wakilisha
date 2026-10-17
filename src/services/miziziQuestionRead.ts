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
