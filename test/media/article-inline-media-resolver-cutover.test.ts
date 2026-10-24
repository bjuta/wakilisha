// @vitest-environment jsdom
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeArticleMediaCaptions } from "@/utils/normalizeArticleMediaCaptions";
import { injectMediaCaptions, buildAssetCaptionMap } from "@/utils/injectMediaCaptions";
import { transformArticleHtmlForVideoEmbeds } from "@/components/video/types";
import { ExtendedImage } from "@/components/admin/editor/ExtendedImage";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";


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


describe("WAKILISHA image and video caption ownership", () => {
  const caption = "EP Artwork for Charisma's 2026 'FOrever to Never' EP released on 21 August 2026. | Image: Charisma";
  const image = '<img src="/media/forever-to-never.jpg" alt="" data-caption="' + caption + '" data-asset-id="art-1">';
  const legacy = '<p>Before the artwork.</p>' + image + '<p>' + caption + '</p><p>The EP opens with Sare.</p>';

  it("rebinds the exact duplicated caption from Charisma's draft without touching prose", () => {
    const output = normalizeArticleMediaCaptions(legacy, "display");
    const doc = new DOMParser().parseFromString(output, "text/html");
    expect(doc.querySelectorAll("figure.wk-figure")).toHaveLength(1);
    expect(doc.querySelectorAll("figcaption.wk-figcaption")).toHaveLength(1);
    expect(doc.querySelector("figure > img")?.getAttribute("data-caption")).toBe(caption);
    expect(doc.querySelector("figcaption")?.textContent).toBe(caption);
    expect(Array.from(doc.querySelectorAll("p")).map(p => p.textContent)).toEqual([
      "Before the artwork.", "The EP opens with Sare.",
    ]);
    expect(normalizeArticleMediaCaptions(output, "display")).toBe(output);
  });

  it("does not delete unrelated or non-adjacent copy, even if it resembles a caption", () => {
    const prose = image + "<p>Unrelated observation.</p><p>" + caption + "</p>";
    const doc = new DOMParser().parseFromString(normalizeArticleMediaCaptions(prose, "display"), "text/html");
    expect(doc.querySelectorAll("p")).toHaveLength(2);
  });

  it("uses authored image caption before Media Library defaults and never double-wraps", () => {
    const map = buildAssetCaptionMap([{ id: "art-1", caption: "Library attribution" }]);
    const html = injectMediaCaptions(legacy, map);
    expect(new DOMParser().parseFromString(html, "text/html").querySelectorAll("figure")).toHaveLength(1);
    expect(html).toContain(caption);
    expect(html).not.toContain("Library attribution");
    expect(injectMediaCaptions(html, map)).toBe(html);
  });

  it("loads media-bound captions as one TipTap image atom, not an editable paragraph", () => {
    const authored = normalizeArticleMediaCaptions(legacy, "editor");
    const editor = new Editor({ extensions: [StarterKit, ExtendedImage], content: authored });
    const json = editor.getJSON();
    const nodes = json.content ?? [];
    expect(nodes.filter(n => n.type === "image")).toHaveLength(1);
    expect(nodes.find(n => n.type === "image")?.attrs?.caption).toBe(caption);
    expect(nodes.filter(n => n.type === "paragraph")).toHaveLength(2);
    const saved = editor.getHTML();
    expect(saved).toContain("<figcaption");
    expect(saved).toContain('contenteditable="false"');
    const reopened = new Editor({
      extensions: [StarterKit, ExtendedImage],
      content: normalizeArticleMediaCaptions(saved, "editor"),
    });
    expect(reopened.getJSON().content?.filter(n => n.type === "image")).toHaveLength(1);
    expect(reopened.getJSON().content?.find(n => n.type === "image")?.attrs?.caption).toBe(caption);
    editor.destroy();
    reopened.destroy();
  });

  it("binds provider video captions to their player cards and removes redundant body paragraphs", () => {
    const markup =
      '<figure class="wk-embed"><div class="wk-embed__ratio"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Video clip"></iframe></div>' +
      '<figcaption>A scene from the recording session. | Video: Artist</figcaption></figure>' +
      '<p>A scene from the recording session. | Video: Artist</p><p>The review continues.</p>';
    const normalized = normalizeArticleMediaCaptions(markup, "display");
    const { markedHtml, videos } = transformArticleHtmlForVideoEmbeds(normalized);
    expect(videos).toHaveLength(1);
    expect(videos[0].caption).toBe("A scene from the recording session. | Video: Artist");
    expect(markedHtml).toContain("<!--WK_VIDEO_0-->");
    expect(markedHtml).not.toContain("<figcaption");
    expect(markedHtml).not.toContain("A scene from the recording session.");
    expect(markedHtml).toContain("<p>The review continues.</p>");
  });
});
