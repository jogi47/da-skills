import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

SCRIPT = Path(__file__).parents[1] / "scripts" / "transcribe_video_context.py"
SPEC = importlib.util.spec_from_file_location("transcribe_video_context", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

HAS_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


def sample_result():
    return MODULE.TranscriptionResult(
        model_name="small",
        language="en",
        language_probability=0.99,
        duration_seconds=5.5,
        segments=[
            MODULE.TranscriptSegment(start=0.0, end=2.5, text="Hello there."),
            MODULE.TranscriptSegment(start=2.5, end=5.5, text="General Kenobi."),
        ],
    )


def fake_ffmpeg_run(calls):
    def run(command, **_):
        calls.append(command)
        frame_dir = Path(command[-1]).parent
        frame_count = command[command.index("-vf") + 1].count("gte(")
        for index in range(frame_count):
            (frame_dir / f"{index + 1:04d}.png").write_bytes(f"frame {index + 1}".encode())
        return subprocess.CompletedProcess(command, 0, "", "")

    return run


def make_args(*extra):
    return MODULE.parse_args(["video.mp4", *extra])


class OptionTests(unittest.TestCase):
    def test_sampling_arguments_must_be_positive(self):
        with self.assertRaises(Exception):
            MODULE.positive_float("0")
        with self.assertRaises(Exception):
            MODULE.positive_int("-1")

    def test_vad_filter_is_enabled_unless_disabled(self):
        self.assertFalse(make_args().no_vad_filter)
        self.assertTrue(make_args("--no-vad-filter").no_vad_filter)

    def test_fast_and_beam_size_are_mutually_exclusive(self):
        self.assertEqual(make_args().beam_size, 5)
        self.assertTrue(make_args("--fast").fast)
        with mock.patch("sys.stderr"), self.assertRaises(SystemExit):
            make_args("--fast", "--beam-size", "3")

    def test_medium_visual_sampling_matches_video_to_md(self):
        minimum_interval, maximum_images = MODULE.visual_sampling(make_args())
        short_result = MODULE.build_interval_image_result(
            12.0, minimum_interval=minimum_interval, maximum_images=maximum_images
        )
        long_result = MODULE.build_interval_image_result(
            3_600.0, minimum_interval=minimum_interval, maximum_images=maximum_images
        )
        self.assertEqual(len(short_result.segments), 3)
        self.assertEqual(len(long_result.segments), 20)
        self.assertEqual(short_result.segments[0].text, "Representative frame 1 of 3")

    def test_visual_overrides_replace_detail_defaults(self):
        self.assertEqual(
            MODULE.visual_sampling(
                make_args("--visual-detail", "high", "--visual-frame-interval", "2")
            ),
            (2.0, 240),
        )
        self.assertEqual(MODULE.visual_sampling(make_args("--visual-max-frames", "7")), (5.0, 7))


class EnvironmentTests(unittest.TestCase):
    def test_environment_changes_with_python_and_requirements(self):
        self.assertIn(
            f"py{MODULE.sys.version_info.major}{MODULE.sys.version_info.minor}",
            MODULE.VENV_DIR.name,
        )
        self.assertIn(MODULE.REQUIREMENTS_HASH, MODULE.VENV_DIR.name)
        self.assertEqual(MODULE.REQUIREMENTS, ["faster-whisper==1.2.1"])

    def test_managed_environment_is_detected_by_prefix(self):
        with tempfile.TemporaryDirectory() as directory:
            environment = Path(directory) / "env"
            environment.mkdir()
            with mock.patch.object(MODULE, "VENV_DIR", environment):
                with mock.patch.object(MODULE.sys, "prefix", str(environment)):
                    self.assertTrue(MODULE.running_in_managed_environment())
                with mock.patch.object(MODULE.sys, "prefix", directory):
                    self.assertFalse(MODULE.running_in_managed_environment())

    def test_symlinked_venv_python_still_reexecs_into_environment(self):
        # uv/venv symlink bin/python to the base interpreter, so the interpreter paths
        # resolve to the same file even though the base interpreter lacks faster-whisper.
        with tempfile.TemporaryDirectory() as directory:
            environment = Path(directory) / "env"
            (environment / "bin").mkdir(parents=True)
            try:
                (environment / "bin" / "python").symlink_to(Path(sys.executable).resolve())
            except OSError:
                self.skipTest("symlinks are not available")
            with (
                mock.patch.object(MODULE, "VENV_DIR", environment),
                mock.patch.object(MODULE, "prepare_managed_environment"),
                mock.patch.dict(MODULE.os.environ, {}, clear=False),
                mock.patch.object(
                    MODULE.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)
                ) as run,
            ):
                MODULE.os.environ.pop(MODULE.MANAGED_CHILD_ENV, None)
                with self.assertRaises(MODULE.ManagedRunComplete):
                    MODULE.ensure_faster_whisper(make_args())

            self.assertEqual(run.call_args.kwargs["env"][MODULE.MANAGED_CHILD_ENV], "1")

    def test_managed_environment_prefers_uv(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            environment = cache / "env"
            with (
                mock.patch.object(MODULE, "CACHE_DIR", cache),
                mock.patch.object(MODULE, "VENV_DIR", environment),
                mock.patch.object(MODULE.shutil, "which", return_value="/usr/bin/uv"),
                mock.patch.object(MODULE, "venv_has_faster_whisper", return_value=False),
                mock.patch.object(MODULE.subprocess, "run") as run,
            ):
                MODULE.prepare_managed_environment()

            commands = [call.args[0] for call in run.call_args_list]
            self.assertEqual(commands[0][:4], ["/usr/bin/uv", "venv", "--python", sys.executable])
            self.assertEqual(commands[1][:3], ["/usr/bin/uv", "pip", "install"])

    def test_managed_environment_falls_back_to_venv_and_pip(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            environment = cache / "env"
            with (
                mock.patch.object(MODULE, "CACHE_DIR", cache),
                mock.patch.object(MODULE, "VENV_DIR", environment),
                mock.patch.object(MODULE.shutil, "which", return_value=None),
                mock.patch.object(MODULE, "venv_has_faster_whisper", return_value=False),
                mock.patch.object(MODULE.venv.EnvBuilder, "create") as create,
                mock.patch.object(MODULE.subprocess, "run") as run,
            ):
                MODULE.prepare_managed_environment()

            create.assert_called_once_with(environment)
            commands = [call.args[0] for call in run.call_args_list]
            self.assertIn("-m", commands[0])
            self.assertIn("ensurepip", commands[0])
            self.assertIn("pip", commands[-1])


class TranscriptTests(unittest.TestCase):
    def test_default_outputs_match_video_to_md_layout(self):
        paths = MODULE.resolve_output_paths(Path("/videos/demo.mov"), None)
        self.assertEqual(paths.transcript, Path("/videos/demo.md"))
        self.assertEqual(paths.images_dir, Path("/videos/demo_images"))
        self.assertEqual(paths.manifest, Path("/videos/demo_images/manifest.json"))
        self.assertEqual(paths.llm_context, Path("/videos/demo_llm_context.md"))

    def test_transcription_passes_decoding_options(self):
        captured = {}

        class FakeModel:
            def __init__(self, *args, **kwargs):
                pass

            def transcribe(self, *args, **kwargs):
                captured.update(kwargs)
                return [], SimpleNamespace(language="en", duration=1.0)

        with mock.patch.object(MODULE, "ensure_faster_whisper", return_value=FakeModel):
            MODULE.transcribe_video(make_args(), Path("/videos/audio.mp3"))
            self.assertIs(captured["vad_filter"], True)
            self.assertEqual(captured["beam_size"], 5)
            self.assertNotIn("language", captured)
            MODULE.transcribe_video(make_args("--fast"), Path("/videos/audio.mp3"))
            self.assertEqual(captured["beam_size"], 1)

    def test_render_markdown_matches_video_to_md(self):
        markdown = MODULE.render_markdown(
            Path("/videos/demo.mov"), sample_result(), generated_at="2026-09-23T10:00:00+05:30"
        )
        self.assertIn("- Model: `small`", markdown)
        self.assertIn("- Duration: `00:00:05.500` (5.50 seconds)", markdown)
        self.assertIn("**[00:00:00.000 - 00:00:02.500]** Hello there.", markdown)


class FrameTests(unittest.TestCase):
    def test_build_segment_images_uses_segment_midpoints(self):
        images = MODULE.build_segment_images(sample_result())
        self.assertEqual(images[0].filename, "0001_00-00-00.000_00-00-02.500.png")
        self.assertAlmostEqual(images[0].capture_time, 1.25)
        self.assertAlmostEqual(images[1].capture_time, 4.0)

    def test_frame_select_time_targets_frame_on_screen(self):
        frame_times = [0.0, 0.5, 9.0]
        self.assertEqual(MODULE.frame_select_time(1.25, None), "1.250")
        self.assertEqual(MODULE.frame_select_time(0.0, frame_times), "-0.000500")
        self.assertEqual(MODULE.frame_select_time(4.0, frame_times), "0.499500")
        self.assertEqual(MODULE.frame_select_time(15.0, frame_times), "8.999500")

    def test_extract_segment_images_uses_one_batched_ffmpeg_pass(self):
        result = MODULE.TranscriptionResult(
            model_name="small",
            language="en",
            language_probability=0.99,
            duration_seconds=102.0,
            segments=[
                MODULE.TranscriptSegment(start=float(index), end=float(index + 1), text="Test")
                for index in range(101)
            ],
        )
        calls = []
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(
            MODULE.shutil, "which", return_value="/usr/bin/ffmpeg"
        ), mock.patch.object(MODULE.subprocess, "run", fake_ffmpeg_run(calls)):
            output = Path(directory) / "images"
            images = MODULE.extract_segment_images(
                Path("/videos/demo.mov"), result, output, overwrite=False
            )
            manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))

        self.assertEqual(len(images), 101)
        self.assertEqual(len(calls), 1)
        self.assertIn("max(", calls[0][calls[0].index("-vf") + 1])
        self.assertEqual(manifest["source"], str(Path("/videos/demo.mov")))
        self.assertEqual(manifest["images"][0]["filename"], images[0].filename)

    def test_extract_segment_images_shares_frames_across_static_gaps(self):
        result = MODULE.TranscriptionResult(
            model_name="small",
            language="en",
            language_probability=0.99,
            duration_seconds=16.0,
            segments=[
                MODULE.TranscriptSegment(start=0.0, end=2.0, text="One"),
                MODULE.TranscriptSegment(start=4.0, end=6.0, text="Two"),
                MODULE.TranscriptSegment(start=6.0, end=8.0, text="Three"),
                MODULE.TranscriptSegment(start=12.0, end=16.0, text="Four"),
            ],
        )
        calls = []
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(
            MODULE.shutil, "which", return_value="/usr/bin/ffmpeg"
        ), mock.patch.object(MODULE.subprocess, "run", fake_ffmpeg_run(calls)):
            output = Path(directory) / "images"
            images = MODULE.extract_segment_images(
                Path("/videos/demo.mov"),
                result,
                output,
                overwrite=False,
                frame_times=[0.0, 0.5, 3.0, 9.0],
            )
            frames = [(output / image.filename).read_bytes() for image in images]

        self.assertEqual(calls[0][calls[0].index("-vf") + 1].count("gte("), 3)
        self.assertEqual(frames, [b"frame 1", b"frame 2", b"frame 2", b"frame 3"])


