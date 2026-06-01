import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Check = {
  id: string;
  status: "pass" | "fail" | "warning" | "skipped";
  title: string;
  detail: string;
};

type InsertPlan = {
  counts: Record<string, number>;
};

const root = process.cwd();
const reportsDir = path.join(root, "reports");
const planPath = path.join(reportsDir, "chart-v2-insert-plan.json");
const jsonReportPath = path.join(reportsDir, "chart-v2-db-readiness.json");
const mdReportPath = path.join(reportsDir, "chart-v2-db-readiness.md");
const databaseUrl = process.env.DATABASE_URL ?? "";
const shouldRunDb = process.env.WAKILISHA_V2_DB_READINESS === "1";

const expectedTables = [
  "wk_chart_series_v2",
  "wk_chart_markets_v2",
  "wk_chart_programs_v2",
  "wk_chart_methodologies_v2",
  "wk_chart_eligibility_rules_v2",
  "wk_chart_editions_v2",
  "wk_chart_entries_v2",
  "wk_chart_source_coverage_v2",
  "wk_chart_slug_aliases_v2",
];

const countTableMap: Record<string, string> = {
  series: "wk_chart_series_v2",
  markets: "wk_chart_markets_v2",
  programs: "wk_chart_programs_v2",
  methodologies: "wk_chart_methodologies_v2",
  eligibilityRules: "wk_chart_eligibility_rules_v2",
  editions: "wk_chart_editions_v2",
  entries: "wk_chart_entries_v2",
  sourceCoverage: "wk_chart_source_coverage_v2",
  slugAliases: "wk_chart_slug_aliases_v2",
};

function readJsonFile<T>(filepath: string): T {
  if (!fs.existsSync(filepath)) throw new Error(`Missing required file: ${filepath}`);
  return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
}

function add(checks: Check[], check: Check) {
  checks.push(check);
}

function runPsql(sql: string): { ok: boolean; stdout: string; stderr: string; status: number | null } {
  const result = spawnSync("psql", [databaseUrl, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: typeof result.status === "number" ? result.status : null,
  };
}

fs.mkdirSync(reportsDir, { recursive: true });
const checks: Check[] = [];
const plan = fs.existsSync(planPath) ? readJsonFile<InsertPlan>(planPath) : null;
const dbCounts: Record<string, number> = {};

if (!shouldRunDb) {
  add(checks, {
    id: "DB-000",
    status: "skipped",
    title: "Database readiness check skipped",
    detail: "Set WAKILISHA_V2_DB_READINESS=1 and DATABASE_URL=postgres://... to run DB checks.",
  });
} else {
  add(checks, {
    id: "DB-001",
    status: databaseUrl ? "pass" : "fail",
    title: "DATABASE_URL is configured",
    detail: databaseUrl ? "DATABASE_URL provided." : "DATABASE_URL is missing.",
  });

  if (databaseUrl) {
    const ping = runPsql("SELECT 1 AS ok;");
    add(checks, {
      id: "DB-002",
      status: ping.ok && ping.stdout.trim() === "1" ? "pass" : "fail",
      title: "Postgres connection works",
      detail: ping.ok ? `psql returned ${ping.stdout.trim()}` : `psql failed: ${ping.stderr || ping.stdout || "unknown error"}`,
    });

    if (ping.ok) {
      const tableSql = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (${expectedTables.map((table) => `'${table}'`).join(",")})
        ORDER BY table_name;
      `;
      const tableResult = runPsql(tableSql);
      const existingTables = new Set(tableResult.stdout.split("\n").map((line) => line.trim()).filter(Boolean));
      for (const table of expectedTables) {
        add(checks, {
          id: `DB-TABLE-${table}`,
          status: existingTables.has(table) ? "pass" : "fail",
          title: `Table exists: ${table}`,
          detail: existingTables.has(table) ? "Found in public schema." : "Missing from public schema.",
        });
      }

      if (plan) {
        for (const [countKey, table] of Object.entries(countTableMap)) {
          if (!existingTables.has(table)) continue;
          const countResult = runPsql(`SELECT COUNT(*)::int FROM ${table};`);
          const actual = Number(countResult.stdout.trim());
          dbCounts[countKey] = Number.isFinite(actual) ? actual : 0;
          const expected = Number(plan.counts[countKey] ?? 0);
          add(checks, {
            id: `DB-COUNT-${countKey}`,
            status: actual === expected ? "pass" : actual === 0 ? "fail" : "warning",
            title: `Row count matches insert plan: ${countKey}`,
            detail: `database=${dbCounts[countKey]}; expected=${expected}; table=${table}`,
          });
        }
      } else {
        add(checks, {
          id: "DB-PLAN-001",
          status: "warning",
          title: "Insert plan unavailable",
          detail: "reports/chart-v2-insert-plan.json is missing, so DB row counts could not be compared to expected counts.",
        });
      }
    }
  }
}

const summary = {
  pass: checks.filter((check) => check.status === "pass").length,
  fail: checks.filter((check) => check.status === "fail").length,
  warning: checks.filter((check) => check.status === "warning").length,
  skipped: checks.filter((check) => check.status === "skipped").length,
};

const report = {
  generatedAt: new Date().toISOString(),
  mode: shouldRunDb ? "database-readiness" : "no-db-skipped",
  databaseUrlProvided: Boolean(databaseUrl),
  insertPlan: fs.existsSync(planPath) ? path.relative(root, planPath) : null,
  expectedCounts: plan?.counts ?? null,
  databaseCounts: dbCounts,
  summary,
  checks,
};

const md = `# Chart V2 Database Readiness

Generated: ${report.generatedAt}

Mode: **${report.mode}**

DATABASE_URL provided: **${report.databaseUrlProvided ? "yes" : "no"}**

Insert plan: ${report.insertPlan ? `\`${report.insertPlan}\`` : "Not found"}

## Summary

| Status | Count |
| --- | ---: |
| Pass | ${summary.pass} |
| Warning | ${summary.warning} |
| Fail | ${summary.fail} |
| Skipped | ${summary.skipped} |

## Checks

| ID | Status | Check | Detail |
| --- | --- | --- | --- |
${checks.map((check) => `| ${check.id} | ${check.status.toUpperCase()} | ${check.title} | ${check.detail.replace(/\|/g, "\\|")} |`).join("\n")}

## How to run DB readiness

\`WAKILISHA_V2_DB_READINESS=1 DATABASE_URL=postgres://... npm run charts:v2-db-readiness\`

This checker is read-only. It only runs SELECT queries against the V2 chart tables.
`;

fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
fs.writeFileSync(mdReportPath, md);

console.log("Chart V2 database readiness report generated");
console.log(`Mode: ${report.mode}`);
console.log(`Checks: ${summary.pass} pass, ${summary.warning} warning, ${summary.fail} fail, ${summary.skipped} skipped`);
if (summary.fail > 0) {
  console.error("\nFailed checks:");
  for (const check of checks.filter((item) => item.status === "fail")) {
    console.error(`- ${check.id} ${check.title}: ${check.detail}`);
  }
}
console.log(`JSON: ${path.relative(root, jsonReportPath)}`);
console.log(`Markdown: ${path.relative(root, mdReportPath)}`);
if (summary.fail > 0) process.exitCode = 1;
