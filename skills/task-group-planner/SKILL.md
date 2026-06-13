---
name: task-group-planner
description: "Create design-spec-verified task-group planning artifacts from a deliverable, requirement, PR plan, implementation brief, or project task document. Requires a designSpecAdvocateThreadId from an agent using the design-spec-advocate skill before starting; stop if it is missing. Use when the user wants a plan file, progress file, and scratchpad file with indexed vertical-slice tasks, dependency-aware groups, verification gates, and required design-spec advocate approval."
---

# Task Group Planner

Use this skill to turn a source deliverable or requirement document into design-spec-verified task-group artifacts.

This is not standalone planning. A `designSpecAdvocateThreadId` is required before any draft is created.

Create three Markdown artifacts:

- Plan file: stable task-group plan and dependency map.
- Progress file: live execution state for agents working the plan.
- Scratchpad file: shared notes, findings, commands, links, and context useful to future or parallel agents.

## Required Inputs

- Source deliverable, requirement, PR plan, implementation brief, or task document.
- `designSpecAdvocateThreadId`: Codex thread/session id created by the `design-spec-advocate` skill.

If `designSpecAdvocateThreadId` is missing, stop upfront and ask the user for it. Do not draft artifacts.

## Workflow

1. Confirm `designSpecAdvocateThreadId` exists. Stop if missing.
2. Locate and read the source file the user names.
3. Read related inputs needed to plan correctly: linked docs, referenced specs, TODO lists, bug lists, PR notes, acceptance criteria, and repo instructions.
4. Extract phases, deliverables, known bugs, constraints, verification gates, dependency notes, blockers, conflicts, and assumptions.
5. Preserve the source document's intent. Do not invent scope.
6. Split work into small indexed vertical slices where possible, with type, size, dependency, and verification notes.
7. Group related tasks by dependency boundary and outcome.
8. Write three draft Markdown output files: plan, progress, and scratchpad. Only provide inline-only output when the user explicitly asks for no files.
9. Send the draft plan packet to the design-spec-advocate thread for verification.
10. Apply verifier feedback. If approved, mark the plan ready. If revisions are requested, update artifacts and repeat verification if needed. If blocked, stop and surface blocker.
11. If writing a repo plan doc, use the repo's required plan-doc location and workflow.
12. If no repo plan location exists, write files beside the source doc or in the current working directory.
13. Name companion files from the plan filename, e.g. `task-group-plan-[slug].md`, `task-group-plan-[slug]-progress.md`, and `task-group-plan-[slug]-scratchpad.md`.
14. Treat the plan file as stable after approval. Put execution updates in the progress file, not the plan file, unless the plan itself changes.

## Diligence Pass

Before writing the plan, check and record:

- Source docs read, with exact paths.
- Related docs found and read.
- Referenced docs not found.
- Inputs intentionally skipped, with reason.
- Conflicts between sources.
- Assumptions needed to proceed.
- Open blockers or questions.
- Verification gates required by source or repo rules.

If the source is missing, ambiguous, or contradictory in a way that changes scope, stop and ask the user. If uncertainty does not block planning, label it as an assumption.

## Design Spec Advocate Verification

Before marking planning complete, verify task understanding with the design-spec-advocate thread.

Rules:

- Required thread id: `designSpecAdvocateThreadId`.
- Use available Codex thread tools to send the verification packet and read the response.
- If thread tools are unavailable, stop and ask the user to enable the tool or manually relay the packet.
- Plan status stays `Draft` until the advocate returns `Approved`.
- Accepted advocate outcomes: `Approved`, `Needs Revision`, `Blocked`.
- Record the thread id, status, feedback summary, and action taken in the plan and progress files.

Verification packet must include:

- Source docs and related docs checked.
- Referenced docs not found.
- Missing inputs, assumptions, conflicts, and blockers.
- Task groups.
- Task index.
- Dependency map and rationale.
- Vertical-slice reasoning.
- Verification gates.
- Specific questions for the advocate, if any.

## Task Index Rules

Use stable IDs:

- Use the source phase as prefix when available, such as `P1`, `P2`, `P3`.
- Use group IDs like `G1`, `G2`, `G3`.
- Use task IDs like `P1-00`, `P1A-01`, `P1B-03`.
- Keep IDs stable even if wording changes.
- Make each task small enough to complete and verify independently.
- Start task names with a concrete action verb.
- Each task needs a done condition or verification gate.
- Avoid `L` tasks when practical; split them unless the source requires one larger unit.

## Task Type Rules

Show task type near the task list.

| Type | Meaning |
|---|---|
| `Slice` | End-to-end user/system outcome that can be verified independently |
| `Prereq` | Required setup, discovery, migration, harness, or shared groundwork |
| `Verify` | Regression, closeout, review, or release check |

