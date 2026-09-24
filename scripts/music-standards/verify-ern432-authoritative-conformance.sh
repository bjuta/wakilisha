#!/bin/bash
set -euo pipefail

XSD_ZIP_URL="https://service.ddex.net/doc/Standards/ERN432/ERN-3305%20-%20ERN%20Part%201%20Definition%20of%20messages%20v4.3.2%20XSD.zip"
RELEASE_PROFILE_SPEC_URL="https://service.ddex.net/doc/Standards/ERN431/ERN-3306%20-%20ERN%20Part%202%20Release%20profiles%20v2.3.1.pdf"
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

# The read-only adapter also preserves the ERN 4.3.2 technical-audio
# evidence needed for future premium-audio product decisions. This proves
# preservation only; it does not classify a WAKILISHA product tier.
python3 - "$ROOT/test/music-standards/fixtures/ern-4.3.2/basic-release.xml" <<'PYTECH'
import sys
import xml.etree.ElementTree as ET

def local(tag):
    return tag.rsplit("}", 1)[-1]

def children(node, name):
    return [child for child in list(node) if local(child.tag) == name]

def first(node, name):
    values = children(node, name)
    return values[0] if values else None

def text(node):
    return (node.text or "").strip() if node is not None else None

root = ET.parse(sys.argv[1]).getroot()
resource_list = first(root, "ResourceList")
assert resource_list is not None

recordings = children(resource_list, "SoundRecording")
recording = next(
    recording
    for recording in recordings
    if text(first(recording, "ResourceReference")) == "A1"
)

editions = children(recording, "SoundRecordingEdition")
assert len(editions) == 2

non_immersive = next(
    edition for edition in editions
    if text(first(edition, "Type")) == "NonImmersiveEdition"
)
immersive = next(
    edition for edition in editions
    if text(first(edition, "Type")) == "ImmersiveEdition"
)

non_technical = children(non_immersive, "TechnicalDetails")
assert len(non_technical) == 1
non_technical = non_technical[0]
assert non_technical.attrib.get("LanguageAndScriptCode") == "en"
assert non_technical.attrib.get("IsDefault") == "true"
assert text(first(non_technical, "ApplicableTerritoryCode")) == "Worldwide"
assert text(first(non_technical, "HasImmersiveAudioMetadata")) == "false"

delivery_files = children(non_technical, "DeliveryFile")
assert len(delivery_files) == 2

expected = [
    ("FLAC", "2304", "kbps", "96000", "Hz", "24",
     "file://fixture-track-hires.flac"),
    ("AAC", "320", "kbps", "48000", "Hz", "24",
     "file://fixture-track.aac"),
]

for delivery, expected_values in zip(delivery_files, expected):
    codec, bit_rate, bit_unit, sample_rate, sample_unit, bits, uri = expected_values
    codec_node = first(delivery, "AudioCodecType")
    bit_rate_node = first(delivery, "BitRate")
    sample_rate_node = first(delivery, "SamplingRate")
    file_node = first(delivery, "File")
    assert text(codec_node) == codec
    assert text(bit_rate_node) == bit_rate
    assert bit_rate_node.attrib.get("UnitOfMeasure") == bit_unit
    assert text(sample_rate_node) == sample_rate
    assert sample_rate_node.attrib.get("UnitOfMeasure") == sample_unit
    assert text(first(delivery, "BitsPerSample")) == bits
    assert text(first(file_node, "URI")) == uri
    assert text(first(delivery, "IsProvidedInDelivery")) == "true"

immersive_technical = children(immersive, "TechnicalDetails")
assert len(immersive_technical) == 1
immersive_technical = immersive_technical[0]
assert immersive_technical.attrib.get("IsDefault") == "true"
assert text(first(immersive_technical, "HasImmersiveAudioMetadata")) == "true"

immersive_delivery = children(immersive_technical, "DeliveryFile")
assert len(immersive_delivery) == 1
immersive_delivery = immersive_delivery[0]
codec_node = first(immersive_delivery, "AudioCodecType")
assert text(codec_node) == "UserDefined"
assert codec_node.attrib.get("Namespace") == "Dolby"
assert codec_node.attrib.get("UserDefinedValue") == "DolbyAtmos"
assert text(first(immersive_delivery, "NumberOfChannels")) == "5.1"
assert text(first(immersive_delivery, "NumberOfAudioObjects")) == "16"
assert text(first(immersive_delivery, "BitsPerSample")) == "24"
assert text(first(first(immersive_delivery, "File"), "URI")) == \
    "file://fixture-track-atmos.m4a"

print("TECHNICAL_AUDIO_VARIANTS=basic-release.xml:PASS")
PYTECH

# Bounded local acceptance rules below are derived from DDEX ERN Release
# Profiles v2.3.1, especially Clauses 6.1, 6.2, 7.2-7.4 and 9.
# This is not a claim of DDEX production-exchange certification.
printf 'ERN432_RELEASE_PROFILE_SPEC=%s
' "$RELEASE_PROFILE_SPEC_URL"

