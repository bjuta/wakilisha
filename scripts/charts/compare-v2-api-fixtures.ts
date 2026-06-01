import fs from "node:fs";
import path from "node:path";

type Fixtures = {
  generatedAt: string;
  mode: string;
  endpoints: Record<string, string>;
  counts: {
    programs: number;
    editions: number;
    entries: number;
    aliases: number;
  };
  responses: {
    listPrograms: { data: unknown[] | { programs?: unknown[] }; meta?: Record<string, unknown> };
    latestExamples: { endpoint: string; program: { publicSlug: string }; edition: { slug: string; entryCount: number } | null; entries: unknown[] }[];
    specificEditionExamples: { endpoint: string; program: { publicSlug: string }; edition: { slug: string; entryCount: number } | null; entries: unknown[] }[];
    aliasExamples: unknown[];
  };
};

type Check = {
  id: string;
  status: "pass" | "fail" | "warning";
  title: string;
  detail: string;
};

const root = process.cwd();
const reportsDir = path.join(root, "reports");
const fixturesPath = path.join(reportsDir, "chart-v2-api-fixtures.json");
const jsonReportPath = path.join(reportsDir, "chart-v2-api-fixture-check.json");
const mdReportPath = path.join(reportsDir, "chart-v2-api-fixture-check.md");

function readJsonFile<T>(filepath: string): T {
  if (!fs.existsSync(filepath)) throw new Error(`Missing required file: ${filepath}`);
  return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
}

function add(checks: Check[], check: Check) {
  checks.push(check);
}

fs.mkdirSync(reportsDir, { recursive: true });

const fixtures = readJsonFile<Fixtures>(fixturesPath);
const checks: Check[] = [];
const requiredEndpoints = [
  "listPrograms",
  "getProgram",
  "getLatestEdition",
  "getEdition",
  "getEditionEntries",
  "resolveAlias",
];

for (const endpoint of requiredEndpoints) {
  add(checks, {
    id: `API-${String(checks.length + 1).padStart(3, "0")}`,
    status: fixtures.endpoints[endpoint] ? "pass" : "fail",
    title: `Endpoint fixture exists: ${endpoint}`,
    detail: fixtures.endpoints[endpoint] ?? "Missing endpoint fixture",
  });
}

const listProgramsData = Array.isArray(fixtures.responses.listPrograms.data)
  ? fixtures.responses.listPrograms.data
  : fixtures.responses.listPrograms.data.programs ?? [];

add(checks, {
  id: "API-010",
  status: listProgramsData.length === fixtures.counts.programs ? "pass" : "fail",
  title: "Program list count matches fixture count",
  detail: `listPrograms=${listProgramsData.length}; expected=${fixtures.counts.programs}`,
});

add(checks, {
  id: "API-011",
  status: fixtures.responses.latestExamples.length === fixtures.counts.programs ? "pass" : "fail",
  title: "Latest examples exist for every program",
  detail: `latestExamples=${fixtures.responses.latestExamples.length}; programs=${fixtures.counts.programs}`,
});

const missingLatestEntries = fixtures.responses.latestExamples.filter((example) => example.edition && example.entries.length === 0);
add(checks, {
  id: "API-012",
  status: missingLatestEntries.length === 0 ? "pass" : "fail",
  title: "Latest examples include sample entries",
  detail: missingLatestEntries.length ? `Missing entries for ${missingLatestEntries.map((item) => item.program.publicSlug).join(", ")}` : "All latest examples include sample entries.",
});

const emptyLatest = fixtures.responses.latestExamples.filter((example) => example.edition?.entryCount === 0);
add(checks, {
  id: "API-013",
  status: emptyLatest.length === 0 ? "pass" : "fail",
  title: "Latest examples do not select empty editions",
  detail: emptyLatest.length ? `Empty latest editions: ${emptyLatest.map((item) => `${item.program.publicSlug}/${item.edition?.slug}`).join(", ")}` : "No latest example selected an empty edition.",
});

add(checks, {
  id: "API-014",
  status: fixtures.responses.aliasExamples.length > 0 ? "pass" : "warning",
  title: "Alias examples are present",
  detail: `aliasExamples=${fixtures.responses.aliasExamples.length}`,
});

const pass = checks.filter((check) => check.status === "pass").length;
const warning = checks.filter((check) => check.status === "warning").length;
const fail = checks.filter((check) => check.status === "fail").length;

const report = {
  generatedAt: new Date().toISOString(),
  mode: "fixture-contract-check-no-network",
  sourceFixtures: path.relative(root, fixturesPath),
  pass,
  warning,
  fail,
  checks,
};

const md = `# Chart V2 API Fixture Contract Check

Generated: ${report.generatedAt}

Mode: **${report.mode}**

Source fixtures: \`${report.sourceFixtures}\`

## Summary

| Status | Count |
| --- | ---: |
| Pass | ${pass} |
| Warning | ${warning} |
| Fail | ${fail} |

## Checks

| ID | Status | Check | Detail |
| --- | --- | --- | --- |
${checks.map((check) => `| ${check.id} | ${check.status.toUpperCase()} | ${check.title} | ${check.detail.replace(/\|/g, "\\|")} |`).join("\n")}

## Notes

This script validates the generated fixture contract only. It does not call a live API and does not write to a database. Once the V2 REST API exists, this can be extended into a live smoke test that compares backend responses against these fixtures.
`;

fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
fs.writeFileSync(mdReportPath, md);

console.log("Chart V2 API fixture contract check generated");
console.log(`Checks: ${pass} pass, ${warning} warning, ${fail} fail`);
console.log(`JSON: ${path.relative(root, jsonReportPath)}`);
console.log(`Markdown: ${path.relative(root, mdReportPath)}`);
if (fail > 0) process.exitCode = 1;
