#!/usr/bin/env bash
set -euo pipefail

TARGET_PROJECT_REF="${SUPABASE_TARGET_PROJECT_REF:-pgzizndxdyhqmtyywjmt}"
SOURCE_PROJECT_REF="${SUPABASE_SCHEMA_SOURCE_PROJECT_REF:-${SUPABASE_PROJECT_REF:-$TARGET_PROJECT_REF}}"
SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.107.0}"

TYPE_FILE="src/types/database.types.ts"
BASELINE_FILE="docs/engineering/live-schema-baseline.json"
RUNTIME_NORMALIZER="scripts/control-plane/normalize-database-types-runtime-metadata.mjs"

SCHEMA_SEAL_MODE="${SCHEMA_SEAL_MODE:-production}"
SCHEMA_BASE_MAIN_SHA="${SCHEMA_BASE_MAIN_SHA:-}"
SCHEMA_PREVIEW_BRANCH_ID="${SCHEMA_PREVIEW_BRANCH_ID:-}"

SOURCE_TMP_FILE="$(mktemp)"
TARGET_RUNTIME_TMP_FILE="$(mktemp)"

cleanup() {
  rm -f \
    "$SOURCE_TMP_FILE" \
    "$TARGET_RUNTIME_TMP_FILE"
}

trap cleanup EXIT

case "$SCHEMA_SEAL_MODE" in
  production|preview)
    ;;
  *)
    echo "STOP: SCHEMA_SEAL_MODE must be production or preview."
    exit 1
    ;;
esac

if [ "$SCHEMA_SEAL_MODE" = "preview" ]; then
  if ! printf '%s' "$SCHEMA_BASE_MAIN_SHA" | grep -Eq '^[0-9a-f]{40}$'; then
    echo "STOP: preview schema seal requires a 40-character SCHEMA_BASE_MAIN_SHA."
    exit 1
  fi

  if ! printf '%s' "$SCHEMA_PREVIEW_BRANCH_ID" | grep -Eqi '^[0-9a-f-]{36}$'; then
    echo "STOP: preview schema seal requires a UUID SCHEMA_PREVIEW_BRANCH_ID."
    exit 1
  fi
fi

if [ ! -f "$RUNTIME_NORMALIZER" ]; then
  echo "STOP: database types runtime metadata normalizer is missing."
  exit 1
fi

mkdir -p \
  "$(dirname "$TYPE_FILE")" \
  "$(dirname "$BASELINE_FILE")"

npx --yes "supabase@${SUPABASE_CLI_VERSION}" gen types typescript \
  --project-id "$SOURCE_PROJECT_REF" \
  --schema public,editorial \
  > "$SOURCE_TMP_FILE"

if [ ! -s "$SOURCE_TMP_FILE" ]; then
  echo "Live schema generation returned an empty file."
  exit 1
fi

if [ "$SOURCE_PROJECT_REF" != "$TARGET_PROJECT_REF" ]; then
  npx --yes "supabase@${SUPABASE_CLI_VERSION}" gen types typescript \
    --project-id "$TARGET_PROJECT_REF" \
    --schema public,editorial \
    > "$TARGET_RUNTIME_TMP_FILE"

  if [ ! -s "$TARGET_RUNTIME_TMP_FILE" ]; then
    echo "Target runtime metadata generation returned an empty file."
    exit 1
  fi

  node "$RUNTIME_NORMALIZER" \
    --input "$SOURCE_TMP_FILE" \
    --runtime-source "$TARGET_RUNTIME_TMP_FILE" \
    --output "$TYPE_FILE"
else
  mv "$SOURCE_TMP_FILE" "$TYPE_FILE"
fi

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

if [ -z "$LATEST_MIGRATION" ]; then
  echo "STOP: no active migrations exist."
  exit 1
fi

MIGRATION_HEAD="${LATEST_MIGRATION%%_*}"

if ! printf '%s' "$MIGRATION_HEAD" | grep -Eq '^[0-9]{14}$'; then
  echo "STOP: latest migration filename is not canonical: $LATEST_MIGRATION"
  exit 1
fi

GENERATED_AT="$(
  date -u '+%Y-%m-%dT%H:%M:%SZ'
)"

export \
  TARGET_PROJECT_REF \
  SOURCE_PROJECT_REF \
  SCHEMA_SEAL_MODE \
  SCHEMA_BASE_MAIN_SHA \
  SCHEMA_PREVIEW_BRANCH_ID \
  SCHEMA_SHA \
  MIGRATION_COUNT \
  LATEST_MIGRATION \
  MIGRATION_HEAD \
  GENERATED_AT \
  BASELINE_FILE

node --input-type=module <<'NODE'
import fs from "node:fs";

const seal = {
  mode: process.env.SCHEMA_SEAL_MODE,
  sourceProjectRef:
    process.env.SOURCE_PROJECT_REF,
  migrationHead:
    process.env.MIGRATION_HEAD,
};

if (seal.mode === "preview") {
  seal.baseMainSha =
    process.env.SCHEMA_BASE_MAIN_SHA;
  seal.previewBranchId =
    process.env.SCHEMA_PREVIEW_BRANCH_ID;
}

const baseline = {
  projectRef:
    process.env.TARGET_PROJECT_REF,
  schema:
    "public,editorial",
  generatedAt:
    process.env.GENERATED_AT,
  typesSha256:
    process.env.SCHEMA_SHA,
  authoritativeMigrationDirectory:
    "supabase/migrations",
  migrationCount:
    Number(process.env.MIGRATION_COUNT),
  latestMigration:
    process.env.LATEST_MIGRATION,
  schemaSeal:
    seal,
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

echo "Generated $TYPE_FILE with Supabase CLI ${SUPABASE_CLI_VERSION}"
echo "Recorded $BASELINE_FILE"
echo "SCHEMA_SEAL_MODE=$SCHEMA_SEAL_MODE"
echo "SCHEMA_SOURCE_PROJECT_REF=$SOURCE_PROJECT_REF"
echo "SCHEMA_TYPES_SHA256=$SCHEMA_SHA"
