import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");

describe("Workbook v4 source-backed public visual fidelity", () => {
  it("keeps Oct 23 screenshot corrections and true theme wordmark identity", () => {
    const css = read("src/styles/wakilisha-social-workbook-p6-p8.css");
    const brand = read("src/components/design-system/branding/WakilishaSectionLogo.tsx");
    const following = read("src/pages/following/page.tsx");
    const messages = read("src/pages/messages/page.tsx");
    const notifications = read("src/pages/notifications/page.tsx");
    const nav = read("src/components/mobile/MobileTopBar.tsx");
    const playerTop = read("src/components/design-system/player/PlayerTopBar.tsx");
    const mobilePlayer = read("src/components/design-system/player/PlayerFullSurface.tsx");
    const article = read("src/pages/mobile/magazine/article/page.tsx");
    expect(brand).toContain('theme === "dark"');
    expect(brand).toContain("wakilisha-logo-dark.svg");
    expect(brand).toContain("wakilisha-logo-light.svg");
    expect(nav).toContain("<WakilishaSectionLogo />");
    for (const screen of [following, messages, notifications]) {
      expect(screen).not.toContain("<WakilishaSectionLogo />");
    }
    expect(nav).toContain("bg-transparent");
    expect(nav).toContain("text-white");
    expect(nav).toContain("mix-blend-difference");
    expect(playerTop).toContain("grid-cols-[44px_minmax(0,1fr)_44px]");
    expect(playerTop).toContain("text-[var(--wk-text)]");
    expect(mobilePlayer).toContain("calc(80px + env(safe-area-inset-top))");
    expect(article).not.toContain('text-white/75">{article.author}');
    expect(article).toContain("ArticleAuthorIdentity");
    expect(nav).toContain("data-wk-article-hero-overlay");
    expect(article).toContain('section key="mobile-article-hero-shell"');
    expect(messages).not.toContain("data-wk-social-brand-row");
    expect(notifications).not.toContain("{unreadCount} unread");
    expect(notifications).toContain("data-wk-dm-unread-count");
    expect(notifications).toContain("listMessageConversations");
    expect(css).toContain('border-top: 0;');
    expect(css).toContain('position: relative;');
    expect(css).toContain('padding-top: calc(56px + env(safe-area-inset-top));');
  });

  it("follows the P6/P7/P8 source order and verified UI-only bounds", () => {
    const css = read("src/styles/wakilisha-social-workbook-p6-p8.css");
    const posts = read("src/components/community/PostActions.tsx");
    const following = read("src/pages/following/page.tsx");
    const messages = read("src/pages/messages/page.tsx");
    const notifs = read("src/pages/notifications/page.tsx");
    const contract = read("src/services/messages.ts");

    expect(css).toContain('article[data-following-activity] {');
    expect(css).toContain('display: grid;');
    expect(css).toContain('justify-content: space-between;');
    for (const action of ["reply", "repost", "react", "save", "share"]) {
      expect(posts).toContain(`data-wk-post-action="${action}"`);
    }
    for (const icon of ["MessageCircle", "Repeat2", "Heart", "Bookmark", "Share2"]) {
      expect(posts).toContain(`name="${icon}"`);
    }
    expect(following).toContain("compactFollowing");
    expect(read("src/components/community/PostComposer.tsx")).toContain("What are you listening to?");
    expect(following).toContain("FollowingReactionAction");
    expect(messages).toContain('data-message-owner={mine ? "self" : "other"}');
    expect(messages).toContain("data-wk-message-receipt");
    expect(messages).toContain("data-wk-message-reference");
    expect(messages).toContain("message.recipient_read_at");
    expect(css).toContain('height: 100dvh;');
    expect(css).toContain('[data-wk-mobile-app-header]');

    expect(notifs).toContain("const recent = !notification.readAt;");
    expect(notifs).toContain("data-wk-notification-group");
    expect(notifs).toContain("data-wk-notification-time");
    expect(notifs).toContain("data-wk-notification-copy");
    expect(notifs).toContain('name="MoreHorizontal"');
    expect(notifs).toContain("community_update_notification_prefs");
    // Voice recordings need an authorized media-message contract before send.
    expect(contract).toContain('presentation_kind: "resource" | "version"');
    expect(messages).toContain("sendMessage(selectedId, composer.trim())");
    expect(messages).not.toContain("MediaRecorder");
    expect(posts).not.toContain('name="BadgeCheck"');
  });


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
    expect(mobile).toContain('min-h-[max(500px,70dvh)]');
    expect(mobile).toContain('px-5 pb-12 pt-28 text-white');
    expect(desktop).toContain('h-[min(70vw,580px)] min-h-[440px]');
    expect(desktop).toContain('pb-16 pt-32 text-white');
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
    expect(notifications).toContain('data-wk-notifications-preferences');
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

  it("preserves P6 P7 P8 workbook geometry and both theme token bindings", () => {
    const css = read("src/styles/wakilisha-social-workbook-p6-p8.css");
    const following = read("src/pages/following/page.tsx");
    const messages = read("src/pages/messages/page.tsx");
    const notifications = read("src/pages/notifications/page.tsx");
    const composer = read("src/components/community/PostComposer.tsx");

    expect(css).toContain('grid-template-columns: 44px minmax(0,1fr)');
    expect(css).toContain('[data-wk-following-discovery]');
    expect(css).toContain('[data-wk-message-bubble]');
    expect(css).toContain('[data-wk-notifications-preferences]');
    expect(css).toContain('background: var(--wk-surface)');
    expect(css).toContain('color: var(--wk-text)');
    expect(css).toContain('@media (max-width: 639px)');

    expect(following).toContain('lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)]');
    expect(notifications).toContain('lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)]');
    expect(following).toContain('["all", "Following"]');
    expect(following).toContain('["artists", "Artists only"]');
    expect(following).toContain('ActivityAnchorAvatar subject={person}');
    expect(composer).toContain('What are you listening to?');
    expect(composer).toContain('compactFollowing?: boolean;');
    expect(composer).toContain('data-wk-following-mobile-compose');
    expect(messages).toContain('minmax(280px,34%)_minmax(0,1fr)');
    expect(messages).toContain('selectedId ? "flex" : "hidden lg:flex"');
    expect(messages).toContain('data-wk-thread-selected={selectedId ? "true" : "false"}');
    expect(read("src/components/design-system/music/PlayerDock.tsx")).toContain("data-wk-player-dock");
    expect(css).toContain('body:has([data-wk-workbook-screen="messages"]');
    expect(messages).toContain('aria-label="Conversation actions"');
    expect(notifications).toContain('data-wk-notification-type={notification.notificationType}');
    expect(notifications).toContain('wk-notification-event-icon');
    expect(notifications).toContain('<WkIcon name={icon} size={18}');
    expect(notifications).toContain('new_release: "Disc"');
    expect(notifications).toContain('post_like: "Heart"');
    expect(notifications).toContain('reply: "MessageSquare"');
    expect(notifications).toContain('notification.actor?.avatarUrl');
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
    expect(following).toContain('data-wk-following-layout');
    expect(following).toContain('data-wk-following-discovery');
    expect(following).toContain('Your circle');
    expect(following).toContain('compactFollowing');
    expect(following).toContain('Artists only');
    expect(following).not.toContain('max-w-[850px] pb-10 pt-6');
    expect(following).not.toContain('Your People Are Still Here');
  });
});
