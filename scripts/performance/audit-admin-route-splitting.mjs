import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(path, "utf8");

const fail = (message) => {
  console.error(
    `Admin route splitting audit failed: ${message}`,
  );
  process.exit(1);
};

const config = read("src/router/config.tsx");
const lazyAdmin = read("src/router/lazyAdmin.tsx");
const app = read("src/App.tsx");
const packageJson = read("package.json");

const staticAdminImportPattern =
  /import\s+[\s\S]*?\s+from\s+["'](?:\.\.\/pages\/admin\/|@\/components\/admin\/)/g;

const staticAdminImports =
  config.match(staticAdminImportPattern) ?? [];

if (staticAdminImports.length > 0) {
  fail(
    `router config still has ${staticAdminImports.length} static Admin Studio imports`,
  );
}

if (
  !config.includes(
    'from "./lazyAdmin"',
  )
) {
  fail(
    "router config does not use the lazy Admin Studio module",
  );
}

const lazyImportCount = (
  lazyAdmin.match(
    /lazy\(\(\)\s*=>\s*\n?\s*import\(/g,
  ) ?? []
).length;

/*
 * PR #423 introduced 93 lazy Admin Studio imports.
 *
 * Commit 6b1388f4 intentionally retired six WordPress runtime routes:
 * - AdminImportsJobDetailPage
 * - AdminImportsJobsPage
 * - AdminImportsLayout
 * - AdminImportsPage
 * - AdminMediaMigratePage
 * - AdminScraperPage
 *
 * The post-retirement authority was therefore 87 lazy imports.
 *
 * Phase 5A adds three canonical Playlist Admin Studio routes:
 * - AdminPlaylistsPage
 * - AdminNewPlaylistPage
 * - AdminPlaylistDetailPage
 *
 * Subsequent accepted Admin Studio routes brought the baseline to 91.
 *
 * Registry-led onboarding adds one lazy Admin Settings route:
 * - AdminSettingsOnboarding
 *
 * Claimed Artist review adds one lazy Admin Community route:
 * - AdminArtistClaimsPage
 *
 * Phase 6A final Audio adds two canonical Admin Content routes:
 * - AdminAudioPage
 * - AdminAudioDetailPage
 *
 * Phase 7A K5B adds two canonical Video Admin Content routes:
 * - AdminVideoPage
 * - AdminVideoDetailPage
 *
 * Phase 8B.3 adds the Messages Control Center route and its route-level AdminGuard lazily.\n * Phase 8B.4 Candidate B adds one canonical Field Admin Studio route:
 * - AdminFieldPage
 *
 * Dedicated MIZIZI Admin workflow adds one lazy Review route:
 * - AdminMiziziWorkspacePage
 *
 * PR #1274 and the WK100 Operations workbook added Wk100PrivateAdminPreview
 * and Wk100OperationsPage. The 2026-11-17 Charts reset retired both, the
 * legacy Admin Charts engine (layout plus 18 pages) and the two Chart Defaults
 * settings pages.
 *
 * The post-reset authority was therefore 80 lazy imports.
 * Charts 2.0 Phase 2 adds the guarded AdminChartsStudioPage, bringing the
 * accepted Admin Studio route authority to 81 lazy imports.
 */
// 2026-11-17 reset: 103 -> 80; Charts 2.0 private Admin Studio: 80 -> 81.
const expectedLazyImportCount = 81;

if (lazyImportCount !== expectedLazyImportCount) {
  fail(
    `expected ${expectedLazyImportCount} lazy Admin Studio imports, found ${lazyImportCount}`,
  );
}

for (const retiredMarker of [
  "AdminImportsJobDetailPage",
  "AdminImportsJobsPage",
  "AdminImportsLayout",
  "AdminImportsPage",
  "AdminMediaMigratePage",
  "AdminScraperPage",
]) {
  if (
    lazyAdmin.includes(`export const ${retiredMarker}`) ||
    config.includes(retiredMarker)
  ) {
    fail(
      `retired WordPress runtime route returned: ${retiredMarker}`,
    );
  }
}

for (const retiredChartsMarker of [
  "Wk100PrivateAdminPreview",
  "Wk100OperationsPage",
  "AdminChartsLayout",
  "AdminChartsIngest",
  "AdminChartsScoringRuns",
  "AdminSettingsChartDefaults",
]) {
  if (
    lazyAdmin.includes(`export const ${retiredChartsMarker}`) ||
    config.includes(retiredChartsMarker)
  ) {
    fail(`retired Charts Admin route returned: ${retiredChartsMarker}`);
  }
}

for (const marker of [
  "AdminShell",
  "AdminLoginPage",
  "AdminInquiryInterfacePage",
  "AdminMessagesPage",
  "AdminFieldPage",
  "AdminArtistClaimsPage",
  "AdminMiziziWorkspacePage",
  "AdminChartsStudioPage",
  "AdminAudioPage",
  "AdminAudioDetailPage",
  "AdminVideoPage",
  "AdminVideoDetailPage",
  "AdminPlaylistsPage",
  "AdminNewPlaylistPage",
  "AdminPlaylistDetailPage",
  "AdminSettingsLayout",
  "AdminApiDocsPage",
]) {
  if (!lazyAdmin.includes(`export const ${marker}`)) {
    fail(
      `lazy Admin Studio module is missing ${marker}`,
    );
  }
}

if (!lazyAdmin.includes("export const AdminTrackIntakePage")) {
  fail("lazy Admin Studio module is missing AdminTrackIntakePage");
}

if (
  !app.includes(
    'import { Suspense } from "react"',
  ) ||
  !app.includes("<Suspense") ||
  !app.includes("Loading page.")
) {
  fail(
    "the application lacks an accessible lazy-route loading boundary",
  );
}

if (
  !packageJson.includes(
    '"performance:audit:routes"',
  )
) {
  fail(
    "route splitting audit is not registered in package.json",
  );
}

console.log(
  `Admin route splitting audit passed: ${lazyImportCount} lazy imports.`,
);
