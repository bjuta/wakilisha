#!/usr/bin/env python3
import hashlib
import hmac
import json
import mimetypes
import os
import posixpath
import re
import shutil
import threading
import time
import urllib.parse
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", "/opt/wakilisha-media")).resolve()
SESSION_ROOT = Path(
    os.environ.get(
        "MEDIA_UPLOAD_SESSION_ROOT",
        "/opt/wakilisha-media-upload-sessions",
    )
).resolve()
SECRET = os.environ.get("MEDIA_UPLOAD_RECEIVER_SECRET", "")
PRIVATE_DELIVERY_SECRET = os.environ.get("MEDIA_PRIVATE_DELIVERY_SECRET", "")
PORT = int(os.environ.get("PORT", "4017"))
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
MAX_MASTER_BYTES = 2 * 1024 * 1024 * 1024
PART_SIZE_BYTES = 8 * 1024 * 1024
MAX_JSON_BYTES = 64 * 1024
EXPIRY_SWEEP_SECONDS = int(os.environ.get("MEDIA_UPLOAD_EXPIRY_SWEEP_SECONDS", "300"))

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".ico", ".pdf",
}
ALLOWED_TRANSCRIPT_EXTENSIONS = {".txt"}
ALLOWED_CAPTION_EXTENSIONS = {".vtt", ".srt"}
ALLOWED_AUDIO_EXTENSIONS = {
    ".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg", ".oga",
}
ALLOWED_VIDEO_EXTENSIONS = {
    ".mp4", ".mov", ".m4v", ".webm", ".mkv",
}
ALLOWED_ORIGINS = {
    value.strip()
    for value in os.environ.get(
        "MEDIA_UPLOAD_ALLOWED_ORIGINS",
        "https://wakilisha.africa",
    ).split(",")
    if value.strip()
}

SESSION_LOCKS = {}
SESSION_LOCKS_GUARD = threading.Lock()
ACTIVE_SESSIONS = set()


def utc_now():
    return datetime.now(timezone.utc)


def iso_now():
    return utc_now().isoformat().replace("+00:00", "Z")


def parse_iso(value):
    text = str(value or "").strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def json_response(handler, status, payload):
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(data)))
    origin = handler.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")
    handler.end_headers()
    handler.wfile.write(data)


def read_json_body(handler):
    length_header = handler.headers.get("Content-Length")
    if not length_header:
        raise ValueError("Content-Length is required.")
    try:
        length = int(length_header)
    except ValueError as exc:
        raise ValueError("Invalid Content-Length.") from exc
    if length <= 0 or length > MAX_JSON_BYTES:
        raise ValueError("JSON request size is invalid.")
    raw = handler.rfile.read(length)
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid JSON body.") from exc
    if not isinstance(payload, dict):
        raise ValueError("JSON body must be an object.")
    return payload


def clean_storage_path(raw_path):
    raw = urllib.parse.unquote(str(raw_path or "")).strip()
    raw = raw.replace("\\", "/")
    raw = raw.lstrip("/")
    normalized = posixpath.normpath(raw)

    if normalized in ("", ".") or normalized.startswith("../") or normalized == "..":
        raise ValueError("Invalid upload path.")

    ext = Path(normalized).suffix.lower()

    if normalized.startswith("uploads/"):
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Unsupported file extension: {ext}")
    elif normalized.startswith("private-files/transcripts/"):
        if ext not in ALLOWED_TRANSCRIPT_EXTENSIONS:
            raise ValueError(f"Unsupported transcript extension: {ext}")
    elif normalized.startswith("private-files/captions/"):
        if ext not in ALLOWED_CAPTION_EXTENSIONS:
            raise ValueError(f"Unsupported caption extension: {ext}")
    else:
        raise ValueError(
            "Upload path must start with uploads/, private-files/transcripts/, "
            "or private-files/captions/."
        )

    target = (MEDIA_ROOT / normalized).resolve()
    if not str(target).startswith(str(MEDIA_ROOT) + os.sep):
        raise ValueError("Upload path escapes media root.")

    return normalized, target


