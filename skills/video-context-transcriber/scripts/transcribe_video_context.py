#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import venv
from pathlib import Path
from typing import Any


CACHE_DIR = Path.home() / ".cache" / "video-context-transcriber"
VENV_DIR = CACHE_DIR / "venv"
MODEL_DIR = CACHE_DIR / "models"
REQUIREMENTS = ["faster-whisper>=1.1.0,<2"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create an LLM-ready transcript/frame context bundle from local media."
    )
    parser.add_argument("video_path", help="Local video or audio path.")
    parser.add_argument(
        "--output-dir",
        help="Directory for transcript, segment images, manifest, and llm_context.md.",
    )
    parser.add_argument("--model", default="small", help="Whisper model name or local model path.")
    parser.add_argument("--language", help="Optional language code such as en, hi, or fr.")
    parser.add_argument("--initial-prompt", help="Vocabulary hints for Whisper.")
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
    parser.add_argument("--visual-frame-interval", type=float, help="Seconds between sampled frames.")
    parser.add_argument("--visual-max-frames", type=int, help="Maximum sampled frames.")
    parser.add_argument(
        "--no-auto-install",
        action="store_true",
        help="Fail instead of creating a managed venv and installing Python dependencies.",
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
        [str(python_path), "-c", "import faster_whisper"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return completed.returncode == 0


def ensure_media_tools() -> str | None:
    if shutil.which("ffmpeg") is None:
        return "ffmpeg is required for frame extraction but was not found on PATH"
    if shutil.which("ffprobe") is None:
        return "ffprobe is required for media inspection but was not found on PATH"
    return None


def ensure_faster_whisper(args: argparse.Namespace) -> Any:
    try:
        from faster_whisper import WhisperModel

        return WhisperModel
    except ImportError:
        pass

    if args.no_auto_install:
        raise RuntimeError("faster-whisper not installed; rerun without --no-auto-install")

    python_path = venv_python()
    if Path(sys.executable).resolve() != python_path.resolve():
        if not python_path.exists():
            VENV_DIR.parent.mkdir(parents=True, exist_ok=True)
            venv.EnvBuilder(with_pip=True).create(VENV_DIR)
        if not venv_has_faster_whisper(python_path):
            subprocess.run(
                [str(python_path), "-m", "pip", "install", "--upgrade", "pip"],
                check=True,
            )
            subprocess.run(
                [str(python_path), "-m", "pip", "install", *REQUIREMENTS],
                check=True,
            )
        os.execv(str(python_path), [str(python_path), str(Path(__file__).resolve()), *sys.argv[1:]])

    subprocess.run([sys.executable, "-m", "pip", "install", *REQUIREMENTS], check=True)
    from faster_whisper import WhisperModel

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
        "-i",
        str(video_path),
        "-ss",
        f"{capture_time:.3f}",
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
    }


def main() -> int:
    args = parse_args()
    video_path = Path(args.video_path).expanduser().resolve()

    if not video_path.exists():
        return fail(f"media file not found: {video_path}")
    if not video_path.is_file():
        return fail(f"path is not a file: {video_path}")

    dependency_error = ensure_media_tools()
    if dependency_error:
        return fail(dependency_error)

    output_dir = (
        Path(args.output_dir).expanduser().resolve() if args.output_dir else default_output_dir(video_path)
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
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
    except subprocess.CalledProcessError as exc:
        return fail(f"dependency setup failed: {exc}")

    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
