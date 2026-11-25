# Outlines for the skills this skill writes

Each skill is a `SKILL.md` with YAML frontmatter (`name` and a `description` that names the project, the surface and when
to reach for it; without frontmatter the skill never registers), written for the next agent who reads it cold, mid-task.
Write them from the project's real docs and commands. The two current projects' versions
(`verify-backend-e2e`, `verify-product-e2e`, `seed-test-data`, `feature-map`) are the model: read them in a sibling
workspace if one exists, and copy their shape, never their project facts.

Rules for every skill below: no placeholders; every command, flag, path and label found or run (a harness tool name in
brackets, or a device-only command this session cannot run, may stay but is marked unverified in the skill's text);
the protected databases and environments from the manifest's `protected` list are named, with "never reseed the standing
database"; the places other skills and map entries already point at (found by the dangling-reference search) all exist, under the
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
- `verify-product-e2e`: `Think like a user`, `Pick the mode`, `Pick the layer for each sub-feature` (the audit procedure
  calls this "the layer table"), `Tools this skill needs`, `Steps`, `Report`, `What is where`; and in `references/common.md`
  the sections on which route to take (including the launch-config route and what to do when the databases are down),
  second views, evidence and `Clean up`; the surface references hold "the driving notes".
- `seed-test-data`: the state-to-module table, how to read the credentials file, and `When the state you need is not seeded`.

## `verify-backend-e2e` (layer 3)

- **Description:** the project and API, "against a running API and a throwaway seeded world, with the CLI and no portal or
  app", when to use it (after a backend change, to reproduce a bug, to review a diff, "does the backend still work"), and
  pointers to the product skill and the seed skill.
- **Intro:** why unit tests are not enough here; where the CLI's docs and review playbook are; the repo's rules win.
- **When to use it:** after finishing, while you work (cheap: unit tests and one call), before starting a bug (reproduce
  it), to review a diff.
- **How to use it** (numbered): know what you touch (the map's plan command); start a world for anything that writes, one
  per task, reused; find what to look at (impact, the map, the inventory's guards); run what exists, once, at the end;
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
  and read their logs; a shell with the backend CLI and the container runtime; for the app, the emulator or simulator
  tool; a way to look at an image.
- **Steps:** check tools; open the entry; pick the route (launch config against the standing local data in the main
  checkout, or a seeded session for a missing state, a clean database or a worktree); drive it (surface references);
  record per sub-feature in the entry (mark "(seen)" with the date only after driving it); keep the map true (closeout and
  check; move `verified` only after a live pass over every sub-feature); clean up.
- **Report:** per entry, verified with evidence, unreachable with the prerequisite, failed, what changed in the entry;
  never repeat passwords, tokens or member data.
- **References:** `common.md` (how it fits the other skills, the rules, which route, second views, evidence, clean-up),
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
  the map entry's traps); the rules (never seed the standing database; the shared profile every kept scenario assumes
  changes only with them).

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
