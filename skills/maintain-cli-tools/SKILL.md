---
name: maintain-cli-tools
description: "Keep a project's seed tool and verification tool, and the skills that document them, covering the product as it is now: measure what the tool does not cover with its own gap report, extend what exists, add the missing seed modules or end-to-end scenarios, prove each addition, refresh the attached skills, and ship one reviewed change per tool. Use when asked to maintain, update or extend a project's seed CLI or verification CLI (for example cmx or iwx), or after the product has changed enough that the seed data or scenarios may have fallen behind. Needs the project's cli-tools manifest."
disable-model-invocation: true
---

# Maintain CLI tools

A project's seed tool builds the data a check needs. Its verification tool drives the running API and proves what comes
back. Both go stale quietly: the product grows a route, a state or a role, and nothing fails until someone needs it.
This skill is the upkeep loop. It measures what the tool does not cover, fills the gaps in small proven batches, and
keeps the skills that describe the tool true.

It keeps the **tools**. Its sibling `maintain-verification-skill-advanced` keeps the rest of the suite: the verification
skills and the feature map (and calls this skill for the tool layer).
Run this one first when the tools changed, then that one, because a new seed module or scenario can invalidate a feature
map entry's data, logins or scenario names.

## Outcomes

Pick one, and say which:

- **clean**: every tool in scope was measured and nothing worth adding was found. No branch, no PR.
- **changed**: one reviewed change per tool ships proven additions and corrections.
- **blocked**: measuring or proving could not finish, or a proven change could not ship safely. Say exactly what blocked it.

Every tool ends with a coverage line saying what ran and what did not. They combine like this: additions you proved and
shipped, with a source unmeasured, end `changed` (the coverage line names the source). Findings you could not ship, or
partial coverage with nothing found, end `blocked`. Only complete coverage with no gaps left is `clean`. (This is the same
rule `maintain-verification-skill-advanced` uses, so a pass called from it reports the same way.)

## Edit scope

Edit only what the manifest lists for the tool: the tool's folder, its docs, and the skills attached to it, plus the
manifest itself when it lacks a command or a hint. Never edit product code. Files in the project's workspace (the
manifest, attached skills, feature map) are edited in the working tree and left uncommitted for the user, unless the
manifest's `ship` rules say otherwise. A gap that turns out to be a product defect is reported, and recorded the way the tool records a known
defect (a pending scenario), not fixed here and not hidden by loosening an assertion. A gap that is partly a seed
fault and partly a product question: build the seed side without changing any shared default (an added module or
parameter), and put the product question in the report for the user.

## The manifest

The project says what its tools are in `cli-tools.json` (the project's workspace holds it, normally `.claude/cli-tools.json`).
Field meanings and a short example: [references/manifest.md](references/manifest.md). What a seed or verification tool
must offer to be maintainable by this skill (and the checklist for planning a new one): [references/tool-blueprint.md](references/tool-blueprint.md). Check it with
`scripts/check-manifest.py <path>` before relying on it: it confirms the shape, that the paths exist and that every
command is named, but not that a command runs; the `health` command shows that. Each command says what it `needs`
(`none`, `db`, `api` or `docker`), so a pass knows what it can run now. The skill never invents a command: if the manifest
lacks one the pass needs, add it to the manifest after reading the tool's docs, and say so.

## Pass

0. **Locate.** Find the manifest by walking up from the working directory. None: stop, and offer to write one from
   `references/manifest.md` after reading the tool's docs; do not guess. A tool id or kind in the request (`seed`,
   `verify`) limits the pass to it; with none, run every tool, seed first, since scenarios depend on seeded data.
1. **Read before touching.** For each tool in scope: the owning repo's rule file, the tool's docs, the attached skills,
   the project's workspace rules. Run the `health` command and stop on a failure that is not drift in the tool. Run
   `git -C <repo> fetch origin`, then check `git -C <repo> branch --show-current` and `git -C <repo> status --short`
   and compare with the manifest's `ship.base`; never build on someone else's uncommitted changes. Commands run from the tool's `run_from` folder, except `closeout`, which runs from the workspace root.
   If the manifest has a `suite`, read its run skill (`suite.skills.run`, normally `local-run`) before starting any
   server, world or session: it is the one place the project decides where a check runs, and this pass follows it. A
   pass's writes always take that skill's throwaway-world row (or a session where it sends a state there), never the
   standing run, even where the run skill lets everyday checks change standing data.
