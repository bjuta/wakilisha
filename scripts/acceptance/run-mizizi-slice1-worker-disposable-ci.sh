#!/usr/bin/env bash
set -euo pipefail
# Disposable GitHub runner + local Supabase Docker ONLY. Never a hosted DB.
ROOT="$(git rev-parse --show-toplevel)"
SQL="$ROOT/scripts/acceptance/mizizi-slice1-worker-disposable-ci.sql"
[ "$GITHUB_ACTIONS" = "true" ] || { echo 'STOP_NOT_DISPOSABLE_GITHUB_RUNNER'; exit 20; }
[ "$GITHUB_EVENT_NAME" = "pull_request" ] || { echo 'STOP_NOT_PULL_REQUEST'; exit 20; }
[ -z "$(printenv SUPABASE_ACCESS_TOKEN || true)" ] &&
[ -z "$(printenv SUPABASE_PROJECT_REF || true)" ] || {
  echo 'STOP_REMOTE_SUPABASE_AUTHORITY_PRESENT'; exit 20;
}
[ ! -e "$ROOT/supabase/.temp/project-ref" ] || { echo 'STOP_LINKED_SUPABASE_PROJECT'; exit 20; }
[ "$(git hash-object "$SQL")" = "$(git rev-parse HEAD:scripts/acceptance/mizizi-slice1-worker-disposable-ci.sql)" ] || {
  echo 'STOP_SQL_NOT_EXACT_GIT_BLOB'; exit 20;
}
DB_NAMES="$(docker ps --filter 'name=^supabase_db_' --format '{{.Names}}')"
[ "$(printf '%s\n' "$DB_NAMES" | grep -c .)" -eq 1 ] || { echo 'STOP_DISPOSABLE_DB_CONTAINER_CARDINALITY'; exit 21; }
CONTAINER="$DB_NAMES"
[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" = true ] || {
  echo 'STOP_DISPOSABLE_DB_NOT_RUNNING'; exit 21;
}
echo 'WK_CI_DISPOSABLE_DATABASE_CONTEXT=PASS'
snapshot() {
  docker exec -i "$CONTAINER" psql -X -q -At -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -c \
    "SELECT (SELECT count(*) FROM supabase_migrations.schema_migrations)::text||'|'||
       (SELECT max(version) FROM supabase_migrations.schema_migrations)||'|'||
       (SELECT count(*) FROM mizizi_private.workspaces)||'|'||
       (SELECT count(*) FROM public.registry_tracks)||'|'||
       (SELECT count(*) FROM public.registry_releases)||'|'||
       (SELECT count(*) FROM public.registry_review_items)||'|'||
       (SELECT count(*) FROM platform_private.jobs)||'|'||
       (SELECT count(*) FROM platform_private.command_receipts)||'|'||
       (SELECT count(*) FROM platform_private.outbox_events)||'|'||
       (SELECT count(*) FROM mizizi_private.cases)||'|'||
       (SELECT count(*) FROM mizizi_private.case_events)||'|'||
       (SELECT count(*) FROM mizizi_private.case_receipt_links)||'|'||
       (SELECT count(*) FROM mizizi_private.write_holds)||'|'||
       (SELECT count(*) FROM mizizi_private.write_hold_events)||'|'||
       (SELECT count(*) FROM platform_private.registry_execution_grants
        WHERE status='active');"
}
BEFORE="$(snapshot)" || { echo 'STOP_LOCAL_PRE_SNAPSHOT_FAILED'; exit 22; }
[ "$BEFORE" = '228|20261014094213|1|0|0|0|0|0|0|0|0|0|0|0|0' ] || {
  echo 'STOP_LOCAL_NOT_EXACT_EMPTY_MIGRATION_226'; exit 22;
}
printf 'WK_CI_BEFORE_SHA256=%s\n' "$(printf %s "$BEFORE" | sha256sum | awk '{print $1}')"
set +e
SQL_OUTPUT="$(docker exec -i "$CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U supabase_admin -d postgres < "$SQL" 2>&1)"
SQL_CODE=$?
set -e
printf '%s\n' "$SQL_OUTPUT"
AFTER="$(snapshot)" || { echo 'STOP_LOCAL_POST_SNAPSHOT_FAILED'; exit 23; }
printf 'WK_CI_AFTER_SHA256=%s\n' "$(printf %s "$AFTER" | sha256sum | awk '{print $1}')"
[ "$BEFORE" = "$AFTER" ] || { echo 'STOP_LOCAL_TRANSACTION_LEFT_RESIDUAL_ROWS'; exit 23; }
echo 'WK_CI_INDEPENDENT_ROLLBACK_SNAPSHOT=PASS'
[ "$SQL_CODE" -eq 0 ] || { echo 'STOP_LOCAL_SQL_FIRST_ERROR_NO_RETRY'; exit "$SQL_CODE"; }
for proof in \
  CI_A06_UNSUPPORTED_RELEASE_RULE_REJECTED \
  CI_A08_MISSING_SOURCE_UUID_REJECTED_BY_LIVE_REGISTRY_BROKER \
  CI_A09_DETERMINISTIC_FINGERPRINT_DRIFT_REJECTED \
  CI_A10_DUPLICATE_FINDING_REPLAY_ONE_CASE_ONE_RECEIPT \
  CI_A10_BROKER_HISTORY_AND_REVIEW_CARDINALITY \
  CI_C15_RECEIPT_LINK_EDIT_AND_DELETE_IMMUTABLE \
  CI_C16_CASE_EVENT_EDIT_AND_DELETE_IMMUTABLE \
  CI_C19_TWO_REVISIONS_ORDERED_AND_LINK_PRESERVED \
  CI_J27_TYPED_RESEARCH_JOB_IDEMPOTENT_REPLAY \
  CI_J28_SHARED_JOB_FINGERPRINT_DRIFT_REJECTED \
  CI_J27_J28_ONE_COMMAND_RECEIPT_ONE_JOB_ONE_OUTBOX \
  CI_W29_EXCLUSIVE_FIRST_CLAIM \
  CI_W30_NON_SERVICE_CLAIM_DENIED \
  CI_W32_LEASE_RECOVERED_ONCE \
  CI_W33_RESTART_REUSES_SAME_JOB \
  CI_W34_STALE_WORKER_COMPLETION_DENIED \
  CI_W35_SINGLE_DEAD_LETTER_AND_IMMUTABLE_HISTORY \
  CI_DB05_H36_TRANSACTIONAL_HOLD_AND_HISTORY \
  CI_DB05_H37_SCOPE_HOLD_POLICY_DENIAL \
  CI_DB05_H37_BOTH_CANONICAL_ADMISSION_TRIGGERS_DENIED \
  CI_DB05_RESEARCH_CLAIM_RPC_REMAINS_AVAILABLE \
  CI_DB05_H40_RELEASE_JOURNAL_AND_NO_STANDING_GRANT \
  CI_DB05_GLOBAL_WORKSPACE_OPERATION_SCOPE
