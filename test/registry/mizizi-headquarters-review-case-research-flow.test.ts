import { describe, expect, it, vi } from "vitest";
import type { MiziziFinding } from "../../scripts/registry/agents/mizizi/core";
import {
  admitReviewedCaseResearchV1, caseResearchIdempotencyKeyV1,
  ReviewCaseResearchFlowErrorV1,
} from "../../scripts/registry/agents/mizizi/runtime/review-case-research-flow";

const workspaceId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const caseId = "dddddddd-dddd-4ddd-dddd-dddddddddddd";
const reviewItemId = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
const linkId = "eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee";
const commandId = "ffffffff-ffff-4fff-ffff-ffffffffffff";
const jobId = "11111111-1111-4111-8111-111111111111";
const finding: MiziziFinding = {
  entityType: "track", entityId: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  ruleId: "track_slug_credit_evidence_gap", ruleVersion: "1.3.0", fieldName: "slug",
  fingerprint: "a".repeat(64), currentValue: "song-feat-artist", proposedValue: "song",
  disposition: "review", confidence: 1, severity: "high",
  reason: "Missing structured collaborator evidence requires human review",
  evidence: {source: "Registry"},
};
const input = () => ({workspaceId, policyRulesetVersion: "1.3.0", finding,
  researchReason: "Check the missing credit with independent evidence.",
  action: "admit_ready_research" as const});
const reviewRow = (outcome="created") => ({
  review_item_id: reviewItemId, headquarters_case_id: caseId,
  headquarters_case_revision: 2, receipt_link_id: linkId, outcome,
});
const jobRow = (outcome="created") => ({
  case_id: caseId, workspace_id: workspaceId, resource_id: caseId,
  case_revision: 2, command_receipt_id: commandId, job_id: jobId,
  job_status: "queued", outcome,
});
function executorFixture(review=reviewRow(), job=jobRow()) {
  return {query: vi.fn(async (sql: string, _values: readonly unknown[]) => {
    if (sql.includes("admit_review_case_gateway_v1")) return {rows: [review], rowCount: 1};
    if (sql.includes("admit_case_research_job_v1")) return {rows: [job], rowCount: 1};
    throw new Error("UNEXPECTED_SQL");
  })};
}

describe("MIZIZI trusted review to case to shared research job", () => {
  it("uses exactly the existing two trusted gateways in causal order", async () => {
    const executor = executorFixture();
    const receipt = await admitReviewedCaseResearchV1(executor, input());
    expect(receipt).toMatchObject({state: "research_job_admitted", review: {
      caseId, reviewItemId, receiptLinkId: linkId, caseRevision: 2,
    }, job: {caseId, jobId, commandReceiptId: commandId, outcome: "created"}});
    expect(executor.query).toHaveBeenCalledTimes(2);
    const [firstSql, firstArgs] = executor.query.mock.calls[0];
    const [secondSql, secondArgs] = executor.query.mock.calls[1];
    expect(firstSql).toContain("admit_review_case_gateway_v1");
    expect(secondSql).toContain("admit_case_research_job_v1");
    expect(firstSql+secondSql).not.toMatch(/\b(insert|update|delete|grant|create role)\b/i);
    expect(firstArgs[0]).toBe(workspaceId);
    expect(secondArgs.slice(0,4)).toEqual([caseId,workspaceId,2,"system:mizizi"]);
    expect(secondArgs[4]).toBe(`mizizi.case_research_v1.${caseId}.2`);
    expect(secondArgs[5]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("admits a new review/case without prematurely requesting a job in triage", async () => {
    const executor=executorFixture();
    const result=await admitReviewedCaseResearchV1(executor,{...input(),action:"review_case_only"});
    expect(result).toMatchObject({state:"review_case_admitted",job:null,review:{caseId,reviewItemId}});
    expect(executor.query).toHaveBeenCalledTimes(1);
  });

  it("replays a completed job using the identical bounded idempotency identity", async () => {
    const first=executorFixture(),replay=executorFixture(reviewRow("unchanged"),jobRow("replayed"));
    await admitReviewedCaseResearchV1(first,input());
    const twice=await admitReviewedCaseResearchV1(replay,input());
    expect(twice.job?.outcome).toBe("replayed");
    expect(first.query.mock.calls[1][1]).toEqual(replay.query.mock.calls[1][1]);
    expect(caseResearchIdempotencyKeyV1(caseId.toUpperCase(),2))
      .toBe(`mizizi.case_research_v1.${caseId}.2`);
  });

  it("denies malformed requests before any Registry or shared-job query", async () => {
    const x=executorFixture();
    for (const changed of [
      {...input(),researchReason:"short"},
      {...input(),researchReason:"x".repeat(2001)},
      {...input(),finding:{...finding,ruleVersion:"5.0.0"}},
      {...input(),finding:{...finding,disposition:"auto_fix_candidate"}},
      {...input(),workspaceId:"invalid"},
      {...input(),action:"invented_mode"},
    ]) {
      await expect(admitReviewedCaseResearchV1(x,changed as ReturnType<typeof input>)).rejects.toThrow();
    }
    expect(x.query).not.toHaveBeenCalled();
    await expect(admitReviewedCaseResearchV1(null as never,input())).rejects.toThrow();
  });

  it("does not hide source-case gateway denial or invent success", async () => {
    const x=executorFixture();
    x.query.mockRejectedValueOnce(new Error("42501: narrow executor denied"));
    const err=await admitReviewedCaseResearchV1(x,input()).catch(e=>e);
    expect(err).toBeInstanceOf(ReviewCaseResearchFlowErrorV1);
    expect(err).toMatchObject({stage:"review_case",caseId:null,reviewItemId:null});
    expect(x.query).toHaveBeenCalledTimes(1);
  });

  it("preserves committed review, case and link when research stage is not yet authorized", async () => {
    const x=executorFixture();
    x.query.mockResolvedValueOnce({rows:[reviewRow()],rowCount:1});
    x.query.mockRejectedValueOnce(new Error("55000: case still in triage"));
    const err=await admitReviewedCaseResearchV1(x,input()).catch(e=>e);
    expect(err).toBeInstanceOf(ReviewCaseResearchFlowErrorV1);
    expect(err).toMatchObject({stage:"research_job",caseId,reviewItemId,receiptLinkId:linkId});
    expect(err.cause.message).toMatch(/triage/);
  });

  it("rejects a research receipt for a different case", async () => {
    const x=executorFixture(reviewRow(),{...jobRow(),case_id:"22222222-2222-4222-8222-222222222222"});
    const err=await admitReviewedCaseResearchV1(x,input()).catch(e=>e);
    expect(err).toMatchObject({stage:"research_job",caseId,reviewItemId});
  });

  it("cannot build an idempotency key for an invalid case or stale revision", () => {
    expect(() => caseResearchIdempotencyKeyV1("bad",1)).toThrow();
    expect(() => caseResearchIdempotencyKeyV1(caseId,0)).toThrow();
    expect(() => caseResearchIdempotencyKeyV1(caseId,1.5)).toThrow();
  });
});
