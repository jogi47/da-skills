# Outlines for the skills this skill writes

Each skill is a `SKILL.md` with YAML frontmatter (`name` and a `description` that names the project, the surface and when
to reach for it; without frontmatter the skill never registers), written for the next agent who reads it cold, mid-task.
Write them from the project's real docs and commands. The two current projects' versions
(`verify-backend-e2e`, `verify-product-e2e`, `seed-test-data`, `local-run`, `feature-map`) are the model: read them in a sibling
workspace if one exists, and copy their shape, never their project facts.

Rules for every skill below: no placeholders; every command, flag, path and label found or run (a harness tool name in
brackets, or a device-only command this session cannot run, may stay but is marked unverified in the skill's text);
the protected databases and environments from the manifest's `protected` list are named, with "never reseed the standing
database"; which stack a check runs on, how standing servers start, and the standing data's rules are `local-run`'s
alone, so every other skill points at it (by section) and never restates them; the places other skills and map entries already point at (found by the dangling-reference search) all exist, under the
exact headings and file names they cite, each covering every case the citing text mentions (for example a "Tools this
skill needs" section that says what to do with no server runner, or a route section that says what to do when the
databases are down); say that the repo's own
rule file wins where the skill disagrees; write the skill for any agent harness (name what a step needs, with a
harness's tool names only in brackets); keep detail that only one surface needs in `references/`.

## Required headings

Other skills, the map's audit procedure and the project's docs cite these by name, so use them exactly. A project's own
citations (the dangling-reference search) may add more; supply those too.

- `verify-backend-e2e`: `When to use it`, `How to use it`, `What a world needs, and what to do when it will not start`,
  `Good to know`.
- `verify-product-e2e`: `Think like a user`, `Pick the mode`, `Tools this skill needs`, `Steps`, `What is where`. Add
  `Pick the layer for each sub-feature` and `Report` as their own sections whenever anything cites them (an audit
  procedure that says "the layer table" means the first); otherwise they may sit inside `Steps`. In
  `references/common.md`: `How the skills fit together`, `Rules`, `Evidence` (second views inside it or in their own
  section) and `Clean up`; the surface references hold "the driving notes". No route section: that is `local-run`.
- `seed-test-data`: the state-to-module table, how to read the credentials file, and `When the state you need is not seeded`.
- `local-run`: numbered sections, because other skills cite them by number: `1. Decide`, `2. Standing run`,
  `3. Standing data`, `3a. When the standing data lacks what a step needs`, `4. Session: <Project>'s inputs`,
  `5. Stop what you started`.

## `verify-backend-e2e` (layer 3)

- **Description:** the project and API, "against a running API and a throwaway seeded world, with the CLI and no portal or
  app", when to use it (after a backend change, to reproduce a bug, to review a diff, "does the backend still work"), and
  pointers to the product skill and the seed skill.
- **Intro:** why unit tests are not enough here; where the CLI's docs and review playbook are; the repo's rules win.
- **When to use it:** after finishing, while you work (cheap: unit tests and one call), before starting a bug (reproduce
  it), to review a diff.
- **How to use it** (numbered): know what you touch (the map's plan command); start a world for anything that writes, one
  per task, reused (`local-run` section 1 sends backend work here, and this skill owns the world); find what to look at (impact, the map, the inventory's guards); run what exists, once, at the end;
  explore beyond the scripts (other roles, bad input, a second tenant, parallel calls, an outage); keep what is worth
  keeping as a scenario before the world goes down; keep the map true (the closeout command); say what you did under the
  repo's review labels; tidy up and confirm no worlds remain.
- **What a world needs, and what to do when it will not start:** the container runtime, the checkout you changed, a free
  name; where logs go and which ones never to print.
- **Good to know:** the CLI is the tool (not curl or hand-written database edits); its safety guard (loopback only); the
  one-API-on-the-standing-database rule.

## `verify-product-e2e` (layer 4)

- **Description:** every surface (portal, admin console, website, app) plus the API behind them; "starts the local stack,
  follows a map entry's click path with the labels as shown, and ends every sub-feature as verified, unreachable or
  failed, with the action, the resulting state and a second view as evidence"; local only, on top of the backend skill
  and the unit suites, never instead of them.
- **Think like a user:** goals not code paths; follow the entry's steps literally with the labels; follow the whole journey
  across surfaces; look at every screen (a toast is gone in seconds); try the refusal and the lower-permission login;
  **a proof is the action, the resulting state and a second view**; every sub-feature ends verified, unreachable (with the
  concrete prerequisite and the route tried) or failed (seen against expected); never report a skipped entry point as
  verified through another; a seed state the seed lacks fails the step.
- **Pick the mode:** verify your own change (the map's plan command from changed files), re-check past work (commit range),
  audit the map (the map skill's audit procedure; this skill is its live pass).
- **Pick the layer for each sub-feature:** a table sending endpoint-level proof to the backend skill, screens and wording to
  the in-app browser, signed-out flows through the real form, the app to the emulator or simulator only when nothing else
  can show it.
- **Tools this skill needs** (name each by what it does, with the current harness's tool names in brackets, for example
  Claude's Browser pane tools and `preview_start`; a name you could not confirm is marked unverified): an in-app browser for the screens (**no fallback**: without one, those sub-features are
  *unreachable*, and the skill says to check this before starting any server); a way to start the launch-config servers
  and read their logs (`local-run` section 2 says how, and what to do with no server runner); a shell with the backend CLI and the container runtime; for the app, the emulator or simulator
  tool; a way to look at an image.
- **Steps:** check tools; open the entry; pick and start the stack with `local-run` (its section 1, naming the row taken;
  a state the standing data lacks follows its section 3a); drive it (surface references);
  record per sub-feature in the entry (mark "(seen)" with the date only after driving it); keep the map true (closeout and
  check; move `verified` only after a live pass over every sub-feature); clean up.
- **Report:** per entry, verified with evidence, unreachable with the prerequisite, failed, what changed in the entry;
  never repeat passwords, tokens or member data.
- **References:** `common.md` (how it fits the other skills, the rules, second views, evidence, clean-up),
  and one file per family of surfaces, grouped from the manifest's `suite.surfaces` (plain names; you choose the families;
  a browser-driven family such as portal,
  admin console and website can share one file; the app gets its own), read only for the surface you are on. Evidence
  goes where the project's rules say (its scratch folder); the skill names it.

## `seed-test-data` (layer 2)

- **Description:** choose, start and use the seeded test data so a check has every login, state and record it needs; when to
  use it (before a world or session, when a check cannot reach a state, which login shows what, when planning a feature
  to name its test data, when a state is not seeded and you must choose between a one-off and a new module).
- **Body:** what the tool is and where it writes; the profiles and what each is for; a table from "the state a check needs"
  to the module that makes it, the logins it adds and how to confirm it; how to read the credentials file (names, never
  values); what to do when the state you need is not seeded (build it for one check, or add a module, and note it in
  the map entry's traps); the rules (the standing database is seeded only as `local-run` section 3 allows, insert-only
  where the tool has such a mode, and never reseeded; the shared profile every kept scenario assumes changes only with
  them).

## `local-run` (layer 4)

- **Description:** decide how to run the project locally for any check, repro, demo or screenshot (a standing run from
  the launch config against the local test database, a session, or a backend CLI world) and start the standing run; "the
  one place that decision is made; read it before starting any server, session or world", naming the skills that call
  it; operating a session is the global `test-session` skill's job.
- **Intro:** the stacks, and that other skills never choose one themselves.
- **1. Decide:** a first-match table (the check, the checkout, the stack): backend end-to-end work goes to a world; an
  independent test pass with a report, a clean database, a state section 3a sends away, or a worktree or other branch
  goes to a session (with the runner's checkout flag per repo changed); everything else in the main checkout is a
  standing run. Say which row you took. A busy port held by this checkout is reused, not a reason for a session.
- **2. Standing run:** the project's status helper (repos' branches, which ports answer), bringing up the local
  database and cache, starting only the launch-config entries the check needs by name (with the harness's server
  runner, or the entry's own command in the background with a log, never a command or port of your own), waiting for
  ready, reusing a served port, the one-API-per-database-and-cache rule and the isolated entry for a second API, the app
  entries that point at the local API, and the traps (hot reload, restarts from another session's edit).
- **3. Standing data:** the local database as the agents' test bed: write freely through the screens or the CLI; seed it
  only by adding (or not at all, if the seed tool refuses it); which logins must survive; never drop or recreate it.
  This section owns those rules; other files point here.
- **3a. When the standing data lacks what a step needs:** make it if a person could, otherwise switch to a session with
  the smallest seed, then add "needs a session: <state>" to the entry's Traps; where logins live and how to list them
  without values; local only.
- **4. Session: <Project>'s inputs:** project, mode, targets, seed profile and modules (from `seed-test-data`), where
  the session's logins come from; never fill a missing fixture from the standing database.
- **5. Stop what you started:** standing servers you started (not ones you reused), sessions and worlds as their own
  skills say, and `git status` on each repo for anything the run changed.

## `feature-map` (layer 1, the skill; entries are separate)

- **Description:** the map: one entry per feature naming its routes, screens, endpoints, roles, logins, seed data, click
  path with the labels as shown, how to verify and traps; plus a generated inventory. When to use it (before any feature
  work, to find the login and data that make a screen appear, before finishing a change that adds, renames or removes a
  route, role, seed module or screen, and to audit the map).
- **Body:** where the map lives and what is generated (never edit by hand); the commands (`which`, `plan`, `closeout`,
  `check`, `generate`, tests) and what each exit code means; how to keep it current; the entry format (front matter, the
  nine H2 sections, sub-feature ids, steps tagged to ids, "(seen)" only after driving); the rules (no credentials, tokens
  or member data; describe the product as it is; one entry per feature); `references/audit-pass.md` (check and script
  tests, scope by risk, the backend half first, an optional source wave, the live pass per entry, triage into doc drift,
  tooling gap, product gap and unreachable, stamp `verified` only on proof).
- **If the generator and checker do not exist:** write the entries by hand in this format and record the missing checker
  as a prerequisite.
