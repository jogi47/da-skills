"""Tests for trap_hunt.py. Run: python3 -m unittest test_trap_hunt (from this folder).

Each detector is proved on a fixture that holds the trap and on one that does not.
"""
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import trap_hunt as th  # noqa: E402

GIT_ENV = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@example.com",
               GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@example.com")


def git(repo, *args):
    subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True, env=GIT_ENV)


class Project:
    """A throwaway project root with one or more git repos and a docs/traps/config.json."""

    def __init__(self, repos=("app",), config=None):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        for name in repos:
            repo = self.root / name
            repo.mkdir()
            git(repo, "init", "-q", "-b", "main")
        cfg = {"project": "t", "repos": [{"name": r, "path": r} for r in repos]}
        cfg.update(config or {})
        (self.root / "docs" / "traps").mkdir(parents=True)
        (self.root / "docs" / "traps" / "config.json").write_text(json.dumps(cfg))

    def write(self, rel, text):
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
        return p

    def commit(self, repo="app"):
        git(self.root / repo, "add", "-A")
        git(self.root / repo, "commit", "-q", "-m", "c", "--allow-empty")

    def hits(self, detector):
        ctx = th.Context(self.root)
        return [h for h in th.run_all(ctx) if h.detector == detector]

    def close(self):
        self.tmp.cleanup()


class DetectorTests(unittest.TestCase):
    def setUp(self):
        self.p = Project()

    def tearDown(self):
        self.p.close()

    def scan(self, detector, files):
        for rel, text in files.items():
            self.p.write("app/" + rel, text)
        self.p.commit()
        return self.p.hits(detector)

    def test_silent_catch_js(self):
        hits = self.scan("silent-catch", {
            "a.js": "save().catch(() => {})\ntry { x() } catch (e) {}\n",
            "b.js": "save().catch((err) => log(err))\n",
        })
        self.assertEqual({(h.file, h.line) for h in hits}, {("a.js", 1), ("a.js", 2)})

    def test_silent_catch_csharp_multiline_return_null(self):
        hits = self.scan("silent-catch", {
            "S.cs": "try {\n  Go();\n}\ncatch\n{\n    return null;\n}\n",
            "T.cs": "try { Go(); }\ncatch (Exception ex)\n{\n  _log.LogError(ex, \"x\");\n  throw;\n}\n",
        })
        self.assertEqual([(h.file, h.line) for h in hits], [("S.cs", 4)])

    def test_silent_catch_dart(self):
        hits = self.scan("silent-catch", {
            "a.dart": "try { go(); } catch (_) {}\n",
            "b.dart": "try { go(); } catch (e) { log(e); }\n",
        })
        self.assertEqual([h.file for h in hits], ["a.dart"])

    def test_env_fallback(self):
        hits = self.scan("env-fallback", {
            "c.js": "const API = process.env.REACT_APP_API || 'https://stag.example.com'\n",
            "d.js": "const API = process.env.REACT_APP_API\n",
            "e.dart": "const env = String.fromEnvironment('ENV', defaultValue: 'staging');\n",
        })
        self.assertEqual(sorted(h.file for h in hits), ["c.js", "e.dart"])

    def test_permissive_config_default_csharp(self):
        hits = self.scan("config-default", {
            "C.cs": 'var a = cfg.GetValue("Cors:AllowLocalhost", true);\nvar b = cfg.GetValue<int>("X:Y");\n',
        })
        self.assertEqual([h.line for h in hits], [1])

    def test_ci_soft_fail(self):
        hits = self.scan("ci-soft-fail", {
            ".github/workflows/a.yml": "steps:\n  - run: npm ci || npm install --legacy-peer-deps\n"
                                      "    continue-on-error: true\n",
            ".github/workflows/b.yml": "steps:\n  - run: npm ci\n",
            "Jenkinsfile": "sh 'make test || true'\n",
        })
        self.assertEqual(sorted((h.file, h.line) for h in hits),
                         [(".github/workflows/a.yml", 2), (".github/workflows/a.yml", 3), ("Jenkinsfile", 1)])

    def test_condition_without_succeeded(self):
        hits = self.scan("condition-no-succeeded", {
            "azure-pipelines.yml": "stages:\n- stage: Prod\n  condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')\n"
                                   "- stage: Dev\n  condition: and(succeeded(), eq(1, 1))\n",
        })
        self.assertEqual([h.line for h in hits], [3])

    def test_condition_block_and_compose_file(self):
        hits = self.scan("condition-no-succeeded", {
            "azure-pipelines-backend.yml": "trigger:\n  - dev\nstages:\n- stage: A\n  condition: |\n"
                                           "    and(\n      succeeded(),\n      eq(1, 1))\n"
                                           "- stage: B\n  condition: |\n    eq(variables.x, 'y')\n  jobs: []\n",
            "docker-compose.yml": "services:\n  api:\n    depends_on:\n      db:\n        condition: service_healthy\n",
        })
        self.assertEqual([(h.file, h.line) for h in hits], [("azure-pipelines-backend.yml", 10)])

    def test_csharp_catch_returning_false_is_not_silent(self):
        hits = self.scan("silent-catch", {"V.cs": "try { Parse(); }\ncatch (FormatException)\n{\n  return false;\n}\n"})
        self.assertEqual(hits, [])

    def test_status_literal(self):
        hits = self.scan("status-literal", {
            "a.js": "if (booking.eStatus === 'r') {}\nif (user.status == \"Active\") {}\nif (typeId === 4) {}\n",
            "b.js": "if (booking.eStatus === STATUS.CANCELLED) {}\n",
        })
        self.assertEqual(sorted(h.line for h in hits), [1, 2, 3])

    def test_hardcoded_timezone(self):
        hits = self.scan("hardcoded-timezone", {"a.js": "tz('Europe/London')\n", "b.js": "tz(club.sTimeZone)\n"})
        self.assertEqual([h.file for h in hits], ["a.js"])

    def test_todo_markers_skip_markdown(self):
        hits = self.scan("todo-marker", {"a.js": "// TODO: handle cancel\n", "README.md": "TODO list\n"})
        self.assertEqual([h.file for h in hits], ["a.js"])

    def test_large_file(self):
        self.p.close()
        self.p = Project(config={"thresholds": {"large_file_lines": 5}})
        hits = self.scan("large-file", {"big.js": "x\n" * 6, "small.js": "x\n" * 5})
        self.assertEqual([h.file for h in hits], ["big.js"])

    def test_misspelt_path(self):
        hits = self.scan("misspelt-path", {"plugins/middelware.js": "", "plugins/middleware.js": ""})
        self.assertEqual([h.file for h in hits], ["plugins/middelware.js"])

    def test_duplicate_basename_respects_ignore(self):
        hits = self.scan("duplicate-basename", {
            "a/customButton.dart": "", "b/customButton.dart": "",
            "a/index.js": "", "b/index.js": "",
        })
        self.assertEqual(sorted(h.file for h in hits), ["a/customButton.dart", "b/customButton.dart"])

    def test_duplicate_function(self):
        hits = self.scan("duplicate-function", {
            "a.js": "function escapeHtml(s) { return s }\n",
            "b.js": "export const escapeHtml = (s) => s\n",
            "c.js": "function onlyHere() {}\n",
        })
        self.assertEqual(sorted(h.file for h in hits), ["a.js", "b.js"])

    def test_unread_appsettings_key(self):
        hits = self.scan("unread-config-key", {
            "Api/appsettings.json": json.dumps({"Hangfire": {"EnableScheduler": True},
                                                "Cors": {"AllowLocalhost": False}}),
            "Api/Program.cs": 'cfg.GetValue<bool>("Cors:AllowLocalhost");\n',
        })
        self.assertEqual([h.text for h in hits], ["Hangfire:EnableScheduler"])

    def test_unread_env_example_key(self):
        hits = self.scan("unread-config-key", {
            ".env.example": "API_URL=\nOLD_FLAG=\n",
            "src/a.js": "fetch(process.env.API_URL)\n",
        })
        self.assertEqual([h.text for h in hits], ["OLD_FLAG"])

    def test_excluded_paths_are_skipped(self):
        hits = self.scan("silent-catch", {"tests/a.test.js": "x.catch(() => {})\n",
                                          "node_modules/z/a.js": "x.catch(() => {})\n"})
        self.assertEqual(hits, [])


