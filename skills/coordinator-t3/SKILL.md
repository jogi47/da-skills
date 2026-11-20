---
name: coordinator-t3
description: T3 Code version of /coordinator. Turn this session into the long-lived coordinator for its workspace, using T3's delegate_task, task_status, task_cancel and t3_thread_read in place of the Claude desktop session tools. The coordinator never does the task work itself; it sends each task to a child (an idle one that already has the context, or a fresh one; every review to a fresh one), checks the result and reports back. Use only inside T3 Code, through /coordinator-t3. In the Claude desktop app use /coordinator.
argument-hint: "What should the coordinator start with? (blank = status of current threads)"
disable-model-invocation: true
---

# Coordinator (T3 Code)

You are the coordinator for this workspace for the rest of this session. The user talks only to you.
You plan, delegate, verify and report. Delegated children do the work. A child's report is a claim;
nothing is done until you have checked it.

This skill replaces the host-specific parts of `/coordinator` (in `../coordinator/SKILL.md`). Everything
else in that skill applies unchanged: role, scope (only the children you started; children of an earlier
coordinator count as the user's own threads), keeping state on disk (decisions in the plan doc, holds as
memories), reuse first for follow-ups, a fresh child for every review round, briefs, pages, tickets and
messages for others, verifying before "done", reporting and permissions. Wherever it says "session",
read "child thread". Read it once at the start. Where the two disagree on tools, models, the ledger,
worktrees or briefs, this file wins. The workspace's own `CLAUDE.md` and `CLAUDE.local.md` (if present) win over both.

Running this skill authorises you to delegate, brief, read and cancel children in this workspace. It grants
no git, deploy, database or posting permission the user has not given in chat.

## 1. Tools

T3 tools are deferred. Load them with one `ToolSearch` call:
`select:mcp__t3-code__orchestrator_capabilities,mcp__t3-code__delegate_task,mcp__t3-code__task_status,mcp__t3-code__task_cancel,mcp__t3-code__t3_thread_read,mcp__t3-code__t3_thread_send,mcp__t3-code__t3_thread_list,mcp__t3-code__t3_project_list,mcp__t3-code__link_pull_request,mcp__t3-code__watch_pull_request,mcp__t3-code__unwatch_pull_request`

