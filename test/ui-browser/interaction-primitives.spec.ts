import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("WAKILISHA picker keyboard state is visible and selection keeps focus", async ({
  page,
}) => {
  await page.goto("/test/ui-browser/fixtures/interaction.html");

  const brandToken = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--wk-brand")
      .trim(),
  );
  expect(brandToken).not.toBe("");

  await page.getByRole("button", { name: "Open interaction sheet" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Interaction acceptance",
  });
  const combobox = dialog.getByRole("combobox", {
    name: "Acceptance picker",
  });

  await combobox.click();
  await expect(combobox).toBeFocused();
  await expect(page.getByRole("listbox")).toBeVisible();

  await combobox.press("ArrowDown");

  const selectedActiveId =
    await combobox.getAttribute("aria-activedescendant");
  expect(selectedActiveId).toBeTruthy();

  const selectedActiveOption = page.locator(`#${selectedActiveId}`);
  await expect(selectedActiveOption).toContainText("Alpha");
  await expect(selectedActiveOption).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await combobox.press("ArrowDown");

  const nextActiveId =
    await combobox.getAttribute("aria-activedescendant");
  expect(nextActiveId).toBeTruthy();

  const nextActiveOption = page.locator(`#${nextActiveId}`);
  await expect(nextActiveOption).toContainText("Beta");
  await expect(nextActiveOption).toHaveAttribute(
    "aria-selected",
    "false",
  );

  const activeBoxShadow = await nextActiveOption.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  expect(activeBoxShadow).not.toBe("none");

  await combobox.press("Enter");

  await expect(combobox).toHaveValue("Beta");
  await expect(combobox).toBeFocused();
  await expect(page.getByRole("listbox")).toHaveCount(0);
});

test("canonical finite choice controls support keyboard operation", async ({
  page,
}) => {
  await page.goto("/test/ui-browser/fixtures/interaction.html");
  await page.getByRole("button", { name: "Open interaction sheet" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Interaction acceptance",
  });
  const finiteSelect = dialog.getByRole("button", {
    name: "Finite acceptance choice",
  });

  await finiteSelect.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(finiteSelect).toContainText("Beta");

  await finiteSelect.click();
  await expect(page.getByRole("option", { name: "Gamma" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.keyboard.press("Escape");

  const checkbox = dialog.getByRole("checkbox", {
    name: "Acceptance checkbox",
  });
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();

  const person = dialog.getByRole("radio", { name: "Person" });
  const organization = dialog.getByRole("radio", { name: "Organization" });
  await expect(person).toBeChecked();
  await person.focus();
  await page.keyboard.press("ArrowRight");
  await expect(organization).toBeChecked();
  await expect(organization).toBeFocused();
});

test("nested Escape closes picker before sheet and restores invoker focus", async ({
  page,
}) => {
  await page.goto("/test/ui-browser/fixtures/interaction.html");

  const opener = page.getByRole("button", {
    name: "Open interaction sheet",
  });
  await opener.click();

  const dialog = page.getByRole("dialog", {
    name: "Interaction acceptance",
  });
  const combobox = dialog.getByRole("combobox", {
    name: "Acceptance picker",
  });

  await combobox.click();
  await expect(page.getByRole("listbox")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("critical interaction fixture has no serious automated accessibility violations", async ({
  page,
}) => {
  await page.goto("/test/ui-browser/fixtures/interaction.html");
  await page.getByRole("button", { name: "Open interaction sheet" }).click();

  const field = page.getByRole("textbox", { name: "Following field" });
  const fieldVisuals = await field.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      appearance: styles.appearance,
      backgroundColor: styles.backgroundColor,
      color: styles.color,
    };
  });

  expect(fieldVisuals.appearance).toBe("none");
  expect(fieldVisuals.backgroundColor).not.toBe("rgb(255, 255, 255)");
  expect(fieldVisuals.color).not.toBe(fieldVisuals.backgroundColor);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" ||
      violation.impact === "critical",
  );

  expect(blocking).toEqual([]);
});

test("sheet remains bounded in a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/test/ui-browser/fixtures/interaction.html");
  await page.getByRole("button", { name: "Open interaction sheet" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Interaction acceptance",
  });
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
});


