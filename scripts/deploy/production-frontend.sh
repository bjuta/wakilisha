#!/bin/bash
set -euo pipefail

RUNNER_VERSION="2"
BASE_EXPECTED_MAIN="57e4c9de7a205bbffde0ff97c9ec40f9a46b1b65"
BASE_PREVIEW_REF="oeownzbanzbuvuyidwqh"
TEMPLATE_SHA256="1770557be8998c5bc51d198bc6c22068ddd289adf40139ea562cd84da1f1e688"

SCRIPT_DIR="$(
  CDPATH= cd -- "$(dirname -- "$0")" >/dev/null 2>&1
  pwd
)"
TEMPLATE="$SCRIPT_DIR/templates/lightsail-frontend-production-v2.sh"

EXPECTED_MAIN=""
DEPLOY_LABEL=""
FORBID_REF=""
SELF_TEST=0

usage() {
  cat <<'USAGE'
WAKILISHA canonical Production frontend runner

Usage:
  scripts/deploy/production-frontend.sh \
    --expected-main <40-char merged main SHA> \
    --label <deployment-label> \
    [--forbid-ref <preview Supabase project ref>]

Validation only:
  scripts/deploy/production-frontend.sh --self-test

The wrapper renders the versioned canonical Lightsail deployment template
with the requested merged-main SHA and deployment label, validates the
rendered Bash, and only then executes it.

If --forbid-ref is omitted, the template receives a non-matching sentinel.
The template still requires the Production project ref in the built artifact.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --expected-main)
      test "$#" -ge 2 || {
        echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_MISSING_EXPECTED_MAIN_VALUE'
        exit 2
      }
      EXPECTED_MAIN="$2"
      shift 2
      ;;
    --label)
      test "$#" -ge 2 || {
        echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_MISSING_LABEL_VALUE'
        exit 2
      }
      DEPLOY_LABEL="$2"
      shift 2
      ;;
    --forbid-ref)
      test "$#" -ge 2 || {
        echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_MISSING_FORBID_REF_VALUE'
        exit 2
      }
      FORBID_REF="$2"
      shift 2
      ;;
    --self-test)
      SELF_TEST=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1"
      usage
      exit 2
      ;;
  esac
done

test -f "$TEMPLATE" || {
  echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_TEMPLATE_MISSING'
  exit 1
}

ACTUAL_TEMPLATE_SHA="$(
  shasum -a 256 "$TEMPLATE" | awk '{print $1}'
)"
printf 'RUNNER_VERSION=%s\n' "$RUNNER_VERSION"
printf 'TEMPLATE_SHA256=%s\n' "$ACTUAL_TEMPLATE_SHA"

test "$ACTUAL_TEMPLATE_SHA" = "$TEMPLATE_SHA256" || {
  echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_TEMPLATE_DRIFT'
  exit 1
}

render_runner() {
  target="$1"
  expected="$2"
  label="$3"
  forbid="$4"

  python3 - "$TEMPLATE" "$target" "$expected" "$label" "$forbid" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
expected = sys.argv[3]
label = sys.argv[4]
forbid = sys.argv[5] or "__NO_PREVIEW_REF__"

text = source.read_text()

replacements = [
    (
        'EXPECTED_MAIN="57e4c9de7a205bbffde0ff97c9ec40f9a46b1b65"',
        f'EXPECTED_MAIN="{expected}"',
        "expected main",
    ),
    (
        'PREVIEW_REF="oeownzbanzbuvuyidwqh"',
        f'PREVIEW_REF="{forbid}"',
        "preview ref",
    ),
    (
        'BACKUP="${BACKUP_ROOT}/gate-d-${UTC_STAMP}-${SHORT_SHA}"',
        f'BACKUP="${{BACKUP_ROOT}}/{label}-${{UTC_STAMP}}-${{SHORT_SHA}}"',
        "rollback label",
    ),
    (
        'REMOTE_STAGE="/tmp/wakilisha-gate-d-${UTC_STAMP}-${SHORT_SHA}"',
        f'REMOTE_STAGE="/tmp/wakilisha-{label}-${{UTC_STAMP}}-${{SHORT_SHA}}"',
        "remote stage label",
    ),
]

for old, new, name in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"Template authority mismatch for {name}: expected 1 anchor, found {count}"
        )
    text = text.replace(old, new, 1)

