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


test("Article Story renderer exports full-bleed branded JPEGs in an actual browser", async ({ page }) => {
  // The export must load the real same-origin SVG wordmark from /public/assets.
  let logoRequests = 0;
  await page.route("**/assets/logos/wakilisha-logo-dark.svg", async (route) => {
    logoRequests += 1;
    await route.continue();
  });
  // The fixture is same-origin. Cross-origin production CDN access is an
  // independent live acceptance gate, not something a synthetic image proves.
  await page.route("**/__wk_article_story_fixture.svg", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><rect width="1200" height="1200" fill="#c7a06d"/><circle cx="600" cy="580" r="360" fill="#85c441"/></svg>',
    });
  });
  await page.goto("/test/ui-browser/fixtures/interaction.html");

  const exported = await page.evaluate(async () => {
    const modulePath = "/src/components/design-system/share/articleStoryImage.ts";
    const { renderArticleStoryImage } = await import(/* @vite-ignore */ modulePath);
    const imageUrl = new URL("/__wk_article_story_fixture.svg", window.location.origin).href;
    const titles = [
      "Album Review: Alusa Continua",
      "Inside the Album That Changed the Sound of Nairobi and the Artists Who Carried Its Stories Beyond Kenya",
    ];
    const outputs = [];

    for (const title of titles) {
      const blob = await renderArticleStoryImage({
        imageUrl,
        title,
        author: "Hafare Segelan",
        readingTime: 5,
        section: "Album Review",
      });
      const bytes = Array.from(new Uint8Array(await blob.slice(0, 3).arrayBuffer()));
      const bitmap = await createImageBitmap(blob);
      const probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      const ctx = probe.getContext("2d")!;
      ctx.drawImage(bitmap, 540, 1880, 1, 1, 0, 0, 1, 1);
      const pixel = Array.from(ctx.getImageData(0, 0, 1, 1).data);
      outputs.push({
        type: blob.type,
        size: blob.size,
        width: bitmap.width,
        height: bitmap.height,
        jpegSignature: bytes,
        bottomDark: pixel[0] < 80 && pixel[1] < 80 && pixel[2] < 80,
      });
      bitmap.close();
    }

    let blockedUnsafeScheme = false;
    try {
      await renderArticleStoryImage({
        imageUrl: "javascript:alert(1)",
        title: titles[0],
        author: "Hafare Segelan",
        readingTime: 5,
        section: "Album Review",
      });
    } catch {
      blockedUnsafeScheme = true;
    }
    return {
      outputs,
      blockedUnsafeScheme,
      displayFont: getComputedStyle(document.documentElement)
        .getPropertyValue("--wk-font-display").trim(),
      brand: getComputedStyle(document.documentElement)
        .getPropertyValue("--wk-brand").trim(),
      figtreeReady: document.fonts.check('800 96px "Figtree"'),
    };
  });

  expect(logoRequests).toBeGreaterThan(0);
  expect(exported.figtreeReady).toBe(true);
  expect(exported.displayFont).toContain("Figtree");
  expect(exported.brand.toLowerCase()).toBe("#85c441");
  expect(exported.blockedUnsafeScheme).toBe(true);
  expect(exported.outputs).toHaveLength(2);
  for (const output of exported.outputs) {
    expect(output.type).toBe("image/jpeg");
    expect(output.size).toBeGreaterThan(20_000);
    expect([output.width, output.height]).toEqual([1080, 1920]);
    expect(output.jpegSignature).toEqual([255, 216, 255]);
    expect(output.bottomDark).toBe(true);
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


/**
 * Exercise the actual Article Credit modal with a browser-shaped Data API
 * client. Only RPC responses are mocked; no Profile/Registry tables are read.
 */
test("Article Credit selects other existing writers and Registry Authors without creating new identities", async ({ page }) => {
  test.skip(process.env.WK_ARTICLE_CREDIT_UI_FIXTURE !== "1", "Run with isolated Article Credit browser fixture credentials");
  const versionId = "acf1b963-9e3e-4dbb-9c61-3fd85e6af339";
  const people = [
    {
      name: "WK Existing Writer",
      kind: "user",
      id: "18dd935d-d4f1-4a0a-a08f-c7b5d31943cf",
      path: "/people/wk-existing-writer",
      width: 1440,
    },
    {
      name: "WK Registry Author",
      kind: "registry_author",
      id: "721d8d0a-c0d7-4e2e-9f48-4a9976432ee1",
      path: "/people/wk-registry-author",
      width: 390,
    },
  ];
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  };

  for (const person of people) {
    const requests: Array<{ name: string; body: Record<string, unknown> }> = [];
    await page.setViewportSize({ width: person.width, height: 850 });
    await page.route("https://example.supabase.co/rest/v1/rpc/**", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: cors });
        return;
      }
      const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requests.push({ name, body });
      let response: Record<string, unknown>;
      if (name === "list_editorial_credit_picker_options") {
        response = {
          can_create_credit: true,
          roles: [
            { credit_role: "author", label: "Author" },
            { credit_role: "editor", label: "Editor" },
          ],
          parties: body.p_query ? [
            {
              party_kind: "person",
              resource_id: person.id,
              display_name: person.name,
              canonical_path: person.path,
              identity_kind: person.kind,
              available_credit_roles: [],
            },
          ] : [],
        };
      } else if (name === "resolve_editorial_credit") {
        response = {
          credit_id: "94123398-48e1-4a64-af11-c825e01ac050",
          party_kind: "person",
          party_resource_id: person.id,
          credit_role: "author",
          display_name: person.name,
          public_safe: false,
          created: false,
        };
      } else if (name === "attach_article_version_credit") {
        response = { attachment_id: "130351f1-78a5-4240-9f5f-3375cb961751" };
      } else {
        throw new Error("Unexpected Article Credit RPC: " + name);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify(response),
      });
    });

    await page.goto("/test/ui-browser/fixtures/interaction.html");
    await page.getByRole("button", { name: "Open Article Credit acceptance" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a Governed Credit" });
    await expect(dialog.getByRole("radio", { name: /Existing writer or Author/ })).toBeVisible();
    await dialog.getByText("Existing writer or Author", { exact: true }).click();

    const search = dialog.getByRole("textbox", { name: "Find Person or Organization" });
    await search.fill(person.name);
    await dialog.getByRole("option", { name: new RegExp(person.name) }).click();
    await dialog.getByRole("button", { name: "Use This Person" }).click();
    await expect(dialog.getByText("Person and role selected.")).toBeVisible();
    await dialog.getByRole("button", { name: "Create and Attach Credit" }).click();
    await expect(page.getByText("Article Credit fixture attached")).toBeVisible();

    const resolved = requests.filter((r) => r.name === "resolve_editorial_credit");
    const attached = requests.filter((r) => r.name === "attach_article_version_credit");
    expect(resolved).toHaveLength(1);
    expect(resolved[0].body).toMatchObject({
      p_party_kind: "person",
      p_party_resource_id: person.id,
      p_credit_role: "author",
      p_public_safe: false,
    });
    expect(attached).toHaveLength(1);
    expect(attached[0].body).toMatchObject({
      p_article_version_id: versionId,
      p_credit_id: "94123398-48e1-4a64-af11-c825e01ac050",
      p_expected_credit_revision: 4,
      p_is_primary: false,
    });
    expect(requests.some((r) => r.name === "create_credit" ||
      r.name === "create_external_contributor")).toBe(false);
    await page.unroute("https://example.supabase.co/rest/v1/rpc/**");
  }
});


