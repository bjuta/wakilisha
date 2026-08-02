import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizeArticleTrustSourceLibrary,
} from "../../src/services/articles/articleTrustService";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

describe("Article trust Source intake contract", () => {
  it("normalizes the bounded Source Library payload", () => {
    const library =
      normalizeArticleTrustSourceLibrary({
        source_types: [
          {
            source_type: "article",
            label: "Article",
            description: "Published article",
            sort_order: 20,
          },
          {
            source_type: "interview",
            label: "Interview",
            description: "Recorded interview",
            sort_order: 10,
          },
        ],
        sources: [
          {
            id: "source-1",
            source_type: "interview",
            title: "Interview with the author",
            review_status: "approved",
            exposure_class: "public",
            source_state: "active",
            current_approved_version_id:
              "source-version-1",
            working_revision: 1,
            updated_at:
              "2026-08-02T09:00:00Z",
          },
        ],
      });

    expect(
      library.sourceTypes.map(
        (item) => item.sourceType,
      ),
    ).toEqual(["interview", "article"]);
    expect(library.sources).toHaveLength(1);
    expect(
      library.sources[0]
        ?.currentApprovedVersionId,
    ).toBe("source-version-1");
  });

  it("loads the Source Library through the bounded RPC", () => {
    const service = read(
      "src/services/articles/articleTrustService.ts",
    );

    expect(service).toContain(
      "list_article_trust_sources",
    );
    expect(service).toContain(
      "fetchArticleTrustSourceLibrary",
    );
    expect(service).not.toContain(
      '.schema("editorial")',
    );
  });

  it("uses the create, submit, and review Source commands", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceForm.tsx",
    );

    expect(form).toContain(
      "await createSource({",
    );
    expect(form).toContain(
      "await submitSourceVersionForReview({",
    );
    expect(form).toContain(
      "await reviewSourceVersion({",
    );
    expect(form).toContain(
      'p_decision: "approve"',
    );
    expect(form).not.toContain(".rpc(");
  });

  it("preserves Source identity and revision after partial progress", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceForm.tsx",
    );

    expect(form).toContain(
      "createdSourceId",
    );
    expect(form).toContain(
      "createdSourceVersionId",
    );
    expect(form).toContain(
      "workingRevision",
    );
    expect(form).toContain(
      "The form will reuse the Source and",
    );
  });

  it("records rights, consent, sensitivity, and exposure deliberately", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceForm.tsx",
    );

    expect(form).toContain(
      "rights_status: rightsStatus",
    );
    expect(form).toContain(
      "consent_status: consentStatus",
    );
    expect(form).toContain(
      "sensitivity,",
    );
    expect(form).toContain(
      "Confirm Public Review",
    );
    expect(form).toContain(
      "I reviewed rights, consent,",
    );
  });

  it("keeps internal, public, and redacted approval paths distinct", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceForm.tsx",
    );

    expect(form).toContain(
      '"approve_internal"',
    );
    expect(form).toContain(
      '"approve_public"',
    );
    expect(form).toContain(
      '"approve_public_redacted"',
    );
    expect(form).toContain(
      'return "public_redacted"',
    );
  });

  it("does not imply that creating a Source creates a Citation", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceForm.tsx",
    );
    const normalizedForm =
      form.replace(/\s+/g, " ");

    expect(normalizedForm).toContain(
      "before creating any Article Citation.",
    );
    expect(normalizedForm).toContain(
      "It does not attach the Source to this Article.",
    );
    expect(normalizedForm).toContain(
      "Citation does not grant reuse permission.",
    );
  });

  it("does not claim that Source approval alone makes a Citation public", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleSourceForm.tsx",
    );
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );
    const normalizedForm =
      form.replace(/\s+/g, " ");
    const normalizedPanel =
      panel.replace(/\s+/g, " ");

    expect(normalizedForm).toContain(
      "Approval is one requirement for a future Citation to appear publicly.",
    );
    expect(normalizedForm).not.toContain(
      "Approval controls whether a future Citation can appear publicly.",
    );
    expect(normalizedPanel).toContain(
      "Approved for Public Reference",
    );
    expect(normalizedPanel).not.toContain(
      "Ready for Public Citation",
    );
  });

  it("gates Source creation and review through verified capabilities", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(panel).toContain(
      'adminUser.can("manage_sources")',
    );
    expect(panel).toContain(
      'adminUser.can("review_sources")',
    );
    expect(panel).toContain(
      "<ArticleSourceForm",
    );
    expect(panel).toContain(
      "Add Source",
    );
  });

  it("shows reusable Sources separately from attached Citations", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(panel).toContain(
      "Source Library",
    );
    expect(panel).toContain(
      "Sources are reusable trust records.",
    );
    expect(panel).toContain(
      "Sources and Citations",
    );
    expect(panel).toContain(
      "fetchArticleTrustSourceLibrary",
    );
  });
});
