# Session brief template

Fill every section; write "none" rather than leaving one out. The session has seen none of the
coordinator's conversation, so name files by absolute path and state facts, not references to earlier
discussion.

Use it only for a fresh session. A follow-up to an existing session that already has the context goes
by `SendMessage` with just the delta: what changed, the findings file or plan section, done-when, and
any hold added since its brief.

Start settings (passed to `start_session`, not written into the brief):
- `context: "fresh"`, with `background` of at least 80 characters.
- `model`: the current Sonnet id; `effort: "high"`. Change only when the user names another for this task.
- `permission_mode`: omit, so the session inherits the coordinator's. Never pass a higher one.
- Where it works: `use_worktree` omitted (main checkout) from a workspace folder that is its own repo;
  `cwd` only when the user named the repo for this task (see SKILL.md section 8).

```
## Goal
One or two sentences: what must be true when you finish.

## Context
What this is part of and why. Decisions already made, anything ruled out.
Paths or links to the plan, ticket and PR (read them; they are not copied here).

## Repo and where you work
Repo: <absolute path>. Before anything else, open its CLAUDE.md and CLAUDE.local.md (if present)
with the Read tool. Repo rules and skills load only once a file in that repo has been read, so do this
even if you think you know the rules. Prefix every shell command with `cd <repo> &&` (or use
`git -C <repo>`), since each command starts back in the folder the session opened in.
Where: <main checkout | your own worktree at <path>>, branch <name> cut from <base> <convention>.
Other writers at the same time: <none | which files they own>.

## Limits
- Follow the workspace's permission rules (<path to CLAUDE.md section>). In short: <what this session
  may do without asking, for example commit and push its own task branch; what it must not do, for
  example open a PR, push a shared branch, write a shared database, trigger a pipeline>.
- Holds on this area: <none | the hold, for example "do not run script X on any shared DB">.
- Never copy secrets or personal data into files or your report.
<For a review or investigation: read-only. Edit nothing and run nothing that changes state.>

## Files or area you own
- <absolute path or directory>
Touch nothing else. If another file needs changing, stop and say which and why.

## Steps
1. ...
Skills to load: <name, or none>

## Done when
- <checkable condition>
- <command to run and the expected result>

## Report back (short)
Write anything long to <file or plan section> and give its path.
- Branch and head SHA you worked on or reviewed.
- Files changed, one line each.
- Commands run and their results; quote errors exactly.
- What you did not do or could not check, and why (a blocked command or missing access: say exactly
  which, so the coordinator can get it unblocked).
- What you left running (local API, simulator, dev server, background job), or "nothing".
- If you stop while a background job is still running, say "waiting on <job>", not "done".
- Questions left for the coordinator.
<For a review: findings with file, line, severity and a concrete failure case.>
```