class ProjectConfigTests(unittest.TestCase):
    def test_custom_detector(self):
        p = Project(config={"custom": [{"id": "raw-reply", "family": "magic_codes",
                                        "regex": r"reply\.send\(", "exts": [".js"],
                                        "why": "w", "fix": "f"}]})
        try:
            p.write("app/a.js", "reply.send({})\nreply.success()\n")
            p.commit()
            self.assertEqual([h.line for h in p.hits("raw-reply")], [1])
        finally:
            p.close()

    def test_twins_count_differing_files(self):
        p = Project(repos=("portal", "admin"),
                    config={"twins": [{"id": "shared-twins", "a": "portal/src/shared", "b": "admin/src/shared",
                                       "why": "w"}]})
        try:
            p.write("portal/src/shared/utils.js", "a\n")
            p.write("admin/src/shared/utils.js", "b\n")
            p.write("portal/src/shared/same.js", "s\n")
            p.write("admin/src/shared/same.js", "s\n")
            p.write("portal/src/shared/only.js", "o\n")
            p.commit("portal")
            p.commit("admin")
            self.assertEqual([h.file for h in p.hits("shared-twins")], ["utils.js"])
        finally:
            p.close()

    def test_doc_claim_drift(self):
        p = Project(config={"claims": [{"id": "react-version", "why": "w",
                                        "doc": "app/RULES.md", "doc_regex": r"React (\d+)",
                                        "source": "app/package.json", "source_regex": r'"react": "\^?(\d+)'}]})
        try:
            p.write("app/RULES.md", "Built on React 18.\n")
            p.write("app/package.json", '{"dependencies": {"react": "^19.3.1"}}\n')
            p.commit()
            hits = p.hits("react-version")
            self.assertEqual(len(hits), 1)
            self.assertIn("18", hits[0].text)
            self.assertIn("19", hits[0].text)
            p.write("app/RULES.md", "Built on React 19.\n")
            self.assertEqual(p.hits("react-version"), [])
        finally:
            p.close()

    def test_disable_detector(self):
        p = Project(config={"disable": ["todo-marker"]})
        try:
            p.write("app/a.js", "// TODO x\n")
            p.commit()
            self.assertEqual(p.hits("todo-marker"), [])
        finally:
            p.close()