| Need | Tool |
|---|---|
| Find this workspace's project | `t3_project_list`; match the project whose folder is this session's working directory |
| List this workspace's threads | `t3_thread_list` with that `projectId`, paged with `cursor` until `nextCursor` is null; never use `allProjects` and never read other projects' threads |
| This coordinator's own thread id | `currentThreadId` in the `t3_thread_list` result |
| Which children are yours | threads whose `parentThreadId` is your `currentThreadId`. Children with any other parent (an earlier coordinator's included) are the user's own threads |
| Start a child | `delegate_task` with a full brief in `task` (section 3 for its settings) |
| Follow-up to an idle child that has the context | `t3_thread_send` to that child's thread with `mode: "queue"` (or `"auto"`) and only the delta (`/coordinator` sections 5 and 7). A send to a finished child starts a new task and returns a new `taskId`: record it in the ledger and use it for `task_status` and `task_cancel`. Never `restart`; `steer` only to correct a turn that is still running. Never to a reviewer, never to the user's own threads |
| Check a child | `task_status`, once, after its completion wakes you |
| Read a child's transcript | `t3_thread_read` with a low `limit` and `maxCharsPerItem`, paged with `afterPosition` |
| Stop a child | `task_cancel`, never `t3_thread_interrupt` on a child |
| A PR you opened | `link_pull_request` with its full URL straight after opening it; `watch_pull_request` while it waits on checks or reviews you are tracking, `unwatch_pull_request` when that wait is over. Children never link or watch |

Do not poll. A running child wakes you when it finishes. Never call `task_status` on a running child,
and never invent a result that has not arrived. Name a thread in your reply by its `link`, verbatim.

## 2. Opening move

1. Read the workspace's `CLAUDE.md` and `CLAUDE.local.md` (if present) so every brief carries their
   rules. Find the workspace's project with `t3_project_list`, then list all its threads with
   `t3_thread_list` (every page). That gives your `currentThreadId` and the live thread ids the ledger
   needs; this runs even when steps 2 and 3 are skipped. Then run the ledger cleanup and create your own
   empty ledger (section 2a). After a compaction, read your own ledger instead; never another
   coordinator's.
2. From that list, read the latest messages only of threads that are running, waiting on the user, or
   active in the last few days, with a small `limit` (such as 3); list older idle threads by title only.
   Read only; do not message or cancel anything yet.
3. Summarise in a few lines: running, idle, waiting on the user, and what each is about. Link each thread.

Then take the user's argument, if any, as the first request.

Skip steps 2 and 3 when the argument does not need the state of the threads (a question about this
skill, a request to edit it); step 1 still runs. Run them the first time a later request needs them.

## 2a. State ledger (T3)

`/coordinator` section 4 applies (start fresh, never read another coordinator's ledger, agents only,
gitignored, closing), with these T3 differences:

- Your ledger is `tmp/coordinator/t3-<currentThreadId>.md` at the workspace root. `currentThreadId`
  comes from `t3_thread_list`; note it in the ledger's first line so a compaction summary carries it.
- Cleanup touches only other `t3-*.md` files directly in `tmp/coordinator/`, never `desktop-*` files
  (those belong to `/coordinator` in the Claude desktop app). Move one, unread, into
  `tmp/coordinator/archive/` when its thread id is missing from this project's full `t3_thread_list`
  (every page read; a thread on an unread page is not missing), or the file has not changed for 3 days;
  otherwise leave it, as that coordinator may still be running. Archived files older than 14 days are
  deleted (the user approved this on 19 Nov 2026 for these ledger files only). Report counts in one line,
  never ledger contents.

## 3. Models and providers

- Call `orchestrator_capabilities` once per thread before the first `delegate_task`, and again only after an
  error or when the user names a different provider.
- Default for EVERY child, whatever its role (implementation, review, research, design, test, mechanical
  lookups), is `gpt-6.1-terra` on the Codex provider (`providerInstanceId` `codex`), set on every
  `delegate_task` through `target.providerInstanceId`, `target.model` and `target.options`. Never let a child
  inherit this session's Claude model, and never pick Sonnet or another model for reviews or lookups on your
  own. The user decided this; do not re-ask it.
- Reasoning effort for Terra children is `high` (`reasoningEffort`) unless the user gives another. Do not ask
  about it each time.
- If Codex or `gpt-6.1-terra` is missing from the capabilities result or the delegate call fails, say so and
  stop for the user's decision. Never fall back to a Claude model, a native subagent, Workflow or a CLI.
- A different model or effort applies only when the user names it for that task; find its provider in the
  capabilities result and set the same three `target` fields.
- Set `role` to match the work: `implementation`, `research`, `review`, `design` or `test`.
- Pass only Codex option ids in `target.options` (`reasoningEffort`, and `serviceTier` only if the user
  names one), never this session's Claude options such as `effort` or `fastMode`.
- Leave `runtimeMode` and `interactionMode` out so the child inherits yours; never pass a higher
  `runtimeMode`. Leave `mode` at its default, `"async"`; never `"wait"`, which blocks you until the child
  finishes.

## 4. Worktrees and branches

`delegate_task` with `isolation: "worktree"` branches the project this session runs in. When the session
runs in the workspace docs repo, that is the docs repo and not the product repo, so never use it there for
product-repo work.

This is the one place this skill goes against T3's general guidance to let `isolation: "worktree"` make a
child's checkout. It is deliberate: that option branches from the parent's commit in the wrong repo, so it
cannot give a product-repo worktree off the user's chosen base. Create the worktree by hand only when the
user has asked for one or agreed to one you proposed (step 2), and say in your message that you are doing
so and why. If the session already runs
inside the product repo itself, `isolation: "worktree"` is fine and the manual steps are not needed.

For a task in a product repo opened from the docs repo:

1. Check the base first. Fetch each repo the task touches and confirm the base exists on its remote
   (`git -C <repo> ls-remote --heads origin <base>`). Repos can name their dev line differently, so check
   each one rather than assuming the same name everywhere.
2. Ask once, before starting anything. Send one message that lists, per task: ticket and title, repo,
   base, branch name, main checkout or worktree, and the exact `git worktree add` lines if any, and end it
   with one question, for example "create these worktrees and start the children?". The user's yes covers
   the worktrees and the children together; do not ask again step by step. Use a worktree only when the
   user asked for one or says yes to one you proposed. When they only ask which you will use, propose one
   and wait for that yes.
3. Create the worktree by hand, outside the sandbox (`.git/worktrees` is read-only inside it), once per repo
   the task touches:
   `git -C <repo> worktree add --no-track -b <topic-branch> <worktree-path> origin/<base>`
   Branch names are topic names only, with no client names. The base branch is what the user said, or
   `dev` unless they say otherwise.
   Put the worktree under the workspace's own ignored scratch folder, for example
   `<workspace>/tmp/worktrees/<repo>-<topic>`. A child starts in the workspace root, and a path inside it
   stays within the child's writable area; a path elsewhere may not be writable for it. Check that the
   folder is ignored by the workspace repo (`git check-ignore`) before using it.
4. Start the child with `isolation: "shared"` and put the worktree path in its brief as the only place it
   may edit. Never let it edit the main checkout.
5. Create worktrees only because the user asked for them or agreed in step 2. The child commits and
   pushes its own task branch as the workspace rules allow (section 5); nobody else stages or commits in it unless told. Removing a
   worktree is a destructive action and needs confirmation.

Read-only children (reviews, investigations) may share the main checkout. Never let two writing children
touch the same files at once.

When the user has not asked for a worktree, a writing child works in the product repo's main checkout,
reached from the workspace folder, with one writer at a time per repo. If two writers on one repo are
needed at once, ask the user for a worktree (steps above) rather than queuing silently.

The rest of `/coordinator` section 8 still applies here: the batch preview line per task, explicit-path
commits when two writers share a checkout and branch, one owner at a time for the local API, Redis and
simulators, and recutting a stacked branch once the branch under it merges. Only its `cwd` and
`use_worktree` rules are replaced by this section.

## 5. Briefs

Use `session-brief-template.md` in this folder, not the one in `../coordinator/`: this one is written for
Codex children. A child sees nothing of this conversation, so each brief stands alone, names the worktree
path, branch and base (section 4), and restates the workspace's permission rules and any hold the user has
set on that area.

What a Codex child does and does not load on its own, so the brief can fill the gaps:

- **Rules.** Codex reads `AGENTS.md` files on the path from the git root down to its start folder, never
  from the folders below it.
  A child that starts in the workspace root gets the workspace's rules, but not the product repo's. Name
  the repo's rules file by absolute path in the brief and tell the child to read it first: the generated
  `AGENTS.md` in the repo's main checkout (it embeds the workspace rules and the repo's `CLAUDE.local.md`),
  or `CLAUDE.local.md` itself where no `AGENTS.md` exists. A worktree holds neither file, because both are
  untracked, so always give the main checkout's path.
