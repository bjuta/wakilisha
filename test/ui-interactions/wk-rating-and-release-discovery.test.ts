// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { RatingNode } from "@/components/admin/editor/RatingNode";
import { EDITOR_MENU_REGISTRY } from "@/components/design-system/editorial/editorCommandRegistry";
import { readFileSync } from "node:fs";
import { canonicalRating, ratingHtml, ratingParts } from "@/components/admin/editor/RatingNode";
import { extractPublishedReviewVerdict } from "@/utils/editorialRating";
import { transformTrackShortcodes } from "@/utils/transformTrackShortcodes";
import { transformReleaseShortcodes } from "@/utils/transformReleaseShortcodes";
import { resolveRegistryEmbedIdentity, unresolvedRegistryEmbed } from "@/utils/registryEmbedIdentity";

const read = (path: string) => readFileSync(path, "utf8");
const editor = read("src/components/design-system/editorial/RichTextEditor.tsx");
const discovery = read("src/services/articles/editorialReleaseSearch.ts");
const picker = read("src/components/admin/editor/RatingComposerModal.tsx");

describe("Workbook (3), Chapter 24 rating authority", () => {
  it("admits only nine whole and half steps from 1 to 5", () => {
    for (let value = 1; value <= 5; value += 0.5) expect(canonicalRating(value)).toBe(value);
    expect(canonicalRating("2,5")).toBe(2.5);
    expect(canonicalRating("3,5")).toBe(3.5);
    for (const value of [0, 0.5, 1.25, 3.75, 5.5, NaN, Infinity, null, true, "", "bad", "2,50"]) expect(canonicalRating(value)).toBeNull();
  });
  it("renders an atomic, accessible five-star rating with normalized numbers", () => {
    const html = ratingHtml({value:3.5,role:"inline",display:"both",label:"",subject:"",breakdown:[]});
    expect(html[0]).toBe("span");
    const attrs = html[1] as Record<string, string>;
    expect(attrs["data-wk-rating-value"]).toBe("3.5");
    expect(attrs["aria-label"]).toBe("Rated 3.5 out of 5");
    expect(JSON.stringify(html)).not.toMatch(/★|☆|⭐/);
  });
  it("offers Rating in the same Insert menu as Release, Artist and Track, and inserts an actual atom", () => {
    const menu = EDITOR_MENU_REGISTRY.find((item) => item.id === "insert");
    expect(menu).toBeDefined();
    const actions = menu!.items.map((item) => item.command);
    for (const name of ["insertRating", "insertRelease", "insertArtist", "insertTrack"]) {
      expect(actions).toContain(name);
    }
    const editorInstance = new Editor({
      extensions: [StarterKit, RatingNode],
      content: "<p>A record deserving a proper rating. </p>",
    });
    expect(editorInstance.commands.insertContent({
      type: "wkRating",
      attrs: { value: 2.5, role: "inline", display: "both", label: "", subject: "", breakdown: [] },
    })).toBe(true);
    const html = editorInstance.getHTML();
    expect(html).toContain('data-wk-rating-value="2.5"');
    expect(html).toContain("wk-rating-stars");
    expect(html).not.toContain("[wk-rating");
    expect(html).not.toContain("★");
    editorInstance.destroy();
  });

  it("survives TipTap HTML save, reopen and document JSON roundtrip", () => {
    const original = new Editor({
      extensions: [StarterKit, RatingNode],
      content: '<p>The final score: <span data-wk-rating="" data-wk-rating-value="3.5" data-wk-rating-role="inline" data-wk-rating-display="both" data-wk-rating-label="" data-wk-rating-subject="" data-wk-rating-breakdown="[]"></span></p>',
    });
    const serialized = original.getHTML();
    expect(serialized).toContain('data-wk-rating-value="3.5"');
    expect(serialized).toContain("wk-rating-stars");
    const svg = original.view.dom.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg?.querySelector("path")?.namespaceURI).toBe("http://www.w3.org/2000/svg");
    const restored = new Editor({ extensions: [StarterKit, RatingNode], content: serialized });
    const nodes = restored.getJSON().content?.[0]?.content ?? [];
    expect(nodes.some((node) => node.type === "wkRating" && node.attrs?.value === 3.5)).toBe(true);
    original.destroy();
    restored.destroy();
  });
  it("speaks each scored part and uses the correct breakdown heading", () => {
    const content = ratingHtml({
      value: 3.5, role: "breakdown", display: "both", label: "",
      subject: "Forever to Never", breakdown: [{label: "Production", value: 4.0}],
    });
    expect((content[1] as Record<string, string>)["aria-label"]).toContain("Production: 4.0 out of 5");
    expect(JSON.stringify(content)).toContain("Rating Breakdown");
  });
  it("rejects malformed breakdown entries", () => {
    expect(ratingParts([{label:"Production",value:3.5},{label:"Quarter",value:2.25},{label:"",value:4}]))
      .toEqual([{label:"Production",value:3.5}]);
  });
  it("keeps public rating validation isolated from rich-text editor dependencies", () => {
    expect(read("src/utils/editorialRating.ts")).toContain('from "@/utils/ratingValue"');
    expect(read("src/utils/editorialRating.ts")).not.toContain("@/components/admin/editor/");
  });
  it("syndicates only an attributed verdict", () => {
    const valid = '<span data-wk-rating="" data-wk-rating-value="3.5" data-wk-rating-role="verdict" data-wk-rating-subject="Forever to Never by Charisma"></span>';
    expect(extractPublishedReviewVerdict(valid)).toEqual({value:3.5,subject:"Forever to Never by Charisma"});
    expect(extractPublishedReviewVerdict(valid.replace('role="verdict"','role="inline"'))).toBeNull();
    expect(extractPublishedReviewVerdict(valid.replace('subject="Forever to Never by Charisma"','subject=""'))).toBeNull();
    expect(extractPublishedReviewVerdict("Rating: 3.5 out of 5")).toBeNull();
  });
  it("inserts from both menu and slash command and never auto-rewrites prose", () => {
    expect(editor).toContain("RatingNode,");
    expect(editor).toContain("<RatingComposerModal");
    expect(editor).toContain("tr.insert(tr.doc.content.size");
    expect(editor).toContain("onClick={convertWrittenRating}");
    expect(editor).toContain("[.,][05]");
    expect(editor).toContain("handleClickOn: (_view, _clickedPos, node, nodePos)");
    expect(editor).toContain("setEditingRatingPosition(nodePos)");
    expect(read("src/components/design-system/editorial/editorCommandRegistry.ts")).toContain('"insertRating"');
    expect(read("src/components/admin/editor/SlashCommandSuggestion.ts")).toContain('id: "rating"');
    expect(picker).toContain("ArrowRight");
    expect(picker).toContain("aria-pressed={score === value}");
    expect(picker).not.toContain("<select");
  });
});
describe("Live Registry Insert authority", () => {
  it("replaces the old alphabetically capped cache with server-side queries", () => {
    expect(editor).toContain("searchEditorialReleases(query)");
    expect(editor).not.toContain("useReleaseSearchData");
    expect(discovery).toContain('.ilike("title", pattern)');
    expect(discovery).toContain('.ilike("artist_name_text", pattern)');
    expect(discovery).toContain('.order("created_at", { ascending: false })');
    expect(discovery).not.toContain(".limit(200)");
    expect(discovery).toContain("release_type,artwork_url,release_date");
    expect(discovery).toContain('declaredType === "ep"');
    expect(discovery).toContain('declaredType === "album"');
    expect(discovery).toContain('declaredType === "single"');
  });
  it("displays drafts but forbids premature embed insertion", () => {
    expect(discovery).toContain('.in("status", ["active", "draft"])');
    expect(editor).toContain('release.status !== "active"');
    expect(editor).toContain("Draft · available after Registry activation");
    expect(editor).toContain('if (release.status === "active")');
  });
});

