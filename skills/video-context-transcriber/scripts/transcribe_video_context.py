#!/usr/bin/env python3
from __future__ import annotations

import argparse
import bisect
import datetime as dt
import hashlib
import json
import math
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import time
import venv
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
REQUIREMENTS_FILE = SCRIPT_DIR / "requirements.txt"
MIN_PYTHON = (3, 9)


def default_cache_dir() -> Path:
    override = os.environ.get("VIDEO_CONTEXT_TRANSCRIBER_CACHE")
    if override:
        return Path(override).expanduser()
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        return base / "video-context-transcriber"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Caches" / "video-context-transcriber"
    base = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache"))
    return base / "video-context-transcriber"


CACHE_DIR = default_cache_dir()
REQUIREMENTS_HASH = hashlib.sha256(REQUIREMENTS_FILE.read_bytes()).hexdigest()[:12]
VENV_DIR = CACHE_DIR / "envs" / f"py{sys.version_info.major}{sys.version_info.minor}-{REQUIREMENTS_HASH}"
MODEL_DIR = CACHE_DIR / "models"
MANAGED_CHILD_ENV = "VIDEO_CONTEXT_TRANSCRIBER_MANAGED_CHILD"
REQUIREMENTS = [
    line.strip()
    for line in REQUIREMENTS_FILE.read_text(encoding="utf-8").splitlines()
    if line.strip() and not line.lstrip().startswith("#")
]
FASTER_WHISPER_VERSION = next(
    requirement.split("==", 1)[1]
    for requirement in REQUIREMENTS
    if requirement.startswith("faster-whisper==")
)

# (minimum seconds between frames, maximum frames) for silent / visual-only sampling.
# "medium" matches the video-to-md CLI: up to 20 frames, roughly five seconds apart.
VISUAL_DETAIL_SAMPLING = {
    "low": (10.0, 10),
    "medium": (5.0, 20),
    "high": (1.0, 240),
}


class ManagedRunComplete(Exception):
    def __init__(self, returncode: int):
        self.returncode = returncode


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str


@dataclass
class TranscriptionResult:
    model_name: str
    language: str | None
    language_probability: float | None
    duration_seconds: float | None
    segments: list[TranscriptSegment]


@dataclass
class SegmentImage:
    index: int
    start: float
    end: float
    capture_time: float
    text: str
    filename: str


@dataclass
class OutputPaths:
    output_dir: Path
    transcript: Path
    images_dir: Path
    manifest: Path
    llm_context: Path


def positive_float(value: str) -> float:
    number = float(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return number


def positive_int(value: str) -> int:
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return number


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create an LLM-ready transcript/frame context bundle from local media."
    )
    parser.add_argument("video_path", nargs="?", help="Local video or audio path.")
    parser.add_argument(
        "--output-dir",
        help="Directory for <stem>.md, <stem>_images/ and <stem>_llm_context.md. "
        "Default: the source file's folder.",
    )
    parser.add_argument("--model", default="small", help="Whisper model name or local model path.")
    parser.add_argument("--language", help="Optional language code such as en, hi, or fr.")
    parser.add_argument("--initial-prompt", help="Vocabulary hints for Whisper.")
    parser.add_argument(
        "--no-vad-filter",
        action="store_true",
        help="Disable voice activity detection filtering.",
    )
    parser.add_argument("--device", default="cpu", help="faster-whisper device. Default: cpu.")
    parser.add_argument("--compute-type", default="int8", help="faster-whisper compute type.")
    decoding_group = parser.add_mutually_exclusive_group()
    decoding_group.add_argument(
        "--beam-size",
        type=positive_int,
        default=5,
        help="Beam size used during decoding. Default: 5.",
    )
    decoding_group.add_argument(
        "--fast",
        action="store_true",
        help="Use faster greedy decoding (equivalent to --beam-size 1).",
    )
    parser.add_argument(
        "--download-root",
        default=str(MODEL_DIR),
        help=f"Whisper model cache directory. Default: {MODEL_DIR}",
    )
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing outputs.")
    parser.add_argument("--visual-only", action="store_true", help="Skip transcription; sample frames.")
    parser.add_argument(
        "--visual-detail",
        choices=sorted(VISUAL_DETAIL_SAMPLING),
        default="medium",
        help="Frame sampling density for silent/visual-only video. Default: medium.",
    )
    parser.add_argument(
        "--visual-frame-interval",
        type=positive_float,
        help="Minimum seconds between sampled frames.",
    )
    parser.add_argument("--visual-max-frames", type=positive_int, help="Maximum sampled frames.")
    parser.add_argument(
        "--no-auto-install",
        action="store_true",
        help="Fail instead of creating a managed venv and installing Python dependencies.",
    )
    parser.add_argument(
        "--doctor",
        action="store_true",
        help="Print platform and dependency diagnostics without processing media.",
    )
    return parser.parse_args(argv)


