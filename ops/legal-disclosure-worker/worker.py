#!/usr/bin/env python3

import datetime as dt
import hashlib
import json
import os
import shutil
import socket
import time
import urllib.error
import urllib.request
import uuid
import zipfile
from pathlib import Path, PurePosixPath


class TerminalDisclosureError(RuntimeError):
    pass


class RetryableDisclosureError(RuntimeError):
    pass


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MEDIA_ROOT = Path(
    os.environ.get("MEDIA_ROOT", "/opt/wakilisha-media")
).resolve()
PROCESSING_ROOT = Path(
    os.environ.get(
        "LEGAL_DISCLOSURE_PROCESSING_ROOT",
        "/opt/wakilisha-legal-disclosure-processing",
    )
).resolve()
POLL_SECONDS = max(
    2,
    int(os.environ.get("LEGAL_DISCLOSURE_POLL_SECONDS", "5")),
)
LEASE_SECONDS = min(
    3600,
    max(
        60,
        int(os.environ.get("LEGAL_DISCLOSURE_LEASE_SECONDS", "900")),
    ),
)
HEARTBEAT_SECONDS = min(
    300,
    max(
        10,
        int(os.environ.get("LEGAL_DISCLOSURE_HEARTBEAT_SECONDS", "30")),
    ),
)
WORKER_ID = os.environ.get(
    "LEGAL_DISCLOSURE_WORKER_ID",
    f"legal-disclosure:{socket.gethostname()}",
)
CHUNK_BYTES = 1024 * 1024
ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)
ALLOWED_MEDIA_SOURCE_PREFIXES = (
    "masters/audio/",
    "masters/video/",
    "derived-objects/",
    "private-files/transcripts/",
    "private-files/captions/",
)
LEGAL_PACKAGE_PREFIX = "derived-objects/legal-disclosures/"


ACTIVE_JOB_ID = None
LAST_HEARTBEAT = 0.0
LAST_RECOVERY = 0.0


def log(message, **fields):
    payload = {
        "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "message": message,
        **fields,
    }
    print(
        json.dumps(payload, separators=(",", ":"), sort_keys=True),
        flush=True,
    )


def require_runtime():
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
        )
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    PROCESSING_ROOT.mkdir(parents=True, exist_ok=True)


def rpc(name, payload):
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
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
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        if exc.code >= 500:
            raise RetryableDisclosureError(
                f"RPC {name} HTTP {exc.code}: {raw}"
            ) from exc
        raise TerminalDisclosureError(
            f"RPC {name} HTTP {exc.code}: {raw}"
        ) from exc
    except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
        raise RetryableDisclosureError(
            f"RPC {name} transport failure: {exc}"
        ) from exc
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise RetryableDisclosureError(
            f"RPC {name} returned invalid JSON."
        ) from exc


def expect_object(value, label):
    if not isinstance(value, dict):
        raise TerminalDisclosureError(f"{label} is not an object.")
    return value


def expect_list(value, label):
    if not isinstance(value, list):
        raise TerminalDisclosureError(f"{label} is not a list.")
    return value


def normalize_uuid(value, label):
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise TerminalDisclosureError(f"{label} is not a UUID.") from exc


def normalize_sha256(value, label):
    text = str(value or "").lower()
    if len(text) != 64 or any(ch not in "0123456789abcdef" for ch in text):
        raise TerminalDisclosureError(f"{label} is not a SHA-256 value.")
    return text


def normalize_int(value, label, minimum=0):
    if isinstance(value, bool):
        raise TerminalDisclosureError(f"{label} is not an integer.")
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise TerminalDisclosureError(f"{label} is not an integer.") from exc
    if str(number) != str(value) and not isinstance(value, int):
        try:
            if float(value) != number:
                raise ValueError
        except (TypeError, ValueError):
            raise TerminalDisclosureError(f"{label} is not an integer.")
    if number < minimum:
        raise TerminalDisclosureError(f"{label} is below its minimum.")
    return number


def normalize_timestamp(value, label):
    if not isinstance(value, str) or not value:
        raise TerminalDisclosureError(f"{label} is missing.")
    text = value
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = dt.datetime.fromisoformat(text)
    except ValueError as exc:
        raise TerminalDisclosureError(f"{label} is not an ISO timestamp.") from exc
    if parsed.tzinfo is None:
        raise TerminalDisclosureError(f"{label} lacks timezone authority.")
    parsed = parsed.astimezone(dt.timezone.utc)
    if parsed.microsecond:
        return parsed.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    return parsed.strftime("%Y-%m-%dT%H:%M:%SZ")


