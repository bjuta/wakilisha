#!/usr/bin/env node

const PROJECT_REF = "pgzizndxdyhqmtyywjmt";
const TARGET_FUNCTION_ID = "5421aa89-2b73-4fe8-9251-fa23f4dc84df";
const CONTROL_FUNCTION_ID = "085525b4-8766-4c7b-8474-1dc7ba53eeab";

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error("STOP: SUPABASE_ACCESS_TOKEN repository secret is unavailable.");
  process.exit(2);
}

const windows = [
  ["2026-09-13T12:39:00Z", "2026-09-14T12:39:00Z"],
  ["2026-09-14T12:39:00Z", "2026-09-15T12:39:00Z"],
  ["2026-09-15T12:39:00Z", "2026-09-16T12:39:00Z"],
  ["2026-09-16T12:39:00Z", "2026-09-17T12:39:00Z"],
  ["2026-09-17T12:39:00Z", "2026-09-18T12:39:00Z"],
  ["2026-09-18T12:39:00Z", "2026-09-19T12:39:00Z"],
  ["2026-09-19T12:39:00Z", "2026-09-20T12:39:00Z"],
];

const endpoint =
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs`;

const sql = `
select
  count() as total_function_logs,
  countIf(log_attributes['function_id'] = '${TARGET_FUNCTION_ID}') as target_invocations,
  countIf(log_attributes['function_id'] = '${CONTROL_FUNCTION_ID}') as positive_control_invocations
from logs
where source = 'function_edge_logs'
`;

let totalLogs = 0;
let totalTarget = 0;
let totalControl = 0;

for (let index = 0; index < windows.length; index += 1) {
  const [start, end] = windows[index];

  const url = new URL(endpoint);
  url.searchParams.set("sql", sql);
  url.searchParams.set("iso_timestamp_start", start);
  url.searchParams.set("iso_timestamp_end", end);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(
      `STOP: traffic window ${index + 1} returned HTTP ${response.status}`
    );
    console.error(text);
    process.exit(3);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    console.error("STOP: Supabase Logs API returned non-JSON output.");
    console.error(text);
    process.exit(4);
  }

  if (body?.error) {
    console.error("STOP: Supabase Logs API returned an error.");
    console.error(JSON.stringify(body.error, null, 2));
    process.exit(5);
  }

  const rows = Array.isArray(body?.result)
    ? body.result
    : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body)
        ? body
        : [];

  if (rows.length !== 1) {
    console.error(
      `STOP: expected exactly one aggregate row for window ${index + 1}; got ${rows.length}.`
    );
    console.error(JSON.stringify(body));
    process.exit(6);
  }

  const row = rows[0];

  const numeric = (name) => {
    const value = Number(row[name]);
    if (!Number.isInteger(value) || value < 0) {
      console.error(
        `STOP: ${name} is not a non-negative integer: ${JSON.stringify(row[name])}`
      );
      process.exit(7);
    }
    return value;
  };

  const logs = numeric("total_function_logs");
  const target = numeric("target_invocations");
  const control = numeric("positive_control_invocations");

  totalLogs += logs;
  totalTarget += target;
  totalControl += control;

  console.log(
    [
      `WINDOW=${index + 1}`,
      `START=${start}`,
      `END=${end}`,
      `TOTAL_FUNCTION_LOGS=${logs}`,
      `TARGET_INVOCATIONS=${target}`,
      `POSITIVE_CONTROL_INVOCATIONS=${control}`,
    ].join(" ")
  );
}

console.log("");
console.log("=== AGGREGATE SEVEN-DAY RESULT ===");
console.log(`AUDIT_WINDOWS=${windows.length}`);
console.log(`TOTAL_FUNCTION_LOGS=${totalLogs}`);
console.log(`TARGET_INVOCATIONS=${totalTarget}`);
console.log(`POSITIVE_CONTROL_INVOCATIONS=${totalControl}`);

if (totalLogs <= 0) {
  console.error("STOP: function_edge_logs contained no traffic.");
  process.exit(8);
}

if (totalControl <= 0) {
  console.error("STOP: public-content-read positive control had no traffic.");
  process.exit(9);
}

if (totalTarget !== 0) {
  console.error(
    `TRAFFIC_GATE=BLOCKED registry-enrichment-review invocations observed: ${totalTarget}`
  );
  process.exit(10);
}

console.log("REGISTRY_ENRICHMENT_REVIEW_TRAFFIC_LAST_7_DAYS=0");
console.log("POSITIVE_CONTROL=PASS");
console.log("SLICE3_REGISTRY_ENRICHMENT_REVIEW_TRAFFIC_AUDIT=PASS");
