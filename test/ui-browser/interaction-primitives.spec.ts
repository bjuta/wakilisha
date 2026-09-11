import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("WAKILISHA picker keyboard state is visible and selection restores focus", async ({
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
  const trigger = dialog.getByRole("combobox", {
    name: "Acceptance picker",
  });

  await trigger.click();

  const input = dialog.getByRole("textbox", { name: "Find option" });
  await expect(input).toBeFocused();

  await input.press("ArrowDown");

  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();

  const activeOption = page.locator(`#${activeId}`);
  await expect(activeOption).toContainText("Beta");

  const activeBoxShadow = await activeOption.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  expect(activeBoxShadow).not.toBe("none");

  await input.press("Enter");

  await expect(trigger).toContainText("Beta");
  await expect(trigger).toBeFocused();
  await expect(dialog.getByRole("listbox")).toHaveCount(0);
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
  const trigger = dialog.getByRole("combobox", {
    name: "Acceptance picker",
  });

  await trigger.click();
  await expect(dialog.getByRole("listbox")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("listbox")).toHaveCount(0);
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

  const blocking = results.violations.filter((violation) =>
    violation.impact === "serious" || violation.impact === "critical"
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