def reject_floats(value, path="$"):
    if isinstance(value, float):
        raise TerminalDisclosureError(
            f"Canonical Legal JSON does not permit floats at {path}."
        )
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise TerminalDisclosureError(
                    f"Canonical Legal JSON key is not text at {path}."
                )
            reject_floats(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            reject_floats(item, f"{path}[{index}]")


def canonical_json_bytes(value):
    reject_floats(value)
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
        allow_nan=False,
    ).encode("utf-8")


def sha256_bytes(value):
    return hashlib.sha256(value).hexdigest()


def sha256_file(path):
    digest = hashlib.sha256()
    byte_size = 0
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(CHUNK_BYTES)
            if not chunk:
                break
            digest.update(chunk)
            byte_size += len(chunk)
    return digest.hexdigest(), byte_size


def safe_relative_path(value, *, legal_target=False):
    if not isinstance(value, str) or not value:
        raise TerminalDisclosureError("Storage path is missing.")
    pure = PurePosixPath(value)
    if pure.is_absolute() or ".." in pure.parts or "." in pure.parts:
        raise TerminalDisclosureError(f"Unsafe storage path: {value}")
    normalized = pure.as_posix()
    prefixes = (
        (LEGAL_PACKAGE_PREFIX,)
        if legal_target
        else ALLOWED_MEDIA_SOURCE_PREFIXES
    )
    if not any(normalized.startswith(prefix) for prefix in prefixes):
        raise TerminalDisclosureError(
            f"Storage path is outside the accepted protected boundary: {value}"
        )
    return Path(*pure.parts)


def media_path(relative):
    path = (MEDIA_ROOT / relative).resolve()
    try:
        path.relative_to(MEDIA_ROOT)
    except ValueError as exc:
        raise TerminalDisclosureError("Media path escaped Media root.") from exc
    return path


def renew_active_lease(force=False):
    global LAST_HEARTBEAT
    if ACTIVE_JOB_ID is None:
        return
    now = time.monotonic()
    if not force and now - LAST_HEARTBEAT < HEARTBEAT_SECONDS:
        return
    rpc(
        "renew_messages_legal_disclosure_lease_v1",
        {
            "p_job_id": ACTIVE_JOB_ID,
            "p_worker_id": WORKER_ID,
            "p_lease_seconds": LEASE_SECONDS,
        },
    )
    LAST_HEARTBEAT = now


def recover_expired_jobs(force=False):
    global LAST_RECOVERY
    now = time.monotonic()
    if not force and now - LAST_RECOVERY < max(60, POLL_SECONDS * 6):
        return
    result = rpc(
        "recover_expired_messages_legal_disclosure_jobs_v1",
        {
            "p_limit": 20,
            "p_retry_delay_seconds": 60,
        },
    )
    LAST_RECOVERY = now
    if isinstance(result, dict) and result.get("recovered_jobs"):
        log(
            "Recovered expired Legal disclosure leases.",
            recovered_jobs=result.get("recovered_jobs"),
        )


def staging_directory(job_id):
    job_uuid = normalize_uuid(job_id, "job_id")
    directory = (PROCESSING_ROOT / job_uuid).resolve()
    try:
        directory.relative_to(PROCESSING_ROOT)
    except ValueError as exc:
        raise TerminalDisclosureError(
            "Legal disclosure staging path escaped processing root."
        ) from exc
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def clean_staging(directory):
    if directory.exists():
        shutil.rmtree(directory)


def zip_info(name):
    pure = PurePosixPath(name)
    if pure.is_absolute() or ".." in pure.parts or "." in pure.parts:
        raise TerminalDisclosureError(f"Unsafe archive path: {name}")
    info = zipfile.ZipInfo(pure.as_posix(), date_time=ZIP_EPOCH)
    info.compress_type = zipfile.ZIP_STORED
    info.create_system = 3
    info.external_attr = (0o100640 << 16)
    info.extra = b""
    info.comment = b""
    return info


def write_bytes_entry(archive, name, data):
    info = zip_info(name)
    archive.writestr(info, data)
    return sha256_bytes(data), len(data)


