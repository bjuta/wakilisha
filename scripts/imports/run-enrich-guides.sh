#!/usr/bin/env bash
set -euo pipefail

# ── Wakilisha: Run Guide Content Enrichment (Local) ────────────────────────
# Copy this file to your WordPress server and run:
#   chmod +x run-enrich-guides.sh
#   ./run-enrich-guides.sh              # dry run
#   ./run-enrich-guides.sh --commit     # real write

# ── Env vars ──────────────────────────────────────────────────────────────
export DATABASE_URL="postgresql://postgres.pgzizndxdyhqmtyywjmt:VHK5QOIIs38ydwSh@aws-1-eu-west-2.pooler.supabase.com:5432/postgres"
export WP_DB_HOST="localhost"
export WP_DB_PORT="3306"
export WP_DB_USER="bn_wordpress"
export WP_DB_PASSWORD="2364074f9404d1cd2215f9759d1ddc198d04fa6aaffc7d61fb98f1422c4eb0b"
export WP_DB_NAME="bitnami_wordpress"
export WP_DB_PREFIX="wp_"
export WP_DB_SOCKET="/opt/bitnami/mariadb/tmp/mysql.sock"

# ── Run ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/enrich-guides-local.ts"

if [ ! -f "$SCRIPT" ]; then
  echo "ERROR: Script not found at $SCRIPT"
  echo "Make sure this .sh file lives in the same directory as enrich-guides-local.ts"
  exit 1
fi

echo "Launching guide enrichment..."
echo ""
npx tsx "$SCRIPT" "$@"