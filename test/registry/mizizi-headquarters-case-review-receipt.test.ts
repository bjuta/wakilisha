import { describe,it,expect } from "vitest";
import { attachExistingMiziziReviewV1 } from "../../scripts/registry/agents/mizizi/runtime/case-review-receipt";
import { findingToCaseCandidateV1 } from "../../scripts/registry/agents/mizizi/runtime/case-adapter";
import type { CaseAdmissionResultV1, CaseDbPoolV1, CaseDbSessionV1 } from "../../scripts/registry/agents/mizizi/runtime/case-journal";
import type { MiziziFinding } from "../../scripts/registry/agents/mizizi/core";

const w = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const subject = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const id = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
const reviewId = "dddddddd-dddd-4ddd-dddd-dddddddddddd";
const hash = "a".repeat(64);
const finding: MiziziFinding = {
  entityType:"track",entityId:subject,ruleId:"track_slug_identity_noise",
  ruleVersion:"1.1.0",fieldName:"slug",currentValue:"original",
  proposedValue:"revised",disposition:"review",fingerprint:hash,
  confidence:0.97,severity:"high",reason:"Human review required for identity proof",evidence:{},
};
const candidate = findingToCaseCandidateV1({workspaceId:w,policyRulesetVersion:"1.1.0",finding});
const admission: CaseAdmissionResultV1 = {
  contract:"mizizi.case_journal.v1",caseId:id,workspaceId:w,
  caseKey:candidate.persistence.case_key,revision:1,status:"created",
};
const caseRow = { id,workspace_id:w,case_key:candidate.persistence.case_key,
  subject_type:"track",subject_id:subject };
const review = {id:reviewId,review_key:`mizizi:${hash}`,entity_type:"track",
  entity_id:subject,source_id:subject,review_type:"mizizi_data_hygiene",status:"open",
  source_payload:{ruleId:finding.ruleId,ruleVersion:finding.ruleVersion}};

type Fixture = {case?:Record<string,unknown>|null,review?:Record<string,unknown>|null,
  existing?: {id:string;authority_fingerprint:string}|null,insert?: "new"|"old"|"weird"};
function harness(override: Fixture = {}) {
  const calls: string[] = [];
  const row = override.case === undefined ? caseRow : override.case;
  const r = override.review === undefined ? review : override.review;
  let insertionHash = "";
  let released = 0;
  let connects = 0;
  const session: CaseDbSessionV1 = {
    async query<T>(sql:string,values?:readonly unknown[]) {
      calls.push(sql.trim());
      const result = (rows:unknown[]) => ({rows:rows as T[],rowCount:rows.length});
      if (sql.includes("from mizizi_private.cases")) return result(row?[row]:[]);
      if (sql.includes("from public.registry_review_items")) return result(r?[r]:[]);
      if (sql.includes("insert into mizizi_private.case_receipt_links")) {
        insertionHash = String(values?.[3]);
        return result(override.insert==="old"?[]:override.insert==="weird"?[{id:"x",authority_fingerprint:"a".repeat(64)}]:[{id:"eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",authority_fingerprint:insertionHash}]);
      }
      if (sql.includes("from mizizi_private.case_receipt_links")) {
        return result(override.existing === undefined?
          [{id:"eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",authority_fingerprint:insertionHash}]
          :override.existing?[override.existing]:[]);
      }
      return result([]);
    },
    release(){released++;},
  };
  const pool: CaseDbPoolV1 = {async connect(){connects++;return session;}};
  return {pool,calls,get released(){return released},get connects(){return connects}};
}
const invoke = (pool:CaseDbPoolV1,input:Record<string,unknown>={}) =>
  attachExistingMiziziReviewV1(pool,{workspaceId:w,policyRulesetVersion:"1.1.0",finding,admission,reviewItemId:reviewId,...input});

