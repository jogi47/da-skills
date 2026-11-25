#!/usr/bin/env python3
"""Check a project's cli-tools manifest: required fields, known kinds, existing paths, named commands.

Usage: check-manifest.py <path to cli-tools.json>
The workspace root is the folder that holds the manifest's parent folder (the .claude folder), or the manifest's own
folder when it does not sit in .claude. Exit 0 when clean, 1 when there are problems, 2 on bad usage.
"""
import json
import sys
from pathlib import Path

REQUIRED_TOOL = ["id", "kind", "repo", "path", "docs", "attached_skills", "run_from", "health", "protected",
                 "risk_hints", "inventory", "gap_report", "conventions", "proof", "closeout", "ship"]
KINDS = {"seed", "verify"}
NEEDS = {"none", "db", "api", "docker"}
PAIR_LISTS = {"inventory": "command", "gap_report": "command", "proof": "command", "gap_sources": "where"}


def main(argv):
    if len(argv) != 2:
        print(__doc__)
        return 2
    manifest = Path(argv[1]).resolve()
    try:
        data = json.loads(manifest.read_text())
    except (OSError, ValueError) as err:
        print(f"cannot read {manifest}: {err}")
        return 2
    root = manifest.parent.parent if manifest.parent.name == ".claude" else manifest.parent
    problems = []

    def need_path(owner, rel, glob_ok=False):
        if glob_ok and any(ch in rel for ch in "*?["):
            if not list(root.glob(rel)):
                problems.append(f"{owner}: no file matches {rel}")
        elif not (root / rel).exists():
            problems.append(f"{owner}: missing path {rel}")

    if data.get("version") != 1:
        problems.append("version must be 1")
    for key in ("project", "tools"):
        if not data.get(key):
            problems.append(f"missing top-level field: {key}")
    for rel in data.get("rules", []):
        need_path("rules", rel)

    ids = set()
    for tool in data.get("tools", []):
        tid = tool.get("id", "?")
        if tid in ids:
            problems.append(f"duplicate tool id {tid}")
        ids.add(tid)
        for field in REQUIRED_TOOL:
            if field not in tool or tool[field] in ("", [], None):
                problems.append(f"{tid}: missing field {field}")
        if tool.get("kind") not in KINDS:
            problems.append(f"{tid}: kind must be one of {sorted(KINDS)}")
        for field in ("repo", "path", "run_from"):
            if tool.get(field):
                need_path(f"{tid}.{field}", tool[field])
        for rel in tool.get("docs", []) + tool.get("attached_skills", []):
            need_path(f"{tid}.docs/attached_skills", rel)
        for field, key in PAIR_LISTS.items():
            for item in tool.get(field, []):
                if not isinstance(item, dict) or not item.get(key) or not item.get("what"):
                    problems.append(f"{tid}.{field}: each entry needs 'what' and '{key}'")
                elif field == "gap_sources":
                    need_path(f"{tid}.gap_sources", item["where"].split()[0], glob_ok=True)
                elif item.get("needs") not in NEEDS:
                    problems.append(f"{tid}.{field}: '{item['what'][:40]}' needs 'needs' as one of {sorted(NEEDS)}")
        for dep in tool.get("depends_on", []):
            if dep not in {t.get("id") for t in data.get("tools", [])}:
                problems.append(f"{tid}: depends_on names unknown tool {dep}")
        ship = tool.get("ship", {})
        for key in ("base", "plan_dir", "rules"):
            if not ship.get(key):
                problems.append(f"{tid}.ship: missing {key}")

    suite = data.get("suite")
    if suite is not None:
        fmap = suite.get("feature_map", {})
        for key in ("dir", "skill", "audit_procedure"):
            if not fmap.get(key):
                problems.append(f"suite.feature_map: missing {key}")
            else:
                need_path(f"suite.feature_map.{key}", fmap[key])
        for key in ("check", "closeout", "tests"):
            if not fmap.get(key):
                problems.append(f"suite.feature_map: missing {key}")
        for key in ("seed", "backend", "product"):
            rel = suite.get("skills", {}).get(key)
            if not rel:
                problems.append(f"suite.skills: missing {key}")
            else:
                need_path(f"suite.skills.{key}", rel)
        if not suite.get("launch"):
            problems.append("suite: missing launch")
        else:
            need_path("suite.launch", suite["launch"])
        if not suite.get("surfaces"):
            problems.append("suite: missing surfaces")

    if problems:
        print(f"{manifest}: {len(problems)} problem(s)")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"{manifest}: ok ({len(ids)} tool(s): {', '.join(sorted(ids))})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
