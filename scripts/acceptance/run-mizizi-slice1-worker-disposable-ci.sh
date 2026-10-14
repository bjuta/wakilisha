#!/usr/bin/env bash
set -euo pipefail
# Disposable GitHub runner + local Supabase Docker ONLY. Never a hosted DB.
ROOT="$(git rev-parse --show-toplevel)"
SQL="$ROOT/scripts/acceptance/mizizi-slice1-worker-disposable-ci.sql"
CORPUS="$ROOT/scripts/acceptance/mizizi-slice1-32-source-corpus-disposable-ci.sql"
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
[ "$(git hash-object "$CORPUS")" = "$(git rev-parse HEAD:scripts/acceptance/mizizi-slice1-32-source-corpus-disposable-ci.sql)" ] || {
  echo 'STOP_SOURCE_CORPUS_NOT_EXACT_GIT_BLOB'; exit 20;
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
       (SELECT count(*) FROM mizizi_private.case_observations)||'|'||
       (SELECT count(*) FROM mizizi_private.write_holds)||'|'||
       (SELECT count(*) FROM mizizi_private.write_hold_events)||'|'||
       (SELECT count(*) FROM platform_private.registry_execution_grants
        WHERE status='active');"
}
BEFORE="$(snapshot)" || { echo 'STOP_LOCAL_PRE_SNAPSHOT_FAILED'; exit 22; }
[ "$BEFORE" = '230|20261014182214|1|0|0|0|0|0|0|0|0|0|0|0|0|0' ] || {
  echo 'STOP_LOCAL_NOT_EXACT_EMPTY_MIGRATION_230'; exit 22;
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
  CI_C13_PRIOR_OBSERVATION_REAPPEARANCE_DENIED \
  CI_C13_OLD_OBSERVATION_REPLAY_NO_ADDITIONAL_JOURNAL_OR_REVIEW \
  CI_J26_SOURCE_BOUND_CASE_TYPED_RESOURCE_JOB_AND_COMMAND_RECEIPT \
  CI_A05_APPROVED_RELEASE_PACKAGING_V1_2_SOURCE_GATEWAY \
  CI_A05_CANONICAL_RELEASE_UNCHANGED_REVIEW_AND_RECEIPT \
  CI_C11_SAME_TRACK_TWO_INDEPENDENT_APPROVED_CLAIMS \
  CI_C11_TWO_DISTINCT_CASES_REVIEWS_EVENTS_NO_SOURCE_WRITE \
  CI_C13_CANONICAL_SOURCE_DRIFT_STALE_OBSERVATION_DENIED \
  CI_C13_STALE_CANONICAL_DENIAL_PRESERVED_EVENT_AND_REVIEW
do
  [ "$(printf '%s\n' "$SQL_OUTPUT" | grep -Fc "$proof=PASS" || true)" -eq 1 ] || {
    echo "STOP_MISSING_OR_DUPLICATE_ORIGINAL_SOURCE_WORKER_PROOF=$proof"; exit 24;
  }
done
for proof in \
  CI_C12_CHANGED_VERIFIED_OBSERVATION_ONE_CASE_REVIEW_RECEIPT \
  CI_C12_CHANGED_OBSERVATION_EXACT_REPLAY_AND_FORGED_HASH \
  CI_C12_TWO_IMMUTABLE_OBSERVATIONS_ONE_UNCHANGED_REVIEW \
  CI_A06_UNSUPPORTED_RELEASE_RULE_REJECTED \
  CI_A08_MISSING_SOURCE_UUID_REJECTED_BY_LIVE_REGISTRY_BROKER \
  CI_A08_MISSING_ENTITY_ID_FIELD_REJECTED_AT_BOUNDARY \
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
# Eight source-backed examples in each approved Track lane. Reuse the same
# disposable database AFTER the separate worker transaction fully rolled back.
# No new container, job, role grant, Supabase link or hosted fixture.
EXTENDED_BEFORE="$(snapshot)|$(docker exec -i "$CONTAINER" psql -X -q -At -v ON_ERROR_STOP=1 \
  -U supabase_admin -d postgres -c \
  "SELECT (SELECT count(*) FROM public.registry_artists)::text||'|'||
  (SELECT count(*) FROM public.registry_track_artists)::text;")"
[ "$EXTENDED_BEFORE" = "$BEFORE|0|0" ] || {
 echo 'STOP_CORPUS_NOT_EMPTY_AFTER_WORKER_ROLLBACK'; exit 25;
}
set +e
CORPUS_OUTPUT="$(docker exec -i "$CONTAINER" psql -X -q -v ON_ERROR_STOP=1 \
  -U supabase_admin -d postgres < "$CORPUS" 2>&1)"
CORPUS_CODE=$?
set -e
printf '%s\n' "$CORPUS_OUTPUT"
[ "$CORPUS_CODE" -eq 0 ] || { echo 'STOP_CORPUS_FIRST_SQL_ERROR_NO_RETRY'; exit "$CORPUS_CODE"; }
for proof in \
  CI_CORPUS_32_DISTINCT_TRACK_SOURCES_AND_STRUCTURED_CREDITS \
  CI_A01_APPROVED_TRACK_SLUG_1_1_EIGHT_SOURCE_GATEWAY_CASES \
  CI_A02_APPROVED_TRACK_SLUG_1_2_EIGHT_SOURCE_GATEWAY_CASES \
  CI_A03_APPROVED_CREDIT_GAP_1_3_EIGHT_SOURCE_GATEWAY_CASES \
  CI_A04_APPROVED_RECORDING_CONFLICT_1_3_EIGHT_SOURCE_GATEWAY_CASES \
  CI_C17_UNAUTHORIZED_WORKSPACE_GATEWAY_REJECTED \
  CI_A07_ARCHIVED_CANONICAL_TRACK_REPLAY_DENIED \
  CI_CORPUS_32_APPROVED_DISTINCT_REVIEW_CASE_RECEIPT_CHAINS \
  CI_CORPUS_CANONICAL_TRACK_SLUGS_UNMUTATED
do
 [ "$(printf '%s\n' "$CORPUS_OUTPUT" | grep -Fc "$proof=PASS" || true)" -eq 1 ] || {
   echo "STOP_MISSING_OR_DUPLICATE_CORPUS_PROOF=$proof"; exit 26;
 }
done
printf '%s\n' "$CORPUS_OUTPUT" | grep -Fq \
 'WK_CI_CORPUS_32_SOURCE_ROLLBACK=PASS' || {
   echo 'STOP_CORPUS_TRANSACTION_ROLLBACK_MARKER_MISSING'; exit 26;
}
EXTENDED_AFTER="$(snapshot)|$(docker exec -i "$CONTAINER" psql -X -q -At -v ON_ERROR_STOP=1 \
  -U supabase_admin -d postgres -c \
  "SELECT (SELECT count(*) FROM public.registry_artists)::text||'|'||
  (SELECT count(*) FROM public.registry_track_artists)::text;")"
[ "$EXTENDED_BEFORE" = "$EXTENDED_AFTER" ] || {
 echo 'STOP_CORPUS_TRANSACTION_LEFT_RESIDUAL_TRACKS_ARTISTS_CASES'; exit 26;
}
echo 'WK_CI_32_TRACK_CORPUS_INDEPENDENT_ROLLBACK_AND_CREDIT_SNAPSHOT=PASS'
echo 'WK_CI_A01_A02_A03_A04_A07_C17_SOURCE_CORPUS_GATE=PASS'

echo 'WK_CI_REAL_DATABASE_WORKER_6_SCENARIOS=PASS'
echo 'WK_CI_W31_TRUE_PARALLEL_SESSION_TEST=NOT_RUN'
echo 'WK_CI_OPERATOR_JWT_AND_BROWSER=NOT_RUN'
echo 'WK_CI_REAL_DATABASE_DB05_HOLD_POLICY_SUBSET=PASS'
echo 'WK_CI_H38_REAL_STALE_CANONICAL_WRITE_AND_H39_AUTHENTICATED_RELEASE=NOT_RUN'
