import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type PreviewReport = {
  migrationReadiness: "ready" | "ready_with_warnings" | "blocked";
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  source?: { familyCount?: number; editionCount?: number; entryCount?: number };
  target?: Record<string, number>;
};

type InsertPlan = {
  generatedAt: string;
  mode: "dry-run-no-db-writes";
  migrationReadiness: PreviewReport["migrationReadiness"];
  blocked: boolean;
  counts: Record<string, number>;
  artifactStrategy?: Record<string, string>;
};

type Check = {
  id: string;
  status: "pass" | "fail" | "warning";
  title: string;
  detail: string;
};

const root = process.cwd();
const reportsDir = path.join(root, "reports");
const previewPath = path.join(reportsDir, "chart-v2-migration-preview.json");
const planPath = path.join(reportsDir, "chart-v2-insert-plan.json");
const sqlPath = path.join(reportsDir, "chart-v2-inserts.sql");
const executionJsonPath = path.join(reportsDir, "chart-v2-execution-readiness.json");
const executionMdPath = path.join(reportsDir, "chart-v2-execution-readiness.md");

const REQUIRED_CONFIRMATION = "I_UNDERSTAND_THIS_CAN_TOUCH_THE_DATABASE";

function readJsonFile<T>(filepath: string): T {
  if (!fs.existsSync(filepath)) throw new Error(`Missing required file: ${filepath}`);
  return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
}

function fileSizeMb(filepath: string): number {
  if (!fs.existsSync(filepath)) return 0;
  return Number((fs.statSync(filepath).size / 1024 / 1024).toFixed(2));
}

function addCheck(checks: Check[], check: Check) {
  checks.push(check);
}

fs.mkdirSync(reportsDir, { recursive: true });

const preview = readJsonFile<PreviewReport>(previewPath);
const plan = readJsonFile<InsertPlan>(planPath);
const sql = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, "utf8") : "";
const checks: Check[] = [];

addCheck(checks, {
  id: "EXEC-001",
  status: preview.blockerCount === 0 && preview.migrationReadiness !== "blocked" ? "pass" : "fail",
  title: "Preview has zero blockers",
  detail: `Readiness=${preview.migrationReadiness}; blockerCount=${preview.blockerCount}`,
});

addCheck(checks, {
  id: "EXEC-002",
  status: plan.mode === "dry-run-no-db-writes" && plan.blocked === false ? "pass" : "fail",
  title: "Insert plan is dry-run and unblocked",
  detail: `Plan mode=${plan.mode}; blocked=${plan.blocked}`,
});

const expectedEntries = preview.target?.entryCount ?? preview.source?.entryCount;
addCheck(checks, {
  id: "EXEC-003",
  status: expectedEntries === undefined || plan.counts.entries === expectedEntries ? "pass" : "fail",
  title: "Entry count matches preview",
  detail: `Plan entries=${plan.counts.entries}; preview entries=${expectedEntries ?? "unknown"}`,
});

addCheck(checks, {
  id: "EXEC-004",
  status: fs.existsSync(sqlPath) && sql.includes("BEGIN;") && sql.includes("ROLLBACK;") && !sql.includes("COMMIT;") ? "pass" : "fail",
  title: "SQL artifact is rollback-only",
  detail: `SQL exists=${fs.existsSync(sqlPath)}; has BEGIN=${sql.includes("BEGIN;")}; has ROLLBACK=${sql.includes("ROLLBACK;")}; has COMMIT=${sql.includes("COMMIT;")}`,
});

addCheck(checks, {
  id: "EXEC-005",
  status: fileSizeMb(planPath) < 100 && fileSizeMb(sqlPath) < 100 ? "pass" : "fail",
  title: "Generated artifacts are GitHub-safe",
  detail: `JSON=${fileSizeMb(planPath)}MB; SQL=${fileSizeMb(sqlPath)}MB`,
});

if (preview.warningCount > 0) {
  addCheck(checks, {
    id: "EXEC-006",
    status: "warning",
    title: "Content QA warnings remain",
    detail: `${preview.warningCount} warning(s) remain. This does not block dry-run execution, but requires editorial sign-off before API cutover or real inserts.`,
  });
}

const allowDbWrites = process.env.WAKILISHA_ALLOW_V2_DB_WRITES === "1";
const confirmation = process.env.WAKILISHA_V2_EXECUTOR_CONFIRM ?? "";
const executorMode = process.env.WAKILISHA_V2_EXECUTOR_MODE ?? "readiness_only";
const databaseUrl = process.env.DATABASE_URL ?? "";

