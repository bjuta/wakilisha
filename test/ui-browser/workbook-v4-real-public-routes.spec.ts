import { expect, test } from "@playwright/test";

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
        await expect(page.locator('[data-wk-mobile-app-header="v4"]')).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Primary mobile navigation" })).toHaveCount(0);
      } else {
        const sidebar = page.locator(".wk-music-app-shell > aside").first();
        await expect(sidebar).toBeVisible();
        const widthInPixels = await sidebar.evaluate((node) => node.getBoundingClientRect().width);
        expect(widthInPixels).toBe(width === 768 ? 80 : 272);
      }

      await page.screenshot({
        path: testInfo.outputPath(`workbook-v4-${pageSpec.slug}-${width}.png`),
        animations: "disabled",
        fullPage: false,
      });
    });
  }
}


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
  const sidebar = drawer.getByRole("navigation", { name: "WAKILISHA" });
  await expect(sidebar.getByRole("link", { name: "Video" })).toHaveAttribute("href", "/video");
  await expect(sidebar.getByRole("link", { name: "Audio" })).toHaveAttribute("href", "/audio");
  await expect(sidebar.getByRole("link", { name: "Podcasts" })).toHaveAttribute("href", "/shows");
  await expect(sidebar.getByRole("link", { name: "Following" })).toHaveAttribute("href", "/following");
  await expect(sidebar.getByRole("link", { name: "Messages" })).toHaveAttribute("href", "/messages");
  await expect(sidebar.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/notifications");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(menu).toBeFocused();
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

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(2);

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
      await page.evaluate((theme) => {
        localStorage.setItem("wk-theme", theme);
      }, mode);
      // Mount ThemeProvider with the chosen user preference, not just a
      // changed DOM attribute. Header logos are rendered from React context.
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("data-wk-theme", mode);
      await expect(surface).toBeVisible({ timeout: 25_000 });
      const logo = page.locator('[data-wk-mobile-app-header="v4"] img[alt="WAKILISHA"]');
      await expect(logo).toHaveAttribute(
        "src",
        mode === "light" ? "/assets/logos/wakilisha-logo-light.svg" : "/assets/logos/wakilisha-logo-dark.svg",
      );
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
      await page.screenshot({
        path: testInfo.outputPath(`workbook-v4-${route.name}-${mode}-390.png`),
        animations: "disabled",
        fullPage: false,
      });
    }
  });
}
