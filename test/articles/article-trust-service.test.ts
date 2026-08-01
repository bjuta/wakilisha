import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  classifyArticleTrustError,
  normalizeArticleTrustWorkspace,
} from "../../src/services/articles/articleTrustService";

function filesUnder(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory() ? filesUnder(absolute) : [absolute];
  });
}

describe("Article trust service", () => {
  it("maps independent revisions and deterministic attachment order", () => {
    const workspace = normalizeArticleTrustWorkspace({
      article_version_id: "version-1",
      resource_id: "resource-1",
      citation_revision: 7,
      credit_revision: 3,
      citations: [
        {
          attachment_id: "citation-b",
          display_order: 2,
          source_title: "Second source",
        },
        {
          attachment_id: "citation-a",
          display_order: 1,
          source_title: "First source",
        },
      ],
      credits: [
        {
          attachment_id: "credit-b",
          display_order: 5,
          display_name_snapshot: "Second credit",
        },
        {
          attachment_id: "credit-a",
          display_order: 1,
          display_name_snapshot: "Primary author",
          contributor_kind: "registry_author",
          is_primary: true,
        },
      ],
    });

    expect(workspace.articleVersionId).toBe("version-1");
    expect(workspace.resourceId).toBe("resource-1");
    expect(workspace.citationRevision).toBe(7);
    expect(workspace.creditRevision).toBe(3);
    expect(workspace.citations.map((item) => item.attachmentId)).toEqual([
      "citation-a",
      "citation-b",
    ]);
    expect(workspace.credits.map((item) => item.attachmentId)).toEqual([
      "credit-a",
      "credit-b",
    ]);
    expect(workspace.credits[0]?.contributorKind).toBe("registry_author");
    expect(workspace.credits[0]?.isPrimary).toBe(true);
  });

  it("distinguishes revision conflict from permission failure", () => {
    expect(
      classifyArticleTrustError("Expected citation revision 4 but found 5"),
    ).toBe("concurrency");

    expect(
      classifyArticleTrustError(
        "You do not have permission to update this Credit",
        "42501",
      ),
    ).toBe("permission");
  });

  it("keeps trust RPCs inside the service layer, not React pages", () => {
    const service = fs.readFileSync(
      path.resolve("src/services/articles/articleTrustService.ts"),
      "utf8",
    );

    const commands = [
      "create_source",
      "save_source_version",
      "submit_source_version_for_review",
      "review_source_version",
      "withdraw_source",
      "restore_source",
      "create_citation",
      "attach_article_version_citation",
      "replace_article_version_citations",
      "create_external_contributor",
      "update_external_contributor",
      "create_credit",
      "set_credit_governance",
      "attach_article_version_credit",
      "replace_article_version_credits",
    ];

    expect(service).toContain("get_article_version_trust_workspace");
    commands.forEach((command) => expect(service).toContain(command));

    const pages = filesUnder(path.resolve("src/pages"))
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");

    expect(pages).not.toContain("get_article_version_trust_workspace");
    commands.forEach((command) => expect(pages).not.toContain(command));
  });
});