let executionStatus: "not_attempted" | "refused" | "executed_rollback" = "not_attempted";
let executionDetail = "Default mode is readiness-only. No database command was executed.";
let psqlExitCode: number | null = null;
let psqlStdout = "";
let psqlStderr = "";

const failedChecks = checks.filter((check) => check.status === "fail");

if (allowDbWrites) {
  if (failedChecks.length > 0) {
    executionStatus = "refused";
    executionDetail = "Refused because readiness checks failed.";
  } else if (confirmation !== REQUIRED_CONFIRMATION) {
    executionStatus = "refused";
    executionDetail = `Refused because WAKILISHA_V2_EXECUTOR_CONFIRM must equal ${REQUIRED_CONFIRMATION}.`;
  } else if (executorMode !== "execute_rollback_sql") {
    executionStatus = "refused";
    executionDetail = "Refused because WAKILISHA_V2_EXECUTOR_MODE must be execute_rollback_sql. Only rollback execution is supported by this scaffold.";
  } else if (!databaseUrl) {
    executionStatus = "refused";
    executionDetail = "Refused because DATABASE_URL is not set.";
  } else {
    const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
    });
    psqlExitCode = typeof result.status === "number" ? result.status : null;
    psqlStdout = result.stdout ?? "";
    psqlStderr = result.stderr ?? "";
    executionStatus = "executed_rollback";
    executionDetail = "Rollback SQL was executed through psql. The SQL artifact contains ROLLBACK, so no persisted writes should remain if execution completed successfully.";
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: "guarded-v2-insert-executor-scaffold",
  executionStatus,
  executionDetail,
  environment: {
    allowDbWrites,
    executorMode,
    confirmationProvided: Boolean(confirmation),
    databaseUrlProvided: Boolean(databaseUrl),
  },
  checks,
  counts: plan.counts,
  artifacts: {
    preview: path.relative(root, previewPath),
    insertPlan: path.relative(root, planPath),
    sql: path.relative(root, sqlPath),
    insertPlanSizeMb: fileSizeMb(planPath),
    sqlSizeMb: fileSizeMb(sqlPath),
  },
  psql: {
    exitCode: psqlExitCode,
    stdout: psqlStdout.slice(-4000),
    stderr: psqlStderr.slice(-4000),
  },
};

const md = `# Chart V2 Execution Readiness

Generated: ${report.generatedAt}

Mode: **${report.mode}**

Execution status: **${executionStatus}**

${executionDetail}

## Checks

| ID | Status | Check | Detail |
| --- | --- | --- | --- |
${checks.map((check) => `| ${check.id} | ${check.status.toUpperCase()} | ${check.title} | ${check.detail.replace(/\|/g, "\\|")} |`).join("\n")}

## Planned counts

| Item | Count |
| --- | ---: |
${Object.entries(plan.counts).map(([key, value]) => `| ${key} | ${value} |`).join("\n")}

## Artifacts

| Artifact | Path | Size |
| --- | --- | ---: |
| Preview | \`${path.relative(root, previewPath)}\` | ${fileSizeMb(previewPath)}MB |
| Insert plan | \`${path.relative(root, planPath)}\` | ${fileSizeMb(planPath)}MB |
| SQL | \`${path.relative(root, sqlPath)}\` | ${fileSizeMb(sqlPath)}MB |

## How to run rollback execution intentionally

This scaffold is readiness-only by default. To execute the rollback-only SQL against a database for validation, all of these must be set:

\`WAKILISHA_ALLOW_V2_DB_WRITES=1\`

\`WAKILISHA_V2_EXECUTOR_MODE=execute_rollback_sql\`

\`WAKILISHA_V2_EXECUTOR_CONFIRM=${REQUIRED_CONFIRMATION}\`

\`DATABASE_URL=postgres://...\`

The SQL artifact currently ends in \`ROLLBACK;\`. This scaffold does not support commit-mode execution.

## Safety note

This script is not a production migration runner. It is a guarded scaffold for validating that the dry-run insert plan is coherent before a real migration runner is built.
`;

fs.writeFileSync(executionJsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(executionMdPath, md);

console.log("Chart V2 execution readiness report generated");
console.log(`Execution status: ${executionStatus}`);
console.log(`Checks: ${checks.filter((check) => check.status === "pass").length} pass, ${checks.filter((check) => check.status === "warning").length} warning, ${checks.filter((check) => check.status === "fail").length} fail`);
console.log(`JSON: ${path.relative(root, executionJsonPath)}`);
console.log(`Markdown: ${path.relative(root, executionMdPath)}`);
if (executionStatus === "refused" || failedChecks.length > 0) {
  process.exitCode = 1;
}
