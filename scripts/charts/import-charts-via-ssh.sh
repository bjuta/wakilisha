#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# WAKILISHA — WordPress Chart Import via SSH
#
# USAGE:
#   bash scripts/charts/import-charts-via-ssh.sh --dry-run
#   WAKILISHA_CHART_IMPORT_COMMIT=1 bash scripts/charts/import-charts-via-ssh.sh
#
# This script connects to the WordPress Lightsail server via SSH, copies the
# import script onto it, and runs it — exporting data directly into Supabase.
#
# REQUIREMENTS:
#   - SSH key access to WordPress Lightsail instance
#   - DATABASE_URL env var set in .env.local (read automatically)
#   - WP MySQL password (already known from previous sessions)
#
# HOW IT WORKS:
#   1. Reads DATABASE_URL from .env.local
#   2. Copies the TypeScript import script to the WordPress server
#   3. Connects via SSH and runs the script on the remote machine
#   4. The script reads MySQL locally (127.0.0.1) and writes to Supabase
#      remotely via DATABASE_URL
#   5. Downloads the generated report back to local machine
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
# Update these values as needed
WP_SERVER_HOST="${WP_SERVER_HOST:-ip-172-26-5-134}"        # Lightsail internal or public IP
WP_SERVER_USER="${WP_SERVER_USER:-bitnami}"                # Default Lightsail user
WP_SSH_KEY="${WP_SSH_KEY:-~/.ssh/wakilisha-lightsail.pem}" # Path to SSH key

WP_DB_HOST="${WP_DB_HOST:-127.0.0.1}"
WP_DB_PORT="${WP_DB_PORT:-3306}"
WP_DB_USER="${WP_DB_USER:-bn_wordpress}"
WP_DB_PASSWORD="${WP_DB_PASSWORD:-236407f4e9404d1cd2215f9759d1ddc198d04fa6aaffc7d61fb98f1422c4eb0b}"
WP_DB_NAME="${WP_DB_NAME:-bitnami_wordpress}"
WP_DB_PREFIX="${WP_DB_PREFIX:-wp_}"

# Remote working directory on the Lightsail server
REMOTE_TMP_DIR="/tmp/wakilisha-chart-import"

# ── Load DATABASE_URL ─────────────────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  # Try .env.local
  if [[ -f ".env.local" ]]; then
    DATABASE_URL=$(grep -E '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"' || true)
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    # Try .env
    if [[ -f ".env" ]]; then
      DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' || true)
    fi
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌  DATABASE_URL is not set. Add it to .env.local or export it."
  exit 1
fi

# ── Parse args ────────────────────────────────────────────────────────────────
DRY_RUN_FLAG="--dry-run"
COMMIT_FLAG=""

for arg in "$@"; do
  if [[ "$arg" == "--commit" ]] || [[ "${WAKILISHA_CHART_IMPORT_COMMIT:-}" == "1" ]]; then
    COMMIT_FLAG="--commit"
    DRY_RUN_FLAG=""
  fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  WAKILISHA WordPress Chart Import"
echo "═══════════════════════════════════════════════════════════════"
echo "  Mode:     ${DRY_RUN_FLAG:-COMMIT}"
echo "  WP Host:  ${WP_SERVER_HOST} (${WP_SERVER_USER})"
echo "  WP DB:    ${WP_DB_NAME} on 127.0.0.1"
echo "  Target:   Supabase via DATABASE_URL"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── SSH connection test ───────────────────────────────────────────────────────
echo "🔌 Testing SSH connection..."

SSH_CMD="ssh -i ${WP_SSH_KEY} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${WP_SERVER_USER}@${WP_SERVER_HOST}"

if ! $SSH_CMD "echo connected" >/dev/null 2>&1; then
  echo ""
  echo "❌  Cannot connect via SSH."
  echo "    If you're NOT on the Lightsail server, run the REMOTE mode instead:"
  echo ""
  echo "    npx tsx scripts/charts/import-wordpress-charts-to-v2.ts ${DRY_RUN_FLAG} \\"
  echo "      --host ip-172-26-5-134 \\"
  echo "      --port 3306 \\"
  echo "      --user bn_wordpress \\"
  echo "      --password '...' \\"
  echo "      --database bitnami_wordpress \\"
  echo "      --prefix wp_"
  echo ""
  echo "    However, this requires the MySQL port (3306) to be reachable."
  echo "    Alternatively, run this script on the server itself."
  echo ""
  echo "    See: scripts/charts/CHART_IMPORT_README.md for full options."
  exit 1