Prefer `Slice` for implementation work. Use `Prereq` only when the work cannot produce an independently verifiable outcome yet.

## Vertical Slice Rules

Prefer thin end-to-end functionality over horizontal layers.

- A `Slice` should include all layers needed for one outcome: UI/API/state/data/tests, as applicable.
- A `Slice` must have a trigger/input, behavior change, user/system outcome, and its own verification.
- Avoid tasks like `build all UI`, `add all API`, `wire state`, or `write all tests` unless they are truly `Prereq`.
- If a horizontal `Prereq` is needed, keep it small and state which later `Slice` proves it works.
- Do not defer verification of early work until the final slice when a smaller end-to-end slice can verify it now.
- Split by observable behavior, workflow step, or system capability, not by file type alone.

## Task Size Rules

Show size near the task list.

| Size | Meaning |
|---|---|
| `XS` | Tiny doc/read/check change; usually one focused step |
| `S` | Small isolated task; one file or narrow behavior |
| `M` | Moderate task; several files or meaningful test coverage |
| `L` | Large task; broad behavior, risky integration, or many dependencies |

If a task is `L`, explain why it cannot be split yet.

## Grouping Rules

Group by dependency boundary and verifiable outcome, not by file name alone.

For every group, state:

- Outcome it produces.
- Tasks it owns.
- Groups it depends on.
- Groups it unblocks when relevant.
- Done condition.

Default groups for repo implementation plans:

| Group | Purpose |
|---|---|
| `G1` | Discovery, source docs, affected files |
| `G2` | Audit or assessment work |
| `G3` | Test-first coverage or slice harness |
| `G4` | Vertical implementation slices |
| `G5` | Entry path or integration fixes |
| `G6` | Verification, review, closeout |

Adjust group names to match the source. Keep dependencies explicit.

## Dependency Rules

- Use `none` only when a task or group can start immediately.
- For each dependency, state the exact task or group ID.
- Do not mark uncertain dependency as fact; use `Assumption:` in the dependency note.
- If task order matters because of tests, data shape, migrations, design approval, or user review, make that dependency explicit.
- Include a dependency map when the plan has more than six tasks.

## Multi-Agent Artifact Rules

Create companion files for every plan:

| Artifact | Purpose | Update Rule |
|---|---|---|
| Plan | Stable scope, tasks, groups, dependencies, verification plan | Update only when plan changes |
| Progress | Live execution state, ownership, status, blockers, completed checks | Update before and after each task/group |
| Scratchpad | Shared discoveries, raw notes, commands, links, decisions, handoff context | Update whenever context may help another agent |

Progress file rules:

- Start every agent session by reading the plan, progress file, and scratchpad.
- Before writing, reread the latest progress and scratchpad files, then merge your update with any new rows.
- Claim a task/group before starting it.
- Do not claim a task/group already claimed by another active agent.
- Record status as `Not Started`, `Claimed`, `In Progress`, `Blocked`, `Done`, or `Needs Review`.
- Record what changed, checks run, blockers, and next suggested task.
- Track actual verification state in `Verification Status`.
- Do not store raw investigation dumps in progress; put those in scratchpad and link/point to them.
- Multiple tasks can be active at once; track them in `Active Workstreams`.
- Prefer append-only `Activity Log` entries for coordination. Do not rewrite another agent's entries.
- Treat claims with stale `Last Update` as stale only after the project-defined timeout or, if none exists, after 2 hours.
- To take over stale work, add a takeover entry in `Activity Log`; do not silently replace ownership.
- If two agents edit the same file concurrently, preserve both updates and add a conflict-resolution note.

Scratchpad rules:

- Use for reusable context, not task status.
- Prefer dated short notes with task/group IDs.
- Include exact file paths, commands, test data, links, assumptions, and unresolved questions.
- Keep stale or disproven notes but mark them `Superseded` instead of deleting if another agent may have seen them.
- Use append-only entries where possible. Do not delete another agent's note; add a correction or `Superseded` marker.

## Output Template

For a concise answer, use:

```markdown
**Output File**

- `[path/to/task-group-plan.md]`
- Progress: `[path/to/task-group-plan-progress.md]`
- Scratchpad: `[path/to/task-group-plan-scratchpad.md]`

**Task Groups**

| Group | Scope | Outcome | Tasks | Depends |
|---|---|---|---|---|
| `G1` | ... | ... | `P1-00`, `P1-01` | none |

**Task Index**

| Index | Type | Size | Task | Outcome | Depends | Verification |
|---|---|---|---|---|---|---|
| `P1-00` | `Slice` | `S` | ... | ... | none | ... |

**Recommended Order**

1. `G1`
2. `G2`
3. `G3`
```

For a plan doc, use:

