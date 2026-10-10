import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  convergeExistingMiziziReviewCaseV1,
  existingMiziziReviewBrokerLaneV1,
  ReviewCaseConvergenceErrorV1,
} from "../../scripts/registry/agents/mizizi/runtime/review-case-coordinator";
import type { MiziziFinding } from "../../scripts/registry/agents/mizizi/core";
import type { CaseDbPoolV1 } from "../../scripts/registry/agents/mizizi/runtime/case-journal";

const mocks = vi.hoisted(() => ({
  admit: vi.fn(),
  attach: vi.fn(),
}));
vi.mock("../../scripts/registry/agents/mizizi/runtime/case-journal", () => ({
  admitMiziziFindingCaseV1: mocks.admit,
}));
vi.mock("../../scripts/registry/agents/mizizi/runtime/case-review-receipt", () => ({
  attachExistingMiziziReviewV1: mocks.attach,
}));

const workspaceId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const trackId = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const reviewItemId = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
const caseId = "dddddddd-dddd-4ddd-dddd-dddddddddddd";
const fingerprint = "a".repeat(64);
const finding: MiziziFinding = {
  entityType: "track", entityId: trackId, ruleId: "track_slug_identity_noise",
  ruleVersion: "1.1.0", fieldName: "slug", currentValue: "song-feat-person",
  proposedValue: "song", disposition: "review", fingerprint,
  confidence: 0.97, severity: "high", reason: "Independent human decision required",
  evidence: {},
};
const baseInput = {workspaceId,policyRulesetVersion: "1.1.0",finding};
const pool = {} as CaseDbPoolV1;
let broker: ReturnType<typeof vi.fn>;
const caseAdmission = {contract: "mizizi.case_journal.v1",caseId,workspaceId,
  caseKey: "stub",revision: 1,status: "created"};
const receipt = {contract: "mizizi.case_review_receipt.v1",caseId,reviewItemId,status: "linked"};
const runtime = () => ({
  authorizedCasePool: pool,
  existingReviewBroker: {materializeReview: broker},
});

beforeEach(() => {
  vi.resetAllMocks();
  broker = vi.fn().mockResolvedValue(reviewItemId);
  mocks.admit.mockResolvedValue(caseAdmission);
  mocks.attach.mockResolvedValue(receipt);
});