fi

echo "  ✅ SSH connected to ${WP_SERVER_HOST}"

# ── Copy scripts to remote ────────────────────────────────────────────────────
echo ""
echo "📦 Copying scripts to remote server..."

$SSH_CMD "mkdir -p ${REMOTE_TMP_DIR}/{scripts/charts,reports}"

# Copy the TypeScript importer
scp -i "${WP_SSH_KEY}" -o StrictHostKeyChecking=no \
  scripts/charts/import-wordpress-charts-to-v2.ts \
  "${WP_SERVER_USER}@${WP_SERVER_HOST}:${REMOTE_TMP_DIR}/scripts/charts/import-wordpress-charts-to-v2.ts"

# Copy package.json so tsx can be invoked
scp -i "${WP_SSH_KEY}" -o StrictHostKeyChecking=no \
  package.json \
  "${WP_SERVER_USER}@${WP_SERVER_HOST}:${REMOTE_TMP_DIR}/package.json"

echo "  ✅ Scripts copied"

# ── Install dependencies on remote ───────────────────────────────────────────
echo ""
echo "📦 Checking Node.js + dependencies on remote..."

$SSH_CMD "
  cd ${REMOTE_TMP_DIR}
  
  # Check for node
  if ! command -v node >/dev/null 2>&1; then
    echo '⚠️  Node.js not found. Installing via nvm...'
    curl -sS https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR=\"\$HOME/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\"
    nvm install 20
    nvm use 20
  fi

  node_version=\$(node --version)
  echo \"Node.js: \$node_version\"

  # Install minimal deps
  if [[ ! -d node_modules/mysql2 ]]; then
    npm install mysql2 pg tsx typescript --no-save --silent
  else
    echo 'Dependencies already installed'
  fi
"

# ── Run the import ────────────────────────────────────────────────────────────
echo ""
echo "🚀 Running chart import..."

COMMIT_ENV=""
if [[ -n "$COMMIT_FLAG" ]]; then
  COMMIT_ENV="WAKILISHA_CHART_IMPORT_COMMIT=1"
fi

$SSH_CMD "
  cd ${REMOTE_TMP_DIR}
  
  # Ensure NVM loaded if needed
  export NVM_DIR=\"\$HOME/.nvm\"
  [ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\"

  ${COMMIT_ENV} \\
  DATABASE_URL='${DATABASE_URL}' \\
  WP_DB_HOST='${WP_DB_HOST}' \\
  WP_DB_PORT='${WP_DB_PORT}' \\
  WP_DB_USER='${WP_DB_USER}' \\
  WP_DB_PASSWORD='${WP_DB_PASSWORD}' \\
  WP_DB_NAME='${WP_DB_NAME}' \\
  WP_DB_PREFIX='${WP_DB_PREFIX}' \\
  npx tsx scripts/charts/import-wordpress-charts-to-v2.ts ${DRY_RUN_FLAG}
"

# ── Download reports ─────────────────────────────────────────────────────────
echo ""
echo "📥 Downloading reports..."

mkdir -p reports

scp -i "${WP_SSH_KEY}" -o StrictHostKeyChecking=no -r \
  "${WP_SERVER_USER}@${WP_SERVER_HOST}:${REMOTE_TMP_DIR}/reports/" \
  ./reports/ 2>/dev/null || true

echo "  ✅ Reports downloaded to ./reports/"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Import complete!"
if [[ -z "$COMMIT_FLAG" ]]; then
  echo ""
  echo "  This was a DRY RUN. No data was written to Supabase."
  echo ""
  echo "  Review the report at: reports/chart-v2-wordpress-import.json"
  echo "  Review the SQL at: reports/chart-v2-wordpress-import.sql"
  echo ""
  echo "  To commit, run:"
  echo "  WAKILISHA_CHART_IMPORT_COMMIT=1 bash scripts/charts/import-charts-via-ssh.sh"
fi
echo "═══════════════════════════════════════════════════════════════"
echo ""