def clean_master_path(raw_path):
    raw = urllib.parse.unquote(str(raw_path or "")).strip()
    raw = raw.replace("\\", "/")
    raw = raw.lstrip("/")
    normalized = posixpath.normpath(raw)

    if normalized in ("", ".") or normalized.startswith("../") or normalized == "..":
        raise ValueError("Invalid master path.")

    if normalized.startswith("masters/audio/"):
        allowed_extensions = ALLOWED_AUDIO_EXTENSIONS
        master_kind = "audio"
    elif normalized.startswith("masters/video/"):
        allowed_extensions = ALLOWED_VIDEO_EXTENSIONS
        master_kind = "video"
    else:
        raise ValueError(
            "Media master path must start with masters/audio/ or masters/video/."
        )

    ext = Path(normalized).suffix.lower()
    if ext not in allowed_extensions:
        raise ValueError(
            f"Unsupported {master_kind} master extension: {ext}"
        )

    target = (MEDIA_ROOT / normalized).resolve()
    if not str(target).startswith(str(MEDIA_ROOT) + os.sep):
        raise ValueError("Master path escapes media root.")

    return normalized, target

def normalize_session_id(value):
    parsed = uuid.UUID(str(value or ""))
    return str(parsed)


def session_directory(session_id):
    normalized = normalize_session_id(session_id)
    target = (SESSION_ROOT / normalized).resolve()
    if not str(target).startswith(str(SESSION_ROOT) + os.sep):
        raise ValueError("Session path escapes session root.")
    return target


def manifest_path(session_id):
    return session_directory(session_id) / "manifest.json"


def get_session_lock(session_id):
    normalized = normalize_session_id(session_id)
    with SESSION_LOCKS_GUARD:
        lock = SESSION_LOCKS.get(normalized)
        if lock is None:
            lock = threading.Lock()
            SESSION_LOCKS[normalized] = lock
        return lock


def load_manifest(session_id):
    path = manifest_path(session_id)
    if not path.is_file():
        raise FileNotFoundError("Upload session does not exist.")
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError("Upload-session manifest is invalid.")
    return payload


def write_manifest(session_id, payload):
    directory = session_directory(session_id)
    directory.mkdir(parents=True, exist_ok=True)
    os.chmod(directory, 0o700)
    target = directory / "manifest.json"
    temp = directory / f"manifest.{uuid.uuid4().hex}.tmp"
    data = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    with open(temp, "wb") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(temp, 0o600)
    os.replace(temp, target)


def capability_hash(token):
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def private_delivery_authorized(raw_uri):
    if not PRIVATE_DELIVERY_SECRET:
        return False

    try:
        parsed = urllib.parse.urlparse(str(raw_uri or ""))
        prefix = "/__private/media-file/"

        if not parsed.path.startswith(prefix):
            return False

        storage_path = urllib.parse.unquote(
            parsed.path[len(prefix):]
        ).lstrip("/")

        normalized = posixpath.normpath(
            storage_path.replace("\\", "/")
        )

        if (
            normalized in ("", ".")
            or normalized == ".."
            or normalized.startswith("../")
            or not normalized.startswith(
                (
                    "masters/audio/",
                    "masters/video/",
                    "derived-objects/",
                    "private-files/transcripts/",
                    "private-files/captions/",
                )
            )
        ):
            return False

        query = urllib.parse.parse_qs(
            parsed.query
        )
        expires_text = (
            query.get("expires")
            or [""]
        )[0]
        token = (
            query.get("token")
            or [""]
        )[0].lower()

        expires = int(expires_text)

        now = int(time.time())

        if (
            expires <= now
            or expires > now + 900
            or not re.fullmatch(
                r"[0-9a-f]{64}",
                token,
            )
        ):
            return False

        expected = hmac.new(
            PRIVATE_DELIVERY_SECRET.encode("utf-8"),
            f"{expires}\n{normalized}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(
            token,
            expected,
        )
    except (
        TypeError,
        ValueError,
        OverflowError,
    ):
        return False


