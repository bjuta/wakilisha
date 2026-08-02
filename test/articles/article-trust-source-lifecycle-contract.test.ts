import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

describe("Article Source lifecycle contract", () => {
  it("uses governed Source commands without direct RPC calls", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceLifecycleForm.tsx",
    );

    expect(form).toContain(
      "await withdrawSource({",
    );
    expect(form).toContain(
      "await restoreSource({",
    );
    expect(form).toContain(
      "await submitSourceVersionForReview({",
    );
    expect(form).toContain(
      "await reviewSourceVersion({",
    );
    expect(form).not.toContain(".rpc(");
  });

  it("withdraws through the currently supported hide-public mode", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceLifecycleForm.tsx",
    );

    expect(form).toContain(
      'p_withdrawal_public_mode:\n            "hide_public_reference"',
    );
    expect(form).toContain(
      "Public response: Hide Public Reference",
    );
    expect(form).toContain(
      "Retain and redact",
    );
  });

  it("requires reasons and deliberate lifecycle confirmation", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceLifecycleForm.tsx",
    );

    expect(form).toContain(
      'mode === "withdraw"',
    );
    expect(form).toContain(
      '"withdrawal"',
    );
    expect(form).toContain(
      '"restoration"',
    );
    expect(form).toContain(
      "reason is required.",
    );
    expect(form).toContain(
      "Confirm Source Lifecycle Change",
    );
  });

  it("makes restoration non-public until a fresh review", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceLifecycleForm.tsx",
    );

    expect(form).toContain(
      "Restoration requires a fresh review",
    );
    expect(form).toContain(
      "It clears the current approved version.",
    );
    expect(form).toContain(
      "do not become",
    );
  });

  it("submits the exact working version with optimistic revision control", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceLifecycleForm.tsx",
    );

    expect(form).toContain(
      "source.currentWorkingVersionId",
    );
    expect(form).toContain(
      "p_expected_working_revision:",
    );
    expect(form).toContain(
      "source.workingRevision",
    );
  });

  it("reviews the exact submitted version and keeps exposure deliberate", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceLifecycleForm.tsx",
    );

    expect(form).toContain(
      "source.currentSubmittedVersionId",
    );
    expect(form).toContain(
      "Confirm Public Source Review",
    );
    expect(form).toContain(
      'value="public_redacted"',
    );
  });

  it("gates each Source lifecycle action by the correct capability and state", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(panel).toContain(
      'adminUser.can("withdraw_sources")',
    );
    expect(panel).toContain(
      'source.sourceState === "withdrawn"',
    );
    expect(panel).toContain(
      'source.reviewStatus === "approved"',
    );
    expect(panel).toContain(
      'source.reviewStatus === "changes_requested"',
    );
    expect(panel).toContain(
      'source.reviewStatus === "ready_for_review"',
    );
    expect(panel).toContain(
      "<ArticleSourceLifecycleForm",
    );
  });

  it("distinguishes withdrawn Sources from ordinary internal Sources", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(panel).toContain(
      '"Withdrawn Source"',
    );
    expect(panel).toContain(
      '"Approved for Public Reference"',
    );
    expect(panel).toContain(
      '"Internal Source"',
    );
  });

  it("keeps React lifecycle surfaces free of direct RPC calls", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceLifecycleForm.tsx",
    );
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(form).not.toContain(".rpc(");
    expect(panel).not.toContain(".rpc(");
  });
});
