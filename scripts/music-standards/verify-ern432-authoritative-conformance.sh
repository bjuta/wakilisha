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

python3 - "$ROOT/test/music-standards/fixtures/ern-4.3.2/basic-release.xml" \
  "$ROOT/test/music-standards/fixtures/ern-4.3.2/multiple-recordings.xml" <<'PYPROFILE'
import sys
import xml.etree.ElementTree as ET

ALLOWED_AUDIO_TYPES = {
    "MusicalWorkSoundRecording",
    "NonMusicalWorkSoundRecording",
}

def local(tag):
    return tag.rsplit("}", 1)[-1]

def children(node, name):
    return [child for child in list(node) if local(child.tag) == name]

def first(node, name):
    values = children(node, name)
    return values[0] if values else None

def text(node):
    return (node.text or "").strip() if node is not None else ""

def child_text(node, name):
    return text(first(node, name))

def primary_refs(group):
    refs = []
    for item in children(group, "ResourceGroupContentItem"):
        ref = child_text(item, "ReleaseResourceReference")
        if ref:
            refs.append(ref)
    for subgroup in children(group, "ResourceGroup"):
        refs.extend(primary_refs(subgroup))
    return refs

def parse(path):
    root = ET.parse(path).getroot()
    release_list = first(root, "ReleaseList")
    resource_list = first(root, "ResourceList")
    releases = children(release_list, "Release")
    track_releases = children(release_list, "TrackRelease")
    recordings = {
        child_text(node, "ResourceReference"): node
        for node in children(resource_list, "SoundRecording")
    }
    images = {
        child_text(node, "ResourceReference"): node
        for node in children(resource_list, "Image")
    }
    return root, releases, track_releases, recordings, images

root, releases, track_releases, recordings, images = parse(sys.argv[1])
assert root.attrib.get("ReleaseProfileVersionId") == "SimpleAudioSingle"
assert root.attrib.get("ReleaseProfileVariantVersionId") is None
assert len(releases) == 1
assert len(track_releases) == 0
groups = children(releases[0], "ResourceGroup")
assert len(groups) == 1
assert len(children(groups[0], "ResourceGroup")) == 0
items = children(groups[0], "ResourceGroupContentItem")
assert len(items) == 1
assert primary_refs(groups[0]) == ["A1"]
assert child_text(recordings["A1"], "Type") in ALLOWED_AUDIO_TYPES
assert [text(node) for node in children(items[0], "LinkedReleaseResourceReference")] == ["A_IMG1"]
assert [text(node) for node in children(groups[0], "LinkedReleaseResourceReference")] == ["A_IMG1"]
assert child_text(images["A_IMG1"], "Type") == "FrontCoverImage"
print("PROFILE_VALIDATE=basic-release.xml:SimpleAudioSingle:PASS")

root, releases, track_releases, recordings, images = parse(sys.argv[2])
assert root.attrib.get("ReleaseProfileVersionId") == "Audio"
assert root.attrib.get("ReleaseProfileVariantVersionId") is None
assert len(releases) == 1
groups = children(releases[0], "ResourceGroup")
assert len(groups) == 1
refs = primary_refs(groups[0])
assert refs == ["A1", "A2"]
assert all(child_text(recordings[ref], "Type") in ALLOWED_AUDIO_TYPES for ref in refs)
assert [text(node) for node in children(groups[0], "LinkedReleaseResourceReference")] == ["A_IMG2"]
assert child_text(images["A_IMG2"], "Type") == "FrontCoverImage"
assert len(track_releases) == 2
assert [child_text(node, "ReleaseResourceReference") for node in track_releases] == refs
assert all(len(children(node, "LinkedReleaseResourceReference")) == 0 for node in track_releases)
print("PROFILE_VALIDATE=multiple-recordings.xml:Audio:PASS")
PYPROFILE

echo "AUTHORITATIVE ERN 4.3.2 XSD + RELEASE PROFILE FIXTURE CONFORMANCE = PASS"
