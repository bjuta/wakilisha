import { expect, test, type Page } from "@playwright/test";

/**
 * Do not mistake an in-flight public content request for an empty page.
 * A settled empty/error state is still NOT published-content visual acceptance.
 */
async function waitForSettledMedia(page: Page, name: string) {
  const surface = page.locator(`[data-wk-workbook-screen="${name}"]`);
  if (name === "music") {
    await expect(surface.getByText("Loading music...", { exact: true })).toHaveCount(0, { timeout: 25_000 });
  } else {
    await expect(surface.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 25_000 });
  }
  // The data request can settle before a published poster has decoded.
  // A blank image frame is not valid workbook visual evidence.
  if (name === "video") {
    const recordedHero = surface.locator('.wk-reference-media-hero [data-wk-artwork-state="recorded"] img').first();
    if (await recordedHero.count()) {
      await expect.poll(
        () => recordedHero.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
        { timeout: 25_000 },
      ).toBe(true);
    }
  }
  if (name === "music") {
    const coverSlot = surface.locator(".wk-music-hero [data-wk-music-artwork-state]").last();
    if (await coverSlot.count()) {
      // The Registry image host can stall or reject a CI client. The UI must
      // paint either decoded cover art or its labelled fallback immediately;
      // this browser test does not claim external-image availability.
      await expect(coverSlot).toBeVisible();
      const state = await coverSlot.getAttribute("data-wk-music-artwork-state");
      expect(["recorded", "fallback"]).toContain(state);
      if (state === "fallback") {
        const fallback = coverSlot.locator("[data-wk-music-artwork-fallback]");
        await expect(fallback).toBeVisible();
        const colours = await fallback.evaluate((node) => ({
          background: getComputedStyle(node).backgroundColor,
          ink: getComputedStyle(node.querySelector("span") ?? node.querySelector("svg") ?? node).color,
        }));
        expect(colours.background).toBe("rgb(27, 27, 27)");
        expect(colours.ink).not.toBe(colours.background);
      } else {
        const image = coverSlot.locator("img");
        await expect(image).toHaveCount(1);
        expect(await image.evaluate((node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0)).toBe(true);
      }
    }
  }
}

/**
 * Actual same-checkout Vite/React public route captures.
 * Use the repository's existing browser runtime configuration; do NOT
 * modify shared env credentials or intercept other acceptance suites.
 * The root / route is the responsive Magazine (not the retired HomeHero).
 * Screenshots are of genuine no-login public surfaces, not design HTMLs.
 * They are visual proof of rendered code, not approval of full parity.
 */