describe("MIZIZI existing human review case receipt bridge",()=>{
  it("links verified existing review through DB02 immutable receipt path",async()=>{
    const h=harness(); const out=await invoke(h.pool);
    expect(out).toEqual({contract:"mizizi.case_review_receipt.v1",caseId:id,reviewItemId:reviewId,status:"linked"});
    expect(h.calls.some(x=>x.includes("insert into mizizi_private.case_receipt_links"))).toBe(true);
    expect(h.calls.some(x=>x.includes("insert into public.registry_review_items"))).toBe(false);
    expect(h.calls.some(x=>x.includes("from mizizi_private.case_events"))).toBe(false);
    expect(h.calls.at(-1)).toBe("COMMIT"); expect(h.released).toBe(1);
  });
  it("replay is idempotent only with exact immutable fingerprint",async()=>{
    const h=harness({insert:"old"}); const out=await invoke(h.pool);
    expect(out.status).toBe("already_linked");expect(h.calls.at(-1)).toBe("COMMIT");
  });
  it("a forged/fingerprint-drift duplicate fails closed and rolls back",async()=>{
    const h=harness({insert:"old",existing:{id:"e",authority_fingerprint:"f".repeat(64)}});
    await expect(invoke(h.pool)).rejects.toThrow("immutable link identity conflict");
    expect(h.calls.at(-1)).toBe("ROLLBACK");expect(h.released).toBe(1);
  });
  it("refuses a different case subject before writing receipt",async()=>{
    const h=harness({case:{...caseRow,subject_id:"ffffffff-ffff-4fff-ffff-ffffffffffff"}});
    await expect(invoke(h.pool)).rejects.toThrow("case scope or subject mismatch");
    expect(h.calls.some(x=>x.includes("insert into mizizi_private.case_receipt_links"))).toBe(false);
    expect(h.calls.at(-1)).toBe("ROLLBACK");
  });
  it("refuses unrelated Registry review types, even when they exist",async()=>{
    const h=harness({review:{...review,review_type:"chart_entry_missing_canonical_link"}});
    await expect(invoke(h.pool)).rejects.toThrow("review lane is not eligible");
    expect(h.calls.at(-1)).toBe("ROLLBACK");
  });
  it("refuses resolved review as a new open case receipt",async()=>{
    const h=harness({review:{...review,status:"resolved"}});
    await expect(invoke(h.pool)).rejects.toThrow("review lane is not eligible");
    expect(h.calls.at(-1)).toBe("ROLLBACK");
  });
  it("refuses review rule/fingerprint drift",async()=>{
    const h=harness({review:{...review,review_key:`mizizi:${"b".repeat(64)}`}});
    await expect(invoke(h.pool)).rejects.toThrow("source rule or observation identity drift");
    expect(h.calls.at(-1)).toBe("ROLLBACK");
  });
  it("requires real case and real review rows",async()=>{
    const h=harness({review:null});await expect(invoke(h.pool)).rejects.toThrow("Registry review not found");
    const h2=harness({case:null});await expect(invoke(h2.pool)).rejects.toThrow("case not found");
    expect(h.calls.at(-1)).toBe("ROLLBACK");expect(h2.calls.at(-1)).toBe("ROLLBACK");
  });
  it("no database work if admission identity or disposition is unsuitable",async()=>{
    const h=harness();
    await expect(invoke(h.pool,{admission:{...admission,caseKey:"wrong"}})).rejects.toThrow("admission identity");
    await expect(invoke(h.pool,{finding:{...finding,disposition:"observe"}})).rejects.toThrow("only actual human-review");
    await expect(invoke(h.pool,{admission:{...admission,status:"requires_manual_reopen"}})).rejects.toThrow("separate human re-opening");
    expect(h.connects).toBe(0);
  });
  it("invalid review identifier fails before a transaction",async()=>{
    const h=harness();await expect(invoke(h.pool,{reviewItemId:"not-a-uuid"})).rejects.toThrow("invalid existing");
    expect(h.connects).toBe(0);
  });
});
