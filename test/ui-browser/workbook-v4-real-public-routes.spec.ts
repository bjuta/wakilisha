import { expect, test } from "@playwright/test";

/**
 * Same-checkout actual React pages. Offline public-data state only:
 * no Supabase Production host, auth cookies, customer records, fabricated
 * Registry/media results or live outbound writes.
 * These captures demonstrate viewport behavior, NOT full data acceptance.
 */
test("Workbook v4 actual public home and charts render at phone and desktop widths", async ({ page }, testInfo) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });

    // Explicitly reject all local test-domain data requests rather than
    // supplying synthetic records that might be mistaken for production truth.
    await page.route("http://127.0.0.1:54321/**", (route) =>
      route.abort("internetdisconnected"),
    );

    for (const pageSpec of [
      { path: "/", slug: "home", heading: /Your people/i },
      { path: "/charts", slug: "charts", heading: /Charts/i },
    ]) {
      await page.goto(pageSpec.path, { waitUntil: "domcontentloaded" });

      const heading = page.getByRole("heading", { level: 1 }).first();
      await expect(heading).toBeVisible({ timeout: 20000 });
      await expect(heading).toContainText(pageSpec.heading);

      const state = await page.evaluate(() => {
        const root = document.documentElement;
        const branding = getComputedStyle(root).getPropertyValue("--wk-brand").trim();
        const bodyText = getComputedStyle(document.body).fontFamily;
        return {
          overflow: Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth,
          branding,
          bodyText,
        };
      });
      expect(state.overflow).toBeLessThanOrEqual(2);
      expect(state.branding.toLowerCase()).toBe("#85c441");
      expect(state.bodyText).toContain("Figtree");

      // Real Vite app screenshot (not prototype HTML, mock screenshot or
      // a filled-in fake case). Screenshots remain internal CI evidence.
      await page.screenshot({
        path: testInfo.outputPath(`workbook-v4-${pageSpec.slug}-${width}.png`),
        fullPage: false,
        animations: "disabled",
      });
    }
  }
});
