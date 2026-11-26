---
name: maintain-verification-skill-advanced
description: "Keep a project's layered verification suite true as the product changes: the tools (seed and backend CLI), the backend end-to-end skill, the run decision skill (local-run), the external feature map, and the product end-to-end skill. Checks the suite's health, then upkeeps each layer in dependency order using the project's own procedures (the tool upkeep skill, the map's audit pass), proves changes with a live run, re-tests the map's recorded Traps (and, only when asked with `fix`, fixes small low-risk product bugs on their own branch), triages findings, and ships proven corrections. Use after the product, the tools or the map have changed, before a release, or when asked to audit the verification. Replaces maintain-verification-skill for projects that have a suite; create-verification-skill-advanced sets the suite up."
disable-model-invocation: true
---

# Maintain the verification suite (advanced)

A suite goes stale in layers. A route or screen changes and the feature map entry is wrong; a seed module or scenario is
added and an entry names the old one; the backend CLI changes and its skill describes the old command; a launch step moves
and the run skill starts a server that no longer exists, or the product skill fails on the first screen. This pass walks the layers in dependency order, uses each layer's own
procedure, and proves what it changes by running it.

It does not repeat what other skills already say. The tool layer is `maintain-cli-tools` (a sibling skill in the same
skills folder: `~/.claude/skills` or `~/.agents/skills`; its helper is `maintain-cli-tools/scripts/check-manifest.py`). The
map layer is the project's own audit pass (`suite.feature_map.audit_procedure`). Which stack a check runs on, how the
standing servers start and what the standing data allows are the run skill's (`suite.skills.run`, usually `local-run`):
this pass follows it and never decides those itself. This skill is the conductor: what to run,
in what order, how to triage, and what to ship.

## Outcomes

Every layer in scope ends with one outcome and a **coverage line** saying what ran and what did not.

- **clean**: the layer's own full check ran, it was exercised live, and nothing needs changing. No branch, no PR.
- **changed**: proven corrections ship, one change per repository. The coverage line still says what was not run.
- **blocked**: the layer's full check or live run could not happen, or a proven fix could not ship safely. Partial
  coverage with nothing found is `blocked: coverage incomplete`, naming what is missing. It is never `clean`.

How the three combine: findings you fixed and proved, with the full check not run, end `changed` and the coverage line
says the check was not run. Findings you did not fix (or could not prove) with coverage incomplete end `blocked`, listing
the findings. Only a layer with no findings and complete coverage is `clean`.

## Edit scope

The suite's own files only: the map folder, the suite's skills and their references, the tools' folders and docs
(under `maintain-cli-tools` rules), and the manifest. Never product code, except in the opt-in fix lane (step 6a), and
only for a fix that meets every criterion there. A behaviour the map describes that the product
no longer has is either doc drift (fix the map) or a product regression (report it; never hide it in the docs). A suspected
product bug written by an earlier author is a claim until you reproduce it: say which of the two states it is in.

## Pass

0. **Locate.** Find `.claude/cli-tools.json` and read its `suite` section. No manifest or no suite: stop and point at
   `create-verification-skill-advanced`. A suite with no `suite.skills.run`, or one that names a skill that does not
   exist, is a missing layer: point at the create skill for it and carry on with the rest, starting stacks only as the
   project's rule files allow. An argument limits the pass to layers; with none, run all in order.

   | Argument | Runs |
   |---|---|
   | `tools` | step 2 for every tool; a tool id (`seed`, `verify`) for one |
   | `backend` | step 2 for the backend CLI tool (kind `verify`) and the seed tool it depends on, then step 3 |
   | `run` | step 3a |
   | `map` | step 4 |
   | `product` | step 5 (it needs step 4's live pass on at least one entry) |
   | `traps` | step 4a only: the Trap sweep over the entries in scope, then step 6 |
   | `fix` | a modifier, off unless the user types it (`traps fix`, `map fix`): turns on the fix lane in step 6a for broken Traps that qualify |

   Step 1 always runs for the whole suite, whatever the argument. A layer argument limits what you fix, not what you read:
   if a failure traces to another layer, report it and either widen the scope or hand it on, never patch around it.
   Read the workspace rules and each owning repo's rule file first. Run `git -C <repo> fetch origin` (it writes only remote
   refs and may need to run outside the sandbox), then check `branch --show-current` and `status --short` for each product
   repo: against the manifest's `ship.base` for a tool's repo, and against `origin/HEAD` for any other (an app may sit on
   a differently named branch); do not build on someone else's uncommitted work there. Uncommitted edits to
   the suite's own workspace files (manifest, map, suite skills) are earlier passes waiting for the user: build on them.
