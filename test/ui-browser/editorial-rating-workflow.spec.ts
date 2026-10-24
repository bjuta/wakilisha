
import { expect, test } from "@playwright/test";

/**
 * Synthetic isolated editor acceptance. No login, no Production writes, no use of a
 * real Supabase key. The signed-in Article workspace still requires human acceptance.
 */
test.skip(process.env.WK_EDITORIAL_FIXTURE !== "1", "Runs only inside the isolated synthetic editor job");

const PAGE = "/test/ui-browser/fixtures/editorial-rating.html";
async function openInsert(page: import("@playwright/test").Page, item: string) {
  await page.getByRole("menuitem", { name: "Insert", exact: true }).click();
  await page.getByRole("menu", { name: "Insert commands" })
    .getByRole("menuitem", { name: item, exact: false }).click();
}

test("Insert → Rating inserts a live editable star node, persists and reopens", async ({ page }, info) => {
  for (const width of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(PAGE);
      await page.locator("html").evaluate((element, variant) => {
        element.setAttribute("data-wk-theme", variant);
      }, theme);
      const prose = page.locator(".ProseMirror[contenteditable=true]");
      await expect(prose).toBeVisible();
      await prose.click();
      await openInsert(page, "Rating");
      const picker = page.getByRole("dialog", { name: "Insert Rating" });
      await expect(picker).toBeVisible();
      const pickerWidth = await picker.evaluate((node) => ({
        content: node.clientWidth, overflow: node.scrollWidth - node.clientWidth,
      }));
      expect(pickerWidth.overflow).toBeLessThanOrEqual(2);
      const targets = await picker.getByRole("button", { name: /^Set rating to/ }).evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().width)
      );
      expect(Math.min(...targets)).toBeGreaterThanOrEqual(24);
      await picker.getByRole("button", { name: "Set rating to 3.5 out of 5" }).click();
      await expect(picker.getByText("3.5 / 5")).toBeVisible();
      await picker.getByRole("button", { name: "Insert Rating", exact: true }).click();
      const atom = prose.locator('[data-wk-rating][data-wk-rating-value="3.5"]');
      await expect(atom).toHaveCSS("margin-left", /[1-9]/);
      await expect(atom).toHaveCount(1);
      await expect(atom.locator("svg")).toHaveCount(10);
      const svgNamespaces = await atom.locator("svg").evaluateAll((icons) =>
        icons.map((icon) => icon.namespaceURI)
      );
      expect(svgNamespaces.every((ns) => ns === "http://www.w3.org/2000/svg")).toBe(true);
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.locator("[data-wk-saved-article] [data-wk-rating]")).toHaveCount(1);
      await page.getByRole("button", { name: "Reopen saved draft" }).click();
      const reopened = page.locator('.ProseMirror [data-wk-rating-value="3.5"]');
      await expect(reopened).toHaveCount(1);
      await reopened.click();
      const editing = page.getByRole("dialog", { name: "Edit Rating" });
      await expect(editing).toBeVisible();
      await editing.getByRole("button", { name: "Set rating to 4.5 out of 5" }).click();
      await editing.getByRole("button", { name: "Update Rating" }).click();
      await expect(page.locator('.ProseMirror [data-wk-rating-value="4.5"]')).toHaveCount(1);
      await expect(page.locator('.ProseMirror [data-wk-rating-value="3.5"]')).toHaveCount(0);
      const docOverflow = await page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
        document.documentElement.clientWidth
      );
      expect(docOverflow).toBeLessThanOrEqual(2);
      await page.screenshot({
        path: info.outputPath("workbook-v4-editor-rating-" + width + "-" + theme + ".png"),
        animations: "disabled",
        fullPage: false,
      });
    }
  }
});

test("Insert Release discovers draft records with no active memberships, but cannot embed them", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://example.supabase.co/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname);
    const table = url.pathname.split("/").pop();
    const query = url.searchParams.get("select") || "";
    let data: unknown[] = [];
    if (table === "registry_releases") {
      data = query === "id"
        ? [{ id: "draft-ep" }]
        : [{ id: "draft-ep", slug: "forever-to-never-ep-charisma",
          title: "FOREVER TO NEVER - EP", status: "draft", release_type: "ep",
          artwork_url: null, release_date: null, created_at: "2026-10-23T00:00:00Z" }];
    } else if (table === "registry_release_artists") {
      data = query === "release_id" ? [] : [{
        release_id: "draft-ep", artist_name_text: "Charisma", artist_slug: "charisma",
      }];
    } else if (table === "registry_release_tracks") {
      data = []; // Draft deliberately has zero active track memberships.
    }
    // Supabase sends apikey/Authorization headers; Chromium performs CORS
    // preflight even though this is a synthetic, isolated Registry source.
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "apikey, authorization, content-type, x-client-info, prefer",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    await route.fulfill({
      status: 200, contentType: "application/json",
      headers: cors, body: JSON.stringify(data),
    });
  });
  await page.goto(PAGE);
  await openInsert(page, "Release");
  const dialog = page.getByRole("dialog", { name: "Insert Release from Registry" });
  await expect(dialog).toBeVisible();
  const search = dialog.getByPlaceholder("Search releases by title or artist...");
  await search.fill("forever to never");
  const result = dialog.getByRole("button", { name: /FOREVER TO NEVER - EP/ });
  await expect(result).toBeVisible();
  await expect(result).toContainText("Draft");
  await expect(result).toBeDisabled();
  await expect(dialog.getByText("6 tracks")).toHaveCount(0);
  expect(requests).toContain("/rest/v1/registry_releases");
  await expect(page.locator(".ProseMirror")).not.toContainText("[release");
});

test("media-bound captions remain attached after a real browser edit and save", async ({ page }, info) => {
  for (const width of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(PAGE + "?media");
      await page.locator("html").evaluate((node, value) =>
        node.setAttribute("data-wk-theme", value), theme);
      const editor = page.locator(".ProseMirror[contenteditable=true]");
      await expect(editor.locator("figure.wk-figure > img")).toHaveCount(1);
      const caption = editor.locator("figure.wk-figure > figcaption.wk-figcaption");
      await expect(caption).toHaveCount(1);
      expect(await caption.getAttribute("contenteditable")).toBe("false");
      await expect(editor.locator("p")).toHaveCount(2);
      await expect(caption).toHaveCSS("font-size", /^(12|12.5|13)px$/);
      await editor.locator("figure.wk-figure img").click();
      await page.getByRole("button", { name: "Caption", exact: true }).click();
      const mediaDetails = page.getByRole("dialog", { name: "Image Details" });
      await expect(mediaDetails).toBeVisible();
      await mediaDetails.locator("textarea").fill("Edited attribution, this article only.");
      await mediaDetails.getByRole("button", { name: "Save Details" }).click();
      await expect(editor.locator("figure.wk-figure > figcaption")).toHaveText("Edited attribution, this article only.");
      await editor.locator("p").last().click();
      await page.keyboard.type(" Edited.");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.locator("[data-wk-saved-article] figure > figcaption")).toHaveCount(1);
      await expect(page.locator("[data-wk-saved-article] p")).toHaveCount(2);
      await page.getByRole("button", { name: "Reopen saved draft" }).click();
      await expect(editor.locator("figure > figcaption")).toHaveCount(1);
      await expect(editor.locator("p")).toHaveCount(2);
      const overflow = await page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
        document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
      await page.screenshot({
        path: info.outputPath("media-caption-" + width + "-" + theme + ".png"),
        animations: "disabled",
        fullPage: false,
      });
    }
  }
});