def media_source(descriptor):
    if descriptor.get("storage_provider") != "lightsail_media":
        raise TerminalDisclosureError(
            "Candidate C v1 produces Media bytes only from protected Lightsail Media."
        )
    if descriptor.get("verification_state") != "verified":
        raise TerminalDisclosureError(
            "Legal Media source is not verified canonical Media."
        )
    expected_sha = normalize_sha256(
        descriptor.get("sha256"),
        "Media source sha256",
    )
    expected_size = normalize_int(
        descriptor.get("byte_size"),
        "Media source byte_size",
    )
    relative = safe_relative_path(descriptor.get("storage_path"))
    path = media_path(relative)
    if not path.is_file():
        raise TerminalDisclosureError(
            "Verified Legal Media source is missing from protected storage."
        )
    actual_sha, actual_size = sha256_file(path)
    if actual_sha != expected_sha or actual_size != expected_size:
        raise TerminalDisclosureError(
            "Protected Legal Media source checksum or byte size changed."
        )
    return path, expected_sha, expected_size


def write_media_entry(archive, name, source, expected_sha, expected_size):
    info = zip_info(name)
    digest = hashlib.sha256()
    byte_size = 0
    with source.open("rb") as input_handle:
        with archive.open(info, "w", force_zip64=True) as output_handle:
            while True:
                chunk = input_handle.read(CHUNK_BYTES)
                if not chunk:
                    break
                output_handle.write(chunk)
                digest.update(chunk)
                byte_size += len(chunk)
                renew_active_lease()
    actual_sha = digest.hexdigest()
    if actual_sha != expected_sha or byte_size != expected_size:
        raise TerminalDisclosureError(
            "Legal Media bytes changed while the package was being written."
        )
    return actual_sha, byte_size


def canonical_representation(descriptor, object_kind):
    representation = expect_object(
        descriptor.get("representation"),
        f"{object_kind} representation",
    )
    if object_kind == "message":
        if representation.get("schema") != "wk-legal-message-v1":
            raise TerminalDisclosureError(
                "Legal Message representation schema is invalid."
            )
        representation = dict(representation)
        representation["accepted_at"] = normalize_timestamp(
            representation.get("accepted_at"),
            "Message accepted_at",
        )
        if representation.get("client_created_at") is not None:
            representation["client_created_at"] = normalize_timestamp(
                representation.get("client_created_at"),
                "Message client_created_at",
            )
        if representation.get("resource_references") != []:
            raise TerminalDisclosureError(
                "Candidate C v1 refuses implicit Message Resource expansion."
            )
    elif object_kind == "resource_version":
        if representation.get("schema") != "wk-legal-resource-version-v1":
            raise TerminalDisclosureError(
                "Legal Resource Version representation schema is invalid."
            )
        representation = dict(representation)
        representation["registered_at"] = normalize_timestamp(
            representation.get("registered_at"),
            "Resource Version registered_at",
        )
    else:
        raise TerminalDisclosureError(
            "Canonical JSON representation requested for unsupported object kind."
        )
    return canonical_json_bytes(representation)


def normalize_plan(plan, job):
    plan = expect_object(plan, "Legal disclosure plan")
    package_id = normalize_uuid(
        plan.get("legal_disclosure_package_id"),
        "legal_disclosure_package_id",
    )
    case_id = normalize_uuid(
        plan.get("legal_request_case_id"),
        "legal_request_case_id",
    )
    selection = normalize_sha256(
        plan.get("selection_fingerprint"),
        "selection_fingerprint",
    )
    if selection != normalize_sha256(
        job.get("selection_fingerprint"),
        "claimed selection_fingerprint",
    ):
        raise TerminalDisclosureError(
            "Claimed job and Legal disclosure plan fingerprints differ."
        )
    if package_id != normalize_uuid(
        job.get("legal_disclosure_package_id"),
        "claimed legal_disclosure_package_id",
    ):
        raise TerminalDisclosureError(
            "Claimed job and Legal disclosure package identities differ."
        )
    if case_id != normalize_uuid(
        job.get("legal_request_case_id"),
        "claimed legal_request_case_id",
    ):
        raise TerminalDisclosureError(
            "Claimed job and Legal Request Case identities differ."
        )
    storage_relative = safe_relative_path(
        plan.get("storage_path"),
        legal_target=True,
    )
    objects = expect_list(plan.get("objects"), "Legal disclosure objects")
    approvals = expect_list(plan.get("approvals"), "Legal disclosure approvals")
    if not objects:
        raise TerminalDisclosureError(
            "Legal disclosure package has no selected objects."
        )
    normalized_orders = [
        normalize_int(item.get("manifest_order"), "manifest_order", minimum=1)
        for item in objects
        if isinstance(item, dict)
    ]
    if len(normalized_orders) != len(objects):
        raise TerminalDisclosureError(
            "Legal disclosure object entry is not an object."
        )
    if normalized_orders != list(range(1, len(objects) + 1)):
        raise TerminalDisclosureError(
            "Legal disclosure manifest order is not contiguous."
        )
    return {
        **plan,
        "legal_disclosure_package_id": package_id,
        "legal_request_case_id": case_id,
        "selection_fingerprint": selection,
        "generated_at": normalize_timestamp(
            plan.get("generated_at"),
            "generated_at",
        ),
        "storage_relative": storage_relative,
        "objects": objects,
        "approvals": approvals,
    }


