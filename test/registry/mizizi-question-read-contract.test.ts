import {describe,it,expect} from "vitest";
import {projectMiziziQuestionReadV1,MIZIZI_QUESTION_READ_V1} from "../../src/services/miziziQuestionRead";
const wid="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",cid="bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const qid="cccccccc-cccc-4ccc-8ccc-cccccccccccc",sid="dddddddd-dddd-4ddd-bddd-dddddddddddd";
const assertion="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ha="11111111-1111-4111-8111-111111111111",hb="22222222-2222-4222-8222-222222222222";
const receipt="33333333-3333-4333-8333-333333333333";
const hash="a".repeat(64),scope={workspaceId:wid,caseId:cid,caseRevision:7};
const question={
  questionId:qid,questionRevision:2,caseId:cid,caseRevision:7,
  question:"Which interpretation is supported by independently verified recorded evidence?",
  hypotheses:[{id:ha,label:"One recorded performance"},{id:hb,label:"Two distinct performances"}],
  sources:[{sourceId:sid,assertionId:assertion,assertionFingerprint:hash,
    familyKey:"catalogue:v1",familyVerified:true,useBasis:"documented_contract",
    disclosure:"internal_authorized"}],
  assessments:[{sourceId:sid,hypothesisId:ha,consistency:"C",
    assessedFingerprint:hash,humanReviewReceiptId:receipt,reviewedAt:"2026-10-17T13:00:00Z"}],
};
const ready=(questions:unknown[]=[question])=>({
  kind:"ready",contract:MIZIZI_QUESTION_READ_V1,workspaceId:wid,caseId:cid,caseRevision:7,questions
});
const mutated=(patch:Record<string,unknown>)=>ready([{...question,...patch}]);
describe("MIZIZI read-only question contract (no authorization grant)",()=>{
  it("accepts only a versioned same-case dossier and literal reviewed assessment",()=>{
    const result=projectMiziziQuestionReadV1(scope,ready());
    expect(result.kind).toBe("ready");
    if(result.kind!=="ready")throw new Error("Unexpected fixture state");
    expect(result.questions[0].assessments[0]).toMatchObject({consistency:"C",humanReviewReceiptId:receipt});
    expect(Object.isFrozen(result.questions[0].sources)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("publicationAuthority");
  });
  it("distinguishes not recorded, denied, stale and server unavailable",()=>{
    for(const kind of ["not_recorded","denied","stale","unavailable"])
      expect(projectMiziziQuestionReadV1(scope,{kind})).toEqual({kind});
    expect(()=>projectMiziziQuestionReadV1(scope,ready([]))).toThrow();
  });
  it("denies cross-workspace data, stale case revision and unknown fields",()=>{
    expect(()=>projectMiziziQuestionReadV1(scope,{...ready(),workspaceId:assertion})).toThrow();
    expect(()=>projectMiziziQuestionReadV1(scope,{...ready(),caseRevision:8})).toThrow();
    expect(()=>projectMiziziQuestionReadV1(scope,mutated({caseId:assertion}))).toThrow();
    expect(()=>projectMiziziQuestionReadV1(scope,mutated({caseRevision:8}))).toThrow();
    expect(()=>projectMiziziQuestionReadV1(scope,mutated({winner:"hypothesisA"}))).toThrow();
  });
  it("requires competing, distinct hypotheses and distinct question IDs",()=>{
    expect(()=>projectMiziziQuestionReadV1(scope,mutated({hypotheses:[question.hypotheses[0]]}))).toThrow();
    expect(()=>projectMiziziQuestionReadV1(scope,mutated({hypotheses:[question.hypotheses[0],question.hypotheses[0]]}))).toThrow();
    expect(()=>projectMiziziQuestionReadV1(scope,ready([question,question]))).toThrow();
  });
  it("never creates a grade from an independence hint or withheld source",()=>{
    for(const changed of [{familyVerified:false},{disclosure:"withheld"},{useBasis:null}])
      expect(()=>projectMiziziQuestionReadV1(scope,mutated({
        sources:[{...question.sources[0],...changed}],
      }))).toThrow();
    const ungraded=projectMiziziQuestionReadV1(scope,mutated({
      sources:[{...question.sources[0],familyVerified:false,useBasis:null,disclosure:"withheld"}],
      assessments:[],
    }));
    expect(ungraded.kind).toBe("ready");
    if(ungraded.kind==="ready")expect(ungraded.questions[0].assessments).toEqual([]);
  });
  it("rejects unsupported assessment, missing human receipt, wrong source hash and duplicate cells",()=>{
    for(const changed of [
      {consistency:"approved"},{humanReviewReceiptId:"invalid"},
      {assessedFingerprint:"b".repeat(64)},{sourceId:assertion},{hypothesisId:assertion},
    ])expect(()=>projectMiziziQuestionReadV1(scope,mutated({
      assessments:[{...question.assessments[0],...changed}],
    }))).toThrow();
    expect(()=>projectMiziziQuestionReadV1(scope,mutated({
      assessments:[question.assessments[0],question.assessments[0]],
    }))).toThrow();
  });
});
