import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Real React route in local Vite, with fully synthetic browser Auth/API responses.
 * This is a UI contract, NOT a hosted GoTrue/Preview acceptance. No HTTP call
 * reaches either Supabase project. The normal UI-browser workflow runs it.
 */
const PROJECT_REF = "pgzizndxdyhqmtyywjmt";
const TARGET = "/admin/charts/wk100-preview";
const USER_ID = "00000000-0000-4000-8000-000000000101";
const RECORDING_ID = "00000000-0000-4000-8000-000000000201";
type Role = "guest" | "subscriber" | "chart_editor_global" | "expired_administrator" | "administrator";
type Outcome = "disabled" | "synthetic" | "invalid";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "GET, HEAD, POST, PATCH, OPTIONS",
  "cache-control": "no-store",
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: cors,
    body: JSON.stringify(body),
  });
}

async function install(page: Page, role: Role, outcome: Outcome = "disabled") {
  const reads: unknown[] = [];
  const wrongProjects: string[] = [];
  const signedIn = role !== "guest";

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)) {
      await route.continue();
      return;
    }
    if (!url.hostname.endsWith(".supabase.co")) {
      await route.abort();
      return;
    }
    if (url.hostname !== PROJECT_REF + ".supabase.co") {
      wrongProjects.push(url.hostname);
      await json(route, { error: "wrong_project" }, 403);
      return;
    }
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (url.pathname === "/auth/v1/user") {
      await json(route, signedIn ? {
        id: USER_ID,
        aud: "authenticated",
        role: "authenticated",
        email: "wk100-browser-only@example.test",
        app_metadata: {},
        user_metadata: { name: "Browser Test" },
        created_at: "2026-10-21T00:00:00Z",
      } : { error: "not_signed_in" }, signedIn ? 200 : 401);
      return;
    }
    if (url.pathname === "/rest/v1/user_profiles") {
      await json(route, { user_id: USER_ID, status: "active", display_name: "Browser Test" });
      return;
    }
    if (url.pathname === "/rest/v1/user_role_assignments") {
      const assignment = (role_key: string, expires_at: string | null = null) => ({
        id: "synthetic-" + role_key, user_id: USER_ID, role_key,
        status: "active", expires_at, created_at: "2026-10-21T00:00:00Z",
        updated_at: "2026-10-21T00:00:00Z",
      });
      const rows = role === "expired_administrator"
        ? [assignment("administrator", "2020-01-01T00:00:00Z"), assignment("subscriber")]
        : role === "guest" ? [] : [assignment(role)];
      await json(route, rows);
      return;
    }
    if (url.pathname === "/rest/v1/role_capabilities") {
      const effective = role === "expired_administrator" ? "subscriber" : role;
      const caps = effective === "administrator" || effective === "chart_editor_global"
        ? ["view_dashboard", "view_charts_admin", "manage_charts", "view_admin_readonly"]
        : ["view_public_account"];
      await json(route, caps.map((capability_key) => ({ capability_key })));
      return;
    }
    if (url.pathname === "/rest/v1/user_access_scopes") {
      await json(route, []);
      return;
    }
    if (url.pathname === "/functions/v1/wk100-private-admin-preview") {
      if (request.method() !== "POST") {
        await json(route, { error: "read_only_post_required" }, 405);
        return;
      }
      try { reads.push(JSON.parse(request.postData() || "null")); }
      catch { reads.push("invalid_json"); }

      if (outcome === "disabled") {
        await json(route, { error: "preview_not_configured" }, 503);
      } else {
        await json(route, {
          status: "synthetic_preview", week_start_eat: "2026-10-19",
          method_status: "provisional", coverage_status: "test_only",
          operator_count: 2, behavior_count: 3, recording_count: 1,
          corroborated_top100: 1, failure_codes: [],
          entries: [{ rank: 1, recording_id: RECORDING_ID, corroborating_operators: 2 }],
          can_publish: outcome === "invalid",
        });
      }
      return;
    }
    // Unknown API calls fail closed. They never reach Production or Preview.
    await json(route, { error: "outside_test_fixture" }, 503);
  });

  if (signedIn) {
    await page.addInitScript(({ projectRef, userId }) => {
      const now = Math.floor(Date.now() / 1000);
      window.localStorage.setItem("sb-" + projectRef + "-auth-token", JSON.stringify({
        access_token: "synthetic-browser-token-not-a-jwt",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: "synthetic-browser-refresh",
        user: {
          id: userId, aud: "authenticated", role: "authenticated",
          email: "wk100-browser-only@example.test",
          app_metadata: {}, user_metadata: { name: "Browser Test" },
          identities: [], created_at: "2026-10-21T00:00:00Z",
        },
      }));
    }, { projectRef: PROJECT_REF, userId: USER_ID });
  }
  return { reads, wrongProjects };
}

