import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202606290005_institute_review_decision_actions.sql",
);

const sql = readFileSync(migrationPath, "utf8");

describe("Institute review decision actions migration", () => {
  it("creates one controlled evidence review RPC", () => {
    expect(sql).toContain("create or replace function public.institute_review_evidence_item");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
  });

  it("requires Institute review capability before mutation", () => {
    expect(sql).toContain("if not public.institute_can_review() then");
    expect(sql).toContain("Institute review permission denied");
  });

  it("supports the approved evidence decision set", () => {
    for (const decision of [
      "reviewed",
      "approved",
      "rejected",
      "disputed",
      "needs_more_evidence",
      "retrieval_enabled",
      "retrieval_disabled",
    ]) {
      expect(sql).toContain(`when '${decision}'`);
    }
  });

  it("blocks default retrieval unless evidence is already reviewed or approved", () => {
    expect(sql).toContain("Default retrieval requires reviewed or approved evidence");
    expect(sql).toContain("v_evidence.review_status not in ('reviewed', 'approved')");
  });

  it("logs exact evidence actions and generic review decisions", () => {
    expect(sql).toContain("insert into public.evidence_review_events");
    expect(sql).toContain("insert into public.review_decisions");
    expect(sql).toContain("v_previous_review_status");
    expect(sql).toContain("v_previous_retrieval_status");
    expect(sql).toContain("v_review_decision := 'needs_more_evidence'");
    expect(sql).toContain("v_review_decision := 'internal_only'");
  });

  it("does not add live AI, public UI, or autonomous execution", () => {
    expect(sql).not.toContain("openai");
    expect(sql).not.toContain("anthropic");
    expect(sql).not.toContain("createAiRun");
    expect(sql).not.toContain("autonomous");
  });

  it("grants execute only to authenticated users", () => {
    expect(sql).toContain("revoke all on function public.institute_review_evidence_item");
    expect(sql).toContain("grant execute on function public.institute_review_evidence_item");
    expect(sql).toContain("to authenticated");
    expect(sql).not.toContain("to anon");
  });
});
