import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.WAKILISHA_UI_BROWSER_BASE_URL;

if (!baseURL) {
  throw new Error(
    "WAKILISHA_UI_BROWSER_BASE_URL is required. Run browser acceptance through npm run test:ui-browser so the suite owns an isolated same-checkout Vite server.",
  );
}

export default defineConfig({
  testDir: "./test/ui-browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"]] : [["list"]],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
