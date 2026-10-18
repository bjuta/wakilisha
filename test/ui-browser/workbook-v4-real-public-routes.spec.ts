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
