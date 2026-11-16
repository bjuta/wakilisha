#!/usr/bin/env python3
"""One bounded, nonpublishing WK100 scheduler tick; systemd owns the cadence.

No user-controlled endpoints, source payloads, timestamps, credentials in argv,
key material in logs, or automatic in-process retries. Edge and SQL remain the
source/admission/lease authorities. The hosted gateway validates JWT signatures.
"""

import base64
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_REF_RE = re.compile(r"^[a-z0-9]{20}$")
JWT_RE = re.compile(r"^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$")
MAX_CREDENTIAL_BYTES = 4096
MAX_RESPONSE_BYTES = 8192


class PreflightError(Exception):
    """Fail closed. Never include credential content in exception text."""


def _claims_shape(token: str, expected_ref: str, now: int) -> None:
    """Sanity-check shape only; ONLY the hosted gateway verifies the signature."""
    if not 48 <= len(token) <= MAX_CREDENTIAL_BYTES or not JWT_RE.fullmatch(token):
        raise PreflightError("TOKEN_SHAPE")
    try:
        payload = token.split(".")[1]
        padded = payload + "=" * (-len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(padded))
    except (ValueError, UnicodeDecodeError, TypeError, json.JSONDecodeError):
        raise PreflightError("TOKEN_SHAPE") from None
    if not isinstance(claims, dict) or (
        claims.get("iss") != "supabase"
        or claims.get("role") != "service_role"
        or claims.get("ref") != expected_ref
        or type(claims.get("exp")) is not int
        or claims["exp"] <= now + 60
    ):
        raise PreflightError("TOKEN_CLAIMS_SHAPE")


def _load_credential(expected_ref: str, *, environ=None, now=None) -> str:
    env = os.environ if environ is None else environ
    directory = env.get("CREDENTIALS_DIRECTORY", "")
    if not directory or not Path(directory).is_absolute():
        raise PreflightError("CREDENTIAL_DIRECTORY_ABSENT")
    path = Path(directory) / "wk100_service_jwt"
    try:
        with path.open("rb") as stream:
            value = stream.read(MAX_CREDENTIAL_BYTES + 2)
    except OSError:
        raise PreflightError("CREDENTIAL_UNAVAILABLE") from None
    if len(value) > MAX_CREDENTIAL_BYTES + 1:
        raise PreflightError("CREDENTIAL_OVERSIZE")
    try:
        token = value.decode("ascii").rstrip("\n")
    except UnicodeDecodeError:
        raise PreflightError("CREDENTIAL_ENCODING") from None
    if token.encode("ascii") not in (value, value[:-1] if value.endswith(b"\n") else value):
        raise PreflightError("CREDENTIAL_FORMAT")
    _claims_shape(token, expected_ref, int(time.time() if now is None else now))
    return token


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def _request_tick(ref: str, token: str, *, transport=None):
    """HTTPS only, pinned project, no redirects/proxies, no unbounded response."""
    if not PROJECT_REF_RE.fullmatch(ref):
        raise PreflightError("PROJECT_REF_INVALID")
    url = "https://" + ref + ".supabase.co/functions/v1/wk100-source-scheduler"
    request = urllib.request.Request(
        url, data=b"", method="POST",
        headers={
            "Authorization": "Bearer " + token,
            "apikey": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "WAKILISHA-WK100-systemd-tick/1",
        },
    )
    open_request = transport
    if open_request is None:
        opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}),
            urllib.request.HTTPSHandler(context=ssl.create_default_context()),
            NoRedirect(),
        )
        open_request = opener.open
    try:
        with open_request(request, timeout=155) as response:
            if response.status != 200:
                raise PreflightError("HTTP_NOT_OK")
            payload = response.read(MAX_RESPONSE_BYTES + 1)
            if len(payload) > MAX_RESPONSE_BYTES:
                raise PreflightError("RESPONSE_OVERSIZE")
    except urllib.error.HTTPError as exc:
        # Never log the error response; it could contain secrets or external data.
        raise PreflightError("HTTP_" + str(exc.code)) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise PreflightError("TRANSPORT_FAILURE") from None
    try:
        result = json.loads(payload)
    except (UnicodeDecodeError, ValueError):
        raise PreflightError("RESPONSE_INVALID") from None
    if not isinstance(result, dict) or (
        result.get("schemaVersion") != "wk100-source-scheduler-v1"
        or result.get("canScore") is not False
        or result.get("canPublish") is not False
    ):
        raise PreflightError("RESPONSE_AUTHORITY_INVALID")
    state = result.get("status")
    if state == "disabled":
        if type(result.get("dispatched")) is not int or result["dispatched"] != 0:
            raise PreflightError("DISABLED_RESPONSE_INVALID")
        return ("DISABLED", 0, 0, 0)
    if state != "evaluated":
        raise PreflightError("RESPONSE_STATE_UNKNOWN")
    for field in ("eligible", "dispatched", "rejected"):
        if type(result.get(field)) is not int or result[field] < 0 or result[field] > 5000:
            raise PreflightError("COUNTER_INVALID")
    eligible, dispatched, rejected = (
        result["eligible"], result["dispatched"], result["rejected"]
    )
    if dispatched + rejected > 4 or dispatched + rejected > eligible:
        raise PreflightError("COUNTER_INCONSISTENT")
    return ("EVALUATED", eligible, dispatched, rejected)


def main(*, environ=None, transport=None, now=None) -> int:
    env = os.environ if environ is None else environ
    ref = env.get("WK100_SCHEDULER_PROJECT_REF", "")
    if not PROJECT_REF_RE.fullmatch(ref):
        print("WK100_TRIGGER=FAIL_PROJECT_REF_INVALID", flush=True)
        return 1
    try:
        token = _load_credential(ref, environ=env, now=now)
        state, eligible, dispatched, rejected = _request_tick(ref, token, transport=transport)
    except PreflightError as exc:
        print("WK100_TRIGGER=FAIL_" + str(exc), flush=True)
        return 1
    except Exception:
        # No traceback. A transport/library exception may embed request data.
        print("WK100_TRIGGER=FAIL_UNEXPECTED", flush=True)
        return 1
    # No provider URLs, bearer tokens, response bodies or user data in logs.
    print("WK100_TRIGGER_STATE=" + state, flush=True)
    print("WK100_TRIGGER_ELIGIBLE=" + str(eligible), flush=True)
    print("WK100_TRIGGER_DISPATCHED=" + str(dispatched), flush=True)
    print("WK100_TRIGGER_REJECTED=" + str(rejected), flush=True)
    if rejected:
        print("WK100_TRIGGER=FAIL_WORKER_REJECTION", flush=True)
        return 1
    print("WK100_TRIGGER=PASS", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
