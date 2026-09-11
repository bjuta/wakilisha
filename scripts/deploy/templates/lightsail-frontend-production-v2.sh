#!/bin/bash
set -euo pipefail

EXPECTED_MAIN="57e4c9de7a205bbffde0ff97c9ec40f9a46b1b65"
PREVIEW_REF="oeownzbanzbuvuyidwqh"
PRODUCTION_REF="pgzizndxdyhqmtyywjmt"

HOST="35.176.52.252"
SSH_USER="ubuntu"
SSH_KEY="${HOME}/.ssh/LightsailDefaultKey-eu-west-wk.pem"
LIVE_ROOT="/opt/wakilisha-react"
BACKUP_ROOT="/opt/wakilisha-react-backups"

printf '\n=== GATE D PRODUCTION FINISH V221 ===\n'

REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO" ] || [ ! -d "$REPO/.git" ]; then
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_NOT_IN_REPO'
  exit 1
fi

cd "$REPO"

ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
case "$ORIGIN_URL" in
  *github.com/bjuta/wakilisha|*github.com/bjuta/wakilisha.git|git@github.com:bjuta/wakilisha.git)
    ;;
  *)
    echo 'GATE_D_PRODUCTION_FINISH=FAIL_WRONG_REPOSITORY'
    exit 1
    ;;
esac

if [ -n "$(git status --porcelain)" ]; then
  git status --short
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_DIRTY_WORKTREE'
  exit 1
fi

printf 'REPO=%s\n' "$REPO"

printf '\n=== STOP SAME-REPO PREVIEW VITE IF PRESENT ===\n'
PORT_PID="$(lsof -nP -iTCP:5173 -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"

if [ -n "$PORT_PID" ]; then
  PORT_CWD="$(lsof -a -p "$PORT_PID" -d cwd -Fn 2>/dev/null | awk '/^n/{sub(/^n/,""); print; exit}')"
  printf 'PORT_5173_PID=%s\n' "$PORT_PID"
  printf 'PORT_5173_CWD=%s\n' "${PORT_CWD:-unknown}"

  if [ "$PORT_CWD" = "$REPO" ]; then
    kill "$PORT_PID"

    i=0
    while [ "$i" -lt 10 ]; do
      if ! kill -0 "$PORT_PID" >/dev/null 2>&1; then
        break
      fi
      sleep 1
      i=$((i + 1))
    done

    if kill -0 "$PORT_PID" >/dev/null 2>&1; then
      echo 'GATE_D_PRODUCTION_FINISH=FAIL_PREVIEW_VITE_DID_NOT_STOP'
      exit 1
    fi

    echo 'SAME_REPO_PREVIEW_VITE=STOPPED'
  else
    echo 'PORT_5173_FOREIGN_PROCESS=LEFT_UNTOUCHED'
  fi
else
  echo 'PORT_5173=FREE'
fi

printf '\n=== EXACT MERGED MAIN ===\n'
git fetch origin main
git switch main
git reset --hard origin/main

MAIN="$(git rev-parse HEAD)"
printf 'MAIN=%s\n' "$MAIN"

if [ "$MAIN" != "$EXPECTED_MAIN" ]; then
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_MAIN_SHA'
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  git status --short
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_MAIN_NOT_CLEAN'
  exit 1
fi

echo 'EXACT_MERGED_MAIN=PASS'

printf '\n=== PREVIEW ENV RESIDUE GUARD ===\n'
ENV_PREVIEW_HITS="$(
  find . -maxdepth 2 -type f \( -name '.env' -o -name '.env.*' \) -print 2>/dev/null \
    | while IFS= read -r f; do
        if grep -F -q "$PREVIEW_REF" "$f" 2>/dev/null; then
          printf '%s\n' "$f"
        fi
      done
)"

if [ -n "$ENV_PREVIEW_HITS" ]; then
  printf '%s\n' "$ENV_PREVIEW_HITS"
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_PREVIEW_REF_IN_ENV_FILE'
  exit 1
