#!/usr/bin/env python3
"""List the paths a skill (and its references) names that cannot be found.

Usage: check-skill-refs.py <skill folder> <workspace root> [<repo folder> ...]

Takes every backtick span in SKILL.md and references/*.md that looks like a path (it contains a slash, or ends in a known
file extension), skips placeholders (<...>, ..., {{...}}), globs and URLs, and tries it against the workspace root, each
repo folder, the skill's own folder, the folders of sibling skills, and ~. Prints the ones found nowhere, with file and
line. Exit 0 when none are missing, 1 when some are, 2 on bad usage. A hit is a lead, not a verdict: a path may name a
file the command creates.
"""
import re
import sys
from pathlib import Path

EXT = (".md", ".json", ".js", ".py", ".sh", ".yml", ".yaml", ".csv", ".mjs", ".ts", ".dart", ".txt")
SPAN = re.compile(r"`([^`\n]+)`")


def candidate(span):
    s = span.strip()
    if " " in s or s.startswith(("http", "-", "$", "<", "npm ", "git ", "node ", "python")):
        return None
    if any(t in s for t in ("<", ">", "...", "{{", "*", "?", "|", "=", "(", ")")):
        return None
    s = s.split(":")[0] if re.search(r":\d+$", s) else s
    if "/" in s and s.endswith(EXT + ("/",)) or (s.count("/") >= 1 and not s.endswith(("/", ".")) and "." in s.rsplit("/", 1)[-1]):
        return s.rstrip(".,;")
    if s.endswith("/") and s.count("/") >= 1:
        return s.rstrip("/")
    return None


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    skill = Path(argv[1]).resolve()
    root = Path(argv[2]).resolve()
    repos = [Path(a).resolve() for a in argv[3:]]
    bases = [root, *repos, skill, skill.parent, *(p for p in skill.parent.iterdir() if p.is_dir()), Path.home()]
    files = [skill / "SKILL.md", *sorted((skill / "references").glob("*.md"))] if (skill / "references").exists() else [skill / "SKILL.md"]
    missing = []
    for f in files:
        if not f.exists():
            continue
        for n, line in enumerate(f.read_text().splitlines(), 1):
            for span in SPAN.findall(line):
                rel = candidate(span)
                if not rel:
                    continue
                rel = rel.lstrip("~/") if rel.startswith("~/") else rel
                if not any((b / rel).exists() for b in bases):
                    missing.append((f.relative_to(skill), n, span))
    if missing:
        print(f"{len(missing)} path(s) not found from {skill.name}")
        for f, n, span in missing:
            print(f"  {f}:{n}  {span}")
        return 1
    print(f"{skill.name}: every named path found")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
