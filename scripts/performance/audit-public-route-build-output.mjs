import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const fail = (message) => {
  console.error(
    `Public route build-output audit failed: ${message}`,
  );
  process.exit(1);
};

const distPath = "dist";
const assetsPath = path.join(
  distPath,
  "assets",
);

const html = fs.readFileSync(
  path.join(distPath, "index.html"),
  "utf8",
);

const entryMatch = html.match(
  /<script[^>]+src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/,
);

if (!entryMatch) {
  fail(
    "could not locate the hashed application entry",
  );
}

const entryPath = path.join(
  distPath,
  entryMatch[1],
);

if (!fs.existsSync(entryPath)) {
  fail(
    `application entry does not exist: ${entryPath}`,
  );
}

const entryBuffer = fs.readFileSync(
  entryPath,
);

const rawBytes = entryBuffer.byteLength;
const gzipBytes = zlib
  .gzipSync(entryBuffer)
  .byteLength;

const javascriptFiles = fs
  .readdirSync(assetsPath)
  .filter((name) => name.endsWith(".js"));

const lucideRuntimeChunks = javascriptFiles
  .filter((name) => {
    const buffer = fs.readFileSync(
      path.join(assetsPath, name),
    );

    return buffer.includes(
      Buffer.from("createLucideIcon"),
    );
  });

if (lucideRuntimeChunks.length > 0) {
  fail(
    `lucide-react runtime factory still ships in: ${lucideRuntimeChunks.join(", ")}`,
  );
}

const maximumRawBytes = 700000;
const maximumGzipBytes = 200000;
const minimumJavascriptChunks = 200;

if (rawBytes > maximumRawBytes) {
  fail(
    `entry is ${rawBytes} bytes; maximum is ${maximumRawBytes}`,
  );
}

if (gzipBytes > maximumGzipBytes) {
  fail(
    `entry gzip is ${gzipBytes} bytes; maximum is ${maximumGzipBytes}`,
  );
}

if (
  javascriptFiles.length <
  minimumJavascriptChunks
) {
  fail(
    `only ${javascriptFiles.length} JavaScript chunks were emitted; minimum is ${minimumJavascriptChunks}`,
  );
}

console.log(
  "Public route build-output audit passed.",
);

console.log(
  `Entry: ${entryMatch[1]}`,
);

console.log(
  `Raw bytes: ${rawBytes}`,
);

console.log(
  `Gzip bytes: ${gzipBytes}`,
);

console.log(
  `JavaScript chunks: ${javascriptFiles.length}`,
);

console.log(
  "Lucide runtime factory chunks: 0",
);