def fail(message: str) -> int:
    print(f"error: {message}", file=sys.stderr)
    return 1


def log(message: str) -> None:
    print(message, file=sys.stderr)


def format_timestamp(seconds: float) -> str:
    total_milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(total_milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d}.{milliseconds:03d}"


def format_filename_timestamp(seconds: float) -> str:
    return format_timestamp(seconds).replace(":", "-")


def iso_now() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def resolve_output_paths(video_path: Path, output_dir_arg: str | None) -> OutputPaths:
    output_dir = Path(output_dir_arg).expanduser().resolve() if output_dir_arg else video_path.parent
    images_dir = output_dir / f"{video_path.stem}_images"
    return OutputPaths(
        output_dir=output_dir,
        transcript=output_dir / f"{video_path.stem}.md",
        images_dir=images_dir,
        manifest=images_dir / "manifest.json",
        llm_context=output_dir / f"{video_path.stem}_llm_context.md",
    )


def venv_python() -> Path:
    return VENV_DIR / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def venv_has_faster_whisper(python_path: Path) -> bool:
    if not python_path.exists():
        return False
    completed = subprocess.run(
        [
            str(python_path),
            "-c",
            "import importlib.metadata; "
            f"raise SystemExit(importlib.metadata.version('faster-whisper') != "
            f"{FASTER_WHISPER_VERSION!r})",
        ],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return completed.returncode == 0


def media_tool_error() -> str | None:
    missing = [name for name in ("ffmpeg", "ffprobe") if shutil.which(name) is None]
    if not missing:
        return None
    install_hint = {
        "Darwin": "Install with: brew install ffmpeg",
        "Windows": "Install with: winget install Gyan.FFmpeg",
        "Linux": "Install with your package manager, e.g. apt install ffmpeg",
    }.get(platform.system(), "Install FFmpeg and put ffmpeg and ffprobe on PATH")
    return f"missing required command(s): {', '.join(missing)}. {install_hint}"


def python_error() -> str | None:
    if sys.version_info[:2] < MIN_PYTHON:
        required = ".".join(map(str, MIN_PYTHON))
        return f"Python {required}+ is required; found {platform.python_version()}"
    return None


def diagnostics() -> dict[str, Any]:
    python_issue = python_error()
    media_issue = media_tool_error()
    uv_path = shutil.which("uv")
    return {
        "ok": not python_issue and not media_issue,
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "python": platform.python_version(),
        "python_ok": python_issue is None,
        "ffmpeg": shutil.which("ffmpeg"),
        "ffprobe": shutil.which("ffprobe"),
        "uv": uv_path,
        "dependency_installer": "uv" if uv_path else "venv+pip",
        "cache_dir": str(CACHE_DIR),
        "python_env": str(VENV_DIR),
        "managed_environment_ready": venv_has_faster_whisper(venv_python()),
        "requirements": REQUIREMENTS,
        "issues": [issue for issue in (python_issue, media_issue) if issue],
    }


@contextmanager
def environment_lock() -> Iterator[None]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    lock_path = CACHE_DIR / "environment.lock"
    with lock_path.open("a+b") as lock_file:
        if os.name == "nt":
            import msvcrt

            lock_file.seek(0)
            lock_file.write(b"\0")
            lock_file.flush()
            deadline = time.monotonic() + 600
            while True:
                try:
                    lock_file.seek(0)
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
                    break
                except OSError:
                    if time.monotonic() >= deadline:
                        raise RuntimeError("timed out waiting for dependency installation")
                    time.sleep(0.25)
        else:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            if os.name == "nt":
                lock_file.seek(0)
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def prepare_managed_environment() -> Path:
    python_path = venv_python()
    with environment_lock():
        uv_path = shutil.which("uv")
        if not python_path.exists():
            VENV_DIR.parent.mkdir(parents=True, exist_ok=True)
            if uv_path:
                subprocess.run(
                    [
                        uv_path,
                        "venv",
                        "--python",
                        sys.executable,
                        str(VENV_DIR),
                    ],
                    check=True,
                )
            else:
                venv.EnvBuilder(with_pip=True).create(VENV_DIR)
        if not venv_has_faster_whisper(python_path):
            if uv_path:
                subprocess.run(
                    [
                        uv_path,
                        "pip",
                        "install",
                        "--python",
                        str(python_path),
                        "-r",
                        str(REQUIREMENTS_FILE),
                    ],
                    check=True,
                )
            else:
                subprocess.run(
                    [str(python_path), "-m", "ensurepip", "--upgrade"],
                    check=True,
                )
                subprocess.run(
                    [
                        str(python_path),
                        "-m",
                        "pip",
                        "--disable-pip-version-check",
                        "install",
                        "--upgrade",
                        "pip>=23.3",
                    ],
                    check=True,
                )
                subprocess.run(
                    [
                        str(python_path),
                        "-m",
                        "pip",
                        "--disable-pip-version-check",
                        "install",
                        "--prefer-binary",
                        "-r",
                        str(REQUIREMENTS_FILE),
                    ],
                    check=True,
                )
    return python_path


def running_in_managed_environment() -> bool:
    # Compare venv prefixes, not interpreter paths: a venv's bin/python is usually a symlink
    # to the same base interpreter that launched this script, so resolved paths match.
    try:
        return Path(sys.prefix).resolve() == VENV_DIR.resolve()
    except OSError:
        return False


def ensure_faster_whisper(args: argparse.Namespace) -> Any:
    python_path = venv_python()
    if not running_in_managed_environment():
        if os.environ.get(MANAGED_CHILD_ENV):
            raise RuntimeError(f"managed environment did not activate: {VENV_DIR}")
        if args.no_auto_install and not venv_has_faster_whisper(python_path):
            raise RuntimeError(
                f"managed dependency environment is not ready: {VENV_DIR}; "
                "rerun without --no-auto-install"
            )
        if not args.no_auto_install:
            prepare_managed_environment()
        completed = subprocess.run(
            [str(python_path), str(Path(__file__).resolve()), *sys.argv[1:]],
            env={**os.environ, MANAGED_CHILD_ENV: "1"},
        )
        raise ManagedRunComplete(completed.returncode)

    # Xet downloads are less reliable on restricted networks; read at huggingface_hub import.
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError(f"managed environment is corrupt: {VENV_DIR}") from exc
    return WhisperModel


def probe_media(video_path: Path) -> dict[str, Any]:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type",
        "-of",
        "json",
        str(video_path),
    ]
    completed = subprocess.run(command, check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "ffprobe failed")
    data = json.loads(completed.stdout)
    streams = data.get("streams", [])
    return {
        "duration": float(data.get("format", {}).get("duration") or 0),
        "has_audio": any(stream.get("codec_type") == "audio" for stream in streams),
        "has_video": any(stream.get("codec_type") == "video" for stream in streams),
    }


