---
name: agent-proof-architecture
description: Make a codebase safe for contributors who see only a few files (coding agents, new starters), so the locally obvious change is also the globally correct one and unsafe shortcuts fail with an error that names the right path. Five rules - the conventional path takes fewer decisions than a shortcut, forbidden dependencies fail mechanically, every durable value has one obvious writer, new product work adds isolated files rather than branches in shared roots, exceptions are narrow, explicit and reviewed. Use when setting up a repo, monorepo, package or feature area; when choosing folder layout, import rules, registries or who writes a piece of state; when reviewing a change or a repo for agent safety; and mid-task, before adding a case to a shared switch, registry or config, importing across a package or layer, or writing shared state from a new place. For one module's interface shape use codebase-design; to mine past agent mistakes use /correct.
---

# Agent-proof architecture

Most changes to a codebase now come from contributors who arrive with a narrow task, a handful of nearby files and no complete picture of the system. That is true of coding agents, and of a new starter on their first week. This skill designs the repo so that such a contributor, doing the obvious thing in front of them, does the right thing for the whole system. Where the obvious thing would be wrong, the repo stops them with an error that says what to do instead.

The ideas come from the "agent-friendly architecture" page of the Dune framework, presented by Lauren Tan. This skill restates them in general terms and adds ways to enforce them.

## The contributor model

A contributor working from a narrow context behaves in predictable ways. Treat these as inputs to the design, not as faults to be fixed by better prompts.

| What the contributor does | What the repo must make true |
|---|---|
| Copies the nearest working pattern | The nearest pattern is always the right one. Old ways are deleted, not left beside the new ones. |
| Edits the file it already has open | Adding a feature means creating a new file in a folder the feature owns, not editing a shared file. |
| Takes the shortest path that compiles | The wrong path does not compile, or fails lint or a test in CI. |
| Leaves code alone when it cannot see the callers | Tooling shows which code is unused, so dead code can be removed instead of copied. |
| Follows the requested change even when it breaks an invariant | Invariants live in code that fails loudly, and the failure explains the invariant. |

Rules written only in a README or agent instruction file do not change any of these behaviours. Nothing fails when a contributor skips them. Use docs for judgement calls, and put everything else in the build.

## Vocabulary

Reuse the terms from the `codebase-design` skill: **module**, **interface**, **seam**, **adapter**, **locality**. Say "seam", not "boundary". This skill adds:

- **Owned folder**: a folder that belongs to one feature. Everything specific to the feature lives inside it, and nothing outside imports its internals.
- **Reserved file**: a file name the framework or build looks for inside owned folders (for example `entry.ts`, `routes.ts`, `*.handler.cs`). Features are found by these names, not listed by hand.
- **Shared root**: a file many features would otherwise edit, such as a central router, a registry array, a `switch` on a type, a DI container setup or a big config object.
- **Single writer**: the one module allowed to change a durable value (a table, a store, a cache key, a file on disk, a setting). Everything else reads, or asks the writer through a named command.
- **Guardrail**: a check that fails mechanically (compiler, lint, architecture test, CI job, database permission) when a rule is broken.
- **Exception**: a recorded, reviewed permission to break one rule in one place.

## The five rules

### 1. The conventional path takes fewer decisions than a shortcut

If doing it properly needs more choices than hacking it in, the contributor will hack it in. Make the right way the easy way.

- Provide one generator, template or copyable example per kind of change ("add a screen", "add an endpoint", "add a job"). Keep it working, because it will be copied.
- Delete superseded patterns once the replacement lands. Two ways of doing something means half the copies are wrong.
- Smells: several competing helpers for the same job; a "legacy" folder still imported by new code; a new feature that needs edits in five places.

### 2. Forbidden dependencies fail mechanically

Write each dependency rule as a check that fails, never only as advice.

- Layer and package rules: UI does not import database code; a shared package never imports the application; feature A does not reach into feature B's internals.
- Enforce with import-rule tools, package `exports` maps, project references, visibility modifiers and architecture tests. See [references/enforcement.md](references/enforcement.md) for tools per stack.
- Smells: deep relative imports (`../../../other-feature/internal/x`); a core package whose imports point back at the app; circular imports between packages.

### 3. Every durable value has one obvious writer

When two places write the same state, a contributor who sees one of them will add a third. Give each durable value one writer that is easy to find by name.

- Put writes behind named commands (`submitOrder`, `archiveCustomer`) owned by one module. Other code calls the command; it does not touch the store, table or file directly.
- Enforce the single writer where you can: database permissions or triggers, read-only exports, an import rule that lets only the owning module import the write API.
- Smells: the same table updated from several services; UI state set from many components; a setting written both by a migration script and at runtime.

### 4. New product work adds isolated files, not branches in shared roots

A shared root grows a new branch for every feature, so every feature edits it, and every edit can break the others. Replace shared roots with discovery.

- Each feature gets an owned folder. The app finds features through reserved files (file-based routing, glob imports, assembly scanning, code generation with a drift check).
- If a central list cannot be avoided, generate it from the owned folders and fail CI when the generated file is stale.
- Smells: a `switch` on feature or question type that every change edits; a registry array; a central route table; merge conflicts that keep landing in the same file.

### 5. Exceptions are narrow, explicit and reviewed