test("Workbook v4 loads authentic font faces and keeps controls and theme legible across phone, tablet and desktop", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test/ui-browser/fixtures/interaction.html");

    const state = await page.evaluate(async () => {
      const loadedFigtree = await document.fonts.load('400 16px "Figtree"');
      const loadedPlex = await document.fonts.load('400 12px "IBM Plex Mono"');
      const root = document.documentElement;
      const opener = Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Open interaction sheet",
      )!;
      const initial = getComputedStyle(opener);
      const rectangle = opener.getBoundingClientRect();
      const darkBrand = getComputedStyle(root).getPropertyValue("--wk-brand").trim();
      root.setAttribute("data-wk-theme", "light");
      const lightBrand = getComputedStyle(root).getPropertyValue("--wk-brand").trim();
      root.setAttribute("data-wk-theme", "dark");

      return {
        loadedFigtree: loadedFigtree.length,
        loadedPlex: loadedPlex.length,
        bodyFont: getComputedStyle(document.body).fontFamily,
        darkBrand, lightBrand,
        buttonHeight: rectangle.height,
        buttonRadius: initial.borderRadius,
        textColor: initial.color,
        backgroundColor: initial.backgroundColor,
        overflow: Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth,
      };
    });

    expect(state.loadedFigtree).toBeGreaterThan(0);
    expect(state.loadedPlex).toBeGreaterThan(0);
    expect(state.bodyFont).toContain("Figtree");
    expect(state.darkBrand.toLowerCase()).toBe("#85c441");
    expect(state.lightBrand.toLowerCase()).toBe("#4e7425");
    expect(state.buttonHeight).toBeGreaterThanOrEqual(44);
    expect(state.buttonRadius).not.toBe("0px");
    expect(state.textColor).not.toBe(state.backgroundColor);
    expect(state.overflow).toBeLessThanOrEqual(2);

    await page.getByRole("button", { name: "Open interaction sheet" }).click();
    const field = page.getByRole("textbox", { name: "Following field" });
    const control = await field.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { height: rect.height, size: Number.parseFloat(style.fontSize) };
    });
    expect(control.height).toBeGreaterThanOrEqual(44);
    expect(control.size).toBeGreaterThanOrEqual(16);
  }
});


/**
 * A real Chromium interaction with the actual Discography drawer. The Edge
 * response is fixture data, not a Production or hosted Preview mutation.
 * The governed authenticated hosted Apply is proved separately.
 */
test("Discography selected-only drawer Clear all and Apply omits every unselected album", async ({ page }) => {
  test.skip(process.env.WK_DISCOGRAPHY_UI_FIXTURE !== "1", "Run in the isolated Discography browser acceptance step");

  const artistId = "10b940ff-3382-42b3-a81b-a30e4028297d";
  const albumId = "9901416999";
  const unselectedAlbumId = "9901416996";
  const evidence = "acf1b963-9e3e-4dbb-9c61-3fd85e6af339";
  const applied: Array<Record<string, unknown>> = [];
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  };
  const album = (id: string, title: string) => ({
    apple_music_id: id,
    title,
    slug: title.toLowerCase().replaceAll(" ", "-"),
    release_type: "single",
    release_date: "2026-10-04",
    upc: null,
    record_label: null,
    genre_names: [],
    artwork_url: null,
    apple_music_url: null,
    track_count: 0,
    tracks: [],
    match_status: "new",
    existing_release: null,
    album_artist_name: "WK Selected Preview Artist",
  });
  await page.route("https://example.supabase.co/functions/v1/ingest-artist-discography", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const request = route.request().postDataJSON() as Record<string, unknown>;
    if (request.mode === "preview") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify({
          ok: true,
          mode: "preview",
          artist: { id: artistId, slug: "wk-selected-preview-artist", name: "WK Selected Preview Artist" },
          storefront: "ke",
          albums_searched: 2,
          albums_fetched: 2,
          albums_failed: [],
          albums: [album(albumId, "Selected Preview Single"), album(unselectedAlbumId, "Untouched Preview Single")],
          evidence_assertion_id: evidence,
          provider_source_payload_fingerprint: "a".repeat(64),
          duration_ms: 12,
        }),
      });
      return;
    }
    if (request.mode === "apply") {
      applied.push(request);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify({
          ok: true,
          mode: "apply",
          summary: { merged: 0, canonicalized: 1, ignored: 0, tracks_created: 1, errors: [] },
          duration_ms: 30,
        }),
      });
      return;
    }
    throw new Error("Unexpected Discography fixture mode");
  });

  await page.goto("/test/ui-browser/fixtures/interaction.html");
  await page.getByRole("button", { name: "Open Discography acceptance" }).click();
  const dialog = page.getByRole("dialog", { name: "Apple Music Discography" });
  await expect(dialog.getByText("Selected Preview Single")).toBeVisible();
  await expect(dialog.getByText("Untouched Preview Single")).toBeVisible();
  const apply = dialog.getByRole("button", { name: "Apply review" });
  await expect(apply).toBeDisabled();
  const add = dialog.getByRole("button", { name: "Add to Registry" });
  await expect(add).toHaveCount(2);
  await add.first().click();
  await expect(apply).toBeEnabled();

  await dialog.getByRole("button", { name: "Clear all" }).click();
  await expect(apply).toBeDisabled();
  await expect(dialog.getByText("0 albums selected")).toBeVisible();

  // An administrator does not click Leave on either discovered album.
  await dialog.getByRole("button", { name: "Add to Registry" }).first().click();
  await expect(apply).toBeEnabled();
  await expect(dialog.getByText("1 not selected. Only selected albums will change.")).toBeVisible();
  await apply.click();
  await expect(dialog.getByText("All other albums will remain untouched.")).toBeVisible();
  await dialog.getByRole("button", { name: "Yes, apply review" }).click();
  await expect(dialog.getByText("Applied successfully")).toBeVisible();
  expect(applied).toHaveLength(1);
  expect(applied[0]).toMatchObject({
    artist_id: artistId,
    mode: "apply",
    approved: true,
    evidence_assertion_id: evidence,
    selected_albums: [
      { apple_music_id: albumId, action: "canonicalize", additional_primary_artists: [] },
    ],
  });
  expect(JSON.stringify(applied[0])).not.toContain(unselectedAlbumId);
});
