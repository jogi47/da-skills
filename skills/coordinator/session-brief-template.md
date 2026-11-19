# Session brief template

Fill every section; write "none" rather than leaving one out. The session has seen none of the
coordinator's conversation, so name files by absolute path and state facts, not references to earlier
discussion.

```
## Goal
One or two sentences: what must be true when you finish.

## Context
What this is part of and why. Decisions already made, anything ruled out.
Paths or links to the plan, ticket and PR (read them; they are not copied here).

## Repo and where you work
Repo: <absolute path>. Read its CLAUDE.md and CLAUDE.local.md (if present) before anything else.
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
- What you did not do or could not check, and why.
- Questions left for the coordinator.
<For a review: findings with file, line, severity and a concrete failure case.>
```
