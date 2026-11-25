# Blueprint: what a seed tool and a verification tool must offer

For the next project that needs these tools. It is a checklist for the project's own plan, not a generator: the tools are
design work in the project's stack, built through its plan-first workflow. It records what `cmx` and `iwx` (verification)
and `tools/seed` and `iwx-seed` (seed) already do, and the contract `maintain-cli-tools` and
`maintain-verification-skill-advanced` rely on, so a new tool is maintainable by them from its first day.

## Both tools

- **Local only for writes.** Loopback targets only. Refuse a remote or cloud database URL, a live payment key, and any
  environment mode that could send real email. No override flag. Keep any allowed host list in a reviewed file.
- **No secrets in output.** Passwords are held only for the request that needs them. Tokens and credentials files are
  written readable by their owner only, ignored by git, and never printed.
- **No dependency on the product at run time.** The product never loads the tool, and a test fails if it ever does. The
  tool needs no other repository to be present.
- **Everything an agent needs is machine-readable.** A `--json` form for lists and results, stable exit codes
  (0 success, 1 failed check, 2 bad usage or refused target), and errors that say what to do next.

## The seed tool

- **Modules and profiles.** A module is one file with a kebab-case name, a summary, tags, `dependsOn`, the modes it
  supports (a throwaway database, an existing local one), optional parameters, and a `run`. A profile is a named list of
  modules. Adding a file is all it takes to add a module. A test checks every profile resolves.
- **Introspection without a database.** `--list` and `--list --json` (modules, tags, dependencies, modes, the profiles each
  belongs to) and `--plan` (the modules a profile would run, in order). These need no database.
- **Repeatable.** Every inserted document carries the module's tag and a stable key, found by natural identity first, so a
  second run creates nothing. A unit test runs each module twice against a database double and asserts zero second-run inserts.
- **Safe on an existing database.** Modes are explicit. An existing-mode run needs a flag, supports `--dry-run` (counts,
  writes nothing) and `--undo` that deletes only what a journal recorded and the tag confirms. A lock stops two runs on one
  database.
- **A credentials file.** Every login, fixture id and state the seed made, so a check never looks anything up. Names only in
  anything shared; values only in the file.
- **One profile every kept scenario assumes**, named in a comment, changed only with them.

## The verification tool

- **A throwaway world.** One command starts its own database, cache and API from the checkout you are in, seeded with a
  profile and extra modules, with optional fake providers; one command removes it. `--world <name>` redirects any other
  command to it. A doctor command says whether the machine and the target are ready.
- **Drive and assert.** `call` holds the login and captured ids and asserts on status, body fields and what the call did to
  the database (a read-only database command). A session records steps with an undo for each created thing.
- **Keep what works.** `export` turns a passing session into a scenario file with placeholders (never real ids or
  secrets); `replay` re-runs one and says where it diverges; a way to read a scenario without escaped JSON. Scenarios can
  declare what they need (seeded database, seed modules, a provider fake) and are skipped or refused where it is missing,
  and can mark a defect found along the way so the scenario stays green and the defect is recorded.
- **The full gate with a report.** One command runs, in order and stopping at the first failure unless told to keep going:
  the contract check, every kept scenario, the authorisation matrix, the route ledger, and the optional state matrix and
  bad-input sweep. It prints what was skipped and why, and can write a report file.
- **A route ledger.** Every route in the contract is reached by a scenario or an authorisation row, or is listed as pending
  or exempt with a reason. The pending list may only shrink. If authorisation rows alone can satisfy it, the ledger must also
  say how many routes a behavioural scenario reaches, or the real gap is hidden (Inspection Worx hit this: 222 of 222
  covered, 84 by scenarios).
- **Change impact.** From a diff or a commit range to the routes and kept scenarios it can touch.
- **Contract and authorisation checks.** A route added, removed or reshaped fails until reviewed and updated; a new route
  needs a hand-written authorisation row, never one derived from its own guard.

## The runner tool (the session launcher)

One repo shared by several projects, with one folder per project (config, runtime setup, a guard that refuses unsafe
settings, a login adapter, a seed hook that runs the application's own seed tool, a README, tests, scenarios). It is added
to a project's manifest as kind `runner`, whose commands are its target and plan commands (no database needed), its tests,
and starting and stopping a real session (a container runtime). Adding a project is a guide in the launcher's own repo
(`docs/guides/add-a-project.md` in agent-test). Upkeep covers the project's folder only: the launcher's code is shared,
changes through its own plan, and is reported, not edited, by a maintenance pass.

## The contract the upkeep skills rely on

`maintain-cli-tools` reads a manifest (`references/manifest.md`). For each tool it needs, as one-line commands with a `needs`
label (`none`, `db`, `api`, `docker`):
- `health`: a quick check the tool works on this machine;
- `inventory`: what exists now (modules and profiles, scenarios, routes), including a way to find what mentions a route or
  a state;
- `gap_report`: the tool's own account of what it does not cover (the ledger, the skipped scenarios, the feature entries'
  "not seeded" lines);
- `proof`: how to prove an addition (a unit test, a replay in a world, the full gate);
- the places new items go and how they are registered (`conventions`), the standing databases and environments that must
  never be written (`protected`), and the risk fragments used to rank gaps (`risk_hints`).

If a new tool can answer those five, the upkeep skills work on it unchanged.

## Leave to the project

The stack, the data model, which providers need fakes, the login and role model, what a "world" starts (a container
runtime, a cloud emulator), and the names. Copy the shape, never the facts.

## Planning checklist for a new tool

1. List the safety rules above in the plan's risks, and where each is enforced.
2. Name the introspection commands first (`--list --json`, `--plan`, the ledger): they are what makes the tool maintainable.
3. Write the first module or scenario test-first, with the second-run or flipped-expectation proof.
4. Add the manifest entry in the project's workspace and run `maintain-cli-tools/scripts/check-manifest.py` on it.
5. Document the tool in the repo's own docs, and give it a skill that says when to use it (`verify-backend-e2e`,
   `seed-test-data` are the models).