for (const width of [390, 768, 1440]) {
  for (const pageSpec of [
    { path: "/", slug: "magazine", heading: null },
    { path: "/charts", slug: "charts", heading: /Charts/i },
  ]) {
    test(`Workbook v4 actual ${pageSpec.slug} route renders at ${width}px`, async ({ page }, testInfo) => {
      test.setTimeout(45_000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(pageSpec.path, { waitUntil: "domcontentloaded" });

      const heading = page.getByRole("heading", { level: 1 }).first();
      await expect(heading).toBeVisible({ timeout: 25_000 });
      if (pageSpec.heading) await expect(heading).toContainText(pageSpec.heading);

      const state = await page.evaluate(() => {
        const root = document.documentElement;
        return {
          overflow: Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth,
          brand: getComputedStyle(root).getPropertyValue("--wk-brand").trim(),
          font: getComputedStyle(document.body).fontFamily,
        };
      });
      expect(state.overflow).toBeLessThanOrEqual(2);
      expect(state.brand.toLowerCase()).toBe("#85c441");
      expect(state.font).toContain("Figtree");
      if (width === 390) {
        const floatingBar = page.locator('[data-wk-mobile-app-header="v4"]');
        await expect(floatingBar).toBeVisible();
        await expect(floatingBar).toHaveAttribute("data-wk-mobile-nav-transparency", "global");
        expect(await floatingBar.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
        // Media on these public routes comes from the live Registry. When
        // there is no published cover or edition, assert the settled empty/
        // error state rather than inventing an image for visual acceptance.
        const topHero = pageSpec.path === "/"
          ? page.locator('[data-wk-workbook-screen="magazine-mobile"] > [role="link"]').first()
          : page.locator("section.relative").first();
        if (await topHero.count()) {
          await expect(topHero).toBeVisible();
          expect(Math.abs(await topHero.evaluate((node) => node.getBoundingClientRect().top))).toBeLessThanOrEqual(2);
        } else {
          if (pageSpec.path === "/") {
            await expect(page.locator('[data-wk-workbook-screen="magazine-mobile"]')).toHaveCount(0);
            await expect(heading).toBeVisible();
          } else {
            await expect(heading).toContainText(/No charts out yet|Charts unavailable right now/);
          }
        }
        await expect(page.getByRole("navigation", { name: "Primary mobile navigation" })).toHaveCount(0);
      } else {
        const sidebar = page.locator(".wk-music-app-shell > aside").first();
        await expect(sidebar).toBeVisible();
        const widthInPixels = await sidebar.evaluate((node) => node.getBoundingClientRect().width);
        expect(widthInPixels).toBe(width < 1280 ? 80 : 256);
      }

      await page.screenshot({
        path: testInfo.outputPath(`workbook-v4-${pageSpec.slug}-${width}.png`),
        animations: "disabled",
        fullPage: false,
      });
    });
  }
}


test("Mobile Following renders its sole WAKILISHA wordmark inside the shared navbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/following", { waitUntil: "domcontentloaded" });
  const nav = page.locator('[data-wk-mobile-app-header="v4"]');
  const feed = page.locator('[data-wk-workbook-screen="following"]');
  await expect(nav).toBeVisible();
  await expect(feed).toBeVisible();
  await expect(nav.locator('[data-wk-social-wordmark]')).toHaveCount(1);
  await expect(feed.locator('[data-wk-social-brand-row]')).toHaveCount(0);
  const navBottom = await nav.evaluate((node) => node.getBoundingClientRect().bottom);
  const feedTop = await feed.locator("[data-following-masthead]").evaluate((node) => node.getBoundingClientRect().top);
  expect(feedTop).toBeGreaterThanOrEqual(navBottom - 1);
  await expect(nav.getByRole("button", { name: "Open WAKILISHA menu" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Search" })).toBeVisible();
});

test("Workbook sidebar uses accessible modal focus and replaces the old mobile bottom tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const menu = page.getByRole("button", { name: "Open WAKILISHA menu" });
  await expect(menu).toBeVisible({ timeout: 20000 });
  const bottomTabs = page.getByRole("navigation", { name: "Primary mobile navigation" });
  await expect(bottomTabs).toHaveCount(0);

  await menu.click();
  const drawer = page.getByRole("dialog", { name: "WAKILISHA Menu" });
  await expect(drawer).toBeVisible();
  const sidebar = drawer.getByRole("navigation", { name: "WAKILISHA places" });
  await expect(sidebar.getByRole("link", { name: "Video" })).toHaveAttribute("href", "/video");
  await expect(sidebar.getByRole("link", { name: "Audio" })).toHaveAttribute("href", "/audio");
  await expect(sidebar.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  await expect(sidebar.getByRole("link", { name: "Music" })).toHaveAttribute("href", "/music");
  await expect(sidebar.getByRole("link", { name: "Charts" })).toHaveAttribute("href", "/charts");
  await expect(sidebar.getByRole("link", { name: "Following" })).toHaveCount(0);
  // Signed-out viewers see the eight public places; private actions live in You.
  await expect(sidebar.getByRole("link", { name: "Messages" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Notifications" })).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/auth");
  const mobileMenuIcon = menu.locator("svg use");
  await expect(mobileMenuIcon).toHaveCount(1);
  await expect(mobileMenuIcon).toHaveAttribute("href", /wakilisha-lucide.*#wk-lucide-menu/);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(menu).toBeFocused();
});


test("Signed-out visitors cannot open private messaging or notifications", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/magazine", { waitUntil: "domcontentloaded" });
  const navigation = page.locator(".wk-music-app-shell > aside nav").first();
  await expect(navigation).toBeVisible({ timeout: 25_000 });
  await expect(navigation.getByRole("link", { name: "Messages" })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "Notifications" })).toHaveCount(0);
  const guestSignIn = page.locator(".wk-music-app-shell > aside").getByRole("link", { name: "Sign In" });
  await expect(guestSignIn).toHaveAttribute("href", "/auth");
  await expect(page.locator(".wk-music-app-shell > aside").getByRole("link", { name: "Settings" })).toHaveCount(0);
  const themeSwitch = page.locator(".wk-music-app-shell > aside").getByRole("button", { name: "Switch to light mode" });
  await expect(themeSwitch).toBeVisible();
  await themeSwitch.click();
  await expect(page.locator("html")).toHaveAttribute("data-wk-theme", "light");
  await expect(page.locator(".wk-music-app-shell > aside").getByRole("button", { name: "Switch to dark mode" })).toBeVisible();

  for (const privatePath of ["/messages", "/notifications"]) {
    await page.goto(privatePath, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth(?:\?|$)/, { timeout: 25_000 });
    await expect(page.locator('[data-wk-workbook-screen="messages"], [data-wk-workbook-screen="notifications"]')).toHaveCount(0);
  }
});

/**
 * Media landing pages reuse their existing live index services. These
 * screenshots prove the actual React shells and responsive geometry, not
 * publication data availability or authenticated Production acceptance.
 */
for (const width of [390, 1440]) {
  for (const surface of [
    { path: "/video", name: "video" },
    { path: "/audio", name: "audio" },
    { path: "/shows", name: "podcasts" },
    { path: "/music", name: "music" },
  ]) {
    test(`Workbook v4 actual ${surface.name} route fits at ${width}px`, async ({ page }, testInfo) => {
      test.setTimeout(45_000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(surface.path, { waitUntil: "domcontentloaded" });
      await expect(page.locator(`[data-wk-workbook-screen="${surface.name}"]`)).toBeVisible({ timeout: 25_000 });
      await waitForSettledMedia(page, surface.name);

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(2);

      if (width === 390) {
        const floatingBar = page.locator('[data-wk-mobile-app-header="v4"]');
        await expect(floatingBar).toHaveAttribute("data-wk-mobile-nav-transparency", "global");
        expect(await floatingBar.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
        const hero = surface.name === "music"
          ? page.locator(".wk-music-hero").first()
          : page.locator('[data-wk-mobile-top-hero], .wk-reference-podcast-cover').first();
        if (await hero.count()) {
          expect(Math.abs(await hero.evaluate((node) => node.getBoundingClientRect().top))).toBeLessThanOrEqual(2);
        }
      }

      if (surface.name === "music") {
        const background = await page.locator('[data-wk-workbook-screen="music"]').evaluate(
          (node) => getComputedStyle(node).backgroundColor,
        );
        expect(background).toBe("rgb(11, 11, 11)");
      }

      await page.screenshot({
        path: testInfo.outputPath(`workbook-v4-${surface.name}-${width}.png`),
        animations: "disabled",
        fullPage: false,
      });
    });
  }
}


/**
 * Verify the workbook-authorised palettes in the actual React surface, not
 * merely a CSS source string. The dark/light theme switch must change both
 * text ink and background on real public routes without changing structure.
 */
for (const route of [
  { path: "/video", name: "video" },
  { path: "/audio", name: "audio" },
  { path: "/shows", name: "podcasts" },
  { path: "/music", name: "music" },
]) {
  test(`Workbook ${route.name} theme palettes retain workbook colour authority`, async ({ page }, testInfo) => {
    test.setTimeout(45_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    const surface = page.locator(`[data-wk-workbook-screen="${route.name}"]`);
    await expect(surface).toBeVisible({ timeout: 25_000 });

    for (const [mode, background, brand] of [
      ["light", "rgb(252, 252, 251)", "#4e7425"],
      ["dark", "rgb(11, 11, 11)", "#85c441"],
    ] as const) {
      const openMenu = page.getByRole("button", { name: "Open WAKILISHA menu" });
      await openMenu.click();
      const guestMenu = page.getByRole("dialog", { name: "WAKILISHA Menu" });
      await expect(guestMenu.getByRole("link", { name: "Sign In" })).toBeVisible();
      await expect(guestMenu.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
      const sidebarLogo = guestMenu.locator('img[alt="WAKILISHA"]');
      const appearance = guestMenu.getByRole("switch", { name: "Dark mode" });
      await expect(appearance).toBeVisible();
      // Use the real single design-system switch; never force a page reload.
      await page.evaluate(() => document.documentElement.setAttribute("data-wk-theme-session", "preserved"));
      const wasDark = (await appearance.getAttribute("aria-checked")) === "true";
      if (wasDark !== (mode === "dark")) await appearance.click();
      await expect(page.locator("html")).toHaveAttribute("data-wk-theme", mode);
      await expect(sidebarLogo).toHaveAttribute(
        "src",
        mode === "light" ? "/assets/logos/wakilisha-logo-light.svg" : "/assets/logos/wakilisha-logo-dark.svg",
      );
      await expect(page.locator("html")).toHaveAttribute("data-wk-theme-session", "preserved");
      await expect(appearance).toHaveAttribute("aria-checked", String(mode === "dark"));
      await expect.poll(() => page.evaluate(() => localStorage.getItem("wk-theme"))).toBe(mode);
      await page.keyboard.press("Escape");
      await expect(guestMenu).toHaveCount(0);
      await expect(surface).toBeVisible({ timeout: 25_000 });
      await waitForSettledMedia(page, route.name);
      const mobileHeader = page.locator('[data-wk-mobile-app-header="v4"]');
      await expect(mobileHeader.locator("img")).toHaveCount(0);
      await expect(mobileHeader.getByRole("button", { name: "Search" })).toBeVisible();
      const actual = await surface.evaluate((node) => {
        const css = getComputedStyle(node);
        return {
          background: css.backgroundColor,
          brand: css.getPropertyValue("--wk-brand").trim().toLowerCase(),
          text: css.color,
        };
      });
      expect(actual.background).toBe(background);
      expect(actual.brand).toBe(brand);
      expect(actual.text).not.toBe(actual.background);
      if (route.name === "podcasts") {
        const cover = surface.locator(".wk-reference-podcast-cover");
        if (await cover.count()) {
          // The light theme previously rendered a white title on a white cover.
          // Check the actual browser-computed pixels, not just theme tokens.
          const colours = await cover.evaluate((node) => {
            const heading = node.querySelector("span");
            return {
              background: getComputedStyle(node).backgroundColor,
              title: heading ? getComputedStyle(heading).color : "",
            };
          });
          expect(colours.background).toBe("rgb(27, 27, 27)");
          expect(colours.title).toBe("rgb(255, 255, 255)");
        }
      }
      await page.screenshot({
        path: testInfo.outputPath(`workbook-v4-${route.name}-${mode}-390.png`),
        animations: "disabled",
        fullPage: false,
      });
    }
  });
}


/**
 * Real PlayerProvider + ResponsiveAppLayout, seeded with a harmless in-memory
 * recording inside a deterministic 3400px article. This exercises the exact
 * browser bug even when the live Registry is unavailable to CI.
 */
for (const width of [390, 1440]) {
  test(`Now Playing stays viewport-anchored over a scrolled article at ${width}px`, async ({ page }) => {
    test.setTimeout(55_000);
    // Deliberately short viewports prove the player can scroll independently.
    await page.setViewportSize({ width, height: 540 });
    await page.goto("/test/ui-browser/fixtures/player-viewport.html", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Persistent scrolled article" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Prepare player" }).click();
    const compact = page.locator("[data-wk-player-compact]");
    await expect(compact).toBeVisible({ timeout: 20_000 });
    const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(fullHeight).toBeGreaterThan(3000);
    await page.evaluate(() => window.scrollTo(0, 1150));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    if (width === 390) {
      const nav = page.locator('[data-wk-mobile-app-header="v4"]');
      await expect(nav).toHaveAttribute("data-wk-mobile-header-visible", "false");
      await expect.poll(() => nav.evaluate((node) => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(2);

      // Reverse direction without returning to the top: reveal the
      // transparent bar with individually contrast-blended Menu/Search glyphs.
      await page.evaluate(() => window.scrollBy(0, -44));
      await expect(nav).toHaveAttribute("data-wk-mobile-header-visible", "true");
      await expect.poll(() => nav.evaluate((node) => Math.abs(node.getBoundingClientRect().top))).toBeLessThanOrEqual(2);
      const chrome = await nav.evaluate((node) => {
        const style = getComputedStyle(node);
        const button = node.querySelector("button");
        return {
          position: style.position,
          background: style.backgroundColor,
          menuBlend: button ? getComputedStyle(button).mixBlendMode : "",
          logoCount: node.querySelectorAll("img").length,
          searchCount: node.querySelectorAll('button[aria-label="Search"]').length,
          headerTop: node.getBoundingClientRect().top,
        };
      });
      expect(chrome.position).toBe("fixed");
      expect(chrome.background).toBe("rgba(0, 0, 0, 0)");
      expect(chrome.menuBlend).toBe("difference");
      expect(chrome.logoCount).toBe(0);
      expect(chrome.searchCount).toBe(1);
      expect(Math.abs(chrome.headerTop)).toBeLessThanOrEqual(2);
    }
    const articleScrollY = await page.evaluate(() => window.scrollY);
    await compact.getByRole("button").first().click();

    const overlay = page.locator("[data-wk-player-overlay]");
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    await expect(overlay.locator("[data-wk-player-full]")).toBeVisible({ timeout: 15_000 });

    const position = await overlay.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        parentIsBody: node.parentElement === document.body,
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
        scrollableExtent: node.scrollHeight - node.clientHeight,
        underlayScroll: window.scrollY,
      };
    });
    expect(position.parentIsBody).toBe(true);
    expect(Math.abs(position.top)).toBeLessThanOrEqual(2);
    expect(Math.abs(position.bottom - position.viewportHeight)).toBeLessThanOrEqual(2);
    expect(position.underlayScroll).toBe(articleScrollY);
    expect(position.scrollableExtent).toBeGreaterThan(20);
    const backdrop = overlay.locator("[data-wk-player-backdrop]");
    await expect(backdrop).toBeVisible();
    expect(await backdrop.evaluate((node) => getComputedStyle(node).overflowX)).toBe("hidden");
    if (width === 390) {
      const exit = overlay.getByRole("button", { name: "Close Player" });
      const menu = overlay.getByRole("button", { name: "More Player actions" });
      await expect(exit).toBeVisible();
      await expect(menu).toBeVisible();
      expect(await exit.evaluate(node => getComputedStyle(node).mixBlendMode)).toBe("normal");
      expect(await exit.evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    }

    await overlay.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await expect.poll(() => overlay.evaluate(node => node.scrollTop)).toBeGreaterThan(20);
    if (width === 1440) {
      const panel = overlay.locator("[data-wk-player-panel-host]");
      await expect(panel).toBeVisible();
      const rect = await panel.evaluate(node => node.getBoundingClientRect());
      expect(Math.abs(rect.top)).toBeLessThanOrEqual(2);
    }
    await overlay.evaluate(node => { node.scrollTop = 0; });
    await expect.poll(() => overlay.evaluate(node => node.scrollTop)).toBe(0);

    await overlay.getByRole("button", { name: "Close Player" }).click();
    await expect(overlay).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(articleScrollY);
    await expect(page.locator("[data-wk-player-compact]")).toBeVisible();
    await expect(page.locator("#article-state")).toHaveValue("preserve-this");
  });
}