```markdown
# [Deliverable Name] — Task Group Plan

## Source

- Source doc: `[path]`
- Scope: `[phase/deliverable]`
- Output file: `[path]`
- Progress file: `[path]`
- Scratchpad file: `[path]`
- Plan status: Draft
- Design spec advocate thread: `[designSpecAdvocateThreadId]`

## Specs / Inputs Checked

- [ ] `[doc]`

## Missing Inputs / Assumptions / Conflicts

- Missing:
- Assumptions:
- Conflicts:

## Design Spec Advocate Verification

- Thread ID: `[designSpecAdvocateThreadId]`
- Status: Draft / Approved / Needs Revision / Blocked
- Feedback summary:
- Action taken:

## Task Groups

| Group | Scope | Outcome | Tasks | Depends | Unblocks | Done When |
|---|---|---|---|---|---|---|

## Task Index

| Index | Type | Size | Task | Outcome | Depends | Verification |
|---|---|---|---|---|---|---|

## Dependency Map

- `G1` -> `G2`: `[reason]`

## Recommended Execution Order

1. `G1`

## TDD / Verification Plan

- Add or update failing tests before implementation tasks where practical.
- Run required project checks before marking complete.

## Review / Outcome

To complete after implementation:

- Summary:
- Tests/checks run:
- Open follow-ups:
```

For a progress file, use:

```markdown
# [Deliverable Name] — Progress

## How To Update

- Read the plan, this progress file, and scratchpad before work.
- Reread this file immediately before saving; merge your update with any new rows.
- Claim one task/group before editing code.
- Do not claim work already owned by an active agent.
- Update status before and after work.
- Put durable findings in scratchpad, then reference them here.
- Do not edit the plan unless scope/tasks/dependencies change.
- Prefer append-only Activity Log entries. Do not rewrite another agent's notes.
- If a claim is stale for 2+ hours, add a takeover note before continuing it.

## Current Status

- Overall status: Not Started
- Planning verification: Draft
- Design spec advocate thread:
- Current blocker:
- Next suggested task:

## Active Workstreams

| Agent | Task/Group | Status | Started | Last Update | Blocker | Notes |
|---|---|---|---|---|---|---|

## Task Progress

| Task | Group | Status | Owner/Agent | Last Update | Notes |
|---|---|---|---|---|---|

## Verification Status

| Task | Required Verification | Status | Checked By | Evidence | Last Update |
|---|---|---|---|---|---|

## Planning Verification

| Date | Thread | Status | Feedback | Action Taken |
|---|---|---|---|---|

## Group Progress

| Group | Status | Owner/Agent | Last Update | Notes |
|---|---|---|---|---|

## Decisions / Blockers

| Date | Task/Group | Type | Note | Owner |
|---|---|---|---|---|

## Checks Run

| Date | Task/Group | Command/Check | Result | Notes |
|---|---|---|---|---|

## Activity Log

| Time | Agent | Task/Group | Action | Notes |
|---|---|---|---|---|
```

For a scratchpad file, use:

```markdown
# [Deliverable Name] — Scratchpad

## How To Update

- Add notes that may help future or parallel agents.
- Include exact paths, commands, links, sample data, and reasoning.
- Mark stale notes as `Superseded`; do not silently delete useful history.
- Prefer append-only entries. If correcting another note, add a new correction row.
- Keep task status in the progress file, not here.

## Source Notes

| Date | Task/Group | Note | Source |
|---|---|---|---|

## Findings

| Date | Task/Group | Finding | Evidence |
|---|---|---|---|

## Commands / Checks

| Date | Task/Group | Command | Result/Use |
|---|---|---|---|

## Open Questions

| Date | Task/Group | Question | Needed From |
|---|---|---|---|

## Handoff Notes

| Date | From | To/Next | Note |
|---|---|---|---|
```

## Quality Rules

- Keep output concise.
- Do not collapse unrelated tasks into one large task.
- Do not mark uncertain dependencies as fact; label them as assumptions.
- Do not leave a dependency blank; use `none` or an exact ID.
- Do not create broad `L` tasks without explaining why they cannot be split.
- Do not use horizontal implementation tasks when a vertical slice is practical.
- Do not label setup as `Prereq` without saying which later `Slice` verifies it.
- If source docs conflict, surface conflict in the plan.
- If a task blocks a later phase, state that clearly.
- Do not mark planning complete until design-spec-advocate status is `Approved`.
- Include verification gates from the source document.
- Include task type for every task.
- Include task size for every task.
- Include plan, progress, and scratchpad paths in the plan file.
- Keep live execution status in the progress file, not the plan file.
- Keep reusable investigation/context notes in the scratchpad.
- Prefer exact source file paths and exact phase names.
- Prefer writing Markdown artifact files over inline-only output.
