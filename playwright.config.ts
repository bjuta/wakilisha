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
    {
      name: "webkit-mobile",
      testMatch: "**/viewport-integrity.spec.ts",
      use: { ...devices["iPhone 13"] },
    },
    {
      // The production incident was iPhone-only and Chromium alone cannot
      // establish that a controlled two-deck Web Audio fade starts in WebKit.
      name: "webkit-mobile-audio",
      testMatch: "**/music-provenance-slice3.spec.ts",
      grep: /Chapter 25 hot-enables decoded-buffer overlap and switches queue at fade start/,
      use: { ...devices["iPhone 13"] },
    },
    {
      // Isolated WebKit audio-architecture feasibility; not runtime acceptance.
      // Deliberately separate from existing Chapter 25 tests.
      name: "webkit-buffer-architecture",
      testMatch: "**/ch25-webkit-buffer-mixer-proof.spec.ts",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
