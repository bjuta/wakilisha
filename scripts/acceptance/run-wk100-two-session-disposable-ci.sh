#!/usr/bin/env bash
set -euo pipefail
# Two genuine PostgreSQL backends racing for one WK100 reservation.
# The committed synthetic contract is DISPOSABLE-LOCAL ONLY: the parent
# GitHub workflow destroys the entire Supabase local database afterward.
# The explicit Mac mode is permitted only for a local disposable stack.
# It does not impersonate GitHub Actions or grant a hosted project target.
if [ "${GITHUB_ACTIONS:-}" = true ] && [ "${GITHUB_EVENT_NAME:-}" = pull_request ]; then
  echo 'WK100_DISPOSABLE_EXECUTION_CONTEXT=CI_PULL_REQUEST'
elif [ "${WK100_LOCAL_DISPOSABLE_ACCEPTANCE:-}" = true ] &&
     [ -z "${GITHUB_ACTIONS:-}" ] && [ -z "${GITHUB_EVENT_NAME:-}" ] &&
     [ "${WK100_LIVE_SOURCE_ACCEPTANCE:-false}" = false ]; then
  echo 'WK100_DISPOSABLE_EXECUTION_CONTEXT=EXPLICIT_LOCAL_NO_PROVIDER_EGRESS'
else
  echo 'STOP: CI PR or explicit no-egress local disposable mode required'; exit 20
fi
[ -z "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -z "${SUPABASE_PROJECT_REF:-}" ] &&
[ ! -e supabase/.temp/project-ref ] || {
  echo 'STOP: remote Supabase authority or link present'; exit 20;
}
CONTAINER="$(docker ps --filter 'name=^supabase_db_' --format '{{.Names}}')"
[ -n "$CONTAINER" ] && [ "$(printf '%s\n' "$CONTAINER" | wc -l | tr -d ' ')" = 1 ] || {
  echo 'STOP: expected one disposable database container'; exit 20;
}
db_sql() {
  docker exec -i "$CONTAINER" psql -X -q -A -t -v ON_ERROR_STOP=1 \
    -U supabase_admin -d postgres -c "$1"
}
# Require the COMPLETE active migration-version set to equal the actual
# disposable PostgreSQL ledger; a fixed Oct 20 count/head is no longer valid
# after later accepted migrations and governed historical retirements.
EXPECTED_VERSIONS="$(
  find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print |
  sed -nE 's@.*/([0-9]{14})_[^/]+\.sql$@\1@p' |
  LC_ALL=C sort
)"
ACTIVE_FILE_COUNT="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d '[:space:]')"
EXPECTED_COUNT="$(printf '%s\n' "$EXPECTED_VERSIONS" | sed '/^$/d' | wc -l | tr -d '[:space:]')"
UNIQUE_COUNT="$(printf '%s\n' "$EXPECTED_VERSIONS" | sed '/^$/d' | LC_ALL=C sort -u | wc -l | tr -d '[:space:]')"
[ "$ACTIVE_FILE_COUNT" = "$EXPECTED_COUNT" ] &&
[ "$UNIQUE_COUNT" = "$EXPECTED_COUNT" ] &&
[ "$EXPECTED_COUNT" -gt 0 ] || {
  echo 'STOP: malformed or duplicate active migration version'; exit 21;
}
ACTUAL_VERSIONS="$(db_sql 'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;')"
[ "$ACTUAL_VERSIONS" = "$EXPECTED_VERSIONS" ] || {
  echo 'STOP: disposable migration ledger differs from the exact active source set'; exit 21;
}
EXPECTED_HEAD="$(printf '%s\n' "$EXPECTED_VERSIONS" | tail -n 1)"
BASE="$(db_sql "SELECT (SELECT count(*) FROM supabase_migrations.schema_migrations)::text||'|'||
  (SELECT max(version) FROM supabase_migrations.schema_migrations)||'|'||
  (SELECT count(*) FROM public.wk_chart_capture_contracts_v1)||'|'||
  (SELECT count(*) FROM private.wk_chart_runtime_reservations_v1)||'|'||
  (SELECT count(*) FROM public.wk_chart_capture_attempts_v1)||'|'||
  (SELECT count(*) FROM storage.objects WHERE bucket_id='wk-chart-raw-evidence-v1');")"
