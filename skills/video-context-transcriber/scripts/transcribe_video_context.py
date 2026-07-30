#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import shutil
import subprocess
import sys
import time
import venv
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


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


class ManagedRunComplete(Exception):
    def __init__(self, returncode: int):
        self.returncode = returncode


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create an LLM-ready transcript/frame context bundle from local media."
    )
    parser.add_argument("video_path", nargs="?", help="Local video or audio path.")
    parser.add_argument(
        "--output-dir",
        help="Directory for transcript, segment images, manifest, and llm_context.md.",
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
    parser.add_argument(
        "--download-root",
        default=str(MODEL_DIR),
        help=f"Whisper model cache directory. Default: {MODEL_DIR}",
    )
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing outputs.")
    parser.add_argument("--visual-only", action="store_true", help="Skip transcription; sample frames.")
    parser.add_argument(
        "--visual-detail",
        choices=["low", "medium", "high"],
        default="medium",
        help="Frame sampling density for silent/visual-only video.",
    )
    parser.add_argument(
        "--visual-frame-interval", type=positive_float, help="Seconds between sampled frames."
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
    return parser.parse_args()


def fail(message: str) -> int:
    print(f"error: {message}", file=sys.stderr)
    return 1


def format_time(seconds: float) -> str:
    total_ms = max(0, round(seconds * 1000))
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d}.{milliseconds:03d}"


def default_output_dir(video_path: Path) -> Path:
    return video_path.with_name(f"{video_path.stem}_llm_context")


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


def ensure_faster_whisper(args: argparse.Namespace) -> Any:
    python_path = venv_python()
    if Path(sys.executable).resolve() != python_path.resolve():
        if args.no_auto_install and not venv_has_faster_whisper(python_path):
            raise RuntimeError(
                f"managed dependency environment is not ready: {VENV_DIR}; "
                "rerun without --no-auto-install"
            )
        if not args.no_auto_install:
            prepare_managed_environment()
        completed = subprocess.run([str(python_path), str(Path(__file__).resolve()), *sys.argv[1:]])
        raise ManagedRunComplete(completed.returncode)

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


def visual_sampling(duration: float, detail: str, interval: float | None, max_frames: int | None) -> tuple[float, int]:
    default_max = {"low": 60, "medium": 120, "high": 240}[detail]
    limit = max_frames or default_max
    if interval and interval > 0:
        return interval, limit
    if detail == "high":
        return 1.0, limit
    if detail == "low":
        return 10.0, limit
    if duration <= 30:
        return 2.0, limit
    if duration <= 180:
        return 5.0, limit
    if duration <= 900:
        return 10.0, limit
    return max(10.0, duration / limit), limit


def clean_outputs(output_dir: Path) -> None:
    images_dir = output_dir / "segment_images"
    for path in [
        output_dir / "transcript.md",
        output_dir / "llm_context.md",
        images_dir / "manifest.json",
    ]:
        if path.exists():
            path.unlink()
    if images_dir.exists():
        for image_path in images_dir.glob("*.png"):
            image_path.unlink()


def check_existing(output_dir: Path, overwrite: bool) -> None:
    if overwrite:
        clean_outputs(output_dir)
        return
    existing = [
        output_dir / "transcript.md",
        output_dir / "llm_context.md",
        output_dir / "segment_images" / "manifest.json",
    ]
    if any(path.exists() for path in existing):
        raise FileExistsError(f"outputs already exist in {output_dir}; use --overwrite")


def run_ffmpeg(command: list[str], label: str) -> None:
    completed = subprocess.run(command, check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or label)


def extract_frame(video_path: Path, image_path: Path, capture_time: float, overwrite: bool) -> bool:
    command = [
        "ffmpeg",
        "-y" if overwrite else "-n",
        "-ss",
        f"{capture_time:.3f}",
        "-i",
        str(video_path),
        "-map",
        "0:v:0",
        "-frames:v",
        "1",
        "-q:v",
        "2",
        str(image_path),
    ]
    run_ffmpeg(command, f"failed extracting frame at {format_time(capture_time)}")
    return image_path.exists() and image_path.stat().st_size > 0


def sample_visual_frames(
    args: argparse.Namespace, video_path: Path, output_dir: Path, media: dict[str, Any]
) -> dict[str, Any]:
    transcript_path = output_dir / "transcript.md"
    images_dir = output_dir / "segment_images"
    manifest_path = images_dir / "manifest.json"
    images_dir.mkdir(parents=True, exist_ok=True)

    duration = max(float(media.get("duration") or 0), 0)
    interval, max_frames = visual_sampling(
        duration, args.visual_detail, args.visual_frame_interval, args.visual_max_frames
    )
    count = min(max_frames, max(1, math.ceil(duration / interval))) if duration > 0 else 1
    output_pattern = images_dir / "visual_%04d.png"
    fps = 1 / interval
    command = [
        "ffmpeg",
        "-y" if args.overwrite else "-n",
        "-i",
        str(video_path),
        "-vf",
        f"fps={fps:.6f}",
        "-frames:v",
        str(count),
        "-q:v",
        "2",
        str(output_pattern),
    ]
    run_ffmpeg(command, "failed extracting visual frames")

    images: list[dict[str, Any]] = []
    for index, image_path in enumerate(sorted(images_dir.glob("visual_*.png")), start=1):
        if image_path.stat().st_size == 0:
            continue
        capture_time = min(duration, (index - 1) * interval) if duration > 0 else 0.0
        start = max(0.0, capture_time - interval / 2)
        end = min(duration, capture_time + interval / 2) if duration > 0 else capture_time
        images.append(
            {
                "index": index,
                "filename": image_path.name,
                "start": start,
                "end": end,
                "capture_time": capture_time,
                "text": "Silent/visual-only sample. Inspect this frame for visual context.",
            }
        )
    if not images:
        raise RuntimeError("no visual frames could be extracted")

    transcript_path.write_text(
        "\n".join(
            [
                f"# Transcript: {video_path.name}",
                "",
                "_No audio stream was detected, no speech was found, or visual-only mode was requested._",
                "_Context was built from sampled video frames._",
                "",
            ]
        ),
        encoding="utf-8",
    )
    manifest_path.write_text(json.dumps({"images": images}, indent=2), encoding="utf-8")
    return write_llm_context(video_path, output_dir)


def transcribe_media(
    args: argparse.Namespace, video_path: Path, output_dir: Path, media: dict[str, Any]
) -> dict[str, Any]:
    WhisperModel = ensure_faster_whisper(args)
    model = WhisperModel(
        args.model,
        device=args.device,
        compute_type=args.compute_type,
        download_root=str(Path(args.download_root).expanduser().resolve()),
    )
    segments_iter, info = model.transcribe(
        str(video_path),
        language=args.language,
        initial_prompt=args.initial_prompt,
        vad_filter=not args.no_vad_filter,
    )
    segments = list(segments_iter)
    if not segments and media.get("has_video"):
        return sample_visual_frames(args, video_path, output_dir, media)

    transcript_path = output_dir / "transcript.md"
    images_dir = output_dir / "segment_images"
    manifest_path = images_dir / "manifest.json"
    images_dir.mkdir(parents=True, exist_ok=True)

    transcript_lines = [
        f"# Transcript: {video_path.name}",
        "",
        f"- Language: `{getattr(info, 'language', args.language or 'auto')}`",
        f"- Duration: `{format_time(float(getattr(info, 'duration', media.get('duration') or 0)))}`",
        "",
    ]
    images: list[dict[str, Any]] = []
    for index, segment in enumerate(segments, start=1):
        start = float(segment.start)
        end = float(segment.end)
        text = str(segment.text).strip()
        transcript_lines.extend(
            [
                f"## Segment {index:04d}",
                "",
                f"- Time: `{format_time(start)} - {format_time(end)}`",
                "",
                text,
                "",
            ]
        )
        filename = None
        capture_time = max(0.0, start + ((end - start) / 2))
        if media.get("has_video"):
            image_path = images_dir / f"segment_{index:04d}.png"
            if extract_frame(video_path, image_path, capture_time, args.overwrite):
                filename = image_path.name
        images.append(
            {
                "index": index,
                "filename": filename,
                "start": start,
                "end": end,
                "capture_time": capture_time,
                "text": text,
            }
        )

    transcript_path.write_text("\n".join(transcript_lines), encoding="utf-8")
    manifest_path.write_text(json.dumps({"images": images}, indent=2), encoding="utf-8")
    return write_llm_context(video_path, output_dir)


def write_llm_context(video_path: Path, output_dir: Path) -> dict[str, Any]:
    transcript_path = output_dir / "transcript.md"
    images_dir = output_dir / "segment_images"
    manifest_path = images_dir / "manifest.json"
    context_path = output_dir / "llm_context.md"

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    images = manifest.get("images", [])
    lines = [
        f"# Video Context: {video_path.name}",
        "",
        f"- Source: `{video_path}`",
        f"- Transcript: `{transcript_path}`",
        f"- Segment images: `{images_dir}`",
        f"- Manifest: `{manifest_path}`",
        f"- Segment count: `{len(images)}`",
        "",
        "## Segments",
        "",
    ]

    if not images:
        lines.extend(["_No segments were detected._", ""])
    for image in images:
        index = int(image["index"])
        start = format_time(float(image["start"]))
        end = format_time(float(image["end"]))
        capture_time = format_time(float(image["capture_time"]))
        lines.extend([f"### Segment {index:04d}", ""])
        if image.get("filename"):
            image_path = images_dir / image["filename"]
            lines.extend([f"![Segment {index:04d}]({image_path})", ""])
        else:
            lines.extend(["_No frame available for this segment._", ""])
        lines.extend(
            [
                f"- Time: `{start} - {end}`",
                f"- Frame: `{capture_time}`",
                "",
                str(image["text"]).strip(),
                "",
            ]
        )

    context_path.write_text("\n".join(lines), encoding="utf-8")
    return {
        "video": str(video_path),
        "output_dir": str(output_dir),
        "transcript": str(transcript_path),
        "images_dir": str(images_dir),
        "manifest": str(manifest_path),
        "llm_context": str(context_path),
        "segment_count": len(images),
        "model_cache": str(Path(MODEL_DIR).expanduser()),
        "python_env": str(VENV_DIR),
        "dependency_installer": "uv" if shutil.which("uv") else "venv+pip",
    }


def main() -> int:
    args = parse_args()
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

    output_dir = (
        Path(args.output_dir).expanduser().resolve() if args.output_dir else default_output_dir(video_path)
    )

    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        check_existing(output_dir, args.overwrite)
        media = probe_media(video_path)
        if args.visual_only or (media["has_video"] and not media["has_audio"]):
            summary = sample_visual_frames(args, video_path, output_dir, media)
        elif media["has_audio"]:
            summary = transcribe_media(args, video_path, output_dir, media)
        else:
            return fail("media has neither audio nor video streams")
    except FileExistsError as exc:
        return fail(str(exc))
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

    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
