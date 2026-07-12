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

if (lazyImportCount !== 93) {
  fail(
    `expected 93 lazy Admin Studio imports, found ${lazyImportCount}`,
  );
}

for (const marker of [
  "AdminShell",
  "AdminLoginPage",
  "AdminInquiryInterfacePage",
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
