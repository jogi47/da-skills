# docs/traps/ file formats

All three files are JSON so the scanner needs nothing beyond the Python standard library.

## config.json

```json
{
  "project": "name",
  "repos": [
    {"name": "api", "path": "api", "base": "origin/dev"}
  ],
  "exclude": ["lang/*", "tools/seed/*"],
  "documented": ["docs/readme-docs/*traps*.md", "docs/feature-map/features/*.md"],
  "thresholds": {"large_file_lines": 1500},
  "disable": ["todo-marker"],
  "basename_ignore": ["schema.*"],
  "function_ignore": ["handleClick"],
  "config_key_ignore": ["Logging"],
  "misspellings": ["knowoput"],
  "custom": [
    {"id": "raw-status", "family": "magic_codes", "repos": ["api"], "exts": [".js"],
     "names": ["Jenkinsfile*"], "regex": "eStatus\\s*===\\s*'[a-z]'", "flags": "m",
     "why": "...", "fix": "..."}
  ],
  "twins": [
    {"id": "shared-twins", "a": "portal/src/shared", "b": "admin/src/shared", "exclude": ["*.md"],
     "family": "copies", "why": "..."}
  ],
  "claims": [
    {"id": "react-version", "doc": "rules/portal.md", "doc_regex": "React (\\d+)",
     "source": "portal/package.json", "source_regex": "\"react\": \"\\^?(\\d+)", "why": "..."}
  ],
  "fix_route": {
    "rules": "where each repo's agent rules live",
    "plans": "where a plan doc goes",
    "verify": ["how a fix is proved"],
    "security": "where an unfixed security finding may be written",
    "notes": "anything else a fixer must respect"
  }
}
```

- `repos[].path` is relative to the project root, or absolute. `base` is the branch PRs target; `diff` uses it.
- `exclude` adds to the built-in list (dependencies, build output, tests, migrations, generated code, lockfiles). Patterns match the repo-relative path at any depth.
- `documented` globs are relative to the project root. Files with trap, gotcha or pitfall in the name count `###` headings; other files count bullets under headings that mention traps.
- `custom` detectors default to code files; `exts` and `names` (basename globs) narrow them; `repos` limits them; `flags` is any of `i`, `m`, `s`.
- `twins` hit once per file present in both folders with different content. `claims` hit when either regex finds nothing or the first groups differ.
- Every detector id (built-in, custom, twin, claim) is a key in the baseline and may be named in a register entry.

## register.json

```json
{"traps": [
  {"id": "BE-ESCAPE-COPIES", "repo": "api", "family": "copies", "severity": "high",
   "summary": "one line",
   "where": "path/file.js:12; other/file.js:40",
   "harm": "what an agent would do wrong",
   "documented_in": ["docs/readme-docs/x-traps.md"],
   "detector": "duplicate-function",
   "enforcer": "nudge",
   "status": "open",
   "plan": "path to the plan doc or null",
   "found": "2026-11-28"}
]}
```

- `repo`: a repo name from the config, or `*` for cross-repo.
- `family`: one of the twelve in `families.md`.
- `severity`: `high` (an agent following the obvious path breaks production, money, data or security), `medium` (wrong behaviour or wasted work), `low` (friction).
- `enforcer`: the highest thing that stops the trap today: `none`, `doc`, `nudge`, `check`, `test`, `type`, `architecture`.
- `status`: `open`, `planned` (a plan exists), `fixed`, `accepted` (kept on purpose, with the reason in `harm` or `summary`).
- `register --check` validates every field, unique ids, known repos and known detectors.

## baseline.json

Written only by `ratchet`.

```json
{"updated": "2026-11-28",
 "counts": {"silent-catch": {"api": 17, "web": 21}, "todo-marker": {}},
 "raised": [{"date": "2026-12-01", "detector": "silent-catch", "repo": "api", "from": 17, "to": 18,
             "reason": "vendored SDK file"}]}
```

Every detector has a key, even at zero, so a trap that returns after a fix fails `scan`. A detector added after the baseline is reported as new until the next `ratchet`.
