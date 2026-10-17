import { readFileSync } from "node:fs";
import { buildRedactedHeadquartersAuditV1 } from "../../src/services/miziziRedactedAudit";
import { describe, it, expect, vi } from "vitest";
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
  for (const name of ["Overview","Evidence","Next evidence","History"])
    expect(panel).toContain(`"${name}"`);
  expect(panel).toContain('No recorded evidence requests available.');
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