1. **Suite health, read-only.** Commands from a tool's manifest entry run from its `run_from` folder; the map's commands
   run from the workspace root.
   - Run the manifest checker with the manifest's path, the map's `suite.feature_map.check` and `.tests`, and each tool's
     `health` command. Run only what the session may run: a command whose `needs` (server, container, database, build)
     is not available is reported **not run**, never as passing, and the layer it guards cannot be `clean`.
   - Scan each suite skill for frontmatter and for every path and command it names. For paths, run
     `scripts/check-skill-refs.py <skill folder> <workspace root> <each owning repo folder>` (in this skill's folder): it
     tries the workspace root, each repo, the skill's own folder, sibling skills and `~`, and lists what it finds nowhere
     (a lead to check, not a verdict: a path may name a file a command creates). For a command, check the script or binary
     exists and that every flag the skill cites appears in the tool's docs or its code (when the tool has no per-command
     help, the docs and the argument parser are the source; note where `--help` and the docs disagree). A tool may be run
     through a wrapper (`npm run -s cmx --`); the skill must say so once.
   - Look for conflicts: a `verify-<app>` skill, a `features/` folder inside a verify skill, two skills claiming one surface,
     and any suite skill (or map reference) that chooses its own stack, starts servers its own way or restates the
     standing data's rules instead of pointing at the run skill: a second copy that drifts. Trim it to a pointer.
   - List what is wrong, with its layer. Fix errors that block the pass first. Warnings (never verified, old, pointing at
     changed files) name the entries most likely to have drifted; when many read alike, rank the entries by the risk classes
     in the tools' `risk_hints` applied to what each owns, then by how many cited files changed since their `verified` date
     (`git log`), then by size.
   - **Branch skew is not drift.** If the map names a seed module, scenario or route that is missing from the checkout but
     exists on another branch (an unmerged change the map already documents), do not edit the entry to match the checkout
     and do not call the map clean: report it as waiting for that merge (branch and commit), and put those entries aside.
     Check with `git -C <repo> branch -a --contains <commit>` before deciding it is drift. The map's `generate` is run from
     the main checkouts once the repos are on the branches the map describes, and is held while there is skew.
2. **Tools** (`maintain-cli-tools`): run its pass for the tools the argument selects. Its gap reports and proofs are the
   evidence; do not redo them here. A fix to a tool's own doc (a command table, a stale count) is that tool's change in its
   repo, shipped under the manifest's `ship` rules. Anything it changes in names the map uses (a seed module, a kept
   scenario) is carried into step 4.
