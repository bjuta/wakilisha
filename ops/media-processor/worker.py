#!/usr/bin/env python3

import array
import base64
import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path


class TerminalProcessingError(RuntimeError):
    pass


class RetryableProcessingError(RuntimeError):
    pass


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MEDIA_ROOT = Path(
    os.environ.get(
        "MEDIA_ROOT",
        "/opt/wakilisha-media",
    )
).resolve()
PROCESSING_ROOT = Path(
    os.environ.get(
        "MEDIA_PROCESSING_ROOT",
        "/opt/wakilisha-media-processing",
    )
).resolve()
POLL_SECONDS = max(
    2,
    int(
        os.environ.get(
            "MEDIA_PROCESSING_POLL_SECONDS",
            "5",
        )
    ),
)
LEASE_SECONDS = min(
    3600,
    max(
        60,
        int(
            os.environ.get(
                "MEDIA_PROCESSING_LEASE_SECONDS",
                "3600",
            )
        ),
    ),
)
HEARTBEAT_SECONDS = min(
    300,
    max(
        10,
        min(
            int(
                os.environ.get(
                    "MEDIA_PROCESSING_HEARTBEAT_SECONDS",
                    "30",
                )
            ),
            max(
                10,
                LEASE_SECONDS // 2,
            ),
        ),
    ),
)
ACTIVE_JOB_ID = None
WORKER_ID = os.environ.get(
    "MEDIA_PROCESSING_WORKER_ID",
    f"media-processor:{socket.gethostname()}",
)
FFMPEG = os.environ.get("FFMPEG_BIN", "/usr/bin/ffmpeg")
FFPROBE = os.environ.get("FFPROBE_BIN", "/usr/bin/ffprobe")
GENERATOR_NAME = "wakilisha-media-processor"
PROFILE_GENERATOR_VERSION = "m2-v1"
AUDIO_PUBLICATION_PROFILE_GENERATOR_VERSION = "phase6a-m2-v1"
VIDEO_ADAPTIVE_PROFILE_GENERATOR_VERSION = "phase7b-v4a-v1"
PUBLIC_MEDIA_ORIGIN = "https://media.wakilisha.africa"


def log(message, **fields):
    payload = {
        "time": time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime(),
        ),
        "message": message,
        **fields,
    }
    print(
        json.dumps(
            payload,
            separators=(",", ":"),
            sort_keys=True,
        ),
        flush=True,
    )


def require_runtime():
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
        )

    if not Path(FFMPEG).is_file():
        raise RuntimeError(
            f"FFmpeg is missing at {FFMPEG}."
        )

    if not Path(FFPROBE).is_file():
        raise RuntimeError(
            f"FFprobe is missing at {FFPROBE}."
        )

    MEDIA_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )
    PROCESSING_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )


def rpc(name, payload):
    body = json.dumps(
        payload,
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
        raw = exc.read().decode(
            "utf-8",
            errors="replace",
        )
        if exc.code >= 500:
            raise RetryableProcessingError(
                f"RPC {name} HTTP {exc.code}: {raw}"
            ) from exc
        raise TerminalProcessingError(
            f"RPC {name} HTTP {exc.code}: {raw}"
        ) from exc
    except (
        urllib.error.URLError,
        TimeoutError,
        ConnectionError,
    ) as exc:
        raise RetryableProcessingError(
            f"RPC {name} transport failure: {exc}"
        ) from exc

    if not raw:
        return None

    return json.loads(
        raw.decode("utf-8")
    )


def renew_active_lease():
    if ACTIVE_JOB_ID is None:
        return

    rpc(
        "renew_media_processing_lease_v1",
        {
            "p_job_id":
                ACTIVE_JOB_ID,
            "p_worker_id":
                WORKER_ID,
            "p_lease_seconds":
                LEASE_SECONDS,
        },
    )


def terminate_process(process):
    if process.poll() is not None:
        return

    process.terminate()

    try:
        process.communicate(
            timeout=10,
        )
    except subprocess.TimeoutExpired:
        process.kill()
        process.communicate()


def run_process(
    command,
    *,
    capture_output=True,
    terminal_on_failure=False,
):
    process = subprocess.Popen(
        command,
        stdin=subprocess.DEVNULL,
        stdout=(
            subprocess.PIPE
            if capture_output
            else subprocess.DEVNULL
        ),
        stderr=subprocess.PIPE,
    )

    while True:
        try:
            stdout, stderr = process.communicate(
                timeout=HEARTBEAT_SECONDS,
            )
            break
        except subprocess.TimeoutExpired:
            try:
                renew_active_lease()
            except Exception as exc:
                terminate_process(
                    process
                )
                raise RetryableProcessingError(
                    f"Processing lease renewal failed: {exc}"
                ) from exc

    if process.returncode != 0:
        detail = stderr.decode(
            "utf-8",
            errors="replace",
        )[-4000:]

        error_class = (
            TerminalProcessingError
            if terminal_on_failure
            else RetryableProcessingError
        )

        raise error_class(
            f"Processor command failed with exit {process.returncode}: {detail}"
        )

    return stdout


def sha256_file(path):
    digest = hashlib.sha256()
    byte_size = 0

    with path.open("rb") as handle:
        while True:
            chunk = handle.read(
                1024 * 1024
            )
            if not chunk:
                break
            digest.update(chunk)
            byte_size += len(chunk)

    return digest.hexdigest(), byte_size


def safe_relative_path(value, required_prefix):
    if not isinstance(value, str):
        raise TerminalProcessingError(
            "Storage path is missing."
        )

    relative = Path(value)

    if (
        relative.is_absolute()
        or ".." in relative.parts
        or not value.startswith(required_prefix)
    ):
        raise TerminalProcessingError(
            f"Unsafe storage path: {value}"
        )

    return relative


def source_path_from_job(payload):
    relative = safe_relative_path(
        payload.get("source_storage_path"),
        "masters/",
    )

    path = (
        MEDIA_ROOT
        / relative
    ).resolve()

    try:
        path.relative_to(MEDIA_ROOT)
    except ValueError as exc:
        raise TerminalProcessingError(
            "Source escaped Media root."
        ) from exc

    if not path.is_file():
        raise TerminalProcessingError(
            "Verified source master is missing from disk."
        )

    actual_sha, actual_size = sha256_file(
        path
    )

    expected_sha = payload.get(
        "source_sha256"
    )
    expected_size = int(
        payload.get(
            "source_byte_size",
            -1,
        )
    )

    if (
        actual_sha != expected_sha
        or actual_size != expected_size
    ):
        raise TerminalProcessingError(
            "Protected source master checksum or byte size changed."
        )

    return path


def probe_media(source):
    raw = run_process(
        [
            FFPROBE,
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            str(source),
        ],
        terminal_on_failure=True,
    )

    try:
        return json.loads(
            raw.decode("utf-8")
        )
    except json.JSONDecodeError as exc:
        raise TerminalProcessingError(
            "FFprobe returned invalid JSON."
        ) from exc


def duration_seconds(probe):
    value = (
        probe.get("format", {})
        .get("duration")
    )

    try:
        return float(value)
    except (
        TypeError,
        ValueError,
    ):
        return None


def source_metadata(probe):
    metadata = {
        "duration_seconds":
            duration_seconds(probe),
        "format_name":
            probe.get("format", {}).get(
                "format_name"
            ),
        "format_bit_rate":
            probe.get("format", {}).get(
                "bit_rate"
            ),
        "streams": [],
    }

    for stream in probe.get(
        "streams",
        [],
    ):
        metadata["streams"].append(
            {
                "index": stream.get("index"),
                "codec_type":
                    stream.get("codec_type"),
                "codec_name":
                    stream.get("codec_name"),
                "sample_rate":
                    stream.get("sample_rate"),
                "channels":
                    stream.get("channels"),
                "width":
                    stream.get("width"),
                "height":
                    stream.get("height"),
                "bit_rate":
                    stream.get("bit_rate"),
            }
        )

    return metadata


def deterministic_paths(payload, role, extension):
    asset_id = str(
        uuid.UUID(payload["asset_id"])
    )
    revision_id = str(
        uuid.UUID(
            payload["asset_revision_id"]
        )
    )
    source_id = str(
        uuid.UUID(
            payload["source_file_object_id"]
        )
    )
    profile = payload["profile_version"]

    protected_relative = Path(
        "derived-objects"
    ) / asset_id / revision_id / profile / source_id / (
        f"{role}.{extension}"
    )

    public_relative = Path(
        "derivatives"
    ) / asset_id / revision_id / profile / source_id / (
        f"{role}.{extension}"
    )

    return (
        protected_relative,
        public_relative,
    )


def copy_to_immutable_target(
    staging,
    protected_relative,
):
    target = MEDIA_ROOT / protected_relative
    target.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if target.exists():
        if not target.is_file():
            raise TerminalProcessingError(
                f"Immutable target is not a file: {target}"
            )
        return target

    assembling = (
        target.parent
        / f".{target.name}.assembling-{uuid.uuid4().hex}.tmp"
    )

    try:
        with staging.open("rb") as source:
            with assembling.open("xb") as destination:
                shutil.copyfileobj(
                    source,
                    destination,
                    length=1024 * 1024,
                )
                destination.flush()
                os.fsync(
                    destination.fileno()
                )

        os.chmod(
            assembling,
            0o640,
        )

        try:
            os.link(
                assembling,
                target,
            )
        except FileExistsError:
            pass

        if not target.is_file():
            raise TerminalProcessingError(
                "Immutable derivative activation failed."
            )

        directory_fd = os.open(
            target.parent,
            os.O_DIRECTORY,
        )
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)

        return target
    finally:
        assembling.unlink(
            missing_ok=True
        )