python3 - "$ROOT/test/music-standards/fixtures/ern-4.3.2/multiple-recordings.xml" <<'PYPROFILE'
import sys
import xml.etree.ElementTree as ET

ALLOWED_AUDIO_TYPES = {
    "MusicalWorkSoundRecording",
    "NonMusicalWorkSoundRecording",
}
ALLOWED_RELEASE_ID_TYPES = {
    "GRid",
    "ICPN",
    "ProprietaryId",
}
SEQUENCED_GROUP_TYPES = {
    "Side",
    "Component",
    "ComponentRelease",
    "ReleaseComponent",
    "MultiPartWork",
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

def release_ids(node):
    release_id = first(node, "ReleaseId")
    if release_id is None:
        return []
    values = []
    for child in list(release_id):
        kind = local(child.tag)
        if kind not in ALLOWED_RELEASE_ID_TYPES:
            continue
        namespace = child.attrib.get("Namespace", "")
        value = text(child)
        if value:
            values.append((kind, namespace, value))
    return values

def recording_isrcs(node):
    values = []
    for edition in children(node, "SoundRecordingEdition"):
        for resource_id in children(edition, "ResourceId"):
            value = child_text(resource_id, "ISRC")
            if value:
                values.append(value)
    return values

def image_proprietary_ids(node):
    values = []
    for resource_id in children(node, "ResourceId"):
        for proprietary_id in children(resource_id, "ProprietaryId"):
            value = text(proprietary_id)
            if value:
                values.append(
                    (proprietary_id.attrib.get("Namespace", ""), value)
                )
    return values

def primary_refs(group):
    refs = []
    for item in children(group, "ResourceGroupContentItem"):
        ref = child_text(item, "ReleaseResourceReference")
        if ref:
            refs.append(ref)
    for subgroup in children(group, "ResourceGroup"):
        refs.extend(primary_refs(subgroup))
    return refs

def assert_group_sequence(group):
    item_sequences = [
        child_text(item, "SequenceNumber")
        for item in children(group, "ResourceGroupContentItem")
    ]
    assert all(value for value in item_sequences)
    item_numbers = [int(value) for value in item_sequences]
    assert len(set(item_numbers)) == len(item_numbers)
    assert item_numbers == sorted(item_numbers)

    for subgroup in children(group, "ResourceGroup"):
        group_type = subgroup.attrib.get("ResourceGroupType")
        if group_type in SEQUENCED_GROUP_TYPES:
            assert child_text(subgroup, "SequenceNumber")
        assert_group_sequence(subgroup)

root = ET.parse(sys.argv[1]).getroot()
release_list = first(root, "ReleaseList")
resource_list = first(root, "ResourceList")
assert release_list is not None
assert resource_list is not None

assert root.attrib.get("ReleaseProfileVersionId") == "Audio"
assert root.attrib.get("ReleaseProfileVariantVersionId") is None

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

assert len(releases) == 1
release = releases[0]
assert release_ids(release)

for artist in children(release, "DisplayArtist"):
    assert artist.attrib.get("SequenceNumber")

groups = children(release, "ResourceGroup")
assert groups
for group in groups:
    assert_group_sequence(group)

refs = []
for group in groups:
    refs.extend(primary_refs(group))
assert refs
assert len(refs) == len(set(refs))

for ref in refs:
    recording = recordings[ref]
    assert child_text(recording, "Type") in ALLOWED_AUDIO_TYPES
    assert recording_isrcs(recording)
    assert child_text(recording, "DisplayTitleText")
    display_title = first(recording, "DisplayTitle")
    assert display_title is not None
    assert child_text(display_title, "TitleText")
    for artist in children(recording, "DisplayArtist"):
        assert artist.attrib.get("SequenceNumber")

front_covers = [
    image
    for image in images.values()
    if child_text(image, "Type") == "FrontCoverImage"
]
assert len(front_covers) == 1
front_cover_ref = child_text(front_covers[0], "ResourceReference")
assert image_proprietary_ids(front_covers[0])

top_level_cover_links = []
for group in groups:
    for link in children(group, "LinkedReleaseResourceReference"):
        if text(link) == front_cover_ref:
            top_level_cover_links.append(link)
assert len(top_level_cover_links) == 1
assert "SequenceNumber" not in top_level_cover_links[0].attrib

assert len(track_releases) == len(refs)
assert [
    child_text(node, "ReleaseResourceReference")
    for node in track_releases
] == refs

seen_track_release_ids = set()
for track_release in track_releases:
    ids = release_ids(track_release)
    assert ids
    for identifier in ids:
        assert identifier not in seen_track_release_ids
        seen_track_release_ids.add(identifier)
    assert not children(
        track_release,
        "LinkedReleaseResourceReference",
    )

print("PROFILE_VALIDATE=multiple-recordings.xml:Audio:BOUNDED_PASS")
PYPROFILE

echo "AUTHORITATIVE ERN 4.3.2 XSD + BOUNDED AUDIO PROFILE ACCEPTANCE = PASS"