class ProcessTests(unittest.TestCase):
    def setUp(self):
        for patcher in (
            mock.patch.object(MODULE.shutil, "which", return_value="/usr/bin/ffmpeg"),
            mock.patch.object(MODULE, "probe_video_frame_times", return_value=None),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def run_process(self, directory, media, *extra):
        source = Path(directory) / "clip.mov"
        source.write_bytes(b"video")
        paths = MODULE.resolve_output_paths(source, None)
        args = MODULE.parse_args([str(source), *extra])
        summary = MODULE.process_media(args, source, paths, media)
        return paths, summary

    def test_preflight_refuses_non_empty_images_dir_before_transcription(self):
        with tempfile.TemporaryDirectory() as directory:
            images_dir = Path(directory) / "clip_images"
            images_dir.mkdir()
            (images_dir / "existing.png").write_bytes(b"png")
            with mock.patch.object(MODULE, "transcribe_video") as transcribe:
                with self.assertRaisesRegex(RuntimeError, "not empty"):
                    self.run_process(
                        directory, {"has_audio": True, "has_video": True, "duration": 5.5}
                    )
            transcribe.assert_not_called()

    def test_preflight_refuses_existing_transcript(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / "clip.md").write_text("existing", encoding="utf-8")
            with mock.patch.object(MODULE, "transcribe_video") as transcribe:
                with self.assertRaisesRegex(RuntimeError, "output file already exists"):
                    self.run_process(
                        directory, {"has_audio": True, "has_video": True, "duration": 5.5}
                    )
            transcribe.assert_not_called()

    def test_transcript_is_kept_when_frame_extraction_fails(self):
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(
            MODULE, "transcribe_video", return_value=sample_result()
        ), mock.patch.object(
            MODULE, "extract_segment_images", side_effect=RuntimeError("frame failure")
        ):
            with self.assertRaisesRegex(RuntimeError, "frame failure"):
                self.run_process(directory, {"has_audio": True, "has_video": True, "duration": 5.5})
            transcript = Path(directory) / "clip.md"
            self.assertIn("Hello there.", transcript.read_text(encoding="utf-8"))

    def test_transcript_run_writes_video_to_md_layout(self):
        calls = []
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(
            MODULE, "transcribe_video", return_value=sample_result()
        ), mock.patch.object(MODULE.subprocess, "run", fake_ffmpeg_run(calls)):
            paths, summary = self.run_process(
                directory, {"has_audio": True, "has_video": True, "duration": 5.5}
            )
            context = paths.llm_context.read_text(encoding="utf-8")
            self.assertTrue(paths.transcript.is_file())
            self.assertTrue(paths.manifest.is_file())

        self.assertEqual(summary["mode"], "transcript")
        self.assertEqual(summary["segment_count"], 2)
        self.assertIn("0001_00-00-00.000_00-00-02.500.png", context)
        self.assertIn("General Kenobi.", context)

    def test_audio_only_writes_context_without_frames(self):
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(
            MODULE, "transcribe_video", return_value=sample_result()
        ):
            paths, summary = self.run_process(
                directory, {"has_audio": True, "has_video": False, "duration": 5.5}
            )
            context = paths.llm_context.read_text(encoding="utf-8")
            self.assertFalse(paths.images_dir.exists())

        self.assertIsNone(summary["images_dir"])
        self.assertIn("_No frame available", context)


@unittest.skipUnless(HAS_FFMPEG, "FFmpeg tools are not installed")
class FfmpegIntegrationTests(unittest.TestCase):
    def test_visual_only_cli_writes_beside_source(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "sample.mp4"
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    "color=c=blue:s=160x120:d=1",
                    "-an",
                    "-c:v",
                    "mpeg4",
                    str(source),
                ],
                check=True,
            )

            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    str(source),
                    "--visual-only",
                    "--visual-frame-interval",
                    "1",
                ],
                check=True,
                capture_output=True,
                text=True,
            )

            summary = json.loads(completed.stdout)
            self.assertEqual(summary["mode"], "visual")
            self.assertIsNone(summary["transcript"])
            self.assertFalse((Path(directory) / "sample.md").exists())
            self.assertTrue((Path(directory) / "sample_llm_context.md").is_file())
            self.assertTrue((Path(directory) / "sample_images" / "manifest.json").is_file())

    def test_frames_survive_static_gaps_and_short_video_stream(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "gaps.mp4"
            # Frames only in 0-3s, 9-9.5s and at 10s, like a screen recording of a static screen.
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    "testsrc=s=160x120:r=30:d=10.1",
                    "-vf",
                    "select='lt(t,3)+between(t,9,9.5)+eq(n,300)'",
                    "-fps_mode",
                    "vfr",
                    "-c:v",
                    "mpeg4",
                    str(source),
                ],
                check=True,
            )
            result = MODULE.TranscriptionResult(
                model_name="small",
                language="en",
                language_probability=None,
                duration_seconds=16.0,
                segments=[
                    MODULE.TranscriptSegment(start=float(start), end=float(start + 2), text="Talk")
                    for start in range(0, 16, 2)
                ],
            )
            output = Path(directory) / "gaps_images"
            images = MODULE.extract_segment_images(
                source,
                result,
                output,
                overwrite=False,
                frame_times=MODULE.probe_video_frame_times(source),
            )

            self.assertEqual(len(images), 8)
            for image in images:
                self.assertGreater((output / image.filename).stat().st_size, 0)


if __name__ == "__main__":
    unittest.main()
