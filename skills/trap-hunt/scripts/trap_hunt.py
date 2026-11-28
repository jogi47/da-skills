#!/usr/bin/env python3
"""trap-hunt scanner: find traps across the repos of one project and ratchet their counts.

Standard library only. The project keeps its data in <root>/docs/traps/:
  config.json    repos, excludes, thresholds, project detectors, twins, doc claims, fix route
  register.json  confirmed traps
  baseline.json  ratchet counts per detector per repo

Commands: init, census, show, scan, diff, ratchet, register, detectors. Run with --help for each.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import fnmatch
import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

TRAPS_DIR = Path("docs") / "traps"

FAMILIES = {
    "copies": "Copies that drifted",
    "magic_codes": "Magic codes",
    "doc_drift": "Docs that contradict the code",
    "silent_fail": "Silent failure",
    "leftovers": "Dangerous leftovers",
    "names": "Misleading names",
    "size_coupling": "Size and coupling",
    "gates": "Gates that do not gate",
    "dead_config": "Dead config",
    "unreachable_conditions": "Conditions that cannot fire",
    "outside_authority": "Authority outside the repo",
    "wire_copies": "Client copies of a server catalogue",
}
SEVERITIES = {"high", "medium", "low"}
ENFORCERS = ["none", "doc", "nudge", "check", "test", "type", "architecture"]
STATUSES = {"open", "planned", "fixed", "accepted"}

CODE_EXTS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".cs", ".dart", ".py", ".go", ".java", ".kt",
             ".swift", ".rb", ".php", ".vue", ".svelte", ".groovy"}
PIPELINE_EXTS = {".yml", ".yaml"}
MAX_BYTES = 1_500_000

DEFAULT_EXCLUDE = [
    "node_modules/*", "vendor/*", "dist/*", "build/*", ".next/*", "out/*", "coverage/*", "bin/*", "obj/*",
    ".dart_tool/*", "Pods/*", ".git/*", "__tests__/*", "test/*", "tests/*", "e2e/*", "*.test.*", "*.spec.*",
    "*_test.dart", "*_test.go", "test_*.py", "*.Tests/*", "Migrations/*", "*.min.js", "*.g.dart",
    "*.freezed.dart", "*.gr.dart", "*.mocks.dart", "*.Designer.cs", "*.generated.*", "*.lock",
    "package-lock.json", "*.map",
]
DEFAULT_BASENAME_IGNORE = [
    "index.*", "__init__.py", "main.*", "Program.cs", "Startup.cs", "AssemblyInfo.cs", "GlobalUsings.cs",
    "routes.*", "route.*", "services.*", "service.*", "controller.*", "model.*", "models.*", "schema.*",
    "types.*", "constants.*", "constant.*", "utils.*", "helpers.*", "helper.*", "styles.*", "style.*",
    "page.*", "layout.*", "loading.*", "error.*", "not-found.*", "handler.*", "handlers.*", "worker.*",
    "query.*", "mutation.*", "config.*", "enums.*", "entities.*", "validators.*", "shared.*", "core.*",
    "*.d.ts", "Jenkinsfile*",
]
DEFAULT_FUNCTION_IGNORE = {
    "main", "build", "default", "handler", "init", "setup", "render", "register", "plugin", "routes",
    "App", "Page", "Layout", "Loading", "Error", "NotFound", "Home", "Index", "GET", "POST", "PUT",
    "PATCH", "DELETE", "generateMetadata", "generateStaticParams", "getServerSideProps", "getStaticProps",
    "getStaticPaths", "middleware",
}
DEFAULT_CONFIG_KEY_IGNORE = ["Logging", "AllowedHosts", "Kestrel", "Serilog", "ApplicationInsights",
                             "AzureAd", "AzureAdB2C", "$schema"]
MISSPELLINGS = [
    "middelware", "decorater", "recieve", "reciept", "seperat", "calender", "sucess", "succesful",
    "adress", "enviroment", "enviornment", "occured", "occurence", "untill", "lenght", "heigth",
    "presentatioin", "webiste", "hendler", "cancle", "managment", "mangement", "paramter", "parmeter",
    "retreive", "dependancy", "existance", "notifcation", "notificaton", "subscripton", "configration",
    "authentification", "analitycs", "acess", "acheive", "aquire", "calcualt", "defualt", "fucntion",
    "funtion", "mesage", "messsage", "pasword", "proccess", "resposne", "udpate", "upadte", "valdiat",
    "comming", "begining", "accomodat", "knowoput", "dashbaord", "transacton", "paymnet", "bookng",
]

SILENT_CATCH = (
    r"\.catch\(\s*(?:\(\s*\w*\s*\)|\w+)\s*=>\s*(?:\{\s*\}|null|undefined)\s*\)"
    r"|\bcatch\b\s*(?:\([^)]*\))?\s*\{\s*(?:return\s*(?:null|default|undefined)?\s*;\s*)?\}"
)
ENV_FALLBACK = (
    r"process\.env\.\w+\s*(?:\|\||\?\?)\s*['\"`]"
    r"|import\.meta\.env\.\w+\s*(?:\|\||\?\?)\s*['\"`]"
    r"|fromEnvironment\([^)]*defaultValue\s*:\s*['\"]"
    r"|GetEnvironmentVariable\([^)]*\)\s*\?\?\s*\""
)
STATUS_LITERAL = (
    r"\b\w*(?:[Ss]tatus|[Tt]ype|[Rr]ole|[Ss]tate)\s*(?:===?|!==?)\s*['\"][\w-]{1,24}['\"]"
    r"|\b\w*(?:[Tt]ype|[Ss]tatus|[Rr]ole)Id\s*(?:===?|!==?)\s*\d+\b"
)

BUILTIN_REGEX = [
    dict(id="silent-catch", family="silent_fail", regex=SILENT_CATCH, exts=CODE_EXTS,
         why="An error is swallowed: a failed write or call leaves no log, no retry and no failing test.",
         fix="Log through the project's logging helper, rethrow, or return an explicit failure value."),
    dict(id="env-fallback", family="silent_fail", regex=ENV_FALLBACK, exts=CODE_EXTS,
         why="A missing env var silently becomes a literal, often another environment's host or a test key.",
         fix="Fail at startup or build when a required value is missing; keep literals out of fallbacks."),
    dict(id="config-default", family="silent_fail", exts={".cs"},
         regex=r"\.GetValue(?:<[^>]+>)?\(\s*\"[^\"]+\"\s*,\s*(?:true|\"[^\"]*\")\s*\)",
         why="Removing the key from config turns on the code default, which is often the permissive one.",
         fix="Default to the safe value in code, or require the key and fail when it is missing."),
    dict(id="ci-soft-fail", family="gates", exts=PIPELINE_EXTS, names=["Jenkinsfile*"],
         regex=r"continue-on-error:\s*true|continueOnError:\s*true|\|\|\s*true\b|\|\|\s*npm (?:i|install)\b"
               r"|\|\|\s*secrets\.|\|\|\s*exit 0",
         why="A pipeline step that cannot fail: a green run proves less than it looks.",
         fix="Let the step fail, or log loudly when the fallback fires and track it as known debt."),
    dict(id="status-literal", family="magic_codes", regex=STATUS_LITERAL, exts=CODE_EXTS,
         why="A status, type or role compared to a raw literal: the meaning is invisible and a typo still compiles.",
         fix="Compare against a named constant or enum from one shared definition."),
    dict(id="hardcoded-timezone", family="copies", exts=CODE_EXTS,
         regex=r"['\"](?:Europe|America|Asia|Australia|Africa|Pacific|Atlantic|Indian)/[A-Za-z_]+['\"]",
         why="A time zone literal repeated in several files drifts when one copy changes.",
         fix="One constant or helper for the default zone; read the entity's own zone where it has one."),
    dict(id="todo-marker", family="leftovers", exts=CODE_EXTS, regex=r"\b(?:TODO|FIXME|HACK|XXX)\b",
         why="A TODO reads as promised behaviour that does not exist.",
         fix="Do it, delete it, or turn it into a tracked ticket with a date or id in the comment."),
]

FUNC_DETECTORS = {
    "large-file": dict(family="size_coupling",
                       why="A file too big to hold in context: edits miss dependent logic far away in the file.",
                       fix="Extract pure helpers or per-feature modules following the repo's existing pattern."),
    "duplicate-basename": dict(family="names",
                               why="Two files share a name: a search finds both and the agent edits the wrong one.",
                               fix="Rename by role or delete the dead copy; list deliberate twins in config."),
    "duplicate-function": dict(family="copies",
                               why="The same top-level function name is defined in several files: copies drift.",
                               fix="Keep one shared implementation and import it."),
    "misspelt-path": dict(family="names",
                          why="A misspelt file or folder name: a search for the right spelling misses it.",
                          fix="Rename with a plan (update imports), or record it in the repo rules if it cannot move."),
    "condition-no-succeeded": dict(
        family="gates",
        why="An Azure stage or step with a custom condition loses the implicit succeeded(): it runs after a failure.",
        fix="Wrap the condition in and(succeeded(), ...)."),
    "unread-config-key": dict(family="dead_config",
                              why="A config or env key nothing reads looks like a switch but does nothing.",
                              fix="Delete it, or wire it up and test that it changes behaviour."),
}


@dataclass
class Hit:
    detector: str
    family: str
    repo: str
    file: str
    line: int
    text: str
    scope: str = "line"  # line: an added line; file: any change to the file; new: file added


class Context:
    def __init__(self, root: Path):
        self.root = Path(root).resolve()
        cfg_path = self.root / TRAPS_DIR / "config.json"
        if not cfg_path.exists():
            raise SystemExit(f"No {TRAPS_DIR}/config.json under {self.root}. Run: trap_hunt.py init")
        self.config = json.loads(cfg_path.read_text())
        self.repos = [dict(r, abs=(self.root / r["path"]).resolve()) for r in self.config.get("repos", [])]
        self.exclude = DEFAULT_EXCLUDE + self.config.get("exclude", [])
        self.disabled = set(self.config.get("disable", []))
        self.thresholds = {"large_file_lines": 1500, **self.config.get("thresholds", {})}
        self._files: dict[str, list[str]] = {}
        self._text: dict[Path, str | None] = {}

    def repo(self, name):
        for r in self.repos:
            if r["name"] == name:
                return r
        raise SystemExit(f"Unknown repo {name!r}; config has {[r['name'] for r in self.repos]}")

    def all_files(self, repo) -> list[str]:
        """Tracked plus untracked-not-ignored files, repo-relative, that exist on disk."""
        name = repo["name"]
        if name not in self._files:
            base = repo["abs"]
            if (base / ".git").exists():
                out = subprocess.run(["git", "-C", str(base), "ls-files", "-z", "--cached", "--others",
                                      "--exclude-standard"], capture_output=True, check=True).stdout
                rels = sorted({p for p in out.decode().split("\0") if p})
            else:
                rels = []
                for d, dirs, files in os.walk(base):
                    dirs[:] = [x for x in dirs if x not in {".git", "node_modules"}]
                    rels += [os.path.relpath(os.path.join(d, f), base) for f in files]
            self._files[name] = [r for r in rels if (base / r).is_file()]
        return self._files[name]

    def files(self, repo) -> list[str]:
        return [f for f in self.all_files(repo) if not excluded(f, self.exclude)]

    def text(self, path: Path) -> str | None:
        if path not in self._text:
            try:
                if path.stat().st_size > MAX_BYTES:
                    self._text[path] = None
                else:
                    raw = path.read_bytes()
                    self._text[path] = None if b"\0" in raw[:8192] else raw.decode("utf-8", "replace")
            except OSError:
                self._text[path] = None
        return self._text[path]


def excluded(rel: str, patterns) -> bool:
    for pat in patterns:
        if fnmatch.fnmatchcase(rel, pat) or fnmatch.fnmatchcase(rel, "*/" + pat):
            return True
    return False


def wants(rel: str, exts, names=()) -> bool:
    base = os.path.basename(rel)
    return Path(rel).suffix in exts or any(fnmatch.fnmatchcase(base, n) for n in names)


def line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def snippet(text: str, offset: int) -> str:
    start = text.rfind("\n", 0, offset) + 1
    end = text.find("\n", offset)
    return text[start:end if end != -1 else None].strip()[:160]


def compile_flags(flags: str) -> int:
    value = re.M
    for ch in flags or "":
        value |= {"i": re.I, "m": re.M, "s": re.S}[ch]
    return value


def regex_detectors(ctx: Context) -> list[dict]:
    dets = [d for d in BUILTIN_REGEX]
    for c in ctx.config.get("custom", []):
        d = dict(c)
        d["exts"] = set(c.get("exts") or CODE_EXTS)
        dets.append(d)
    return [d for d in dets if d["id"] not in ctx.disabled]


def run_regex(ctx: Context, det: dict, repo) -> list[Hit]:
    if det.get("repos") and repo["name"] not in det["repos"]:
        return []
    rx = re.compile(det["regex"], compile_flags(det.get("flags", "")))
    hits = []
    for rel in ctx.files(repo):
        if not wants(rel, det["exts"], det.get("names", ())):
            continue
        text = ctx.text(repo["abs"] / rel)
        if not text:
            continue
        for m in rx.finditer(text):
            hits.append(Hit(det["id"], det["family"], repo["name"], rel, line_of(text, m.start()),
                            snippet(text, m.start())))
    return hits


def run_large_files(ctx, repo):
    limit = ctx.thresholds["large_file_lines"]
    hits = []
    for rel in ctx.files(repo):
        if Path(rel).suffix not in CODE_EXTS:
            continue
        text = ctx.text(repo["abs"] / rel)
        if text and text.count("\n") > limit:
            hits.append(Hit("large-file", "size_coupling", repo["name"], rel, 0,
                            f"{text.count(chr(10))} lines (limit {limit})", "file"))
    return hits


def run_duplicate_basenames(ctx, repo):
    ignore = DEFAULT_BASENAME_IGNORE + ctx.config.get("basename_ignore", [])
    by_name: dict[str, list[str]] = {}
    for rel in ctx.files(repo):
        base = os.path.basename(rel)
        if Path(rel).suffix in CODE_EXTS and not any(fnmatch.fnmatchcase(base, p) for p in ignore):
            by_name.setdefault(base, []).append(rel)
    return [Hit("duplicate-basename", "names", repo["name"], rel, 0, f"{base} x{len(rels)}", "new")
            for base, rels in sorted(by_name.items()) if len(rels) > 1 for rel in rels]


JS_FUNC = re.compile(
    r"^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\("
    r"|^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?"
    r"(?:function\b|\([^)\n]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)", re.M)
DART_FUNC = re.compile(
    r"^(?:Future<[^>\n]*>|Stream<[^>\n]*>|void|String|int|bool|double|num|dynamic|[A-Z]\w*(?:<[^>\n]*>)?)\??"
    r"\s+([a-z_]\w*)\s*\(", re.M)
JS_EXTS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}


def run_duplicate_functions(ctx, repo):
    ignore = DEFAULT_FUNCTION_IGNORE | set(ctx.config.get("function_ignore", []))
    defs: dict[str, list[tuple[str, int]]] = {}
    for rel in ctx.files(repo):
        ext = Path(rel).suffix
        rx = JS_FUNC if ext in JS_EXTS else DART_FUNC if ext == ".dart" else None
        if not rx:
            continue
        text = ctx.text(repo["abs"] / rel)
        if not text:
            continue
        seen = set()
        for m in rx.finditer(text):
            name = next(g for g in m.groups() if g)
            if name in ignore or len(name) < 4 or name in seen:
                continue
            seen.add(name)
            defs.setdefault(name, []).append((rel, line_of(text, m.start())))
    return [Hit("duplicate-function", "copies", repo["name"], rel, line, f"{name} x{len(locs)}")
            for name, locs in sorted(defs.items()) if len({r for r, _ in locs}) > 1 for rel, line in locs]


def run_misspelt_paths(ctx, repo):
    words = MISSPELLINGS + ctx.config.get("misspellings", [])
    seen = {}
    for rel in ctx.files(repo):
        segs = rel.split("/")
        for i, seg in enumerate(segs):
            low = seg.lower()
            word = next((w for w in words if w in low), None)
            if word:
                key = "/".join(segs[:i + 1])
                seen.setdefault(key, word)
                break
    return [Hit("misspelt-path", "names", repo["name"], key, 0, f"contains '{word}'", "new")
            for key, word in sorted(seen.items())]


READER_EXTS = CODE_EXTS | {".bicep", ".yml", ".yaml", ".json", ".sh", ".ps1", ".tf", ".toml", ".xml", ".csproj"}
ENV_EXAMPLE = re.compile(r"(^|/)\.env\.(example|sample|template)$")


def run_unread_config_keys(ctx, repo):
    ignore = DEFAULT_CONFIG_KEY_IGNORE + ctx.config.get("config_key_ignore", [])
    files = ctx.all_files(repo)
    settings = [f for f in files if fnmatch.fnmatchcase(os.path.basename(f), "appsettings*.json")
                and not excluded(f, ctx.exclude)]
    envs = [f for f in files if ENV_EXAMPLE.search(f)]
    if not settings and not envs:
        return []
    config_files = set(settings) | set(envs)
    corpus = "\n".join(t for f in files
                       if f not in config_files and not f.startswith(".env")
                       and (Path(f).suffix in READER_EXTS or os.path.basename(f).startswith(("Dockerfile", "Jenkinsfile", "Makefile")))
                       for t in [ctx.text(repo["abs"] / f)] if t)
    hits, reported = [], set()

    def read(name):
        return re.search(r"(?<![\w$])" + re.escape(name) + r"(?![\w$])", corpus) is not None

    def leaves(obj, prefix=()):
        if isinstance(obj, dict):
            for k, v in obj.items():
                yield from leaves(v, prefix + (k,))
        else:
            yield prefix

    for rel in settings:
        text = ctx.text(repo["abs"] / rel)
        try:
            data = json.loads(text or "")
        except ValueError:
            continue
        for path in leaves(data):
            if not path or path[0] in ignore:
                continue
            key = ":".join(path)
            if key in reported:
                continue
            comment = any(p.startswith("//") for p in path)
            if comment or not (read(path[-1]) or read(key) or read("__".join(path))):
                reported.add(key)
                pos = text.find('"' + path[-1] + '"')
                hits.append(Hit("unread-config-key", "dead_config", repo["name"], rel,
                                line_of(text, max(pos, 0)), key + (" (comment key)" if comment else "")))
    for rel in envs:
        text = ctx.text(repo["abs"] / rel) or ""
        for m in re.finditer(r"^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=", text, re.M):
            name = m.group(1)
            if name not in reported and not read(name):
                reported.add(name)
                hits.append(Hit("unread-config-key", "dead_config", repo["name"], rel, line_of(text, m.start()), name))
    return hits


AZURE_PIPELINE = re.compile(r"^(?:trigger|pool|stages|jobs|extends|pr):", re.M)
CONDITION = re.compile(r"^([ \t-]*)condition:[ \t]*([^\n]*)\n?", re.M)
CONDITION_OK = re.compile(r"\b(?:succeeded|always|failed|canceled|succeededOrFailed)\(")


def run_conditions(ctx, repo):
    """Azure Pipelines conditions (one line or a | block) that drop the implicit succeeded()."""
    hits = []
    for rel in ctx.files(repo):
        if Path(rel).suffix not in PIPELINE_EXTS:
            continue
        text = ctx.text(repo["abs"] / rel)
        if not text or not AZURE_PIPELINE.search(text):
            continue
        for m in CONDITION.finditer(text):
            body = m.group(2)
            if body.strip() in {"|", ">", "|-", ">-", "|+", ">+"}:
                indent = len(m.group(1).replace("-", " "))
                block = []
                for line in text[m.end():].splitlines():
                    if line.strip() and len(line) - len(line.lstrip()) <= indent:
                        break
                    block.append(line)
                body = "\n".join(block)
            if not CONDITION_OK.search(body):
                hits.append(Hit("condition-no-succeeded", "gates", repo["name"], rel, line_of(text, m.start()),
                                snippet(text, m.start()) + " " + " ".join(body.split())[:100]))
    return hits


FUNC_RUNNERS = {
    "condition-no-succeeded": run_conditions,
    "large-file": run_large_files,
    "duplicate-basename": run_duplicate_basenames,
    "duplicate-function": run_duplicate_functions,
    "misspelt-path": run_misspelt_paths,
    "unread-config-key": run_unread_config_keys,
}


def run_twins(ctx) -> list[Hit]:
    hits = []
    for t in ctx.config.get("twins", []):
        if t["id"] in ctx.disabled:
            continue
        a, b = ctx.root / t["a"], ctx.root / t["b"]

        def listing(base):
            out = {}
            for d, dirs, files in os.walk(base):
                dirs[:] = [x for x in dirs if x not in {".git", "node_modules"}]
                for f in files:
                    rel = os.path.relpath(os.path.join(d, f), base)
                    if not excluded(rel, ctx.exclude + t.get("exclude", [])):
                        out[rel] = Path(d) / f
            return out

        la, lb = listing(a), listing(b)
        for rel in sorted(set(la) & set(lb)):
            if la[rel].read_bytes() != lb[rel].read_bytes():
                hits.append(Hit(t["id"], t.get("family", "copies"), "*", rel, 0,
                                f"differs between {t['a']} and {t['b']}", "file"))
    return hits


def run_claims(ctx) -> list[Hit]:
    hits = []
    for c in ctx.config.get("claims", []):
        if c["id"] in ctx.disabled:
            continue
        doc, src = ctx.root / c["doc"], ctx.root / c["source"]
        dtext = doc.read_text() if doc.exists() else ""
        stext = src.read_text() if src.exists() else ""
        dm = re.search(c["doc_regex"], dtext, re.M)
        sm = re.search(c["source_regex"], stext, re.M)
        family = c.get("family", "doc_drift")
        if not dm or not sm:
            missing = c["doc"] if not dm else c["source"]
            hits.append(Hit(c["id"], family, "*", c["doc"], 0, f"claim pattern not found in {missing}", "file"))
        elif dm.group(1).strip() != sm.group(1).strip():
            hits.append(Hit(c["id"], family, "*", c["doc"], line_of(dtext, dm.start()),
                            f"doc says {dm.group(1)!r}, {c['source']} says {sm.group(1)!r}"))
    return hits


def all_detector_ids(ctx) -> dict[str, str]:
    ids = {d["id"]: d["family"] for d in BUILTIN_REGEX}
    ids.update({k: v["family"] for k, v in FUNC_DETECTORS.items()})
    ids.update({c["id"]: c["family"] for c in ctx.config.get("custom", [])})
    ids.update({t["id"]: t.get("family", "copies") for t in ctx.config.get("twins", [])})
    ids.update({c["id"]: c.get("family", "doc_drift") for c in ctx.config.get("claims", [])})
    return ids


def run_all(ctx: Context, repos=None, detector=None) -> list[Hit]:
    hits: list[Hit] = []
    targets = [ctx.repo(r) for r in repos] if repos else ctx.repos
    for repo in targets:
        if not repo["abs"].exists():
            print(f"warning: repo path missing: {repo['abs']}", file=sys.stderr)
            continue
        for det in regex_detectors(ctx):
            if detector in (None, det["id"]):
                hits += run_regex(ctx, det, repo)
        for name, fn in FUNC_RUNNERS.items():
            if name not in ctx.disabled and detector in (None, name):
                hits += fn(ctx, repo)
    if not repos:
        hits += [h for h in run_twins(ctx) + run_claims(ctx) if detector in (None, h.detector)]
    return hits


def count(hits) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for h in hits:
        out.setdefault(h.detector, {}).setdefault(h.repo, 0)
        out[h.detector][h.repo] += 1
    return out


# ----------------------------------------------------------------------------- documented traps

def documented_counts(ctx) -> list[tuple[str, int]]:
    rows = []
    for pattern in ctx.config.get("documented", []):
        total = 0
        for path in sorted(ctx.root.glob(pattern)):
            text = path.read_text(errors="replace")
            if re.search(r"trap|gotcha|pitfall", path.name, re.I):
                total += len(re.findall(r"^### ", text, re.M)) or len(re.findall(r"^## ", text, re.M))
            else:
                inside = False
                for line in text.splitlines():
                    if re.match(r"^#+ ", line):
                        inside = bool(re.search(r"trap|gotcha|pitfall", line, re.I))
                    elif inside and re.match(r"^\s*(?:[-*]|\d+\.) ", line):
                        total += 1
        rows.append((pattern, total))
    return rows


# ----------------------------------------------------------------------------- diff support

HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", re.M)


def added_lines(repo_dir: Path, base: str) -> tuple[dict[str, set[int]], set[str], str]:
    def git(*args):
        return subprocess.run(["git", "-C", str(repo_dir), *args], capture_output=True, text=True)

    note = ""
    mb = git("merge-base", "HEAD", base)
    if mb.returncode != 0:
        note = f"base {base!r} not found; checking uncommitted changes only"
        ref = "HEAD"
    else:
        ref = mb.stdout.strip()
    added: dict[str, set[int]] = {}
    current = None
    for line in git("diff", "-U0", "--no-color", "--no-renames", ref, "--").stdout.splitlines():
        if line.startswith("+++ "):
            current = line[6:] if line.startswith("+++ b/") else None
        elif line.startswith("@@") and current:
            m = HUNK.match(line)
            start, length = int(m.group(1)), int(m.group(2) or 1)
            added.setdefault(current, set()).update(range(start, start + length))
    new = set(git("diff", "--name-only", "--diff-filter=A", ref, "--").stdout.split())
    for rel in git("ls-files", "--others", "--exclude-standard").stdout.splitlines():
        new.add(rel)
        try:
            n = (repo_dir / rel).read_text(errors="replace").count("\n") + 1
        except OSError:
            continue
        added[rel] = set(range(1, n + 1))
    return added, new, note


# ----------------------------------------------------------------------------- register

REQUIRED = ["id", "repo", "family", "severity", "summary", "where", "harm", "enforcer", "status"]


def load_register(ctx) -> list[dict]:
    path = ctx.root / TRAPS_DIR / "register.json"
    return json.loads(path.read_text()).get("traps", []) if path.exists() else []


def check_register(ctx) -> list[str]:
    errors, seen = [], set()
    repos = {r["name"] for r in ctx.repos} | {"*"}
    detectors = all_detector_ids(ctx)
    for i, t in enumerate(load_register(ctx)):
        tid = t.get("id", f"#{i}")
        for f in REQUIRED:
            if not t.get(f):
                errors.append(f"{tid}: missing {f}")
        if tid in seen:
            errors.append(f"{tid}: duplicate id")
        seen.add(tid)
        if t.get("family") not in FAMILIES:
            errors.append(f"{tid}: family {t.get('family')!r} not one of {sorted(FAMILIES)}")
        if t.get("severity") not in SEVERITIES:
            errors.append(f"{tid}: severity {t.get('severity')!r} not one of {sorted(SEVERITIES)}")
        if t.get("enforcer") not in ENFORCERS:
            errors.append(f"{tid}: enforcer {t.get('enforcer')!r} not one of {ENFORCERS}")
        if t.get("status") not in STATUSES:
            errors.append(f"{tid}: status {t.get('status')!r} not one of {sorted(STATUSES)}")
        if t.get("repo") not in repos:
            errors.append(f"{tid}: repo {t.get('repo')!r} not in config")
        if t.get("detector") and t["detector"] not in detectors:
            errors.append(f"{tid}: detector {t['detector']!r} does not exist")
    return errors


# ----------------------------------------------------------------------------- commands

def cmd_init(args):
    root = Path(args.root).resolve()
    path = root / TRAPS_DIR / "config.json"
    if path.exists():
        print(f"{path} exists; edit it instead")
        return 1
    repos = [{"name": d.name, "path": d.name, "base": "origin/HEAD"}
             for d in sorted(root.iterdir()) if d.is_dir() and (d / ".git").exists()]
    if not repos and (root / ".git").exists():
        repos = [{"name": root.name, "path": ".", "base": "origin/HEAD"}]
    config = {
        "project": root.name,
        "repos": repos,
        "exclude": [],
        "documented": [],
        "thresholds": {"large_file_lines": 1500},
        "disable": [],
        "custom": [],
        "twins": [],
        "claims": [],
        "fix_route": {
            "rules": "where each repo's agent rules live",
            "plans": "where a plan doc goes for a one-repo and a cross-repo change",
            "verify": ["the skills or commands that prove a fix"],
            "security": "where an unfixed security finding may be written",
        },
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config, indent=2) + "\n")
    print(f"wrote {path} with {len(repos)} repos; fill in documented, fix_route and the base branches")
    return 0


def cmd_census(ctx, args):
    hits = run_all(ctx, args.repo)
    counts = count(hits)
    if args.json:
        print(json.dumps({"counts": counts, "documented": dict(documented_counts(ctx))}, indent=2))
        return 0
    repos = [r["name"] for r in ctx.repos if not args.repo or r["name"] in args.repo] + ["*"]
    fam_of = all_detector_ids(ctx)
    print(f"# trap census: {ctx.config.get('project', ctx.root.name)}\n")
    by_fam: dict[str, dict[str, int]] = {}
    for det, per in counts.items():
        for repo, n in per.items():
            by_fam.setdefault(fam_of.get(det, "?"), {}).setdefault(repo, 0)
            by_fam[fam_of.get(det, "?")][repo] += n
    used = [r for r in repos if any(r in v for v in counts.values())]
    print("| family | " + " | ".join(used) + " | total |")
    print("|---|" + "---|" * (len(used) + 1))
    for fam in FAMILIES:
        if fam in by_fam:
            row = by_fam[fam]
            print(f"| {fam} | " + " | ".join(str(row.get(r, 0)) for r in used) + f" | {sum(row.values())} |")
    print("\n| detector | " + " | ".join(used) + " | total |")
    print("|---|" + "---|" * (len(used) + 1))
    for det in sorted(counts):
        row = counts[det]
        print(f"| {det} | " + " | ".join(str(row.get(r, 0)) for r in used) + f" | {sum(row.values())} |")
    docs = documented_counts(ctx)
    if docs:
        print("\nDocumented traps:")
        for pattern, n in docs:
            print(f"  {n:5d}  {pattern}")
    register = load_register(ctx)
    if register:
        open_n = sum(1 for t in register if t.get("status") in ("open", "planned"))
        print(f"\nRegister: {len(register)} traps, {open_n} open or planned")
    return 0


def print_hits(hits, limit):
    for h in hits[:limit]:
        loc = f"{h.repo}/{h.file}" + (f":{h.line}" if h.line else "")
        print(f"  {loc}  {h.text}")
    if len(hits) > limit:
        print(f"  ... {len(hits) - limit} more")


def cmd_show(ctx, args):
    hits = run_all(ctx, args.repo, args.detector)
    if args.json:
        print(json.dumps([asdict(h) for h in hits], indent=2))
        return 0
    print(f"{args.detector}: {len(hits)} hits")
    print_hits(hits, args.limit)
    return 0


def baseline_path(ctx):
    return ctx.root / TRAPS_DIR / "baseline.json"


def load_baseline(ctx):
    p = baseline_path(ctx)
    return json.loads(p.read_text()) if p.exists() else None


def cmd_scan(ctx, args):
    base = load_baseline(ctx)
    if base is None:
        print("No baseline.json. Record today's counts first: trap_hunt.py ratchet --init")
        return 2
    hits = run_all(ctx, args.repo)
    counts = count(hits)
    bcounts = base.get("counts", {})
    rises, falls, unbaselined = [], [], []
    keys = {(d, r) for d, per in counts.items() for r in per} | {(d, r) for d, per in bcounts.items() for r in per}
    for det, repo in sorted(keys):
        if args.repo and repo not in args.repo:
            continue
        cur = counts.get(det, {}).get(repo, 0)
        if det not in bcounts:
            unbaselined.append((det, repo, cur))
            continue
        was = bcounts[det].get(repo, 0)
        if cur > was:
            rises.append((det, repo, was, cur))
        elif cur < was:
            falls.append((det, repo, was, cur))
    for det, repo, was, cur in rises:
        print(f"RISE {det} in {repo}: {was} -> {cur}")
        print_hits([h for h in hits if h.detector == det and h.repo == repo], 10)
    for det, repo, was, cur in falls:
        print(f"fell {det} in {repo}: {was} -> {cur} (run ratchet to lock it in)")
    for det, repo, cur in unbaselined:
        print(f"new detector {det} in {repo}: {cur} (not in baseline; run ratchet)")
    if not rises:
        print("scan: no counts rose")
    return 1 if rises else 0


def cmd_ratchet(ctx, args):
    hits = run_all(ctx)
    # every detector gets a key, even at zero, so a trap that comes back after a fix fails the scan
    counts = {det: {} for det in all_detector_ids(ctx) if det not in ctx.disabled}
    counts.update(count(hits))
    base = load_baseline(ctx)
    today = _dt.date.today().isoformat()
    if args.init or base is None:
        new = {"updated": today, "counts": counts, "raised": (base or {}).get("raised", [])}
    else:
        old = base.get("counts", {})
        merged, raised = {}, base.get("raised", [])
        for det in set(old) | set(counts):
            merged[det] = {}
            for repo in set(old.get(det, {})) | set(counts.get(det, {})):
                cur = counts.get(det, {}).get(repo, 0)
                was = old.get(det, {}).get(repo)
                if det not in old:
                    merged[det][repo] = cur
                elif was is None:
                    was = 0
                if det in old:
                    if cur > was and args.allow_raise:
                        raised.append({"date": today, "detector": det, "repo": repo, "from": was, "to": cur,
                                       "reason": args.allow_raise})
                        merged[det][repo] = cur
                    else:
                        merged[det][repo] = min(cur, was)
                        if cur > was:
                            print(f"kept {det} in {repo} at {was} (now {cur}); fix the new hits or pass --allow-raise")
            merged[det] = {r: n for r, n in merged[det].items() if n}
        new = {"updated": today, "counts": merged, "raised": raised}
    baseline_path(ctx).write_text(json.dumps(new, indent=2, sort_keys=True) + "\n")
    print(f"wrote {baseline_path(ctx)}")
    return 0


def cmd_diff(ctx, args):
    found = []
    for repo in ctx.repos:
        if args.repo and repo["name"] not in args.repo:
            continue
        if not (repo["abs"] / ".git").exists():
            continue
        base = args.base or repo.get("base") or "origin/HEAD"
        added, new, note = added_lines(repo["abs"], base)
        if note:
            print(f"{repo['name']}: {note}")
        if not added and not new:
            continue
        for h in run_all(ctx, [repo["name"]]):
            lines = added.get(h.file, set())
            if (h.scope == "line" and h.line in lines) or (h.scope == "file" and lines) or \
                    (h.scope == "new" and any(f == h.file or f.startswith(h.file + "/") for f in new)):
                found.append(h)
    if args.json:
        print(json.dumps([asdict(h) for h in found], indent=2))
    elif found:
        print(f"diff: {len(found)} trap hits on added lines or new files")
        fam = all_detector_ids(ctx)
        for h in found:
            loc = f"{h.repo}/{h.file}" + (f":{h.line}" if h.line else "")
            print(f"  [{h.detector}/{fam.get(h.detector)}] {loc}  {h.text}")
        print("Run `trap_hunt.py detectors` for why each matters and how to fix it.")
    else:
        print("diff: no trap hits on added lines")
    return 1 if found else 0


def cmd_register(ctx, args):
    if args.check:
        errors = check_register(ctx)
        for e in errors:
            print(e)
        print("register: ok" if not errors else f"register: {len(errors)} errors")
        return 1 if errors else 0
    traps = load_register(ctx)
    if args.status:
        traps = [t for t in traps if t.get("status") in args.status]
    if args.md:
        print("| id | repo | family | severity | status | enforcer | summary |")
        print("|---|---|---|---|---|---|---|")
        for t in sorted(traps, key=lambda t: (t.get("status"), ["high", "medium", "low"].index(t.get("severity", "low")))):
            print(f"| {t['id']} | {t['repo']} | {t['family']} | {t['severity']} | {t['status']} | "
                  f"{t['enforcer']} | {t['summary']} |")
        return 0
    by = {}
    for t in traps:
        by.setdefault((t.get("status"), t.get("severity")), []).append(t)
    print(f"{len(traps)} traps")
    for (status, sev), ts in sorted(by.items()):
        print(f"  {status:8s} {sev:6s} {len(ts)}")
    for t in traps:
        if t.get("status") == "open" and t.get("severity") == "high":
            print(f"  open high: {t['id']}  {t['repo']}  {t['summary']}")
    return 0


def cmd_detectors(ctx, args):
    rows = [(d["id"], d["family"], d["why"], d["fix"]) for d in BUILTIN_REGEX]
    rows += [(k, v["family"], v["why"], v["fix"]) for k, v in FUNC_DETECTORS.items()]
    if ctx:
        rows += [(c["id"], c["family"], c.get("why", ""), c.get("fix", "")) for c in ctx.config.get("custom", [])]
        rows += [(t["id"], t.get("family", "copies"), t.get("why", ""), "keep the two in step or merge them")
                 for t in ctx.config.get("twins", [])]
        rows += [(c["id"], c.get("family", "doc_drift"), c.get("why", ""), "correct the doc or the code")
                 for c in ctx.config.get("claims", [])]
    for det, fam, why, fix in rows:
        off = " (disabled)" if ctx and det in ctx.disabled else ""
        print(f"{det} [{fam}]{off}\n  why: {why}\n  fix: {fix}")
    return 0


def find_root(start: Path) -> Path:
    for p in [start, *start.parents]:
        if (p / TRAPS_DIR / "config.json").exists():
            return p
    return start


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="trap_hunt.py", description=__doc__.splitlines()[0])
    ap.add_argument("--root", help="project root holding docs/traps/ (default: nearest parent that has it)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init", help="write a starter docs/traps/config.json")
    p = sub.add_parser("census", help="count every detector's hits by family and repo")
    p.add_argument("--repo", action="append")
    p.add_argument("--json", action="store_true")
    p = sub.add_parser("show", help="list one detector's hits")
    p.add_argument("detector")
    p.add_argument("--repo", action="append")
    p.add_argument("--limit", type=int, default=50)
    p.add_argument("--json", action="store_true")
    p = sub.add_parser("scan", help="fail when any count rose above baseline.json")
    p.add_argument("--repo", action="append")
    p = sub.add_parser("diff", help="trap hits on lines added since the base branch")
    p.add_argument("--repo", action="append")
    p.add_argument("--base", help="base ref (default: the repo's base in config, else origin/HEAD)")
    p.add_argument("--json", action="store_true")
    p = sub.add_parser("ratchet", help="write baseline.json; counts only go down")
    p.add_argument("--init", action="store_true", help="record today's counts as they are")
    p.add_argument("--allow-raise", metavar="REASON", help="accept higher counts, recording the reason")
    p = sub.add_parser("register", help="list, check or render docs/traps/register.json")
    p.add_argument("--check", action="store_true")
    p.add_argument("--md", action="store_true")
    p.add_argument("--status", action="append")
    sub.add_parser("detectors", help="list detectors with why and fix")
    args = ap.parse_args(argv)
    root = Path(args.root).resolve() if args.root else find_root(Path.cwd())
    args.root = str(root)
    if args.cmd == "init":
        return cmd_init(args)
    if args.cmd == "detectors" and not (root / TRAPS_DIR / "config.json").exists():
        return cmd_detectors(None, args)
    ctx = Context(root)
    return {"census": cmd_census, "show": cmd_show, "scan": cmd_scan, "diff": cmd_diff,
            "ratchet": cmd_ratchet, "register": cmd_register, "detectors": cmd_detectors}[args.cmd](ctx, args)


if __name__ == "__main__":
    sys.exit(main())
