import {describe,it,expect,vi} from "vitest";
import type {MiziziFinding} from "../../scripts/registry/agents/mizizi/core";
import {createTrustedHeadquartersReviewDispatcherV1} from "../../scripts/registry/agents/mizizi/runtime/trusted-headquarters-review-dispatch";
import {readFileSync} from "node:fs";
import {analyzeTrackIdentity} from "../../scripts/registry/agents/mizizi/core";
import {
 admitReviewViaManagedJitV1,parseReviewCaseAdmissionArgsV1,
} from "../../scripts/registry/agents/mizizi/runtime/run-review-case-admission";

const ws="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const entity="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const reviewId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const caseId="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const receiptId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const finding:MiziziFinding={
  entityType:"track",entityId:entity,disposition:"review",
  ruleId:"track_slug_credit_evidence_gap",ruleVersion:"1.3.0",
  fieldName:"slug",fingerprint:"a".repeat(64),
  currentValue:"track-feat-artist",proposedValue:"track",confidence:1,
  severity:"high",reason:"Missing structured collaborator evidence requires human review",
  evidence:{source:"Registry"},
};
function fixture(role="mizizi_executor"){
 const query=vi.fn(async (sql:string,values:readonly unknown[])=>{
   if(sql.includes("session_user::text"))return {rowCount:1,rows:[{login_role:role}]};
   if(sql.includes("admit_review_case_gateway_v1"))return {rowCount:1,rows:[{
     review_item_id:reviewId,headquarters_case_id:caseId,
     headquarters_case_revision:1,receipt_link_id:receiptId,outcome:"created",
   }]};
   throw new Error("UNEXPECTED_SQL");
 });
 return query;
}

