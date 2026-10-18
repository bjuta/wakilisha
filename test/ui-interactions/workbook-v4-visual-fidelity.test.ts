import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");

describe("Workbook v4 source-backed public visual fidelity", () => {

  it("keeps authored Video and Podcasts page identity in loading and empty states", () => {
    const video = read("src/pages/video/page.tsx");
    const podcasts = read("src/pages/shows/page.tsx");
    expect(video).toContain('{!featured && (');
    expect(video).toContain('>Video</h1>');
    expect(video).toContain('No video is published yet.');
    expect(podcasts).toContain('{!shows[0] && (');
    expect(podcasts).toContain('>Podcasts</h1>');
    expect(podcasts).toContain('No podcasts have been published yet.');
    expect(podcasts).toContain("getPublicShow(first.slug)");
  });


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
    expect(mobile).toContain('data-wk-magazine-story-rail');
    expect(mobile).toContain('snap-x snap-mandatory');
    expect(mobile).toContain('useMagazineArticles(24)');
    expect(card).toContain('data-wk-magazine-feature="true"');
    expect(card).not.toContain('line-clamp-3 text-[clamp(20px,2.6vw,30px)]');
    const byline = read("src/pages/magazine/components/MagazineHeroMeta.tsx");
    for (const page of [desktop, mobile]) {
      expect(page).toContain("<MagazineHeroMeta");
      expect(page).toContain("rounded-full border border-white/45 bg-black/25");
      expect(page).not.toContain("bg-white px-5 text-[13px] font-bold text-black");
    }
    expect(byline).toContain('data-wk-magazine-hero-byline');
    expect(byline).toContain('new Intl.DateTimeFormat("en-KE"');
    expect(byline).not.toContain("bg-white/10 backdrop-blur-md");
    expect(mobile).toContain('useMagazineArticles(24)');
    expect(mobile).not.toContain('useMagazineArticles(500)');
  });

  it("renders one restrained newsletter at the end of Magazine and each article route", () => {
    const desktop = read("src/pages/magazine/page.tsx");
    const mobile = read("src/pages/mobile/magazine/page.tsx");
    const article = read("src/pages/magazine/article/page.tsx");
    const articleMobile = read("src/pages/mobile/magazine/article/page.tsx");

    expect(desktop.match(/<NewsletterSubscribe/g)).toHaveLength(1);
    expect(desktop).toContain('variant="default"');
    expect(desktop).not.toContain('id: "newsletter"');
    expect(desktop.match(/<NewsletterCTA \/>/g)).toHaveLength(1);
    expect(mobile.match(/<MobileNewsletterCTA \/>/g)).toHaveLength(1);
    expect(mobile.indexOf("<MobileNewsletterCTA />")).toBeGreaterThan(
      mobile.indexOf('aria-live="polite"'),
    );
    expect(article).toContain('aspect-[3/2] items-end justify-center overflow-hidden');
    expect(article).toContain('wk-reference-article-columns');
    expect(articleMobile).toContain('className="relative aspect-[4/5] overflow-hidden"');
    const articleCss = read("src/styles/wakilisha-article-prose.css");
    expect(articleCss).toContain("font-size: 19px;");
    expect(articleCss).toContain("line-height: 1.7;");
    for (const source of [article, articleMobile]) {
      expect(source.match(/<NewsletterSubscribe/g)).toHaveLength(1);
      expect(source).toContain('variant="default"');
      expect(source).toContain('data-wk-article-newsletter');
      expect(source).toContain('<ArticleRelated');
      expect(source.indexOf("data-wk-article-newsletter")).toBeGreaterThan(
        source.indexOf("<ArticleRelated"),
      );
    }
  });

  it("keeps Music workbook hierarchy theme-aware without decorative playback buttons", () => {
    const music = read("src/pages/music/page.tsx");
    const css = read("src/styles/wakilisha-workbook-surface-fidelity.css");
    expect(music).toContain('data-wk-workbook-screen="music"');
    expect(music).toContain("PlayableArtwork");
    expect(music).toContain('fit="contain"');
    expect(music).toContain('aria-label="Music discovery"');
    expect(music).toContain('listGenres()');
    expect(music).toContain('genre.artistImageUrl');
    expect(music).toContain('hasImage(genre.artistImageUrl)');
    expect(music).not.toContain('bg-[radial-gradient(circle_at_25%_20%');
    expect(music).toContain('to={`/genres/${genre.slug}`}');
    expect(music).toContain('<ChartMiniList entries={chartEntries} />');
    expect(music).toContain('onPlay(release, "fresh-arrivals")');
    expect(music).toContain('handlePlayRelease(');
    expect(music).toContain('onError={() => setFailedSrc(src)}');
    expect(music).toContain('loading="eager"');
    expect(music).not.toContain('aria-label="Previous arrivals"');
    expect(music).not.toContain('aria-label="Next arrivals"');
    expect(css).toContain('background-color: var(--wk-bg)');
    expect(css).toContain('border-radius: 24px');
    expect(css).toContain('color: var(--wk-text)');
    expect(css).not.toMatch(/--wk-bg\\s*:/);
    const workbookCss = read("src/styles/wakilisha-workbook-p1-p11-authority.css");
    const magazineCss = read("src/styles/wakilisha-magazine-38-44.css");
    for (const stylesheet of [css, workbookCss, magazineCss]) {
      expect(stylesheet).not.toMatch(/^\\s*--wk-(bg|text|brand)\\s*:/m);
    }
    expect(workbookCss).toContain("background: var(--wk-bg)");
    expect(workbookCss).toContain("color: var(--wk-text)");
    expect(workbookCss).toContain(".wk-reference-article-columns");
    const theme = read("src/design-system/wakilisha.tokens.css");
    expect(theme).toContain("[data-wk-theme='dark']");
    expect(theme).toContain("[data-wk-theme='light']");
  });

  it("switches complete workbook palettes with the app theme without touching Artists", () => {
    const css = read("src/styles/wakilisha-workbook-p1-p11-authority.css");
    const tokens = read("src/design-system/wakilisha.tokens.css");
    expect(tokens).toContain("[data-wk-theme='light']");
    expect(tokens).toContain("[data-wk-theme='dark']");
    expect(css).toContain(':where([data-wk-theme="light"]) :is(');
    expect(css).toContain(':where([data-wk-theme="dark"],:root:not([data-wk-theme="light"])) :is(');
    expect(css).toContain('--wk-bg:#FCFCFB;');
    expect(css).toContain('--wk-bg:#0B0B0B;');
    expect(css).toContain('--wk-brand:#4E7425;');
    expect(css).toContain('--wk-brand:#85C441;');
    expect(css).not.toContain('--wk-bg:#F5F2EC;');
    expect(css).toContain('--wk-surface:#FFFFFF;');
    expect(css).toContain('[data-following-header]');
    expect(css).toContain('[data-wk-message-bubble]');
    expect(css).toContain('.wk-workbook-article-paper');
    expect(css).not.toContain('[data-wk-workbook-screen="artist"]');
    expect(css).not.toContain('[data-wk-workbook-screen="artist-detail"]');
  });

  it("preserves readable inboxes, active actions and a real desktop notification settings panel", () => {
    const notifications = read("src/pages/notifications/page.tsx");
    const messages = read("src/pages/messages/page.tsx");
    expect(notifications).toContain('aria-label="Notification preferences"');
    expect(notifications).toContain('Tell me about');
    expect(notifications).toContain('community_get_notification_prefs');
    expect(notifications).toContain('community_update_notification_prefs');
    expect(notifications).toContain('WakilishaToggle');
    expect(notifications).toContain('contributionNotifications');
    expect(notifications).not.toContain('saveAll(');
    expect(notifications).toContain('to="/settings?section=Notifications"');
    expect(notifications).toContain('hidden self-start border-l border-[var(--wk-border)]');
    expect(notifications).toContain('aria-label="Notification filters"');
    expect(notifications).toContain('handleMarkAll()');
    expect(notifications).toContain('notificationTarget(');
    expect(notifications).toContain('notification.actor?.avatarUrl');
    expect(notifications).toContain('data-wk-notification-row');
    expect(messages).toContain('data-wk-message-conversation');
    expect(messages).toContain('data-wk-message-bubble');
    const safety = read("src/pages/messages/MessageSafetyState.tsx");
    expect(safety).toContain('effective.length === 0');
    expect(safety).toContain('state.can_send');
    expect(safety).toContain('state.can_start');
    expect(safety).toContain("Previous Messages safety activity");
    expect(safety).toContain("Close Safety History");
    expect(messages).toContain('listMessageConversations(nextFolder)');
    expect(messages).toContain('sendMessage(selectedId, composer.trim())');
    expect(messages).toContain('bg-[var(--wk-brand)] text-[var(--wk-brand-on)]');
    expect(messages).toContain('whitespace-pre-wrap break-words text-[15px]');
  });

  it("retains authentic Following actions and respects source media ratios", () => {
    const following = read("src/pages/following/page.tsx");
    expect(following).toContain('data-following-activity');
    expect(following).toContain('data-following-header');
    expect(following).toContain('data-following-media');
    expect(following).toContain('data-following-body');
    expect(following).toContain('mx-auto aspect-square w-full max-w-[520px]');
    expect(following).toContain('mx-auto aspect-[3/2] w-full max-w-[680px]');
    expect(following).toContain('aria-label="Following feed filters"');
    expect(following).toContain('reason.targetType === "artist"');
    expect(following).toContain('visibleItems.map((item)');
    expect(following).toContain('PostActions');
    expect(following).toContain('<FollowingShareAction');
    expect(following).toContain('New work from the people you follow.');
    expect(following).not.toContain('Your People Are Still Here');
  });
});
