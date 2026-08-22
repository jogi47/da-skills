# ExecPlan Standard

Use this reference when writing, revising, reviewing, or executing an execution plan. An ExecPlan is a living design document that a coding agent can follow to deliver a working feature or system change. Treat the reader as a complete beginner to the repository. They have only the current working tree and the single ExecPlan file. They do not have memory of prior plans or external context.

## Core Contract

Every ExecPlan must be fully self-contained. In its current form it must contain all knowledge and instructions needed for a novice to succeed.

Every ExecPlan is a living document. Contributors must revise it as progress is made, as discoveries occur, and as design decisions are finalized. Each revision must remain self-contained.

Every ExecPlan must enable a complete novice to implement the feature end to end without prior knowledge of the repo.

Every ExecPlan must produce demonstrably working behavior, not merely code changes that satisfy an internal definition.

Every term of art must be defined in plain language or avoided.

Purpose and intent come first. Begin by explaining why the work matters from a user's perspective: what someone can do after this change that they could not do before, and how to see it working. Then guide the reader through the exact steps to achieve that outcome, including what to edit, what to run, and what they should observe.

## Using Existing PLANS.md

When authoring an ExecPlan, follow repo-local `PLANS.md` to the letter if it exists. Read the whole file before writing or revising the plan. Start from the skeleton below and flesh it out as research proceeds.

When implementing an ExecPlan, do not prompt the user for generic next steps. Proceed to the next milestone, keep every section up to date, and add or split `Progress` entries at every stopping point so the file states both what was completed and what remains.

When discussing an ExecPlan, record decisions in the `Decision Log` for posterity. The file should make it clear why any change to the specification was made.

When researching a design with challenging requirements or significant unknowns, include milestones for proof of concepts or toy implementations. Read library source when needed, research deeply, and include prototypes that validate feasibility before committing to the full implementation.

## Formatting Requirements

When outputting an ExecPlan in chat, wrap the entire plan in one single fenced code block labeled `md`. The first line is the opening fence and the last line is the closing fence. Do not include any additional triple-backtick fences inside the plan. When commands, transcripts, diffs, or code are needed, present them as indented blocks inside the single fence.

When writing an ExecPlan to a Markdown file where the file content is only the ExecPlan, omit the outer triple backticks.

Use Markdown headings with `#`, `##`, and lower levels as needed. Use two blank lines after every heading. Write in plain prose. Prefer sentences over lists. Avoid checklists, tables, and long enumerations unless brevity would obscure meaning. Checklists are permitted only in `Progress`, where they are mandatory.

## Required Living Sections

Every ExecPlan must contain and maintain these sections:

- `Progress`
- `Surprises & Discoveries`
- `Decision Log`
- `Outcomes & Retrospective`

`Progress` must use checkboxes and timestamps. It must reflect the current state of work at every stopping point.

`Surprises & Discoveries` must capture unexpected behaviors, bugs, optimizations, performance tradeoffs, inverse or rollback behavior, and other insights that shaped the approach. Include concise evidence when possible.

`Decision Log` must record each decision made while working on the plan. Use this format:

    - Decision: ...
      Rationale: ...
      Date/Author: ...

`Outcomes & Retrospective` must be updated at major milestones and completion. It should compare actual results against the original purpose, state gaps, and capture lessons learned.

When revising a plan, reflect changes across all affected sections and write a note at the bottom of the plan describing what changed and why.

## Self-Containment Guidelines

Define non-obvious phrases immediately. If using terms like "daemon", "middleware", "RPC gateway", or "filter graph", explain them in plain language and say where they appear in this repository.

Do not say "as defined previously" or "according to the architecture doc" unless the needed explanation is also included in the plan. It is fine to reference a checked-in prior ExecPlan, but if it is not checked in, include all relevant context from it.

Do not point to external blogs or docs for required knowledge. Embed required knowledge in your own words.

Name repository-relative paths, functions, classes, modules, services, commands, and environment assumptions explicitly. If touching multiple areas, include an orientation paragraph that explains how those areas fit together.

Resolve ambiguity inside the plan. Do not outsource key decisions to the reader. Explain why the chosen path is appropriate.

## Observable Outcomes and Acceptance

Anchor the plan with behavior a human can verify. State what the user can do after implementation, the commands to run, and what output or system behavior they should see.

Acceptance criteria should be user-observable. Prefer statements such as "after starting the server, navigating to http://localhost:8080/health returns HTTP 200 with body OK" over internal statements such as "added a HealthCheck struct".

