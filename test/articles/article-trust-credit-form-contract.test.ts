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

describe("Article trust Credit form contract", () => {
  it("uses the dedicated trust service without direct RPC calls", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCreditForm.tsx",
    );

    expect(form).toContain(
      "createExternalContributor",
    );
    expect(form).toContain("createCredit");
    expect(form).toContain(
      "attachArticleVersionCredit",
    );
    expect(form).not.toContain(".rpc(");
  });

  it("attaches to the current working version with only the Credit revision", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCreditForm.tsx",
    );

    expect(form).toContain(
      "p_article_version_id: articleVersionId",
    );
    expect(form).toContain(
      "p_expected_credit_revision:",
    );
    expect(form).toContain(
      "expectedCreditRevision",
    );
    expect(form).not.toContain(
      "expectedCitationRevision",
    );
  });

  it("preserves partial progress for safe attachment retry", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCreditForm.tsx",
    );

    expect(form).toContain(
      "createdContributorId",
    );
    expect(form).toContain("createdCreditId");
    expect(form).toContain(
      "Attach Created Credit",
    );
    expect(form).toContain(
      "Partial progress is preserved",
    );
  });

  it("enforces public consent and primary-author rules", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCreditForm.tsx",
    );

    expect(form).toContain(
      'consentStatus === "granted"',
    );
    expect(form).toContain(
      'consentStatus === "not_required"',
    );
    expect(form).toContain(
      'creditRole !== "author"',
    );
    expect(form).toContain(
      "hasPrimaryAuthor",
    );
    expect(form).toContain(
      "This does not create payment rights.",
    );
  });

  it("locks public governance after contributor creation", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCreditForm.tsx",
    );

    expect(form).toContain(
      "contributorLocked ||",
    );
    expect(form).toContain(
      "The choice locks after contributor creation.",
    );
  });

  it("keeps contact data out of the Credit attachment payload", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCreditForm.tsx",
    );

    const attachStart = form.indexOf(
      "await attachArticleVersionCredit({",
    );
    const attachEnd = form.indexOf(
      "});",
      attachStart,
    );
    const payload = form.slice(
      attachStart,
      attachEnd,
    );

    expect(payload).not.toContain(
      "p_contact_email",
    );
    expect(payload).not.toContain(
      "p_contact_phone",
    );
    expect(payload).not.toContain(
      "p_internal_notes",
    );
  });

  it("is capability-gated inside the Article trust panel", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(panel).toContain(
      'adminUser.can("manage_credits")',
    );
    expect(panel).toContain("Add Credit");
    expect(panel).toContain(
      "<ArticleCreditForm",
    );
  });
});
