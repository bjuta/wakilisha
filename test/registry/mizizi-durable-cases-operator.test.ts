import { readFileSync } from "node:fs";
import { buildRedactedHeadquartersAuditV1 } from "../../src/services/miziziRedactedAudit";
import { describe, it, expect, vi } from "vitest";
import {
 projectMiziziQuestionReadV1,loadMiziziCaseQuestionsV1,
 freezeMiziziQuestionV1,loadMiziziSourceAttestationsV1,
 MIZIZI_QUESTION_READ_V1,
} from "../../src/services/miziziQuestionRead";
import {
  beginMiziziCaseResearchV1,
  bootstrapHeadquartersOwnerV1,
  canOfferInternalWorkspaceSetupV1,
  loadDurableHeadquartersCasesV1,
  loadHeadquartersDashboardV1,
  loadHeadquartersCaseEventsV1,
  projectHeadquartersCaseEventsV1,
  loadHeadquartersHoldsV1,
  projectDurableCasesV1,
  projectHeadquartersCaseMachineReadV1,
  projectWorkspaceHoldsV1,
  releaseWorkspaceHoldV1,
  startWorkspaceHoldV1,
  type HeadquartersRpc,
} from "../../src/services/miziziDurableCases";

const workspaceId="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const caseId="bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const subjectId="cccccccc-cccc-4ccc-cccc-cccccccccccc";
const reviewId="dddddddd-dddd-4ddd-dddd-dddddddddddd";
const holdId="eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee";
const recorded={
 caseId,workspaceId,caseRevision:1,subjectType:"track",subjectId,
 claimFamily:"track_identity_metadata_review_v1",claimKey:"mizizi.track_slug_credit_evidence_gap.slug",
 state:"open",stage:"triage",riskClass:"high",reviewId,receiptCount:1,
 updatedAt:"2026-10-13T07:00:00Z",nextActionAt:null,
};
const hold={holdId,holdKey:"mizizi:workspace:hold:test",scopeKind:"workspace",status:"active",
 revision:1,reason:"Authenticated operator set a bounded Hold Writes",heldAt:"2026-10-13T07:00:00Z",releasedAt:null};
const rpcFixture=(data:unknown):HeadquartersRpc=>vi.fn(async()=>({data,error:null}));

