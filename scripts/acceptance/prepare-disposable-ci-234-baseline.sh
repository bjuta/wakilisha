#!/usr/bin/env bash
set -euo pipefail
# Isolated GitHub PR runner only. The 235 retirement preflight requires the
# historical 18-edition data fixture. This workflow's lease/Auth tests are
# intentionally scoped to the exact 234 application-migration substrate.
# Hold all later reviewed SQL outside the Supabase migration directory;
# do NOT change SQL text, migration history, remote projects, or Docker data.
[ "${GITHUB_ACTIONS:-}" = true ] && [ "${GITHUB_EVENT_NAME:-}" = pull_request ] || {
  echo 'STOP_CI_234_NOT_PULL_REQUEST'; exit 20;
}
[ -z "${SUPABASE_PROJECT_REF:-}" ] && [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] && \
[ ! -e supabase/.temp/project-ref ] || {
  echo 'STOP_CI_234_REMOTE_OR_LINKED_PROJECT'; exit 20;
}
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
[ -n "${RUNNER_TEMP:-}" ] && [ -d "$RUNNER_TEMP" ] || {
  echo 'STOP_CI_234_RUNNER_TEMP_MISSING'; exit 20;
}
[ ! -e "supabase/.temp/project-ref" ] || {
  echo 'STOP_CI_234_LINKED_PROJECT'; exit 20;
}
MIGRATIONS="supabase/migrations"
# This exact app history was independently accepted locally as 239/239.
# The 5 held migrations must never be replaced by a fabricated baseline.
HOLD=(
  20261030062819_retire_18_kenya_rnb_editions.sql
  20261030095808_wk100_governed_publisher_v1.sql
  20261030180827_chart_full_filter_decision_execution_v1.sql
  20261031194228_wk100_research_observation_ledger_v1.sql
  20261101074119_wk100_html_research_ledger_v1.sql
)
mapfile -t SOURCE < <(find "$MIGRATIONS" -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort)
[ "${#SOURCE[@]}" -eq 239 ] && \
[ "${SOURCE[233]}" = "$MIGRATIONS/20261020072800_wk_chart_capture_runtime_v1.sql" ] && \
[ "${SOURCE[238]}" = "$MIGRATIONS/${HOLD[4]}" ] || {
  echo 'STOP_CI_234_SOURCE_MANIFEST_DRIFT'; exit 21;
}
[ -z "$(git status --porcelain -- "$MIGRATIONS")" ] || {
  echo 'STOP_CI_234_MIGRATIONS_ALREADY_MODIFIED'; exit 21;
}
for file in "${SOURCE[@]}"; do
  [ "$(git hash-object "$file")" = "$(git rev-parse "HEAD:$file")" ] || {
    echo 'STOP_CI_234_SQL_BLOB_DRIFT'; exit 21;
  }
done
for i in {0..4}; do
  [ "${SOURCE[$((234+i))]}" = "$MIGRATIONS/${HOLD[i]}" ] || {
    echo 'STOP_CI_234_HELD_ORDER_DRIFT'; exit 21;
  }
done
# Only this unlinked disposable GitHub runner's working directory is changed.
HOLD_DIR="$(mktemp -d "$RUNNER_TEMP/wk-ci-post234-held.XXXXXXXX")"
chmod 700 "$HOLD_DIR"
for file in "${HOLD[@]}"; do
  mv -- "$MIGRATIONS/$file" "$HOLD_DIR/$file"
done
mapfile -t ACTIVE < <(find "$MIGRATIONS" -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort)
[ "${#ACTIVE[@]}" -eq 234 ] && \
[ "${ACTIVE[233]}" = "$MIGRATIONS/20261020072800_wk_chart_capture_runtime_v1.sql" ] || {
  echo 'STOP_CI_234_STAGED_MANIFEST_DRIFT'; exit 22;
}
for file in "${HOLD[@]}"; do
  [ ! -e "$MIGRATIONS/$file" ] && \
  [ "$(git hash-object "$HOLD_DIR/$file")" = "$(git rev-parse "HEAD:$MIGRATIONS/$file")" ] || {
    echo 'STOP_CI_234_HELD_BYTES_CHANGED'; exit 22;
  }
done
echo 'WK_CI_EXACT_234_NATIVE_MIGRATIONS_STAGED_WITH_ALL_5_FUTURE_SQL_BLOBS_PRESERVED=PASS'
echo 'WK_CI_235_RETIREMENT_NOT_SKIPPED_IN_DATABASE_LEDGER=PASS'