def public_delivery_link(
    protected_relative,
    public_relative,
):
    protected = (
        MEDIA_ROOT
        / protected_relative
    ).resolve()
    public = (
        MEDIA_ROOT
        / public_relative
    )

    public.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if public.is_symlink():
        resolved = public.resolve()
        if resolved != protected:
            raise TerminalProcessingError(
                "Public derivative symlink points to different immutable bytes."
            )
        return

    if public.exists():
        raise TerminalProcessingError(
            "Public derivative path already exists and is not the expected symlink."
        )

    relative_target = os.path.relpath(
        protected,
        start=public.parent,
    )

    os.symlink(
        relative_target,
        public,
    )

    directory_fd = os.open(
        public.parent,
        os.O_DIRECTORY,
    )
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)


def staging_path(job_id, role, extension):
    directory = (
        PROCESSING_ROOT
        / job_id
    )
    directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    return (
        directory
        / f"{role}.tmp.{extension}"
    )


def audio_preview(
    source,
    destination,
):
    destination.unlink(
        missing_ok=True
    )

    run_process(
        [
            FFMPEG,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-map_metadata",
            "-1",
            "-vn",
            "-t",
            "30",
            "-ac",
            "2",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "128k",
            "-write_xing",
            "0",
            "-fflags",
            "+bitexact",
            "-flags:a",
            "+bitexact",
            str(destination),
        ],
        capture_output=False,
    )


def audio_delivery(
    source,
    destination,
):
    destination.unlink(
        missing_ok=True
    )

    run_process(
        [
            FFMPEG,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-map_metadata",
            "-1",
            "-vn",
            "-ac",
            "2",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "128k",
            "-write_xing",
            "0",
            "-fflags",
            "+bitexact",
            "-flags:a",
            "+bitexact",
            str(destination),
        ],
        capture_output=False,
    )


