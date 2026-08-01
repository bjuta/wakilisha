import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  normalizePublicArticleTrust,
} from "../../src/services/publicContent/articleTrust";

describe("public Article trust contract", () => {
  it("maps only public fields and orders both families", () => {
    const trust = normalizePublicArticleTrust({
      sources: [
        {
          label: "Second source",
          title: "Second",
          display_order: 2,
          quotation: "private",
          internal_notes: "private",
        },
        {
          label: "First source",
          title: "First",
          display_order: 1,
        },
      ],
      credits: [
        {
          display_name: "Contributor",
          role: "Photography",
          display_order: 2,
          governance_reason: "private",
          contact_email: "private@example.com",
        },
        {
          display_name: "Primary author",
          role: "Author",
          is_primary: true,
          registry_author_slug: "primary-author",
          display_order: 1,
        },
      ],
    });

    expect(trust.sources.map((source) => source.label)).toEqual([
      "First source",
      "Second source",
    ]);
    expect(trust.credits.map((credit) => credit.displayName)).toEqual([
      "Primary author",
      "Contributor",
    ]);

    const serialized = JSON.stringify(trust);
    [
      "quotation",
      "internal_notes",
      "governance_reason",
      "contact_email",
    ].forEach((field) => expect(serialized).not.toContain(field));
  });

  it("uses the server-owned published-version RPC", () => {
    const gateway = fs.readFileSync(
      path.resolve("supabase/functions/public-content-read/index.ts"),
      "utf8",
    );

    expect(gateway).toContain('"public_get_article_trust"');
    expect(gateway).toContain("p_article_slug: artSlug");
    expect(gateway).not.toContain("p_article_version_id");
    expect(gateway).toContain("trust: emptyPublicArticleTrust()");
    expect(gateway).toContain("normalizePublicArticleTrust(trust)");
  });

  it("makes trust part of PublicArticleDetail", () => {
    const client = fs.readFileSync(
      path.resolve("src/services/publicContent/client.ts"),
      "utf8",
    );

    expect(client).toContain("trust: PublicArticleTrust;");
    expect(client).toContain(
      "trust: normalizePublicArticleTrust(result.article.trust)",
    );
  });
});
