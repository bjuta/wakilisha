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
 * Personal Playlists add two direct lazy public imports:
 * - ../pages/playlists/person/page
 * - ../pages/playlists/person/detail/page
 *
 * Notifications adds one more direct lazy public import:
 * - ../pages/notifications/page
 *
 * Organization public surface adds one direct lazy public import:
 * - ../pages/organizations/detail/page
 *
 * Phase 6B M1 adds one direct lazy public Audio import:
 * - ../pages/audio/detail/page
 *
 * Phase 6B M2 adds two shared Show imports:
 * - ../pages/shows/detail/page
 * - ../pages/shows/episode/page
 *
 * Public Audio directory convergence adds one direct lazy public import:
 * - ../pages/audio/page
 *
 * Phase 7B V1 adds two public Video imports:
 * - ../pages/video/page
 * - ../pages/video/detail/page
 *
 * The current authority is therefore 67 direct lazy imports.
 */
const expectedDirectLazyImportCount = 67;

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
  "../pages/audio/page",
  "../pages/audio/detail/page",
  "../pages/shows/detail/page",
  "../pages/shows/episode/page",
  "../pages/video/page",
  "../pages/video/detail/page",
  "../pages/people/detail/page",
  "../pages/organizations/detail/page",
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
  "../pages/notifications/page",
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
 * Personal Playlists add two canonical Person Playlist routes:
 * - /u/:username/playlists
 * - /u/:username/playlists/:playlistSlug
 *
 * Notifications adds one signed-in public route:
 * - /notifications
 *
 * Organization public surface adds one canonical public route:
 * - /organizations/:slug
 *
 * Phase 6A final Audio adds two internal Admin Content paths:
 * - audio
 * - audio/:publicationId
 *
 * These are Admin Studio routes only; Phase 6B public Audio routes remain absent.
 * The accepted pre-M1 authority is therefore 165 paths.
 *
 * Phase 6B M1 adds one Standalone Audio-capable path:
 * - /audio/:slug
 *
 * Phase 6B M2 adds two shared Show identity paths:
 * - /shows/:showSlug
 * - /shows/:showSlug/:episodeSlug
 *
 * Public Audio directory convergence adds one public route:
 * - /audio
 *
 * Phase 7A K5B adds two internal Admin Content paths:
 * - video
 * - video/:publicationId
 *
 * These are Admin Studio routes only. They must not change the preserved
 * pre-M1 public route sequence.
 *
 * Phase 7B V1 adds three public Video routes:
 * - /video
 * - /video/:showSlug/:episodeSlug
 * - /video/:slug
 *
 * The current authority is therefore 174 paths. Removing the four declared
 * public Audio and Show paths, the two K5B Admin Video paths, and the three
 * Phase 7B public Video paths must still reproduce the exact 165-path
 * pre-M1 sequence.
 */
const expectedRoutePathCount = 174;
const publicAudioIndexPath = "/audio";
const publicAudioPath = "/audio/:slug";
const publicShowPath = "/shows/:showSlug";
const publicShowEpisodePath = "/shows/:showSlug/:episodeSlug";
const adminVideoIndexPath = "video";
const adminVideoDetailPath = "video/:publicationId";
const publicVideoIndexPath = "/video";
const publicVideoEpisodePath = "/video/:showSlug/:episodeSlug";
const publicVideoStandalonePath = "/video/:slug";

if (routePaths.length !== expectedRoutePathCount) {
  fail(
    `expected ${expectedRoutePathCount} route paths, found ${routePaths.length}`,
  );
}

for (const [routePath, label] of [
  [publicAudioIndexPath, "Audio Directory"],
  [publicAudioPath, "Standalone Audio"],
  [publicShowPath, "Show"],
  [publicShowEpisodePath, "Show Episode"],
  [adminVideoIndexPath, "Admin Video Directory"],
  [adminVideoDetailPath, "Admin Video Detail"],
  [publicVideoIndexPath, "Public Video Directory"],
  [publicVideoEpisodePath, "Public Video Episode"],
  [publicVideoStandalonePath, "Public Standalone Video"],
]) {
  if (
    routePaths.filter((candidate) => candidate === routePath).length !== 1
  ) {
    fail(
      `Declared Audio, Show, Admin Video, and public Video authority must retain exactly one ${label} route at ${routePath}`,
    );
  }
}

if (
  routePaths.some((routePath) => routePath.startsWith("/audio/shows/")) ||
  routePaths.some((routePath) => routePath.includes("/episodes/"))
) {
  fail(
    "rejected Audio-bucket or redundant Episode route grammar returned",
  );
}

const preM1RoutePaths = routePaths.filter(
  (routePath) =>
    routePath !== publicAudioIndexPath &&
    routePath !== publicAudioPath &&
    routePath !== publicShowPath &&
    routePath !== publicShowEpisodePath &&
    routePath !== adminVideoIndexPath &&
    routePath !== adminVideoDetailPath &&
    routePath !== publicVideoIndexPath &&
    routePath !== publicVideoEpisodePath &&
    routePath !== publicVideoStandalonePath,
);

if (preM1RoutePaths.length !== 165) {
  fail(
    `expected 165 pre-M1 route paths after removing declared Phase 6B paths, found ${preM1RoutePaths.length}`,
  );
}

const routePayload =
  `${preM1RoutePaths.join("\n")}\n`;

const routeChecksum = crypto
  .createHash("sha256")
  .update(routePayload)
  .digest("hex");

const expectedRouteChecksum =
  "b88dad0db887b324d9d9db70019651a8dfff0a745106b0838c338f6ffcc455fc";

if (
  routeChecksum !==
  expectedRouteChecksum
) {
  fail(
    `pre-M1 route path sequence changed: ${routeChecksum}`,
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
  `${directLazyImports.length} lazy imports, ${expectedRoutePathCount} route paths, pre-M1 sequence preserved.`,
);
