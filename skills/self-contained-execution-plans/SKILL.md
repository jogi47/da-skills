---
name: self-contained-execution-plans
description: Create, revise, review, or execute self-contained execution plans (ExecPlans) for coding work. Use when the user asks for an ExecPlan, execution plan, implementation plan, PLANS.md-style plan, living plan, milestone plan, or asks to update/maintain a plan so another stateless agent or novice can complete the work from the plan alone.
---

# Self-Contained Execution Plans

Use this skill to author and maintain executable specifications that a future agent can follow without prior conversation context.

## Required Reference

Before creating a new ExecPlan or materially revising an existing one, read `references/execplan-standard.md`. Treat it as the source of truth for required sections, formatting, living-document behavior, and acceptance standards.

## Workflow

1. Read the repository context, request, and any existing `PLANS.md` or plan file the user references. If a repo-local `PLANS.md` exists, read it completely and follow it unless it conflicts with the user's newer explicit instruction.
2. Research the relevant code and docs before writing implementation steps. Name the exact files, modules, commands, and assumptions the executor will need.
3. Draft or revise the ExecPlan so it is self-contained. Define project-specific terms in plain language and include enough context for a novice who only has the working tree and this plan.
4. Keep the living sections current every time the plan changes: `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`.
5. Make the plan outcome-focused. State what behavior will work afterward, how to run or observe it, and what output proves success.
6. When implementing from an ExecPlan, continue through the next milestone without asking for generic next steps. Update the plan at each stopping point so another agent can resume from the file alone.

## Output Rules

When returning an ExecPlan in chat, output one single fenced code block labeled `md`. Do not place any nested triple-backtick fences inside it; indent commands, diffs, code, and transcripts instead.

When writing an ExecPlan to a Markdown file whose whole content is the plan, omit the outer triple backticks.

Prefer prose over tables and long enumerations. Checklists are mandatory only in `Progress`; use timestamps in progress entries. Use two blank lines after headings.

## Quality Bar

An acceptable ExecPlan lets a stateless coding agent or human novice implement a demonstrably working change end to end. It must include purpose, context, concrete edits, exact commands, validation, idempotence and recovery guidance, dependencies, and enough evidence examples for the executor to recognize success.