describe("Authenticated durable Headquarters read and governed commands",()=>{
 it("renders the operator panel inside the accepted authenticated Headquarters route",()=>{
  const brief=readFileSync("src/pages/admin/review/mizizi/MiziziHeadquartersBrief.tsx","utf8");
  const panel=readFileSync("src/pages/admin/review/mizizi/MiziziDurableCasesPanel.tsx","utf8");
  expect(brief).toContain('<MiziziDurableCasesPanel queue={queue} onInspectReview={inspect} />');
  expect(brief.indexOf('<MiziziDurableCasesPanel queue={queue}')).toBeLessThan(brief.indexOf('<div className="mz-brief-shell">'));
  expect(panel).toContain('data-wk-mizizi-investigation-first');
  expect(panel).toContain('aria-label="Recorded case status and research limits"');
  expect(panel).toContain('Questions decided</dt><dd>Not recorded');
  expect(panel).toContain('Runtime status unavailable');
  expect(panel).toContain('aria-label="Case reading views"');
  for (const name of ["Questions","Evidence","Next evidence","History"])
    expect(panel).toContain(`"${name}"`);
  expect(panel).toContain('No recorded evidence requests available.');
  expect(panel).toContain('No independently reviewed question set is connected to this case yet.');
  expect(panel).toContain('Linked review lead');
  expect(panel).not.toContain('8 sources · 3 private');
  expect(panel).toContain('loadHeadquartersCaseEventsV1(focusedCase.caseId)');
  expect(panel).toContain('No automatic Registry correction');
  expect(panel).toContain('data-wk-mizizi-durable-cases');
  expect(panel).toContain('Immutable case event timeline');
 });
 it("reads actual DB02 cases rather than projecting Registry review counts as cases",async()=>{
  const rpc=rpcFixture([recorded]);
  const cases=await loadDurableHeadquartersCasesV1(rpc);
  expect(cases).toHaveLength(1);
  expect(cases[0]).toMatchObject({caseId,workspaceId,reviewId,receiptCount:1,stage:"triage"});
  expect(rpc).toHaveBeenCalledWith("admin_mizizi_cases_v1",{
   p_limit:100,p_before_updated_at:null,p_before_case_id:null,
  });
 });
 it("paginates a live case ledger without inventing additional cases",async()=>{
  const full=Array.from({length:100},(_,i)=>({...recorded,
    caseId:`${String(i).padStart(8,"0")}-bbbb-4bbb-bbbb-bbbbbbbbbbbb`,
    updatedAt:new Date(Date.parse(recorded.updatedAt)-i*1000).toISOString(),
  }));
  const rpc=vi.fn(async (_name:string,args:Record<string,unknown>)=>{
    if(args.p_before_case_id===null)return {data:full,error:null};
    return {data:[{...recorded,caseId:"ffffffff-ffff-4fff-bfff-ffffffffffff",updatedAt:"2026-10-12T07:00:00Z"}],error:null};
  });
  const cases=await loadDurableHeadquartersCasesV1(rpc);
  expect(cases).toHaveLength(101);
  expect(rpc).toHaveBeenCalledTimes(2);
 });
 it("reads an immutable case journal, verifying event order and IDs",async()=>{
  const events=[{eventId:"ffffffff-ffff-4fff-bfff-ffffffffffff",revision:2,type:"case_state_changed",
    previousState:"open",state:"in_progress",previousStage:"triage",stage:"research",
    reason:"Approved bounded research work has begun",actorKey:"user:"+subjectId,recordedAt:"2026-10-13T07:10:00Z"},
   {eventId:"11111111-1111-4111-8111-111111111111",revision:1,type:"case_created",
    previousState:null,state:"open",previousStage:null,stage:"triage",
    reason:"Source-bound review case was admitted",actorKey:"system:mizizi",recordedAt:"2026-10-13T07:00:00Z"}];
  const rpc=rpcFixture(events);
  const received=await loadHeadquartersCaseEventsV1(caseId,rpc);
  expect(received).toHaveLength(2);
  expect(received[0].stage).toBe("research");
  expect(rpc).toHaveBeenCalledWith("admin_mizizi_case_events_v1",{p_case_id:caseId,p_limit:100});
  expect(()=>projectHeadquartersCaseEventsV1([events[1],events[0]])).toThrow();
  expect(()=>projectHeadquartersCaseEventsV1([events[0],events[0]])).toThrow();
 });
 it("derives Human and Machine case inspection from the same authorized case projection",()=>{
  const caseRecord=projectDurableCasesV1([recorded])[0];
  const machine=projectHeadquartersCaseMachineReadV1(caseRecord);
  expect(machine).toMatchObject({
    schemaVersion:"wakilisha.mizizi.headquarters.case-read.v1",
    caseId,revision:1,subject:{type:"track",id:subjectId},
    claim:{family:recorded.claimFamily,key:recorded.claimKey},
    lifecycle:{state:"open",stage:"triage"},updatedAt:recorded.updatedAt,
    evidenceReferences:{linkedRegistryReviewId:reviewId,linkedReceiptCount:1},
    actionAuthority:"not_included_in_read_only_projection",
    publicationAuthority:"not_included_in_read_only_projection",
  });
  const panel=readFileSync("src/pages/admin/review/mizizi/MiziziDurableCasesPanel.tsx","utf8");
  expect(panel).toContain('state.kind === "ready" && focusedCase');
  expect(panel).toContain('JSON.stringify(projectHeadquartersCaseMachineReadV1(focusedCase), null, 2)');
  expect(panel).toContain('aria-pressed={recordView === "machine"}');
  expect(JSON.stringify(machine)).not.toContain("actorKey");
 });
 it("reports true zero case ledger rather than assuming one case per open review",()=>{
  expect(projectDurableCasesV1([])).toEqual([]);
 });
 it("fails closed on duplicate case, invented receipt count or unrelated UUID",()=>{
  expect(()=>projectDurableCasesV1([recorded,recorded])).toThrow();
  expect(()=>projectDurableCasesV1([{...recorded,receiptCount:-1}])).toThrow();
  expect(()=>projectDurableCasesV1([{...recorded,subjectId:"forged"}])).toThrow();
 });
 it("moves an exact triage revision through only the authorized case-stage command",async()=>{
  const rpc=rpcFixture({caseId,workspaceId,revision:2,state:"in_progress",stage:"research"});
  await expect(beginMiziziCaseResearchV1({caseId,expectedRevision:1,
   reason:"Request a bounded review of source evidence"},rpc)).resolves.toMatchObject({caseId,revision:2,stage:"research"});
  expect(rpc).toHaveBeenCalledWith("admin_mizizi_begin_case_research_v1",{
   p_case_id:caseId,p_expected_revision:1,p_reason:"Request a bounded review of source evidence",
  });
 });
 it("refuses to call the server for a short reason, invalid case or stale expected revision",async()=>{
  const rpc=rpcFixture({});
  for(const v of [{caseId,expectedRevision:1,reason:"no"},
   {caseId:"bad",expectedRevision:1,reason:"Sufficient operator reason"},
   {caseId,expectedRevision:0,reason:"Sufficient operator reason"}]){
   await expect(beginMiziziCaseResearchV1(v,rpc)).rejects.toThrow();
  }
  expect(rpc).not.toHaveBeenCalled();
 });
 it("does not accept an unverified or cross-case transition receipt",async()=>{
  const rpc=rpcFixture({caseId:subjectId,revision:2,stage:"research"});
  await expect(beginMiziziCaseResearchV1({caseId,expectedRevision:1,
   reason:"Request a bounded review of source evidence"},rpc)).rejects.toThrow(/receipt/);
 });
 it("reads only server-confirmed active holds with exact immutable identities",async()=>{
  const rpc=rpcFixture([hold]);
  expect((await loadHeadquartersHoldsV1(rpc))[0]).toMatchObject({holdId,scopeKind:"workspace",status:"active"});
  expect(()=>projectWorkspaceHoldsV1([{...hold,scopeKind:"unrecognized"}])).toThrow();
 });
 it("starts Hold Writes by reviewed workspace command, not by local UI state",async()=>{
  const rpc=rpcFixture({holdId,holdKey:"mizizi:workspace:hold:test",status:"active",revision:1});
  await expect(startWorkspaceHoldV1("Potentially unsafe Registry write request","mizizi:workspace:hold:test",rpc)).resolves.toBe(holdId);
  expect(rpc).toHaveBeenCalledWith("admin_mizizi_hold_workspace_writes_v1",{
   p_hold_key:"mizizi:workspace:hold:test",p_reason:"Potentially unsafe Registry write request",p_review_after:null,
  });
 });
 it("rejects a mismatched hold creation receipt",async()=>{
  const rpc=rpcFixture({holdId,holdKey:"other:hold:identity",status:"active",revision:1});
  await expect(startWorkspaceHoldV1("Potentially unsafe Registry write request","mizizi:workspace:hold:test",rpc)).rejects.toThrow(/receipt/);
 });
 it("requires a verified exact hold-release receipt with revision increment",async()=>{
  const rpc=rpcFixture({holdId,status:"released",revision:2});
  await expect(releaseWorkspaceHoldV1(hold as never,"Reviewed all queued work and confirmed a safe resumption",rpc)).resolves.toBeUndefined();
  expect(rpc).toHaveBeenCalledWith("admin_mizizi_release_workspace_hold_v1",{
   p_hold_id:holdId,p_expected_revision:1,p_reason:"Reviewed all queued work and confirmed a safe resumption",
  });
 });
 it("does not bootstrap from a malformed reason or accept a counterfeit membership ID",async()=>{
  const rpc=rpcFixture("not-a-uuid");
  await expect(bootstrapHeadquartersOwnerV1("too short",rpc)).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
  await expect(bootstrapHeadquartersOwnerV1("Administrator opening the internal workspace",rpc)).rejects.toThrow();
 });
 it("distinguishes explicit 42501 authorization denial from transport, malformed data and partial failures",async()=>{
   const permission:HeadquartersRpc=vi.fn(async()=>({
     data:null,error:{code:"42501",message:"permission denied"},
   }));
   await expect(loadHeadquartersDashboardV1(permission)).resolves.toEqual({kind:"denied"});

   const failedNetwork:HeadquartersRpc=vi.fn(async(name)=>{
     if(name==="admin_mizizi_list_workspace_holds_v1")
       throw new Error("offline");
     return {data:null,error:{code:"42501",message:"permission denied"}};
   });
   await expect(loadHeadquartersDashboardV1(failedNetwork)).resolves.toEqual({kind:"unavailable"});

   const missingCode:HeadquartersRpc=vi.fn(async()=>({
     data:null,error:{message:"42501 denied, but structured code missing"},
   }));
   await expect(loadHeadquartersDashboardV1(missingCode)).resolves.toEqual({kind:"unavailable"});

   const malformed:HeadquartersRpc=vi.fn(async(name)=>({
     data:name==="admin_mizizi_cases_v1"?[{...recorded,receiptCount:-1}]:[],
     error:null,
   }));
   await expect(loadHeadquartersDashboardV1(malformed)).resolves.toEqual({kind:"unavailable"});

   const working:HeadquartersRpc=vi.fn(async(name)=>({
     data:name==="admin_mizizi_cases_v1"?[recorded]:[],error:null,
   }));
   await expect(loadHeadquartersDashboardV1(working)).resolves.toMatchObject({
     kind:"ready",cases:[{caseId}],holds:[],
   });
 });
 it("does not hide denied Data API calls",async()=>{
  const rpc:HeadquartersRpc=vi.fn(async()=>({data:null,error:{message:"42501 denied"}}));
  await expect(loadDurableHeadquartersCasesV1(rpc)).rejects.toThrow(/42501/);
 });
 it("exports a complete authenticated journal and redacts source and actor details",async()=>{
  const event={eventId:"11111111-1111-4111-8111-111111111111",revision:1,type:"case_created",
    previousState:null,state:"open",previousStage:null,stage:"triage",
    reason:"PRIVATE_SOURCE: confidential reviewed evidence",actorKey:`user:${subjectId}`,
    recordedAt:"2026-10-13T07:00:00Z"};
  const rpc:HeadquartersRpc=vi.fn(async name=>({
    data:name==="admin_mizizi_cases_v1"?[{...recorded,claimKey:"PRIVATE_SOURCE: claim evidence"}]:
      name==="admin_mizizi_list_workspace_holds_v1"?[{...hold,reason:"PRIVATE_SOURCE: private hold"}]:
      name==="admin_mizizi_case_events_v1"?[event]:null,
    error:null,
  }));
  const raw=await buildRedactedHeadquartersAuditV1(rpc);
  const audit=JSON.parse(raw);
  expect(audit.caseCount).toBe(1);
  expect(audit.cases[0].events[0]).toMatchObject({revision:1,actorClass:"operator"});
  expect(audit.cases[0].linkedReceiptCount).toBe(1);
  expect(audit.holds).toHaveLength(1);
  expect(raw).not.toContain("PRIVATE_SOURCE");
  expect(raw).not.toContain(subjectId);
  expect(raw).not.toContain(reviewId);
  expect(raw).not.toContain(workspaceId);
  expect(raw).not.toContain(hold.holdKey);
  expect(rpc).toHaveBeenCalledTimes(5);
 });
 it("refuses a partial audit when a journal has missing revisions",async()=>{
  const rpc:HeadquartersRpc=vi.fn(async name=>({data:
    name==="admin_mizizi_cases_v1"?[{...recorded,caseRevision:2}]:
      name==="admin_mizizi_list_workspace_holds_v1"?[]:[],error:null}));
  await expect(buildRedactedHeadquartersAuditV1(rpc)).rejects.toThrow(/incomplete/);
 });
 it("refuses an audit when a case changes between reads",async()=>{
  let seen=0;
  const event={eventId:"11111111-1111-4111-8111-111111111111",revision:1,type:"case_created",
    previousState:null,state:"open",previousStage:null,stage:"triage",
    reason:"Source review initially recorded",actorKey:"system:mizizi",
    recordedAt:"2026-10-13T07:00:00Z"};
  const rpc:HeadquartersRpc=vi.fn(async name=>({data:
    name==="admin_mizizi_cases_v1"?[{...recorded,caseRevision:++seen}]:
      name==="admin_mizizi_list_workspace_holds_v1"?[]:[event],error:null}));
  await expect(buildRedactedHeadquartersAuditV1(rpc)).rejects.toThrow(/changed/);
 });
 it("does not export a possibly truncated hold ledger",async()=>{
  const holds=Array.from({length:100},(_,i)=>({...hold,holdId:
    `${String(i).padStart(8,"0")}-eeee-4eee-eeee-eeeeeeeeeeee`}));
  const rpc:HeadquartersRpc=vi.fn(async name=>({data:
    name==="admin_mizizi_cases_v1"?[]:holds,error:null}));
  await expect(buildRedactedHeadquartersAuditV1(rpc)).rejects.toThrow(/hold ledger/);
 });
 it("shows first-owner setup only with both fully loaded administrator capabilities",()=>{
  const permutations=[
    [true,true,true,false],
    [false,false,false,false],
    [false,true,false,false],
    [false,false,true,false],
    [false,true,true,true],
  ] as const;
  for(const [loading,registry,users,expected] of permutations)
    expect(canOfferInternalWorkspaceSetupV1(loading,registry,users)).toBe(expected);
  const panel=readFileSync("src/pages/admin/review/mizizi/MiziziDurableCasesPanel.tsx","utf8");
  expect(panel).toContain("const admin=useAdminUser()");
  expect(panel).toContain('admin.can("manage_registry"),admin.can("manage_users")');
  expect(panel).toContain("{canOfferSetup ? <>");
  expect(panel).toContain("Headquarters case access requires an authorized workspace membership.");
  expect(panel).toContain("error instanceof HeadquartersAuthorizationDeniedError");
 });
 it("keeps the redacted download behind an authorized case view",()=>{
  const panel=readFileSync("src/pages/admin/review/mizizi/MiziziDurableCasesPanel.tsx","utf8");
  expect(panel).toContain('state.kind==="ready" ? <WkButton');
  expect(panel).toContain("Export Redacted Audit");
  expect(panel).toContain("No file was exported.");
 });

});

