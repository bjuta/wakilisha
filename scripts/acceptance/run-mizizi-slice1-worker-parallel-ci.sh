#!/usr/bin/env bash
set -euo pipefail
# Local Github PR runner ONLY. Setup intentionally COMMITS fixtures so two
# independent Postgres sessions can see and race on the exact same queued job.
# The subsequent CI step must destroy the disposable local Docker volumes.
[ "$GITHUB_ACTIONS" = true ] && [ "$GITHUB_EVENT_NAME" = pull_request ] || {
  echo 'STOP_NOT_DISPOSABLE_PR_RUNNER'; exit 20;
}
[ -z "$(printenv SUPABASE_ACCESS_TOKEN || true)" ] &&
[ -z "$(printenv SUPABASE_PROJECT_REF || true)" ] || {
  echo 'STOP_REMOTE_SUPABASE_AUTHORITY_PRESENT'; exit 20;
}
[ ! -e supabase/.temp/project-ref ] || { echo 'STOP_LINKED_TARGET'; exit 20; }
SQL=scripts/acceptance/mizizi-slice1-worker-parallel-setup-ci.sql
[ "$(git hash-object "$SQL")" = "$(git rev-parse HEAD:$SQL)" ] || {
  echo 'STOP_PARALLEL_SQL_NOT_EXACT_GIT_BLOB'; exit 20;
}
CONTAINER="$(docker ps --filter 'name=^supabase_db_' --format '{{.Names}}')"
[ -n "$CONTAINER" ] && [ "$(printf '%s\n' "$CONTAINER" | wc -l)" -eq 1 ] || {
  echo 'STOP_PARALLEL_LOCAL_CONTAINER_CARDINALITY'; exit 21;
}
db_sql() {
  docker exec -i "$CONTAINER" psql -X -q -At -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -c "$1"
}
BEFORE="$(db_sql "SELECT (SELECT count(*) FROM public.registry_releases)::text||'|'||
    (SELECT count(*) FROM mizizi_private.cases)||'|'||
    (SELECT count(*) FROM platform_private.jobs);")"
[ "$BEFORE" = '0|0|0' ] || { echo 'STOP_PARALLEL_FIXTURE_ALREADY_PRESENT'; exit 21; }

# The only retained data live inside this fresh, soon-to-be-destroyed local DB.
SETUP="$(docker exec -i "$CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U supabase_admin -d postgres < "$SQL" 2>&1)" || {
  echo 'STOP_PARALLEL_SOURCE_FIXTURE_NOT_ADMITTED'; exit 22;
}
printf '%s\n' "$SETUP" | grep -Fq 'WK_CI_PARALLEL_FIXTURE_LOCAL_COMMIT=PASS' || {
  echo 'STOP_PARALLEL_SETUP_COMMIT_NOT_CONFIRMED'; exit 22;
}
[ "$(db_sql "SELECT count(*) FROM platform_private.jobs WHERE
  command_type='mizizi.case_research_v1' AND status='queued';")" = 1 ] || {
  echo 'STOP_PARALLEL_TYPED_JOB_NOT_QUEUED'; exit 22;
}
echo 'WK_CI_PARALLEL_SOURCE_AND_JOB_FIXTURE=PASS'

A_FILE="$(mktemp)"
B_FILE="$(mktemp)"
trap 'rm -f "$A_FILE" "$B_FILE"' EXIT
# Session A owns an uncommitted row lock after claiming. An advisory xact lock
# set AFTER the claim is used solely as an independent overlap witness.
(
docker exec -i "$CONTAINER" psql -X -q -At -v ON_ERROR_STOP=1 -U supabase_admin -d postgres <<'SQL'
SET application_name='wk-mizizi-race-A';
BEGIN;
SET SESSION AUTHORIZATION service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT 'A_BACKEND|'||pg_backend_pid();
SELECT 'A_JOB|'||job_id::text FROM public.mizizi_claim_case_research_jobs_v1('wk-race-A',1,300);
SELECT pg_advisory_xact_lock(97920261013);
SELECT pg_sleep(12);
COMMIT;
SQL
) > "$A_FILE" 2>&1 &
A_PID=$!

