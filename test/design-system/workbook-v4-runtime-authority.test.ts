import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(name, "utf8");

describe("Workbook v4 is the only active product design authority", () => {
  it("renders canonical light-only 600px email shells without changing Auth tokens", () => {
    const adminSender = read("supabase/functions/admin-user-ops/index.ts");
    const briefingSender = read("supabase/functions/briefing-handler/index.ts");
    expect(adminSender).toContain('max-width:600px');
    expect(adminSender).toContain('meta name="color-scheme" content="light"');
    expect(briefingSender).toContain("max-width:600px!important");
    expect(briefingSender).not.toContain("fonts.googleapis.com/css2?family=Inter");
    for (const template of ["confirm-signup", "magic-link", "reset-password", "change-email"]) {
      const html = read(`docs/email/templates/${template}.html`);
      expect(html).toContain('max-width:600px');
      expect(html).toContain('meta name="color-scheme" content="light"');
      expect(html).toContain("{{ .ConfirmationURL }}");
      expect(html).toContain("/assets/logos/wakilisha-logo-light.svg");
      expect(html).not.toContain("fonts.googleapis.com");
    }
  });


  it("has no split v5 mobile sheet, CSS player suppressor or old font faces", () => {
    const root = read("src/index.css");
    expect(root).toContain('wakilisha-mobile-workbook-v4.css');
    expect(root).toContain('wakilisha-workbook-fonts.css');
    for (const path of [
      "src/styles/wakilisha-mobile-v5.css",
      "src/styles/wakilisha-mobile-ch53-75.css",
      "src/styles/wakilisha-fonts.css",
      "src/components/design-system/player/playerChrome.css",
    ]) expect(existsSync(path)).toBe(false);
    expect(root).not.toMatch(/wakilisha-fonts\.css|mobile-v5|mobile-ch53-75/);
    const app = read("src/App.tsx");
    for(const removed of [
      "wakilisha.elements.product.css",
      "wakilisha.elements.content.css",
      "wakilisha.elements.mobile.css",
    ]) {
      expect(app).not.toContain(removed);
      expect(existsSync("src/design-system/"+removed)).toBe(false);
    }
    expect(read("src/design-system/wakilisha.elements.foundation.css")).toContain("width: 44px;");
    expect(read("test/ui-browser/fixtures/interaction.tsx")).not.toContain("wakilisha.elements.content.css");
    expect(existsSync("src/design-system/wakilisha.elements.charts-directory.css")).toBe(false);
    expect(read("src/design-system/wakilisha.elements.motion.css"))
      .not.toContain("wakilisha.elements.charts-directory.css");
    expect(read("src/design-system/chapters/pageBlueprints.ts")).not.toContain("mob-cdir");
    expect(read("src/router/config.tsx")).toContain(
      '{ path: "/", element: <ResponsivePage mobile={<MobileMagazine />} desktop={<Magazine />} /> }'
    );
    for (const file of [
      "src/pages/home/page.tsx",
      "src/pages/mobile/home/page.tsx",
      "src/pages/home/components/HomeHero.tsx",
      "src/pages/home/components/HomeExplore.tsx",
      "src/pages/home/components/HomeRightNow.tsx",
      "src/pages/home/components/HomeMarquee.tsx",
      "src/pages/home/components/HomeMission.tsx",
      "src/pages/home/components/HomeNav.tsx",
      "src/pages/home/components/HomeFeatured.tsx",
      "src/pages/home/components/HomeCollage.tsx",
    ]) expect(existsSync(file)).toBe(false);
    expect(read("src/pages/charts/directory/page.tsx")).not.toContain("HERO_FALLBACK");
    for (const name of ["dark", "light"]) {
      const svg = read(`public/assets/logos/wakilisha-logo-${name}.svg`);
      expect(svg.toLowerCase()).toContain("#85c441");
      expect(svg.toLowerCase()).not.toContain("#84c241");
    }

    expect(existsSync("src/pages/home/components/HomeFeatured.tsx")).toBe(false);
    expect(existsSync("src/pages/home/components/HomeCollage.tsx")).toBe(false);



    expect(read("src/components/mobile/ResponsiveAppLayout.tsx")).not.toContain("playerChrome.css");
  });
  it("preserves authentic, hash-checked fonts and never imports a font fallback system", () => {
    const manifest = JSON.parse(read("public/assets/fonts/wakilisha-font-manifest.json"));
    expect(manifest.assets).toHaveLength(6);
    expect(manifest.faces.map((face: { family: string }) => face.family)).toEqual(["Figtree", "IBM Plex Mono"]);
    expect(read("src/pages/guides/field-guide/styles.css")).not.toContain("@font-face");
    expect(read("src/design-system/wakilisha.tokens.css"))
      .toBe(read("packages/design-system/src/wakilisha.tokens.css"));
  });
  it("does not fabricate photos for chart data, registry or design specimens", () => {
    for (const path of [
      "src/data/registry/registry.ts",
      "scripts/charts/generate-public-csv-data.ts",
      "scripts/charts/repaired-content-details-api.ts",
      "src/pages/admin/design-system/components/RichSpecimenBoards.ts",
      "src/design-system/wakilisha.elements.foundation.css",
    ]) expect(read(path)).not.toContain("picsum.photos");
    expect(read("src/pages/admin/design-system/components/RichSpecimenBoards.ts"))
      .toContain("/assets/logos/wakilisha-logo-dark.svg");
    const charts = read("src/styles/wakilisha-charts-39.css");
    expect(charts).toContain("background:var(--wk-success-soft)");
    expect(charts).toContain("background:var(--wk-warning-soft)");
    expect(charts).not.toMatch(/#(?:ecfdf5|fffbeb|065f46|92400e|059669|d97706)/i);
    expect(read("src/styles/wakilisha-embeds.css")).not.toMatch(/var\(--wk-(?:accent|secondary)-500,/);

  });
  it("does not globally override unrelated utility-class modal and legacy button chrome", () => {
    const css = read("src/index.css");
    expect(css).toContain("[data-wk-modal-panel]");
    expect(css).not.toContain(".fixed.inset-0.z-50.flex.items-center.justify-center");
    const foundation = read("src/design-system/wakilisha.elements.foundation.css");
    expect(foundation).toContain("min-height:44px");
    expect(foundation).toContain("font:500 16px/1.4 var(--wk-font-ui)");
    expect(foundation).not.toContain(".btn,.wk-action");
    expect(foundation).not.toContain(".wk-ds-panel,.panel");
    expect(read("src/components/design-system/primitives/Button.tsx")).toContain("data-wk-button");
    const shell = read("src/components/music/MusicDesktopShell.tsx");
    expect(shell).toContain("resolvedLogoUrl");
    expect(shell).toContain("/assets/logos/wakilisha-logo-dark.svg");
    expect(shell).toContain("/assets/logos/wakilisha-logo-light.svg");
    expect(shell).not.toContain("{showLogo ? (");
    expect(shell).not.toContain("h-9 w-9");
    const studioLogin = read("src/pages/admin/login/page.tsx");
    expect(studioLogin).toContain("data-wk-studio-brand");
    expect(studioLogin).toContain('src="/assets/logos/wakilisha-logo-dark.svg"');
    expect(studioLogin).toContain("roleCanAccessAdmin");
    expect(studioLogin).toContain("signInWithPassword");
    const publicLogin = read("src/pages/auth/page.tsx");
    expect(publicLogin).toContain('data-wk-public-auth-logo="desktop"');
    expect(publicLogin).toContain('data-wk-public-auth-logo="mobile"');
    expect(publicLogin).toContain("handleEmailAuth");
    const resetPassword = read("src/pages/auth/reset-password/page.tsx");
    expect(resetPassword).toContain("data-wk-reset-password-brand");
    expect(resetPassword).toContain("supabase.auth.updateUser");
    const mobile = read("src/components/mobile/MobileAppLayout.tsx");
    expect(mobile).not.toContain("MobileBottomNav");
    const desktop = read("src/components/music/MusicDesktopShell.tsx");
    expect(desktop).toContain("const compactSidebar = sidebarCollapsed || tabletRail;");
    expect(desktop).toContain("md:flex");
    expect(desktop).toContain("w-[80px]");
    expect(desktop).toContain("w-[256px]");
    expect(desktop).toContain("md:hidden");
    expect(desktop).toContain("navigation.map");
    expect(desktop).toContain("visibleWakilishaNavigation");
    const menu = read("src/components/navigation/wakilishaNavigation.ts");
    expect(menu).not.toContain('{ label: "Settings", to: "/settings"');
    expect(read("src/components/mobile/MobileAccountDrawer.tsx")).toContain('to="/settings"');
    expect(desktop).toContain('startInYou');


    const compact = read("src/components/design-system/player/PlayerCompactSurface.tsx");
    expect(compact).toContain("window.visualViewport");
    expect(compact).not.toContain("calc(52px + max(env(safe-area-inset-bottom)");
    expect(mobile).toContain("calc(84px + env(safe-area-inset-bottom))");

    expect(mobile).not.toContain("WAKILISHA_THUNDERBOLT_URL");
    const mobileStyles = read("src/styles/wakilisha-mobile-workbook-v4.css");
    expect(mobileStyles).not.toContain(".phn-nav--compact");
    expect(mobileStyles).not.toContain(".phn-nav-primary-core");
    expect(mobileStyles).not.toContain(".wk-thumb-primary");
    expect(mobileStyles).not.toContain("above nav");



  });
  it("maintains at least 44px interactive targets in the shared Workbook controls", () => {
    const field=read("src/components/design-system/primitives/Field.tsx");
    expect(field).toContain("h-11 w-11");
    expect(field).toContain("text-[16px]");
    expect(read("src/components/design-system/primitives/Tabs.tsx")).toContain("min-h-11");
    expect(read("src/components/design-system/primitives/WakilishaToggle.tsx")).toContain("h-11 w-11");
  });

  it("keeps both Magazine routes source-backed, editorial and filterable", () => {
    const desktop = read("src/pages/magazine/page.tsx");
    const mobile = read("src/pages/mobile/magazine/page.tsx");
    const card = read("src/pages/magazine/components/MagazineCard.tsx");

    expect(desktop).toContain('data-wk-workbook-screen="magazine"');
    expect(mobile).toContain('data-wk-workbook-screen="magazine-mobile"');
    expect(desktop).toContain('aria-pressed={selectedMagazineSection === section}');
    expect(mobile).toContain('aria-pressed={activeSection === sec}');
    expect(desktop).toContain('stories.filter((story) => story.section === selectedMagazineSection)');
    expect(mobile).toContain('(story.section || "Article") === activeSection');
    expect(mobile).toContain('useMagazineArticles(24)');
    expect(mobile).not.toContain('Stories should feel edited, sequenced, and alive.');
    expect(card).not.toContain('whyThisStoryMatters');
    expect(card).not.toContain('ri-bookmark-line');
    expect(card).toContain('const why = story.dek || ""');
    expect(card.match(/data-wk-magazine-story/g)).toHaveLength(4);
  });

  it("presents one share affordance on each article route without rounded paper", () => {
    const desktop = read("src/pages/magazine/article/page.tsx");
    const mobile = read("src/pages/mobile/magazine/article/page.tsx");
    const related = read("src/pages/magazine/article/components/ArticleRelated.tsx");
    const articleHeader = read("src/pages/magazine/article/components/ArticleFloatHeader.tsx");
    const css = read("src/styles/wakilisha-article-prose.css");

    expect(desktop).toContain('<ArticleFloatHeader article={article} />');
    const actions = read("src/components/feature/community/CommunityActionSheet.tsx");
    for (const page of [desktop, mobile]) {
      expect(page).toContain('aria-label="Article actions"');
      expect(page).toContain('onClick={() => setCommunitySheetOpen(true)}');
      expect(page).toContain('<CommunityActionSheet');
    }
    expect(actions).toContain('label="Share"');
    expect(actions).toContain('<ShareSheet');
    expect(articleHeader).not.toContain('<SharePopover');
    expect(articleHeader).toContain('personPath={article.authorPersonPath}');
    expect(desktop).not.toContain('ArticleBottomShare');
    expect(desktop).not.toContain('handleNavCopy');
    expect(mobile).not.toContain('<MobileShareButton');
    expect(mobile).not.toContain('to="/magazine"');
    expect(mobile).not.toContain('pt-safe-top py-4 flex items-center justify-end');
    expect(mobile).toContain('data-wk-article-actions-trigger="byline"');
    expect(mobile).toContain('aria-expanded={communitySheetOpen}');
    expect(mobile).toContain('aria-haspopup="dialog"');
    expect(mobile.indexOf('data-wk-article-actions-trigger="byline"')).toBeGreaterThan(mobile.indexOf("{/* Author details and contextual article actions */}"));
    expect(mobile.indexOf('data-wk-article-actions-trigger="byline"')).toBeLessThan(mobile.indexOf("{/* Article body */}"));
    // Hero geometry is explicitly outside this patch.
    expect(desktop).toContain('className="relative z-10 mx-auto max-w-[820px] px-6 pb-12 text-center text-[#f5f5f4]"');
    expect(mobile).toContain('className="absolute inset-x-0 bottom-0 z-10 px-5 pb-8 text-[#f5f5f4]"');
    expect(mobile).not.toContain('Share this article');
    expect(mobile).not.toContain('rounded-t-[24px]');
    expect(mobile).not.toContain('marginTop: "-60px"');
    expect(desktop).toContain('<ArticleRelated');
    expect(mobile).toContain('<ArticleRelated');
    expect(related).toContain('aspect-[3/2]');
    expect(related).toContain('max-w-[1060px]');
    expect(related).toContain('preset="feature"');
    expect(related).toContain('loading="lazy"');
    expect(related).toContain('fetchPriority="low"');
    expect(related).toContain('decoding="async"');
    expect(related).not.toContain('rounded-2xl');
    expect(css).toContain('[data-wk-workbook-screen="article-mobile"] .wk-workbook-article-paper');
  });

  it("places closing author credits and the existing ellipsis immediately before Community on both article layouts", () => {
    const desktop = read("src/pages/magazine/article/page.tsx");
    const mobile = read("src/pages/mobile/magazine/article/page.tsx");
    const endCredits = read("src/pages/magazine/article/components/ArticleEndCredits.tsx");
    const desktopHome = read("src/pages/magazine/page.tsx");
    const mobileHome = read("src/pages/mobile/magazine/page.tsx");

    for (const page of [desktop, mobile]) {
      const footer = page.indexOf("<ArticleEndCredits");
      const topics = page.indexOf("article.tags");
      const community = page.indexOf("<CommunitySection");
      expect(topics).toBeGreaterThan(0);
      expect(footer).toBeGreaterThan(topics);
      expect(community).toBeGreaterThan(footer);
      expect(page).toContain("actionsOpen={communitySheetOpen}");
      expect(page).toContain("onOpenActions={() => setCommunitySheetOpen(true)}");
    }
    expect(mobile).toContain('data-wk-article-actions-trigger="byline"');
    expect(desktop).toContain("<ArticleFloatHeader article={article} />");
    expect(endCredits).toContain('data-wk-article-end-credits');
    expect(endCredits).toContain('data-wk-article-actions-trigger="footer"');
    expect(endCredits).toContain('aria-haspopup="dialog"');
    expect(endCredits).toContain("personPath={article.authorPersonPath}");
    expect(endCredits).toContain("organizationPath={article.authorOrganizationPath}");
    for (const home of [desktopHome, mobileHome]) {
      expect(home).toContain("{heroStory.section}</p>");
      expect(home).not.toContain("{heroStory.section} · Cover story");
      expect(home).toContain("text-[10px]");
    }
  });

  it("preserves production media and communication behavior on workbook surfaces", () => {
    const video = read("src/pages/video/page.tsx");
    const audio = read("src/pages/audio/page.tsx");
    const shows = read("src/pages/shows/page.tsx");
    const music = read("src/pages/music/page.tsx");
    const messages = read("src/pages/messages/page.tsx");
    const notifications = read("src/pages/notifications/page.tsx");

    expect(video).toContain('getPublicVideoIndex()');
    expect(video).toContain('aria-label="Video formats"');
    expect(video).toContain('const latestItems = query.trim() || format !== "all" ? items : items.slice(1)');
    expect(audio).toContain('getPublicAudioIndex(24)');
    expect(audio).toContain('publicAudioPlayerItem(publication)');
    expect(shows).toContain('getPublicShowIndex(48)');
    expect(shows).toContain('to={show.canonicalPath}');
    expect(music).toContain('to={releaseUrl(hero)}');
    expect(music).toContain('handlePlayRelease(');
    expect(music).not.toContain('In Focus');
    expect(messages).toContain('listMessageConversations(nextFolder)');
    expect(messages).toContain('ariaLabel="Search conversations"');
    expect(messages).toContain('visibleConversations.map((summary)');
    expect(messages).toContain('sendMessage(selectedId, composer.trim())');
    expect(notifications).toContain('handleMarkAll()');
    expect(notifications).toContain('notificationTarget(');
  });

});
