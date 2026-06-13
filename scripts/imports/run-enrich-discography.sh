#!/usr/bin/env bash
set -euo pipefail

# ── Wakilisha: Run Artist Discography Enrichment (Local) ──────────────────
# Copy this file to your WordPress server and run:
#   chmod +x run-enrich-discography.sh
#   ./run-enrich-discography.sh              # dry run
#   ./run-enrich-discography.sh --commit     # real write
#   ./run-enrich-discography.sh --commit --artist-slug sauti-sol
#   ./run-enrich-discography.sh --commit --limit 10

# ── Env vars ──────────────────────────────────────────────────────────────
export DATABASE_URL="postgresql://postgres.pgzizndxdyhqmtyywjmt:VHK5QOIIs38ydwSh@aws-1-eu-west-2.pooler.supabase.com:5432/postgres"
export WP_DB_HOST="127.0.0.1"
export WP_DB_PORT="3306"
export WP_DB_USER="bn_wordpress"
export WP_DB_PASSWORD="236407f4e9404d1cd2215f9759d1ddc198d04fa6aaffc7d61fb98f1422c4eb0b"
export WP_DB_NAME="bitnami_wordpress"
export WP_DB_PREFIX="wp_"
export WP_DB_SOCKET="/opt/bitnami/mariadb/tmp/mysql.sock"

# ── Run ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/enrich-artist-discography-local.ts"

if [ ! -f "$SCRIPT" ]; then
  echo "ERROR: Script not found at $SCRIPT"
  echo "Make sure this .sh file lives in the same directory as enrich-artist-discography-local.ts"
  exit 1
fi

echo "Launching discography enrichment..."
echo ""
npx tsx "$SCRIPT" "$@"