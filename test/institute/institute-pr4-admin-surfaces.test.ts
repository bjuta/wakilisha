import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const router = readFileSync(resolve(process.cwd(), "src/router/config.tsx"), "utf8");
const shell = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminShell.tsx"), "utf8");
const evidenceList = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/evidence/page.tsx"), "utf8");
const evidenceDetail = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/evidence/detail/page.tsx"), "utf8");
const contributors = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/contributors/page.tsx"), "utf8");

describe("Institute PR4 admin surfaces", () => {
  it("registers Evidence Room and Contributor Desk admin routes", () => {
    expect(router).toContain("AdminInstituteEvidencePage");
    expect(router).toContain("AdminInstituteEvidenceDetailPage");
    expect(router).toContain("AdminInstituteContributorsPage");
    expect(router).toContain('{ path: "evidence", element: <AdminInstituteEvidencePage /> }');
    expect(router).toContain('{ path: "evidence/:evidenceId", element: <AdminInstituteEvidenceDetailPage /> }');
    expect(router).toContain('{ path: "contributors", element: <AdminInstituteContributorsPage /> }');
  });

  it("adds Evidence Room and Contributor Desk to the admin sidebar", () => {
    expect(shell).toContain('/admin/institute/evidence');
    expect(shell).toContain('label: "Evidence Room"');
    expect(shell).toContain('/admin/institute/contributors');
    expect(shell).toContain('label: "Contributor Desk"');
  });

  it("Evidence Room supports list, create, detail, review, and retrieval actions", () => {
    expect(evidenceList).toContain("listEvidenceItems");
    expect(evidenceList).toContain("createEvidenceItem");
    expect(evidenceList).toContain("linkEvidenceToInquiry");
    expect(evidenceDetail).toContain("getEvidenceItem");
    expect(evidenceDetail).toContain("updateEvidenceItem");
    expect(evidenceDetail).toContain("reviewEvidenceItem");
    expect(evidenceDetail).toContain("retrieval_enabled");
    expect(evidenceDetail).toContain("retrieval_disabled");
  });

  it("Contributor Desk supports contributors, submissions, review, and conversion", () => {
    expect(contributors).toContain("listContributors");
    expect(contributors).toContain("createContributor");
    expect(contributors).toContain("listContributorSubmissions");
    expect(contributors).toContain("createContributorSubmission");
    expect(contributors).toContain("reviewContributorSubmission");
    expect(contributors).toContain("acceptContributorSubmissionAsEvidence");
    expect(contributors).toContain("acceptContributorSubmissionAsMemory");
  });

  it("does not add AI, embeddings, Relationship Curator, Surface Draft Review, or public publishing", () => {
    const combined = [evidenceList, evidenceDetail, contributors].join("\n");
    expect(combined).not.toContain("createAiRun");
    expect(combined).not.toContain("embeddings.create");
    expect(combined).not.toContain("createEntityRelationship");
    expect(combined).not.toContain("reviewSurfaceDraft");
    expect(combined).not.toContain('path: "/institute"');
  });
});
