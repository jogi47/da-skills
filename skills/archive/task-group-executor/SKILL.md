---
name: task-group-executor
description: "Execute, resume, review, or orchestrate work from existing task-group artifacts: plan, progress, and scratchpad Markdown files. Use when the user provides task-group artifact paths or asks to start, continue, resume, claim, coordinate, review completed work, or orchestrate a task-group plan by spawning Worker, Reviewer, and Resume subagents until the full task group is done or blocked."
---

# Task Group Executor

Use this skill to run work from existing task-group artifacts. Do not create the original plan; consume it.

In `Orchestrator` mode, the goal is to finish the entire task group through the required workflow:

`Orchestrator -> Worker subagent -> Reviewer subagent -> Done/Revision -> Resume subagent when needed`

The orchestrator coordinates and updates the plan/progress/scratchpad artifacts. Workers write code or other deliverables. Reviewers verify worker output and approve plan/task completion.

## Inputs

The user should provide:

- Plan file path.
- Progress file path.
- Scratchpad file path.

If only the plan path is provided, infer companion paths from the same basename:

- Plan: `<basename>.md`
- Progress: `<basename>-progress.md`
- Scratchpad: `<basename>-scratchpad.md`

Strip the plan file's `.md` extension before appending suffixes. Example:

- Plan: `task-group-plan-foo.md`
- Progress: `task-group-plan-foo-progress.md`
- Scratchpad: `task-group-plan-foo-scratchpad.md`

If any required file is missing and cannot be inferred, ask for paths.

## Modes

Choose the mode from the user request:

| Mode | Use When | Output |
|---|---|---|
| `Orchestrator` | User asks to start, coordinate, assign, or complete execution | Creates/monitors subagents, updates artifacts, drives all groups to Done or Blocked |
| `Worker` | User asks you to do/claim/continue a task | Claim one task, execute it, verify it, update artifacts |
| `Reviewer` | User asks to review completed/integrated work, or a task is ready after worker verification | Compare code/output against task description and verification steps; approve or return findings |
| `Resume` | A worker/reviewer fails, stalls, loses context, or user asks where things stand | Recover state, identify continuation point, recommend or hand off next Worker/Reviewer action |

If unclear, default to `Resume` plus recommended next action.

## Start Workflow

1. Read latest plan, progress, and scratchpad.
2. Confirm planning verification is ready:
   - Design-spec advocate status must be `Approved` when the plan includes it.
   - Reviewer plan approval must exist before implementation starts.
   - If reviewer plan approval is missing, Orchestrator creates a Reviewer subagent to review the plan/progress/scratchpad and approve or return findings. Do not ask the user for plan approval unless Reviewer blocks on missing external input.
3. Identify task groups, task index, dependencies, task types, sizes, outcomes, and verification gates.
4. Read progress for `Active Workstreams`, task/group status, verification status, blockers, checks, and activity log.
5. Read scratchpad for reusable findings, assumptions, open questions, and handoff notes.
6. Summarize:
   - Done tasks.
   - Active tasks.
   - Blocked tasks.
   - Unblocked unclaimed tasks.
   - Stale claims.
   - Next recommended task(s).
7. Before writing progress or scratchpad, reread latest files and merge new rows.

## Orchestrator Rules

- Drive the full task group to completion: every task and group becomes `Done`, or execution stops with a recorded blocker.
- Do not implement code or task deliverables. Use Worker subagents for implementation.
- Prefer subagents for all Worker, Reviewer, and Resume work. The Orchestrator directly edits only coordination artifacts: plan, progress, and scratchpad.
- Use available subagent/thread tools to create each subagent. Apply this same skill to each subagent with the required mode, artifact paths, task/group ID, and relevant context.
- If subagent tools are unavailable, stop and report that orchestration requires subagent/thread creation, or ask the user to start the needed Worker/Reviewer/Resume thread manually.
- List unblocked tasks by dependency order.
- Assign `Prereq` tasks first when they unblock later slices, prefer `Slice` tasks for implementation work, and assign `Verify` tasks after dependent work is complete.
- Allow multiple active tasks only when dependencies do not overlap.
- Do not assign a task already owned by an active agent.
- After a Worker finishes a task, create a Reviewer subagent before treating the task as closed.
- Treat worker-finished tasks as `Needs Review` until reviewer approves them.
- If a Worker or Reviewer fails, stalls, or loses context, create a Resume subagent to recover state from the artifacts, then create a Worker or Reviewer subagent to continue.
- If a claim is stale for 2+ hours, create a Resume subagent or recommend takeover and require an `Activity Log` entry.
- Keep plan stable unless scope, task list, or dependencies changed.
- Continue the orchestration loop until no unblocked work remains, all groups are done, or a blocker is recorded.

## Subagent Packet

When creating a subagent, pass:

- This skill name: `task-group-executor`.
- Mode: `Worker`, `Reviewer`, or `Resume`.
- Plan path.
- Progress path.
- Scratchpad path.
- Exact task/group ID and expected outcome.
- Current dependency status.
- Required verification gate.
- `designSpecAdvocateThreadId` when present.

