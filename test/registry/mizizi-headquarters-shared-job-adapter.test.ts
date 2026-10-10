import { describe, expect, it } from "vitest";
import { planHeadquartersSharedJob } from "../../scripts/registry/agents/mizizi/runtime/shared-job-adapter";

const CASE = "11111111-1111-4111-8111-111111111111";
const WORKSPACE = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const request = {
  caseId: CASE, workspaceId: WORKSPACE, expectedRevision: 4,
  principalKey: "system:mizizi", idempotencyKey: "mizizi:case:research:4",
  requestFingerprint: "a".repeat(64),
  operation: "read_only_research" as const,
  reason: "Collect independent source evidence",
};
const binding = {
  caseId: CASE, workspaceId: WORKSPACE, resourceId: CASE,
  resourceKind: "mizizi_case" as const, boundCaseId: CASE,
  boundWorkspaceId: WORKSPACE, expectedCaseRevision: 4,
  currentCaseRevision: 4, caseState: "open" as const,
  currentStage: "research", activeWriteHold: false,
  bindingVerifiedAt: "2026-10-10T15:00:00Z",
};

describe("MIZIZI shared typed-job compatibility planner", () => {
  it("preserves exact typed resource and case identity", () => {
    const plan = planHeadquartersSharedJob(request, binding);
    expect(plan.resourceId).toBe(CASE);
    expect(plan.commandType).toBe("mizizi.case_research_v1");
    expect(plan.jobType).toBe("mizizi.case_research_v1");
    expect(plan.jobKey).toBe("research:4");
    expect(plan.inputPayload).toEqual({ case_id: CASE, workspace_id: WORKSPACE,
      expected_case_revision: 4, operation: "read_only_research", reason: request.reason });
    expect(Object.isFrozen(plan)).toBe(true);
  });
  it.each([
    { resourceKind: "correction_case" }, { resourceId: OTHER },
    { boundCaseId: OTHER }, { boundWorkspaceId: OTHER },
    { caseId: OTHER }, { workspaceId: OTHER },
  ])("rejects forged or unrelated typed resource binding: %j", (change) => {
    expect(() => planHeadquartersSharedJob(request, { ...binding, ...change } as typeof binding)).toThrow();
  });
  it.each([
    { currentCaseRevision: 3 }, { expectedCaseRevision: 3 },
    { currentCaseRevision: 5 }, { caseState: "closed" },
    { caseState: "held" }, { caseState: "done_for_now" },
    { currentStage: "triage" },
  ])("refuses stale, held, or non-research cases: %j", (change) => {
    expect(() => planHeadquartersSharedJob(request, { ...binding, ...change } as typeof binding)).toThrow();
  });
  it("permits read-only research while Hold Writes is active", () => {
    expect(planHeadquartersSharedJob(request, { ...binding, activeWriteHold: true }).inputPayload.operation)
      .toBe("read_only_research");
  });
  it.each([
    { principalKey: "service:service_role" }, { requestFingerprint: "abc" },
    { idempotencyKey: "bad" }, { operation: "publish" },
    { reason: "" }, { caseId: "invalid" },
    { expectedRevision: 0 },
  ])("refuses invalid shared command inputs: %j", (change) => {
    expect(() => planHeadquartersSharedJob({ ...request, ...change } as typeof request, binding)).toThrow();
  });
});
