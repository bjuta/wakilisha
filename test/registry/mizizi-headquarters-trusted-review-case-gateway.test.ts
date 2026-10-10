import { describe, expect, it, vi } from "vitest";
import { admitReviewedFindingViaTrustedGatewayV1 } from "../../scripts/registry/agents/mizizi/runtime/trusted-review-case-gateway";
import type { MiziziFinding } from "../../scripts/registry/agents/mizizi/core";

const workspaceId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const finding = (): MiziziFinding => ({
  entityType: "track", entityId: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  ruleId: "track_slug_identity_noise", ruleVersion: "1.2.0", fieldName: "slug",
  fingerprint: "a".repeat(64), currentValue: "test-feat-x", proposedValue: "test",
  disposition: "review", confidence: 0.97, severity: "high",
  reason: "Exact bounded Registry identity needs human review", evidence: {},
});
const input = () => ({workspaceId, policyRulesetVersion: "1.2.0", finding: finding()});
const row = () => ({
  review_item_id: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
  headquarters_case_id: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
  headquarters_case_revision: 1,
  receipt_link_id: "eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",
  outcome: "created",
});
function mockExecutor(result = {rows: [row()], rowCount: 1}) {
  return {query: vi.fn(async (_sql: string, _values: readonly unknown[]) => result)};
}

describe("MIZIZI trusted single-transaction review-case gateway", () => {
  it("passes exact workspace/ruleset and full finding into the narrow RPC, not table DML", async () => {
    const executor = mockExecutor();
    const result = await admitReviewedFindingViaTrustedGatewayV1(executor, input());
    expect(result).toEqual({contract:"mizizi.trusted_review_case_gateway.v1",reviewItemId:row().review_item_id,
      caseId:row().headquarters_case_id,caseRevision:1,receiptLinkId:row().receipt_link_id,outcome:"created"});
    const [sql,args] = executor.query.mock.calls[0];
    expect(sql).toContain("mizizi_private.admit_review_case_gateway_v1($1::uuid,$2::text,$3::jsonb)");
    expect(sql).not.toMatch(/insert|update|delete/i);
    expect(args[0]).toBe(workspaceId);
    expect(args[1]).toBe("1.2.0");
    expect(JSON.parse(args[2] as string)).toEqual(finding());
  });
  it("accepts only the three bounded successful outcomes", async () => {
    for (const outcome of ["created","unchanged","observation_recorded"] as const) {
      const executor = mockExecutor({rows:[{...row(),outcome}],rowCount:1});
      expect((await admitReviewedFindingViaTrustedGatewayV1(executor,input())).outcome).toBe(outcome);
    }
  });
  it("rejects an unsupported Chart finding before contacting SQL", async () => {
    const executor=mockExecutor();
    await expect(admitReviewedFindingViaTrustedGatewayV1(executor,{...input(),finding:{...finding(),entityType:"chart_entry"}})).rejects.toThrow();
    expect(executor.query).not.toHaveBeenCalled();
  });
  it("rejects any auto-fix candidate before SQL",async()=>{
    const executor=mockExecutor();
    await expect(admitReviewedFindingViaTrustedGatewayV1(executor,{...input(),finding:{...finding(),disposition:"auto_fix_candidate"}})).rejects.toThrow();
    expect(executor.query).not.toHaveBeenCalled();
  });
  it("rejects unknown rule versions and unrelated provenance admission",async()=>{
    const executor=mockExecutor();
    await expect(admitReviewedFindingViaTrustedGatewayV1(executor,{...input(),finding:{...finding(),ruleVersion:"2.0.0"}})).rejects.toThrow();
    await expect(admitReviewedFindingViaTrustedGatewayV1(executor,{...input(),finding:{...finding(),ruleId:"provenance_admissible_attestation_pending_review"}})).rejects.toThrow();
    expect(executor.query).not.toHaveBeenCalled();
  });
  it("validates internal workspace identity before SQL",async()=>{
    const executor=mockExecutor();
    await expect(admitReviewedFindingViaTrustedGatewayV1(executor,{...input(),workspaceId:"wrong"})).rejects.toThrow();
    expect(executor.query).not.toHaveBeenCalled();
  });
  it("never reports success for an absent or duplicated returned row",async()=>{
    for(const response of [{rows:[],rowCount:0},{rows:[row(),row()],rowCount:2}]){
      const executor=mockExecutor(response);
      await expect(admitReviewedFindingViaTrustedGatewayV1(executor,input())).rejects.toThrow();
    }
  });
  it("rejects forged UUIDs, invalid revisions, and unrecognized statuses",async()=>{
    const invalid=[
      {...row(),review_item_id:"invalid"},
      {...row(),receipt_link_id:"invalid"},
      {...row(),headquarters_case_id:"invalid"},
      {...row(),headquarters_case_revision:0},
      {...row(),headquarters_case_revision:1.5},
      {...row(),outcome:"approved"},
    ];
    for(const r of invalid){
      const executor=mockExecutor({rows:[r],rowCount:1});
      await expect(admitReviewedFindingViaTrustedGatewayV1(executor,input())).rejects.toThrow();
    }
  });
  it("does not absorb or rewrite database authority errors",async()=>{
    const executor = {query: vi.fn(async()=>{throw new Error("42501: executor binding denied")})};
    await expect(admitReviewedFindingViaTrustedGatewayV1(executor,input())).rejects.toThrow("42501");
  });
  it("does not invent a SQL connection or JIT credential",async()=>{
    await expect(admitReviewedFindingViaTrustedGatewayV1(null as never,input())).rejects.toThrow();
  });
});
