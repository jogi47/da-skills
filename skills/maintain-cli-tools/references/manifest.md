# The cli-tools manifest

One JSON file per project, kept in the project's workspace (normally `.claude/cli-tools.json`). It says what the
project's tools are and how to measure, extend and prove them, so the skill itself stays project-neutral. JSON, not
YAML, so `scripts/check-manifest.py` needs nothing installed.

Paths (`path`, `docs`, `attached_skills`, `repo`, `where`) are relative to the manifest's workspace root (the folder
holding `.claude/`). Commands in `health`, `inventory`, `gap_report` and `proof` run from the tool's `run_from` folder,
so a command that reaches into the workspace writes the path from there (`../.claude/...`). `closeout` commands run from
the workspace root.

## Top level

| Field | Meaning |
|---|---|
| `version` | `1` |
| `project` | short name, for reports |
| `rules` | workspace rule files to read first |
| `after` | skills to point at when a pass changed names the feature map uses (`maintain-verification-skill-advanced` for a project with a suite) |
| `tools` | list of tool objects |

## The `suite` section (optional)

Names the verification suite the tools belong to. `create-verification-skill-advanced` writes it and
`maintain-verification-skill-advanced` reads it. Paths are relative to the workspace root, and commands run from it.

| Field | Meaning |
|---|---|
| `suite.feature_map.dir` | the map folder (index, entries, inventory) |
| `suite.feature_map.skill` | the `feature-map` skill folder |
| `suite.feature_map.check` | the command that says whether the map is current |
| `suite.feature_map.closeout` | the command that lists what a change leaves to update |
| `suite.feature_map.tests` | the command that runs the map script's own tests |
| `suite.feature_map.audit_procedure` | the file that describes the map's audit pass |
| `suite.skills.seed`, `.backend`, `.product` | the seed, backend and product verification skills |
| `suite.launch` | the launch config the product skill starts servers from |
| `suite.surfaces` | plain names, as people say them, of what the product skill covers, for reports (for example portal, admin console, website, app; add API only if the skill drives it as a surface) |

## A tool

| Field | Meaning |
|---|---|
| `id` | `seed`, `verify`, or another short id; what a request names |
| `kind` | `seed` or `verify`; selects the measuring hints in the skill |
| `repo` | the product repo that owns it; its rule file governs |
| `path` | the tool's folder |
| `docs` | docs that describe the tool; read in step 1, refreshed in step 6 |
| `attached_skills` | skills that document or drive the tool; refreshed in step 6 |
| `run_from` | folder commands run from |
| `needs_outside_sandbox` | commands that need Docker or the network, so cannot run in a sandbox |
| `health` | one read-only command that says whether the tool works on this machine |
| `protected` | list of standing databases and environments the pass must never write to or reseed |
| `risk_hints` | object: risk class (`money`, `sign-in`, `deletion`, `permissions`, ...) to a list of route or file fragments; the pass uses it to rank gaps, since a ledger gives every gap the same reason |
| `inventory` | `{what, command, needs}` list: what exists now (modules, profiles, scenarios), including a command that finds the scenarios or modules mentioning a given route or state |
| `gap_report` | `{what, command, needs}` list: the tool's own account of what it does not cover |
| `gap_sources` | `{what, where}` list: other places that name gaps (feature entries, skipped scenarios) |
| `conventions` | where a new item goes, how it is registered and named; points at the doc that says so |
| `proof` | `{what, command, needs}` list: how to prove an addition |
| `closeout` | commands that check the neighbours (feature map, tests) after a change |
| `depends_on` | other tool ids this one reads from or feeds |
| `never` | project-specific prohibitions, in plain sentences |
| `ship` | `{base, plan_dir, rules}`: where changes branch from, where a plan doc goes, branch and review rules |

`needs` says what a command requires to run: `none` (pure, reads files), `db` (a local database), `api` (a running API)
or `docker` (a throwaway world). The pass runs only the commands it can satisfy and marks the rest unmeasured.
A command may contain `<placeholders>` that the pass fills in (a world name, a file). Keep each command one line.

## Short example

```json
{
  "version": 1,
  "project": "demo",
  "rules": ["CLAUDE.md"],
  "after": ["maintain-verification-skill"],
  "tools": [
    {
      "id": "verify",
      "kind": "verify",
      "repo": "demo-backend",
      "path": "demo-backend/tools/check",
      "docs": ["demo-backend/docs/check-cli.md"],
      "attached_skills": [".claude/skills/verify-backend-e2e"],
      "run_from": "demo-backend",
      "needs_outside_sandbox": ["world up"],
      "health": "npm run check -- doctor",
      "protected": ["the standing local database"],
      "risk_hints": { "money": ["payment", "refund"], "sign-in": ["auth", "login"], "deletion": ["delete", "remove"] },
      "inventory": [{ "what": "kept scenarios", "command": "ls tools/check/scenarios", "needs": "none" }],
      "gap_report": [{ "what": "routes no scenario reaches", "command": "npm run check -- ledger", "needs": "none" }],
      "gap_sources": [{ "what": "not-covered lines", "where": "docs/features/*.md" }],
      "conventions": "demo-backend/docs/check-cli.md, section 'Kept scenarios'",
      "proof": [{ "what": "replay one scenario", "command": "npm run check -- replay <file> --cleanup", "needs": "docker" }],
      "closeout": ["python3 scripts/feature_map.py check"],
      "depends_on": ["seed"],
      "never": ["Never run a write against a shared database."],
      "ship": { "base": "main", "plan_dir": "demo-backend/docs/plans", "rules": "one draft PR per tool" }
    }
  ]
}
```