3. **Backend skill.** Three separate things happen here; do not confuse them.
   - **The full gate runs once, first.** The CLI's full check in a fresh throwaway world serves the tool gap report (step 2),
     this step's `clean` bar and the map's backend half (step 4): run it once, early, keep its report and reuse it. Run it
     again at the end only if the pass changed something it reads. When it fails, compare with the known-failing set the
     manifest's `conventions` or the last pass recorded; bring up a baseline world (the same profile without your change)
     only when a failure is outside that set. Only a difference is yours.
   - **Compare.** (When a tool change made in step 2 is the cause, `maintain-cli-tools` step 6 has already refreshed the
     skill; compare finds drift from any other cause.) Check `verify-backend-e2e` against the CLI's current docs and code: command names, flags, profile names,
     the world steps, the invocation form, and that it names every command this pass needs (a health check, a single-scenario
     replay with cleanup); a missing one is drift in the skill, to fix from the tool's docs.
   - **Exercise** (one real check, to prove the skill's own steps work). Choose the check: with a diff in question, a kept
     scenario the CLI's impact command names (impact on non-test files; the map's plan command over-matches on test files).
     With none, take the newest merged change to the backend repo (`git log -1 --merges origin/<base>`, then impact over
     `<merge>^1..<merge>`); if impact names no scenario (a docs, test or tools-only merge), take the most recently added
     scenario file (`git log --diff-filter=A -1 -- <scenarios folder>`). Bring up a throwaway world with the smallest seed
     profile that holds every module the scenario's `seedModules` lists (the seed tool's module list says which profiles
     hold each). Then: start the world, health-check it (see the hard rules), replay the scenario with cleanup (the
     scenario's own database steps are its stored-effect check; a separate database read needs a session started first),
     tear the world down. Exploring, exporting and the full gate belong to a change under development and to the gate
     above, not here. A scenario refused for its profile is drift in the skill's profile advice, not a failure to skip. A
     step that fails is drift in the skill or a tooling gap: fix it under the edit scope and run it again.
3a. **Run skill.** Compare it with what it drives: every launch-config entry name and port it cites exists in
   `suite.launch` (and no entry the checks need is missing from it); its status helper and other scripts exist and run;
   its session inputs (project, targets, seed flags) match the runner's targets command (the `runner` tool's inventory)
   and the seed skill; its world row names the backend skill's commands; its standing-data rules agree with the
   manifest's `protected` lists (the stricter wins; report a conflict). Exercise it once: run the status helper, take the
   row its table gives for this pass's live check, start only what that row needs, reuse what is already served by this
   checkout, and stop what you started. A step that fails is drift in the skill: fix it and run it again.
4. **Feature map.** Follow the audit procedure for the entries in scope: the backend half (the full gate above, never a
   second run), an optional source wave of read-only agents (one per entry, citing file and line, never driving a browser or
   editing), then the live pass. Order by risk: money, sign-in, deletion, shared data first. Mark a step "(seen)" with the
   date only after you drove it; move an entry's `verified` date only when every sub-feature got a live pass.
   **4a. Trap sweep.** For each entry in scope, take every Trap that says "found broken on <date>", records an unreachable
   prerequisite, or carries a claim a person wrote from reading code ("appears to", "not diagnosed"). Re-test it on the
   isolated session against the code as it is now, by the cheapest route that shows it (the API call or the screen the Trap
   names). Mark each one in the entry, with today's date:
   - **still broken**: keep the Trap, add the fresh evidence (what you did, what you saw) and the commit it was seen on;
   - **fixed**: the behaviour now works; remove the Trap, correct the entry's steps and rules, and note the fix's commit if
     `git log` shows it;
   - **cannot reproduce**: say what you tried; keep the Trap marked unconfirmed, never delete it;
   - **now unreachable**: record the prerequisite you lacked.
   A Trap that is only a caution (a quirk, a limit) is not re-tested unless its text names a check; read it and move on.
5. **Product skill.** The live pass of step 4 is its exercise: launch, login, drive, evidence and clean-up are used on
   every entry. A failure in launch, login or driving that is not the product's fault is drift in `verify-product-e2e` (or
   its references): fix it, re-drive the step, and carry on. A surface the harness cannot reach (no in-app browser, no
   emulator) is *unreachable* with that prerequisite, never verified another way. Pick and start the stack only through the
   run skill: take the row its decision table gives (say which), and follow its rules for busy ports, a second API, data
   the standing database lacks, and stopping. Where the run skill does not cover a case, follow the project's rule files
   and the stricter reading: never a second API on one database and cache, never a runner's automatic alternative port
   for an API a client is wired to. If the session cannot start what the row needs, the live pass is **not run** and the
   layer is `blocked`. Writes and rate-limit trips go only where the run skill's data rules allow.
