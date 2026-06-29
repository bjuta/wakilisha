import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202606300001_institute_registry_smoke_evidence.sql"),
  "utf8",
);

describe("Institute registry smoke evidence seed", () => {
  it("seeds the Mejja inquiry workflow with real registry-context names", () => {
    expect(sql).toContain("What relationships help explain why Mejja matters?");
    expect(sql).toContain("Mejja");
    expect(sql).toContain("Fik Fameica");
    expect(sql).toContain("Siaka");
    expect(sql).toContain("Mtoto wa Khadija");
    expect(sql).toContain("peak chart rank of #8");
    expect(sql).toContain("six weeks on chart");
  });

  it("creates review-queue evidence that can test PR6 actions", () => {
    expect(sql).toContain("'unreviewed'");
    expect(sql).toContain("'reviewed'");
    expect(sql).toContain("'disputed'");
    expect(sql).toContain("'review_only'");
    expect(sql).not.toContain("'default_retrieval'");
  });

  it("links evidence to an Institute inquiry", () => {
    expect(sql).toContain("insert into public.inquiries");
    expect(sql).toContain("insert into public.evidence_items");
    expect(sql).toContain("insert into public.inquiry_evidence");
    expect(sql).toContain("SMOKE-REGISTRY-WORKFLOW-001");
  });

  it("adds Institute relationship context without mutating registry tables", () => {
    expect(sql).toContain("insert into public.cultural_entities");
    expect(sql).toContain("insert into public.entity_relationships");
    expect(sql).toContain("insert into public.relationship_evidence");
    expect(sql).toContain("institute_smoke_seed");

    expect(sql).not.toMatch(/\binsert\s+into\s+public\.registry_/i);
    expect(sql).not.toMatch(/\bupdate\s+public\.registry_/i);
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.registry_/i);
  });

  it("does not add live AI or public publishing", () => {
    expect(sql).not.toContain("createAiRun");
    expect(sql).not.toContain("openai");
    expect(sql).not.toContain("anthropic");
    expect(sql).not.toContain("'public'");
    expect(sql).toContain("'internal'");
  });
});
