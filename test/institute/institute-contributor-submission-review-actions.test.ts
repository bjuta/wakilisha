import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202606300003_institute_contributor_submission_review_actions.sql"),
  "utf8",
);

describe("Institute contributor submission review actions migration", () => {
  it("creates one controlled contributor submission review RPC", () => {
    expect(sql).toContain("create or replace function public.institute_review_contributor_submission");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
  });

  it("requires Institute review capability before mutation", () => {
    expect(sql).toContain("if not public.institute_can_review() then");
    expect(sql).toContain("Institute contributor submission review permission denied");
  });

  it("supports the contributor submission decision set", () => {
    for (const decision of [
      "triaged",
      "needs_source",
      "needs_clarification",
      "accepted_as_memory",
      "accepted_as_evidence",
      "rejected",
      "archived",
    ]) {
      expect(sql).toContain(`when '${decision}'`);
    }
  });

  it("maps contributor submission statuses to valid review_decisions", () => {
    expect(sql).toContain("v_review_decision := 'approved'");
    expect(sql).toContain("v_review_decision := 'needs_more_evidence'");
    expect(sql).toContain("v_review_decision := 'accepted_as_memory'");
    expect(sql).toContain("v_review_decision := 'accepted_as_evidence'");
    expect(sql).toContain("v_review_decision := 'rejected'");
    expect(sql).toContain("v_review_decision := 'internal_only'");
  });

  it("updates submission review fields and logs review decisions", () => {
    expect(sql).toContain("update public.contributor_submissions");
    expect(sql).toContain("review_status = v_next_review_status");
    expect(sql).toContain("reviewed_by = auth.uid()");
    expect(sql).toContain("insert into public.review_decisions");
    expect(sql).toContain("'contributor_submission'");
  });

  it("does not create evidence, embeddings, live AI, or public UI", () => {
    expect(sql).not.toContain("insert into public.evidence_items");
    expect(sql).not.toContain("insert into public.memory_embeddings");
    expect(sql).not.toContain("openai");
    expect(sql).not.toContain("anthropic");
    expect(sql).not.toContain("createAiRun");
  });

  it("grants execute only to authenticated users", () => {
    expect(sql).toContain("revoke all on function public.institute_review_contributor_submission");
    expect(sql).toContain("grant execute on function public.institute_review_contributor_submission");
    expect(sql).toContain("to authenticated");
    expect(sql).not.toContain("to anon");
  });
});
