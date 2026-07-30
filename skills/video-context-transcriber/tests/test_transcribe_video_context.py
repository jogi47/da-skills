import importlib.util
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
SPEC.loader.exec_module(MODULE)


class TranscribeVideoContextTests(unittest.TestCase):
    def test_default_output_is_beside_source(self):
        source = Path("/videos/demo.mp4")
        self.assertEqual(
            MODULE.default_output_dir(source),
            Path("/videos/demo_llm_context"),
        )

    def test_sampling_arguments_must_be_positive(self):
        with self.assertRaises(Exception):
            MODULE.positive_float("0")
        with self.assertRaises(Exception):
            MODULE.positive_int("-1")

    def test_vad_filter_is_enabled_unless_disabled(self):
        with mock.patch.object(sys, "argv", ["script", "video.mp4"]):
            self.assertFalse(MODULE.parse_args().no_vad_filter)
        with mock.patch.object(
            sys,
            "argv",
            ["script", "video.mp4", "--no-vad-filter"],
        ):
            self.assertTrue(MODULE.parse_args().no_vad_filter)

    def test_environment_changes_with_python_and_requirements(self):
        self.assertIn(
            f"py{MODULE.sys.version_info.major}{MODULE.sys.version_info.minor}",
            MODULE.VENV_DIR.name,
        )
        self.assertIn(MODULE.REQUIREMENTS_HASH, MODULE.VENV_DIR.name)
        self.assertEqual(MODULE.REQUIREMENTS, ["faster-whisper==1.2.1"])

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

    def test_context_summary_uses_default_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "demo.mp4"
            source.touch()
            output = MODULE.default_output_dir(source)
            images = output / "segment_images"
            images.mkdir(parents=True)
            (images / "manifest.json").write_text('{"images": []}', encoding="utf-8")
            (output / "transcript.md").write_text("# Transcript", encoding="utf-8")

            result = MODULE.write_llm_context(source, output)

            self.assertEqual(Path(result["output_dir"]), output)
            self.assertTrue(Path(result["llm_context"]).is_file())

    def test_segment_frame_uses_fast_input_seek(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "frame.png"
            with mock.patch.object(MODULE, "run_ffmpeg") as run_ffmpeg:
                MODULE.extract_frame(Path("/videos/demo.mp4"), image, 125.5, False)

            command = run_ffmpeg.call_args.args[0]
            self.assertLess(command.index("-ss"), command.index("-i"))
            self.assertEqual(command[command.index("-ss") + 1], "125.500")

    def test_transcription_enables_vad_by_default(self):
        captured: dict[str, object] = {}

        class FakeModel:
            def __init__(self, *args, **kwargs):
                pass

            def transcribe(self, *args, **kwargs):
                captured.update(kwargs)
                return [], SimpleNamespace(language="en", duration=1.0)

        args = SimpleNamespace(
            model="small",
            device="cpu",
            compute_type="int8",
            download_root=str(MODULE.MODEL_DIR),
            language=None,
            initial_prompt=None,
            no_vad_filter=False,
        )
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "context"
            with mock.patch.object(MODULE, "ensure_faster_whisper", return_value=FakeModel):
                MODULE.transcribe_media(
                    args,
                    Path(directory) / "audio.mp3",
                    output,
                    {"has_video": False, "has_audio": True, "duration": 1.0},
                )

        self.assertIs(captured["vad_filter"], True)

    @unittest.skipUnless(
        shutil.which("ffmpeg") and shutil.which("ffprobe"),
        "FFmpeg tools are not installed",
    )
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

            subprocess.run(
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

            output = Path(directory) / "sample_llm_context"
            self.assertTrue((output / "transcript.md").is_file())
            self.assertTrue((output / "llm_context.md").is_file())
            self.assertTrue((output / "segment_images" / "manifest.json").is_file())


if __name__ == "__main__":
    unittest.main()