For Worker subagents, ask them to claim exactly one task unless the plan explicitly assigns a group.

For Reviewer subagents, ask them to verify the claimed task or plan approval against the plan, progress, scratchpad, source docs/specs, and recorded checks.

For Resume subagents, ask them to reconstruct current state from the three artifacts, identify the failed/stale work, and hand off the next concrete Worker or Reviewer action.

## Worker Rules

Before work:

1. Pick the assigned task, or the first unblocked unclaimed task.
2. Confirm dependencies are done or not required.
3. Reread progress and scratchpad.
4. Update progress:
   - Add/update `Active Workstreams`.
   - Mark task `Claimed` or `In Progress`.
   - Add `Activity Log` row.

During work:

- Follow the plan task exactly; do not invent scope.
- Prefer vertical-slice completion over horizontal partial work.
- Put reusable findings, exact paths, commands, data, and open questions in scratchpad.
- Put live task status, checks, blockers, and handoff state in progress.

After work:

1. Run the task's verification gate.
2. Reread progress and scratchpad before saving final updates.
3. Update task/group status: `Needs Review` when implementation and verification pass, or `Blocked` when they do not.
4. Update `Verification Status` with `Passed`, `Failed`, `Skipped`, or `Needs Rerun`.
5. Add checks run.
6. Remove/close your active workstream when done.
7. Add reviewer handoff notes: changed files, verification run, known risks, and exact task ID.
8. Add next suggested task.

## Reviewer Rules

Reviewers approve either the plan before execution or worker output after execution.

For plan approval:

1. Read plan, progress, and scratchpad.
2. Confirm design-spec advocate status is `Approved` when required by the plan.
3. Check task/group structure, dependencies, verification gates, blockers, and assumptions.
4. Use the design-spec-advocate thread for unresolved spec questions.
5. Record `Approved`, `Needs Revision`, or `Blocked` in progress.
6. If approved, Orchestrator may start Worker subagents. If not approved, Orchestrator routes fixes before implementation.

For task review, review the integrated code/output against the task, not just general code quality.

1. Read plan, progress, and scratchpad.
2. Identify the task description, outcome, dependencies, and verification steps.
3. Find `designSpecAdvocateThreadId` from plan or progress when present.
4. Inspect changed files and relevant surrounding code.
5. Compare implementation to:
   - Task description.
   - Expected outcome.
   - Verification gate.
   - Source docs/specs referenced by the task.
   - Vertical-slice requirement.
6. If spec/task interpretation is unclear, ask the design-spec-advocate thread before approving.
7. Check that the worker recorded verification results.
8. If needed, run or request focused verification.
9. Update progress:
   - `Done` only when task matches scope and `Verification Status` is `Passed`, or `Skipped` has an approved reason in `Activity Log`.
   - `Needs Review` when review is incomplete.
   - `Blocked` when task cannot pass due to missing info or external issue.
   - Add findings and required fixes in `Activity Log`.
   - Set `Verification Status` to `Needs Rerun` if code changed or evidence is stale.
10. Put reusable review findings or evidence in scratchpad.

Reviewer output should lead with findings. If no findings, say that clearly and name any residual risk.

Use the design-spec-advocate thread when:

- Task/spec interpretation is unclear.
- Implementation differs from task wording but may still satisfy intent.
- Verification result is ambiguous.
- Source docs/specs conflict.
- A task is underspecified.
- Plan approval is unclear or reviewer needs spec authority before execution starts.

If the advocate thread id is missing when needed, block review and ask the user for it. Record advocate questions/answers in scratchpad and the review decision in progress.

## Concurrency Rules

- Reread progress and scratchpad immediately before every write.
- Merge with new rows; do not overwrite another agent's update.
- Prefer append-only entries in `Activity Log` and scratchpad.
- Do not delete another agent's note; add a correction or `Superseded` marker.
- If two agents edit the same file or task, preserve both updates and add a conflict-resolution note.
- Take over stale work only by adding a takeover row in `Activity Log`.

## Dependency Rules

- A task is unblocked only when all listed dependencies are done or explicitly marked not required.
- `Prereq` tasks should be small and tied to a later `Slice` that proves them.
- `Slice` tasks must have independent verification.
- Do not mark a group done until all owned tasks are done and its done condition is met.

## Progress Update Shape

When claiming:

```markdown
| [agent] | `[task/group]` | In Progress | [started] | [last update] | none | [short note] |
```

When logging:

```markdown
| [time] | [agent] | `[task/group]` | Claimed/In Progress/Done/Blocked/Takeover | [short note] |
```

When recording checks:

```markdown
| [date] | `[task/group]` | `[command/check]` | Passed/Failed/Skipped | [notes] |
```

When updating verification status:

```markdown
| `[task]` | `[required verification]` | Passed/Failed/Skipped/Needs Rerun | [agent] | [command/output/file/link] | [date] |
```

## Response Shape

Keep responses concise:

- Current status.
- Claimed/assigned task(s).
- Review result/findings when in `Reviewer` mode.
- Files updated.
- Verification run/result.
- Blockers or next task.
