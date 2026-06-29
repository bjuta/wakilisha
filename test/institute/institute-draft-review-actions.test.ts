import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202606300004_institute_draft_review_actions.sql"),
  "utf8",
);

describe("Institute draft review actions migration", () => {
  it("creates one controlled surface draft review RPC", () => {
    expect(sql).toContain("create or replace function public.institute_review_surface_draft");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
  });

  it("requires Institute review capability before mutation", () => {
    expect(sql).toContain("if not public.institute_can_review() then");
    expect(sql).toContain("Institute surface draft review permission denied");
  });

  it("supports the surface draft decision set", () => {
    for (const decision of [
      "pending_review",
      "approved",
      "rejected",
      "needs_rewrite",
      "too_vague",
      "overclaims",
      "public_safe_enabled",
      "public_safe_disabled",
    ]) {
      expect(sql).toContain(`when '${decision}'`);
    }
  });

  it("blocks public-safe publishing unless the draft is approved", () => {
    expect(sql).toContain("Public-safe draft publishing requires approved draft review");
    expect(sql).toContain("v_draft.review_status <> 'approved'");
  });

  it("keeps approved internal drafts visible for public-safe review", () => {
    expect(sql).toContain("Approved draft needs public-safe decision");
    expect(sql).toContain("surface_drafts.review_status = 'approved'");
    expect(sql).toContain("surface_drafts.public_safe = false");
  });

  it("updates draft review fields and logs review decisions", () => {
    expect(sql).toContain("update public.surface_drafts");
    expect(sql).toContain("review_status = v_next_review_status");
    expect(sql).toContain("public_safe = v_next_public_safe");
    expect(sql).toContain("insert into public.review_decisions");
    expect(sql).toContain("'surface_draft'");
  });

  it("does not publish, call AI, or create embeddings", () => {
    expect(sql).not.toContain("insert into public.memory_embeddings");
    expect(sql).not.toContain("insert into public.ai_runs");
    expect(sql).not.toContain("openai");
    expect(sql).not.toContain("anthropic");
    expect(sql).not.toContain("public_articles");
  });

  it("grants execute only to authenticated users", () => {
    expect(sql).toContain("revoke all on function public.institute_review_surface_draft");
    expect(sql).toContain("grant execute on function public.institute_review_surface_draft");
    expect(sql).toContain("to authenticated");
    expect(sql).not.toContain("to anon");
  });
});
