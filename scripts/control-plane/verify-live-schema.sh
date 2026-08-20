#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-pgzizndxdyhqmtyywjmt}"
SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.107.0}"
TYPE_FILE="src/types/database.types.ts"
BASELINE_FILE="docs/engineering/live-schema-baseline.json"
SNAPSHOT_VERIFIER="scripts/control-plane/verify-repository-schema-snapshot.mjs"
REPLAY_VERIFIER="scripts/control-plane/verify-migration-replay-contract.mjs"
RUNTIME_NORMALIZER="scripts/control-plane/normalize-database-types-runtime-metadata.mjs"
TMP_FILE="$(mktemp)"
COMMITTED_NORMALIZED="$(mktemp)"
LIVE_NORMALIZED="$(mktemp)"

cleanup() {
  rm -f \
    "$TMP_FILE" \
    "$COMMITTED_NORMALIZED" \
    "$LIVE_NORMALIZED"
}

trap cleanup EXIT

if [ ! -f "$TYPE_FILE" ]; then
  echo "Committed database types are missing."
  exit 1
fi

if [ ! -f "$BASELINE_FILE" ]; then
  echo "Repository schema baseline metadata is missing."
  exit 1
fi

if [ ! -f "$RUNTIME_NORMALIZER" ]; then
  echo "Database types runtime metadata normalizer is missing."
  exit 1
fi

DRY_RUN_OUTPUT="$(
  npx --yes "supabase@${SUPABASE_CLI_VERSION}" db push \
    --dry-run \
    --linked \
    2>&1
)"
printf '%s\n' "$DRY_RUN_OUTPUT"

PENDING_COUNT="$(
  {
    printf '%s\n' \
      "$DRY_RUN_OUTPUT" |
      grep -Eo \
        '[0-9]{14}_[A-Za-z0-9_-]+\.sql' \
      || true
  } |
  sort -u |
  wc -l |
  tr -d '[:space:]'
)"

node "$SNAPSHOT_VERIFIER" \
  --pending-count \
  "$PENDING_COUNT"

if [ "$PENDING_COUNT" -gt 0 ]; then
  node "$REPLAY_VERIFIER"

  echo "PASS: committed public,editorial schema snapshot is preview-sealed for ${PENDING_COUNT} pending repository migration(s)."
  echo "PASS: production type equality is deferred until canonical merged-main promotion applies those migrations."
  exit 0
fi

npx --yes "supabase@${SUPABASE_CLI_VERSION}" gen types typescript \
  --project-id "$PROJECT_REF" \
  --schema public,editorial \
  > "$TMP_FILE"

node "$RUNTIME_NORMALIZER" \
  --input "$TYPE_FILE" \
  --normalize \
  --output "$COMMITTED_NORMALIZED"

node "$RUNTIME_NORMALIZER" \
  --input "$TMP_FILE" \
  --normalize \
  --output "$LIVE_NORMALIZED"

if ! cmp -s \
  "$COMMITTED_NORMALIZED" \
  "$LIVE_NORMALIZED"
then
  echo "STOP: Committed database types differ from production after excluding volatile PostgREST runtime metadata."

  diff -u \
    --label committed-database.types.ts \
    --label live-database.types.ts \
    "$COMMITTED_NORMALIZED" \
    "$LIVE_NORMALIZED" \
    | sed -n '1,240p' \
    || true

  exit 1
fi

echo "PASS: Committed public,editorial schema types match production using Supabase CLI ${SUPABASE_CLI_VERSION}; volatile PostgREST runtime metadata is excluded from schema equality."
