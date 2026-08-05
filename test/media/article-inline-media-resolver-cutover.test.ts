import fs from "node:fs";
import { describe, expect, it } from "vitest";

const service = fs.readFileSync(
  "src/services/magazineArticles.ts",
  "utf8",
);

const desktopPage = fs.readFileSync(
  "src/pages/magazine/article/page.tsx",
  "utf8",
);

const mobilePage = fs.readFileSync(
  "src/pages/mobile/magazine/article/page.tsx",
  "utf8",
);

const captionUtility = fs.readFileSync(
  "src/utils/injectMediaCaptions.ts",
  "utf8",
);

const blueprint = fs.readFileSync(
  "docs/engineering/phase-4a-m5d-article-inline-media-read-cutover-implementation-blueprint.md",
  "utf8",
);

describe("Phase 4A Migration 5D article inline Media cutover", () => {
  it("routes inline asset IDs through the governed batch helper", () => {
    expect(service).toContain(
      "batchGetMediaAssetsById",
    );

    expect(service).toContain(
      "await batchGetMediaAssetsById(assetIds)",
    );

    expect(service).not.toContain(
      '.from("registry_media_assets")',
    );

    expect(service).not.toContain(
      "from '@/lib/supabase'",
    );
  });

  it("preserves deterministic article asset order", () => {
    expect(service).toContain(
      "return assetIds.flatMap((assetId) => {",
    );

    expect(service).toContain(
      "const asset = assetsById.get(assetId);",
    );

    expect(service).toContain(
      "if (!asset) return [];",
    );
  });

  it("preserves caption presentation metadata", () => {
    expect(service).toContain(
      "(asset.metadata?.alt_text as string)",
    );

    expect(service).toContain(
      "(asset.metadata?.caption as string)",
    );

    expect(service).toContain(
      "title: asset.title || null",
    );

    expect(service).toContain(
      "url: asset.url",
    );
  });

  it("keeps source nullable without a compatibility-table bypass", () => {
    expect(service).toContain(
      "source: string | null;",
    );

    expect(service).toContain(
      "source: null",
    );

    expect(service).not.toContain(
      "source_kind",
    );
  });

  it("keeps desktop and mobile caption rendering connected", () => {
    for (const page of [desktopPage, mobilePage]) {
      expect(page).toContain(
        "buildAssetCaptionMap(article.mediaAssets)",
      );

      expect(page).toContain(
        "injectMediaCaptions",
      );
    }

    expect(captionUtility).toContain(
      "caption: a.caption ?? null",
    );

    expect(captionUtility).toContain(
      "altText: a.altText ?? null",
    );

    expect(captionUtility).toContain(
      "title: a.title ?? null",
    );
  });

  it("keeps the cutover narrow and reversible", () => {
    expect(blueprint).toContain(
      "The image itself remains in the article HTML",
    );

    expect(blueprint).toContain(
      "the slug-based public-content Media lookup",
    );

    expect(blueprint).toContain(
      "Media Library admin reads",
    );

    expect(blueprint).toContain(
      "The compatibility table and original article HTML remain unchanged.",
    );
  });
});