fi

echo 'PREVIEW_ENV_RESIDUE=NONE'

printf '\n=== PROTECTED CRITICAL ===\n'
npm run test:critical
echo 'PROTECTED_CRITICAL=PASS'

printf '\n=== EXACT MERGED-MAIN BUILD ===\n'
rm -rf dist
npm run build

if [ ! -f dist/index.html ]; then
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_NO_DIST_INDEX'
  exit 1
fi

echo 'MERGED_MAIN_BUILD=PASS'

printf '\n=== BUILD TARGET AUTHORITY ===\n'
if grep -R -F -q "$PREVIEW_REF" dist; then
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_PREVIEW_REF_IN_DIST'
  exit 1
fi
echo 'PREVIEW_REF_IN_DIST=NO'

if grep -R -F -q "$PRODUCTION_REF" dist; then
  echo 'PRODUCTION_REF_IN_DIST=YES'
else
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_PRODUCTION_REF_NOT_FOUND_IN_DIST'
  exit 1
fi

LOCAL_INDEX_SHA="$(shasum -a 256 dist/index.html | awk '{print $1}')"
LOCAL_ENTRY="$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html | head -n 1)"

if [ -z "$LOCAL_ENTRY" ] || [ ! -f "dist/$LOCAL_ENTRY" ]; then
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_ENTRY_NOT_FOUND'
  exit 1
fi

LOCAL_ENTRY_SHA="$(shasum -a 256 "dist/$LOCAL_ENTRY" | awk '{print $1}')"
LOCAL_FILE_COUNT="$(find dist -type f | wc -l | tr -d ' ')"

printf 'LOCAL_INDEX_SHA256=%s\n' "$LOCAL_INDEX_SHA"
printf 'LOCAL_ENTRY=%s\n' "$LOCAL_ENTRY"
printf 'LOCAL_ENTRY_SHA256=%s\n' "$LOCAL_ENTRY_SHA"
printf 'LOCAL_FILE_COUNT=%s\n' "$LOCAL_FILE_COUNT"

printf '\n=== LIGHTSAIL AUTHORITY PREFLIGHT ===\n'
if [ ! -f "$SSH_KEY" ]; then
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_SSH_KEY_MISSING'
  exit 1
fi

chmod 600 "$SSH_KEY"

ssh \
  -i "$SSH_KEY" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=accept-new \
  "${SSH_USER}@${HOST}" \
  "test -d '$LIVE_ROOT' && sudo -n true && command -v rsync >/dev/null && command -v sha256sum >/dev/null"

echo 'LIGHTSAIL_PREFLIGHT=PASS'

UTC_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SHORT_SHA="$(printf '%s' "$EXPECTED_MAIN" | cut -c1-8)"
BACKUP="${BACKUP_ROOT}/gate-d-${UTC_STAMP}-${SHORT_SHA}"
REMOTE_STAGE="/tmp/wakilisha-gate-d-${UTC_STAMP}-${SHORT_SHA}"

printf 'ROLLBACK_BACKUP=%s\n' "$BACKUP"
printf 'REMOTE_STAGE=%s\n' "$REMOTE_STAGE"

printf '\n=== PRESERVE ROLLBACK SNAPSHOT ===\n'
ssh \
  -i "$SSH_KEY" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=accept-new \
  "${SSH_USER}@${HOST}" \
  "set -eu; sudo mkdir -p '$BACKUP'; sudo cp -a '$LIVE_ROOT/.' '$BACKUP/'"

echo 'ROLLBACK_SNAPSHOT=PASS'

printf '\n=== UPLOAD TO REMOTE STAGE ===\n'
ssh \
  -i "$SSH_KEY" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=accept-new \
  "${SSH_USER}@${HOST}" \
  "rm -rf '$REMOTE_STAGE'; mkdir -p '$REMOTE_STAGE'"

