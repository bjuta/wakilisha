import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Check = {
  id: string;
  status: "pass" | "fail" | "warning" | "skipped";
  title: string;
  detail: string;
};

type PreviewReport = {
  migrationReadiness: "ready" | "ready_with_warnings" | "blocked";
  blockerCount: number;
  warningCount: number;
};

type InsertPlan = {
  generatedAt: string;
  mode: "dry-run-no-db-writes";
  blocked: boolean;
  counts: Record<string, number>;
};

const root = process.cwd();
const reportsDir = path.join(root, "reports");
const previewPath = path.join(reportsDir, "chart-v2-migration-preview.json");
const planPath = path.join(reportsDir, "chart-v2-insert-plan.json");
const sqlPath = path.join(reportsDir, "chart-v2-inserts.sql");
const reportJsonPath = path.join(reportsDir, "chart-v2-apply-report.json");
const reportMdPath = path.join(reportsDir, "chart-v2-apply-report.md");

const REQUIRED_ROLLBACK_CONFIRMATION = "I_UNDERSTAND_THIS_RUNS_ROLLBACK_SQL";
const REQUIRED_COMMIT_CONFIRMATION = "I_UNDERSTAND_THIS_WILL_PERSIST_CHART_V2_DATA";
const mode = process.env.WAKILISHA_V2_APPLY_MODE ?? "readiness_only";
const databaseUrl = process.env.DATABASE_URL ?? "";
const rollbackConfirmation = process.env.WAKILISHA_V2_ROLLBACK_CONFIRM ?? "";
const commitConfirmation = process.env.WAKILISHA_V2_COMMIT_CONFIRM ?? "";
const allowDbWrites = process.env.WAKILISHA_ALLOW_V2_DB_WRITES === "1";
const allowCommit = process.env.WAKILISHA_ALLOW_V2_COMMIT === "1";

function readJsonFile<T>(filepath: string): T {
  if (!fs.existsSync(filepath)) throw new Error(`Missing required file: ${filepath}`);
  return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
}

function add(checks: Check[], check: Check) {
  checks.push(check);
}

function fileSizeMb(filepath: string): number {
  if (!fs.existsSync(filepath)) return 0;
  return Number((fs.statSync(filepath).size / 1024 / 1024).toFixed(2));
}

function normalizeSqlForCommit(sql: string): string {
  const trimmed = sql.trim();
  if (!/ROLLBACK;\s*$/i.test(trimmed)) {
    throw new Error("Refusing commit-mode: SQL artifact does not end with ROLLBACK; exactly as expected.");
  }
  if (/COMMIT;\s*$/i.test(trimmed)) {
    throw new Error("Refusing commit-mode: SQL artifact already contains trailing COMMIT; expected rollback-only artifact.");
  }
  return `${trimmed.replace(/ROLLBACK;\s*$/i, "COMMIT;")}\n`;
}

