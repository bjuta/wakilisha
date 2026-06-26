import fs from "node:fs";

const MANIFEST_PATH = process.env.WAKILISHA_MEDIA_MANIFEST_PATH || "reports/wordpress-media-url-manifest.json";
const BASE_URL = process.env.WAKILISHA_MEDIA_MIRROR_BASE_URL;

if (!BASE_URL) {
  console.error("Missing WAKILISHA_MEDIA_MIRROR_BASE_URL.");
  console.error("Example:");
  console.error("WAKILISHA_MEDIA_MIRROR_BASE_URL=https://media.wakilisha.africa node scripts/audit/verify-lightsail-media-mirror.mjs");
  process.exit(1);
}

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`Missing manifest: ${MANIFEST_PATH}`);
  console.error("Run: node scripts/audit/extract-wordpress-media-urls.mjs");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const items = Array.isArray(manifest.items) ? manifest.items : [];
const limit = Number.parseInt(process.env.WAKILISHA_MEDIA_VERIFY_LIMIT || "", 10);
const verifyItems = Number.isFinite(limit) && limit > 0 ? items.slice(0, limit) : items;

function mirrorUrl(uploadPath) {
  return `${BASE_URL.replace(/\/+$/, "")}${uploadPath}`;
}

async function check(item) {
  const url = mirrorUrl(item.path);

  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": "wakilisha-lightsail-media-verifier/1.0" },
    });

    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": "wakilisha-lightsail-media-verifier/1.0",
          Range: "bytes=0-0",
        },
      });
    }

    return {
      path: item.path,
      url,
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      contentLength: response.headers.get("content-length") || "",
      location: response.headers.get("location") || "",
      ok: response.status >= 200 && response.status < 400,
    };
  } catch (error) {
    return {
      path: item.path,
      url,
      status: "NETWORK_ERROR",
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const results = [];

for (const item of verifyItems) {
  results.push(await check(item));
}

const failed = results.filter((result) => !result.ok);
const passed = results.filter((result) => result.ok);

fs.writeFileSync(
  "reports/lightsail-media-mirror-verification.json",
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    manifestPath: MANIFEST_PATH,
    totalManifestItems: items.length,
    checked: results.length,
    passed: passed.length,
    failed: failed.length,
    results,
  }, null, 2)}\n`,
);

console.log("Lightsail media mirror verification");
console.log(`Base URL: ${BASE_URL}`);
console.log(`Manifest items: ${items.length}`);
console.log(`Checked: ${results.length}`);
console.log(`Passed: ${passed.length}`);
console.log(`Failed: ${failed.length}`);
console.log("Report: reports/lightsail-media-mirror-verification.json");

if (failed.length > 0) {
  console.log("");
  console.log("First failed paths:");
  for (const result of failed.slice(0, 20)) {
    const detail = result.location ? ` -> ${result.location}` : "";
    console.log(`FAIL ${result.status} ${result.path}${detail}`);
  }
  process.exit(1);
}

console.log("");
console.log("All checked media paths resolved on the Lightsail media origin.");
