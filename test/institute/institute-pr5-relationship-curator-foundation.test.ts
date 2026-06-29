import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202606300008_institute_pr5_relationship_curator_admin.sql"),
  "utf8",
);

const service = readFileSync(resolve(process.cwd(), "src/services/institute/instituteService.ts"), "utf8");
const types = readFileSync(resolve(process.cwd(), "src/services/institute/instituteTypes.ts"), "utf8");

describe("Institute PR5 Relationship Curator foundation", () => {
  it("replaces the relationship review RPC with PR5 approval safeguards", () => {
    expect(migration).toContain("create or replace function public.institute_review_entity_relationship");
    expect(migration).toContain("public.institute_can_review()");
    expect(migration).toContain("Approved relationships require a reason");
    expect(migration).toContain("Approved relationships require confidence");
    expect(migration).toContain("Approved relationships require at least one evidence link");
    expect(migration).toContain("from public.relationship_evidence");
  });

  it("supports approve, reject, disputed, needs-more-evidence, and public-safe actions", () => {
    for (const action of [
      "approved",
      "rejected",
      "disputed",
      "needs_more_evidence",
      "public_safe_enabled",
      "public_safe_disabled",
    ]) {
      expect(migration).toContain(action);
    }
  });

  it("logs every relationship review decision", () => {
    expect(migration).toContain("insert into public.review_decisions");
    expect(migration).toContain("'relationship'");
    expect(migration).toContain("v_review_decision");
    expect(migration).toContain("reviewer_id");
  });

  it("keeps rejected relationships internally visible instead of deleting them", () => {
    expect(migration).toContain("review_status = 'rejected'");
    expect(migration).toContain("public_safe = false");
    expect(migration).not.toContain("delete from public.entity_relationships");
  });

  it("adds Relationship Curator service helpers", () => {
    expect(types).toContain("RelationshipEvidenceLink");
    expect(types).toContain("UpdateEntityRelationshipInput");
    expect(service).toContain("listEntityRelationships");
    expect(service).toContain("getEntityRelationship");
    expect(service).toContain("updateEntityRelationship");
    expect(service).toContain("listRelationshipEvidenceLinks");
    expect(service).toContain("linkRelationshipEvidence");
    expect(service).toContain("unlinkRelationshipEvidence");
  });

  it("does not add AI, embeddings, Surface Draft Review, or public publishing", () => {
    const combined = [migration, service].join("\n");
    expect(combined).not.toContain("createAiRun");
    expect(combined).not.toContain("embeddings.create");
    expect(combined).not.toContain("reviewSurfaceDraft");
    expect(combined).not.toContain('path: "/institute"');
  });
});