function runPsql(sqlFilePath: string): { exitCode: number | null; stdout: string; stderr: string } {
  const result = spawnSync("psql", [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-f", sqlFilePath], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
  });
  return {
    exitCode: typeof result.status === "number" ? result.status : null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function queryCounts(): Record<string, number> | null {
  if (!databaseUrl) return null;
  const sql = `
    SELECT json_build_object(
      'series', (SELECT COUNT(*)::int FROM wk_chart_series_v2),
      'markets', (SELECT COUNT(*)::int FROM wk_chart_markets_v2),
      'programs', (SELECT COUNT(*)::int FROM wk_chart_programs_v2),
      'methodologies', (SELECT COUNT(*)::int FROM wk_chart_methodologies_v2),
      'eligibilityRules', (SELECT COUNT(*)::int FROM wk_chart_eligibility_rules_v2),
      'editions', (SELECT COUNT(*)::int FROM wk_chart_editions_v2),
      'entries', (SELECT COUNT(*)::int FROM wk_chart_entries_v2),
      'sourceCoverage', (SELECT COUNT(*)::int FROM wk_chart_source_coverage_v2),
      'slugAliases', (SELECT COUNT(*)::int FROM wk_chart_slug_aliases_v2)
    );
  `;
  const result = spawnSync("psql", [databaseUrl, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  });
  if (result.status !== 0) return null;
  return JSON.parse(result.stdout.trim()) as Record<string, number>;
}

fs.mkdirSync(reportsDir, { recursive: true });

const preview = readJsonFile<PreviewReport>(previewPath);
const plan = readJsonFile<InsertPlan>(planPath);
const sql = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, "utf8") : "";
const checks: Check[] = [];
let executionStatus: "not_attempted" | "refused" | "executed_rollback" | "executed_commit" = "not_attempted";
let executionDetail = "Default mode is readiness-only. No database command was executed.";
let psqlResult: { exitCode: number | null; stdout: string; stderr: string } | null = null;
let commitSqlPath: string | null = null;
let dbCountsAfter: Record<string, number> | null = null;

add(checks, {
  id: "APPLY-001",
  status: preview.blockerCount === 0 && preview.migrationReadiness !== "blocked" ? "pass" : "fail",
  title: "Migration preview has zero blockers",
  detail: `readiness=${preview.migrationReadiness}; blockerCount=${preview.blockerCount}`,
});

add(checks, {
  id: "APPLY-002",
  status: plan.blocked === false ? "pass" : "fail",
  title: "Insert plan is unblocked",
  detail: `blocked=${plan.blocked}; mode=${plan.mode}`,
});

add(checks, {
  id: "APPLY-003",
  status: fs.existsSync(sqlPath) && sql.includes("BEGIN;") && /ROLLBACK;\s*$/i.test(sql.trim()) && !/COMMIT;\s*$/i.test(sql.trim()) ? "pass" : "fail",
  title: "Source SQL artifact is rollback-only",
  detail: `exists=${fs.existsSync(sqlPath)}; size=${fileSizeMb(sqlPath)}MB; trailingRollback=${/ROLLBACK;\s*$/i.test(sql.trim())}`,
});

add(checks, {
  id: "APPLY-004",
  status: preview.warningCount > 0 ? "warning" : "pass",
  title: "Content QA warning acknowledgement",
  detail: `${preview.warningCount} content warning(s) remain. Commit-mode is allowed only after accepting documented QA decisions.`,
});

const failedChecks = checks.filter((check) => check.status === "fail");

if (mode === "readiness_only") {
  executionStatus = "not_attempted";
  executionDetail = "Readiness-only mode. No database command was executed.";
} else if (failedChecks.length > 0) {
  executionStatus = "refused";
  executionDetail = "Refused because one or more safety checks failed.";
} else if (!allowDbWrites) {
  executionStatus = "refused";
  executionDetail = "Refused because WAKILISHA_ALLOW_V2_DB_WRITES=1 is not set.";
} else if (!databaseUrl) {
  executionStatus = "refused";
  executionDetail = "Refused because DATABASE_URL is missing.";
} else if (mode === "execute_rollback_sql") {
  if (rollbackConfirmation !== REQUIRED_ROLLBACK_CONFIRMATION) {
    executionStatus = "refused";
    executionDetail = `Refused because WAKILISHA_V2_ROLLBACK_CONFIRM must equal ${REQUIRED_ROLLBACK_CONFIRMATION}.`;
  } else {
    psqlResult = runPsql(sqlPath);
    executionStatus = "executed_rollback";
    executionDetail = "Rollback SQL executed. Because the SQL artifact ends with ROLLBACK, no persisted writes should remain if execution completed successfully.";
  }
} else if (mode === "execute_commit_sql") {
  if (!allowCommit) {
    executionStatus = "refused";
    executionDetail = "Refused because WAKILISHA_ALLOW_V2_COMMIT=1 is not set.";
  } else if (commitConfirmation !== REQUIRED_COMMIT_CONFIRMATION) {
    executionStatus = "refused";
    executionDetail = `Refused because WAKILISHA_V2_COMMIT_CONFIRM must equal ${REQUIRED_COMMIT_CONFIRMATION}.`;
  } else {
    const commitSql = normalizeSqlForCommit(sql);
    commitSqlPath = path.join(reportsDir, "chart-v2-inserts.COMMIT.generated.sql");
    fs.writeFileSync(commitSqlPath, commitSql);
    psqlResult = runPsql(commitSqlPath);
    executionStatus = "executed_commit";
    executionDetail = "Commit SQL executed. This mode persists Chart V2 data if psql exits successfully.";
    dbCountsAfter = queryCounts();
  }
} else {
  executionStatus = "refused";
  executionDetail = `Refused because unsupported WAKILISHA_V2_APPLY_MODE=${mode}.`;
}

const report = {
  generatedAt: new Date().toISOString(),
  mode,
  executionStatus,
  executionDetail,
  environment: {
    allowDbWrites,
    allowCommit,
    databaseUrlProvided: Boolean(databaseUrl),
    rollbackConfirmationProvided: Boolean(rollbackConfirmation),
    commitConfirmationProvided: Boolean(commitConfirmation),
  },
  checks,
  expectedCounts: plan.counts,
  dbCountsAfter,
  artifacts: {
    preview: path.relative(root, previewPath),
    insertPlan: path.relative(root, planPath),
    rollbackSql: path.relative(root, sqlPath),
    generatedCommitSql: commitSqlPath ? path.relative(root, commitSqlPath) : null,
  },
  psql: psqlResult ? {
    exitCode: psqlResult.exitCode,
    stdout: psqlResult.stdout.slice(-4000),
    stderr: psqlResult.stderr.slice(-4000),
  } : null,
};

const md = `# Chart V2 Apply Report

Generated: ${report.generatedAt}

Mode: **${mode}**

Execution status: **${executionStatus}**

${executionDetail}

## Checks

| ID | Status | Check | Detail |
| --- | --- | --- | --- |
${checks.map((check) => `| ${check.id} | ${check.status.toUpperCase()} | ${check.title} | ${check.detail.replace(/\|/g, "\\|")} |`).join("\n")}

## Expected counts

| Item | Count |
| --- | ---: |
${Object.entries(plan.counts).map(([key, value]) => `| ${key} | ${value} |`).join("\n")}

## How to run safely

Readiness only:

\`npm run charts:v2-apply-plan\`

Rollback execution:

\`WAKILISHA_ALLOW_V2_DB_WRITES=1 WAKILISHA_V2_APPLY_MODE=execute_rollback_sql WAKILISHA_V2_ROLLBACK_CONFIRM=${REQUIRED_ROLLBACK_CONFIRMATION} DATABASE_URL=postgres://... npm run charts:v2-apply-plan\`

Persistent commit execution:

\`WAKILISHA_ALLOW_V2_DB_WRITES=1 WAKILISHA_ALLOW_V2_COMMIT=1 WAKILISHA_V2_APPLY_MODE=execute_commit_sql WAKILISHA_V2_COMMIT_CONFIRM=${REQUIRED_COMMIT_CONFIRMATION} DATABASE_URL=postgres://... npm run charts:v2-apply-plan\`

## Safety note

Commit mode generates \`reports/chart-v2-inserts.COMMIT.generated.sql\` from the rollback-only SQL artifact at runtime. Do not commit the generated COMMIT SQL file.
`;

fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(reportMdPath, md);

console.log("Chart V2 apply report generated");
console.log(`Mode: ${mode}`);
console.log(`Execution status: ${executionStatus}`);
console.log(`Checks: ${checks.filter((check) => check.status === "pass").length} pass, ${checks.filter((check) => check.status === "warning").length} warning, ${checks.filter((check) => check.status === "fail").length} fail`);
console.log(`JSON: ${path.relative(root, reportJsonPath)}`);
console.log(`Markdown: ${path.relative(root, reportMdPath)}`);
if (executionStatus === "refused" || (psqlResult && psqlResult.exitCode !== 0) || failedChecks.length > 0) {
  process.exitCode = 1;
}
