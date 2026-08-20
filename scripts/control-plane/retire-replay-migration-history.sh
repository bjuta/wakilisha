#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <migration-version> [migration-version ...]" >&2
  exit 2
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

printf '\n1. VERIFY RETIREMENT RECEIPTS\n'
for version in "$@"; do
  case "$version" in
    ''|*[!0-9]*) echo "STOP: invalid migration version $version" >&2; exit 1 ;;
  esac
  test "${#version}" = "14"

  ACTIVE_COUNT="$(find supabase/migrations -maxdepth 1 -type f -name "${version}_*.sql" | wc -l | tr -d '[:space:]')"
  RETIRED_COUNT="$(find docs/engineering/replay-baseline/retired-active-migrations -maxdepth 1 -type f -name "${version}_*.sql" | wc -l | tr -d '[:space:]')"
  test "$ACTIVE_COUNT" = "0"
  test "$RETIRED_COUNT" = "1"
done
echo "RETIREMENT_RECEIPTS_PASS"

printf '\n2. REPAIR HISTORY WITH NATIVE SUPABASE CLI\n'
supabase migration repair "$@" --status reverted --linked

printf '\n3. VERIFY RETIRED VERSIONS ARE ABSENT REMOTELY\n'
LIST_OUTPUT="$(supabase migration list --linked 2>&1)"
printf '%s\n' "$LIST_OUTPUT"
for version in "$@"; do
  if printf '%s\n' "$LIST_OUTPUT" | sed 's/│/|/g' | awk -F'|' '{gsub(/[[:space:]]/,"",$2); print $2}' | grep -qx "$version"; then
    echo "STOP: migration version $version remains in remote history" >&2
    exit 1
  fi
done

echo "REPLAY_MIGRATION_HISTORY_RETIREMENT_PASS"