test("anonymous visitors cannot open WK100 via the direct Admin route", async ({ page }) => {
  const fixture = await install(page, "guest");
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/login\?next=/, { timeout: 20_000 });
  expect(fixture.reads).toHaveLength(0);
  expect(fixture.wrongProjects).toEqual([]);
});

for (const role of ["subscriber", "expired_administrator"] as const) {
  test("WK100 denies " + role + " before requesting private preview", async ({ page }) => {
    const fixture = await install(page, role);
    await page.goto(TARGET, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/login\?next=/, { timeout: 20_000 });
    expect(fixture.reads).toHaveLength(0);
    expect(fixture.wrongProjects).toEqual([]);
  });
}

test("chart editor sees restricted direct-route message without an Edge request", async ({ page }) => {
  const fixture = await install(page, "chart_editor_global");
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("alert")).toContainText("Restricted WK100 workspace", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Private Ranking Preview" })).toHaveCount(0);
  expect(fixture.reads).toHaveLength(0);
  expect(fixture.wrongProjects).toEqual([]);
});

test("administrator sees disabled state and Refresh sends only permitted read", async ({ page }) => {
  const fixture = await install(page, "administrator");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Private Ranking Preview" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "No approved preview configured" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Publication remains locked")).toBeVisible();
  const before = fixture.reads.length;
  expect(before).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "Refresh Preview" }).click();
  await expect.poll(() => fixture.reads.length, { timeout: 10_000 }).toBeGreaterThan(before);
  await expect(page.getByRole("heading", { name: "No approved preview configured" })).toBeVisible();
  for (const body of fixture.reads) expect(body).toEqual({ action: "read" });
  expect(fixture.wrongProjects).toEqual([]);
});

test("mobile administrator sees restricted navigation and an intact disabled state", async ({ page }) => {
  const fixture = await install(page, "administrator");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "No approved preview configured" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Refresh Preview" })).toBeVisible();
  await page.locator("header button").first().click();
  await expect(page.locator("aside").getByRole("button", { name: "WAKILISHA 100" })).toBeVisible();
  const main = page.locator("main").first();
  expect(await main.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(2);
  expect(fixture.wrongProjects).toEqual([]);
});

test("synthetic preview is visibly provisional and offers no publish action", async ({ page }) => {
  const fixture = await install(page, "administrator", "synthetic");
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Provisional rankings (synthetic)" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(RECORDING_ID)).toBeVisible();
  await expect(page.getByText("Publication remains locked")).toBeVisible();
  await expect(page.getByRole("button", { name: /publish/i })).toHaveCount(0);
  for (const body of fixture.reads) expect(body).toEqual({ action: "read" });
  expect(fixture.wrongProjects).toEqual([]);
});

test("a publishable server projection fails closed", async ({ page }) => {
  const fixture = await install(page, "administrator", "invalid");
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "No approved preview configured" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Provisional rankings (synthetic)" })).toHaveCount(0);
  expect(fixture.reads.length).toBeGreaterThanOrEqual(1);
  expect(fixture.wrongProjects).toEqual([]);
});
