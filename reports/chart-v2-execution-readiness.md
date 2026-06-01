# Chart V2 Execution Readiness

Generated: 2026-06-01T09:23:40.151Z

Mode: **guarded-v2-insert-executor-scaffold**

Execution status: **not_attempted**

Default mode is readiness-only. No database command was executed.

## Checks

| ID | Status | Check | Detail |
| --- | --- | --- | --- |
| EXEC-001 | PASS | Preview has zero blockers | Readiness=ready_with_warnings; blockerCount=0 |
| EXEC-002 | PASS | Insert plan is dry-run and unblocked | Plan mode=dry-run-no-db-writes; blocked=false |
| EXEC-003 | PASS | Entry count matches preview | Plan entries=6332; preview entries=6332 |
| EXEC-004 | PASS | SQL artifact is rollback-only | SQL exists=true; has BEGIN=true; has ROLLBACK=true; has COMMIT=false |
| EXEC-005 | PASS | Generated artifacts are GitHub-safe | JSON=0.1MB; SQL=3.66MB |
| EXEC-006 | WARNING | Content QA warnings remain | 2 warning(s) remain. This does not block dry-run execution, but requires editorial sign-off before API cutover or real inserts. |

## Planned counts

| Item | Count |
| --- | ---: |
| series | 4 |
| markets | 1 |
| programs | 4 |
| methodologies | 1 |
| eligibilityRules | 4 |
| editions | 78 |
| entries | 6332 |
| sourceCoverage | 78 |
| slugAliases | 10 |

## Artifacts

| Artifact | Path | Size |
| --- | --- | ---: |
| Preview | `reports/chart-v2-migration-preview.json` | 0.01MB |
| Insert plan | `reports/chart-v2-insert-plan.json` | 0.1MB |
| SQL | `reports/chart-v2-inserts.sql` | 3.66MB |

## How to run rollback execution intentionally

This scaffold is readiness-only by default. To execute the rollback-only SQL against a database for validation, all of these must be set:

`WAKILISHA_ALLOW_V2_DB_WRITES=1`

`WAKILISHA_V2_EXECUTOR_MODE=execute_rollback_sql`

`WAKILISHA_V2_EXECUTOR_CONFIRM=I_UNDERSTAND_THIS_CAN_TOUCH_THE_DATABASE`

`DATABASE_URL=postgres://...`

The SQL artifact currently ends in `ROLLBACK;`. This scaffold does not support commit-mode execution.

## Safety note

This script is not a production migration runner. It is a guarded scaffold for validating that the dry-run insert plan is coherent before a real migration runner is built.