2. **Measure (read-only).** Run each `gap_report` and `inventory` command, and read each `gap_sources` entry. Write the
   result to a scratch queue, one row per gap: what, where it was found, risk, size. Typical sources:
   - Seed tool: modules and profiles; states or logins the feature map or its entries say are "not seeded" or
     "unreachable: needs ..."; scenarios skipped because they need seeded data; fixtures a check had to build by hand.
   - Runner tool (the session launcher, such as agent-test; one repo shared by several projects): the project's
     integration config against its repos, launch config and scripts (a target, process, port, container dependency or
     environment key that moved, appeared or vanished); each target group's plan command; the allow-list of settings against the
     application's env example; the project's scenarios folder against the features that changed; and every list that names
     the supported projects (the launcher's rule file, its README, the session skill's description). The launcher's own
     code is shared by all projects: a bug in it is reported, never fixed in this pass, and the edit scope is the project's
     integration folder (config, helper scripts, README), its scenarios, tests for that integration, and docs.
   - Verification tool: routes no scenario reaches (the route ledger); scenarios skipped, and why; scenarios that
     name a route the contract no longer has; the "not covered" lines in the feature entries; what a recent diff can
     touch (the tool's impact command).
   Stale references found while measuring are gaps too, but read the scenario before "fixing" one: a reference to a
   removed route can be deliberate (a scenario that proves the old route now answers 404), and a documentation page is
   not an API route. Fix only what is truly stale; list the deliberate ones as such.

   Run only the commands whose `needs` are available. If a source cannot run (it needs an API, a database or Docker),
   do not skip it silently: bring up the throwaway world it needs, or mark the source **unmeasured** in the report. A
   pass with an unmeasured source cannot end `clean`.
3. **Pick the batch.** Highest risk first: money, sign-in and permissions, deletion, data that crosses users or clubs.
   Rank with the manifest's `risk_hints` (route and file fragments per risk class), because a ledger gives every gap
   the same reason. Take one feature area, not the whole queue, and no more than you can prove in this pass. Say what you are leaving.
   If the highest-risk item is too big to prove in one pass (it needs a provider fake, or a large new module), do not
   half-build it: name it as the next pass's batch, and take the highest-risk item that fits.
   For each item, search the inventory first for overlap (the manifest's inventory has a command that finds the
   scenarios or modules mentioning a route or state) and **extend what exists** before adding a new module or scenario.
   If the project's rules require a plan before changes, write it now in the manifest's `ship.plan_dir`, and fill its
   Ran line when the work is proven.
4. **Build, in the tool's own way.** Follow the manifest's `conventions` and the docs it points at: where a new item
   goes, how it is registered, how it is named. When you change the tool's own code, or add a seed module, write the
   failing unit test first. A kept scenario is not tool code: its red step is step 5's flipped expectation. For a
   verification scenario, explore with real calls in a throwaway world, then keep the session as the tool's export
   does. For a seed module, plan, then dry-run, then run it in a throwaway world.
5. **Prove.** Run the manifest's `proof` commands on each addition, in a throwaway world, never on a shared database.
   An addition counts only when:
   - a scenario passes, **and fails when it should**: change one expected value, see it go red, put it back; a scenario
     that asserts only a status code and nothing about the body or the database state is not finished;
   - a seed module is repeatable (a second run creates nothing), reversible where the tool offers undo, and a scenario,
     or a feature entry's click path, reaches the state it was added for;
   - the full tool check runs once at the end of the pass, not after every item (when `maintain-verification-skill-advanced`
     called this pass, its single full-gate report already serves the measuring in step 2, so run this final check only if
     the pass changed something it reads), in a **fresh** world: end every
     exploring session with its cleanup and tear down the world you explored in, because rows left by abandoned
     exploration make unrelated scenarios fail.
   If the full check fails, do not guess whose fault it is. Run the same check on a **baseline** world (the same
   profile without your change) and compare the failure text. Only a difference is yours; record the rest as already
   failing, under left open, and do not fix it in this pass.
6. **Keep the neighbours true.** (Drift in the attached skills that has nothing to do with the change you made is found by
   `maintain-verification-skill-advanced`'s compare step; do not hunt for it here.) Refresh the attached skills and the
   tool's docs where the change makes a statement
   stale (command tables, module and profile lists, what a profile is for). Avoid writing counts that will go stale; in
   a doc you touch, fix a stale figure or replace it with the command that produces it.
   Run the manifest's `closeout` commands, and fix what they report about seed or scenario names in the feature
   map. A seed change: re-run the verification scenarios that read that data. A new scenario that needs data the seed
   lacks: add the module first.
7. **Ship or stop.** For `changed`, follow the manifest's `ship` rules: one branch and one reviewed change per tool,
   re-reading every changed file first, with the plan's todos ticked and its review section filled in. The branch may
   be committed and pushed under the project's own rules; opening the pull request is the user's go-ahead unless the
   request named it. For `clean` or `blocked`, no change. Report honestly: gaps closed, gaps left
   (with why), scenarios or checks skipped and the reason, defects found and where each is recorded. If feature entries
   name anything that changed, end by pointing at `maintain-verification-skill-advanced`.

Keep short run notes (queue, batch, what was proven, what was left) in a scratch location. Do not commit them. Use one
scratch path for the whole pass: a temp folder differs between sandboxed and unsandboxed commands, so output written by
one can be missing for the other.

## Hard rules

- Writes go to a throwaway world or a session only. The standing local database is read-only to a pass: only read
  commands and `--dry-run` reach it. Never a shared environment, never anything in the tool's `protected` list (the
  standing databases and environments), and never a reseed of one.
- Never weaken an assertion, delete a failing scenario or drop a seed state to make a run pass.
- Never change a default that every world shares (a base module's data, or the profile the kept scenarios assume)
  without re-running every scenario that reads it. Prefer an added module or parameter.
- Stop what you started (worlds, servers, sessions) and say what you left behind. Evidence and run notes survive cleanup.
- Secrets, tokens and member data never go into a scenario, a module, a doc or a message: use the tool's own fixtures
  and login keys.
- Where a tool and its docs disagree, read the code and fix the doc.
