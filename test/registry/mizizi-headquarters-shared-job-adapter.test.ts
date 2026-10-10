import { describe, expect, it } from "vitest";
import { planHeadquartersSharedJob, admitResearchJobViaTrustedGatewayV1,
  fingerprintHeadquartersResearchRequestV1 } from "../../scripts/registry/agents/mizizi/runtime/shared-job-adapter";

const CASE = "11111111-1111-4111-8111-111111111111";
const WORKSPACE = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const requestBase = {
  caseId: CASE, workspaceId: WORKSPACE, expectedRevision: 4,
  principalKey: "system:mizizi", idempotencyKey: "mizizi:case:research:4",
  operation: "read_only_research" as const,
  reason: "Collect independent source evidence",
};
const request = { ...requestBase,
  requestFingerprint: fingerprintHeadquartersResearchRequestV1(requestBase) };
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
  it("accepts the actual DB02 start_research state while retaining CAS", () => {
    const updated = { ...binding, caseState: "in_progress" as const };
    expect(planHeadquartersSharedJob(request, updated).jobKey).toBe("research:4");
  });
  it("permits read-only research while Hold Writes is active", () => {
    expect(planHeadquartersSharedJob(request, { ...binding, activeWriteHold: true }).inputPayload.operation)
      .toBe("read_only_research");
  });
  it.each([
    { principalKey: "service:service_role" }, { requestFingerprint: "abc" },
    { idempotencyKey: "bad" }, { operation: "publish" },
    { requestFingerprint: "a".repeat(64) },
    { reason: "" }, { caseId: "invalid" },
    { expectedRevision: 0 },
  ])("refuses invalid shared command inputs: %j", (change) => {
    expect(() => planHeadquartersSharedJob({ ...request, ...change } as typeof request, binding)).toThrow();
  });
});


describe("MIZIZI trusted shared-job gateway caller", () => {
  const ok = {
    case_id: CASE, workspace_id: WORKSPACE, resource_id: CASE, case_revision: 4,
    command_receipt_id: OTHER, job_id: "44444444-4444-4444-8444-444444444444",
    job_status: "queued", outcome: "created",
  };
  it("calls the exact parameterized narrow RPC, not shared-table DML", async () => {
    let calls = 0;
    const executor = { query: async <T = Record<string, unknown>>(sql: string, values: readonly unknown[]) => {
      calls++;
      expect(sql).toContain("mizizi_private.admit_case_research_job_v1");
      expect(sql).not.toMatch(/insert into|update\s+platform_private/i);
      expect(sql).toContain("$7::text");
      expect(values).toEqual([CASE, WORKSPACE, 4, "system:mizizi",
        "mizizi:case:research:4", request.requestFingerprint, request.reason]);
      return { rows: [ok as unknown as T], rowCount: 1 };
    }};
    expect(await admitResearchJobViaTrustedGatewayV1(executor, request)).toMatchObject({
      jobStatus: "queued", outcome: "created", resourceId: CASE, caseRevision: 4,
    });
    expect(calls).toBe(1);
  });
  it("does not execute SQL for unauthorized or malformed commands", async () => {
    let calls = 0;
    const executor = { query: async <T = Record<string, unknown>>() => {
      calls++;
      return { rows: [ok as unknown as T], rowCount: 1 };
    }};
    for (const change of [
      { principalKey: "system:other" }, { principalKey: "service:service_role" },
      { operation: "write" }, { requestFingerprint: "invalid" },
      { caseId: "bad" }, { workspaceId: "bad" }, { expectedRevision: 0 },
      { idempotencyKey: "short" }, { reason: "" },
      { requestFingerprint: "a".repeat(64) },
    ]) {
      await expect(admitResearchJobViaTrustedGatewayV1(executor,
        { ...request, ...change } as typeof request)).rejects.toThrow();
    }
    expect(calls).toBe(0);
  });
  it("rejects any missing, forged, or stale database receipt", async () => {
    const broken = [
      { case_id: OTHER }, { workspace_id: OTHER }, { resource_id: OTHER },
      { case_revision: 3 }, { job_id: "wrong" },
      { command_receipt_id: "wrong" }, { job_status: "dead_letter" },
      { outcome: "unknown" },
    ];
    for (const patch of broken) {
      const executor = { query: async <T = Record<string, unknown>>() => ({ rows: [{ ...ok, ...patch } as unknown as T], rowCount: 1 }) };
      await expect(admitResearchJobViaTrustedGatewayV1(executor, request))
        .rejects.toThrow("MIZIZI_JOB_GATEWAY_UNTRUSTED_RESULT");
    }
  });
  it("rejects missing or duplicated rows and does not invent JIT credentials", async () => {
    await expect(admitResearchJobViaTrustedGatewayV1(null as never, request))
      .rejects.toThrow("Approved JIT");
    for (const count of [0, 2]) {
      const executor = { query: async <T = Record<string, unknown>>() => ({ rows: Array(count).fill(ok) as T[], rowCount: count }) };
      await expect(admitResearchJobViaTrustedGatewayV1(executor, request))
        .rejects.toThrow("MIZIZI_JOB_GATEWAY_INCOMPLETE_RECEIPT");
    }
  });
});