6. **Triage each finding:**
   - an entry or skill that is wrong or thin: doc drift, fix it;
   - a behaviour a skill cannot drive: a tooling gap, fix the skill or tool and re-drive it;
   - a behaviour that is actually broken: a product gap, report it and record it in the entry's Traps as "found broken on
     <date>", never as intended behaviour (with `fix` typed, see step 6a);
   - a sub-feature that cannot be reached: record the prerequisite and the route tried; if the entry never named it, that is
     drift too.

   **6a. Fix lane (only when the user typed `fix`).** A product gap that is still broken after the sweep may be fixed only if
   **every** one of these holds, each checked and written down:
   1. the cause is established (you read the code path and reproduced it), not guessed;
   2. the fix is in one file or one small area, about 20 lines, with no migration and no new dependency;
   3. a failing test can be written first at a layer the project's rules name (a unit test, a kept scenario), and it
      fails for the reason the Trap describes;
   4. it touches no money, sign-in or permissions, deletion, or data shared across users or clubs;
   5. it changes no request or response shape that an installed client depends on (for example `/api/user/*`, where an old
      app stays live), and no wording or rule that is an open question for the user;
   6. there is no product decision hidden in it (a rule that could reasonably go either way is a question, not a bug).
   One that fails any criterion is **reported, not fixed**, with the criterion it failed. One that passes goes through the
   project's own flow for that repo, as any implementation work: its plan doc first (in the repo's plan folder), a branch off
   the repo's base with the project's no-tracking rule, the failing test, the fix, the layer's proof plus the Trap's own
   steps re-run on the isolated session, then commit and push the branch under the project's rules. Opening a pull request
   needs the user's go-ahead; never merge. One branch per repository, a small batch (three fixes at most per pass), and
   the entry's Trap is updated to "fixed on branch <name>, pending merge" only after the proof, then confirmed fixed by the
   next sweep once the branch has merged. Stop the lane at the first fix that does not prove cleanly and report it.
7. **Ship or stop.** For `changed`: follow the manifest's `ship` rules, one reviewed change per repository, every changed
   file re-read first; changes to workspace files (the map, the suite skills, the manifest) stay uncommitted for the user
   unless the project says otherwise. Run the map's closeout and check last. Final teardown comes after the last drive,
   including re-proofs; evidence survives it.

## Report

Per layer: the outcome, the coverage line, what changed, what was left. For the map: entries fully verified, steps seen
out of total per entry, steps unreachable and why, product gaps found, scenarios skipped. For the Trap sweep: each Trap
re-tested with its new state (still broken, fixed, cannot reproduce, now unreachable). For the fix lane: each fix attempted
(branch, test, proof) and each broken Trap not fixed, with the criterion it failed. Name worlds and sessions you left
running (none, ideally) and what you added to any local database. Keep short run notes (layers covered, drift confirmed,
unreachable prerequisites) in one scratch location, the session's scratchpad or the project's gitignored scratch folder,
never the operating system's temp folder (it differs between sandboxed and unsandboxed commands); do not commit them.

## Hard rules

- Never drive an instance you have not health-checked since it last did something surprising: run the tool's health
  check against a world or server before the first drive, and again after any failed drive. That is its `doctor` verb
  where it has one (`cmx doctor`); a CLI without one (`iwx`) uses its readiness command (`iwx wait --target <url>`)
  plus one read-only call as a low-privilege login.
- Writes go to a throwaway world, a session, or a local database the run skill names as free to use, within its rules.
  Never a shared environment, never a protected standing database, never a reseed of one.
- Never weaken a step or an assertion to make it pass. A seed state the seed lacks fails the step; record why.
- Check what an earlier author or a subagent wrote against the screen or the code: labels, environment facts and "this is
  broken" claims are all checked before they are kept.
- Without the `fix` argument, never edit product code. With it, only a fix that passed every criterion in step 6a, in its
  own branch and plan, and never a fix on a sign-in, money, permissions or deletion path.
- Stop what you started, and say what you left behind.