def shared_secret_authorized(handler):
    auth = handler.headers.get("Authorization", "")
    return bool(SECRET) and hmac.compare_digest(auth, f"Bearer {SECRET}")


def capability_authorized(handler, manifest):
    auth = handler.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    token = auth[7:]
    expected = str(manifest.get("capability_sha256") or "")
    return bool(expected) and hmac.compare_digest(capability_hash(token), expected)


def part_path(session_id, part_number):
    return session_directory(session_id) / f"part-{part_number:06d}.bin"


def expected_part_size(manifest, part_number):
    expected_size = int(manifest["expected_byte_size"])
    part_size = int(manifest["part_size_bytes"])
    total_parts = int(manifest["total_parts"])
    if part_number < 0 or part_number >= total_parts:
        raise ValueError("Part number is outside the upload session.")
    if part_number < total_parts - 1:
        return part_size
    return expected_size - part_size * (total_parts - 1)


def uploaded_part_summary(session_id, manifest):
    count = 0
    byte_size = 0
    total_parts = int(manifest["total_parts"])
    for part_number in range(total_parts):
        path = part_path(session_id, part_number)
        if path.is_file():
            count += 1
            byte_size += path.stat().st_size
    return count, byte_size


def receiver_state(session_id, manifest):
    terminal = str(manifest.get("state") or "")
    if terminal in {"verified", "failed", "cancelled", "expired"}:
        return terminal
    try:
        if parse_iso(manifest["expires_at"]) <= utc_now():
            return "expired"
    except Exception:
        return "failed"
    normalized = normalize_session_id(session_id)
    if normalized in ACTIVE_SESSIONS:
        return "active"
    count, _ = uploaded_part_summary(session_id, manifest)
    total_parts = int(manifest["total_parts"])
    if count == total_parts:
        return "unverified"
    if count > 0:
        return "interrupted"
    return "created"


def session_status_payload(session_id, manifest):
    count, byte_size = uploaded_part_summary(session_id, manifest)
    return {
        "session_id": normalize_session_id(session_id),
        "state": receiver_state(session_id, manifest),
        "storage_path": manifest["storage_path"],
        "expected_byte_size": int(manifest["expected_byte_size"]),
        "expected_sha256": manifest["expected_sha256"],
        "part_size_bytes": int(manifest["part_size_bytes"]),
        "total_parts": int(manifest["total_parts"]),
        "uploaded_parts": count,
        "uploaded_bytes": byte_size,
        "expires_at": manifest["expires_at"],
        "verified_byte_size": manifest.get("verified_byte_size"),
        "verified_sha256": manifest.get("verified_sha256"),
        "verified_at": manifest.get("verified_at"),
        "last_error": manifest.get("last_error"),
    }



def remove_partial_session_files(session_id):
    directory = session_directory(session_id)
    if not directory.is_dir():
        return 0
    removed = 0
    patterns = (
        "part-*.bin",
        "part-*.tmp",
        "assembled.*.tmp",
    )
    for pattern in patterns:
        for path in directory.glob(pattern):
            if path.is_file():
                path.unlink(missing_ok=True)
                removed += 1

    try:
        manifest = load_manifest(session_id)
        _, target = clean_master_path(manifest["storage_path"])
        assembly_staging = (
            target.parent
            / f".{target.name}.assembling-{normalize_session_id(session_id)}.tmp"
        )
        if assembly_staging.is_file():
            assembly_staging.unlink(missing_ok=True)
            removed += 1
    except (FileNotFoundError, KeyError, TypeError, ValueError):
        pass

    return removed