Some code must break a rule. Allow it in the open so the exception does not become the new pattern.

- An exception names the rule, the single place it applies, the reason and who approved it. Use the tool's own suppression syntax on the line, with the reason in the comment, plus an entry in a short exceptions file.
- Treat adding or widening an exception as an architecture change: it needs review from someone who owns the architecture (for example through `CODEOWNERS` on the exceptions file and the guardrail config).
- For existing violations in a legacy codebase, record a baseline and fail only when a change adds new ones (a ratchet), so the rule can be turned on today.

## Guardrail errors must teach

The contributor who hits a guardrail has the same narrow context as before. The error is their only guide. Every guardrail message says:

1. What was blocked: "`apps/web` may not import from `apps/api/src/db`".
2. Why, in one line: "Only the API writes to the database; the web app talks to it through the HTTP client."
3. What to do instead, by name: "Use `api.orders.submit()` from `@app/client`."
4. Where exceptions are handled: "If this is truly needed, add an entry to `docs/architecture-exceptions.md` and ask for architecture review."

A message that says only "import not allowed" sends the contributor looking for a way round it.

## How to use this skill

Pick the mode that fits the request.

### While making a change

Before writing code, check the change against the rules. These four questions take a moment and catch most problems:

- Am I about to add a branch to a shared root (a `switch`, a registry, a central config)? If the repo has an owned-folder or discovery pattern, use it.
- Am I about to write a durable value from a place that is not its writer? Find the writer and call its command instead. If there is no writer yet, say so and propose one.
- Am I about to import across a seam that the layering does not allow? Use the allowed interface.
- Is the pattern I am copying the current one? Check that it is not superseded before copying it.

If the right path is unclear or a rule seems to block a reasonable change, do not route round it. Take the conventional path, and tell the user which rule applied and, if no guardrail enforced it, which guardrail would. Add guardrails only when the user asks.

### Designing a new repo, package or feature area

A new repo has no code to protect yet, and every piece of machinery added now is something contributors must also understand and copy. So split the design into what goes in on day one and what waits for a trigger, and show that split in the output.

**Day one** (cheap now, costly to retrofit):

1. Name the seams: packages, layers and who may import whom. Write them as config for one import-rule tool, with messages that follow the template above. With no code yet, there are no violations to baseline.
2. Choose the owned-folder layout and the reserved file names.
3. List the durable values (tables, stores, files, settings) and name the single writer for each. If there is a database, enforce the writers there too (roles and grants); it costs a few lines now and is hard to add later.
4. Build one real reference feature for contributors to copy. A working feature beats a generator at this stage.
5. Run the guardrails in CI, and record the rules in a short table in the agent instruction file (rule, what enforces it, where exceptions go). Exceptions start as a suppression on the line with a reason.

**Later, each with its trigger** (list these in the output with the trigger, and give no config for them yet):

- Discovery instead of a central list: when a shared root has been edited by about three features or keeps causing merge conflicts. If several contributors will add features in parallel from the start, central lists will conflict at once, so move discovery to day one for those lists only.
- Generators: when the same kind of change has been made by hand about three times and copies of the reference feature have started to drift.
- An exceptions file and architecture review through `CODEOWNERS`: at the first exception that cannot be a one-line suppression, or when a second reviewer joins.
- Architecture tests beyond import rules: when a rule cannot be expressed in the import-rule config.
- Ratchets: only when turning a rule on over existing violations.

Keep the document as short as the day-one list allows. Config for deferred items is a cost the user pays now for a benefit that may never come.

### Auditing an existing repo or change

1. Read the folder layout, package manifests, any existing lint or architecture-rule config, and the agent instruction files.
2. For each rule, look for its smells. Use git history to find shared roots: files touched by many unrelated feature commits, and files with frequent merge conflicts.
3. For each finding, check whether a guardrail already covers it.
4. Report using the format below, biggest payoff first. Payoff is roughly how many future changes the fix protects, divided by the effort to add it.

```markdown
## Agent-proof audit: <repo or area>

| # | Rule | Where | What a narrow-context contributor would do wrong | Proposed guardrail | Effort |
|---|------|-------|--------------------------------------------------|--------------------|--------|

### Details
<per finding: evidence (paths, commit counts), the guardrail config or test, and its error message>

### Already well guarded
<rules that already fail mechanically, so nobody re-adds them>
```

Do not change code during an audit unless the user asks for fixes.

## Keep it proportionate

The aim is fewer wrong changes, not more machinery.

- Prefer the cheapest guardrail that fails reliably: an existing compiler or linter setting beats a new tool, and a new tool beats a custom one.
- Do not add a seam that only one adapter will ever fill (see `codebase-design`).
- Rules 2 and 3 pay off from the first commit. Rules 4 and 5 pay off as features and contributors grow, so their machinery waits for the triggers listed under "Designing".
- In an audit, propose the smallest guardrail that closes each finding. A finding that one import rule fixes does not need a new package or framework.

## Related skills

- `codebase-design`: the vocabulary and the shape of one module's interface (deep modules, seams, adapters). Use it when the question is how a single module should look.
- `/correct`: a manual workflow that mines past agent mistakes in a repo and turns each repeated class into a guardrail. Use this skill to design ahead; use `/correct` when the mistakes have already happened.
