import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const fail = (message) => {
  console.error(
    `Admin route build-output audit failed: ${message}`,
  );
  process.exit(1);
};

const distRoot = path.resolve("dist");
const assetsRoot = path.join(distRoot, "assets");
const htmlPath = path.join(distRoot, "index.html");

if (!fs.existsSync(htmlPath)) {
  fail("dist/index.html does not exist");
}

const html = fs.readFileSync(htmlPath, "utf8");

const entryMatch = html.match(
  /<script[^>]+src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/,
);

if (!entryMatch) {
  fail("the hashed application entry could not be located");
}

const entryPath = entryMatch[1];
const entryFile = path.join(
  distRoot,
  entryPath.replace(/^\//, ""),
);

if (!fs.existsSync(entryFile)) {
  fail(`the application entry does not exist: ${entryPath}`);
}

const entryBuffer = fs.readFileSync(entryFile);
const entrySource = entryBuffer.toString("utf8");
const rawBytes = entryBuffer.byteLength;
const gzipBytes = zlib.gzipSync(entryBuffer).byteLength;

const jsFiles = fs
  .readdirSync(assetsRoot)
  .filter((name) => name.endsWith(".js"));

const adminShellChunks = jsFiles.filter(
  (name) =>
    /^AdminShell-[A-Za-z0-9_-]+\.js$/.test(name),
);

if (rawBytes >= 3_000_000) {
  fail(
    `public entry is ${rawBytes} bytes; expected less than 3000000`,
  );
}

if (gzipBytes >= 750_000) {
  fail(
    `public entry gzip size is ${gzipBytes} bytes; expected less than 750000`,
  );
}

if (jsFiles.length < 20) {
  fail(
    `only ${jsFiles.length} JavaScript chunks were emitted; Admin Studio may have collapsed into the public entry`,
  );
}

if (adminShellChunks.length < 1) {
  fail(
    "no separate AdminShell chunk was emitted",
  );
}

if (!entrySource.includes("Loading page.")) {
  fail(
    "the accessible lazy-route loading boundary is missing from the entry",
  );
}

console.log(
  [
    "Admin route build-output audit passed.",
    `Entry: ${entryPath}`,
    `Raw bytes: ${rawBytes}`,
    `Gzip bytes: ${gzipBytes}`,
    `JavaScript chunks: ${jsFiles.length}`,
    `Admin shell chunks: ${adminShellChunks.length}`,
  ].join("\n"),
);
