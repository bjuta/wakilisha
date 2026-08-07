#!/usr/bin/env python3

import argparse
import hashlib
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

MEDIA_ROOT = Path(
    os.environ.get(
        "MEDIA_ROOT",
        "/opt/wakilisha-media",
    )
).resolve()

SESSION_ROOT = Path(
    os.environ.get(
        "MEDIA_UPLOAD_SESSION_ROOT",
        "/opt/wakilisha-media-upload-sessions",
    )
).resolve()

PROCESSING_ROOT = Path(
    os.environ.get(
        "MEDIA_PROCESSING_ROOT",
        "/opt/wakilisha-media-processing",
    )
).resolve()

PUBLIC_ORIGIN = "https://media.wakilisha.africa"

TERMINAL_SESSION_STATES = {
    "verified",
    "failed",
    "cancelled",
    "expired",
}

TERMINAL_JOB_STATES = {
    "succeeded",
    "dead_letter",
    "cancelled",
}

PROTECTED_PERSISTENT_ROOTS = (
    "masters",
    "derived-objects",
    "private-files",
)


class MaintenanceFailure(RuntimeError):
    pass


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply safe ephemeral/orphan cleanup.",
    )
    parser.add_argument(
        "--verify-checksums",
        action="store_true",
        help="Hash canonical protected files in addition to byte-size checks.",
    )
    parser.add_argument(
        "--terminal-session-retention-seconds",
        type=int,
        default=int(
            os.environ.get(
                "MEDIA_TERMINAL_SESSION_RETENTION_SECONDS",
                "86400",
            )
        ),
    )
    parser.add_argument(
        "--terminal-processing-retention-seconds",
        type=int,
        default=int(
            os.environ.get(
                "MEDIA_TERMINAL_PROCESSING_RETENTION_SECONDS",
                "3600",
            )
        ),
    )
    parser.add_argument(
        "--unknown-ephemeral-retention-seconds",
        type=int,
        default=int(
            os.environ.get(
                "MEDIA_UNKNOWN_EPHEMERAL_RETENTION_SECONDS",
                "86400",
            )
        ),
    )
    parser.add_argument(
        "--orphan-file-retention-seconds",
        type=int,
        default=int(
            os.environ.get(
                "MEDIA_ORPHAN_FILE_RETENTION_SECONDS",
                "86400",
            )
        ),
    )
    return parser.parse_args()


def require_runtime():
    if not SUPABASE_URL or not SERVICE_KEY:
        raise MaintenanceFailure(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
        )

    for path in (
        MEDIA_ROOT,
        SESSION_ROOT,
        PROCESSING_ROOT,
    ):
        path.mkdir(
            parents=True,
            exist_ok=True,
        )


def rpc(name, payload=None):
    body = json.dumps(
        payload or {},
        separators=(",", ":"),
    ).encode("utf-8")

    request = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/{name}",
        method="POST",
        data=body,
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=120,
        ) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(
            "utf-8",
            errors="replace",
        )
        raise MaintenanceFailure(
            f"RPC {name} HTTP {exc.code}: {detail}"
        ) from exc

    if not raw:
        return None

    return json.loads(
        raw.decode("utf-8")
    )