/** Render the actual Artists page with read-only local fixture responses. */
test("Registry Artists theme follows shared tokens across list, panels and publish confirmation", async ({ page }) => {
  test.skip(process.env.WK_REGISTRY_ARTISTS_UI_FIXTURE !== "1", "Run with isolated Registry Artists browser fixture credentials");
  const artist = {
    id: "10b940ff-3382-42b3-a81b-30e4028297d",
    display_name: "WK Draft Artist Theme Fixture",
    slug: "wk-draft-artist-theme-fixture",
    normalized_name: "wk draft artist theme fixture",
    status: "draft",
    origin_iso2: null,
    public_image_url: null,
    updated_at: "2026-11-26T08:14:03Z",
  };
  const unexpected: string[] = [];
  let listReads = 0;
  await page.route("https://example.supabase.co/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-headers": request.headers()["access-control-request-headers"] ?? "*",
      "access-control-expose-headers": "content-range",
    };
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
    } else if (method === "GET" && path === "/functions/v1/admin-router/registry/entities") {
      listReads++;
      await route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ ok: true, data: [artist] }) });
    } else if (method === "HEAD" && path === "/rest/v1/registry_artists") {
      await route.fulfill({ status: 200, headers: { ...cors, "content-range": "0-0/1" } });
    } else {
      unexpected.push(method + " " + path);
      await route.abort();
    }
  });
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/test/ui-browser/fixtures/interaction.html?fixture=registry-artists");
  const root = page.locator("[data-wk-registry-artists]");
  const card = root.locator("[data-wk-registry-artist-card]");
  await expect(card).toHaveCount(1);
  await expect(card.getByText(artist.display_name, { exact: true })).toBeVisible();
  await expect(root.locator("[data-wk-registry-artist-panel]")).toHaveCount(3);
  const backgrounds: Record<string, string> = {};
  for (const theme of ["dark", "light"]) {
    await page.evaluate(theme => document.documentElement.setAttribute("data-wk-theme", theme), theme);
    for (const width of [1200, 768, 390]) {
      await page.setViewportSize({ width, height: 800 });
      // The Artist card transitions its background on a theme switch. Poll
      // actual computed styles to exact token equality, never accept a stale
      // palette or skip the card. Bound the settling time to one second.
      const readPalette = () => root.evaluate(el => {
        const probe = document.createElement("span");
        document.body.appendChild(probe);
        const color = (token: string) => {
          probe.style.backgroundColor = "var(--wk-" + token + ")";
          return getComputedStyle(probe).backgroundColor;
        };
        const expectedBg = color("bg");
        const expectedSurface = color("surface");
        probe.style.color = "var(--wk-text)";
        const expectedText = getComputedStyle(probe).color;
        probe.remove();
        const surfaces = Array.from(el.querySelectorAll("[data-wk-registry-artist-card], [data-wk-registry-artist-filters], [data-wk-registry-artist-panel]"));
        return {
          background: getComputedStyle(el).backgroundColor,
          text: getComputedStyle(el).color,
          expectedBg, expectedSurface, expectedText,
          surfaces: surfaces.map(node => ({
            name: node.getAttribute("data-wk-registry-artist-panel") ??
              (node.hasAttribute("data-wk-registry-artist-card") ? "artist-card" : "filters"),
            actual: getComputedStyle(node).backgroundColor,
          })),
        };
      });
      await expect.poll(async () => {
        const palette = await readPalette();
        return [
          ...(palette.background === palette.expectedBg ? [] : [`root background ${palette.background} != ${palette.expectedBg}`]),
          ...(palette.text === palette.expectedText ? [] : [`root text ${palette.text} != ${palette.expectedText}`]),
          ...(palette.surfaces.length === 5 ? [] : [`surface count ${palette.surfaces.length} != 5`]),
          ...palette.surfaces.filter(s => s.actual !== palette.expectedSurface)
            .map(s => `${s.name}: ${s.actual} != ${palette.expectedSurface}`),
        ];
      }, { timeout: 1000, intervals: [50, 100, 150], message: `${theme} palette at ${width}px` }).toEqual([]);
      const metrics = await readPalette();
      expect(metrics.background).toBe(metrics.expectedBg);
      expect(metrics.text).toBe(metrics.expectedText);
      expect(metrics.surfaces.map(s => s.actual)).toEqual(Array(5).fill(metrics.expectedSurface));
      backgrounds[theme] = metrics.background;
    }
    await page.setViewportSize({ width: 1200, height: 800 });
    await card.getByRole("button", { name: "Select " + artist.display_name }).click();
    await root.getByRole("button", { name: "Publish (1)", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Publish 1 artist?" });
    await expect(dialog.getByText(artist.display_name, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Yes, publish 1" })).toBeVisible();
    const modalPalette = await page.locator("[data-wk-modal-panel]").evaluate(el => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--wk-surface)";
      document.body.appendChild(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { actual: getComputedStyle(el).backgroundColor, expected };
    });
    expect(modalPalette.actual).toBe(modalPalette.expected);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await root.getByRole("button", { name: "Clear selection" }).click();
    await card.getByTitle("Quick edit").click();
    const editor = page.getByRole("dialog", { name: "Edit artist" });
    await expect(editor.getByRole("textbox", { name: "Artist name", exact: true })).toHaveValue(artist.display_name);
    await expect(editor.getByRole("combobox", { name: "Country", exact: true })).toBeVisible();
    await expect(editor.getByRole("button", { name: "Artist type", exact: true })).toBeVisible();
    await expect(editor.getByRole("button", { name: "Gender", exact: true })).toBeVisible();
    await editor.getByRole("button", { name: "Close", exact: true }).click();
    await expect(editor).toHaveCount(0);
  }
  expect(backgrounds.dark).not.toBe(backgrounds.light);
  expect(listReads).toBeGreaterThan(0);
  expect(unexpected).toEqual([]);
});


/** Shared editor test, using actual production components and no remote writes. */
test("Registry Artists theme and shared Registry editor fields remain legible and owned across entity schemas", async ({ page }) => {
  test.skip(process.env.WK_REGISTRY_ARTISTS_UI_FIXTURE !== "1", "Run in isolated Registry editor acceptance");
  test.setTimeout(90_000);
  const unexpected: string[] = [];
  await page.route("https://example.supabase.co/**", async route => {
    const method = route.request().method();
    const path = new URL(route.request().url()).pathname;
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": route.request().headers()["access-control-request-headers"] ?? "*",
    };
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (method === "GET" && ["/rest/v1/registry_release_tracks", "/rest/v1/registry_release_artists"].includes(path)) {
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: "[]" });
    }
    unexpected.push(method + " " + path);
    return route.abort();
  });
  for (const kind of ["artist", "track", "release", "label", "genre"]) {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/test/ui-browser/fixtures/interaction.html?fixture=registry-editor&entity=" + kind);
    const dialog = page.getByRole("dialog", { name: "Edit " + kind });
    await expect(dialog).toBeVisible();
    const nameField = dialog.locator("[data-wk-registry-field=" + (kind === "artist" ? "display_name" : kind === "track" || kind === "release" ? "title" : "name") + "]").getByRole("textbox");
    await expect(nameField).toHaveValue("WK Registry Editor Fixture");
    const fields = dialog.locator("[data-wk-registry-field]");
    const count = await fields.count();
    expect(count).toBeGreaterThan(3);
    for (const theme of ["dark", "light"]) {
      await page.evaluate(theme => document.documentElement.setAttribute("data-wk-theme", theme), theme);
      for (const width of [1200, 390]) {
        await page.setViewportSize({ width, height: 800 });
        await expect.poll(async () => dialog.evaluate(el => {
          const probe = document.createElement("span");
          document.body.appendChild(probe);
          probe.style.backgroundColor = "var(--wk-surface)";
          probe.style.color = "var(--wk-text)";
          const expectedSurface = getComputedStyle(probe).backgroundColor;
          const expectedText = getComputedStyle(probe).color;
          probe.remove();
          const errors: string[] = [];
          const background = (node: Element): string => {
            const color = getComputedStyle(node).backgroundColor;
            return (color === "transparent" || color === "rgba(0, 0, 0, 0)") && node.parentElement ? background(node.parentElement) : color;
          };
          for (const node of el.querySelectorAll("[data-wk-registry-editor-header], [data-wk-registry-editor-metrics] > div, [data-wk-sheet-footer]")) {
            if (background(node) !== expectedSurface) errors.push("surface: " + background(node));
          }
          for (const node of el.querySelectorAll("[data-wk-registry-field] input:not([type=hidden]), [data-wk-registry-field] textarea, [data-wk-registry-field] [data-wk-select-trigger]")) {
            const rect = node.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) continue;
            const style = getComputedStyle(node);
            if (background(node) !== expectedSurface || style.color !== expectedText) errors.push("field: " + node.closest("[data-wk-registry-field]")?.getAttribute("data-wk-registry-field") + " " + background(node) + " " + style.color);
            if (node instanceof HTMLTextAreaElement && style.resize !== "none") errors.push("native resize");
            if (node instanceof HTMLInputElement && ["number", "date", "url"].includes(node.type)) errors.push("native " + node.type);
          }
          // React Aria keeps a native select for form/autofill semantics.
          // Reject any painted or pointer-reachable native control; geometry
          // alone does not establish visibility of a clipped hidden wrapper.
          for (const select of el.querySelectorAll("select")) {
            const rect = select.getBoundingClientRect();
            let hidden = false;
            for (let node: Element | null = select; node && node !== el; node = node.parentElement) {
              const css = getComputedStyle(node);
              const box = node.getBoundingClientRect();
              if (css.display === "none" || css.visibility === "hidden" || Number(css.opacity) === 0 ||
                  (css.clip !== "auto" && css.clip !== "") ||
                  (css.clipPath !== "none" && css.clipPath !== "") ||
                  ((box.width <= 1 || box.height <= 1) && /hidden|clip/.test(css.overflow))) {
                hidden = true;
                break;
              }
            }
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            if (rect.width > 4 && rect.height > 4 && (!hidden || hit === select)) {
              errors.push("visible native select: " + select.outerHTML.slice(0, 180));
            }
          }
          return errors;
        }), { timeout: 2000, message: kind + " " + theme + " " + width }).toEqual([]);
      }
      await page.setViewportSize({ width: 1200, height: 800 });
      await nameField.fill("Edited fixture name");
      await expect(nameField).toHaveValue("Edited fixture name");
      await expect(dialog.getByRole("button", { name: /Save 1 change/ })).toBeEnabled();
      await dialog.getByRole("button", { name: "Discard", exact: true }).click();
      await expect(nameField).toHaveValue("WK Registry Editor Fixture");
      if (kind === "artist" || kind === "label") {
        const country = dialog.getByRole("combobox", { name: "Country", exact: true });
        await country.fill("Nigeria");
        await page.getByRole("option", { name: "Nigeria (NG)", exact: true }).click();
        await expect(country).toHaveValue("Nigeria (NG)");
        await country.fill("Not set");
        await page.getByRole("option", { name: "Not set", exact: true }).click();
        await expect(country).toHaveValue("Not set");
      }
      if (kind === "artist") {
        const type = dialog.getByRole("button", { name: "Artist type", exact: true });
        await type.click();
        await page.getByRole("option", { name: "Solo", exact: true }).click();
        await expect(type).toContainText("Solo");
        const gender = dialog.getByRole("button", { name: "Gender", exact: true });
        await gender.click();
        await page.getByRole("option", { name: "Non-binary", exact: true }).click();
        await expect(gender).toContainText("Non-binary");
        await expect(dialog.getByRole("button", { name: /Save 2 changes/ })).toBeEnabled();
        await dialog.getByRole("button", { name: "Discard", exact: true }).click();
        await expect(type).toContainText("Not set");
        await expect(gender).toContainText("Not set");
      }
      if (kind === "track") {
        await expect(dialog.locator("[data-wk-registry-field=duration_ms] input")).toBeVisible();
        const explicit = dialog.getByRole("switch", { name: "Toggle Explicit" });
        await explicit.click();
        await expect(explicit).toHaveAttribute("aria-checked", "true");
        await dialog.getByRole("button", { name: "Discard", exact: true }).click();
        await expect(explicit).toHaveAttribute("aria-checked", "false");
      }
      if (kind === "release") {
        await dialog.getByRole("button", { name: "Release date", exact: true }).click();
        await expect(page.locator("[data-wk-temporal-popover]")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator("[data-wk-temporal-popover]")).toHaveCount(0);
      }
    }
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByText("Registry editor closed")).toBeVisible();
  }
  expect(unexpected).toEqual([]);
});


