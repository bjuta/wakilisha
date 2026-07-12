import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "vite";

const fail = (message) => {
  console.error(
    `GA4 build-output audit failed: ${message}`,
  );
  process.exit(1);
};

const distIndexPath = "dist/index.html";
const distAssetsPath = "dist/assets";

if (!fs.existsSync(distIndexPath)) {
  fail("dist/index.html does not exist");
}

const distIndex = fs.readFileSync(
  distIndexPath,
  "utf8",
);

if (
  distIndex.includes("ga4-bootstrap.js") ||
  distIndex.includes(
    "googletagmanager.com/gtag/js",
  )
) {
  fail(
    "compiled HTML still references mutable analytics JavaScript",
  );
}

if (
  fs.existsSync(
    "dist/assets/analytics/ga4-bootstrap.js",
  )
) {
  fail(
    "legacy mutable bootstrap was copied into dist",
  );
}

const hashedEntryPattern =
  /\/assets\/index-[A-Za-z0-9_-]+\.js/;

if (!hashedEntryPattern.test(distIndex)) {
  fail(
    "compiled HTML does not reference a hashed application entry",
  );
}

const javascriptFiles = fs
  .readdirSync(distAssetsPath)
  .filter((filename) => filename.endsWith(".js"));

const bootstrapBundles = javascriptFiles.filter(
  (filename) => {
    const content = fs.readFileSync(
      path.join(distAssetsPath, filename),
      "utf8",
    );

    return (
      content.includes("__WAKILISHA_LOAD_GA4__") &&
      content.includes("send_page_view") &&
      content.includes(
        "data-wakilisha-ga4-loader",
      )
    );
  },
);

if (bootstrapBundles.length !== 1) {
  fail(
    `expected one hashed GA4 bundle, found ${bootstrapBundles.length}`,
  );
}

const bootstrapBundlePath = path.join(
  distAssetsPath,
  bootstrapBundles[0],
);

const bootstrapBundle = fs.readFileSync(
  bootstrapBundlePath,
  "utf8",
);

if (
  bootstrapBundle.includes(
    "%VITE_GA_MEASUREMENT_ID%",
  )
) {
  fail(
    "compiled analytics bundle contains an unresolved measurement-ID placeholder",
  );
}

const productionEnv = loadEnv(
  "production",
  process.cwd(),
  "",
);

const expectedMeasurementId = (
  process.env.VITE_GA_MEASUREMENT_ID ??
  productionEnv.VITE_GA_MEASUREMENT_ID ??
  ""
).trim();

if (
  !/^G-[A-Z0-9]+$/i.test(expectedMeasurementId)
) {
  fail(
    "production VITE_GA_MEASUREMENT_ID is missing or invalid",
  );
}

if (
  !bootstrapBundle.includes(expectedMeasurementId)
) {
  fail(
    `compiled analytics bundle does not contain the configured production measurement ID ${expectedMeasurementId}`,
  );
}

if (
  bootstrapBundle.includes(
    "/assets/analytics/ga4-bootstrap.js",
  )
) {
  fail(
    "compiled application still references the legacy bootstrap URL",
  );
}

console.log(
  `GA4 build-output audit passed: ${bootstrapBundles[0]}`,
);
console.log(
  `GA4 measurement ID compiled: ${expectedMeasurementId}`,
);
