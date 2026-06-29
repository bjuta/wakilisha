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
    expect(overview).toContain("listRetrievalPolicies");
    expect(overview).toContain("listRetrievalRuns");
    expect(review).toContain("listHumanReviewQueueItems");

    expect(overview).not.toContain("supabase.from");
    expect(review).not.toContain("supabase.from");
  });

  it("keeps Institute review mutations controlled through the evidence RPC", () => {
    const combined = `${overview}\n${review}`;

    expect(combined).not.toContain(".insert(");
    expect(combined).not.toContain(".update(");
    expect(combined).not.toContain(".delete(");
    expect(combined).toContain("reviewEvidenceItem");
    expect(combined).toContain("Needs more evidence");
    expect(combined).not.toContain("createAiRun");
    expect(combined).not.toContain("createRetrievalRun");
    expect(combined).not.toContain("createEvidenceReviewEvent");
  });

  it("keeps non-evidence review actions pointed at existing admin surfaces for now", () => {
    expect(review).toContain('/admin/relationships/viewer');
    expect(review).toContain('/admin/community');
    expect(review).toContain('/admin/review/queue');
  });

  it("does not claim the Institute review page is read-only after PR6", () => {
    expect(review).not.toContain("read-only for now");
    expect(review).toContain("Evidence can now be reviewed from here.");
  });
});
