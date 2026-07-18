#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-pgzizndxdyhqmtyywjmt}"
TYPE_FILE="src/types/database.types.ts"
BASELINE_FILE="docs/engineering/live-schema-baseline.json"
TMP_FILE="$(mktemp)"

cleanup() {
  rm -f "$TMP_FILE"
}

trap cleanup EXIT

mkdir -p \
  "$(dirname "$TYPE_FILE")" \
  "$(dirname "$BASELINE_FILE")"

npx supabase gen types typescript \
  --project-id "$PROJECT_REF" \
  --schema public,editorial \
  > "$TMP_FILE"

if [ ! -s "$TMP_FILE" ]; then
  echo "Live schema generation returned an empty file."
  exit 1
fi

mv "$TMP_FILE" "$TYPE_FILE"

SCHEMA_SHA="$(
  shasum -a 256 "$TYPE_FILE" \
    | awk '{print $1}'
)"

MIGRATION_COUNT="$(
  find supabase/migrations \
    -maxdepth 1 \
    -type f \
    -name '*.sql' \
    | wc -l \
    | tr -d ' '
)"

LATEST_MIGRATION="$(
  find supabase/migrations \
    -maxdepth 1 \
    -type f \
    -name '*.sql' \
    | sort \
    | tail -1 \
    | sed 's#^.*/##'
)"

GENERATED_AT="$(
  date -u '+%Y-%m-%dT%H:%M:%SZ'
)"

export \
  PROJECT_REF \
  SCHEMA_SHA \
  MIGRATION_COUNT \
  LATEST_MIGRATION \
  GENERATED_AT \
  BASELINE_FILE

node --input-type=module <<'NODE'
import fs from "node:fs";

const baseline = {
  projectRef: process.env.PROJECT_REF,
  schema: "public",
  generatedAt:
    process.env.GENERATED_AT,
  typesSha256:
    process.env.SCHEMA_SHA,
  authoritativeMigrationDirectory:
    "supabase/migrations",
  migrationCount: Number(
    process.env.MIGRATION_COUNT,
  ),
  latestMigration:
    process.env.LATEST_MIGRATION,
};

fs.writeFileSync(
  process.env.BASELINE_FILE,
  `${JSON.stringify(
    baseline,
    null,
    2,
  )}\n`,
);
NODE

echo "Generated $TYPE_FILE"
echo "Recorded $BASELINE_FILE"
