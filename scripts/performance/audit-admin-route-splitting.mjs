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
 * The current authority is therefore 97 lazy imports.
 */
const expectedLazyImportCount = 97;

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

for (const marker of [
  "AdminShell",
  "AdminLoginPage",
  "AdminInquiryInterfacePage",
  "AdminArtistClaimsPage",
  "AdminAudioPage",
  "AdminAudioDetailPage",
  "AdminVideoPage",
  "AdminVideoDetailPage",
  "AdminPlaylistsPage",
  "AdminNewPlaylistPage",
  "AdminPlaylistDetailPage",
  "AdminChartsLayout",
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
