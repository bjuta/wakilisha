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

describe("Article Credit governance controls", () => {
  const migration = read(
    "docs/engineering/replay-baseline/legacy-migrations/20260802231000_article_trust_published_version_context.sql",
  );
  const verifier = read(
    "scripts/control-plane/verify-article-trust-published-version-context.sql",
  );
  const service = read(
    "src/services/articles/articleTrustService.ts",
  );
  const hook = read(
    "src/pages/admin/content/articles/detail/hooks/useArticleTrustWorkspace.ts",
  );
  const panel = read(
    "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
  );
  const form = read(
    "src/pages/admin/content/articles/detail/components/ArticleCreditGovernanceForm.tsx",
  );

  it("adds authoritative published-version context", () => {
    expect(migration).toContain(
      "'published_version_id'",
    );
    expect(migration).toContain(
      "'published_version_number'",
    );
    expect(migration).toContain(
      "'published_version_kind'",
    );
    expect(migration).toContain(
      "Article published version pointer is invalid",
    );
    expect(verifier).toContain(
      "Published Credit context is incorrect",
    );
  });

  it("normalizes and loads both working and published trust", () => {
    expect(service).toContain(
      "publishedVersionId: string | null",
    );
    expect(service).toContain(
      "row.published_version_id",
    );
    expect(hook).toContain(
      "publishedWorkspace",
    );
    expect(hook).toContain(
      "nextIdentity.publishedVersionId",
    );
    expect(hook).toContain(
      "Article working version changed while trust was loading",
    );
  });

  it("shows published Credits without merging them into working trust", () => {
    expect(panel).toContain(
      "Working-version Credits",
    );
    expect(panel).toContain(
      "Published-version Credits",
    );
    expect(panel).toContain(
      "This working version is isolated from Credits attached to the published version.",
    );
    expect(panel).toContain(
      "Governance changes affect current public eligibility",
    );
    expect(panel).toContain(
      "Manage Governance",
    );
  });

  it("calls the existing governed command with optimistic concurrency", () => {
    expect(form).toContain(
      "setCreditGovernance",
    );
    expect(form).toContain(
      "p_credit_id: credit.creditId",
    );
    expect(form).toContain(
      "p_expected_governance_revision",
    );
    expect(form).toContain(
      "credit.governanceRevision",
    );
    expect(form).toContain(
      "A reason is required for Credit withdrawal or archival.",
    );
    expect(form).toContain(
      "Credit governance changed while this form was open.",
    );
  });

  it("prevents non-active Credits from remaining public-safe", () => {
    expect(form).toContain(
      "const publicSafeAllowed =",
    );
    expect(form).toContain(
      'creditState === "active"',
    );
    expect(form).toContain(
      "const effectivePublicSafe =",
    );
    expect(form).toContain(
      'if (nextState !== "active")',
    );
    expect(form).toContain(
      "setPublicSafe(false)",
    );
    expect(form).toContain(
      "p_public_safe: effectivePublicSafe",
    );
    expect(form).toContain(
      "submitting || !publicSafeAllowed",
    );
    expect(form).toContain(
      "Only active Credits can be governed as public-safe.",
    );
  });

  it("preserves the trust and commerce boundary", () => {
    expect(form).toContain(
      "Credit does not determine payment or payout rights.",
    );
    expect(panel).toContain(
      "Credit does not determine payment or payout rights.",
    );
    expect(form).not.toContain("payout_status");
    expect(form).not.toContain("payment_status");
  });
});
