#!/usr/bin/env python3
"""Local-only official MusicBrainz core archive qualification.

Verify the pinned publisher fingerprint and signed checksum list, consume
the exact compressed bytes, extract only required regular members into a
private fresh directory, and derive the snapshot from signed archive
metadata. No network, database connection, credential, or shell expansion.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

PUBLISHER = "D5E63B4BDCCE195642948684B8FC2375C777580F"
TABLES = ("isrc", "artist_credit", "recording")
CHUNK = 1024 * 1024
MAX_ARCHIVE = 20 * 1024**3
MAX_EXPANDED = 200 * 1024**3
MAX_SELECTED = 24 * 1024**3


def fail(code):
    raise ValueError("MIZIZI_CORE_ARCHIVE_" + code)


def bounded_file(path, maximum):
    with open(path, "rb") as source:
        data = source.read(maximum + 1)
    if not data or len(data) > maximum:
        fail("METADATA_BOUND")
    return data


def signed_checksum(directory, keyring, scratch, fingerprint):
    checksums = bounded_file(directory / "SHA256SUMS", 131072)
    signature = bounded_file(directory / "SHA256SUMS.asc", 65536)
    (scratch / "checksums").write_bytes(checksums)
    (scratch / "signature").write_bytes(signature)
    # Verify the exact private copies subsequently parsed. A short key ID,
    # GOODSIG text, or an exit code without the pinned primary fingerprint
    # cannot establish publisher provenance.
    verification = subprocess.run(
        ["gpgv", "--status-fd", "1", "--keyring", str(keyring),
         str(scratch / "signature"), str(scratch / "checksums")],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=30,
        check=False, env={**os.environ, "LC_ALL": "C"},
    )
    lines = verification.stdout.decode("ascii", errors="strict").splitlines()
    valid = [line.split() for line in lines if line.startswith("[GNUPG:] VALIDSIG ")]
    if verification.returncode or len(valid) != 1 or (
        valid[0][2] != fingerprint and valid[0][-1] != fingerprint
    ) or any(line.startswith(("[GNUPG:] BADSIG ", "[GNUPG:] ERRSIG ",
                              "[GNUPG:] EXPKEYSIG ", "[GNUPG:] REVKEYSIG ",
                              "[GNUPG:] EXPSIG ")) for line in lines):
        fail("PUBLISHER_SIGNATURE_DENIED")
    matches = []
    for line in checksums.decode("ascii", errors="strict").splitlines():
        match = re.fullmatch(r"([a-fA-F0-9]{64}) [ *]mbdump\.tar\.bz2", line)
        if match:
            matches.append(match.group(1).lower())
    if len(matches) != 1:
        fail("SIGNED_CORE_CHECKSUM_MISSING")
    return matches[0], hashlib.sha256(checksums).hexdigest(), hashlib.sha256(signature).hexdigest()


class HashReader:
    def __init__(self, raw):
        self.raw = raw
        self.sha = hashlib.sha256()
        self.length = 0

    def read(self, size):
        if size < 0 or size > 16 * CHUNK:
            fail("COMPRESSED_READ_BOUND")
        data = self.raw.read(size)
        self.length += len(data)
        if self.length > MAX_ARCHIVE:
            fail("COMPRESSED_BOUND")
        self.sha.update(data)
        return data


def qualify(directory, keyring, output, max_extract_bytes, *, expected_fingerprint=PUBLISHER):
    directory, keyring, output = Path(directory).resolve(), Path(keyring).resolve(), Path(output).absolute()
    if not directory.is_dir() or not keyring.is_file() or output.exists() or output.is_symlink():
        fail("PATH_DENIED")
    if not isinstance(max_extract_bytes, int) or not 1 <= max_extract_bytes <= MAX_SELECTED:
        fail("CAPACITY_BOUND")
    if not output.parent.is_dir() or shutil.disk_usage(output.parent).free < max_extract_bytes + 64 * CHUNK:
        fail("CAPACITY_UNAVAILABLE")
    archive = directory / "mbdump.tar.bz2"
    if not archive.is_file() or not 1 <= archive.stat().st_size <= MAX_ARCHIVE:
        fail("COMPRESSED_BOUND")
    scratch = Path(tempfile.mkdtemp(prefix=".mizizi-core-", dir=output.parent))
    os.chmod(scratch, 0o700)
    selected = {}
    metadata = {}
    expanded = 0
    retained = 0
    try:
        expected, checksum_hash, signature_hash = signed_checksum(directory, keyring, scratch, expected_fingerprint)
        with open(archive, "rb") as raw:
            stream = HashReader(raw)
            # Streaming tar parsing never extracts a path supplied by the
            # archive. Only exact members are copied into private files.
            with tarfile.open(fileobj=stream, mode="r|bz2", bufsize=CHUNK) as bundle:
                count = 0
                for member in bundle:
                    count += 1
                    expanded += member.size
                    if count > 10000 or member.size < 0 or expanded > MAX_EXPANDED:
                        fail("EXPANDED_BOUND")
                    name = member.name.removeprefix("./")
                    table = name[7:] if name.startswith("mbdump/") else None
                    wanted = table in TABLES or name in ("TIMESTAMP", "SCHEMA_SEQUENCE")
                    if not wanted:
                        continue
                    if not member.isfile() or member.size < 1:
                        fail("MEMBER_DENIED")
                    data = bundle.extractfile(member)
                    if data is None:
                        fail("MEMBER_DENIED")
                    if table in TABLES:
                        if table in selected or retained + member.size > max_extract_bytes:
                            fail("SELECTED_BOUND")
                        digest = hashlib.sha256()
                        remaining = member.size
                        with open(scratch / table, "xb") as destination:
                            while remaining:
                                block = data.read(min(CHUNK, remaining))
                                if not block:
                                    fail("MEMBER_TRUNCATED")
                                destination.write(block)
                                digest.update(block)
                                remaining -= len(block)
                        os.chmod(scratch / table, 0o600)
                        selected[table] = digest.hexdigest()
                        retained += member.size
                    else:
                        if name in metadata or member.size > 256:
                            fail("METADATA_BOUND")
                        value = data.read(member.size)
                        if len(value) != member.size:
                            fail("MEMBER_TRUNCATED")
                        metadata[name] = value.decode("ascii", errors="strict").strip()
            # tar may stop after its end marker before the compressed file
            # ends; include all remaining original bytes in the signed hash.
            while stream.read(CHUNK):
                pass
            if stream.sha.hexdigest() != expected:
                fail("SIGNED_ARCHIVE_DIGEST_MISMATCH")
        if set(selected) != set(TABLES) or set(metadata) != {"TIMESTAMP", "SCHEMA_SEQUENCE"}:
            fail("MEMBER_MISSING")
        stamp = datetime.datetime.fromisoformat(metadata["TIMESTAMP"])
        if stamp.tzinfo is None:
            fail("SNAPSHOT_TIMESTAMP_DENIED")
        snapshot = stamp.astimezone(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
        if not re.fullmatch(r"[1-9][0-9]{0,5}", metadata["SCHEMA_SEQUENCE"]):
            fail("SCHEMA_SEQUENCE_DENIED")
        manifest = {"dataset": "musicbrainz-core-cc0", "snapshot": snapshot,
                    "archiveSha256": expected, "tables": {k: selected[k] for k in TABLES}}
        receipt = {"contract": "mizizi.musicbrainz_core_archive_qualification.v1",
                   "manifest": manifest, "publisherFingerprint": expected_fingerprint,
                   "signedChecksumsSha256": checksum_hash, "signatureSha256": signature_hash,
                   "schemaSequence": int(metadata["SCHEMA_SEQUENCE"]), "selectedBytes": retained,
                   "compressedBytes": stream.length, "archiveSignatureVerified": True,
                   "candidateOnly": True, "identityVerified": False, "custodyAuthorized": False,
                   "modelDisclosureAuthorized": False, "canonicalWriteAuthorized": False}
        (scratch / "checksums").unlink()
        (scratch / "signature").unlink()
        (scratch / "qualification.json").write_text(json.dumps(receipt, separators=(",", ":")) + "\n", encoding="utf-8")
        os.chmod(scratch / "qualification.json", 0o600)
        # Fresh private destination only. No overwrite, no partial success.
        if output.exists() or output.is_symlink():
            fail("OUTPUT_EXISTS")
        os.rename(scratch, output)
        return receipt
    finally:
        if scratch.exists():
            shutil.rmtree(scratch)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-directory", required=True)
    parser.add_argument("--keyring", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--max-extract-bytes", type=int, required=True)
    args = parser.parse_args()
    try:
        result = qualify(args.archive_directory, args.keyring, args.output, args.max_extract_bytes)
        print(json.dumps(result, separators=(",", ":")))
    except Exception as exc:
        message = str(exc)
        print(message if re.fullmatch(r"MIZIZI_CORE_ARCHIVE_[A-Z0-9_]+", message)
              else "MIZIZI_CORE_ARCHIVE_IO_UNCONFIRMED", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
