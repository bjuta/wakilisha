import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const INDEX = "index.html";
const ROOT_CSS = "src/index.css";
const FONT_CSS = "src/styles/wakilisha-fonts.css";
const FIELD_CSS = "src/pages/guides/field-guide/styles.css";
const MANIFEST =
  "public/assets/fonts/wakilisha-font-manifest.json";

const index = fs.readFileSync(INDEX, "utf8");
const rootCss = fs.readFileSync(ROOT_CSS, "utf8");
const fontCss = fs.readFileSync(FONT_CSS, "utf8");
const fieldCss = fs.readFileSync(FIELD_CSS, "utf8");
const manifest = JSON.parse(
  fs.readFileSync(MANIFEST, "utf8"),
);

const runtimeFiles = [];

function walk(current) {
  for (const entry of fs.readdirSync(current, {
    withFileTypes: true,
  })) {
    const full = path.join(current, entry.name);

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    if (
      entry.isFile()
      && [
        ".css",
        ".html",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
      ].includes(path.extname(entry.name))
    ) {
      runtimeFiles.push(full);
    }
  }
}

walk("src");
runtimeFiles.push(INDEX);

for (const file of runtimeFiles) {
  const source = fs.readFileSync(file, "utf8");

  for (const host of [
    "fonts.googleapis.com",
    "fonts.gstatic.com",
  ]) {
    if (source.includes(host)) {
      console.error(
        `Font delivery audit failed: ${host} remains in ${file}`,
      );
      process.exit(1);
    }
  }
}

const fontImport =
  '@import "./styles/wakilisha-fonts.css";';

if (
  rootCss.split(fontImport).length - 1
  !== 1
) {
  console.error(
    "Font delivery audit failed: root local font CSS import must exist exactly once.",
  );
  process.exit(1);
}

if (
  !fontCss.includes("@font-face")
  || fontCss.includes("https://")
) {
  console.error(
    "Font delivery audit failed: local root font CSS is missing faces or contains external URLs.",
  );
  process.exit(1);
}

if (
  !fieldCss.includes("@font-face")
  || !fieldCss.includes("Cormorant Garamond")
  || fieldCss.includes("@import url(")
) {
  console.error(
    "Font delivery audit failed: Field Guide Cormorant authority is not route-local.",
  );
  process.exit(1);
}

if (
  index.includes("fonts.googleapis.com")
  || index.includes("fonts.gstatic.com")
) {
  console.error(
    "Font delivery audit failed: Google font hosts remain in index.html/CSP.",
  );
  process.exit(1);
}

if (
  !index.includes("font-src 'self'")
  || !index.includes("style-src 'self'")
) {
  console.error(
    "Font delivery audit failed: local CSP authority is missing.",
  );
  process.exit(1);
}

const expectedFamilies = new Set([
  "Inter",
  "DM Sans",
  "DM Mono",
  "Cormorant Garamond",
]);

const actualFamilies = new Set(
  manifest.faces.map((face) => face.family),
);

for (const family of expectedFamilies) {
  if (!actualFamilies.has(family)) {
    console.error(
      `Font delivery audit failed: manifest missing ${family}.`,
    );
    process.exit(1);
  }
}

if (
  !Array.isArray(manifest.preloads)
  || manifest.preloads.length !== 2
) {
  console.error(
    "Font delivery audit failed: expected exactly two critical root font preloads.",
  );
  process.exit(1);
}

for (const preload of manifest.preloads) {
  const needle =
    `rel="preload" href="${preload.file}" as="font" type="font/woff2" crossorigin`;

  if (!index.includes(needle)) {
    console.error(
      `Font delivery audit failed: missing preload ${preload.file}.`,
    );
    process.exit(1);
  }
}

for (const asset of manifest.assets) {
  const relative = asset.file.replace(/^\//, "");
  const file = path.join("public", relative);

  if (!fs.existsSync(file)) {
    console.error(
      `Font delivery audit failed: missing ${file}.`,
    );
    process.exit(1);
  }

  const data = fs.readFileSync(file);
  const digest = crypto
    .createHash("sha256")
    .update(data)
    .digest("hex");

  if (digest !== asset.sha256) {
    console.error(
      `Font delivery audit failed: SHA mismatch for ${file}.`,
    );
    process.exit(1);
  }

  if (data.byteLength !== asset.bytes) {
    console.error(
      `Font delivery audit failed: byte-size mismatch for ${file}.`,
    );
    process.exit(1);
  }

  if (data.subarray(0, 4).toString("ascii") !== "wOF2") {
    console.error(
      `Font delivery audit failed: ${file} is not WOFF2.`,
    );
    process.exit(1);
  }
}

for (const file of [
  "public/assets/fonts/licenses/INTER-OFL.txt",
  "public/assets/fonts/licenses/DM-SANS-OFL.txt",
  "public/assets/fonts/licenses/DM-MONO-OFL.txt",
  "public/assets/fonts/licenses/CORMORANT-OFL.txt",
]) {
  const license = fs.readFileSync(file, "utf8");

  if (!/SIL OPEN FONT LICENSE/i.test(license)) {
    console.error(
      `Font delivery audit failed: invalid license sidecar ${file}.`,
    );
    process.exit(1);
  }
}

const totalBytes = manifest.assets.reduce(
  (sum, asset) => sum + asset.bytes,
  0,
);

console.log(
  `WAKILISHA_FONT_DELIVERY_AUDIT_PASS assets=${manifest.assets.length} bytes=${totalBytes} preloads=${manifest.preloads.length}`,
);