def probe_video_frame_times(video_path: Path) -> list[float] | None:
    ffprobe_path = shutil.which("ffprobe")
    if ffprobe_path is None:
        return None
    completed = subprocess.run(
        [
            ffprobe_path,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "packet=pts_time,flags",
            "-of",
            "csv=p=0",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        return None
    frame_times: set[float] = set()
    for line in completed.stdout.splitlines():
        pts_time, _, flags = line.partition(",")
        if "D" in flags:
            continue
        try:
            frame_times.add(float(pts_time))
        except ValueError:
            continue
    return sorted(frame_times) or None


def normalize_segments(segments: Iterable[object]) -> list[TranscriptSegment]:
    normalized: list[TranscriptSegment] = []
    for segment in segments:
        text = str(getattr(segment, "text", "")).strip()
        if not text:
            continue
        normalized.append(
            TranscriptSegment(
                start=float(getattr(segment, "start", 0.0)),
                end=float(getattr(segment, "end", 0.0)),
                text=text,
            )
        )
    return normalized


def transcribe_video(args: argparse.Namespace, video_path: Path) -> TranscriptionResult:
    WhisperModel = ensure_faster_whisper(args)
    log(f"Loading model '{args.model}'...")
    try:
        model = WhisperModel(
            args.model,
            device=args.device,
            compute_type=args.compute_type,
            download_root=str(Path(args.download_root).expanduser().resolve()),
        )
    except Exception as exc:
        raise RuntimeError(
            "Unable to load the Whisper model. If this is the first run, check network access "
            "for the model download."
        ) from exc

    transcribe_kwargs: dict[str, Any] = {
        "beam_size": 1 if args.fast else args.beam_size,
        "vad_filter": not args.no_vad_filter,
        "word_timestamps": False,
    }
    if args.initial_prompt:
        transcribe_kwargs["initial_prompt"] = args.initial_prompt
    if args.language:
        transcribe_kwargs["language"] = args.language

    log(f"Transcribing '{video_path}'...")
    try:
        segments, info = model.transcribe(str(video_path), **transcribe_kwargs)
        normalized_segments = normalize_segments(segments)
    except Exception as exc:
        raise RuntimeError(f"Transcription failed for '{video_path}'.") from exc
    return TranscriptionResult(
        model_name=args.model,
        language=getattr(info, "language", None),
        language_probability=getattr(info, "language_probability", None),
        duration_seconds=getattr(info, "duration", None),
        segments=normalized_segments,
    )


def render_markdown(
    video_path: Path,
    result: TranscriptionResult,
    generated_at: str | None = None,
) -> str:
    generated_at = generated_at or iso_now()
    lines: list[str] = [
        f"# Transcript: {video_path.name}",
        "",
        f"- Source: `{video_path}`",
        f"- Generated: `{generated_at}`",
        f"- Model: `{result.model_name}`",
    ]

    if result.language:
        lines.append(f"- Detected language: `{result.language}`")
    if result.language_probability is not None:
        lines.append(f"- Language probability: `{result.language_probability:.4f}`")
    if result.duration_seconds is not None:
        lines.append(
            f"- Duration: `{format_timestamp(result.duration_seconds)}` "
            f"({result.duration_seconds:.2f} seconds)"
        )

    lines.extend(["", "## Transcript", ""])

    if not result.segments:
        lines.append("_No speech segments were detected._")
        lines.append("")
        return "\n".join(lines)

    for segment in result.segments:
        lines.append(
            f"**[{format_timestamp(segment.start)} - {format_timestamp(segment.end)}]** {segment.text}"
        )
        lines.append("")

    return "\n".join(lines)


def segment_capture_time(
    segment: TranscriptSegment,
    duration_seconds: float | None = None,
) -> float:
    start = max(segment.start, 0.0)
    end = max(segment.end, start)
    capture_time = start + ((end - start) / 2 if end > start else 0.0)
    if duration_seconds is not None and duration_seconds > 0:
        capture_time = min(capture_time, max(duration_seconds - 0.001, 0.0))
    return capture_time


def frame_select_time(capture_time: float, frame_times: list[float] | None) -> str:
    if not frame_times:
        return f"{capture_time:.3f}"
    # Target the frame on screen at capture_time: the last frame at or before it. Variable
    # frame rate recordings can go seconds without a new frame, and audio can outlast the
    # video stream, so the first frame after capture_time may not exist.
    frame_index = max(bisect.bisect_right(frame_times, capture_time) - 1, 0)
    # Select from just below the frame's timestamp so float rounding cannot skip it.
    return f"{frame_times[frame_index] - 0.0005:.6f}"


def build_segment_images(
    result: TranscriptionResult,
    *,
    image_suffix: str = ".png",
) -> list[SegmentImage]:
    images: list[SegmentImage] = []
    for index, segment in enumerate(result.segments, start=1):
        filename = (
            f"{index:04d}_{format_filename_timestamp(segment.start)}"
            f"_{format_filename_timestamp(segment.end)}{image_suffix}"
        )
        images.append(
            SegmentImage(
                index=index,
                start=segment.start,
                end=segment.end,
                capture_time=segment_capture_time(segment, result.duration_seconds),
                text=segment.text,
                filename=filename,
            )
        )
    return images


def build_interval_image_result(
    duration_seconds: float,
    *,
    minimum_interval: float = 5.0,
    maximum_images: int = 20,
) -> TranscriptionResult:
    if duration_seconds <= 0:
        raise RuntimeError("Cannot sample images because the video duration is unavailable.")
    image_count = min(
        maximum_images,
        max(1, math.ceil(duration_seconds / minimum_interval)),
    )
    interval = duration_seconds / image_count
    segments = [
        TranscriptSegment(
            start=index * interval,
            end=(index + 1) * interval,
            text=f"Representative frame {index + 1} of {image_count}",
        )
        for index in range(image_count)
    ]
    return TranscriptionResult(
        model_name="none",
        language=None,
        language_probability=None,
        duration_seconds=duration_seconds,
        segments=segments,
    )


def visual_sampling(args: argparse.Namespace) -> tuple[float, int]:
    minimum_interval, maximum_images = VISUAL_DETAIL_SAMPLING[args.visual_detail]
    return (
        args.visual_frame_interval or minimum_interval,
        args.visual_max_frames or maximum_images,
    )


def write_segment_images_manifest(
    video_path: Path,
    output_dir: Path,
    images: list[SegmentImage],
    *,
    generated_at: str | None = None,
) -> None:
    payload = {
        "source": str(video_path),
        "generated_at": generated_at or iso_now(),
        "images": [asdict(image) for image in images],
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def extract_segment_images(
    video_path: Path,
    result: TranscriptionResult,
    output_dir: Path,
    *,
    overwrite: bool,
    generated_at: str | None = None,
    frame_times: list[float] | None = None,
) -> list[SegmentImage]:
    images = build_segment_images(result)
    if output_dir.exists() and not output_dir.is_dir():
        raise RuntimeError(f"segment image path is not a directory: {output_dir}")

    manifest_path = output_dir / "manifest.json"
    blocked_paths = [output_dir / image.filename for image in images]
    blocked_paths.append(manifest_path)
    existing_paths = [path for path in blocked_paths if path.exists()]
    if existing_paths and not overwrite:
        raise RuntimeError(
            f"segment image output already exists: {existing_paths[0]} (use --overwrite)"
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    if not images:
        write_segment_images_manifest(
            video_path,
            output_dir,
            images,
            generated_at=generated_at,
        )
        return images

    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path is None:
        raise RuntimeError(
            "Companion image extraction requires 'ffmpeg' to be installed and available on PATH."
        )

    # One ffmpeg pass selects every capture time; a balanced max() tree keeps the select
    # expression shallow however many segments there are.
    select_times = {
        image.index: frame_select_time(image.capture_time, frame_times) for image in images
    }
    capture_times = sorted(set(select_times.values()), key=float)
    select_terms = []
    for index, capture_time in enumerate(capture_times):
        previous_check = (
            "isnan(prev_selected_t)"
            if index == 0
            else f"lt(prev_selected_t\\,{capture_time})"
        )
        select_terms.append(f"gte(t\\,{capture_time})*{previous_check}")
    while len(select_terms) > 1:
        select_terms = [
            (
                f"max({select_terms[index]}\\,{select_terms[index + 1]})"
                if index + 1 < len(select_terms)
                else select_terms[index]
            )
            for index in range(0, len(select_terms), 2)
        ]
    select_expression = select_terms[0]

    with tempfile.TemporaryDirectory(prefix=".video-to-md-", dir=output_dir) as temp_dir:
        temp_path = Path(temp_dir)
        frame_pattern = temp_path / "%04d.png"
        command = [
            ffmpeg_path,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video_path),
            "-map",
            "0:v:0",
            "-vf",
            f"select={select_expression}",
            "-fps_mode",
            "vfr",
            "-start_number",
            "1",
            str(frame_pattern),
        ]
        completed = subprocess.run(command, capture_output=True, text=True, check=False)
        if completed.returncode != 0:
            error_text = (completed.stderr or completed.stdout).strip()
            if "matches no streams" in error_text or "Invalid input file index" in error_text:
                raise RuntimeError(
                    f"Cannot extract companion images from '{video_path}' because it has no video stream."
                )
            raise RuntimeError(
                f"ffmpeg failed while extracting companion images: "
                f"{error_text or 'unknown ffmpeg error'}"
            )
        extracted_frames = sorted(temp_path.glob("*.png"))
        if len(extracted_frames) != len(capture_times):
            raise RuntimeError(
                f"ffmpeg extracted {len(extracted_frames)} of {len(capture_times)} companion images."
            )
        frames_by_time = dict(zip(capture_times, extracted_frames))
        for image in images:
            shutil.copyfile(
                frames_by_time[select_times[image.index]],
                output_dir / image.filename,
            )

    write_segment_images_manifest(
        video_path,
        output_dir,
        images,
        generated_at=generated_at,
    )
    return images


def validate_segment_images_preflight(output_dir: Path, *, overwrite: bool) -> None:
    if output_dir.exists() and not output_dir.is_dir():
        raise RuntimeError(f"segment image path is not a directory: {output_dir}")
    if output_dir.exists() and not overwrite and any(output_dir.iterdir()):
        raise RuntimeError(
            f"segment image directory is not empty: {output_dir} (use --overwrite)"
        )
    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            "Companion image extraction requires 'ffmpeg' to be installed and available on PATH."
        )


def paths_refer_to_same_file(first_path: Path, second_path: Path) -> bool:
    if first_path == second_path:
        return True
    try:
        return first_path.samefile(second_path)
    except OSError:
        return False


def validate_outputs_preflight(
    video_path: Path,
    paths: OutputPaths,
    *,
    writes_transcript: bool,
    writes_images: bool,
    overwrite: bool,
) -> None:
    for path in (paths.transcript, paths.llm_context):
        if paths_refer_to_same_file(video_path, path):
            raise RuntimeError("output path must be different from the input media file")
    if writes_transcript and paths.transcript.exists() and not overwrite:
        raise RuntimeError(f"output file already exists: {paths.transcript} (use --overwrite)")
    if paths.llm_context.exists() and not overwrite:
        raise RuntimeError(f"output file already exists: {paths.llm_context} (use --overwrite)")
    if writes_images:
        validate_segment_images_preflight(paths.images_dir, overwrite=overwrite)


def write_llm_context(
    video_path: Path,
    paths: OutputPaths,
    images: list[SegmentImage],
    *,
    transcript_written: bool,
    frames_written: bool,
    note: str | None = None,
) -> None:
    lines = [
        f"# Video Context: {video_path.name}",
        "",
        f"- Source: `{video_path}`",
        f"- Transcript: `{paths.transcript}`" if transcript_written else "- Transcript: none",
        f"- Segment images: `{paths.images_dir}`" if frames_written else "- Segment images: none",
        f"- Manifest: `{paths.manifest}`" if frames_written else "- Manifest: none",
        f"- Segment count: `{len(images)}`",
        "",
    ]
    if note:
        lines.extend([note, ""])
    lines.extend(["## Segments", ""])

    if not images:
        lines.extend(["_No segments were detected._", ""])
    for image in images:
        lines.extend([f"### Segment {image.index:04d}", ""])
        if frames_written:
            lines.extend([f"![Segment {image.index:04d}]({paths.images_dir / image.filename})", ""])
        else:
            lines.extend(["_No frame available: the source has no video stream._", ""])
        lines.extend(
            [
                f"- Time: `{format_timestamp(image.start)} - {format_timestamp(image.end)}`",
                f"- Frame: `{format_timestamp(image.capture_time)}`",
                "",
                image.text,
                "",
            ]
        )

    paths.llm_context.write_text("\n".join(lines), encoding="utf-8")


def build_summary(
    video_path: Path,
    paths: OutputPaths,
    *,
    mode: str,
    transcript_written: bool,
    frames_written: bool,
    segment_count: int,
) -> dict[str, Any]:
    return {
        "video": str(video_path),
        "mode": mode,
        "output_dir": str(paths.output_dir),
        "transcript": str(paths.transcript) if transcript_written else None,
        "images_dir": str(paths.images_dir) if frames_written else None,
        "manifest": str(paths.manifest) if frames_written else None,
        "llm_context": str(paths.llm_context),
        "segment_count": segment_count,
        "model_cache": str(Path(MODEL_DIR).expanduser()),
        "python_env": str(VENV_DIR),
        "dependency_installer": "uv" if shutil.which("uv") else "venv+pip",
    }


def process_media(
    args: argparse.Namespace,
    video_path: Path,
    paths: OutputPaths,
    media: dict[str, Any],
) -> dict[str, Any]:
    has_video = bool(media["has_video"])
    visual_mode = bool(has_video and (args.visual_only or not media["has_audio"]))
    validate_outputs_preflight(
        video_path,
        paths,
        writes_transcript=not visual_mode,
        writes_images=has_video,
        overwrite=args.overwrite,
    )
    minimum_interval, maximum_images = visual_sampling(args)

    note = None
    if visual_mode:
        mode = "visual"
        transcript_written = False
        generated_at = iso_now()
        image_result = build_interval_image_result(
            media["duration"],
            minimum_interval=minimum_interval,
            maximum_images=maximum_images,
        )
        note = (
            "_No audio transcript: these are representative frames sampled across the video. "
            "Inspect the images for context._"
        )
    else:
        mode = "transcript"
        result = transcribe_video(args, video_path)
        generated_at = iso_now()
        paths.output_dir.mkdir(parents=True, exist_ok=True)
        # The transcript is persisted before image extraction, so a frame failure keeps it.
        paths.transcript.write_text(
            render_markdown(video_path, result, generated_at=generated_at),
            encoding="utf-8",
        )
        transcript_written = True
        log(f"Wrote markdown transcript to '{paths.transcript}'.")
        image_result = result
        if not result.segments and has_video:
            mode = "no-speech-visual"
            image_result = build_interval_image_result(
                media["duration"] or (result.duration_seconds or 0.0),
                minimum_interval=minimum_interval,
                maximum_images=maximum_images,
            )
            note = (
                "_No speech was detected: these are representative frames sampled across the "
                "video. Inspect the images for context._"
            )

    if has_video:
        images = extract_segment_images(
            video_path,
            image_result,
            paths.images_dir,
            overwrite=args.overwrite,
            generated_at=generated_at,
            frame_times=probe_video_frame_times(video_path),
        )
        log(f"Wrote {len(images)} companion image(s) to '{paths.images_dir}'.")
    else:
        images = build_segment_images(image_result)

    write_llm_context(
        video_path,
        paths,
        images,
        transcript_written=transcript_written,
        frames_written=has_video,
        note=note,
    )
    return build_summary(
        video_path,
        paths,
        mode=mode,
        transcript_written=transcript_written,
        frames_written=has_video,
        segment_count=len(images),
    )


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.doctor:
        result = diagnostics()
        print(json.dumps(result, indent=2))
        return 0 if result["ok"] else 1
    if not args.video_path:
        return fail("video_path is required unless --doctor is used")

    dependency_error = python_error() or media_tool_error()
    if dependency_error:
        return fail(dependency_error)

    video_path = Path(args.video_path).expanduser().resolve()

    if not video_path.exists():
        return fail(f"media file not found: {video_path}")
    if not video_path.is_file():
        return fail(f"path is not a file: {video_path}")

    paths = resolve_output_paths(video_path, args.output_dir)

    try:
        media = probe_media(video_path)
        if not media["has_audio"] and not media["has_video"]:
            return fail("media has neither audio nor video streams")
        if args.visual_only and not media["has_video"]:
            return fail("--visual-only needs a video stream")
        summary = process_media(args, video_path, paths, media)
    except json.JSONDecodeError as exc:
        return fail(f"invalid JSON output: {exc}")
    except RuntimeError as exc:
        return fail(str(exc))
    except ManagedRunComplete as exc:
        return exc.returncode
    except subprocess.CalledProcessError as exc:
        return fail(f"dependency setup failed: {exc}")
    except OSError as exc:
        return fail(f"filesystem or process error: {exc}")
    except KeyboardInterrupt:
        fail("interrupted")
        return 130

    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
