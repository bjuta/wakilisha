import { expect, test } from "@playwright/test";

const FIXTURE = "/test/ui-browser/fixtures/interaction.html";

async function viewportState(
  page: import("@playwright/test").Page,
) {
  return await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
    scale: window.visualViewport?.scale ?? 1,
  }));
}

test("mobile editable controls keep a 16px floor without changing page scale", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "chromium") {
    await page.setViewportSize({ width: 390, height: 844 });
  }

  await page.goto(FIXTURE);

  const initial = await viewportState(page);
  expect(initial.scrollWidth).toBeLessThanOrEqual(
    initial.clientWidth + 2,
  );

  await page
    .getByRole("button", { name: "Open interaction sheet" })
    .click();

  const dialog = page.getByRole("dialog", {
    name: "Interaction acceptance",
  });
  await expect(dialog).toBeVisible();

  const editables = [
    {
      locator: dialog.locator(
        '[role="combobox"][aria-label="Acceptance picker"]',
      ),
      closesPopup: true,
    },
    {
      locator: dialog.locator(
        'input[aria-label="Following field"]',
      ),
      closesPopup: false,
    },
    {
      locator: dialog.locator(
        'textarea[aria-label="Legacy compact field"]',
      ),
      closesPopup: false,
    },
    {
      locator: dialog.locator(
        '[contenteditable="true"][aria-label="Editable note"]',
      ),
      closesPopup: false,
    },
  ];

  for (const { locator: editable, closesPopup } of editables) {
    await expect(editable).toBeAttached();

    const fontSize = await editable.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);

    const beforeFocus = await viewportState(page);
    await editable.focus();
    await page.waitForTimeout(350);
    const afterFocus = await viewportState(page);

    expect(afterFocus.scrollWidth).toBeLessThanOrEqual(
      afterFocus.clientWidth + 2,
    );
    expect(afterFocus.scale).toBeLessThanOrEqual(
      beforeFocus.scale + 0.01,
    );

    if (closesPopup) {
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("listbox")).toHaveCount(0);
      await expect(dialog).toBeVisible();
    }
  }
});

test("long canonical identities stay inside a bounded mobile grid", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "chromium") {
    await page.setViewportSize({ width: 390, height: 844 });
  }

  await page.goto(FIXTURE);

  const identity = page.locator(
    "[data-viewport-long-identity]",
  );
  await expect(identity).toBeVisible();

  const geometry = await identity.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      overflowWrap: style.overflowWrap,
    };
  });

  const state = await viewportState(page);

  expect(geometry.overflowWrap).toBe("anywhere");
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(
    state.clientWidth + 1,
  );
  expect(geometry.width).toBeLessThanOrEqual(
    state.clientWidth + 1,
  );
  expect(state.scrollWidth).toBeLessThanOrEqual(
    state.clientWidth + 2,
  );
});

test("nested Disclosure package rows keep long references and status inside the viewport", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "chromium") {
    await page.setViewportSize({ width: 390, height: 844 });
  }

  await page.goto(FIXTURE);

  const grid = page.locator("[data-viewport-disclosure-grid]");
  const packageCard = page.locator(
    "[data-viewport-disclosure-package]",
  );
  const reference = page.locator(
    "[data-viewport-disclosure-reference]",
  );
  const status = page.locator(
    "[data-viewport-disclosure-status]",
  );
  const detail = page.locator(
    "[data-viewport-disclosure-detail]",
  );

  for (const element of [
    grid,
    packageCard,
    reference,
    status,
    detail,
  ]) {
    await expect(element).toBeVisible();
  }

  const geometry = await page.evaluate(() => {
    const names = [
      "disclosureGrid",
      "packageCard",
      "reference",
      "status",
      "detail",
    ] as const;

    const selectors = {
      disclosureGrid: "[data-viewport-disclosure-grid]",
      packageCard: "[data-viewport-disclosure-package]",
      reference: "[data-viewport-disclosure-reference]",
      status: "[data-viewport-disclosure-status]",
      detail: "[data-viewport-disclosure-detail]",
    };

    return Object.fromEntries(
      names.map((name) => {
        const element = document.querySelector(
          selectors[name],
        ) as HTMLElement;
        const rect = element.getBoundingClientRect();

        return [
          name,
          {
            left: rect.left,
            right: rect.right,
            width: rect.width,
          },
        ];
      }),
    ) as Record<
      string,
      { left: number; right: number; width: number }
    >;
  });

  const referenceWrap = await reference.evaluate(
    (element) => getComputedStyle(element).overflowWrap,
  );
  const state = await viewportState(page);

  expect(referenceWrap).toBe("anywhere");
  expect(state.scrollWidth).toBeLessThanOrEqual(
    state.clientWidth + 2,
  );

  for (const rect of Object.values(geometry)) {
    expect(rect.left).toBeGreaterThanOrEqual(-1);
    expect(rect.right).toBeLessThanOrEqual(
      state.clientWidth + 1,
    );
    expect(rect.width).toBeLessThanOrEqual(
      state.clientWidth + 1,
    );
  }
});

test("viewport observer reports document overflow instead of hiding it", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "chromium") {
    await page.setViewportSize({ width: 390, height: 844 });
  }

  await page.goto(FIXTURE);

  const detail = await page.evaluate(async () => {
    return await new Promise<Record<string, unknown>>(
      (resolve) => {
        const handler = (event: Event) => {
          const custom = event as CustomEvent<
            Record<string, unknown>
          >;

          if (custom.detail.kind !== "document-overflow") {
            return;
          }

          window.removeEventListener(
            "wk_viewport_integrity_violation",
            handler,
          );
          resolve(custom.detail);
        };

        window.addEventListener(
          "wk_viewport_integrity_violation",
          handler,
        );

        const probe = document.createElement("div");
        probe.dataset.viewportOverflowProbe = "true";
        probe.style.width = "2000px";
        probe.style.height = "1px";
        document.body.appendChild(probe);

        window.dispatchEvent(new Event("resize"));
      },
    );
  });

  expect(detail.kind).toBe("document-overflow");
  expect(Number(detail.documentScrollWidth)).toBeGreaterThan(
    Number(detail.layoutViewportWidth),
  );

  await page.evaluate(() => {
    document
      .querySelector(
        '[data-viewport-overflow-probe="true"]',
      )
      ?.remove();
  });
});

test("viewport contract preserves user zoom capability", async ({
  page,
}) => {
  await page.goto(FIXTURE);

  const content = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");

  expect(content).toContain("width=device-width");
  expect(content).toContain("initial-scale=1.0");
  expect(content).toContain("viewport-fit=cover");
  expect(content).not.toContain("user-scalable=no");
  expect(content).not.toContain("maximum-scale");
});
