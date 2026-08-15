import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const read = (path) =>
  fs.readFileSync(path, "utf8");

const fail = (message) => {
  console.error(
    `Public route splitting audit failed: ${message}`,
  );
  process.exit(1);
};

const config = read("src/router/config.tsx");
const lazyPublic = read("src/router/lazyPublic.tsx");
const app = read("src/App.tsx");
const packageJson = read("package.json");

const resolveLazyModule = (moduleName) => {
  let basePath;

  if (moduleName.startsWith("../")) {
    basePath = path.resolve(
      "src/router",
      moduleName,
    );
  } else if (moduleName.startsWith("@/")) {
    basePath = path.resolve(
      "src",
      moduleName.slice(2),
    );
  } else {
    fail(
      `unsupported lazy module path: ${moduleName}`,
    );
  }

  const candidates = [
    `${basePath}.tsx`,
    `${basePath}.ts`,
    `${basePath}.jsx`,
    `${basePath}.js`,
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.jsx"),
    path.join(basePath, "index.js"),
  ];

  const resolved = candidates.find(
    (candidate) => fs.existsSync(candidate),
  );

  if (!resolved) {
    fail(
      `could not resolve lazy module: ${moduleName}`,
    );
  }

  return resolved;
};

const hasDefaultExport = (moduleSource) => {
  if (
    /\bexport\s+default\b/.test(moduleSource)
  ) {
    return true;
  }

  const exportBlocks = [
    ...moduleSource.matchAll(
      /\bexport\s*\{([^}]*)\}(?:\s*from\s*["'][^"']+["'])?\s*;/g,
    ),
  ];

  for (const exportBlock of exportBlocks) {
    const specifiers = exportBlock[1]
      .split(",")
      .map((specifier) => specifier.trim())
      .filter(Boolean);

    for (const specifier of specifiers) {
      if (
        specifier === "default" ||
        /\bas\s+default$/.test(specifier)
      ) {
        return true;
      }
    }
  }

  return false;
};

const staticPageImports = [
  ...config.matchAll(
    /^import\s+[A-Za-z_$][A-Za-z0-9_$]*\s+from\s+["'](\.\.\/pages\/[^"']+)["'];/gm,
  ),
].map((match) => match[1]);

const expectedEagerModules = [
  "../pages/magazine/page",
  "../pages/mobile/magazine/page",
];

if (
  staticPageImports.length !==
  expectedEagerModules.length
) {
  fail(
    `expected 2 eager page imports, found ${staticPageImports.length}`,
  );
}

for (const moduleName of expectedEagerModules) {
  if (!staticPageImports.includes(moduleName)) {
    fail(
      `eager homepage module is missing: ${moduleName}`,
    );
  }
}

for (const moduleName of staticPageImports) {
  if (!expectedEagerModules.includes(moduleName)) {
    fail(
      `non-home page remains statically imported: ${moduleName}`,
    );
  }
}

if (
  config.includes(
    'from "@/components/mobile/MobileFullPlayer"',
  )
) {
  fail(
    "MobileFullPlayer remains statically imported",
  );
}

const directLazyImports = [
  ...lazyPublic.matchAll(
    /lazy\(\s*\(\)\s*=>\s*import\("([^"]+)"\),?\s*\)/g,
  ),
].map((match) => match[1]);

/*
 * The accepted authority was 51 direct lazy public imports.
 * Following added one direct lazy public import.
 * Registry-led onboarding adds one more direct lazy public import.
 *
 * Claimed Artist management adds:
 * - ../pages/artists/manage/page
 *
 * Artist Posts add:
 * - ../pages/artists/update/page
 *
 * Universal Posts add:
 * - ../pages/posts/detail/page
 *
 * Music discovery adds:
 * - ../pages/music/page
 *
 * The current authority is therefore 57 direct lazy imports.
 */
const expectedDirectLazyImportCount = 57;

if (
  directLazyImports.length !==
  expectedDirectLazyImportCount
) {
  fail(
    `expected ${expectedDirectLazyImportCount} direct lazy imports, found ${directLazyImports.length}`,
  );
}

if (
  new Set(directLazyImports).size !==
  directLazyImports.length
) {
  fail(
    "duplicate direct lazy public imports were found",
  );
}

const defaultExportFailures =
  directLazyImports
    .map((moduleName) => {
      const modulePath =
        resolveLazyModule(moduleName);

      const moduleSource =
        fs.readFileSync(
          modulePath,
          "utf8",
        );

      return {
        moduleName,
        modulePath,
        valid:
          hasDefaultExport(moduleSource),
      };
    })
    .filter((result) => !result.valid);

if (defaultExportFailures.length) {
  fail(
    "lazy modules without default exports: " +
    defaultExportFailures
      .map(
        ({ moduleName, modulePath }) =>
          `${moduleName} -> ${modulePath}`,
      )
      .join(", "),
  );
}