// #1247: question projection proofs belong next to the existing DB02 case contract.
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

describe("MIZIZI connected frozen-question read in the existing Headquarters UI",()=>{
  it("uses the exact authenticated case-revision reader, never a Registry queue guess",async()=>{
    const rpc=vi.fn(async()=>({data:ready([{...question,sources:[],assessments:[]}]),error:null}));
    const result=await loadMiziziCaseQuestionsV1(scope,rpc);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("admin_mizizi_case_questions_v1",{
      p_case_id:caseId,p_expected_case_revision:7,
    });
    expect(result.kind).toBe("ready");
    if(result.kind!=="ready")throw new Error("Unexpected question result");
    expect(result.questions[0].hypotheses).toHaveLength(2);
    expect(result.questions[0].sources).toEqual([]);
    expect(result.questions[0].assessments).toEqual([]);
  });
  it("keeps zero questions genuinely unrecorded",async()=>{
    const rpc=vi.fn(async()=>({data:{kind:"not_recorded"},error:null}));
    await expect(loadMiziziCaseQuestionsV1(scope,rpc)).resolves.toEqual({kind:"not_recorded"});
  });
  it("does not turn stale, denied or missing RPC into no questions",async()=>{
    for(const [code,kind] of [
      ["PT409","stale"],["42501","denied"],["PGRST202","unavailable"],
    ] as const){
      const rpc=vi.fn(async()=>({data:null,error:{code,message:"Server rejected request"}}));
      await expect(loadMiziziCaseQuestionsV1(scope,rpc)).resolves.toEqual({kind});
    }
  });
  it("fails closed on wrong-workspace dossiers, forged grades and transport exceptions",async()=>{
    const wrong=vi.fn(async()=>({data:{...ready(),workspaceId:assertion},error:null}));
    await expect(loadMiziziCaseQuestionsV1(scope,wrong)).resolves.toEqual({kind:"unavailable"});
    const unproved=vi.fn(async()=>({data:mutated({
      sources:[{...question.sources[0],familyVerified:false}],
    }),error:null}));
    await expect(loadMiziziCaseQuestionsV1(scope,unproved)).resolves.toEqual({kind:"unavailable"});
    const offline=vi.fn(async()=>{throw new Error("Network unavailable");});
    await expect(loadMiziziCaseQuestionsV1(scope,offline)).resolves.toEqual({kind:"unavailable"});
  });
  it("renders only signed-in QV1 questions and still withholds fabricated verdicts",()=>{
    const panel=readFileSync("src/pages/admin/review/mizizi/MiziziDurableCasesPanel.tsx","utf8");
    expect(panel).toContain("loadMiziziCaseQuestionsV1({");
    expect(panel).toContain("workspaceId:record.workspaceId");
    expect(panel).toContain("caseRevision:record.caseRevision");
    expect(panel).toContain('aria-label="Frozen investigation questions"');
    expect(panel).toContain("No independently assessed source grades or findings are recorded by this reader.");
    expect(panel).toContain("No independently reviewed question set is connected to this case yet.");
    expect(panel).not.toContain("Pwani ya Upendo");
  });
});

