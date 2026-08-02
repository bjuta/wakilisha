import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizeArticleTrustCitationIntakeOptions,
} from "../../src/services/articles/articleTrustService";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

describe("Article Citation intake contract", () => {
  it("normalizes locator, purpose, and target-anchor vocabularies", () => {
    const options =
      normalizeArticleTrustCitationIntakeOptions({
        locator_types: [
          {
            locator_type: "quotation",
            label: "Quotation",
            description: "Quoted text",
            sort_order: 40,
          },
          {
            locator_type: "whole_source",
            label: "Whole source",
            description: "Complete source",
            sort_order: 140,
          },
        ],
        citation_purposes: [
          {
            value: "supports",
            label: "Supports",
            description: "Supports a claim",
            sort_order: 10,
          },
        ],
        target_anchor_types: [
          {
            value: "whole_version",
            label: "Whole Article version",
            description: "Complete version",
            sort_order: 10,
          },
        ],
      });

    expect(
      options.locatorTypes.map(
        (option) => option.locatorType,
      ),
    ).toEqual([
      "quotation",
      "whole_source",
    ]);
    expect(
      options.citationPurposes[0]?.value,
    ).toBe("supports");
    expect(
      options.targetAnchorTypes[0]?.value,
    ).toBe("whole_version");
  });

  it("loads Citation intake options through the dedicated service", () => {
    const service = read(
      "src/services/articles/articleTrustService.ts",
    );

    expect(service).toContain(
      "fetchArticleTrustCitationIntakeOptions",
    );
    expect(service).toContain(
      "get_article_trust_citation_intake_options",
    );
  });

  it("creates a Citation and then attaches it to the working Article version", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCitationForm.tsx",
    );

    expect(form).toContain(
      "await createCitation({",
    );
    expect(form).toContain(
      "await attachArticleVersionCitation({",
    );
    expect(form).toContain(
      "p_expected_citation_revision:",
    );
    expect(form).not.toContain(".rpc(");
  });

  it("preserves an immutable Citation after partial attachment failure", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCitationForm.tsx",
    );

    expect(form).toContain(
      "createdCitationId",
    );
    expect(form).toContain(
      "The immutable Citation already",
    );
    expect(form).toContain(
      "Attach Created Citation",
    );
  });

  it("supports every database-backed locator shape", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCitationForm.tsx",
    );

    for (const locator of [
      "page",
      "page_range",
      "paragraph",
      "quotation",
      "timestamp",
      "timestamp_range",
      "chapter",
      "image_frame",
      "spreadsheet_row",
      "spreadsheet_cell",
      "archive_identifier",
      "transcript_range",
      "section_heading",
      "whole_source",
      "other",
    ]) {
      expect(form).toContain(
        `case "${locator}"`,
      );
    }
  });

  it("supports every governed Article target-anchor shape", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCitationForm.tsx",
    );

    for (const anchor of [
      "whole_version",
      "block_id",
      "heading_id",
      "paragraph_id",
      "character_range",
      "structured_node",
    ]) {
      expect(form).toContain(
        `case "${anchor}"`,
      );
    }
  });

  it("keeps Citation and attachment public-safety decisions separate", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCitationForm.tsx",
    );

    expect(form).toContain(
      "citationPublicSafe",
    );
    expect(form).toContain(
      "attachmentPublicSafe",
    );
    expect(form).toContain(
      "Citation is Public-Safe",
    );
    expect(form).toContain(
      "Article Attachment is Public-Safe",
    );
    expect(form).toContain(
      "Confirm Public Citation Review",
    );
    expect(form).toContain(
      "Citation does not grant reuse",
    );
  });

  it("offers only active approved Source versions for Citation creation", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCitationForm.tsx",
    );
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(form).toContain(
      'source.reviewStatus === "approved"',
    );
    expect(form).toContain(
      "Boolean(\n            source.currentApprovedVersionId,",
    );
    expect(form).not.toContain(
      "source.currentApprovedVersionId ||\n              source.currentWorkingVersionId",
    );
    expect(form).toContain(
      "Choose an active approved Source version.",
    );
    expect(panel).toContain(
      "hasApprovedCitationSource",
    );
  });

  it("keeps Article attachment anchors editable after Citation creation", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCitationForm.tsx",
    );

    expect(form).toContain(
      "lockAfterCitation?: boolean",
    );
    expect(form).toContain(
      "lockAfterCitation &&\n              citationLocked",
    );
    expect(
      form.match(
        /lockAfterCitation: false/g,
      )?.length,
    ).toBe(6);
    expect(form).toContain(
      "!createdCitationId &&",
    );
    expect(
      form.indexOf(
        "const locatorData =",
      ),
    ).toBeGreaterThan(
      form.indexOf(
        "if (!citationId) {",
      ),
    );
  });

  it("requires the exact approved Source version for public presentation", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCitationForm.tsx",
    );

    expect(form).toContain(
      "sourceApprovedForPublic",
    );
    expect(form).toContain(
      "currentApprovedVersionId",
    );
    expect(form).toContain(
      '"public_redacted"',
    );
    expect(form).toContain(
      "Public presentation requires an active approved Source version",
    );
  });

  it("gates the Add Citation action through manage_citations", () => {
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(panel).toContain(
      'adminUser.can("manage_citations")',
    );
    expect(panel).toContain(
      "Add Citation",
    );
    expect(panel).toContain(
      "<ArticleCitationForm",
    );
  });

  it("keeps trust RPCs out of React Citation surfaces", () => {
    const form = read(
      "src/pages/admin/content/articles/detail/components/ArticleCitationForm.tsx",
    );
    const panel = read(
      "src/pages/admin/content/articles/detail/components/ArticleTrustPanel.tsx",
    );

    expect(form).not.toContain(".rpc(");
    expect(panel).not.toContain(
      "get_article_trust_citation_intake_options",
    );
  });
});
