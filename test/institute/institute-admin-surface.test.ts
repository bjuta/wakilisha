import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const router = readFileSync(resolve(process.cwd(), "src/router/config.tsx"), "utf8");
const shell = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminShell.tsx"), "utf8");
const layouts = readFileSync(resolve(process.cwd(), "src/components/admin/AdminSectionLayouts.tsx"), "utf8");
const overview = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/page.tsx"), "utf8");
const review = readFileSync(resolve(process.cwd(), "src/pages/admin/institute/review/page.tsx"), "utf8");

describe("Institute admin surface", () => {
  it("registers the Institute admin routes inside AdminShell", () => {
    expect(router).toContain('path: "institute"');
    expect(router).toContain("AdminInstituteLayout");
    expect(router).toContain("AdminInstituteOverviewPage");
    expect(router).toContain("AdminInstituteReviewPage");
    expect(router).toContain('{ path: "review", element: <AdminInstituteReviewPage /> }');
  });

  it("adds an Institute section to the admin sidebar", () => {
    expect(shell).toContain('{ label: "Institute"');
    expect(shell).toContain('/admin/institute');
    expect(shell).toContain('/admin/institute/review');
    expect(shell).toContain('label: "Inquiry OS"');
    expect(shell).toContain('label: "Institute Review"');
  });

  it("guards the Institute section with existing capabilities", () => {
    expect(layouts).toContain("AdminInstituteLayout");
    expect(layouts).toContain('"view_registry"');
    expect(layouts).toContain('"view_review_queue"');
    expect(layouts).toContain('"view_relationships"');
    expect(layouts).not.toContain('"view_institute"');
    expect(layouts).not.toContain('"manage_institute"');
  });

  it("uses PR4 admin helper services instead of direct Supabase reads", () => {
    expect(overview).toContain("getInstituteAdminOverviewCountMap");
    expect(overview).toContain("listHumanReviewQueueItems");
    expect(overview).toContain("Method Console");
    expect(overview).toContain("Five-screen rule");
    expect(overview).not.toContain("listRetrievalPolicies");
    expect(overview).not.toContain("listRetrievalRuns");
    expect(review).toContain("listHumanReviewQueueItems");

    expect(overview).not.toContain("supabase.from");
    expect(review).not.toContain("supabase.from");
  });

  it("keeps Institute review mutations controlled through RPCs", () => {
    const combined = `${overview}\n${review}`;

    expect(combined).not.toContain(".insert(");
    expect(combined).not.toContain(".update(");
    expect(combined).not.toContain(".delete(");
    expect(combined).toContain("reviewEvidenceItem");
    expect(combined).toContain("reviewEntityRelationship");
    expect(combined).toContain("reviewContributorSubmission");
    expect(combined).toContain("reviewSurfaceDraft");
    expect(combined).toContain("Needs more evidence");
    expect(combined).toContain("Enable public-safe");
    expect(combined).toContain("Accept as memory");
    expect(combined).toContain("Accept as evidence");
    expect(combined).toContain("Needs rewrite");
    expect(combined).toContain("Enable public-safe");
    expect(combined).not.toContain("createAiRun");
    expect(combined).not.toContain("createRetrievalRun");
    expect(combined).not.toContain("createEvidenceReviewEvent");
  });

  it("keeps non-actionable review items pointed at existing admin surfaces for now", () => {
    expect(review).toContain('/admin/relationships/viewer');
    expect(review).toContain('/admin/community');
    expect(review).toContain('/admin/review/queue');
  });

  it("keeps relationship review handler inside the page component", () => {
    const evidenceButtonStart = review.indexOf("function EvidenceActionButton");
    const relationshipButtonStart = review.indexOf("function RelationshipActionButton");
    const pageStart = review.indexOf("export default function AdminInstituteReviewPage");
    const relationshipHandlerStart = review.indexOf("async function handleReviewRelationship");

    expect(evidenceButtonStart).toBeGreaterThan(-1);
    expect(relationshipButtonStart).toBeGreaterThan(evidenceButtonStart);
    expect(pageStart).toBeGreaterThan(relationshipButtonStart);
    expect(relationshipHandlerStart).toBeGreaterThan(pageStart);

    const evidenceButtonBlock = review.slice(evidenceButtonStart, relationshipButtonStart);
    expect(evidenceButtonBlock).not.toContain("reviewEntityRelationship");
    expect(evidenceButtonBlock).not.toContain("setActionBusyKey");
  });

  it("keeps contributor submission review handler inside the page component", () => {
    const contributorButtonStart = review.indexOf("function ContributorSubmissionActionButton");
    const relationshipButtonStart = review.indexOf("function RelationshipActionButton");
    const pageStart = review.indexOf("export default function AdminInstituteReviewPage");
    const contributorHandlerStart = review.indexOf("async function handleReviewContributorSubmission");

    expect(contributorButtonStart).toBeGreaterThan(-1);
    expect(relationshipButtonStart).toBeGreaterThan(contributorButtonStart);
    expect(pageStart).toBeGreaterThan(relationshipButtonStart);
    expect(contributorHandlerStart).toBeGreaterThan(pageStart);

    const contributorButtonBlock = review.slice(contributorButtonStart, relationshipButtonStart);
    expect(contributorButtonBlock).not.toContain("reviewContributorSubmission");
    expect(contributorButtonBlock).not.toContain("setActionBusyKey");
  });

  it("keeps draft review handler inside the page component", () => {
    const draftButtonStart = review.indexOf("function DraftActionButton");
    const contributorButtonStart = review.indexOf("function ContributorSubmissionActionButton");
    const pageStart = review.indexOf("export default function AdminInstituteReviewPage");
    const draftHandlerStart = review.indexOf("async function handleReviewDraft");

    expect(draftButtonStart).toBeGreaterThan(-1);
    expect(contributorButtonStart).toBeGreaterThan(draftButtonStart);
    expect(pageStart).toBeGreaterThan(contributorButtonStart);
    expect(draftHandlerStart).toBeGreaterThan(pageStart);

    const draftButtonBlock = review.slice(draftButtonStart, contributorButtonStart);
    expect(draftButtonBlock).not.toContain("reviewSurfaceDraft");
    expect(draftButtonBlock).not.toContain("setActionBusyKey");
  });

  it("does not claim the Institute review page is read-only after PR6", () => {
    expect(review).not.toContain("read-only for now");
    expect(review).toContain("Evidence can now be reviewed from here.");
  });
});
