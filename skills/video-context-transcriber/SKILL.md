---
name: video-context-transcriber
description: "Transcribe local video/audio files or sample silent video frames into LLM-ready context bundles. Use when the user provides a local media path and wants transcript context, timestamped caption frames, or visual frame context for videos with little/no audio. Self-contained: no separate local project required."
---

# Video Context Transcriber

## Overview

Use this skill to turn a local video path into a bundle that an LLM can inspect:

- `transcript.md` from bundled `faster-whisper` transcription
- `segment_images/*.png`, one frame per transcript segment or sampled silent-video interval
- `segment_images/manifest.json`, mapping frames to timestamps and caption/visual text
- `llm_context.md`, pairing each caption or visual sample with its extracted frame

Prefer the wrapper script bundled beside this `SKILL.md` so output paths and the LLM context file stay consistent. Do not hardcode `.codex`, `.agents`, or repo-root paths. If the input has video but no audio stream, the wrapper automatically skips transcription and samples frames for visual context.

## Workflow

1. Verify the user supplied a local video or audio file path.
2. Resolve the installed skill directory: use the directory containing this `SKILL.md`; the script is `scripts/transcribe_video_context.py` inside it.
3. Run:

   ```bash
   python3 /path/to/video-context-transcriber/scripts/transcribe_video_context.py /absolute/path/to/video.mp4
   ```

   On a new machine, diagnose prerequisites first:

   ```bash
   python3 /path/to/video-context-transcriber/scripts/transcribe_video_context.py --doctor
   ```

4. If the user provides domain vocabulary, pass it through:

   ```bash
   python3 /path/to/video-context-transcriber/scripts/transcribe_video_context.py /absolute/path/to/video.mp4 --initial-prompt "PostgreSQL, pgvector, LangChain"
   ```

5. If the user wants visual context even when audio exists, add `--visual-only`.
6. For silent videos, choose sampling density by context need:
   - `--visual-detail high` for UI walkthroughs, slides, dashboards, code demos, or dense screen recordings.
   - `--visual-detail medium` for normal demos.
   - `--visual-detail low` for long/slow videos.
   - Use `--visual-frame-interval <seconds>` and `--visual-max-frames <n>` when the user asks for more/less granular frames.
7. If output files already exist and the user wants regeneration, add `--overwrite`.
8. Read `llm_context.md` first. Use `segment_images/manifest.json` when exact timestamps, image filenames, or caption mappings matter.
9. When answering about visual content, inspect the referenced frame images for the relevant segments instead of relying only on transcript text. For silent videos, inspect frames directly because placeholder text only marks sampled intervals.

## Options

- `--output-dir`: write elsewhere. By default, create `<video-stem>_llm_context` in the source video's folder.
- `--model`: Whisper model name or local model path. Default is `small`.
- `--language`: optional language code such as `en`, `hi`, or `fr`.
- `--initial-prompt`: vocabulary or phrase hints for better transcription.
- `--no-vad-filter`: disable the default voice activity detection filter.
- `--device`: faster-whisper device. Default is `cpu`.
- `--compute-type`: faster-whisper compute type. Default is `int8`.
- `--download-root`: optional model cache directory.
- `--overwrite`: replace existing transcript, images, manifest, and context file.
- `--visual-only`: skip transcription and build context only from sampled video frames.
- `--visual-detail`: `low`, `medium`, or `high` frame density. Default is `medium`.
- `--visual-frame-interval`: seconds between sampled frames. Overrides `--visual-detail`.
- `--visual-max-frames`: maximum sampled frames. Overrides the detail default.
- `--no-auto-install`: fail instead of creating the managed Python dependency environment.
- `--doctor`: report platform, Python, FFmpeg, cache, and environment readiness.

## Dependencies

- Python 3.9+ with `venv` and `pip` must be available.
- `ffmpeg` must be on `PATH` for frame extraction.
- `ffprobe` must be on `PATH` for audio/video stream detection.
- If `uv` is available, use it for faster environment creation and dependency installation. Otherwise, fall back to standard `venv` and `pip`; `uv` remains optional.
- No external media-transcription repo is required.
- For transcription, the first run creates an isolated, Python/dependency-versioned environment and installs the exact version in `scripts/requirements.txt`. Concurrent runs share an install lock.
- Cache locations follow OS conventions: `~/Library/Caches` on macOS, `%LOCALAPPDATA%` on Windows, and `$XDG_CACHE_HOME` or `~/.cache` on Linux. Set `VIDEO_CONTEXT_TRANSCRIBER_CACHE` to override.
- The first run for each Whisper model downloads it to the cache `models` directory unless `--download-root` is set. Later runs reuse it.
- CPU `int8` is the portable default. NVIDIA GPU mode additionally requires compatible CUDA and cuDNN libraries.
- Voice activity detection is enabled by default to avoid transcribing long silent regions.
- Target maintained Windows, macOS, and Linux releases where `faster-whisper`/CTranslate2 provide binary wheels. Run `--doctor` after moving machines.

## Output Handling

The wrapper prints a JSON summary containing:

- `video`
- `output_dir`
- `transcript`
- `images_dir`
- `manifest`
- `llm_context`
- `segment_count`
- `model_cache`
- `python_env`

Use these paths in the final answer so the user can find the generated bundle.
