#!/usr/bin/env node

const PROJECT_REF = "pgzizndxdyhqmtyywjmt";
const TARGET_SLUG = "registry-enrichment-review";
const TARGET_ID = "5421aa89-2b73-4fe8-9251-fa23f4dc84df";

const RETIRED = [
  "scrape-artist-data",
  "backfill-artist-spotify-images",
  "backfill-artist-type",
  "admin-registry-api",
  "wakilisha-public-api",
  "registry-enrichment-review",
];

const RETAINED = [
  "artist-registry-intake",
  "ingest-artist-discography",
  "registry-enrich-artist",
  "backfill-artist-origin",
  "admin-router",
  "provider-intake-api",
  "run-chart-playback-enrichment",
  "chart-ingest-api",
  "public-content-read",
];

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error("STOP: SUPABASE_ACCESS_TOKEN repository secret is unavailable.");
  process.exit(2);
}

const managementHeaders = {
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
};

console.log("=== 1. PRODUCTION EDGE INVENTORY ===");
const inventoryResponse = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`,
  { headers: managementHeaders },
);
const inventoryText = await inventoryResponse.text();

if (!inventoryResponse.ok) {
  console.error(
    `STOP: function inventory returned HTTP ${inventoryResponse.status}`
  );
  console.error(inventoryText);
  process.exit(3);
}

const parsed = JSON.parse(inventoryText);
const functions = Array.isArray(parsed) ? parsed : parsed.functions ?? [];

for (const slug of RETIRED) {
  if (functions.some((fn) => fn?.slug === slug)) {
    console.error(`STOP: retired Edge runtime is still deployed: ${slug}`);
    process.exit(4);
  }
  console.log(`RETIRED_EDGE_ABSENT=${slug}`);
}

for (const slug of RETAINED) {
  const fn = functions.find((candidate) => candidate?.slug === slug);
  if (!fn || fn.status !== "ACTIVE") {
    console.error(`STOP: retained Edge runtime is not ACTIVE: ${slug}`);
    process.exit(5);
  }
  console.log(
    `RETAINED_EDGE_ACTIVE=${slug} VERSION=${fn.version} SHA=${fn.ezbr_sha256}`
  );
}

console.log("EDGE_INVENTORY_EXIT_GATE=PASS");

console.log("");
console.log("=== 2. RETIRED HTTPS ROUTE FAIL-CLOSE ===");
const retiredUrl =
  `https://${PROJECT_REF}.supabase.co/functions/v1/${TARGET_SLUG}`;
const retiredResponse = await fetch(retiredUrl, {
  method: "GET",
  redirect: "manual",
});

console.log(`RETIRED_ROUTE_HTTP=${retiredResponse.status}`);
if (retiredResponse.status !== 404) {
  console.error(
    `STOP: retired Edge URL must fail closed with HTTP 404; got ${retiredResponse.status}`
  );
  console.error((await retiredResponse.text()).slice(0, 1000));
  process.exit(6);
}
console.log("RETIRED_ROUTE_FAIL_CLOSED=PASS");

console.log("");
console.log("=== 3. LIVE EDGE NETWORK POSITIVE CONTROL ===");
const controlUrl =
  `https://${PROJECT_REF}.supabase.co/functions/v1/public-content-read`;
const controlResponse = await fetch(controlUrl, {
  method: "GET",
  redirect: "manual",
});
console.log(`PUBLIC_CONTENT_READ_ROUTE_HTTP=${controlResponse.status}`);

if (
  controlResponse.status === 404 ||
  controlResponse.status === 0 ||
  controlResponse.status >= 500
) {
  console.error(
    `STOP: public-content-read network positive control is unhealthy: HTTP ${controlResponse.status}`
  );
  process.exit(7);
}
console.log("EDGE_NETWORK_POSITIVE_CONTROL=PASS");

console.log("");
console.log("TARGET_FUNCTION_ID=" + TARGET_ID);
console.log("PRODUCTION_MUTATION=NO");
console.log("SLICE3_FINAL_EDGE_EXIT_AUDIT=PASS");
