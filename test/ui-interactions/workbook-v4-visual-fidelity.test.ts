import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");

describe("Workbook v4 source-backed public visual fidelity", () => {
  it("keeps Magazine editorial imagery, categories and readable excerpts", () => {
    const card = read("src/pages/magazine/components/MagazineCard.tsx");
    const css = read("src/styles/wakilisha-magazine-38-44.css");
    const desktop = read("src/pages/magazine/page.tsx");
    const mobile = read("src/pages/mobile/magazine/page.tsx");

    expect(card).toContain('data-wk-magazine-category={story.section.trim().toLowerCase()}');
    expect(card).toContain('className="aspect-[3/2] overflow-hidden rounded-[12px]');
    expect(card).toContain('line-clamp-2 text-[15px]');
    expect(card).not.toContain('group-hover:rotate-');
    expect(css).toContain('border-radius: 12px;');
    expect(css).toContain('data-wk-magazine-category*="album"');
    expect(css).toContain('data-wk-magazine-category*="opinion"');
    expect(desktop).toContain('text-[clamp(22px,2.5vw,30px)]');
    expect(mobile).toContain('text-[22px] font-bold');
    expect(mobile).toContain('grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2');
    expect(mobile).toContain('useMagazineArticles(24)');
  });

  it("renders one restrained newsletter at the end of Magazine and each article route", () => {
    const desktop = read("src/pages/magazine/page.tsx");
    const mobile = read("src/pages/mobile/magazine/page.tsx");
    const article = read("src/pages/magazine/article/page.tsx");
    const articleMobile = read("src/pages/mobile/magazine/article/page.tsx");

    expect(desktop.match(/<NewsletterSubscribe/g)).toHaveLength(1);
    expect(desktop).not.toContain('id: "newsletter"');
    expect(desktop.match(/<NewsletterCTA \/>/g)).toHaveLength(1);
    expect(mobile.match(/<MobileNewsletterCTA \/>/g)).toHaveLength(1);
    expect(mobile.indexOf("<MobileNewsletterCTA />")).toBeGreaterThan(
      mobile.indexOf('aria-live="polite"'),
    );
    for (const source of [article, articleMobile]) {
      expect(source.match(/<NewsletterSubscribe/g)).toHaveLength(1);
      expect(source).toContain('variant="compact"');
      expect(source).toContain('data-wk-article-newsletter');
      expect(source).toContain('<ArticleRelated');
      expect(source.indexOf("data-wk-article-newsletter")).toBeGreaterThan(
        source.indexOf("<ArticleRelated"),
      );
    }
  });

  it("sets Music to genuine night mode without decorative playback buttons", () => {
    const music = read("src/pages/music/page.tsx");
    const css = read("src/styles/wakilisha-workbook-surface-fidelity.css");
    expect(music).toContain('data-wk-workbook-screen="music"');
    expect(music).toContain("PlayableArtwork");
    expect(music).toContain('onPlay(release, "fresh-arrivals")');
    expect(music).toContain('handlePlayRelease(');
    expect(music).not.toContain('aria-label="Previous arrivals"');
    expect(music).not.toContain('aria-label="Next arrivals"');
    expect(css).toContain('--wk-bg: #0b0b0b');
    expect(css).toContain('border-radius: 24px');
    expect(css).toContain('--wk-brand: #85c441');
  });

  it("preserves readable inboxes, active actions and a real desktop notification sidebar", () => {
    const notifications = read("src/pages/notifications/page.tsx");
    const messages = read("src/pages/messages/page.tsx");
    expect(notifications).toContain('aria-label="Notification category navigation"');
    expect(notifications).toContain('className="hidden self-start lg:block"');
    expect(notifications).toContain('aria-label="Notification filters"');
    expect(notifications).toContain('handleMarkAll()');
    expect(notifications).toContain('notificationTarget(');
    expect(messages).toContain('listMessageConversations(nextFolder)');
    expect(messages).toContain('sendMessage(selectedId, composer.trim())');
    expect(messages).toContain('"bg-[#4E7425] text-white"');
    expect(messages).toContain('whitespace-pre-wrap break-words text-[15px]');
  });

  it("retains authentic Following actions and respects source media ratios", () => {
    const following = read("src/pages/following/page.tsx");
    expect(following).toContain('data-following-activity');
    expect(following).toContain('mx-auto aspect-square w-full max-w-[520px]');
    expect(following).toContain('mx-auto aspect-[3/2] w-full max-w-[680px]');
    expect(following).toContain('PostActions');
    expect(following).toContain('<FollowingShareAction');
    expect(following).toContain('New work from the people you follow.');
    expect(following).not.toContain('Your People Are Still Here');
  });
});
