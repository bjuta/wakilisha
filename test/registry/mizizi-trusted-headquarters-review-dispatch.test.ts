import {describe,it,expect,vi} from "vitest";
import type {MiziziFinding} from "../../scripts/registry/agents/mizizi/core";
import {createTrustedHeadquartersReviewDispatcherV1} from "../../scripts/registry/agents/mizizi/runtime/trusted-headquarters-review-dispatch";
import {readFileSync} from "node:fs";

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
 it("the legacy runner defaults off; explicit bounded review mode and real JIT are mandatory",()=>{
   const run=readFileSync("scripts/registry/agents/mizizi/run.ts","utf8");
   expect(run).toContain('argValue("headquarters-case-mode", "off")');
   expect(run).toContain('mode !== "review" || entity !== "track" || limit < 1 || limit > 25');
   expect(run).toContain("MIZIZI_HEADQUARTERS_REVIEW_CASE_ONLY");
   expect(run).toContain("createTrustedHeadquartersReviewDispatcherV1");
   expect(run).toContain("MIZIZI_HEADQUARTERS_REVIEW_CASE_RECEIPT=");
 });
});