test("Registry Artists theme contract applies to the other Registry lists", async ({ page }) => {
  test.skip(process.env.WK_REGISTRY_ARTISTS_UI_FIXTURE !== "1", "Run in isolated Registry list acceptance");
  test.setTimeout(60_000);
  const unexpected: string[] = [];
  await page.route("https://example.supabase.co/**", async route => {
    const method = route.request().method();
    const path = new URL(route.request().url()).pathname;
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": route.request().headers()["access-control-request-headers"] ?? "*",
    };
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (method === "GET" && path === "/functions/v1/admin-router/registry/entities") {
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify({ ok: true, data: [{
        id: "10b940ff-3382-42b3-a81b-30e4028297d",
        name: "WK Registry List Fixture", title: "WK Registry List Fixture",
        slug: "wk-registry-list-fixture", status: "draft", release_type: "single",
        release_date: "2026-11-26", duration_ms: 136594, updated_at: "2026-11-26T08:14:03Z",
      }] }) });
    }
    unexpected.push(method + " " + path);
    return route.abort();
  });
  for (const kind of ["track", "release", "label", "genre"]) {
    await page.goto("/test/ui-browser/fixtures/interaction.html?fixture=registry-artists&entity=" + kind);
    const root = page.locator('[data-wk-registry-entity-list="' + kind + 's"]');
    await expect(root.getByText("WK Registry List Fixture", { exact: true })).toBeVisible();
    for (const theme of ["dark", "light"]) {
      await page.evaluate(theme => document.documentElement.setAttribute("data-wk-theme", theme), theme);
      for (const width of [1200, 390]) {
        await page.setViewportSize({ width, height: 800 });
        await expect.poll(async () => root.evaluate(el => {
          const probe = document.createElement("span");
          document.body.appendChild(probe);
          probe.style.backgroundColor = "var(--wk-bg)";
          const expectedBg = getComputedStyle(probe).backgroundColor;
          probe.style.backgroundColor = "var(--wk-surface)";
          const expectedSurface = getComputedStyle(probe).backgroundColor;
          probe.style.color = "var(--wk-text)";
          const expectedText = getComputedStyle(probe).color;
          probe.remove();
          const errors: string[] = [];
          if (getComputedStyle(el).backgroundColor !== expectedBg || getComputedStyle(el).color !== expectedText) errors.push("list root");
          const search = el.querySelector("[data-wk-search-input]");
          if (!search || getComputedStyle(search).color !== expectedText || getComputedStyle(search).backgroundColor !== expectedSurface) errors.push("search");
          const cards = el.querySelectorAll(".group.rounded-2xl");
          if (cards.length !== 1 || Array.from(cards).some(card => getComputedStyle(card).backgroundColor !== expectedSurface)) errors.push("cards");
          return errors;
        }), { timeout: 2000, message: kind + " " + theme + " " + width }).toEqual([]);
      }
    }
  }
  expect(unexpected).toEqual([]);
});