for (const homepageModule of expectedEagerModules) {
  if (directLazyImports.includes(homepageModule)) {
    fail(
      `homepage module must remain eager: ${homepageModule}`,
    );
  }
}

for (const requiredModule of [
  "../pages/playlists/page",
  "../pages/playlists/detail/page",
  "../pages/people/detail/page",
  "../pages/artists/detail/page",
  "../pages/artists/manage/page",
  "../pages/artists/update/page",
  "../pages/posts/detail/page",
  "../pages/music/page",
  "../pages/charts/edition/page",
  "../pages/magazine/article/page",
  "../pages/mobile/magazine/article/page",
  "../pages/releases/detail/page",
  "../pages/mobile/releases/detail/page",
  "../pages/following/page",
  "../pages/start/page",
  "../pages/settings/page",
  "../pages/mobile/settings/page",
  "../pages/api-docs/page",
]) {
  if (!directLazyImports.includes(requiredModule)) {
    fail(
      `required lazy module is missing: ${requiredModule}`,
    );
  }
}

for (const marker of [
  'import("@/components/mobile/MobileFullPlayer").then(',
  "({ MobileFullPlayer }) => ({",
  "default: MobileFullPlayer",
]) {
  if (!lazyPublic.includes(marker)) {
    fail(
      `MobileFullPlayer named-export bridge is missing: ${marker}`,
    );
  }
}

for (const removedBinding of [
  "MobileHome",
  "MobileChartsDirectory",
  "MobileLyricContribution",
]) {
  if (
    config.includes(removedBinding) ||
    lazyPublic.includes(removedBinding)
  ) {
    fail(
      `unused public binding remains: ${removedBinding}`,
    );
  }
}

const routePaths = [
  ...config.matchAll(
    /\bpath:\s*"([^"]+)"/g,
  ),
].map((match) => match[1]);

/*
 * Commit af3dda15 established 147 public route paths.
 * Commit d5c81f32 added two release-scoped track routes,
 * bringing the authority to 149.
 *
 * Commit 6b1388f4 intentionally retired five WordPress
 * runtime paths:
 * - migrate
 * - imports
 * - jobs
 * - jobs/:id
 * - scraper
 *
 * The post-retirement authority was therefore 144 paths.
 *
 * Phase 5A adds three canonical Playlist Admin Studio paths:
 * - playlists
 * - playlists/new
 * - playlists/:playlistId
 *
 * Removing those three paths reproduces the accepted 144-path
 * baseline checksum exactly.
 *
 * The accepted pre-Phase-5B authority is 148 paths.
 * Phase 5B adds two public Playlist routes:
 * - /playlists
 * - /playlists/:slug
 *
 * The current pre-People frontend authority is therefore 150 paths.
 *
 * Person frontend M1 adds one canonical role-neutral public route:
 * - /people/:slug
 *
 * That established 151 paths.
 *
 * Following adds one canonical signed-in route:
 * - /following
 *
 * Registry-led onboarding adds two route paths:
 * - /start
 * - Admin Settings onboarding
 *
 * Claimed Artist experience adds two route paths:
 * - /artists/:slug/manage
 * - community/artist-claims
 *
 * Artist Posts add one public route path:
 * - /artists/:slug/updates/:updateId
 *
 * Universal Posts add one public Person Post route path:
 * - /people/:slug/posts/:postId
 *
 * Music discovery adds one public route path:
 * - /music
 *
 * The current authority is therefore 159 paths.
 */
const expectedRoutePathCount = 159;

if (routePaths.length !== expectedRoutePathCount) {
  fail(
    `expected ${expectedRoutePathCount} route paths, found ${routePaths.length}`,
  );
}

const routePayload =
  `${routePaths.join("\n")}\n`;

const routeChecksum = crypto
  .createHash("sha256")
  .update(routePayload)
  .digest("hex");

const expectedRouteChecksum =
  "0392a85c6656e01dfb783515e8daf60d584e4c0739eedc7c076b5d4dbf1c1755";

if (
  routeChecksum !==
  expectedRouteChecksum
) {
  fail(
    `route path sequence changed: ${routeChecksum}`,
  );
}

if (
  !app.includes("<Suspense") ||
  !app.includes("Loading page.")
) {
  fail(
    "application Suspense boundary is missing",
  );
}

if (
  !packageJson.includes(
    '"performance:audit:public-routes"',
  )
) {
  fail(
    "public route audit is not registered",
  );
}

if (
  !packageJson.includes(
    "npm run performance:audit:public-routes",
  )
) {
  fail(
    "public route audit is not part of the build",
  );
}

console.log(
  "Public route splitting audit passed: " +
  `${directLazyImports.length} lazy imports, ${expectedRoutePathCount} route paths preserved.`,
);
