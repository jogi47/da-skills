---
name: create-verification-skill-advanced
description: "Set up or complete a project's layered verification suite: the feature map (kept outside any skill), the seed tool's skill, the backend end-to-end skill that drives the backend CLI, and the product end-to-end skill that drives the running screens from the map. Finds what already exists, creates only the missing layers in dependency order, grounds each one in the project's real tools, proves each by running it once, and registers the suite in the project's manifest. Use when a project has, or needs, separate backend and product verification skills with an external feature map, instead of one verify-<app> skill. Replaces create-verification-skill for such projects."
disable-model-invocation: true
---

# Create the verification suite (advanced)

The generic `create-verification-skill` writes one `verify-<app>` skill with its own `features/` map inside it. These
projects do not work that way. Their verification is a **suite of layers**: a feature map that lives outside every
skill, a seed tool, a backend CLI, and two verify skills that split the work (backend with the CLI, product through the
screens). Running the generic skill here creates a second map and a skill that overlaps the real ones. This skill
creates the suite the way these projects are laid out, and creates only what is missing.

Its sibling `maintain-verification-skill-advanced` keeps the suite true afterwards. Do not run either generic skill on
a project that has a suite. The sibling skill `maintain-cli-tools` (in the same skills folder: `~/.claude/skills` or
`~/.agents/skills`) owns the manifest: its `references/manifest.md` lists the fields and its
`scripts/check-manifest.py` validates the file.

## The layers

| Layer | What it is | Needs |
|---|---|---|
| Feature map | `docs/feature-map/` (index, one entry per feature, generated inventory) and a `feature-map` skill with a check script | the project's code, to extract routes and screens |
| Seed | a seed tool and the `seed-test-data` skill | the tool |
| Backend verification | a backend CLI (like `cmx` or `iwx`) and the `verify-backend-e2e` skill | the CLI, the seed tool, the map |
| Product verification | the `verify-product-e2e` skill, with a reference per family of surfaces | a launch config, the map, the backend skill |
| Upkeep | `cli-tools.json`, naming the tools, their attached skills and the suite | all of the above |

Detection rules, what "exists" means for each layer, and what this skill cannot create: [references/layers.md](references/layers.md).
Outlines for the skills it writes: [references/skill-outlines.md](references/skill-outlines.md).

## Outcomes

- **created**: every layer that was missing now exists, was run once, and is registered.
- **created, proof deferred**: the layers were written and every proof that needs no server, browser or device ran, but a
  layer's own first run could not happen in this session (typically the product skill). The skill is a draft until then:
  it carries a line under its title, "Draft: first run pending (<the sub-feature that will prove it>)", removed after
  that run; the report names the run and what it will show.
- **complete**: nothing was missing; the suite is only registered (or already was). A map whose entries were never
  verified live, or are old, still counts as existing: say **complete, with upkeep owed** and name it for the maintain skill.
- **blocked**: a layer could not be created or proven. Say exactly what blocked it, and which later layers it holds up.

## Edit scope

Edit only the suite's own files: the map folder, the suite's skills, the manifest. Never product code. **Never rewrite a
layer that already exists**: improving one is `maintain-verification-skill-advanced`. The tools themselves (a seed CLI, a
backend CLI) are not created here: a missing tool is a prerequisite, reported with the project's own plan-first workflow as
the way to build it.

## Pass

0. **Locate and read.** Find the workspace root and `.claude/cli-tools.json`. Read the workspace rules and each owning
   repo's rule file before the first edit: the sections on planning, verification, the local environment, safety and
   where files go, in full; skim the rest. No manifest is fine: this pass writes one. Cross-check the manifest's `rules`
   against the rule files that actually exist in each product repo; add the missing ones (the manifest is the suite's own
   file) and report that you did.
1. **Inventory, read-only.** For each layer, apply the detection rule in `references/layers.md` and write a table: layer,
   exists or missing, the paths and commands that show it, and whether its own check passes. Run each existing layer's
   check: the manifest's `suite.feature_map.check` for the map (it may carry flags such as a repo path) and the tools'
   `health` commands from their `run_from` folder. Run only checks that need no server, container or database; a test run
   inside a repo counts as needing none, but a check that builds the project (a CLI wrapper that rebuilds when sources
   changed, `make`, `dotnet`) needs the toolchain, so run it only if this session may, and otherwise report it as **not
   run**, never as passing. Read a checker's exit status directly, not through a pipe: send its output to a file and read the status of the
   checker itself (a shell's pipe status is the last command's, and zsh names it `pipestatus`).
