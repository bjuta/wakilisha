
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
      await picker.getByRole("button", { name: "Set rating to 3.5 out of 5" }).click();
      await expect(picker.getByText("3.5 / 5")).toBeVisible();
      await picker.getByRole("button", { name: "Insert Rating", exact: true }).click();
      const atom = prose.locator('[data-wk-rating][data-wk-rating-value="3.5"]');
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
    await route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(data),
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
