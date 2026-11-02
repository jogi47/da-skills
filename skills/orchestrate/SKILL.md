---
name: orchestrate
description: Run a multi-part task as an orchestrator. The main agent (Opus) plans, splits the work into independent pieces, briefs Sonnet subagents (sonnet-worker, sonnet-scout), checks every result itself and reports back. All work happens in the same checkout by default. Manual use only, through /orchestrate.
argument-hint: "What is the overall task?"
disable-model-invocation: true
---

# Orchestrate

You are the orchestrator. You own the plan, every design decision, the final check and all talk with
the user. Sonnet subagents do the legwork: searching, reading, mechanical edits, writing tests, running
commands. A subagent's report is a claim, not proof; nothing is done until you have checked it.

Running this skill authorises you to plan, delegate and check work within the user's request. It
grants no git, deploy or shared-database permission the user has not given in chat.

## 0. Check the model

This skill is meant for an Opus main agent. If your system prompt says you are not an Opus model, tell
the user in one line that the orchestrator is running on a different model and how to switch (the
model picker in the app, or `/model opus` in the terminal), then carry on only if they say so.

## 0a. Check the subagents

This skill is for Claude Code. It uses two subagent definitions shipped in this skill's `agents/`
folder: `sonnet-worker` and `sonnet-scout`. Claude Code loads subagents from `~/.claude/agents/` (or a
project's `.claude/agents/`), not from a skill folder, so check that both are installed:

```sh
ls ~/.claude/agents/sonnet-worker.md ~/.claude/agents/sonnet-scout.md
```

If either is missing, offer to copy it from this skill's `agents/` folder into `~/.claude/agents/`, and
copy only on the user's yes. New subagents load at session start, so until the next session use the
fallback: `subagent_type: "general-purpose"` with `model: "sonnet"` in place of `sonnet-worker`, and
`subagent_type: "Explore"` with `model: "sonnet"` in place of `sonnet-scout`, and paste the matching
agent file's rules into each brief.

## 1. Understand before splitting

Read enough of the code yourself to know what the change is. Load the target repo's rules (its
`CLAUDE.md` or `CLAUDE.local.md`) before planning, because every brief has to carry them. If the work
needs a plan doc under the repo's rules, write it first; it is yours, never a subagent's.

Use `sonnet-scout` for wide searches whose result you only need as a conclusion ("where is X used",
"which files handle Y"). Several scouts can run at once.

## 2. Decide what to delegate

Delegate a piece only when all of these hold:

- it takes more than a handful of tool calls;
- it can be described fully in a brief, without this conversation;
- it does not need a judgement call the user or you should make.

Keep for yourself: design choices, anything touching security, money or data migrations at the
decision level, the final review, merging results and every message to the user. Small edits you can
make in a few calls you make yourself.

## 3. Split by file ownership

Work happens in the same checkout. File ownership is the only isolation, so:

- each task owns an explicit list of files (or directories); two tasks never own the same file;
- tasks that must touch the same file, or that depend on another task's output, run one after the
  other, not in parallel;
- shared resources have exactly one owner (you, unless you name a task): dependency installs and
  lockfiles, repo-wide formatters or codemods, generated files (snapshots, migrations, build output),
  dev servers and their ports;
- three to five parallel workers per batch at most. More means more overlap and more to review.

Write the split down in the task list before dispatching: task, agent, files owned, depends on.

## 4. Brief each subagent

Use `brief-template.md` in this folder for every brief. A subagent starts with an empty context: it has
not seen this conversation and may not have loaded the repo's rules, so the brief restates every hard
rule that applies. At minimum, in every brief:

- no git write operations of any kind (no add, commit, stash, reset, checkout, branch, push);
- no writes to any shared database or environment; local only;
- never copy secrets or personal data out of files, databases or logs into the report;
- touch only the files the brief names; if another file needs changing, stop and report it;
- do not start dev servers, install dependencies or run repo-wide formatters unless the brief says so.

Name any skill the subagent should use (for example `tdd`) in the brief.

## 5. Dispatch

- `sonnet-scout` for read-only research, `sonnet-worker` for anything that edits files or runs
  commands that change state. Keep `test-runner` for numbered UI or API test steps.
- Send independent tasks as several Agent calls in one message so they run in parallel.
- Never set `isolation: worktree` by default (see **Worktrees**).
- Wait for the results. Never guess or summarise a result that has not arrived.

## 6. Check every result

For each report:

1. Read the actual diff of the files it owned (`git diff -- <files>` in that repo). Compare it with the
   brief, not with the report.
2. Check it touched nothing outside its files (`git status` in that repo).
3. Note any question or blocker it raised and decide it yourself or ask the user.

Run the repo's tests, lint and type checks once, after every worker in the batch has finished. Runs
made while other workers were still editing can fail for reasons that are not real. If something is
wrong, fix it yourself when it is small, or send a follow-up brief to a new worker naming the exact
problem and the files.

## 7. Next batch, then report

Dispatch the next batch only after the previous one is checked. When everything is done, tell the user:
what changed (per repo, files), what you ran to check it and the result, what was not done or not
verified, and any decision you made on their behalf. Leave all changes in the working tree; staging
and committing wait for the user's instruction.

## Worktrees

Same checkout is the default. Use a worktree for a task only when the user approves it for that task,
and only for one of these: two tasks must change the same files at the same time, a risky experiment
that may be thrown away, or a worker that must test its own change on a running server alongside
others.

Before using one:

- The session must be started inside the product repo. From a parent folder that is its own git repo
  (such as a multi-repo workspace), `isolation: worktree` branches the parent repo, not the one being
  changed, and the worker edits the real tree while believing it is isolated. Never do that.
- A new worktree has no gitignored files: no local rule file, no `.env`, no `node_modules`. The brief
  must give the worker the repo's rules in full and say how to set up (copy `.env` without committing
  it, install dependencies).
- The work comes back only through git (commit, then merge or cherry-pick). Each of those waits for the
  user's instruction.

## Larger fan-outs

For ten or more agents, or a fixed pipeline (review then verify each finding), the Workflow tool is the
better fit. It needs the user's explicit opt-in ("use a workflow"). You may suggest it with a rough
cost; never start one on your own.
