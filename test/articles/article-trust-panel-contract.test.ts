import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

describe("Article trust panel contract", () => {
  it("loads trust through the dedicated service only", () => {
    const service = read(
      "src/services/articles/articleTrustService.ts",
    );
    const hook = read(
      "src/pages/admin/content/articles/detail/hooks/useArticleTrustWorkspace.ts",
    );
    const workspace = read(
      "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx",
    );

    expect(service).toContain(
      '"get_article_working_version_identity"',
    );
    expect(service).toContain(
      '"get_article_version_trust_workspace"',
    );
    expect(hook).toContain(
      "fetchArticleWorkingVersionIdentity",
    );
    expect(hook).toContain(
      "fetchArticleVersionTrustWorkspace",
    );
    expect(workspace).not.toContain(
      "get_article_working_version_identity",
    );
    expect(workspace).not.toContain(
      "get_article_version_trust_workspace",
    );
  });

  it("reloads when the Article draft version changes", () => {
    const hook = read(
      "src/pages/admin/content/articles/detail/hooks/useArticleTrustWorkspace.ts",
    );

    expect(hook).toContain("draftVersion,");
    expect(hook).toContain("workingVersionId");
    expect(hook).toContain("refreshRevision");
  });

  it("mounts a dedicated trust work mode", () => {
    const nav = read(
      "src/pages/admin/content/articles/detail/components/ArticleWorkbenchNav.tsx",
    );
    const workspace = read(
      "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx",
    );

    expect(nav).toContain('| "trust"');
    expect(nav).toContain('key: "trust"');
    expect(nav).toContain("Sources & Credits");
    expect(workspace).toContain(
      'activeWorkbenchMode === "trust"',
    );
    expect(workspace).toContain("<ArticleTrustPanel");
  });

  it("shows explicit version and independent revision context", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(panel).toContain("Working Version");
    expect(panel).toContain("Citation Revision");
    expect(panel).toContain("Credit Revision");
    expect(panel).toContain(
      "Citation and Credit revisions move",
    );
  });

  it("explains public eligibility without implying rights", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(panel).toContain(
      "Citation does not grant reuse permission.",
    );
    expect(panel).toContain(
      "Credit does not determine payment or payout rights.",
    );
    expect(panel).toContain("Publicly Eligible");
    expect(panel).toContain("Internal Only");
  });

  it("retains the legacy byline fallback", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(panel).toContain(
      "legacy Article byline remains the fallback",
    );
    expect(panel).toContain("Primary Author");
  });
});