do
  [ "$(printf '%s\n' "$SQL_OUTPUT" | grep -Fc "$proof=PASS" || true)" -eq 1 ] || {
    echo "STOP_MISSING_OR_DUPLICATE_DATABASE_PROOF=$proof"; exit 24;
  }
done
printf '%s\n' "$SQL_OUTPUT" | grep -Fq 'WK_CI_DISPOSABLE_WORKER_SQL_ROLLBACK=PASS' || {
  echo 'STOP_MISSING_TRANSACTION_ROLLBACK_MARKER'; exit 24;
}
printf '%s\n' "$SQL_OUTPUT" | grep -Fq 'CI_W31_TRUE_CONCURRENT_DB_SESSIONS=NOT_RUN' || {
  echo 'STOP_CONCURRENCY_SCOPE_UNDISCLOSED'; exit 24;
}
echo 'WK_CI_REAL_DATABASE_WORKER_6_SCENARIOS=PASS'
echo 'WK_CI_W31_TRUE_PARALLEL_SESSION_TEST=NOT_RUN'
echo 'WK_CI_OPERATOR_JWT_AND_BROWSER=NOT_RUN'
echo 'WK_CI_REAL_DATABASE_DB05_HOLD_POLICY_SUBSET=PASS'
echo 'WK_CI_H38_REAL_STALE_CANONICAL_WRITE_AND_H39_AUTHENTICATED_RELEASE=NOT_RUN'