describe("MIZIZI opt-in real JIT review-to-case dispatch",()=>{
 it("reproduces the ORIGINAL Phases reviewed observation identity",()=>{
   const track="23a36038-d6d9-406c-93dd-b2026db6fb24";
   const output=analyzeTrackIdentity({
     id:track,slug:"phases",title:"Phases",
     primaryArtistSlug:"xenia-manasseh",primaryArtistName:"Xenia Manasseh",
     recordingIdentityPeers:[{
       id:"4300961f-94a6-4f50-8475-66fe5600fa04",
       slug:"phases",title:"Phases",sharedPrimaryArtistSlug:"xenia-manasseh",
     }],
   });
   const real=output.find(f=>f.ruleId==="track_recording_identity_conflict");
   expect(real?.fingerprint).toBe(
     "cbb15008aaaacb3de5c223521bf9e90debe067a6e0f4072edf37967a412dfaa0",
   );
   expect(real?.reason).toBe("same_primary_artist_and_normalized_title_multiple_track_identities");
   expect(real?.proposedValue).toBe("human_review_required");
   expect(real?.disposition).toBe("review");
 });
 it("validates the optional managed-JIT project boundary without widening confirmation",()=>{
   const basics=[
     "--workspace-id="+ws,"--ruleset-version=1.3.0",
     "--finding-file=/tmp/approved.json","--confirm=MIZIZI_JIT_REVIEW_CASE_ONLY",
   ];
   expect(parseReviewCaseAdmissionArgsV1(basics).jitProjectRef).toBeNull();
   expect(parseReviewCaseAdmissionArgsV1([
     ...basics,"--jit-project-ref=pgzizndxdyhqmtyywjmt",
   ]).jitProjectRef).toBe("pgzizndxdyhqmtyywjmt");
   expect(()=>parseReviewCaseAdmissionArgsV1([
     ...basics,"--jit-project-ref=invalid",
   ])).toThrow("MIZIZI_CASE_ADMISSION_INVALID_JIT_PROJECT");
   expect(()=>parseReviewCaseAdmissionArgsV1([
     ...basics.filter(v=>!v.startsWith("--confirm=")),
     "--jit-project-ref=pgzizndxdyhqmtyywjmt",
   ])).toThrow("MIZIZI_CASE_ADMISSION_EXPLICIT_CONFIRMATION_REQUIRED");
 });
 it("always restores the JIT mapping on case success and denial",async()=>{
   for(const role of ["mizizi_executor","postgres"]){
     const query=fixture(role),restore=vi.fn(async()=>undefined);
     const open=vi.fn(async()=>({pool:{query},restore}));
     const execute=admitReviewViaManagedJitV1({
       projectRef:"pgzizndxdyhqmtyywjmt",token:"sbp_fc_test_only",
       workspaceId:ws,rulesetVersion:"1.3.0",finding,
     },open as unknown as Parameters<typeof admitReviewViaManagedJitV1>[1]);
     if(role==="mizizi_executor"){
       await expect(execute).resolves.toMatchObject({caseId,receiptLinkId:receiptId});
     }else{
       await expect(execute).rejects.toThrow("MIZIZI_HEADQUARTERS_REAL_JIT_EXECUTOR_REQUIRED");
     }
     expect(open).toHaveBeenCalledTimes(1);
     expect(restore).toHaveBeenCalledTimes(1);
   }
 });
 it("requires the actual executor login, not a postgres role switch",async()=>{
   for(const role of ["postgres","service_role","authenticated","mizizi_worker"]){
     const q=fixture(role);
     await expect(createTrustedHeadquartersReviewDispatcherV1(q,ws,"1.3.0"))
       .rejects.toThrow(/REAL_JIT_EXECUTOR_REQUIRED/);
     expect(q).toHaveBeenCalledTimes(1);
   }
 });
 it("rejects invalid workspace/version before touching any database",async()=>{
   const q=fixture();
   await expect(createTrustedHeadquartersReviewDispatcherV1(q,"bad","1.3.0")).rejects.toThrow();
   await expect(createTrustedHeadquartersReviewDispatcherV1(q,ws,"bad version")).rejects.toThrow();
   expect(q).not.toHaveBeenCalled();
 });
 it("uses exactly the trusted gateway, returns immutable actual receipt identities",async()=>{
   const q=fixture();
   const dispatch=await createTrustedHeadquartersReviewDispatcherV1(q,ws,"1.3.0");
   const output=await dispatch(finding,{trace:"approved-finding"});
   expect(output).toEqual({reviewItemId:reviewId,caseId,receiptLinkId:receiptId,caseRevision:1});
   expect(Object.isFrozen(output)).toBe(true);
   expect(q).toHaveBeenCalledTimes(2);
   const [sql,args]=q.mock.calls[1];
   expect(sql).toContain("mizizi_private.admit_review_case_gateway_v1");
   expect(sql).not.toMatch(/\b(insert|update|delete|grant|create role)\b/i);
   const payload=JSON.parse(String(args[2]));
   expect(payload.evidence).toEqual({source:"Registry",trace:"approved-finding"});
   expect(args[0]).toBe(ws);
 });
 it("fails closed for unsupported rule without adding a legacy review",async()=>{
   const q=fixture();
   const dispatch=await createTrustedHeadquartersReviewDispatcherV1(q,ws,"1.3.0");
   await expect(dispatch({...finding,ruleVersion:"1.4.0"},{})).rejects.toThrow();
   expect(q).toHaveBeenCalledTimes(1);
 });
 it("the protected legacy runner stays unchanged; this integration lives in a separate opt-in CLI",()=>{
   const run=readFileSync("scripts/registry/agents/mizizi/run.ts","utf8");
   expect(run).not.toContain("createTrustedHeadquartersReviewDispatcherV1");
   expect(run).not.toContain("headquarters-case-mode");
   const cli=readFileSync("scripts/registry/agents/mizizi/runtime/run-review-case-admission.ts","utf8");
   expect(cli).toContain("createTrustedHeadquartersReviewDispatcherV1");
   expect(cli).toContain("MIZIZI_JIT_REVIEW_CASE_ONLY");
   expect(cli).not.toMatch(/execute_stewardship_operation|issue_stewardship_execution_grant/);
 });
});