def expire_session_if_due(session_id):
    normalized = normalize_session_id(session_id)
    if normalized in ACTIVE_SESSIONS:
        return False
    lock = get_session_lock(normalized)
    with lock:
        try:
            manifest = load_manifest(normalized)
        except (FileNotFoundError, ValueError):
            return False
        if manifest.get("state") != "created":
            return False
        try:
            due = parse_iso(manifest["expires_at"]) <= utc_now()
        except Exception:
            return False
        if not due:
            return False
        remove_partial_session_files(normalized)
        manifest["state"] = "expired"
        manifest["last_error"] = "Upload session expired before verification."
        manifest["updated_at"] = iso_now()
        write_manifest(normalized, manifest)
        return True


def sweep_expired_sessions():
    SESSION_ROOT.mkdir(parents=True, exist_ok=True)
    expired = 0
    for directory in list(SESSION_ROOT.iterdir()):
        if not directory.is_dir():
            continue
        try:
            if expire_session_if_due(directory.name):
                expired += 1
        except Exception as exc:
            print(
                f"expiry sweep skipped {directory.name}: {exc}",
                flush=True,
            )
    return expired


def expiry_sweeper_loop():
    while True:
        try:
            sweep_expired_sessions()
        except Exception as exc:
            print(f"expiry sweep failed: {exc}", flush=True)
        time.sleep(max(30, EXPIRY_SWEEP_SECONDS))