def waveform_data(
    source,
    destination,
    probe,
):
    pcm_path = destination.with_name(
        destination.name
        + ".pcm"
    )

    pcm_path.unlink(
        missing_ok=True
    )

    try:
        run_process(
            [
                FFMPEG,
                "-nostdin",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(source),
                "-map_metadata",
                "-1",
                "-vn",
                "-ac",
                "1",
                "-ar",
                "8000",
                "-f",
                "s16le",
                str(pcm_path),
            ],
            capture_output=False,
        )

        pcm_bytes = (
            pcm_path.stat().st_size
        )

        if (
            pcm_bytes < 2
            or pcm_bytes % 2 != 0
        ):
            raise TerminalProcessingError(
                "Waveform PCM output is empty or misaligned."
            )

        total = pcm_bytes // 2
        target_bins = 1000
        bins = min(
            target_bins,
            total,
        )
        peaks = []

        with pcm_path.open(
            "rb"
        ) as handle:
            for index in range(bins):
                start = (
                    index * total
                ) // bins
                end = (
                    (index + 1) * total
                ) // bins
                sample_count = (
                    end - start
                )

                handle.seek(
                    start * 2
                )

                raw_block = handle.read(
                    sample_count * 2
                )

                if len(raw_block) != (
                    sample_count * 2
                ):
                    raise TerminalProcessingError(
                        "Waveform PCM output changed while being read."
                    )

                block = array.array(
                    "h"
                )
                block.frombytes(
                    raw_block
                )

                if sys.byteorder != "little":
                    block.byteswap()

                peak = max(
                    abs(value)
                    for value in block
                )

                peaks.append(
                    round(
                        min(
                            1.0,
                            peak / 32768.0,
                        ),
                        6,
                    )
                )

        payload = {
            "version": 1,
            "duration_seconds":
                duration_seconds(probe),
            "sample_rate": 8000,
            "channels": 1,
            "peak_count": len(peaks),
            "peaks": peaks,
        }

        destination.unlink(
            missing_ok=True
        )
        destination.write_text(
            json.dumps(
                payload,
                separators=(",", ":"),
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )

        with destination.open(
            "rb"
        ) as handle:
            os.fsync(
                handle.fileno()
            )
    finally:
        pcm_path.unlink(
            missing_ok=True
        )


def video_transcode(
    source,
    destination,
):
    destination.unlink(
        missing_ok=True
    )

    run_process(
        [
            FFMPEG,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-map_metadata",
            "-1",
            "-vf",
            "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            "-fflags",
            "+bitexact",
            str(destination),
        ],
        capture_output=False,
    )



def video_hls_variant(
    source,
    playlist_destination,
    media_destination,
    final_media_filename,
    width,
    height,
    video_bitrate_kbps,
    audio_bitrate_kbps,
):
    playlist_destination.unlink(
        missing_ok=True
    )
    media_destination.unlink(
        missing_ok=True
    )

    run_process(
        [
            FFMPEG,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-map_metadata",
            "-1",
            "-vf",
            (
                "scale="
                f"w='min({width},iw)':"
                f"h='min({height},ih)':"
                "force_original_aspect_ratio=decrease:"
                "force_divisible_by=2"
            ),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-b:v",
            f"{video_bitrate_kbps}k",
            "-maxrate",
            f"{video_bitrate_kbps}k",
            "-bufsize",
            f"{video_bitrate_kbps * 2}k",
            "-pix_fmt",
            "yuv420p",
            "-threads",
            "1",
            "-c:a",
            "aac",
            "-b:a",
            f"{audio_bitrate_kbps}k",
            "-force_key_frames",
            "expr:gte(t,n_forced*4)",
            "-fflags",
            "+bitexact",
            "-flags:v",
            "+bitexact",
            "-flags:a",
            "+bitexact",
            "-muxdelay",
            "0",
            "-muxpreload",
            "0",
            "-hls_time",
            "4",
            "-hls_playlist_type",
            "vod",
            "-hls_flags",
            "independent_segments+single_file",
            "-hls_segment_filename",
            str(media_destination),
            str(playlist_destination),
        ],
        capture_output=False,
    )

    if (
        not playlist_destination.is_file()
        or not media_destination.is_file()
    ):
        raise TerminalProcessingError(
            "Adaptive Video HLS rendition is incomplete."
        )

    playlist = playlist_destination.read_text(
        encoding="utf-8"
    )

    if (
        "#EXT-X-BYTERANGE:" not in playlist
        or media_destination.name not in playlist
    ):
        raise TerminalProcessingError(
            "Adaptive Video HLS playlist lacks single-file byte ranges."
        )

    playlist = playlist.replace(
        media_destination.name,
        final_media_filename,
    )

    if ".tmp." in playlist:
        raise TerminalProcessingError(
            "Adaptive Video HLS playlist leaked a staging filename."
        )

    playlist_destination.write_text(
        playlist,
        encoding="utf-8",
    )

    with playlist_destination.open(
        "rb"
    ) as handle:
        os.fsync(
            handle.fileno()
        )


def write_video_hls_master(destination):
    destination.unlink(
        missing_ok=True
    )

    destination.write_text(
        "\n".join(
            [
                "#EXTM3U",
                "#EXT-X-VERSION:6",
                "#EXT-X-STREAM-INF:BANDWIDTH=1000000",
                "video_hls_360p_playlist.m3u8",
                "#EXT-X-STREAM-INF:BANDWIDTH=2800000",
                "video_hls_720p_playlist.m3u8",
                "",
            ]
        ),
        encoding="utf-8",
    )

    with destination.open(
        "rb"
    ) as handle:
        os.fsync(
            handle.fileno()
        )

def jpeg_frame(
    source,
    destination,
    width,
):
    destination.unlink(
        missing_ok=True
    )

    run_process(
        [
            FFMPEG,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            "1",
            "-i",
            str(source),
            "-map_metadata",
            "-1",
            "-frames:v",
            "1",
            "-vf",
            f"scale={width}:-2",
            "-q:v",
            "3",
            str(destination),
        ],
        capture_output=False,
    )


def output_contract(
    payload,
    probe,
    role,
    extension,
    mime_type,
    transformation_spec,
    producer,
    generator_version=PROFILE_GENERATOR_VERSION,
):
    protected_relative, public_relative = (
        deterministic_paths(
            payload,
            role,
            extension,
        )
    )

    canonical = (
        MEDIA_ROOT
        / protected_relative
    )

    stage = staging_path(
        payload["_job_id"],
        role,
        extension,
    )
    producer(stage)

    if not stage.is_file():
        raise TerminalProcessingError(
            f"Processor did not create {role}."
        )

    staged_sha256, staged_byte_size = sha256_file(
        stage
    )

    if staged_byte_size < 1:
        raise TerminalProcessingError(
            f"Generated derivative {role} is empty."
        )

    if canonical.exists():
        if not canonical.is_file():
            raise TerminalProcessingError(
                f"Immutable derivative target is not a file: {canonical}"
            )

        canonical_sha256, canonical_byte_size = sha256_file(
            canonical
        )

        if (
            canonical_sha256 != staged_sha256
            or canonical_byte_size != staged_byte_size
        ):
            raise TerminalProcessingError(
                "Immutable derivative path collision has different bytes."
            )
    else:
        canonical = copy_to_immutable_target(
            stage,
            protected_relative,
        )

        canonical_sha256, canonical_byte_size = sha256_file(
            canonical
        )

        if (
            canonical_sha256 != staged_sha256
            or canonical_byte_size != staged_byte_size
        ):
            raise TerminalProcessingError(
                "Immutable derivative activation changed generated bytes."
            )

    stage.unlink(
        missing_ok=True
    )

    sha256 = staged_sha256
    byte_size = staged_byte_size

    if byte_size < 1:
        raise TerminalProcessingError(
            f"Generated derivative {role} is empty."
        )

    delivery_url = (
        PUBLIC_MEDIA_ORIGIN
        + "/"
        + public_relative.as_posix()
    )

    file_payload = {
        "storage_provider":
            "lightsail_media",
        "storage_namespace":
            "lightsail-media",
        "storage_path":
            protected_relative.as_posix(),
        "delivery_url":
            delivery_url,
        "original_filename":
            canonical.name,
        "mime_type":
            mime_type,
        "sha256":
            sha256,
        "byte_size":
            byte_size,
        "technical_metadata": {
            "processing_profile":
                payload["profile_version"],
            "source_file_object_id":
                payload["source_file_object_id"],
            "source_probe":
                source_metadata(probe),
        },
    }

    return {
        "variant_role":
            role,
        "file":
            file_payload,
        "transformation_spec":
            transformation_spec,
        "technical_metadata": {
            "processing_profile":
                payload["profile_version"],
            "source_file_object_id":
                payload["source_file_object_id"],
        },
        "generator_name":
            GENERATOR_NAME,
        "generator_version":
            generator_version,
        "_protected_relative":
            protected_relative.as_posix(),
        "_public_relative":
            public_relative.as_posix(),
    }


def build_outputs(job):
    payload = dict(
        job["input_payload"]
    )
    payload["_job_id"] = job["job_id"]

    source = source_path_from_job(
        payload
    )
    probe = probe_media(
        source
    )
    profile = payload.get(
        "profile_version"
    )

    if profile == "audio-v1":
        has_audio = any(
            stream.get("codec_type")
            == "audio"
            for stream in probe.get(
                "streams",
                [],
            )
        )

        if not has_audio:
            raise TerminalProcessingError(
                "Audio profile source has no audio stream."
            )

        preview = output_contract(
            payload,
            probe,
            "audio_preview",
            "mp3",
            "audio/mpeg",
            {
                "profile":
                    "audio-v1",
                "duration_seconds":
                    30,
                "codec":
                    "mp3",
                "bitrate_kbps":
                    128,
            },
            lambda stage:
                audio_preview(
                    source,
                    stage,
                ),
        )

        waveform = output_contract(
            payload,
            probe,
            "waveform_data",
            "json",
            "application/json",
            {
                "profile":
                    "audio-v1",
                "kind":
                    "peak_envelope",
                "sample_rate":
                    8000,
                "peak_count":
                    1000,
            },
            lambda stage:
                waveform_data(
                    source,
                    stage,
                    probe,
                ),
        )

        return [
            preview,
            waveform,
        ]

    if profile == "audio-publication-v1":
        has_audio = any(
            stream.get("codec_type")
            == "audio"
            for stream in probe.get(
                "streams",
                [],
            )
        )

        if not has_audio:
            raise TerminalProcessingError(
                "Audio publication profile source has no audio stream."
            )

        delivery = output_contract(
            payload,
            probe,
            "audio_delivery",
            "mp3",
            "audio/mpeg",
            {
                "profile":
                    "audio-publication-v1",
                "full_length":
                    True,
                "codec":
                    "mp3",
                "bitrate_kbps":
                    128,
                "channels":
                    2,
            },
            lambda stage:
                audio_delivery(
                    source,
                    stage,
                ),
            generator_version=(
                AUDIO_PUBLICATION_PROFILE_GENERATOR_VERSION
            ),
        )

        return [
            delivery,
        ]

    if profile == "video-v1":
        has_video = any(
            stream.get("codec_type")
            == "video"
            for stream in probe.get(
                "streams",
                [],
            )
        )

        if not has_video:
            raise TerminalProcessingError(
                "Video profile source has no video stream."
            )

        transcode = output_contract(
            payload,
            probe,
            "video_transcode",
            "mp4",
            "video/mp4",
            {
                "profile":
                    "video-v1",
                "container":
                    "mp4",
                "video_codec":
                    "h264",
                "audio_codec":
                    "aac",
                "max_width":
                    1280,
                "max_height":
                    720,
                "faststart":
                    True,
            },
            lambda stage:
                video_transcode(
                    source,
                    stage,
                ),
        )

        poster = output_contract(
            payload,
            probe,
            "poster_frame",
            "jpg",
            "image/jpeg",
            {
                "profile":
                    "video-v1",
                "seek_seconds":
                    1,
                "width":
                    1280,
            },
            lambda stage:
                jpeg_frame(
                    source,
                    stage,
                    1280,
                ),
        )

        thumbnail = output_contract(
            payload,
            probe,
            "thumbnail",
            "jpg",
            "image/jpeg",
            {
                "profile":
                    "video-v1",
                "seek_seconds":
                    1,
                "width":
                    320,
            },
            lambda stage:
                jpeg_frame(
                    source,
                    stage,
                    320,
                ),
        )

        return [
            transcode,
            poster,
            thumbnail,
        ]


    if profile == "video-adaptive-v1":
        has_video = any(
            stream.get("codec_type")
            == "video"
            for stream in probe.get(
                "streams",
                [],
            )
        )

        if not has_video:
            raise TerminalProcessingError(
                "Adaptive Video profile source has no video stream."
            )

        media_360_stage = staging_path(
            payload["_job_id"],
            "video_hls_360p_media",
            "ts",
        )

        playlist_360 = output_contract(
            payload,
            probe,
            "video_hls_360p_playlist",
            "m3u8",
            "application/vnd.apple.mpegurl",
            {
                "profile":
                    "video-adaptive-v1",
                "kind":
                    "media_playlist",
                "hls_version":
                    6,
                "segment_seconds":
                    4,
                "segment_mode":
                    "single_file_byte_range",
                "max_width":
                    640,
                "max_height":
                    360,
                "video_bitrate_kbps":
                    800,
                "audio_bitrate_kbps":
                    96,
            },
            lambda stage:
                video_hls_variant(
                    source,
                    stage,
                    media_360_stage,
                    "video_hls_360p_media.ts",
                    640,
                    360,
                    800,
                    96,
                ),
            generator_version=(
                VIDEO_ADAPTIVE_PROFILE_GENERATOR_VERSION
            ),
        )

        media_360 = output_contract(
            payload,
            probe,
            "video_hls_360p_media",
            "ts",
            "video/mp2t",
            {
                "profile":
                    "video-adaptive-v1",
                "kind":
                    "media",
                "container":
                    "mpegts",
                "hls_version":
                    6,
                "segment_seconds":
                    4,
                "segment_mode":
                    "single_file_byte_range",
                "max_width":
                    640,
                "max_height":
                    360,
                "video_codec":
                    "h264",
                "audio_codec":
                    "aac",
                "video_bitrate_kbps":
                    800,
                "audio_bitrate_kbps":
                    96,
            },
            lambda stage: None,
            generator_version=(
                VIDEO_ADAPTIVE_PROFILE_GENERATOR_VERSION
            ),
        )

        media_720_stage = staging_path(
            payload["_job_id"],
            "video_hls_720p_media",
            "ts",
        )

        playlist_720 = output_contract(
            payload,
            probe,
            "video_hls_720p_playlist",
            "m3u8",
            "application/vnd.apple.mpegurl",
            {
                "profile":
                    "video-adaptive-v1",
                "kind":
                    "media_playlist",
                "hls_version":
                    6,
                "segment_seconds":
                    4,
                "segment_mode":
                    "single_file_byte_range",
                "max_width":
                    1280,
                "max_height":
                    720,
                "video_bitrate_kbps":
                    2500,
                "audio_bitrate_kbps":
                    128,
            },
            lambda stage:
                video_hls_variant(
                    source,
                    stage,
                    media_720_stage,
                    "video_hls_720p_media.ts",
                    1280,
                    720,
                    2500,
                    128,
                ),
            generator_version=(
                VIDEO_ADAPTIVE_PROFILE_GENERATOR_VERSION
            ),
        )

        media_720 = output_contract(
            payload,
            probe,
            "video_hls_720p_media",
            "ts",
            "video/mp2t",
            {
                "profile":
                    "video-adaptive-v1",
                "kind":
                    "media",
                "container":
                    "mpegts",
                "hls_version":
                    6,
                "segment_seconds":
                    4,
                "segment_mode":
                    "single_file_byte_range",
                "max_width":
                    1280,
                "max_height":
                    720,
                "video_codec":
                    "h264",
                "audio_codec":
                    "aac",
                "video_bitrate_kbps":
                    2500,
                "audio_bitrate_kbps":
                    128,
            },
            lambda stage: None,
            generator_version=(
                VIDEO_ADAPTIVE_PROFILE_GENERATOR_VERSION
            ),
        )

        master = output_contract(
            payload,
            probe,
            "video_hls_master",
            "m3u8",
            "application/vnd.apple.mpegurl",
            {
                "profile":
                    "video-adaptive-v1",
                "kind":
                    "master_playlist",
                "hls_version":
                    6,
                "rendition_count":
                    2,
                "segment_seconds":
                    4,
                "segment_mode":
                    "single_file_byte_range",
            },
            write_video_hls_master,
            generator_version=(
                VIDEO_ADAPTIVE_PROFILE_GENERATOR_VERSION
            ),
        )

        return [
            master,
            playlist_360,
            media_360,
            playlist_720,
            media_720,
        ]

    raise TerminalProcessingError(
        f"Unsupported processing profile: {profile}"
    )


def public_outputs(outputs):
    return [
        {
            key: value
            for key, value
            in output.items()
            if not key.startswith("_")
        }
        for output in outputs
    ]


def activate_public_outputs(outputs):
    for output in outputs:
        public_delivery_link(
            Path(
                output[
                    "_protected_relative"
                ]
            ),
            Path(
                output[
                    "_public_relative"
                ]
            ),
        )


def cleanup_job_staging(job_id):
    directory = (
        PROCESSING_ROOT
        / job_id
    )

    if directory.is_dir():
        shutil.rmtree(
            directory,
            ignore_errors=True,
        )


def cleanup_old_staging():
    cutoff = (
        time.time()
        - 24 * 60 * 60
    )

    if not PROCESSING_ROOT.is_dir():
        return

    for entry in PROCESSING_ROOT.iterdir():
        try:
            if (
                entry.is_dir()
                and entry.stat().st_mtime
                < cutoff
            ):
                shutil.rmtree(
                    entry,
                    ignore_errors=True,
                )
        except FileNotFoundError:
            continue


def process_job(job):
    global ACTIVE_JOB_ID

    job_id = job["job_id"]
    attempt = int(
        job["attempt_count"]
    )
    ACTIVE_JOB_ID = job_id

    log(
        "media_processing_job_started",
        job_id=job_id,
        attempt=attempt,
    )

    try:
        outputs = build_outputs(
            job
        )

        profile = job["input_payload"].get(
            "profile_version"
        )
        if profile in (
            "audio-publication-v1",
            "video-adaptive-v1",
        ):
            registration_rpc = (
                "register_media_processing_profile_outputs_v1"
            )
        else:
            registration_rpc = (
                "register_media_processing_outputs_v1"
            )

        registration = rpc(
            registration_rpc,
            {
                "p_job_id":
                    job_id,
                "p_worker_id":
                    WORKER_ID,
                "p_outputs":
                    public_outputs(
                        outputs
                    ),
            },
        )

        activate_public_outputs(
            outputs
        )

        completion = rpc(
            "complete_media_processing_job_v1",
            {
                "p_job_id":
                    job_id,
                "p_worker_id":
                    WORKER_ID,
                "p_result": {
                    "registration":
                        registration,
                    "public_derivatives": [
                        output[
                            "_public_relative"
                        ]
                        for output
                        in outputs
                    ],
                },
            },
        )

        cleanup_job_staging(
            job_id
        )

        log(
            "media_processing_job_succeeded",
            job_id=job_id,
            completion=completion,
        )
    except TerminalProcessingError as exc:
        error = str(exc)[-4000:]
        log(
            "media_processing_job_terminal_failure",
            job_id=job_id,
            error=error,
        )

        try:
            rpc(
                "fail_media_processing_job_v1",
                {
                    "p_job_id":
                        job_id,
                    "p_worker_id":
                        WORKER_ID,
                    "p_error":
                        error,
                    "p_retryable":
                        False,
                    "p_retry_delay_seconds":
                        60,
                },
            )
        except Exception as fail_exc:
            log(
                "media_processing_terminal_failure_record_failed",
                job_id=job_id,
                error=str(fail_exc)[-2000:],
            )
    except Exception as exc:
        error = str(exc)[-4000:]
        delay = min(
            600,
            max(
                30,
                attempt * 60,
            ),
        )

        log(
            "media_processing_job_retryable_failure",
            job_id=job_id,
            retry_delay_seconds=delay,
            error=error,
        )

        try:
            rpc(
                "fail_media_processing_job_v1",
                {
                    "p_job_id":
                        job_id,
                    "p_worker_id":
                        WORKER_ID,
                    "p_error":
                        error,
                    "p_retryable":
                        True,
                    "p_retry_delay_seconds":
                        delay,
                },
            )
        except Exception as fail_exc:
            log(
                "media_processing_retry_record_failed",
                job_id=job_id,
                error=str(fail_exc)[-2000:],
            )
    finally:
        ACTIVE_JOB_ID = None


def loop():
    require_runtime()
    cleanup_old_staging()

    log(
        "media_processor_started",
        worker_id=WORKER_ID,
        poll_seconds=POLL_SECONDS,
        lease_seconds=LEASE_SECONDS,
        heartbeat_seconds=HEARTBEAT_SECONDS,
    )

    last_cleanup = time.time()

    while True:
        try:
            recovered = rpc(
                "recover_expired_media_processing_jobs_v1",
                {
                    "p_limit": 10,
                    "p_retry_delay_seconds": 30,
                },
            )

            if recovered:
                log(
                    "media_processing_expired_leases_recovered",
                    recovered=recovered,
                )

            jobs = rpc(
                "claim_media_processing_jobs_v1",
                {
                    "p_worker_id":
                        WORKER_ID,
                    "p_limit":
                        1,
                    "p_lease_seconds":
                        LEASE_SECONDS,
                },
            )

            if jobs:
                process_job(
                    jobs[0]
                )
            else:
                time.sleep(
                    POLL_SECONDS
                )

            if (
                time.time()
                - last_cleanup
                > 3600
            ):
                cleanup_old_staging()
                last_cleanup = time.time()
        except KeyboardInterrupt:
            raise
        except Exception as exc:
            log(
                "media_processor_loop_error",
                error=str(exc)[-4000:],
            )
            time.sleep(
                POLL_SECONDS
            )


if __name__ == "__main__":
    loop()