# Wait until the actual first database backend is inside its holding window.
SEEN=false
for i in $(seq 1 70); do
  if ! kill -0 "$A_PID" 2>/dev/null; then
    cat "$A_FILE"
    echo 'STOP_FIRST_WORKER_ENDED_BEFORE_OVERLAP'; exit 23
  fi
  WINDOW="$(db_sql "SELECT CASE WHEN EXISTS(
    SELECT 1 FROM pg_stat_activity
    WHERE application_name='wk-mizizi-race-A' AND state='active'
      AND query LIKE '%pg_sleep(12)%')
    THEN 'READY' ELSE 'WAIT' END;")"
  if [ "$WINDOW" = 'READY' ]; then SEEN=true; break; fi
  sleep 0.1
done
[ "$SEEN" = true ] || {
  cat "$A_FILE"
  echo 'STOP_FIRST_WORKER_HOLD_WINDOW_NOT_PROVEN'; exit 23;
}

# Session B independently tests the advisory overlap and actual SKIP LOCKED
# job claim. It must not acquire another lease while session A is uncommitted.
docker exec -i "$CONTAINER" psql -X -q -At -v ON_ERROR_STOP=1 -U supabase_admin -d postgres > "$B_FILE" 2>&1 <<'SQL'
SET application_name='wk-mizizi-race-B';
BEGIN;
SET SESSION AUTHORIZATION service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT 'B_BACKEND|'||pg_backend_pid();
SELECT 'B_OVERLAP|'||CASE WHEN pg_try_advisory_xact_lock(97920261013) THEN 'FAIL' ELSE 'PASS' END;
SELECT 'B_COUNT|'||count(*) FROM public.mizizi_claim_case_research_jobs_v1('wk-race-B',1,300);
COMMIT;
SQL
if ! wait "$A_PID"; then
  cat "$A_FILE"
  echo 'STOP_FIRST_WORKER_SQL_FAILED'; exit 24;
fi
A_BACKEND="$(sed -n 's/^A_BACKEND|//p' "$A_FILE")"
B_BACKEND="$(sed -n 's/^B_BACKEND|//p' "$B_FILE")"
A_JOB="$(sed -n 's/^A_JOB|//p' "$A_FILE")"
[ -n "$A_BACKEND" ] && [ -n "$B_BACKEND" ] && [ "$A_BACKEND" != "$B_BACKEND" ] || {
  echo 'STOP_INDEPENDENT_BACKEND_IDS_NOT_PROVEN'; exit 25;
}
[ "$A_JOB" = "$(db_sql "SELECT id::text FROM platform_private.jobs WHERE command_type='mizizi.case_research_v1';")" ] || {
  echo 'STOP_FIRST_WORKER_WRONG_JOB'; exit 25;
}
grep -Fxq 'B_OVERLAP|PASS' "$B_FILE" || { echo 'STOP_TRUE_TRANSACTION_OVERLAP_NOT_PROVEN'; exit 25; }
grep -Fxq 'B_COUNT|0' "$B_FILE" || { echo 'STOP_CONCURRENT_DUPLICATE_LEASE'; exit 25; }
AFTER="$(db_sql "SELECT count(*) FROM platform_private.jobs j
  JOIN platform_private.command_receipts r ON r.id=j.command_receipt_id
  WHERE j.command_type='mizizi.case_research_v1' AND j.status='running'
    AND j.locked_by='wk-race-A' AND j.attempt_count=1 AND r.status='accepted';")"
[ "$AFTER" = 1 ] || { echo 'STOP_CONCURRENT_JOB_OR_RECEIPT_DRIFT'; exit 25; }
echo 'WK_CI_W31_TWO_INDEPENDENT_POSTGRES_BACKENDS=PASS'
echo 'WK_CI_W31_OVERLAPPING_ROW_LOCK_AND_SKIP_LOCKED=PASS'
echo 'WK_CI_PARALLEL_FIXTURE_REQUIRES_LOCAL_VOLUME_DESTRUCTION=CONFIRMED'
