# The suite's layers: what to look for, what exists means

Names below are the ones both current projects use. A project may name a thing differently; the manifest's `suite`
section is the source when it exists, and detection is the fallback.

## 1. Feature map (outside every skill)

- **Detect:** a folder with an index (`README.md`), `features/<feature>.md` entries, a generated `inventory.json`, and a
  list of items owned by no entry (`unmapped.md`); and a skill `feature-map` whose `scripts/` holds a checker with at
  least `check`, `plan`/`which` and `closeout`, and whose `references/` holds an audit procedure.
- **Exists means:** the index lists the entries, the checker runs, and `check` exits 0 (warnings allowed). Entries that were
  never verified live, or that point at changed files, are upkeep owed, not a missing layer. Use the manifest's
  `suite.feature_map.check`, which may carry flags (a repo path) that the bare command lacks.
- **A red `check` can be the missing layer showing:** entries that name a skill that does not exist make the check report
  "unknown names". Record the map as exists, check red because that layer is missing; it clears when the layer is created.
- **Missing / partial:** no folder or no entries = missing. Entries but no checker = partial: the checker is a prerequisite
  (a plan of its own), the entries can still be written.
- **Never put it inside a verify skill.** Every verify skill reads the map; none owns one.

## 2. Seed

- **Detect:** a seed tool in the backend (`tools/seed`, `tools/<Name>.Seed`) with `--list` and `--plan`, a doc for it, and
  a skill `seed-test-data`.
- **Exists means:** the tool lists modules and profiles without a database, and the skill says which profile and login a
  check needs and what to do when a state is not seeded.
- **Missing tool:** a prerequisite. Report it; do not write one here.

## 3. Backend verification

- **Detect:** a backend CLI (`tools/cmx`, `tools/iwx`) with worlds, `call`, `export`, `replay`, `verify`, a route ledger;
  kept scenarios; a review playbook doc; a skill `verify-backend-e2e`.
- **Exists means:** the skill's commands exist in the CLI's docs, and one kept scenario replays in a world.
- **Missing CLI:** a prerequisite. Report it.

## 4. Product verification

- **Detect:** a skill `verify-product-e2e` with `references/` per family of surfaces (for example browser-driven screens,
  and the app) and a common file for routes, second views and clean-up; a launch config (`.claude/launch.json`); a session runner when the project has one
  (`agent-test`, via the `test-session` skill, which may be installed globally and not in the workspace).
- **Exists means:** its launch and login steps work, and one mapped sub-feature can be driven to a verified, unreachable
  or failed ending.
- **Prerequisites:** the map (layer 1), the backend skill (layer 3), an in-app browser in the harness for the screens.

## 5. Upkeep

- **Detect:** `.claude/cli-tools.json` with each tool, its attached skills, its gap report and proof commands; and the
  `suite` section.
- **Exists means:** `maintain-cli-tools/scripts/check-manifest.py` passes.

## Leftovers and conflicts to look for

- A `verify-<app>` skill, or any verify skill with its own `features/` folder: output of the generic skill. Often an empty
  shell (a `features/` folder and a `scripts/` folder, no `SKILL.md`). Report it; the user decides.
- Two skills that both claim "verify the product" or "verify the backend".
- A skill whose `description` promises a command, path or tool that no longer exists.
- A map entry naming a seed module or scenario that does not exist (the checker reports this).

## What this skill never creates

A seed CLI, a backend CLI, the feature-map generator and its extractors, a launch config for a stack the project does
not run. Each is a prerequisite; the project's plan-first workflow builds it.
