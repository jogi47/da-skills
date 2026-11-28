---
name: trap-hunt
description: Find and fix the traps in a project - code, pipelines and docs that lead a coding agent (or a new starter) to a wrong change, hidden technical debt, gotchas and needless complexity - whether they are written down somewhere or not. Runs a standard-library scanner over every repo in the project (silent catches, env fallbacks to other environments, soft CI gates, magic status codes, drifted copies, misspelt and duplicate names, giant files, dead config keys, docs that contradict code), keeps one register of confirmed traps and a baseline whose counts only go down, and fixes each trap at the highest level it can (architecture, type, check, test, note last) in the repo that owns it. Use when asked to audit a repo or workspace for traps, gotchas, tech debt or agent safety; when agents keep making the same mistake; before a PR to check a branch adds no new trap (`diff`); and when setting up a new project for it (`init`). One global skill; each project keeps only its data in docs/traps/.
disable-model-invocation: true
---

# Trap hunt

A trap is anything in a project that makes the locally obvious change wrong: a helper with six drifted copies, a status code that means different things in two enums, a pipeline step that cannot fail, a doc that says the opposite of the code, an env var that silently falls back to another environment. Agents fall into traps because they see a few files, copy the nearest example and trust what is written. This skill finds traps, records them in one place, and removes them so the next contributor cannot fall in.

The skill is project-neutral. Everything project-specific lives in the project's `docs/traps/`:

| File | Holds | Written by |
|---|---|---|
| `config.json` | repos and their base branches, excludes, thresholds, project detectors, twin folders, doc claims, the fix route | you, once, then kept current |
| `register.json` | every confirmed trap: where, harm, family, severity, detector, enforcer level, status | you, as traps are confirmed and fixed |
| `baseline.json` | today's hit count per detector per repo | `trap_hunt.py ratchet` only |

Schemas: [references/register-and-config.md](references/register-and-config.md). The twelve trap families, how each hurts and how each is fixed: [references/families.md](references/families.md).

## The scanner

`scripts/trap_hunt.py`, Python 3 standard library, no install. Run it from the project root (it finds `docs/traps/` in the nearest parent) or pass `--root`. Call it by its full path, for example `python3 <this skill>/scripts/trap_hunt.py census`.

| Command | Does |
|---|---|
| `init` | Write a starter `config.json` listing the git repos under the root |
| `census [--json]` | Count every detector's hits by family and repo, plus documented traps and the register |
| `show <detector> [--repo R] [--limit N]` | List one detector's hits with file and line |
| `scan` | Compare with the baseline; exit 1 when any count rose |
| `diff [--base REF]` | Hits on lines added since the base branch, in every repo; exit 1 when the branch adds a trap |
| `ratchet [--init] [--allow-raise REASON]` | Write the baseline; counts only fall unless a reason is given |
| `register [--check] [--md] [--status S]` | Summarise, validate or render the register |
| `detectors` | Every detector with its family, why it matters and how to fix it |

A detector hit is a lead, not a trap. Only a hit you have read and judged harmful goes in the register.

## Setting up a project

1. `init`, then edit `config.json`: base branch per repo (the branch PRs target), excludes for generated code, catalogues, seed data and fixtures, the files where the project already documents traps (`documented`), and `fix_route` from the project's own rules (where agent rules live, where plans go, which skills or commands prove a fix, where security findings may be written).
2. `census`. Read a sample of each detector's hits with `show`. Where a built-in detector is noisy for this project, add an exclude or put its id in `disable`; never loosen a detector to make a count look better.
3. Harvest what is already written: the project's trap docs, feature notes, rule files, memory notes, past corrections. Each becomes a register entry with `documented_in` filled and `enforcer` set honestly (`doc` when only prose stands behind it).
4. Sweep for what is not written: one read-only agent per repo or repo group, briefed with [references/sweep-brief.md](references/sweep-brief.md). Confirm each finding against the code before it goes in the register.
5. Add project detectors for the confirmed traps a regex can find (`custom`), folders that should stay in step (`twins`), and doc statements that must equal a value in code (`claims`). Prove each one: `show` must list the known instance and nothing silly.
6. `register --check`, then `ratchet --init`. From now on `scan` fails only on new hits.

## The loop

1. **Find.** `census` for the whole picture, `diff` for a branch, a sweep for what no detector covers, and the project's transcript or correction history for mistakes that repeat (the `correct` skill does that mining).
2. **Confirm.** Open the code. Write the harm as what an agent would do wrong, in one sentence. No harm, no entry.
3. **Register.** One entry per trap, with the family, severity and `where` (file and line). Link a detector when one finds it; write one when a regex can.
4. **Choose the fix level.** Climb as high as the trap allows, in this order:
   1. architecture: the wrong thing cannot be written (one shared helper, one writer per table, a registry instead of a switch, the generated copy instead of the hand copy);
   2. type: the compiler rejects it (an enum instead of a string, pence as an integer type);
   3. check: a lint rule, test or pipeline step whose failure message names the fix;
   4. nudge: the scanner's ratchet or a closeout warning;
   5. note: a line in the repo's rules, only when nothing above fits.
   The `agent-proof-architecture` skill holds the rules behind levels 1 to 3, `codebase-design` the vocabulary when a fix reshapes a module.
5. **Fix in the owning repo**, under that repo's rules as `fix_route` names them: a plan doc where the project puts plans when the fix spans files or changes behaviour, a failing test first (`tdd`), and proof at the layer the change runs in with the project's verify skills. A gate the repo needs in CI goes into that repo as its own test or lint, with no reference to the scanner or the workspace; the scanner stays the cross-repo view. Prefer the smallest fix that removes the trap; do not refactor around it.
6. **Ratchet and record.** `ratchet` to lock the lower count, set the entry to `fixed` with its new `enforcer`, and update the project's trap doc or rule file when what an agent must know has changed.

## Rules

- Read before you register. Regex counts are leads; a register entry names a real file and a real harm.
- Never rename what production depends on (env keys, routes, collection or table names, public package names) as a trap fix. Register it as `accepted` with the reason, and plan the rename separately if it is worth it.
- Dead code: follow the project's rule. Where none exists, add a warning header naming the live replacement rather than deleting.
- Security findings go where the project's `fix_route.security` says, never into a file a client or other vendor can read before the fix ships.
- `--allow-raise` needs a reason a reviewer would accept ("vendored file", "generated by the SDK"), not "too many to fix".
- The scanner never writes to product repos. It reads them and writes only `docs/traps/`.
- Do not copy this skill into a project. Projects keep data; the skill stays here.

## Before a PR

Run `diff` for the project. Every hit on an added line is either fixed, or explained in the PR as deliberate. When the project has a closeout or pre-PR checklist, add `trap_hunt.py diff` to it rather than relying on memory.

## Related skills

- `agent-proof-architecture`: the rules for making the wrong change fail; the static baseline per stack.
- `correct`: turn a mistake agents keep repeating into a guard; mines transcripts.
- `codebase-design`, `improve-codebase-architecture`: when the fix is deepening a module.
- `tdd`, `principle-prove-it-works`, `principle-fix-root-causes`: how the fix itself is made and proved.
