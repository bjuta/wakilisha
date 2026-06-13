#!/usr/bin/env bash
# run-enrich-4mr.sh
# Enrich 4mr-frank-white's discography from WordPress MySQL → Supabase
#
# Prerequisites:
#   DATABASE_URL env var must be set to your Supabase Postgres connection string.
#   Get it from: Supabase Dashboard → Project Settings → Database → Connection string → URI
#   It looks like: postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/run-enrich-4mr.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "============================================"
echo "  Enrich: 4mr-frank-white"
echo "============================================"
echo ""

# Required: Supabase Postgres connection string
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo ""
  echo "Get it from: Supabase Dashboard → Project Settings → Database → Connection string → URI"
  echo "Then run:"
  echo "  DATABASE_URL=\"postgresql://...\" $0"
  exit 1
fi

# Run the local enrichment script with WordPress credentials
npx tsx scripts/imports/enrich-artist-discography-local.ts \
  --host "35.176.52.252" \
  --port 3306 \
  --user "bn_wordpress" \
  --password "236407f4e9404d1cd2215f9759d1ddc198d04fa6aaffc7d61fb98f1422c4eb0b" \
  --database "bitnami_wordpress" \
  --prefix "wp_" \
  --artist "4mr-frank-white" \
  --commit

echo ""
echo "Done! Check /artists/4mr-frank-white to see the tracks."