rsync \
  -az \
  --delete \
  -e "ssh -i $SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
  dist/ \
  "${SSH_USER}@${HOST}:${REMOTE_STAGE}/"

REMOTE_STAGE_INDEX_SHA="$(
  ssh -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    "${SSH_USER}@${HOST}" \
    "sha256sum '$REMOTE_STAGE/index.html' | awk '{print \$1}'"
)"

REMOTE_STAGE_ENTRY_SHA="$(
  ssh -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    "${SSH_USER}@${HOST}" \
    "sha256sum '$REMOTE_STAGE/$LOCAL_ENTRY' | awk '{print \$1}'"
)"

REMOTE_STAGE_FILE_COUNT="$(
  ssh -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    "${SSH_USER}@${HOST}" \
    "find '$REMOTE_STAGE' -type f | wc -l | tr -d ' '"
)"

printf 'STAGE_INDEX_SHA256=%s\n' "$REMOTE_STAGE_INDEX_SHA"
printf 'STAGE_ENTRY_SHA256=%s\n' "$REMOTE_STAGE_ENTRY_SHA"
printf 'STAGE_FILE_COUNT=%s\n' "$REMOTE_STAGE_FILE_COUNT"

test "$REMOTE_STAGE_INDEX_SHA" = "$LOCAL_INDEX_SHA"
test "$REMOTE_STAGE_ENTRY_SHA" = "$LOCAL_ENTRY_SHA"
test "$REMOTE_STAGE_FILE_COUNT" = "$LOCAL_FILE_COUNT"

STAGE_DIFF="$(
  rsync \
    -rnc \
    --delete \
    --itemize-changes \
    --out-format='%i %n%L' \
    -e "ssh -i $SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
    dist/ \
    "${SSH_USER}@${HOST}:${REMOTE_STAGE}/"
)"

if [ -n "$STAGE_DIFF" ]; then
  printf '%s\n' "$STAGE_DIFF"
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_STAGED_BYTE_PARITY'
  exit 1
fi

echo 'STAGED_ARTIFACT_PARITY=PASS'

printf '\n=== ACTIVATE FRONTEND ===\n'
ssh \
  -i "$SSH_KEY" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=accept-new \
  "${SSH_USER}@${HOST}" \
  "set -eu; sudo rsync -a --delete '$REMOTE_STAGE/' '$LIVE_ROOT/'"

echo 'FRONTEND_ACTIVATION=COMPLETE'

printf '\n=== EXACT LIVE PARITY ===\n'
REMOTE_INDEX_SHA="$(
  ssh -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    "${SSH_USER}@${HOST}" \
    "sha256sum '$LIVE_ROOT/index.html' | awk '{print \$1}'"
)"

REMOTE_ENTRY_SHA="$(
  ssh -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    "${SSH_USER}@${HOST}" \
    "sha256sum '$LIVE_ROOT/$LOCAL_ENTRY' | awk '{print \$1}'"
)"

REMOTE_FILE_COUNT="$(
  ssh -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    "${SSH_USER}@${HOST}" \
    "find '$LIVE_ROOT' -type f | wc -l | tr -d ' '"
)"

printf 'REMOTE_INDEX_SHA256=%s\n' "$REMOTE_INDEX_SHA"
printf 'REMOTE_ENTRY_SHA256=%s\n' "$REMOTE_ENTRY_SHA"
printf 'REMOTE_FILE_COUNT=%s\n' "$REMOTE_FILE_COUNT"

test "$REMOTE_INDEX_SHA" = "$LOCAL_INDEX_SHA"
test "$REMOTE_ENTRY_SHA" = "$LOCAL_ENTRY_SHA"
test "$REMOTE_FILE_COUNT" = "$LOCAL_FILE_COUNT"

LIVE_DIFF="$(
  rsync \
    -rnc \
    --delete \
    --itemize-changes \
    --out-format='%i %n%L' \
    -e "ssh -i $SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
    dist/ \
    "${SSH_USER}@${HOST}:${LIVE_ROOT}/"
)"

