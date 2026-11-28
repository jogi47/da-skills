# Trap families

Twelve families, found in two unrelated projects (a Node, React and Flutter platform with Jenkins and GitHub Actions; a .NET, React and Flutter platform with Azure Pipelines). Every finding in a register belongs to one. Built-in detector ids are in backticks; a family with none needs a project detector or a sweep.

## 1. Copies that drifted (`copies`)

The same helper, table, map or pipeline block exists in several places and the copies no longer agree: an HTML escaper that skips the quote in five of seven copies, a portal and an admin console that started as one tree, a bucket map in three Jenkinsfiles, a time zone literal in forty files.

- Harm: the agent fixes the copy it found; the others keep the bug. New code copies the nearest, often weakest, version.
- Find: `duplicate-function`, `hardcoded-timezone`, project `twins` for folders that should match, project `custom` regexes for a known literal.
- Fix: one implementation and imports (architecture); where two trees must stay separate, a test that pins the shared behaviour in both.

## 2. Magic codes (`magic_codes`)

Status, type and role values compared as raw literals, especially short codes whose meaning changes per entity (`'r'` is cancelled for a booking and rejected for an invitation), or two enums with one name and different values.

- Harm: a copied literal into the wrong model compiles and filters wrongly; a reader cannot tell what `'cmm'` means.
- Find: `status-literal`, project `custom` for the project's code style.
- Fix: named constants or enums from one definition (type); rename enums that share a name with different values; a lint rule against comparing the field to a literal.

## 3. Docs that contradict the code (`doc_drift`)

Rule files, READMEs and workspace guides that state a version, endpoint consumer, default, path or deploy order the code no longer has.

- Harm: agents trust what they read first. A wrong "nothing calls this route" invites deleting it.
- Find: project `claims` (a doc regex and a source regex whose captures must match); sweeps.
- Fix: correct the doc, then add a claim so it cannot drift again. Prefer docs that point at the code over docs that restate it.

## 4. Silent failure (`silent_fail`)

Errors swallowed (`.catch(() => {})`, empty `catch`, `catch` returning null), env vars that fall back to a literal (often another environment's host or a test key), permissive code defaults behind a config key, webhook handlers that are not idempotent.

- Harm: the failure leaves no log and no failing test; a missing setting quietly talks to the wrong environment.
- Find: `silent-catch`, `env-fallback`, `config-default`.
- Fix: fail loudly at startup for required config; log through the project's helper; dedupe webhook events by id.

## 5. Dangerous leftovers (`leftovers`)

Superseded pipelines still triggerable (or pointing at production), local scripts that overwrite tracked files, `.gitignore` rules that hide docs, dead modules kept alive by their tests, TODOs that read as promised behaviour.

- Harm: an agent runs, copies or finishes the dead thing.
- Find: `todo-marker`, project `custom` (for example a prod host in a non-prod pipeline file); sweeps.
- Fix: delete (when tracked), or a first-line warning that names the live replacement; restore traps in scripts; a pre-commit check for files that must not change.

## 6. Misleading names (`names`)

Misspelt files and folders, two files with one name, one type name for two types, a folder named like a file, names that say the opposite of the contents.

- Harm: a search for the right spelling misses the file, or finds two, and the agent edits the wrong one.
- Find: `misspelt-path` (dictionary in the script; add project words with `misspellings`), `duplicate-basename` (add deliberate twins to `basename_ignore`).
- Fix: rename with the imports when nothing outside depends on the name; otherwise record it in the repo rules.

## 7. Size and coupling (`size_coupling`)

Files too big to hold in context, modules that import each other's internals, many files writing one table, modules that start workers or connections when imported.

- Harm: edits miss logic far away in the file; a change assumed local leaks across audiences; new writers keep appearing.
- Find: `large-file` (threshold in config); sweeps for writers and import cycles.
- Fix: extract along the repo's existing pattern; one writer per durable value (`agent-proof-architecture`); a dependency test with a ratchet.

## 8. Gates that do not gate (`gates`)

Pipeline steps that cannot fail (`continue-on-error`, `|| true`, `npm ci || npm install`, `|| secrets.OTHER`), Azure conditions without `succeeded()`, PR checks limited to one branch, analyzers with a baseline that nothing ratchets, deploys that run no tests, repos with no CI.

- Harm: a green run is read as proof.
- Find: `ci-soft-fail`, `condition-no-succeeded`; sweeps for branch filters and missing steps.
- Fix: make the step fail; add `and(succeeded(), ...)`; match branch lists across repos; ratchet warning counts.

## 9. Dead config (`dead_config`)

Settings and env keys that nothing reads, and JSON "comment" keys (`"//Key"`).

- Harm: flipping the key looks like turning a feature off; it does nothing.
- Find: `unread-config-key` (`appsettings*.json` and `.env.example` style files against every other text file in the repo).
- Fix: delete, or wire it and test that it changes behaviour.

## 10. Conditions that cannot fire (`unreachable_conditions`)

A pipeline stage gated on a branch the trigger never includes; a feature flag checked against a value nothing sets.

- Harm: the agent believes a path runs.
- Find: project `custom` or a sweep that reads triggers and conditions together.
- Fix: align the trigger and the condition, or delete the stage.

## 11. Authority outside the repo (`outside_authority`)

Branch policies, schedules, disabled workflows, job registrations and secrets held in a CI server or hosting portal.

- Harm: the files cannot tell an agent what runs.
- Find: only by asking or by reading the portal; register it so it is visible.
- Fix: move it into the repo where the platform allows (pipeline-as-code, settings files); otherwise document it next to the file it governs.

## 12. Client copies of a server catalogue (`wire_copies`)

Clients that hold partial copies of server enums, error codes or field shapes with no contract test; hard casts in client models of fields the server may drop.

- Harm: a server rename breaks clients with no failing test; old app versions crash.
- Find: sweeps; project `custom` for hard casts.
- Fix: generate the client copy from the server, or a contract test that every client value exists on the server; tolerant parsing in clients that cannot update.