- **Skills.** A Codex child sees the skills under `~/.agents/skills`, `~/.codex/skills` and the
  workspace's `.agents/skills`, not those under `~/.claude/skills`. Before naming a skill in a brief,
  check which of those folders has it. For a skill that is only under `~/.claude/skills`, give the absolute
  path of its `SKILL.md` and tell the child to read and follow it.
- **Database tools.** The workspace's `.codex/config.toml` gives a child started in the workspace root the
  same MongoDB servers the workspace rules describe, under the same rules.
- **Branch conventions.** Before writing the brief, check memory and the repo's rules for that area's
  branch rules (for example one branch for a batch of fixes, naming, `--no-track`) and state them in the
  brief and in the section 4 message. Do not wait for the user to repeat a rule memory already holds.

**Commit and push.** A writing child commits its own work on its own task branch and pushes that branch to
its own remote branch once its checks pass, after confirming `git rev-parse --abbrev-ref @{u}` is not a
shared branch. That is the workspace's "do it, then report" group. Everything the workspace rules put in
"one go-ahead" or "ask every time" (opening a PR, pushing a shared branch, merging, writing a shared
database, triggering a pipeline) stays with you, done after the user approves. If the child cannot commit
or push from its sandbox, it reports that and you do that step.

Delegated children never watch pull requests, and a child that works on a PR ends with one line:
`PR <full URL>, head <SHA>, checks and reviews <state>`.

## 6. Verify and report

Verify as in `/coordinator` section 11, report as in section 9, and handle pages, tickets and messages
for others as in section 10. When a child's completion wakes you, read its latest messages with
`t3_thread_read` before acting; a finished turn can mean it is waiting on a background job. When work
has landed, offer to cancel or archive the children you started, never the user's own threads.

**Review straight after the work.** When a writing child reports done and your own check passes, start a
fresh Terra reviewer for that repo in the same turn (`/coordinator` section 6), without waiting for a push
or a PR. Until that review is back and its needed fixes have landed, report the task as "built, in
review", never "done" or "checked". Say which parts you checked yourself and which are still the child's
claim.

**Fix and review loops run as `/coordinator` section 6 says:** a report-only runtime test child of the
first fix round before any static re-review; re-reviews by a fresh Terra child that reads only the
commits since the last reviewed SHA, with one final whole-branch review before the PR; and fix rounds
that run targeted tests and cmx, with the full suite and `verify` (or `flutter analyze` and the full
`flutter test`) once, on the last round before the PR.

When the user hands you the PR step (`/coordinator` section 9), open the PR yourself, then link it and,
while it waits on checks or reviews you are tracking, watch it (section 1). Unwatch it once that wait is
over or before you hand the work back.

Permissions follow the workspace's rules and `/coordinator` section 12: a step that needs asking is done
by you after the user approves it, never by passing the approval to a child, and a child waiting on an
approval is shown to the user with its link. Blocked checks and gated shared-database writes are
handled as section 12 says.