def parse_timestamp(value):
    text = str(value or "").strip()

    if not text:
        return None

    if text.endswith("Z"):
        text = text[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(
            tzinfo=timezone.utc
        )

    return parsed.astimezone(
        timezone.utc
    ).timestamp()


def entry_age_seconds(path):
    try:
        return max(
            0.0,
            time.time()
            - path.stat().st_mtime,
        )
    except FileNotFoundError:
        return 0.0


def safe_media_path(storage_path):
    value = str(storage_path or "").strip()

    if not value:
        raise MaintenanceFailure(
            "Canonical Media storage path is missing."
        )

    relative = Path(value)

    if (
        relative.is_absolute()
        or ".." in relative.parts
    ):
        raise MaintenanceFailure(
            f"Unsafe Media storage path: {value}"
        )

    target = (
        MEDIA_ROOT
        / relative
    ).resolve()

    try:
        target.relative_to(MEDIA_ROOT)
    except ValueError as exc:
        raise MaintenanceFailure(
            f"Media storage path escaped root: {value}"
        ) from exc

    return target


def sha256_file(path):
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        while True:
            chunk = handle.read(
                1024 * 1024
            )
            if not chunk:
                break
            digest.update(chunk)

    return digest.hexdigest()


def remove_path(path, applied):
    if not applied:
        return False

    if path.is_symlink() or path.is_file():
        path.unlink(
            missing_ok=True
        )
        return True

    if path.is_dir():
        shutil.rmtree(
            path
        )
        return True

    return False


def url_path(value):
    parsed = urllib.parse.urlparse(
        str(value or "")
    )

    if (
        parsed.scheme != "https"
        or parsed.netloc != "media.wakilisha.africa"
    ):
        return None

    return urllib.parse.unquote(
        parsed.path
    ).lstrip("/")


def check_file_objects(
    manifest,
    *,
    verify_checksums,
):
    missing = []
    size_mismatch = []
    checksum_mismatch = []
    canonical_paths = set()
    protected_canonical_paths = set()
    virtual_paths = set()

    for item in manifest.get(
        "file_objects",
        [],
    ):
        if (
            item.get("storage_provider")
            != "lightsail_media"
            or item.get("verification_state")
            != "verified"
        ):
            continue

        storage_path = str(
            item.get("storage_path")
            or ""
        )

        canonical_paths.add(
            storage_path
        )

        if storage_path.startswith(
            "__image/"
        ):
            virtual_paths.add(
                storage_path
            )
            continue

        target = safe_media_path(
            storage_path
        )

        if not target.is_file():
            missing.append(
                storage_path
            )
            continue

        expected_size = item.get(
            "byte_size"
        )

        if (
            expected_size is not None
            and target.stat().st_size
            != int(expected_size)
        ):
            size_mismatch.append(
                storage_path
            )
            continue

        if (
            verify_checksums
            and item.get("sha256")
            and sha256_file(target)
            != item["sha256"]
        ):
            checksum_mismatch.append(
                storage_path
            )

        if storage_path.startswith(
            (
                "masters/",
                "derived-objects/",
                "private-files/",
            )
        ):
            protected_canonical_paths.add(
                storage_path
            )

    return {
        "canonical_paths":
            canonical_paths,
        "protected_canonical_paths":
            protected_canonical_paths,
        "virtual_paths":
            virtual_paths,
        "missing":
            missing,
        "size_mismatch":
            size_mismatch,
        "checksum_mismatch":
            checksum_mismatch,
    }


def check_selected_derivatives(manifest):
    expected_public_paths = {}
    missing = []
    wrong_target = []
    invalid_delivery = []

    for item in manifest.get(
        "selected_derivatives",
        [],
    ):
        delivery_path = url_path(
            item.get("delivery_url")
        )

        storage_path = str(
            item.get("storage_path")
            or ""
        )

        if not delivery_path:
            continue

        if not delivery_path.startswith(
            "derivatives/"
        ):
            continue

        expected_public_paths[
            delivery_path
        ] = storage_path

        public_path = safe_media_path(
            delivery_path
        )
        canonical_path = safe_media_path(
            storage_path
        )

        if not (
            public_path.is_file()
            or public_path.is_symlink()
        ):
            missing.append(
                delivery_path
            )
            continue

        try:
            if (
                public_path.resolve()
                != canonical_path.resolve()
            ):
                wrong_target.append(
                    delivery_path
                )
        except FileNotFoundError:
            wrong_target.append(
                delivery_path
            )

        if not storage_path.startswith(
            "derived-objects/"
        ):
            invalid_delivery.append(
                delivery_path
            )

    return {
        "expected_public_paths":
            expected_public_paths,
        "missing":
            missing,
        "wrong_target":
            wrong_target,
        "invalid_delivery":
            invalid_delivery,
    }


def cleanup_terminal_sessions(
    manifest,
    *,
    applied,
    retention_seconds,
    unknown_retention_seconds,
):
    session_by_id = {
        str(item.get("id")):
            item
        for item
        in manifest.get(
            "upload_sessions",
            [],
        )
        if item.get("id")
    }

    candidates = []
    removed = []
    active_preserved = []

    if not SESSION_ROOT.is_dir():
        return {
            "candidates": candidates,
            "removed": removed,
            "active_preserved":
                active_preserved,
        }

    for entry in sorted(
        SESSION_ROOT.iterdir()
    ):
        if not entry.is_dir():
            continue

        session = session_by_id.get(
            entry.name
        )

        if session:
            state = str(
                session.get("state")
                or ""
            )

            if state not in TERMINAL_SESSION_STATES:
                active_preserved.append(
                    entry.name
                )
                continue

            updated_at = parse_timestamp(
                session.get("updated_at")
            )

            age = (
                time.time() - updated_at
                if updated_at is not None
                else entry_age_seconds(entry)
            )

            if age < retention_seconds:
                continue

            candidates.append(
                {
                    "session_id":
                        entry.name,
                    "state":
                        state,
                    "reason":
                        "terminal_session_retention",
                }
            )

            if remove_path(
                entry,
                applied,
            ):
                removed.append(
                    entry.name
                )

            continue

        if (
            entry_age_seconds(entry)
            >= unknown_retention_seconds
        ):
            candidates.append(
                {
                    "session_id":
                        entry.name,
                    "state":
                        "unknown",
                    "reason":
                        "unknown_ephemeral_retention",
                }
            )

            if remove_path(
                entry,
                applied,
            ):
                removed.append(
                    entry.name
                )

    return {
        "candidates": candidates,
        "removed": removed,
        "active_preserved":
            active_preserved,
    }


def cleanup_processing_staging(
    manifest,
    *,
    applied,
    terminal_retention_seconds,
    unknown_retention_seconds,
):
    job_by_id = {
        str(item.get("id")):
            item
        for item
        in manifest.get(
            "processing_jobs",
            [],
        )
        if item.get("id")
    }

    candidates = []
    removed = []
    active_preserved = []

    if not PROCESSING_ROOT.is_dir():
        return {
            "candidates": candidates,
            "removed": removed,
            "active_preserved":
                active_preserved,
        }

    for entry in sorted(
        PROCESSING_ROOT.iterdir()
    ):
        if not entry.is_dir():
            continue

        job = job_by_id.get(
            entry.name
        )

        if job:
            status = str(
                job.get("status")
                or ""
            )

            if status not in TERMINAL_JOB_STATES:
                active_preserved.append(
                    entry.name
                )
                continue

            finished_at = parse_timestamp(
                job.get("finished_at")
            )

            age = (
                time.time() - finished_at
                if finished_at is not None
                else entry_age_seconds(entry)
            )

            if age < terminal_retention_seconds:
                continue

            candidates.append(
                {
                    "job_id":
                        entry.name,
                    "status":
                        status,
                    "reason":
                        "terminal_processing_retention",
                }
            )

            if remove_path(
                entry,
                applied,
            ):
                removed.append(
                    entry.name
                )

            continue

        if (
            entry_age_seconds(entry)
            >= unknown_retention_seconds
        ):
            candidates.append(
                {
                    "job_id":
                        entry.name,
                    "status":
                        "unknown",
                    "reason":
                        "unknown_ephemeral_retention",
                }
            )

            if remove_path(
                entry,
                applied,
            ):
                removed.append(
                    entry.name
                )

    return {
        "candidates": candidates,
        "removed": removed,
        "active_preserved":
            active_preserved,
    }


def cleanup_protected_orphans(
    canonical_paths,
    *,
    applied,
    retention_seconds,
):
    candidates = []
    removed = []

    for root_name in PROTECTED_PERSISTENT_ROOTS:
        root = (
            MEDIA_ROOT
            / root_name
        )

        if not root.is_dir():
            continue

        for path in root.rglob("*"):
            if (
                not path.is_file()
                or path.is_symlink()
            ):
                continue

            relative = path.relative_to(
                MEDIA_ROOT
            ).as_posix()

            if relative in canonical_paths:
                continue

            if (
                entry_age_seconds(path)
                < retention_seconds
            ):
                continue

            candidates.append(
                relative
            )

            if remove_path(
                path,
                applied,
            ):
                removed.append(
                    relative
                )

    return {
        "candidates": candidates,
        "removed": removed,
    }


def cleanup_public_derivative_orphans(
    expected_public_paths,
    *,
    applied,
    retention_seconds,
):
    root = (
        MEDIA_ROOT
        / "derivatives"
    )

    candidates = []
    removed = []

    if not root.is_dir():
        return {
            "candidates": candidates,
            "removed": removed,
        }

    for path in root.rglob("*"):
        if not (
            path.is_symlink()
            or path.is_file()
        ):
            continue

        relative = path.relative_to(
            MEDIA_ROOT
        ).as_posix()

        if relative in expected_public_paths:
            continue

        if (
            entry_age_seconds(path)
            < retention_seconds
        ):
            continue

        candidates.append(
            relative
        )

        if remove_path(
            path,
            applied,
        ):
            removed.append(
                relative
            )

    return {
        "candidates": candidates,
        "removed": removed,
    }


def main():
    args = parse_args()
    require_runtime()

    manifest = rpc(
        "read_media_maintenance_manifest_v1"
    )

    if not isinstance(
        manifest,
        dict,
    ):
        raise MaintenanceFailure(
            "Maintenance manifest is invalid."
        )

    file_check = check_file_objects(
        manifest,
        verify_checksums=
            args.verify_checksums,
    )

    derivative_check = (
        check_selected_derivatives(
            manifest
        )
    )

    session_cleanup = (
        cleanup_terminal_sessions(
            manifest,
            applied=args.apply,
            retention_seconds=
                args.terminal_session_retention_seconds,
            unknown_retention_seconds=
                args.unknown_ephemeral_retention_seconds,
        )
    )

    processing_cleanup = (
        cleanup_processing_staging(
            manifest,
            applied=args.apply,
            terminal_retention_seconds=
                args.terminal_processing_retention_seconds,
            unknown_retention_seconds=
                args.unknown_ephemeral_retention_seconds,
        )
    )

    protected_orphans = (
        cleanup_protected_orphans(
            file_check[
                "protected_canonical_paths"
            ],
            applied=args.apply,
            retention_seconds=
                args.orphan_file_retention_seconds,
        )
    )

    public_orphans = (
        cleanup_public_derivative_orphans(
            derivative_check[
                "expected_public_paths"
            ],
            applied=args.apply,
            retention_seconds=
                args.orphan_file_retention_seconds,
        )
    )

    fatal = bool(
        file_check["missing"]
        or file_check["size_mismatch"]
        or file_check["checksum_mismatch"]
        or derivative_check["missing"]
        or derivative_check["wrong_target"]
        or derivative_check["invalid_delivery"]
    )

    result = {
        "verification":
            "FAIL" if fatal else "PASS",
        "apply":
            args.apply,
        "verify_checksums":
            args.verify_checksums,
        "file_objects": {
            "canonical_count":
                len(
                    file_check[
                        "canonical_paths"
                    ]
                ),
            "protected_count":
                len(
                    file_check[
                        "protected_canonical_paths"
                    ]
                ),
            "virtual_count":
                len(
                    file_check[
                        "virtual_paths"
                    ]
                ),
            "missing":
                file_check["missing"],
            "size_mismatch":
                file_check[
                    "size_mismatch"
                ],
            "checksum_mismatch":
                file_check[
                    "checksum_mismatch"
                ],
        },
        "selected_derivatives": {
            "expected_public_count":
                len(
                    derivative_check[
                        "expected_public_paths"
                    ]
                ),
            "missing":
                derivative_check[
                    "missing"
                ],
            "wrong_target":
                derivative_check[
                    "wrong_target"
                ],
            "invalid_delivery":
                derivative_check[
                    "invalid_delivery"
                ],
        },
        "terminal_sessions":
            session_cleanup,
        "processing_staging":
            processing_cleanup,
        "protected_orphans":
            protected_orphans,
        "public_derivative_orphans":
            public_orphans,
    }

    print(
        json.dumps(
            result,
            indent=2,
            sort_keys=True,
        )
    )

    if fatal:
        raise SystemExit(2)


if __name__ == "__main__":
    try:
        main()
    except MaintenanceFailure as exc:
        print(
            json.dumps(
                {
                    "verification":
                        "FAIL",
                    "error":
                        str(exc),
                },
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        raise SystemExit(2)
