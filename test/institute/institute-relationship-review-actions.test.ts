import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202606300002_institute_relationship_review_actions.sql"),
  "utf8",
);

describe("Institute relationship review actions migration", () => {
  it("creates one controlled relationship review RPC", () => {
    expect(sql).toContain("create or replace function public.institute_review_entity_relationship");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
  });

  it("requires Institute review capability before mutation", () => {
    expect(sql).toContain("if not public.institute_can_review() then");
    expect(sql).toContain("Institute relationship review permission denied");
  });

  it("supports the relationship decision set", () => {
    for (const decision of [
      "approved",
      "rejected",
      "disputed",
      "needs_more_evidence",
      "public_safe_enabled",
      "public_safe_disabled",
    ]) {
      expect(sql).toContain(`when '${decision}'`);
    }
  });

  it("blocks public-safe publishing unless the relationship is approved", () => {
    expect(sql).toContain("Public-safe relationship publishing requires approved relationship review");
    expect(sql).toContain("v_relationship.review_status <> 'approved'");
  });

  it("keeps approved internal relationships visible for public-safe review", () => {
    expect(sql).toContain("Approved relationship needs public-safe decision");
    expect(sql).toContain("entity_relationships.review_status = 'approved'");
    expect(sql).toContain("entity_relationships.public_safe = false");
  });

  it("updates relationship review fields and logs review decisions", () => {
    expect(sql).toContain("update public.entity_relationships");
    expect(sql).toContain("review_status = v_next_review_status");
    expect(sql).toContain("public_safe = v_next_public_safe");
    expect(sql).toContain("insert into public.review_decisions");
    expect(sql).toContain("'relationship'");
  });

  it("does not add live AI or public UI", () => {
    expect(sql).not.toContain("openai");
    expect(sql).not.toContain("anthropic");
    expect(sql).not.toContain("createAiRun");
    expect(sql).not.toContain("autonomous");
  });

  it("grants execute only to authenticated users", () => {
    expect(sql).toContain("revoke all on function public.institute_review_entity_relationship");
    expect(sql).toContain("grant execute on function public.institute_review_entity_relationship");
    expect(sql).toContain("to authenticated");
    expect(sql).not.toContain("to anon");
  });
});
