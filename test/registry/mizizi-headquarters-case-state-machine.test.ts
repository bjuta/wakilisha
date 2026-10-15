import { describe, expect, it } from "vitest";
import {
  planCaseTransitionV1,
  type CaseRevisionV1,
} from "../../scripts/registry/agents/mizizi/runtime/case-state-machine";

const BASE: CaseRevisionV1 = {
  id: "036f62d3-6335-452a-8a05-426f31f83e49",
  workspace_id: "b9710e6a-ceb7-4628-bfda-3471fd96c4c5",
  revision: 4,
  case_state: "open",
  current_stage: "triage",
  next_action_at: null,
};
const make = (overrides: Record<string, unknown> = {}) => planCaseTransitionV1({
  current: BASE,
  expectedRevision: 4,
  command: "start_research",
  actorKey: "system:mizizi",
  reason: "Beginning explicitly bounded research from triage.",
  ...overrides,
} as Parameters<typeof planCaseTransitionV1>[0]);

describe("MIZIZI DB02 case transition planning (pure, no execution)", () => {
  it("generates precise expected-revision CAS and delegates journal to DB02", () => {
    const result = make();
    expect(result.kind).toBe("cas_update");
    expect(result.where).toEqual({ id: BASE.id, workspace_id: BASE.workspace_id, revision: 4 });
    expect(result.set).toMatchObject({ revision: 5, case_state: "in_progress", current_stage: "research", transition_actor_key: "system:mizizi" });
    expect(result.journalAuthority).toBe("mizizi_private.cases/mizizi_cases_journal");
    expect(result).not.toHaveProperty("decision");
    expect(result).not.toHaveProperty("grant");
  });
  it("does not create an event or increment revision for duplicate state", () => {
    const result = make({ current: { ...BASE, case_state: "in_progress", current_stage: "research" } });
    expect(result.kind).toBe("no_change");
    expect(result.set).toBeNull();
  });
  it("requires an exact current revision even for no-change replay", () => {
    expect(() => make({ expectedRevision: 3 })).toThrow("stale");
    expect(() => make({ expectedRevision: 5 })).toThrow("stale");
    expect(() => make({ expectedRevision: 4.5 })).toThrow("stale");
  });
  it("queues review but never marks a human decision as approved", () => {
    const result = make({ command: "request_human_review" });
    expect(result.set).toMatchObject({ case_state: "awaiting_review", current_stage: "human_review" });
    expect(JSON.stringify(result)).not.toMatch(/human_approved|execution_grant|decision_accepted/);
  });
  it("does not silently unhold a case", () => {
    const held = { ...BASE, case_state: "held" as const, current_stage: "human_review" as const };
    expect(() => make({ current: held })).toThrow("resume a held case");
    expect(() => make({ current: held, command: "done_for_now" })).toThrow("explicit resume");
    const resumed = make({ current: held, command: "resume_case" });
    expect(resumed.set).toMatchObject({ case_state: "in_progress", current_stage: "triage" });
  });
  it("holds without claiming to set the global Registry write hold", () => {
    const result = make({ current: { ...BASE, current_stage: "human_review", case_state: "awaiting_review" }, command: "hold_case" });
    expect(result.set).toMatchObject({ case_state: "held", current_stage: "human_review" });
    expect(JSON.stringify(result)).not.toContain("write_holds");
  });
  it("records done_for_now without hiding a pending human decision", () => {
    expect(make({ command: "done_for_now" }).set).toMatchObject({ case_state: "done_for_now", current_stage: "triage" });
    expect(() => make({ current: { ...BASE, case_state: "awaiting_review", current_stage: "human_review" }, command: "done_for_now" })).toThrow("pending human review");
  });
  it("refuses terminal or advanced operation stages", () => {
    for (const state of ["resolved", "closed"] as const) {
      expect(() => make({ current: { ...BASE, case_state: state } })).toThrow("terminal");
    }
    expect(() => make({ current: { ...BASE, current_stage: "complete" } })).toThrow("terminal");
    expect(() => make({ current: { ...BASE, current_stage: "execution", case_state: "in_progress" } })).toThrow("triage/research");
  });
  it("refuses privileged or unknown transition commands", () => {
    for (const command of ["approve", "mark_verified", "resolve", "unhold_global", "execute_registry"]) {
      expect(() => make({ command })).toThrow("unknown or privileged");
    }
  });
  it("requires a valid identity, actor, reason and explicit UTC date", () => {
    expect(() => make({ current: { ...BASE, id: "not-uuid" } })).toThrow("identity");
    expect(() => make({ actorKey: "user:someone" })).toThrow("actor");
    expect(() => make({ reason: "ok" })).toThrow("reason");
    expect(() => make({ nextActionAt: "tomorrow" })).toThrow("UTC");
    expect(make({ nextActionAt: "2026-10-15T09:00:00Z" }).set?.next_action_at).toBe("2026-10-15T09:00:00Z");
  });
  it("does not change the input case object", () => {
    const before = structuredClone(BASE);
    make();
    expect(BASE).toEqual(before);
  });
});