class RatchetAndDiffTests(unittest.TestCase):
    def setUp(self):
        self.p = Project()
        self.p.write("app/a.js", "x.catch(() => {})\n")
        self.p.commit()

    def tearDown(self):
        self.p.close()

    def run_cli(self, *args):
        out = io.StringIO()
        with redirect_stdout(out):
            code = th.main(["--root", str(self.p.root), *args])
        return code, out.getvalue()

    def test_scan_fails_only_when_count_rises(self):
        self.assertEqual(self.run_cli("ratchet", "--init")[0], 0)
        self.assertEqual(self.run_cli("scan")[0], 0)
        self.p.write("app/b.js", "y.catch(() => {})\n")
        self.p.commit()
        code, out = self.run_cli("scan")
        self.assertEqual(code, 1)
        self.assertIn("silent-catch", out)

    def test_ratchet_never_raises_without_reason(self):
        self.run_cli("ratchet", "--init")
        self.p.write("app/b.js", "y.catch(() => {})\n")
        self.p.commit()
        self.run_cli("ratchet")
        base = json.loads((self.p.root / "docs/traps/baseline.json").read_text())
        self.assertEqual(base["counts"]["silent-catch"]["app"], 1)
        self.run_cli("ratchet", "--allow-raise", "new helper swallows by design")
        base = json.loads((self.p.root / "docs/traps/baseline.json").read_text())
        self.assertEqual(base["counts"]["silent-catch"]["app"], 2)
        self.assertEqual(base["raised"][-1]["reason"], "new helper swallows by design")

    def test_ratchet_lowers_after_fix(self):
        self.run_cli("ratchet", "--init")
        self.p.write("app/a.js", "x.catch((e) => log(e))\n")
        self.p.commit()
        self.run_cli("ratchet")
        base = json.loads((self.p.root / "docs/traps/baseline.json").read_text())
        self.assertEqual(base["counts"]["silent-catch"].get("app", 0), 0)
        self.p.write("app/a.js", "x.catch(() => {})\n")
        self.p.commit()
        self.assertEqual(self.run_cli("scan")[0], 1)

    def test_detector_at_zero_still_guards(self):
        self.run_cli("ratchet", "--init")
        self.p.write("app/b.js", "// TODO later\n")
        self.p.commit()
        self.assertEqual(self.run_cli("scan")[0], 1)

    def test_diff_reports_only_added_lines(self):
        git(self.p.root / "app", "checkout", "-q", "-b", "task")
        self.p.write("app/a.js", "x.catch(() => {})\n\nz.catch(() => {})\n")
        self.p.write("app/new.js", "w.catch(() => {})\n")
        code, out = self.run_cli("diff", "--base", "main")
        self.assertEqual(code, 1)
        self.assertIn("a.js:3", out)
        self.assertIn("new.js:1", out)
        self.assertNotIn("a.js:1", out)

    def test_diff_clean_branch_passes(self):
        git(self.p.root / "app", "checkout", "-q", "-b", "task")
        self.p.write("app/c.js", "const a = 1\n")
        self.assertEqual(self.run_cli("diff", "--base", "main")[0], 0)


class RegisterTests(unittest.TestCase):
    def test_check_flags_bad_entries(self):
        p = Project()
        try:
            entry = {"id": "T-1", "repo": "app", "family": "silent_fail", "severity": "high",
                     "summary": "s", "where": "a.js:1", "harm": "h", "documented_in": [],
                     "detector": "silent-catch", "enforcer": "none", "status": "open", "plan": None,
                     "found": "2026-11-28"}
            bad = dict(entry, status="done", detector="nope")
            (p.root / "docs/traps/register.json").write_text(json.dumps({"traps": [entry, entry, bad]}))
            errors = th.check_register(th.Context(p.root))
            self.assertTrue(any("duplicate id" in e for e in errors))
            self.assertTrue(any("status" in e for e in errors))
            self.assertTrue(any("detector" in e for e in errors))
        finally:
            p.close()


if __name__ == "__main__":
    unittest.main()
