#!/usr/bin/env node

const PROJECT_REF = "pgzizndxdyhqmtyywjmt";
const TARGET_SLUG = "registry-enrichment-review";
const TARGET_ID = "5421aa89-2b73-4fe8-9251-fa23f4dc84df";
const TARGET_VERSION = 42;
const TARGET_BUNDLE_SHA =
  "deda61f512909d58bc4fc826d5462373e2da9f62177609f81bc29cf00d6aa64d";
const CONTROL_ID = "085525b4-8766-4c7b-8474-1dc7ba53eeab";
const TRAFFIC_START = "2026-09-20T12:39:00Z";

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error("STOP: SUPABASE_ACCESS_TOKEN repository secret is unavailable.");
  process.exit(2);
}

const authHeaders = {
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
};

const functionUrl =
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/${TARGET_SLUG}`;

console.log("=== 1. EXACT LIVE FUNCTION PRECONDITION ===");
const liveResponse = await fetch(functionUrl, { headers: authHeaders });
const liveText = await liveResponse.text();

if (!liveResponse.ok) {
  console.error(
    `STOP: expected live function lookup HTTP 200; got ${liveResponse.status}`
  );
  console.error(liveText);
  process.exit(3);
}

const live = JSON.parse(liveText);
console.log(`LIVE_ID=${live.id}`);
console.log(`LIVE_STATUS=${live.status}`);
console.log(`LIVE_VERSION=${live.version}`);
console.log(`LIVE_VERIFY_JWT=${live.verify_jwt}`);
console.log(`LIVE_BUNDLE_SHA256=${live.ezbr_sha256}`);

if (
  live.id !== TARGET_ID ||
  live.status !== "ACTIVE" ||
  Number(live.version) !== TARGET_VERSION ||
  live.verify_jwt !== true ||
  live.ezbr_sha256 !== TARGET_BUNDLE_SHA
) {
  console.error("STOP: live function no longer matches the sealed v42 rollback authority.");
  process.exit(4);
}
console.log("LIVE_FUNCTION_PRECONDITION=PASS");

console.log("");
console.log("=== 2. IMMEDIATE POST-MERGE TRAFFIC RECHECK ===");
const end = new Date(Date.now() - 3 * 60 * 1000);
const start = new Date(TRAFFIC_START);

if (!(end > start)) {
  console.error("STOP: traffic end time is not later than the frozen prior-audit boundary.");
  process.exit(5);
}
if (end.getTime() - start.getTime() > 24 * 60 * 60 * 1000) {
  console.error("STOP: immediate traffic window exceeded 24 hours.");
  process.exit(6);
}

const logEndpoint =
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs`;
const sql = `
select
  count() as total_function_logs,
  countIf(log_attributes['function_id'] = '${TARGET_ID}') as target_invocations,
  countIf(log_attributes['function_id'] = '${CONTROL_ID}') as positive_control_invocations
from logs
where source = 'function_edge_logs'
`;

const logUrl = new URL(logEndpoint);
logUrl.searchParams.set("sql", sql);
logUrl.searchParams.set("iso_timestamp_start", start.toISOString());
logUrl.searchParams.set("iso_timestamp_end", end.toISOString());

const logResponse = await fetch(logUrl, { headers: authHeaders });
const logText = await logResponse.text();

if (!logResponse.ok) {
  console.error(`STOP: traffic recheck returned HTTP ${logResponse.status}`);
  console.error(logText);
  process.exit(7);
}

const logBody = JSON.parse(logText);
if (logBody?.error) {
  console.error("STOP: Supabase Logs API returned an error.");
  console.error(JSON.stringify(logBody.error, null, 2));
  process.exit(8);
}

const rows = Array.isArray(logBody?.result)
  ? logBody.result
  : Array.isArray(logBody?.data)
    ? logBody.data
    : Array.isArray(logBody)
      ? logBody
      : [];

if (rows.length !== 1) {
  console.error(`STOP: expected one aggregate log row, got ${rows.length}`);
  process.exit(9);
}

const row = rows[0];
const asCount = (name) => {
  const value = Number(row[name]);
  if (!Number.isInteger(value) || value < 0) {
    console.error(
      `STOP: ${name} is not a non-negative integer: ${JSON.stringify(row[name])}`
    );
    process.exit(10);
  }
  return value;
};

const total = asCount("total_function_logs");
const target = asCount("target_invocations");
const control = asCount("positive_control_invocations");

console.log(`TRAFFIC_START=${start.toISOString()}`);
console.log(`TRAFFIC_END=${end.toISOString()}`);
console.log(`TOTAL_FUNCTION_LOGS=${total}`);
console.log(`TARGET_INVOCATIONS=${target}`);
console.log(`POSITIVE_CONTROL_INVOCATIONS=${control}`);

if (total <= 0 || control <= 0) {
  console.error("STOP: immediate traffic recheck has no valid positive control.");
  process.exit(11);
}
if (target !== 0) {
  console.error(
    `STOP: registry-enrichment-review received ${target} invocation(s) after the frozen audit boundary.`
  );
  process.exit(12);
}
console.log("IMMEDIATE_TRAFFIC_RECHECK=PASS");

console.log("");
console.log("=== 3. DELETE ONLY THE RETIRED EDGE FUNCTION ===");
const deleteResponse = await fetch(functionUrl, {
  method: "DELETE",
  headers: authHeaders,
});
const deleteText = await deleteResponse.text();

console.log(`DELETE_HTTP=${deleteResponse.status}`);
if (deleteResponse.status !== 200) {
  console.error("STOP: Edge Function deletion did not return HTTP 200.");
  console.error(deleteText);
  process.exit(13);
}
console.log("EDGE_FUNCTION_DELETE=PASS");

console.log("");
console.log("=== 4. PROVE FUNCTION ABSENT FROM PRODUCTION INVENTORY ===");
const inventoryUrl =
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`;
const inventoryResponse = await fetch(inventoryUrl, { headers: authHeaders });
const inventoryText = await inventoryResponse.text();

if (!inventoryResponse.ok) {
  console.error(
    `STOP: Production function inventory returned HTTP ${inventoryResponse.status}`
  );
  console.error(inventoryText);
  process.exit(14);
}

const inventory = JSON.parse(inventoryText);
const functions = Array.isArray(inventory) ? inventory : inventory.functions ?? [];
const targetStillPresent = functions.some(
  (fn) => fn?.slug === TARGET_SLUG || fn?.id === TARGET_ID
);

if (targetStillPresent) {
  console.error("STOP: retired function still appears in Production inventory.");
  process.exit(15);
}

const controlFunction = functions.find(
  (fn) => fn?.slug === "public-content-read" || fn?.id === CONTROL_ID
);
if (!controlFunction || controlFunction.status !== "ACTIVE") {
  console.error("STOP: public-content-read positive-control runtime is not ACTIVE.");
  process.exit(16);
}

console.log("RETIRED_FUNCTION_ABSENT=PASS");
console.log(`PUBLIC_CONTENT_READ_STATUS=${controlFunction.status}`);
console.log(`PUBLIC_CONTENT_READ_VERSION=${controlFunction.version}`);
console.log("");
console.log("PRODUCTION_SQL_MUTATION=NO");
console.log("CANONICAL_REGISTRY_MUTATION=NO");
console.log("FRONTEND_DEPLOY=NO");
console.log("OTHER_EDGE_DEPLOY=NO");
console.log("SLICE3_REGISTRY_ENRICHMENT_REVIEW_PRODUCTION_RETIREMENT=PASS");