describe("QV2 steward question freeze and QV3 current reviewed-source UI seam",()=>{
 const correct={
  questionId:qid,expectedQuestionRevision:0,
  question:"Which documented recording identity interpretation is best supported?",
  hypotheses:[{id:ha,label:"One distinct original performance"},
   {id:hb,label:"Two independently distinct performances"}],
  reason:"Review the competing explanations without inferring identity truth.",
 };
 const receipt={
  questionId:qid,questionRevision:1,caseId:cid,caseRevision:7,
  questionFingerprint:hash,outcome:"created",
 };
 it("submits exact QV2 revision and stable human-owned hypothesis IDs",async()=>{
  const rpc=vi.fn(async()=>({data:receipt,error:null}));
  const result=await freezeMiziziQuestionV1(scope,correct,rpc);
  expect(result).toMatchObject({kind:"recorded",outcome:"created",questionId:qid,questionRevision:1});
  expect(rpc).toHaveBeenCalledExactlyOnceWith("admin_mizizi_freeze_case_question_v1",{
   p_case_id:cid,p_expected_case_revision:7,
   p_question_id:qid,p_expected_question_revision:0,
   p_question_text:correct.question,p_hypotheses:correct.hypotheses,p_reason:correct.reason,
  });
 });
 it("preserves exact replay receipt, but rejects altered or wrong identity responses",async()=>{
  const replay=vi.fn(async()=>({data:{...receipt,outcome:"replayed"},error:null}));
  await expect(freezeMiziziQuestionV1(scope,correct,replay)).resolves.toMatchObject({
   kind:"recorded",outcome:"replayed",questionRevision:1,
  });
  const bad=vi.fn(async()=>({data:{...receipt,questionId:assertion},error:null}));
  await expect(freezeMiziziQuestionV1(scope,correct,bad)).resolves.toEqual({kind:"unavailable"});
 });
 it("refuses malformed drafts before any server write",async()=>{
  const rpc=vi.fn(async()=>({data:receipt,error:null}));
  for(const changed of [
   {question:"Too short"},
   {hypotheses:[correct.hypotheses[0],correct.hypotheses[0]]},
   {reason:"short"},
   {expectedQuestionRevision:-1},
   {questionId:"forged"},
  ]){
   await expect(freezeMiziziQuestionV1(scope,{...correct,...changed},rpc)).resolves.toEqual({kind:"invalid"});
  }
  expect(rpc).not.toHaveBeenCalled();
 });
 it("keeps denied, stale, missing RPC and broken transport distinct",async()=>{
  for(const [code,kind] of [
   ["42501","denied"],["PT409","stale"],["PGRST202","unavailable"],
  ] as const){
   const rpc=vi.fn(async()=>({data:null,error:{code,message:"Rejected"}}));
   await expect(freezeMiziziQuestionV1(scope,correct,rpc)).resolves.toEqual({kind});
  }
  const offline=vi.fn(async()=>{throw new Error("timeout");});
  await expect(freezeMiziziQuestionV1(scope,correct,offline)).resolves.toEqual({kind:"unavailable"});
 });
 const attestation={
  contract:"mizizi.source_attestation_read.v1",
  kind:"requires_review",caseId:cid,caseRevision:7,
  questionId:qid,questionRevision:2,
  rows:[{attestationId:receiptId(),assertionId:assertion,sourceVersionId:sid,
   sourceFamilyKey:"catalogue:first-party",reviewRevision:1,decision:"human_reviewed",
   receiptFingerprint:hash}],
  independentlyVerifiedFamilies:0,achAssessmentsAllowed:0,
 };
 function receiptId(){return "55555555-5555-4555-8555-555555555555";}
 it("reads only QV3 protected metadata, never invents independent verification",async()=>{
  const rpc=vi.fn(async()=>({data:attestation,error:null}));
  const result=await loadMiziziSourceAttestationsV1(scope,qid,2,rpc);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("admin_mizizi_question_source_attestations_v1",{
   p_case_id:cid,p_expected_case_revision:7,p_question_id:qid,p_question_revision:2,
  });
  expect(result).toMatchObject({kind:"requires_review",
   independentlyVerifiedFamilies:0,achAssessmentsAllowed:0});
  expect(JSON.stringify(result)).not.toContain("source_payload");
  const none=vi.fn(async()=>({data:{...attestation,kind:"not_recorded",rows:[]},error:null}));
  await expect(loadMiziziSourceAttestationsV1(scope,qid,2,none)).resolves.toEqual({kind:"not_recorded"});
 });
 it("fails closed on fabricated QV3 ACH permission, family count, scope, status or malformed receipt",async()=>{
  const candidates=[
   {...attestation,achAssessmentsAllowed:1},
   {...attestation,independentlyVerifiedFamilies:1},
   {...attestation,caseId:assertion},
   {...attestation,rows:[{...attestation.rows[0],decision:"independent_verified"}]},
   {...attestation,rows:[{...attestation.rows[0],receiptFingerprint:"not-a-hash"}]},
   {...attestation,rows:[attestation.rows[0],attestation.rows[0]]},
  ];
  for(const data of candidates){
   const rpc=vi.fn(async()=>({data,error:null}));
   await expect(loadMiziziSourceAttestationsV1(scope,qid,2,rpc)).resolves.toEqual({kind:"unavailable"});
  }
 });
 it("presents a usable question form, source receipt labels, and no implied permission override",()=>{
  const panel=readFileSync("src/pages/admin/review/mizizi/MiziziDurableCasesPanel.tsx","utf8");
  for(const label of [
   "Add an investigation question","Competing explanation",
   "Freeze question for review","Propose a revised question",
   "Recorded source reviews","No independent source families or ACH assessments have been verified.",
  ])expect(panel).toContain(label);
  expect(panel).toContain("freezeMiziziQuestionV1({");
  expect(panel).toContain("loadMiziziSourceAttestationsV1({");
  expect(panel).toContain('aria-label="Review and freeze an investigation question"');
  expect(panel).not.toContain("Pwani ya Upendo");
 });
});