If the change is internal, explain how its impact is demonstrated. For example, cite a test that fails before the change and passes after, or an end-to-end scenario that exercises the new behavior.

Validation is mandatory. Include exact test commands, the working directory for each command, expected outputs, and how to interpret failures. If the system should be started manually, include the command and the observable behavior to check.

Capture concise evidence: terminal output, small diffs, logs, or transcripts that prove success. Keep evidence focused.

## Idempotence and Recovery

Write steps so they can be run more than once without causing damage or drift. If a step can fail halfway, include how to retry or adapt.

If a migration, data deletion, or destructive operation is necessary, spell out backups, safe fallbacks, and rollback options. Prefer additive, testable changes that can be validated incrementally.

## Milestones

Milestones are narrative, not bureaucracy. Each milestone should explain the scope, what will exist at the end that did not exist before, the commands to run, and the acceptance expected.

Each milestone must be independently verifiable and must incrementally implement the overall goal. Keep milestones readable as a story: goal, work, result, proof.

Progress and milestones are distinct. Milestones tell the story. `Progress` tracks granular work.

Use prototyping milestones when they de-risk a larger change. Clearly label prototype scope, describe how to run and observe it, and state criteria for promoting or discarding it.

Parallel implementations are acceptable when they reduce migration risk or let tests keep passing during a large change. Describe how to validate both paths and how to retire one safely.

## Skeleton

Use this skeleton unless a repo-local `PLANS.md` requires a different one. Adapt headings only when the plan remains fully self-contained and keeps all required living sections.

    # <Short, action-oriented description>

    This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

    If a `PLANS.md` file is checked into the repo, reference its repository-relative path here and state that this document must be maintained in accordance with it.

    ## Purpose / Big Picture

    Explain in a few sentences what someone gains after this change and how they can see it working. State the user-visible behavior you will enable.

    ## Progress

    Use a list with checkboxes to summarize granular steps. Every stopping point must be documented here, even if it requires splitting a partially completed task into done and remaining parts. This section must always reflect the actual current state of the work.

    - [x] (2025-10-01 13:00Z) Example completed step.
    - [ ] Example incomplete step.
    - [ ] Example partially completed step (completed: X; remaining: Y).

    Use timestamps to measure rates of progress.

    ## Surprises & Discoveries

    Document unexpected behaviors, bugs, optimizations, or insights discovered during implementation. Provide concise evidence.

    - Observation: ...
      Evidence: ...

    ## Decision Log

    Record every decision made while working on the plan in this format:

    - Decision: ...
      Rationale: ...
      Date/Author: ...

    ## Outcomes & Retrospective

    Summarize outcomes, gaps, and lessons learned at major milestones or completion. Compare the result against the original purpose.

    ## Context and Orientation

    Describe the current state relevant to this task as if the reader knows nothing. Name key files and modules by full path. Define non-obvious terms. Do not refer to prior plans unless all needed context is included here or the prior plan is checked in and referenced by path.

    ## Plan of Work

    Describe the sequence of edits and additions in prose. For each edit, name the file and location, such as the function or module, and what to insert or change. Keep it concrete and minimal.

    ## Concrete Steps

    State exact commands to run and where to run them. When a command generates output, show a short expected transcript so the reader can compare. Keep this section updated as work proceeds.

    ## Validation and Acceptance

    Describe how to start or exercise the system and what to observe. Phrase acceptance as behavior with specific inputs and outputs. If tests are involved, say which command to run and what should pass. When possible, note which new test fails before the change and passes after.

    ## Idempotence and Recovery

    Say which steps can be repeated safely. For risky steps, provide safe retry or rollback guidance. Keep the environment clean after completion.

    ## Artifacts and Notes

    Include the most important transcripts, diffs, or snippets as indented examples. Keep them concise and focused on what proves success.

    ## Interfaces and Dependencies

    Be prescriptive. Name libraries, modules, and services to use and why. Specify types, interfaces, and function signatures that must exist at the end of the milestone. Prefer stable names and paths.

        In crates/foo/planner.rs, define:

            pub trait Planner {
                fn plan(&self, observed: &Observed) -> Vec<Action>;
            }

## Revision Note Requirement

When revising an existing ExecPlan, ensure the change is reflected across the whole document. Add a note at the bottom of the plan describing what changed and why. The plan must describe both what to do and why the chosen path is appropriate.