[ "$BASE" = "$EXPECTED_COUNT|$EXPECTED_HEAD|0|0|0|0" ] || {
  echo 'STOP: disposable schema differs or candidate fixtures already exist'; exit 21;
}
echo 'WK100_DISPOSABLE_EXACT_ACTIVE_MIGRATION_LEDGER=PASS'
echo 'WK100_DISPOSABLE_ZERO_EXISTING_FIXTURES=PASS'

# Committed fixture is allowed ONLY in this already-proven disposable database.
# Preview and Production are never linked or addressed by this script.
FIXTURE="$(db_sql "WITH s AS (
  SELECT date_trunc('minute',clock_timestamp())-interval '1 minute' AS scheduled
), c AS (
  INSERT INTO public.wk_chart_capture_contracts_v1
  (source_key,contract_version,provider_key,source_surface,behavior,
   native_metric,expected_depth,cadence_kind,eat_hour,eat_minute,
   minimum_healthy_checkpoints,adapter_version,adapter_sha256)
  SELECT 'mdundo_ke','disposable-race-v1','mdundo',
    'Disposable PostgreSQL claim race; no source endpoint',
    'consumption','rank',1,'daily',
    extract(hour from s.scheduled AT TIME ZONE 'Africa/Nairobi')::integer,
    extract(minute from s.scheduled AT TIME ZONE 'Africa/Nairobi')::integer,
    1,'disposable-v1',repeat('a',64)
  FROM s RETURNING id
)
SELECT c.id::text||'|'||
  to_char(date_trunc('week',s.scheduled AT TIME ZONE 'Africa/Nairobi'),'YYYY-MM-DD')||'|'||
  to_char(s.scheduled AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
FROM c CROSS JOIN s;")"
IFS='|' read -r CONTRACT WEEK SLOT <<EOF
$FIXTURE
EOF
[[ "$CONTRACT" =~ ^[0-9a-f-]{36}$ ]] &&
[[ "$WEEK" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] &&
[[ "$SLOT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00Z$ ]] || {
  echo 'STOP: invalid synthetic contract identity'; exit 22;
}
echo 'WK100_SINGLE_DISPOSABLE_CANDIDATE_FIXTURE=PASS'

A_FILE="$(mktemp)"
B_FILE="$(mktemp)"
A_PID=''
cleanup() {
  if [ -n "$A_PID" ] && kill -0 "$A_PID" 2>/dev/null; then kill "$A_PID" 2>/dev/null || true; fi
  rm -f "$A_FILE" "$B_FILE"
}
trap cleanup EXIT
(
docker exec -i "$CONTAINER" psql -X -q -A -t -v ON_ERROR_STOP=1 \
 -U supabase_admin -d postgres <<SQL
SET application_name='wk100-ci-race-A';
BEGIN;
SET SESSION AUTHORIZATION service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT 'A_BACKEND|'||pg_backend_pid();
SELECT 'A_LEASE|'||(public.wk_chart_runtime_reserve_v1(
 '${CONTRACT}'::uuid,'${WEEK}'::date,'${SLOT}'::timestamptz,1::smallint)->>'lease_id');
SELECT pg_advisory_xact_lock(12642026);
SELECT pg_sleep(10);
COMMIT;
SQL
) > "$A_FILE" 2>&1 &
A_PID=$!

# Wait until session A actually owns a lease AND is active in its holding
# window, rather than relying on a speculative sleep outside the database.
READY=false
for i in $(seq 1 75); do
  if ! kill -0 "$A_PID" 2>/dev/null; then
    echo 'STOP: first backend ended early'; cat "$A_FILE"; exit 23
  fi
  WINDOW="$(db_sql "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_stat_activity
    WHERE application_name='wk100-ci-race-A' AND state='active'
    AND query LIKE '%pg_sleep(10)%') THEN 'READY' ELSE 'WAIT' END;")"
  if [ "$WINDOW" = READY ]; then READY=true; break; fi
  sleep 0.1
done
[ "$READY" = true ] || {
  echo 'STOP: live lease holding window not established'; cat "$A_FILE"; exit 23;
}
(
docker exec -i "$CONTAINER" psql -X -q -A -t -v ON_ERROR_STOP=1 \
 -U supabase_admin -d postgres <<SQL
SET application_name='wk100-ci-race-B';
BEGIN;
SET SESSION AUTHORIZATION service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT 'B_BACKEND|'||pg_backend_pid();
SELECT 'B_OVERLAP|'||CASE WHEN pg_try_advisory_xact_lock(12642026)
 THEN 'FAIL' ELSE 'PASS' END;
DO \$body\$
BEGIN
  PERFORM public.wk_chart_runtime_reserve_v1(
    '${CONTRACT}'::uuid,'${WEEK}'::date,'${SLOT}'::timestamptz,1::smallint);
  RAISE EXCEPTION 'WK100 second lease unexpectedly granted';
EXCEPTION WHEN lock_not_available THEN
  RAISE NOTICE 'B_SQLSTATE_55P03=PASS';
END;
\$body\$;
COMMIT;
SQL
) > "$B_FILE" 2>&1 &
B_PID=$!

# Prove B was blocked by an actual PostgreSQL lock on the same unique slot
# during the overlap; this is not a sequential duplicate-claim assertion.
B_BLOCKED=false
for i in $(seq 1 75); do
  if ! kill -0 "$B_PID" 2>/dev/null; then break; fi
  WAIT="$(db_sql "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_stat_activity
    WHERE application_name='wk100-ci-race-B' AND wait_event_type='Lock')
    THEN 'BLOCKED' ELSE 'WAIT' END;")"
  if [ "$WAIT" = BLOCKED ]; then B_BLOCKED=true; break; fi
  sleep 0.1
done
if ! wait "$A_PID"; then echo 'STOP: first session failed'; cat "$A_FILE"; exit 24; fi
A_PID=''
if ! wait "$B_PID"; then echo 'STOP: second session failed'; cat "$B_FILE"; exit 24; fi
A_BACKEND="$(sed -n 's/^A_BACKEND|//p' "$A_FILE")"
B_BACKEND="$(sed -n 's/^B_BACKEND|//p' "$B_FILE")"
[[ "$A_BACKEND" =~ ^[0-9]+$ ]] && [[ "$B_BACKEND" =~ ^[0-9]+$ ]] &&
[ "$A_BACKEND" != "$B_BACKEND" ] || {
 echo 'STOP: not two distinct PostgreSQL backends'; exit 25;
}
grep -Eq '^A_LEASE\|[0-9a-f-]{36}$' "$A_FILE" || {
  echo 'STOP: first backend lacked a valid lease'; exit 25;
}
grep -Fxq 'B_OVERLAP|PASS' "$B_FILE" &&
grep -Fq 'B_SQLSTATE_55P03=PASS' "$B_FILE" &&
[ "$B_BLOCKED" = true ] || {
  echo 'STOP: actual overlapping unique-slot lock denial not proved';
  sed -n '1,30p' "$B_FILE"; exit 25;
}
AFTER="$(db_sql "SELECT count(*)::text||'|'||
  count(distinct lease_id)::text||'|'||
  min(state)||'|'||
  (SELECT count(*) FROM public.wk_chart_capture_attempts_v1)::text
  FROM private.wk_chart_runtime_reservations_v1
  WHERE contract_id='${CONTRACT}'::uuid;")"
[ "$AFTER" = '1|1|reserved|0' ] || {
  echo 'STOP: slot/receipt state changed unexpectedly'; exit 26;
}
echo 'WK100_TWO_INDEPENDENT_POSTGRES_BACKENDS=PASS'
echo 'WK100_TRUE_OVERLAP_AND_ROW_LOCK_WITNESSED=PASS'
echo 'WK100_ONE_LEASE_SECOND_SQLSTATE_55P03=PASS'
echo 'WK100_ZERO_DUPLICATE_RECEIPTS=PASS'
echo 'WK100_SYNTHETIC_DATA_LOCAL_VOLUME_DESTROY_REQUIRED=PASS'
