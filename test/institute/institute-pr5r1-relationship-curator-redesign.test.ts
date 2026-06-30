import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const listPage = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/relationships/page.tsx"), "utf8");
const detailPage = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/relationships/detail/page.tsx"), "utf8");

describe("Institute PR5R.1 Relationship Curator redesign", () => {
  it("uses shared Institute experience components", () => {
    for (const component of [
      "InstitutePageHeader",
      "InstituteRelationshipStatePanel",
      "InstituteEvidenceStatePanel",
      "InstituteUncertaintyPanel",
      "InstituteNextMovePanel",
      "InstituteSectionCard",
    ]) {
      expect(listPage).toContain(component);
      expect(detailPage).toContain(component);
    }

    expect(detailPage).toContain("InstituteUnderstandingPanel");
    expect(detailPage).toContain("InstituteDecisionLog");
  });

  it("starts with meaning, evidence strength, public safety, uncertainty, and next safe move", () => {
    expect(listPage).toContain("Relationship meaning");
    expect(listPage).toContain("What does this relationship help someone understand?");
    expect(detailPage).toContain("What this helps explain");
    expect(detailPage).toContain("What this does not prove");
    expect(detailPage).toContain("Evidence strength");
    expect(detailPage).toContain("Public safety");
    expect(detailPage).toContain("Travel risk");
    expect(detailPage).toContain("Decide how far this relationship can travel");
  });

  it("keeps create, edit, evidence link, review, approve, reject, and public-safe actions", () => {
    expect(listPage).toContain("createEntityRelationship");
    expect(listPage).toContain("linkRelationshipEvidence");
    expect(detailPage).toContain("updateEntityRelationship");
    expect(detailPage).toContain("linkRelationshipEvidence");
    expect(detailPage).toContain("unlinkRelationshipEvidence");
    expect(detailPage).toContain("reviewEntityRelationship");
    expect(detailPage).toContain("approved");
    expect(detailPage).toContain("rejected");
    expect(detailPage).toContain("public_safe_enabled");
    expect(detailPage).toContain("public_safe_disabled");
  });

  it("keeps approval and public-safety guardrails visible", () => {
    expect(detailPage).toContain("Approval is blocked until reason, confidence, and evidence are present.");
    expect(detailPage).toContain('disabled={reviewing || !canApprove}');
    expect(detailPage).toContain('disabled={reviewing || !canMarkPublicSafe}');
    expect(detailPage).toContain("Only approved relationships should be marked safe to travel.");
  });

  it("keeps visible labels human instead of database-first", () => {
    for (const badVisibleLabel of [
      "Create relationship",
      "Curator queue",
      "Relationship detail",
      "Review actions",
      "Review status",
      "Source entity",
      "Target entity",
      "No relationships found",
      "No evidence linked yet",
    ]) {
      expect(listPage).not.toContain(badVisibleLabel);
      expect(detailPage).not.toContain(badVisibleLabel);
    }
  });

  it("does not introduce SQL, PR6 AI, embeddings, public graph, or public publishing", () => {
    const combined = [listPage, detailPage].join("\\n");

    expect(combined).not.toContain("createAiRun");
    expect(combined).not.toContain("embeddings.create");
    expect(combined).not.toContain("PublicGraph");
    expect(combined).not.toContain("graph view");
    expect(combined).not.toContain("publish");
    expect(combined).not.toMatch(/[—–]/);
  });
});