text = text.replace(
    "GATE_D_PRODUCTION_FINISH",
    "PRODUCTION_FRONTEND_FINISH",
)

target.write_text(text)
PY

  /bin/bash -n "$target"
}

if [ "$SELF_TEST" -eq 1 ]; then
  TMP_SELF="$(
    mktemp "${TMPDIR:-/tmp}/wakilisha-production-frontend-self-test.XXXXXX.sh"
  )"
  trap 'rm -f "$TMP_SELF"' EXIT HUP INT TERM

  render_runner \
    "$TMP_SELF" \
    "1111111111111111111111111111111111111111" \
    "self-test" \
    "previewrefpreviewrefab"

  grep -Fq \
    'EXPECTED_MAIN="1111111111111111111111111111111111111111"' \
    "$TMP_SELF"
  grep -Fq 'PREVIEW_REF="previewrefpreviewrefab"' "$TMP_SELF"
  grep -Fq \
    'BACKUP="${BACKUP_ROOT}/self-test-${UTC_STAMP}-${SHORT_SHA}"' \
    "$TMP_SELF"
  grep -Fq \
    'REMOTE_STAGE="/tmp/wakilisha-self-test-${UTC_STAMP}-${SHORT_SHA}"' \
    "$TMP_SELF"

  if grep -Fq "$BASE_EXPECTED_MAIN" "$TMP_SELF"; then
    echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_SELF_TEST_OLD_MAIN_REMAINS'
    exit 1
  fi

  if grep -Fq "$BASE_PREVIEW_REF" "$TMP_SELF"; then
    echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_SELF_TEST_OLD_PREVIEW_REMAINS'
    exit 1
  fi

  if ! grep -Fxq 'npm run build' "$TMP_SELF"; then
    echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_SELF_TEST_FULL_BUILD_MISSING'
    exit 1
  fi

  if grep -Fq 'npm run build:app' "$TMP_SELF"; then
    echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_SELF_TEST_BUILD_APP_REMAINS'
    exit 1
  fi

  echo 'PRODUCTION_FRONTEND_FULL_BUILD_AUTHORITY=PASS'
  echo 'PRODUCTION_FRONTEND_RUNNER_SELF_TEST=PASS'
  exit 0
fi

case "$EXPECTED_MAIN" in
  *[!0-9a-f]*|'')
    echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_EXPECTED_MAIN_FORMAT'
    exit 2
    ;;
esac

test "${#EXPECTED_MAIN}" -eq 40 || {
  echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_EXPECTED_MAIN_LENGTH'
  exit 2
}

case "$DEPLOY_LABEL" in
  ''|*[!a-z0-9-]*|-*|*-)
    echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_LABEL_FORMAT'
    echo 'Use lowercase letters, numbers, and internal hyphens only.'
    exit 2
    ;;
esac

test "${#DEPLOY_LABEL}" -le 48 || {
  echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_LABEL_TOO_LONG'
  exit 2
}

if [ -n "$FORBID_REF" ]; then
  case "$FORBID_REF" in
    *[!a-z]*|'')
      echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_FORBID_REF_FORMAT'
      exit 2
      ;;
  esac
  test "${#FORBID_REF}" -eq 20 || {
    echo 'PRODUCTION_FRONTEND_RUNNER=FAIL_FORBID_REF_LENGTH'
    exit 2
  }
fi

TMP_RUNNER="$(
  mktemp "${TMPDIR:-/tmp}/wakilisha-production-frontend.XXXXXX.sh"
)"
trap 'rm -f "$TMP_RUNNER"' EXIT HUP INT TERM

render_runner \
  "$TMP_RUNNER" \
  "$EXPECTED_MAIN" \
  "$DEPLOY_LABEL" \
  "$FORBID_REF"

printf 'EXPECTED_MAIN=%s\n' "$EXPECTED_MAIN"
printf 'DEPLOY_LABEL=%s\n' "$DEPLOY_LABEL"
if [ -n "$FORBID_REF" ]; then
  printf 'FORBID_REF=%s\n' "$FORBID_REF"
else
  echo 'FORBID_REF=NONE'
fi
echo 'RENDERED_RUNNER_BASH_SYNTAX=PASS'

/bin/bash "$TMP_RUNNER"
