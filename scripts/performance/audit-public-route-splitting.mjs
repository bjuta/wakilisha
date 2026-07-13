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

if (directLazyImports.length !== 48) {
  fail(
    `expected 48 direct lazy imports, found ${directLazyImports.length}`,
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
  "../pages/artists/detail/page",
  "../pages/charts/edition/page",
  "../pages/magazine/article/page",
  "../pages/mobile/magazine/article/page",
  "../pages/releases/detail/page",
  "../pages/mobile/releases/detail/page",
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

if (routePaths.length !== 149) {
  fail(
    `expected 149 route paths, found ${routePaths.length}`,
  );
}

const routePayload =
  `${routePaths.join("\n")}\n`;

const routeChecksum = crypto
  .createHash("sha256")
  .update(routePayload)
  .digest("hex");

const expectedRouteChecksum =
  "1eada3188aed314c87069d43a5a80c760d539b3af1997dc708ccca722bf44fa4";

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
  "49 lazy imports, 149 route paths preserved.",
);