if [ -n "$LIVE_DIFF" ]; then
  printf '%s\n' "$LIVE_DIFF"
  echo 'GATE_D_PRODUCTION_FINISH=FAIL_LIVE_BYTE_PARITY'
  exit 1
fi

echo 'LIGHTSAIL_BUILD_PARITY=PASS'

printf '\n=== NGINX VALIDATION ===\n'
ssh \
  -i "$SSH_KEY" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=accept-new \
  "${SSH_USER}@${HOST}" \
  "sudo nginx -t"

echo 'NGINX_VALIDATION=PASS'

printf '\n=== DIRECT ORIGIN SMOKE ===\n'
for route in / /messages /admin/messages; do
  code="$(
    curl \
      -ksS \
      -o /dev/null \
      -w '%{http_code}' \
      --resolve "wakilisha.africa:443:${HOST}" \
      "https://wakilisha.africa${route}"
  )"

  printf 'DIRECT_ORIGIN_ROUTE=%s HTTP=%s\n' "$route" "$code"
  test "$code" = "200"
done

DIRECT_ENTRY_SHA="$(
  curl \
    -ksS \
    --resolve "wakilisha.africa:443:${HOST}" \
    "https://wakilisha.africa/${LOCAL_ENTRY}" \
    | shasum -a 256 \
    | awk '{print $1}'
)"

printf 'DIRECT_ENTRY_SHA256=%s\n' "$DIRECT_ENTRY_SHA"
test "$DIRECT_ENTRY_SHA" = "$LOCAL_ENTRY_SHA"

echo 'DIRECT_ORIGIN_SMOKE=PASS'

printf '\n=== PUBLIC HTTPS SMOKE ===\n'
for route in / /messages /admin/messages; do
  code="$(
    curl \
      -sS \
      -o /dev/null \
      -w '%{http_code}' \
      "https://wakilisha.africa${route}"
  )"

  printf 'PUBLIC_ROUTE=%s HTTP=%s\n' "$route" "$code"
  test "$code" = "200"
done

PUBLIC_ENTRY_SHA="$(
  curl \
    -sS \
    "https://wakilisha.africa/${LOCAL_ENTRY}" \
    | shasum -a 256 \
    | awk '{print $1}'
)"

printf 'PUBLIC_ENTRY_SHA256=%s\n' "$PUBLIC_ENTRY_SHA"
test "$PUBLIC_ENTRY_SHA" = "$LOCAL_ENTRY_SHA"

echo 'PUBLIC_HTTPS_SMOKE=PASS'

printf '\n=== CLEAN REMOTE STAGE ===\n'
ssh \
  -i "$SSH_KEY" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=accept-new \
  "${SSH_USER}@${HOST}" \
  "rm -rf '$REMOTE_STAGE'"

echo 'REMOTE_STAGE_CLEANUP=PASS'

printf '\n=== GATE D PRODUCTION FRONTEND RESULT ===\n'
printf 'DEPLOYED_MAIN=%s\n' "$EXPECTED_MAIN"
printf 'LOCAL_INDEX_SHA256=%s\n' "$LOCAL_INDEX_SHA"
printf 'REMOTE_INDEX_SHA256=%s\n' "$REMOTE_INDEX_SHA"
printf 'LOCAL_ENTRY=%s\n' "$LOCAL_ENTRY"
printf 'LOCAL_ENTRY_SHA256=%s\n' "$LOCAL_ENTRY_SHA"
printf 'REMOTE_ENTRY_SHA256=%s\n' "$REMOTE_ENTRY_SHA"
printf 'LOCAL_FILE_COUNT=%s\n' "$LOCAL_FILE_COUNT"
printf 'REMOTE_FILE_COUNT=%s\n' "$REMOTE_FILE_COUNT"
printf 'ROLLBACK_BACKUP=%s\n' "$BACKUP"
printf 'GATE_D_PRODUCTION_FRONTEND_DEPLOY=PASS\n'