describe("Article Registry embed identity across duplicate titles", () => {
  const first = { id: "34fa7899-3bfd-5286-8ae2-df22f326fe09", slug: "how-can-i-forget", artist: "Artist A" };
  const second = { id: "11a11111-2222-4333-8444-555555555555", slug: "how-can-i-forget", artist: "Artist B" };
  const rows = [first, second];

  it("always selects the exact canonical Track or Release UUID", () => {
    for (const id of [first.id, second.id]) {
      const row = resolveRegistryEmbedIdentity({ id }, rows, rows);
      expect(row?.id).toBe(id);
    }
    expect(resolveRegistryEmbedIdentity({ id: "00000000-0000-4000-8000-000000000000", slug: first.slug }, rows, rows)).toBeNull();
  });

  it("never guesses for legacy same-slug Tracks or Releases", () => {
    expect(resolveRegistryEmbedIdentity({ slug: first.slug }, rows, rows)).toBeNull();
    expect(resolveRegistryEmbedIdentity({ slug: first.slug }, [], [first])).toEqual(first);
    expect(resolveRegistryEmbedIdentity({ slug: "not-present" }, rows, rows)).toBeNull();
    const warning = unresolvedRegistryEmbed("track", "ambiguous-legacy-slug");
    expect(warning).toContain('data-wk-registry-reason="ambiguous-legacy-slug"');
    expect(warning).not.toContain(first.slug);
  });

  it("parses canonical IDs and keeps old unique-slug syntax backward compatible", () => {
    expect(transformTrackShortcodes(`[wk-track id="${first.id}"]`))
      .toBe(`<!--WK_REGISTRY_TRACK_ID:${first.id}-->`);
    expect(transformReleaseShortcodes(`[wk-release id="${second.id}"]`))
      .toBe(`<!--WK_REGISTRY_RELEASE_ID:${second.id}-->`);
    expect(transformTrackShortcodes('[wk-track slug="how-can-i-forget"]'))
      .toBe('<!--WK_REGISTRY_TRACK:how-can-i-forget-->');
    expect(transformReleaseShortcodes('[wk-release slug="balance" artist="one-artist"]'))
      .toBe('<!--WK_REGISTRY_RELEASE:balance:one-artist:-->');
  });

  it("never falls back to slug when an explicit identity is invalid", () => {
    for (const shortcode of [
      '[wk-track id="bad-id" slug="how-can-i-forget"]',
      '[wk-release id="bad-id" slug="balance"]',
    ]) {
      const transformed = shortcode.startsWith("[wk-track")
        ? transformTrackShortcodes(shortcode)
        : transformReleaseShortcodes(shortcode);
      expect(transformed).toBe(shortcode);
    }
  });

  it("binds editor selection and public resolution to IDs, not slugs", () => {
    const trackSource = read("src/pages/magazine/article/components/ArticleTrackEmbeds.tsx");
    const releaseSource = read("src/pages/magazine/article/components/ArticleReleaseEmbeds.tsx");
    expect(editor).toContain('handleInsertTrackShortcode(\n                          track.id,');
    expect(editor).toContain('handleInsertReleaseShortcode(release.id)');
    expect(editor).toContain('[wk-track id="${id}"]');
    expect(editor).toContain('[wk-release id="${id}"]');
    for (const source of [trackSource, releaseSource]) {
      expect(source).toContain('resolveRegistryEmbedIdentity(mk, exactRows, legacyRows)');
      expect(source).toContain('.in("id", ids)');
      expect(source).toContain('.in("slug", slugs)');
      expect(source).toContain('"ambiguous-legacy-slug"');
      expect(source).not.toContain("new Map(releaseRows.map((r) => [r.slug, r]))");
      expect(source).not.toContain("new Map(trackRows.map((t) => [t.slug, t]))");
    }
    expect(trackSource).toContain("id: track.id,\n      registryTrackId: track.id");
    expect(releaseSource).toContain("id: t.registryTrackId || t.isrc");
  });
});
