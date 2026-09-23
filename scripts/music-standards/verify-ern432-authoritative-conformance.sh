#!/bin/bash
set -euo pipefail

XSD_ZIP_URL="https://service.ddex.net/doc/Standards/ERN432/ERN-3305%20-%20ERN%20Part%201%20Definition%20of%20messages%20v4.3.2%20XSD.zip"
EXPECTED_ZIP_SHA256="bbd5012204ea3dbf08025e58768570650d9f65775b0022f5a93770c0dd411938"
EXPECTED_MESSAGE_SHA256="def25b4e72696c9bbc1fed84962acc3a9bae2bc92ef25f8393c99b362aa53a6a"
EXPECTED_AVS_SHA256="87e99fe74f57a640dce0d3247d16b3b52358562c1dbefc4617eb8a9b7360d943"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_BASE="${TMPDIR:-/tmp}"
WORKDIR="$(mktemp -d "${TMP_BASE%/}/wakilisha-ern432-xsd.XXXXXX")"

cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

sha256_file() {
  python3 - "$1" <<'PY'
import hashlib
import sys
from pathlib import Path

print(hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest())
PY
}

command -v curl >/dev/null
command -v unzip >/dev/null
command -v xmllint >/dev/null
command -v python3 >/dev/null

ZIP="$WORKDIR/ern432-xsd.zip"
EXTRACTED="$WORKDIR/extracted"

curl -LfsS \
  --retry 3 \
  --retry-delay 2 \
  --connect-timeout 20 \
  "$XSD_ZIP_URL" \
  -o "$ZIP"

ACTUAL_ZIP_SHA256="$(sha256_file "$ZIP")"
printf 'ERN432_XSD_ZIP_SHA256=%s\n' "$ACTUAL_ZIP_SHA256"
test "$ACTUAL_ZIP_SHA256" = "$EXPECTED_ZIP_SHA256"

mkdir -p "$EXTRACTED"
unzip -q "$ZIP" -d "$EXTRACTED"

MESSAGE_XSD="$EXTRACTED/zip/release-notification.xsd"
AVS_XSD="$EXTRACTED/zip/allowed-value-sets.xsd"

test -f "$MESSAGE_XSD"
test -f "$AVS_XSD"

ACTUAL_MESSAGE_SHA256="$(sha256_file "$MESSAGE_XSD")"
ACTUAL_AVS_SHA256="$(sha256_file "$AVS_XSD")"

printf 'ERN432_MESSAGE_XSD_SHA256=%s\n' "$ACTUAL_MESSAGE_SHA256"
printf 'ERN432_AVS_XSD_SHA256=%s\n' "$ACTUAL_AVS_SHA256"

test "$ACTUAL_MESSAGE_SHA256" = "$EXPECTED_MESSAGE_SHA256"
test "$ACTUAL_AVS_SHA256" = "$EXPECTED_AVS_SHA256"

for fixture in \
  basic-release.xml \
  multiple-recordings.xml \
  unsupported-deal.xml
do
  FILE="$ROOT/test/music-standards/fixtures/ern-4.3.2/$fixture"
  printf 'VALIDATE=%s\n' "$fixture"
  XML_CATALOG_FILES="" xmllint \
    --nonet \
    --noout \
    --schema "$MESSAGE_XSD" \
    "$FILE"
done

echo "AUTHORITATIVE ERN 4.3.2 XSD FIXTURE CONFORMANCE = PASS"