2. **Find conflicts and dangling references.**
   - Look for output of the generic skill and for overlap: a `verify-<app>` skill, a `features/` folder or map inside a
     verify skill, two skills claiming the same surface. List each, say which layer owns the surface, and propose the
     resolution. Tell a stale leftover from work in progress by its git status and log, its age against the real suite
     skills, and whether anything references it; with no git, an empty shell nothing references is stale; when unsure, ask.
     The user removes a leftover, or says to; this skill and the maintain skill delete nothing unasked.
   - **A map check that is red only because a layer is missing is the best detector of that layer's contract.** The map's
     check reports "unknown names" such as a skill that is not found: record the layer as **exists, check red because
     <layer> is missing**, then search for every other reference to the missing skill's name: the other suite skills, the
     map's entries (front matter included) and its checker's strings, the audit procedure, the project's rule file and docs
     index, the seed skill. Note every heading, file and clause they cite. The new skill must supply each one, under the
     exact name cited, and cover every case the citing text mentions (for example running without a server runner).
3. **Decide the create list.** Only missing layers, in dependency order: tools, seed skill, backend skill, feature map,
   product skill. A layer whose prerequisite is missing is blocked, not improvised.
4. **Create each missing layer.** Read the tool's docs and the project's helper docs first, then author from the outline in
   `references/skill-outlines.md`. A finished skill of the same layer in another project's workspace is the best model for
   its shape: read it if there is one (copy the shape, never the project's facts); with none, the outline and the docs are
   enough. Put the project's own rules about the layer into the skill, for example a rule that a browser is the last resort
   for logic goes in its layer table. Every command, path, label and flag must be one you found or ran; a harness tool
   name or a device-only command you could not run may stay if marked inline `(unverified: needs <what>)`. Keep `SKILL.md`
   to the outline's sections and put per-surface detail in `references/`. For the feature map: write entries by hand in
   the format the project's `feature-map` skill documents; a missing generator or check script is a plan of its own (its
   extractors are project-specific), so record it as a prerequisite and do not build one in this pass.
5. **Register.** Write or update the manifest: the tools (so `maintain-cli-tools` can run) and the `suite` section naming
   the map, the skills and the launch config. The fields are in `maintain-cli-tools`'s `references/manifest.md` and the
   checker enforces them (`suite.feature_map` needs `check`, `closeout`, `tests` and `audit_procedure`; `suite.surfaces` is
   a list of plain names). The product skill goes in `suite.skills` only: it documents the whole product, not one tool, and a tool's
   `attached_skills` lists only skills that document that tool. Run `check-manifest.py` on the result.
6. **Prove each created layer by running it once.** Backend skill: bring up a throwaway world, replay one kept scenario,
   take the world down. Seed skill: the profile plan, then a dry run. Product skill: one mapped sub-feature through its own
   route, ending verified, unreachable or failed with evidence. Feature map: the check script passes. Name where the
   evidence lives (the project's scratch folder, per its rules) and confirm it is still there after cleanup. Fix what fails
   and clean up after every failed try.
   If a first run needs a browser, a server or a device this session cannot use, do not fake it: end `created, proof
   deferred`, and do the offline proofs that remain: every path, flag and heading the skill names exists; the map's
   check no longer reports the skill as unknown; the launch config's entries it cites exist. Name the first run in the
   draft line: pick a read-only sub-feature that needs nothing beyond the standing data (a list or settings screen), with
   a low-privilege login, so the person who runs it first risks nothing. If you proved a skill in a stand-in, list the setup steps the stand-in did that the real
   target will not.
7. **Report.** Layers found, created, blocked (with the missing prerequisite), conflicts and how each was or should be
   resolved, what was not proved, and any contradiction you found between the project's own docs (not yours to fix).
   End by pointing at `maintain-verification-skill-advanced`. Workspace files stay uncommitted for the user unless the
   project's rules say otherwise.

## Hard rules

- One feature map, outside every skill. Never create a second map or a `features/` folder inside a verify skill.
- Never overwrite an existing layer, and never delete a leftover without asking.
- Writes in proofs go to a throwaway world or a local database the project names as free to use, never a shared
  environment and never anything in the manifest's `protected` list.
- Where the manifest's `protected` list and the project's rules conflict, follow the stricter of the two (when neither is
  clearly stricter, the one that writes less to shared or standing data), say so inside the skill you write, and report
  the conflict for the user to settle.
- Secrets, tokens and member data never go into a skill, an entry or a report: name roles and login keys.
- Where a skill you write and a repo rule file disagree, the rule file wins; say so inside the skill.
