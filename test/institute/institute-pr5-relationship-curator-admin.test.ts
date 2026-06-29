import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const router = readFileSync(resolve(process.cwd(), "src/router/config.tsx"), "utf8");
const shell = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminShell.tsx"), "utf8");
const listPage = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/relationships/page.tsx"), "utf8");
const detailPage = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/relationships/detail/page.tsx"), "utf8");

describe("Institute PR5 Relationship Curator admin", () => {
  it("registers the Relationship Curator admin routes", () => {
    expect(router).toContain("AdminInstituteRelationshipsPage");
    expect(router).toContain("AdminInstituteRelationshipDetailPage");
    expect(router).toContain('{ path: "relationships", element: <AdminInstituteRelationshipsPage /> }');
    expect(router).toContain('{ path: "relationships/:relationshipId", element: <AdminInstituteRelationshipDetailPage /> }');
  });

  it("adds Relationship Curator to the Institute sidebar", () => {
    expect(shell).toContain('/admin/institute/relationships');
    expect(shell).toContain('label: "Relationship Curator"');
    expect(shell).toContain('requiredCapability: "view_relationships"');
  });

  it("supports relationship list and create flows", () => {
    expect(listPage).toContain("listEntityRelationships");
    expect(listPage).toContain("createEntityRelationship");
    expect(listPage).toContain("linkRelationshipEvidence");
    expect(listPage).toContain("listCulturalEntities");
    expect(listPage).toContain("listEvidenceItems");
    expect(listPage).toContain("pending_review");
    expect(listPage).toContain("public_safe: false");
  });

  it("supports relationship detail, evidence links, and review actions", () => {
    expect(detailPage).toContain("getEntityRelationship");
    expect(detailPage).toContain("updateEntityRelationship");
    expect(detailPage).toContain("listRelationshipEvidenceLinks");
    expect(detailPage).toContain("linkRelationshipEvidence");
    expect(detailPage).toContain("unlinkRelationshipEvidence");
    expect(detailPage).toContain("reviewEntityRelationship");
    expect(detailPage).toContain("approved");
    expect(detailPage).toContain("rejected");
    expect(detailPage).toContain("needs_more_evidence");
    expect(detailPage).toContain("public_safe_enabled");
    expect(detailPage).toContain("public_safe_disabled");
  });

  it("keeps approval blocked until reason, confidence, and evidence are present", () => {
    expect(detailPage).toContain("hasEvidence");
    expect(detailPage).toContain("canApprove");
    expect(detailPage).toContain("Approval is blocked until reason, confidence, and evidence are present.");
  });

  it("does not add AI, embeddings, Surface Draft Review, or public publishing", () => {
    const combined = [listPage, detailPage].join("\n");
    expect(combined).not.toContain("createAiRun");
    expect(combined).not.toContain("embeddings.create");
    expect(combined).not.toContain("reviewSurfaceDraft");
    expect(combined).not.toContain('path: "/institute"');
  });
});