describe("MIZIZI existing review broker to durable case convergence", () => {
  it("uses accepted Registry broker before case writer and immutable receipt", async () => {
    const order: string[] = [];
    broker.mockImplementation(async () => {order.push("broker"); return reviewItemId;});
    mocks.admit.mockImplementation(async () => {order.push("admit"); return caseAdmission;});
    mocks.attach.mockImplementation(async () => {order.push("link"); return receipt;});
    const result = await convergeExistingMiziziReviewCaseV1(runtime(),baseInput);
    expect(order).toEqual(["broker","admit","link"]);
    expect(broker).toHaveBeenCalledWith("queue_registry_review_v1",finding);
    expect(mocks.admit).toHaveBeenCalledWith(pool,baseInput);
    expect(mocks.attach).toHaveBeenCalledWith(pool,{...baseInput,admission:caseAdmission,reviewItemId});
    expect(result).toMatchObject({state:"review_case_linked",reviewItemId,caseAdmission,receipt});
  });

  it("maps only approved broker rule/version and subject contracts", () => {
    expect(existingMiziziReviewBrokerLaneV1(finding)).toBe("queue_registry_review_v1");
    expect(existingMiziziReviewBrokerLaneV1({...finding,ruleVersion:"1.2.0"})).toBe("queue_registry_review_v1");
    expect(existingMiziziReviewBrokerLaneV1({...finding,entityType:"release",ruleId:"release_slug_provider_packaging",ruleVersion:"1.2.0"})).toBe("queue_registry_review_v1");
    for (const id of ["track_slug_credit_evidence_gap","track_recording_identity_conflict"]) {
      expect(existingMiziziReviewBrokerLaneV1({...finding,ruleId:id,ruleVersion:"1.3.0"})).toBe("queue_public_music_identity_review_v1");
    }
  });

  it("refuses chart, provenance, unrecognized and auto-fix findings before broker or SQL", async () => {
    for(const change of [
      {entityType:"chart",ruleId:"chart_track_slug_drift"},
      {entityType:"contribution_attestation",ruleId:"provenance_admissible_attestation_pending_review"},
      {ruleId:"track_title_credit_noise"},
      {disposition:"auto_fix_candidate"},
      {ruleVersion:"9.9.9"},
      {entityId:"bad-id"},
      {ruleId:"track_recording_identity_conflict",ruleVersion:"1.2.0"},
    ]) {
      await expect(convergeExistingMiziziReviewCaseV1(runtime(),{
        ...baseInput, finding:{...finding,...change} as MiziziFinding,
      })).rejects.toThrow();
    }
    expect(broker).not.toHaveBeenCalled();
    expect(mocks.admit).not.toHaveBeenCalled();
    expect(mocks.attach).not.toHaveBeenCalled();
  });

  it("bad workspace or invalid candidate fails before calling existing review broker", async () => {
    await expect(convergeExistingMiziziReviewCaseV1(runtime(),{...baseInput,workspaceId:"bad"})).rejects.toThrow();
    await expect(convergeExistingMiziziReviewCaseV1(runtime(),{...baseInput,finding:{...finding,fingerprint:"bad"}})).rejects.toThrow();
    expect(broker).not.toHaveBeenCalled();
  });

  it("broker rejection does not create a case", async () => {
    broker.mockRejectedValue(new Error("stale Registry evidence"));
    const error = await convergeExistingMiziziReviewCaseV1(runtime(),baseInput).catch(e => e);
    expect(error).toBeInstanceOf(ReviewCaseConvergenceErrorV1);
    expect(error).toMatchObject({stage:"review_broker",reviewItemId:null,caseId:null});
    expect(mocks.admit).not.toHaveBeenCalled();
    expect(mocks.attach).not.toHaveBeenCalled();
  });

  it("broker UUID must be valid before making a case", async () => {
    broker.mockResolvedValue("nonsense");
    await expect(convergeExistingMiziziReviewCaseV1(runtime(),baseInput)).rejects.toMatchObject({stage:"review_broker"});
    expect(mocks.admit).not.toHaveBeenCalled();
  });

  it("case admission failure preserves real review identity for safe replay", async () => {
    mocks.admit.mockRejectedValue(new Error("workspace authority absent"));
    const error=await convergeExistingMiziziReviewCaseV1(runtime(),baseInput).catch(e=>e);
    expect(error).toMatchObject({stage:"case_admission",reviewItemId,caseId:null});
    expect(error.cause.message).toMatch(/workspace authority/);
    expect(mocks.attach).not.toHaveBeenCalled();
  });

  it("case requires manual reopening without fabricating a receipt", async () => {
    mocks.admit.mockResolvedValue({...caseAdmission,status:"requires_manual_reopen"});
    const error=await convergeExistingMiziziReviewCaseV1(runtime(),baseInput).catch(e=>e);
    expect(error).toMatchObject({stage:"manual_reopen",reviewItemId,caseId});
    expect(mocks.attach).not.toHaveBeenCalled();
  });

  it("receipt link failure reports incomplete phase without deleting valid broker or case", async () => {
    mocks.attach.mockRejectedValue(new Error("review changed to resolved"));
    const error=await convergeExistingMiziziReviewCaseV1(runtime(),baseInput).catch(e=>e);
    expect(error).toMatchObject({stage:"receipt_link",reviewItemId,caseId});
    expect(mocks.admit).toHaveBeenCalledOnce();
  });

  it("inconsistent receipt identifiers cannot be reported as success", async () => {
    mocks.attach.mockResolvedValue({...receipt,caseId:"eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee"});
    await expect(convergeExistingMiziziReviewCaseV1(runtime(),baseInput)).rejects.toMatchObject({stage:"receipt_link",reviewItemId,caseId});
  });

  it("idempotent broker/journal/receipt replays converge without new authority", async () => {
    await convergeExistingMiziziReviewCaseV1(runtime(),baseInput);
    mocks.admit.mockResolvedValue({...caseAdmission,status:"unchanged"});
    mocks.attach.mockResolvedValue({...receipt,status:"already_linked"});
    const replay=await convergeExistingMiziziReviewCaseV1(runtime(),baseInput);
    expect(replay.receipt.status).toBe("already_linked");
    expect(replay.caseAdmission.status).toBe("unchanged");
    expect(broker).toHaveBeenCalledTimes(2);
  });

  it("missing existing broker/pool cannot complete the admitted flow", async () => {
    await expect(convergeExistingMiziziReviewCaseV1({
      authorizedCasePool:pool,existingReviewBroker:{materializeReview:async()=>{throw new Error("denied");}},
    },baseInput)).rejects.toMatchObject({stage:"review_broker"});
  });
});