def manifest_approval(entry):
    entry = expect_object(entry, "Legal disclosure approval")
    scope = entry.get("approval_scope")
    if scope not in ("package", "elevated_object"):
        raise TerminalDisclosureError(
            "Legal disclosure approval scope is invalid."
        )
    preserved_id = entry.get("legal_preserved_object_id")
    if scope == "package":
        if preserved_id is not None:
            raise TerminalDisclosureError(
                "Package approval unexpectedly targets one object."
            )
    else:
        preserved_id = normalize_uuid(
            preserved_id,
            "approval legal_preserved_object_id",
        )
    return {
        "approval_id": normalize_uuid(entry.get("approval_id"), "approval_id"),
        "approval_scope": scope,
        "legal_preserved_object_id": preserved_id,
        "approved_by_user_id": normalize_uuid(
            entry.get("approved_by_user_id"),
            "approved_by_user_id",
        ),
        "approved_at": normalize_timestamp(
            entry.get("approved_at"),
            "approved_at",
        ),
        "selection_fingerprint": normalize_sha256(
            entry.get("selection_fingerprint"),
            "approval selection_fingerprint",
        ),
    }


def build_package(job):
    global ACTIVE_JOB_ID, LAST_HEARTBEAT
    job_id = normalize_uuid(job.get("job_id"), "job_id")
    ACTIVE_JOB_ID = job_id
    LAST_HEARTBEAT = 0.0
    renew_active_lease(force=True)

    raw_plan = rpc(
        "get_messages_legal_disclosure_plan_v1",
        {"p_job_id": job_id, "p_worker_id": WORKER_ID},
    )
    plan = normalize_plan(raw_plan, job)
    staging = staging_directory(job_id)
    clean_staging(staging)
    staging.mkdir(parents=True, exist_ok=True)
    archive_stage = staging / "production.zip.tmp"

    object_manifest = []
    completion_objects = []

    with zipfile.ZipFile(
        archive_stage,
        mode="x",
        compression=zipfile.ZIP_STORED,
        allowZip64=True,
    ) as archive:
        archive.comment = b""
        for planned in plan["objects"]:
            planned = expect_object(planned, "Legal disclosure object")
            entry_id = normalize_uuid(
                planned.get("legal_disclosure_object_id"),
                "legal_disclosure_object_id",
            )
            preserved_id = normalize_uuid(
                planned.get("legal_preserved_object_id"),
                "legal_preserved_object_id",
            )
            source_object_id = normalize_uuid(
                planned.get("source_object_id"),
                "source_object_id",
            )
            object_kind = planned.get("object_kind")
            if object_kind not in ("message", "media_file", "resource_version"):
                raise TerminalDisclosureError(
                    "Legal disclosure object kind is invalid."
                )
            classification = planned.get("response_classification")
            if classification not in ("responsive", "elevated_review"):
                raise TerminalDisclosureError(
                    "Legal disclosure object classification is not producible."
                )
            order = normalize_int(
                planned.get("manifest_order"),
                "manifest_order",
                minimum=1,
            )
            expected_output_path = str(planned.get("output_path") or "")
            if not expected_output_path.startswith(
                f"objects/{order:06d}-"
            ):
                raise TerminalDisclosureError(
                    "Legal disclosure output path does not match manifest order."
                )
            source = expect_object(
                rpc(
                    "get_messages_legal_disclosure_source_v1",
                    {
                        "p_job_id": job_id,
                        "p_worker_id": WORKER_ID,
                        "p_legal_disclosure_object_id": entry_id,
                    },
                ),
                "Legal disclosure source",
            )
            if normalize_uuid(
                source.get("legal_disclosure_object_id"),
                "source legal_disclosure_object_id",
            ) != entry_id:
                raise TerminalDisclosureError(
                    "Legal disclosure source returned a different selected object."
                )
            output_path = str(source.get("output_path") or "")
            if output_path != expected_output_path:
                raise TerminalDisclosureError(
                    "Legal disclosure source output path differs from the approved plan."
                )
            if source.get("object_kind") != object_kind:
                raise TerminalDisclosureError(
                    "Legal disclosure source kind differs from the approved plan."
                )

            if object_kind == "media_file":
                source_path, expected_sha, expected_size = media_source(source)
                output_mime = str(source.get("output_mime_type") or "")
                if not output_mime:
                    raise TerminalDisclosureError(
                        "Legal Media source MIME type is missing."
                    )
                object_sha, object_size = write_media_entry(
                    archive,
                    output_path,
                    source_path,
                    expected_sha,
                    expected_size,
                )
            else:
                output_mime = str(source.get("output_mime_type") or "")
                if output_mime != "application/json":
                    raise TerminalDisclosureError(
                        "Legal canonical JSON object has an invalid MIME type."
                    )
                object_bytes = canonical_representation(source, object_kind)
                object_sha, object_size = write_bytes_entry(
                    archive,
                    output_path,
                    object_bytes,
                )

            source_fingerprint = planned.get("source_fingerprint")
            if source_fingerprint is not None:
                source_fingerprint = normalize_sha256(
                    source_fingerprint,
                    "source_fingerprint",
                )
            object_manifest.append(
                {
                    "manifest_order": order,
                    "legal_disclosure_object_id": entry_id,
                    "legal_preserved_object_id": preserved_id,
                    "object_kind": object_kind,
                    "source_object_id": source_object_id,
                    "source_fingerprint": source_fingerprint,
                    "response_classification": classification,
                    "output_path": output_path,
                    "output_mime_type": output_mime,
                    "object_sha256": object_sha,
                    "object_byte_size": object_size,
                }
            )
            completion_objects.append(
                {
                    "legal_disclosure_object_id": entry_id,
                    "output_path": output_path,
                    "output_mime_type": output_mime,
                    "object_sha256": object_sha,
                    "object_byte_size": object_size,
                }
            )
            renew_active_lease()

        approvals = [manifest_approval(item) for item in plan["approvals"]]
        if not approvals or approvals[0]["approval_scope"] != "package":
            raise TerminalDisclosureError(
                "Legal disclosure plan lacks package approval."
            )
        if any(
            item["selection_fingerprint"] != plan["selection_fingerprint"]
            for item in approvals
        ):
            raise TerminalDisclosureError(
                "Legal disclosure approval fingerprint differs from package selection."
            )

        omissions = plan.get("documented_omissions")
        if not isinstance(omissions, list) or any(
            not isinstance(item, str) or not item.strip()
            for item in omissions
        ):
            raise TerminalDisclosureError(
                "Legal disclosure documented omissions are invalid."
            )

        manifest = {
            "schema": "wk-legal-disclosure-manifest-v1",
            "production_id": plan["legal_disclosure_package_id"],
            "production_reference": str(plan.get("production_reference") or ""),
            "legal_request_case_id": plan["legal_request_case_id"],
            "generated_at": plan["generated_at"],
            "scope_statement": str(plan.get("scope_statement") or ""),
            "documented_omissions": omissions,
            "approvals": approvals,
            "objects": object_manifest,
        }
        if not manifest["production_reference"] or not manifest["scope_statement"]:
            raise TerminalDisclosureError(
                "Legal disclosure manifest identity or scope is missing."
            )
        manifest_bytes = canonical_json_bytes(manifest)
        manifest_sha = sha256_bytes(manifest_bytes)
        write_bytes_entry(archive, "manifest.json", manifest_bytes)

    with archive_stage.open("rb") as handle:
        os.fsync(handle.fileno())
    package_sha, package_size = sha256_file(archive_stage)
    renew_active_lease(force=True)

    target = media_path(plan["storage_relative"])
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if not target.is_file():
            raise TerminalDisclosureError(
                "Immutable Legal disclosure target is not a file."
            )
        existing_sha, existing_size = sha256_file(target)
        if existing_sha != package_sha or existing_size != package_size:
            raise TerminalDisclosureError(
                "Immutable Legal disclosure path collision has different bytes."
            )
    else:
        assembling = target.parent / (
            f".{target.name}.assembling-{uuid.uuid4().hex}.tmp"
        )
        try:
            with archive_stage.open("rb") as source_handle:
                with assembling.open("xb") as target_handle:
                    while True:
                        chunk = source_handle.read(CHUNK_BYTES)
                        if not chunk:
                            break
                        target_handle.write(chunk)
                        renew_active_lease()
                    target_handle.flush()
                    os.fsync(target_handle.fileno())
            os.chmod(assembling, 0o640)
            try:
                os.link(assembling, target)
            except FileExistsError:
                pass
            if not target.is_file():
                raise TerminalDisclosureError(
                    "Immutable Legal disclosure activation failed."
                )
            target_sha, target_size = sha256_file(target)
            if target_sha != package_sha or target_size != package_size:
                raise TerminalDisclosureError(
                    "Immutable Legal disclosure activation changed package bytes."
                )
            directory_fd = os.open(target.parent, os.O_DIRECTORY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        finally:
            assembling.unlink(missing_ok=True)

    manifest_text = manifest_bytes.decode("utf-8")
    result = rpc(
        "complete_messages_legal_disclosure_job_v1",
        {
            "p_job_id": job_id,
            "p_worker_id": WORKER_ID,
            "p_result": {
                "manifest_text": manifest_text,
                "manifest_sha256": manifest_sha,
                "package_sha256": package_sha,
                "package_byte_size": package_size,
                "storage_path": plan["storage_relative"].as_posix(),
                "objects": completion_objects,
            },
        },
    )
    clean_staging(staging)
    return expect_object(result, "Legal disclosure completion")


def fail_job(job_id, error, retryable):
    detail = str(error)
    if len(detail) > 4000:
        detail = detail[-4000:]
    try:
        return rpc(
            "fail_messages_legal_disclosure_job_v1",
            {
                "p_job_id": job_id,
                "p_worker_id": WORKER_ID,
                "p_error": detail,
                "p_retryable": retryable,
                "p_retry_delay_seconds": 60,
            },
        )
    except Exception as fail_error:
        log(
            "Could not record Legal disclosure worker failure.",
            job_id=job_id,
            error=str(fail_error),
            original_error=detail,
        )
        return None


def claim_jobs():
    result = rpc(
        "claim_messages_legal_disclosure_jobs_v1",
        {
            "p_worker_id": WORKER_ID,
            "p_limit": 1,
            "p_lease_seconds": LEASE_SECONDS,
        },
    )
    if result is None:
        return []
    return expect_list(result, "Legal disclosure job claim")


def process_claim(job):
    global ACTIVE_JOB_ID, LAST_HEARTBEAT
    job = expect_object(job, "Claimed Legal disclosure job")
    job_id = normalize_uuid(job.get("job_id"), "job_id")
    try:
        result = build_package(job)
        log(
            "Legal disclosure package generated.",
            job_id=job_id,
            package_id=result.get("legal_disclosure_package_id"),
            manifest_sha256=result.get("manifest_sha256"),
            package_sha256=result.get("package_sha256"),
        )
    except TerminalDisclosureError as exc:
        fail_job(job_id, exc, False)
        log(
            "Legal disclosure package failed terminally.",
            job_id=job_id,
            error=str(exc),
        )
    except RetryableDisclosureError as exc:
        fail_job(job_id, exc, True)
        log(
            "Legal disclosure package scheduled for retry.",
            job_id=job_id,
            error=str(exc),
        )
    except Exception as exc:
        fail_job(job_id, exc, True)
        log(
            "Legal disclosure package hit an unexpected retryable failure.",
            job_id=job_id,
            error=str(exc),
        )
    finally:
        ACTIVE_JOB_ID = None
        LAST_HEARTBEAT = 0.0
        try:
            clean_staging(staging_directory(job_id))
        except Exception as exc:
            log(
                "Legal disclosure staging cleanup failed.",
                job_id=job_id,
                error=str(exc),
            )


def main():
    require_runtime()
    log(
        "WAKILISHA Legal disclosure worker started.",
        worker_id=WORKER_ID,
        media_root=str(MEDIA_ROOT),
        processing_root=str(PROCESSING_ROOT),
        lease_seconds=LEASE_SECONDS,
    )
    recover_expired_jobs(force=True)
    while True:
        try:
            recover_expired_jobs()
            jobs = claim_jobs()
            if jobs:
                process_claim(jobs[0])
                continue
        except RetryableDisclosureError as exc:
            log("Legal disclosure worker transport retry.", error=str(exc))
        except Exception as exc:
            log("Legal disclosure worker loop failure.", error=str(exc))
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
