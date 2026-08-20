#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

printf '\n1. VERIFY EXACT MERGED MAIN\n'
git fetch origin main
test "$(git branch --show-current)" = "main"
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
test -z "$(git status --porcelain)"
echo "EXACT_MERGED_MAIN_PASS"

printf '\n2. VERIFY PRODUCTION PARITY + PENDING SET\n'
npm run schema:verify

printf '\n3. NATIVE SUPABASE DRY RUN\n'
DRY_RUN_OUTPUT="$(supabase db push --dry-run --linked 2>&1)"
printf '%s\n' "$DRY_RUN_OUTPUT"
PENDING_COUNT="$( { printf '%s\n' "$DRY_RUN_OUTPUT" | grep -Eo '[0-9]{14}_[A-Za-z0-9_-]+\.sql' || true; } | sort -u | wc -l | tr -d '[:space:]')"
test "$PENDING_COUNT" -gt 0
printf 'PENDING_MIGRATIONS=%s\n' "$PENDING_COUNT"

printf '\n4. PROMOTE WITH NATIVE DB PUSH\n'
supabase db push --linked

printf '\n5. VERIFY ZERO PENDING\n'
npm run schema:verify
POST_DRY_RUN="$(supabase db push --dry-run --linked 2>&1)"
printf '%s\n' "$POST_DRY_RUN"
POST_PENDING="$( { printf '%s\n' "$POST_DRY_RUN" | grep -Eo '[0-9]{14}_[A-Za-z0-9_-]+\.sql' || true; } | sort -u | wc -l | tr -d '[:space:]')"
test "$POST_PENDING" = "0"

echo "REPOSITORY_MIGRATION_PROMOTION_PASS"