class Handler(BaseHTTPRequestHandler):
    server_version = "WakilishaMediaReceiver/2.1"

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)

    def do_OPTIONS(self):
        self.send_response(204)
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Part-SHA256")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/healthz":
            return json_response(self, 200, {"ok": True})

        if parsed.path == "/authorize-private-file":
            raw_uri = self.headers.get("X-Original-URI", "")
            if private_delivery_authorized(raw_uri):
                self.send_response(204)
                self.end_headers()
                return
            return json_response(self, 403, {"error": "Private Media delivery authorization failed."})

        match = re.fullmatch(r"/sessions/([0-9a-fA-F-]{36})", parsed.path)
        if match:
            return self.get_session_status(match.group(1))

        return json_response(self, 404, {"error": "Not found."})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/sessions":
            return self.create_session()

        match = re.fullmatch(r"/sessions/([0-9a-fA-F-]{36})/complete", parsed.path)
        if match:
            return self.complete_session(match.group(1))

        return json_response(self, 404, {"error": "Not found."})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        match = re.fullmatch(r"/sessions/([0-9a-fA-F-]{36})", parsed.path)
        if match:
            return self.cancel_session(match.group(1))
        return json_response(self, 404, {"error": "Not found."})

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/upload":
            return self.legacy_upload(parsed)

        match = re.fullmatch(
            r"/sessions/([0-9a-fA-F-]{36})/parts/([0-9]+)",
            parsed.path,
        )
        if match:
            return self.upload_part(match.group(1), int(match.group(2)))

        return json_response(self, 404, {"error": "Not found."})

    def create_session(self):
        if not shared_secret_authorized(self):
            return json_response(self, 401, {"error": "Unauthorized."})

        try:
            payload = read_json_body(self)
            session_id = normalize_session_id(payload.get("session_id"))
            storage_path, target = clean_master_path(payload.get("storage_path"))
            expected_byte_size = int(payload.get("expected_byte_size"))
            expected_sha256 = str(payload.get("expected_sha256") or "").lower().strip()
            part_size_bytes = int(payload.get("part_size_bytes"))
            total_parts = int(payload.get("total_parts"))
            expires_at = parse_iso(payload.get("expires_at"))
            capability_token = str(payload.get("capability_token") or "")
            mime_type = str(payload.get("mime_type") or "").lower().strip()
            original_filename = str(payload.get("original_filename") or "").strip()
        except (ValueError, TypeError, KeyError) as exc:
            return json_response(self, 400, {"error": str(exc)})

        if expected_byte_size <= 0 or expected_byte_size > MAX_MASTER_BYTES:
            return json_response(self, 400, {"error": "Media master byte size is outside the M3 resumable range."})
        if not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
            return json_response(self, 400, {"error": "Expected SHA-256 is invalid."})
        if part_size_bytes != PART_SIZE_BYTES:
            return json_response(self, 400, {"error": "Unexpected part size."})
        expected_total_parts = (expected_byte_size + part_size_bytes - 1) // part_size_bytes
        if total_parts != expected_total_parts or total_parts < 1:
            return json_response(self, 400, {"error": "Unexpected part count."})
        if expires_at <= utc_now():
            return json_response(self, 400, {"error": "Upload session is already expired."})
        if len(capability_token) < 32:
            return json_response(self, 400, {"error": "Upload capability is invalid."})
        if not (
            mime_type.startswith("audio/")
            or mime_type.startswith("video/")
        ):
            return json_response(
                self,
                400,
                {"error": "Audio or video MIME type is required."},
            )
        if storage_path.startswith("masters/audio/") and not mime_type.startswith("audio/"):
            return json_response(
                self,
                400,
                {"error": "Audio master path requires an audio MIME type."},
            )
        if storage_path.startswith("masters/video/") and not mime_type.startswith("video/"):
            return json_response(
                self,
                400,
                {"error": "Video master path requires a video MIME type."},
            )
        if not original_filename:
            return json_response(self, 400, {"error": "Original filename is required."})
        lock = get_session_lock(session_id)
        with lock:
            path = manifest_path(session_id)
            if path.is_file():
                manifest = load_manifest(session_id)
                immutable_fields = {
                    "storage_path": storage_path,
                    "expected_byte_size": expected_byte_size,
                    "expected_sha256": expected_sha256,
                    "part_size_bytes": part_size_bytes,
                    "total_parts": total_parts,
                    "mime_type": mime_type,
                    "original_filename": original_filename,
                }
                for key, value in immutable_fields.items():
                    if manifest.get(key) != value:
                        return json_response(self, 409, {"error": f"Upload session metadata changed: {key}."})
                if manifest.get("state") == "verified":
                    return json_response(self, 200, session_status_payload(session_id, manifest))
                manifest["capability_sha256"] = capability_hash(capability_token)
                manifest["updated_at"] = iso_now()
                write_manifest(session_id, manifest)
                return json_response(self, 200, session_status_payload(session_id, manifest))

            if target.exists():
                return json_response(self, 409, {"error": "Immutable master destination already exists."})

            manifest = {
                "version": 1,
                "session_id": session_id,
                "state": "created",
                "storage_path": storage_path,
                "expected_byte_size": expected_byte_size,
                "expected_sha256": expected_sha256,
                "part_size_bytes": part_size_bytes,
                "total_parts": total_parts,
                "expires_at": expires_at.isoformat().replace("+00:00", "Z"),
                "capability_sha256": capability_hash(capability_token),
                "mime_type": mime_type,
                "original_filename": original_filename,
                "created_at": iso_now(),
                "updated_at": iso_now(),
                "last_error": None,
            }
            write_manifest(session_id, manifest)

        return json_response(self, 201, session_status_payload(session_id, manifest))

    def get_session_status(self, session_id):
        try:
            manifest = load_manifest(session_id)
        except (FileNotFoundError, ValueError) as exc:
            return json_response(self, 404, {"error": str(exc)})

        if not shared_secret_authorized(self) and not capability_authorized(self, manifest):
            return json_response(self, 401, {"error": "Unauthorized."})

        return json_response(self, 200, session_status_payload(session_id, manifest))

    def upload_part(self, session_id, part_number):
        try:
            manifest = load_manifest(session_id)
        except (FileNotFoundError, ValueError) as exc:
            return json_response(self, 404, {"error": str(exc)})

        if not capability_authorized(self, manifest):
            return json_response(self, 401, {"error": "Unauthorized."})

        state = receiver_state(session_id, manifest)
        if state == "expired":
            return json_response(self, 410, {"error": "Upload session expired."})
        if state in {"verified", "failed", "cancelled"}:
            return json_response(self, 409, {"error": f"Upload session is {state}."})

        try:
            expected_size = expected_part_size(manifest, part_number)
        except ValueError as exc:
            return json_response(self, 400, {"error": str(exc)})

        length_header = self.headers.get("Content-Length")
        if not length_header:
            return json_response(self, 411, {"error": "Content-Length is required."})
        try:
            total = int(length_header)
        except ValueError:
            return json_response(self, 400, {"error": "Invalid Content-Length."})
        if total != expected_size:
            return json_response(self, 400, {"error": "Part byte size does not match the session contract."})

        expected_sha256 = str(self.headers.get("X-Part-SHA256") or "").lower().strip()
        if not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
            return json_response(self, 400, {"error": "X-Part-SHA256 is required."})

        lock = get_session_lock(session_id)
        normalized = normalize_session_id(session_id)
        with lock:
            target = part_path(session_id, part_number)
            if target.is_file():
                existing_sha = sha256_file(target)
                if target.stat().st_size == total and hmac.compare_digest(existing_sha, expected_sha256):
                    return json_response(
                        self,
                        200,
                        {
                            **session_status_payload(session_id, manifest),
                            "part_number": part_number,
                            "part_sha256": existing_sha,
                            "idempotent": True,
                        },
                    )
                return json_response(self, 409, {"error": "Accepted part already exists with different bytes."})

            directory = session_directory(session_id)
            directory.mkdir(parents=True, exist_ok=True)
            temp = directory / f"part-{part_number:06d}.{uuid.uuid4().hex}.tmp"
            remaining = total
            digest = hashlib.sha256()
            ACTIVE_SESSIONS.add(normalized)
            try:
                with open(temp, "xb") as out:
                    while remaining > 0:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            break
                        out.write(chunk)
                        digest.update(chunk)
                        remaining -= len(chunk)
                    out.flush()
                    os.fsync(out.fileno())

                if remaining != 0:
                    temp.unlink(missing_ok=True)
                    return json_response(self, 400, {"error": "Upload part ended early."})

                actual_sha256 = digest.hexdigest()
                if not hmac.compare_digest(actual_sha256, expected_sha256):
                    temp.unlink(missing_ok=True)
                    return json_response(self, 422, {"error": "Upload part checksum mismatch."})

                os.chmod(temp, 0o600)
                if target.exists():
                    temp.unlink(missing_ok=True)
                    return json_response(self, 409, {"error": "Accepted part appeared during upload."})
                os.replace(temp, target)

                manifest = load_manifest(session_id)
                manifest["updated_at"] = iso_now()
                manifest["last_error"] = None
                write_manifest(session_id, manifest)
            finally:
                ACTIVE_SESSIONS.discard(normalized)
                temp.unlink(missing_ok=True)

        manifest = load_manifest(session_id)
        return json_response(
            self,
            200,
            {
                **session_status_payload(session_id, manifest),
                "part_number": part_number,
                "part_sha256": expected_sha256,
                "idempotent": False,
            },
        )

    def complete_session(self, session_id):
        if not shared_secret_authorized(self):
            return json_response(self, 401, {"error": "Unauthorized."})

        try:
            manifest = load_manifest(session_id)
        except (FileNotFoundError, ValueError) as exc:
            return json_response(self, 404, {"error": str(exc)})

        lock = get_session_lock(session_id)
        with lock:
            manifest = load_manifest(session_id)
            if manifest.get("state") == "verified":
                return json_response(
                    self,
                    200,
                    {
                        **session_status_payload(session_id, manifest),
                        "byte_size": manifest.get("verified_byte_size"),
                        "sha256": manifest.get("verified_sha256"),
                        "terminal": False,
                    },
                )

            state = receiver_state(session_id, manifest)
            if state == "expired":
                return json_response(self, 410, {"error": "Upload session expired.", "terminal": False})
            if state != "unverified":
                return json_response(self, 409, {"error": "All upload parts are required before finalization.", "terminal": False})

            storage_path, target = clean_master_path(manifest["storage_path"])
            if target.exists():
                return json_response(self, 409, {"error": "Immutable master destination already exists.", "terminal": True})

            directory = session_directory(session_id)
            target.parent.mkdir(parents=True, exist_ok=True)
            os.chmod(target.parent, 0o755)
            staging = (
                target.parent
                / f".{target.name}.assembling-{normalize_session_id(session_id)}.tmp"
            )
            staging.unlink(missing_ok=True)
            digest = hashlib.sha256()
            byte_size = 0

            try:
                with open(staging, "xb") as out:
                    for part_number in range(int(manifest["total_parts"])):
                        path = part_path(session_id, part_number)
                        if not path.is_file():
                            return json_response(self, 409, {"error": "An upload part disappeared before finalization.", "terminal": False})
                        with open(path, "rb") as source:
                            while True:
                                chunk = source.read(1024 * 1024)
                                if not chunk:
                                    break
                                out.write(chunk)
                                digest.update(chunk)
                                byte_size += len(chunk)
                    out.flush()
                    os.fsync(out.fileno())

                actual_sha256 = digest.hexdigest()
                expected_byte_size = int(manifest["expected_byte_size"])
                expected_sha256 = str(manifest["expected_sha256"])
                if byte_size != expected_byte_size or not hmac.compare_digest(actual_sha256, expected_sha256):
                    manifest["state"] = "failed"
                    manifest["last_error"] = "Final master checksum or byte count mismatch."
                    manifest["updated_at"] = iso_now()
                    write_manifest(session_id, manifest)
                    return json_response(
                        self,
                        422,
                        {
                            "error": manifest["last_error"],
                            "terminal": True,
                            "byte_size": byte_size,
                            "sha256": actual_sha256,
                        },
                    )

                try:
                    os.link(staging, target)
                except FileExistsError:
                    return json_response(self, 409, {"error": "Immutable master destination already exists.", "terminal": True})

                os.chmod(target, 0o640)
                with open(target, "rb") as final_file:
                    os.fsync(final_file.fileno())
                directory_fd = os.open(target.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
                try:
                    os.fsync(directory_fd)
                finally:
                    os.close(directory_fd)

                manifest["state"] = "verified"
                manifest["verified_byte_size"] = byte_size
                manifest["verified_sha256"] = actual_sha256
                manifest["verified_at"] = iso_now()
                manifest["updated_at"] = iso_now()
                manifest["last_error"] = None
                write_manifest(session_id, manifest)

                for part_number in range(int(manifest["total_parts"])):
                    part_path(session_id, part_number).unlink(missing_ok=True)
            finally:
                staging.unlink(missing_ok=True)

        manifest = load_manifest(session_id)
        return json_response(
            self,
            200,
            {
                **session_status_payload(session_id, manifest),
                "storage_path": storage_path,
                "byte_size": manifest["verified_byte_size"],
                "sha256": manifest["verified_sha256"],
                "terminal": False,
            },
        )

    def cancel_session(self, session_id):
        if not shared_secret_authorized(self):
            return json_response(self, 401, {"error": "Unauthorized."})

        try:
            directory = session_directory(session_id)
        except ValueError as exc:
            return json_response(self, 400, {"error": str(exc)})

        if not directory.exists():
            return json_response(self, 200, {"session_id": normalize_session_id(session_id), "state": "cancelled", "idempotent": True})

        lock = get_session_lock(session_id)
        with lock:
            manifest = load_manifest(session_id)
            if manifest.get("state") == "verified":
                return json_response(self, 409, {"error": "Verified master cannot be cancelled."})

            _, target = clean_master_path(manifest["storage_path"])
            if target.exists():
                expected_size = int(manifest["expected_byte_size"])
                expected_sha256 = str(manifest["expected_sha256"])
                if (
                    target.stat().st_size == expected_size
                    and hmac.compare_digest(sha256_file(target), expected_sha256)
                ):
                    target.unlink()
                else:
                    return json_response(
                        self,
                        409,
                        {"error": "Protected master path contains bytes not owned by this session."},
                    )
            shutil.rmtree(directory)

        return json_response(self, 200, {"session_id": normalize_session_id(session_id), "state": "cancelled", "idempotent": False})

    def legacy_upload(self, parsed):
        if not shared_secret_authorized(self):
            return json_response(self, 401, {"error": "Unauthorized."})

        qs = urllib.parse.parse_qs(parsed.query)
        raw_path = (qs.get("path") or [""])[0]

        try:
            storage_path, target = clean_storage_path(raw_path)
        except ValueError as exc:
            return json_response(self, 400, {"error": str(exc)})

        length_header = self.headers.get("Content-Length")
        if not length_header:
            return json_response(self, 411, {"error": "Content-Length is required."})
        try:
            total = int(length_header)
        except ValueError:
            return json_response(self, 400, {"error": "Invalid Content-Length."})

        if total <= 0:
            return json_response(self, 400, {"error": "Empty upload."})
        if total > MAX_UPLOAD_BYTES:
            return json_response(self, 413, {"error": "Upload too large."})

        content_type = self.headers.get("Content-Type", "")
        is_transcript = storage_path.startswith("private-files/transcripts/")
        is_caption = storage_path.startswith("private-files/captions/")

        if is_transcript:
            allowed_content_types = {
                "",
                "text/plain",
                "application/octet-stream",
            }
            if content_type not in allowed_content_types:
                return json_response(
                    self,
                    415,
                    {"error": f"Unsupported transcript content type: {content_type}"},
                )
        elif is_caption:
            allowed_content_types = {
                "",
                "text/plain",
                "text/vtt",
                "application/x-subrip",
                "application/octet-stream",
            }
            if content_type not in allowed_content_types:
                return json_response(
                    self,
                    415,
                    {"error": f"Unsupported caption content type: {content_type}"},
                )
        elif content_type and not (
            content_type.startswith("image/")
            or content_type == "application/octet-stream"
            or content_type == "application/pdf"
        ):
            return json_response(self, 415, {"error": f"Unsupported content type: {content_type}"})

        if target.exists():
            return json_response(self, 409, {"error": "Immutable upload destination already exists."})

        target.parent.mkdir(parents=True, exist_ok=True)
        temp = target.with_name(target.name + f".{uuid.uuid4().hex}.tmp")
        remaining = total
        try:
            with open(temp, "xb") as out:
                while remaining > 0:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    out.write(chunk)
                    remaining -= len(chunk)
                out.flush()
                os.fsync(out.fileno())

            if remaining != 0:
                return json_response(self, 400, {"error": "Upload ended early."})

            if target.exists():
                return json_response(self, 409, {"error": "Immutable upload destination appeared during upload."})

            os.link(temp, target)
            os.chmod(target, 0o644)
        except FileExistsError:
            return json_response(self, 409, {"error": "Immutable upload destination already exists."})
        finally:
            temp.unlink(missing_ok=True)

        public_url = f"https://media.wakilisha.africa/{storage_path}"
        return json_response(
            self,
            200,
            {
                "ok": True,
                "url": public_url,
                "storage_path": storage_path,
                "size": total,
                "content_type": content_type or mimetypes.guess_type(str(target))[0] or "application/octet-stream",
            },
        )


if __name__ == "__main__":
    if not SECRET:
        raise SystemExit("MEDIA_UPLOAD_RECEIVER_SECRET is required.")
    if not PRIVATE_DELIVERY_SECRET:
        raise SystemExit("MEDIA_PRIVATE_DELIVERY_SECRET is required.")
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    SESSION_ROOT.mkdir(parents=True, exist_ok=True)
    os.chmod(SESSION_ROOT, 0o700)
    sweep_expired_sessions()
    threading.Thread(
        target=expiry_sweeper_loop,
        name="media-upload-expiry-sweeper",
        daemon=True,
    ).start()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"WAKILISHA media receiver listening on 127.0.0.1:{PORT}", flush=True)
    server.serve_forever()
