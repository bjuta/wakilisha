#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-pgzizndxdyhqmtyywjmt}"
SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.107.0}"
TYPE_FILE="src/types/database.types.ts"
BASELINE_FILE="docs/engineering/live-schema-baseline.json"
TMP_FILE="$(mktemp)"

cleanup() {
  rm -f "$TMP_FILE"
}

trap cleanup EXIT

if [ ! -f "$TYPE_FILE" ]; then
  echo "Committed database types are missing."
  exit 1
fi

if [ ! -f "$BASELINE_FILE" ]; then
  echo "Live schema baseline metadata is missing."
  exit 1
fi

npx --yes "supabase@${SUPABASE_CLI_VERSION}" gen types typescript \
  --project-id "$PROJECT_REF" \
  --schema public,editorial \
  > "$TMP_FILE"

if ! cmp -s "$TYPE_FILE" "$TMP_FILE"; then
  echo "STOP: Committed database types differ from production."

  diff -u \
    --label committed-database.types.ts \
    --label live-database.types.ts \
    "$TYPE_FILE" \
    "$TMP_FILE" \
    | sed -n '1,240p' \
    || true

  exit 1
fi

EXPECTED_SHA="$(
  node --input-type=module -e '
    import fs from "node:fs";

    const data = JSON.parse(
      fs.readFileSync(
        "./docs/engineering/live-schema-baseline.json",
        "utf8",
      ),
    );

    process.stdout.write(
      data.typesSha256,
    );
  '
)"

ACTUAL_SHA="$(
  shasum -a 256 "$TYPE_FILE" \
    | awk '{print $1}'
)"

if [ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]; then
  echo "STOP: Live schema baseline hash is stale."
  printf 'Expected: %s\n' "$EXPECTED_SHA"
  printf 'Actual:   %s\n' "$ACTUAL_SHA"
  exit 1
fi

echo "PASS: Committed public-schema types match production using Supabase CLI ${SUPABASE_CLI_VERSION}."
