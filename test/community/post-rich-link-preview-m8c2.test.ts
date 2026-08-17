import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const root = process.cwd();
const read = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf8");

describe("M8C.2 universal rich Post Link presentation", () => {
  it("keeps WAKILISHA Articles on governed public Article authority", () => {
    const source = read(
      "src/services/community/postLinkPreview.ts",
    );

    expect(source).toContain("getArticle,");
    expect(source).toContain("type PublicArticleDetail");
    expect(source).toContain('segments[0] === "magazine"');
    expect(source).toContain("article.dek");
    expect(source).toContain("article.heroUrl");
    expect(source).toContain("article.seo");
    expect(source).toContain('kind: "wakilisha_article"');
  });

  it("resolves every other HTTP link through one server-side origin metadata function", () => {
    const client = read(
      "src/services/community/postLinkPreview.ts",
    );
    const edge = read(
      "supabase/functions/link-preview-read/index.ts",
    );

    expect(client).toContain(
      'supabase.functions.invoke(',
    );
    expect(client).toContain(
      '"link-preview-read"',
    );
    expect(client).toContain(
      'kind: "origin_rich"',
    );
    expect(edge).toContain("og:title");
    expect(edge).toContain("og:description");
    expect(edge).toContain("og:image");
    expect(edge).toContain("og:site_name");
    expect(edge).toContain("twitter:title");
    expect(edge).toContain("twitter:description");
    expect(edge).toContain("twitter:image");
    expect(edge).toContain("<title");
  });

  it("hardens origin fetching against private-network SSRF and redirect bypasses", () => {
    const edge = read(
      "supabase/functions/link-preview-read/index.ts",
    );

    expect(edge).toContain('Deno.resolveDns(host, "A")');
    expect(edge).toContain('Deno.resolveDns(host, "AAAA")');
    expect(edge).toContain("isUnsafeIpv4");
    expect(edge).toContain("isUnsafeIpv6");
    expect(edge).toContain("private_target");
    expect(edge).toContain('redirect: "manual"');
    expect(edge).toContain("MAX_REDIRECTS = 4");
    expect(edge).toContain("credentials_not_allowed");
    expect(edge).toContain("port_not_allowed");
  });

  it("caps remote work by rate, timeout, URL length and HTML bytes", () => {
    const edge = read(
      "supabase/functions/link-preview-read/index.ts",
    );

    expect(edge).toContain("MAX_URL_LENGTH = 2048");
    expect(edge).toContain("MAX_HTML_BYTES = 262_144");
    expect(edge).toContain("FETCH_TIMEOUT_MS = 5_000");
    expect(edge).toContain("RATE_MAX = 60");
    expect(edge).toContain("controller.abort()");
    expect(edge).toContain("readLimitedText");
  });

  it("caches derived previews without making them Post authority", () => {
    const client = read(
      "src/services/community/postLinkPreview.ts",
    );
    const edge = read(
      "supabase/functions/link-preview-read/index.ts",
    );
    const posts = read(
      "src/services/community/posts.ts",
    );

    expect(client).toContain("previewCache");
    expect(edge).toContain("previewCache");
    expect(client).not.toContain("community_posts");
    expect(edge).not.toContain("community_posts");
    expect(posts).toContain("p_link_url");
  });

  it("renders origin image, title, description, site and content type through one card", () => {
    const source = read(
      "src/components/community/PostLinkAttachment.tsx",
    );

    expect(source).toContain("preview.imageUrl");
    expect(source).toContain("preview.title");
    expect(source).toContain("preview.description");
    expect(source).toContain("preview.siteName");
    expect(source).toContain("preview.section");
    expect(source).toContain("preview.displayHost");
    expect(source).toContain(
      'data-post-link-attachment="rich"',
    );
  });

  it("uses the shared rich card in composer, Following, Artist timeline, detail and Quotes", () => {
    const files = [
      "src/components/community/PostComposer.tsx",
      "src/components/community/PostDetailSurface.tsx",
      "src/components/community/QuotedPostCard.tsx",
      "src/pages/following/page.tsx",
      "src/pages/artists/detail/components/ArtistPostsTimeline.tsx",
    ];

    for (const file of files) {
      expect(read(file)).toContain("PostLinkAttachment");
    }
  });

  it("turns a pasted standalone URL into the Link attachment instead of body text", () => {
    const composer = read(
      "src/components/community/PostComposer.tsx",
    );
    const service = read(
      "src/services/community/postLinkPreview.ts",
    );

    expect(composer).toContain("handleBodyPaste");
    expect(composer).toContain("onPaste={handleBodyPaste}");
    expect(composer).toContain(
      'event.clipboardData.getData("text/plain")',
    );
    expect(composer).toContain("event.preventDefault()");
    expect(composer).toContain(
      "setLinkUrl(extracted.linkUrl)",
    );
    expect(composer).toContain("setBody(nextBody)");
    expect(composer).not.toContain("setShowLink");
    expect(service).toContain(
      "export function extractPostLinkFromText",
    );
    expect(service).toContain(
      "export function normalizePostLinkUrl",
    );
  });

  it("leaves ordinary paste alone when a Link attachment already exists", () => {
    const composer = read(
      "src/components/community/PostComposer.tsx",
    );

    expect(composer).toContain(
      "if (linkUrl.trim()) return;",
    );
  });

  it("does not expose Link implementation controls in the composer", () => {
    const composer = read(
      "src/components/community/PostComposer.tsx",
    );

    expect(composer).not.toContain(
      'aria-label="Add Link"',
    );
    expect(composer).not.toContain(
      'title="Link"',
    );
    expect(composer).not.toContain(
      '>Link Label<',
    );
    expect(composer).not.toContain(
      'WkIcon name="Link2"',
    );
    expect(composer).not.toContain(
      "showLink",
    );
  });

  it("promotes typed URLs without requiring a Link field", () => {
    const composer = read(
      "src/components/community/PostComposer.tsx",
    );
    const service = read(
      "src/services/community/postLinkPreview.ts",
    );

    expect(composer).toContain(
      "handleBodyChange",
    );
    expect(composer).toContain(
      "handleBodyBlur",
    );
    expect(composer).toContain(
      "promoteBodyLink(nextBody, true)",
    );
    expect(composer).toContain(
      "promoteBodyLink(body, false)",
    );
    expect(service).toContain(
      "export function extractPostLinkFromText",
    );
  });

  it("lets a person explicitly remove an auto-unfurled Link attachment", () => {
    const composer = read(
      "src/components/community/PostComposer.tsx",
    );

    expect(composer).toContain(
      "function removeLinkAttachment()",
    );
    expect(composer).toContain(
      'aria-label="Remove Link"',
    );
    expect(composer).toContain(
      'setLinkUrl("");',
    );
  });

  it("keeps a compact safe fallback when the origin exposes no useful richness", () => {
    const source = read(
      "src/components/community/PostLinkAttachment.tsx",
    );

    expect(source).toContain(
      'data-post-link-attachment="fallback"',
    );
    expect(source).toContain(
      'rel="noopener noreferrer"',
    );
    expect(source).toContain('target="_blank"');
  });

  it("keeps the Edge Function public gateway explicit", () => {
    const config = read("supabase/config.toml");

    expect(config).toContain(
      "[functions.link-preview-read]",
    );
    expect(config).toContain(
      "[functions.link-preview-read]\nverify_jwt = false",
    );
  });

  it("mobile full-screen composer portals above persistent chrome", () => {
    const composer = read(
      "src/components/community/PostComposer.tsx",
    );

    expect(composer).toContain(
      'import { Portal } from "@/components/base/Portal";',
    );
    expect(composer).toContain(
      'import { useScrollLock } from "@/hooks/useScrollLock";',
    );
    expect(composer).toContain(
      'window.matchMedia("(max-width: 639px)")',
    );
    expect(composer).toContain(
      "useScrollLock(open && mobileComposerViewport)",
    );
    expect(composer).toContain(
      "const composerSurface = (",
    );
    expect(composer).toContain(
      "? <Portal>{composerSurface}</Portal>",
    );
    expect(composer).toContain(
      'aria-label="Remove Link"',
    );
    expect(composer).toContain(
      "right-3 top-3 z-10 flex h-11 w-11",
    );
    expect(composer).toContain(
      'bg-[var(--wk-surface)] text-[var(--wk-text)] shadow-lg',
    );
  });

  it("renders authored attachments before the quoted source", () => {
    const composer = read(
      "src/components/community/PostComposer.tsx",
    );

    const imageIndex = composer.indexOf(
      "{imageUrl && (",
    );
    const trackIndex = composer.indexOf(
      "{selectedTrack && (",
    );
    const linkIndex = composer.indexOf(
      "{linkUrl.trim() ? (",
    );
    const quoteIndex = composer.indexOf(
      "{quotePresentation && (",
    );
    const inputIndex = composer.indexOf(
      "<input\n            ref={inputRef}",
    );

    expect(imageIndex).toBeGreaterThan(-1);
    expect(trackIndex).toBeGreaterThan(-1);
    expect(linkIndex).toBeGreaterThan(-1);
    expect(quoteIndex).toBeGreaterThan(-1);
    expect(inputIndex).toBeGreaterThan(-1);

    expect(imageIndex).toBeLessThan(trackIndex);
    expect(trackIndex).toBeLessThan(linkIndex);
    expect(linkIndex).toBeLessThan(quoteIndex);
    expect(quoteIndex).toBeLessThan(inputIndex);

    expect(composer).toContain(
      'className="ml-[52px] mt-3 sm:ml-0 sm:mt-4"',
    );
  });

  it("published Post surfaces render authored Link before quoted source", () => {
    const surfaces = [
      "src/components/community/PostDetailSurface.tsx",
      "src/pages/following/page.tsx",
      "src/pages/artists/detail/components/ArtistPostsTimeline.tsx",
    ];

    for (const surface of surfaces) {
      const source = read(surface);
      const linkIndex = source.indexOf(
        "<PostLinkAttachment",
      );
      const quoteIndex = source.indexOf(
        "<QuotedPostCard",
      );

      expect(linkIndex).toBeGreaterThan(-1);
      expect(quoteIndex).toBeGreaterThan(-1);
      expect(linkIndex).toBeLessThan(quoteIndex);
    }
  });

  it("keeps new runtime copy free of em and en dashes", () => {
    const files = [
      "src/services/community/postLinkPreview.ts",
      "src/components/community/PostLinkAttachment.tsx",
      "supabase/functions/link-preview-read/index.ts",
    ];

    for (const file of files) {
      const source = read(file);
      expect(source).not.toContain("—");
      expect(source).not.toContain("–");
    }
  });
});
