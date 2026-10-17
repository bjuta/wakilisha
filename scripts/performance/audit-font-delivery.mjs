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

const wkBrandFontCss=fs.readFileSync("src/styles/wakilisha-workbook-fonts.css","utf8");
const wkBrandTokens=fs.readFileSync("src/design-system/wakilisha.tokens.css","utf8");
if(wkBrandTokens!==fs.readFileSync("packages/design-system/src/wakilisha.tokens.css","utf8"))throw new Error("Brand token mirrors diverged");
if(!rootCss.includes('@import "./styles/wakilisha-workbook-fonts.css";'))throw new Error("Workbook font import missing");
for(const val of ["--wk-font-body:'Figtree'","--wk-font-mono:'IBM Plex Mono'","--wk-bg:#FCFCFB","--wk-bg:#0B0B0B","--wk-brand:#85C441"])if(!wkBrandTokens.includes(val))throw new Error("Workbook token missing: "+val);
for(const [name,digest] of [["figtree-latin.woff2","8330490a01c60c196eae00b823de8102275aaa5862e7b76a7af21b8745338928"],["figtree-latin-ext.woff2","f153aa07c1b16fbb12391c2512860c97819a0a9fd014f338b2b3f12496479d13"],["plexmono-400-latin.woff2","c36f509c0a8f9f85f29cb44bc8701d8a9e0b14c499e77a884f789ead7093a7ac"],["plexmono-400-latin-ext.woff2","f1050dc5317b43434c0aeda599d4624c774ffc162e87a8cf204b949b6a85816d"],["plexmono-500-latin.woff2","a76f53ca6612e7b3828eec2311098675b7f9849ae4169a8bcef6302aec02a6c0"],["plexmono-500-latin-ext.woff2","77f03e26f981c582bdba3a7abed4baa2d3149211c01366bb3ab3ba7622ec4ae5"]]){const bytes=fs.readFileSync("public/assets/fonts/workbook/"+name);if(bytes.toString("ascii",0,4)!=="wOF2"||crypto.createHash("sha256").update(bytes).digest("hex")!==digest)throw new Error("Workbook font SHA: "+name);if(!wkBrandFontCss.includes("/assets/fonts/workbook/"+name))throw new Error("Missing face "+name)}
for(const n of ["FIGTREE-OFL.txt","IBM-PLEX-OFL.txt"])if(!/SIL OPEN FONT LICENSE/i.test(fs.readFileSync("public/assets/fonts/workbook/licenses/"+n,"utf8")))throw new Error("Missing Workbook OFL");
console.log("WK_WORKBOOK_GLOBAL_FOUNDATION_AUDIT_PASS");
