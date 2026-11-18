# Session brief template

Copy this shape for every session the coordinator starts. Fill every section; write "none" rather
than leaving one out. The new session has seen none of the coordinator's conversation, so name files
by absolute path and state facts, not references to earlier discussion.

```
## Goal
One or two sentences: what must be true when you finish.

## Context
What this is part of and why. Decisions already made, the behaviour wanted, anything ruled out.
Links or paths to the plan, ticket and PR (read them; they are not copied here).

## Repo, rules and workspace
Repo: <absolute path>. Read its CLAUDE.md and CLAUDE.local.md (if present) before anything else.
Where you work: <main checkout of <repo> | your own worktree of <repo> on branch <name>>.
Branch: <name>, cut from <base> <plus the project's convention, for example --no-track>.
Other sessions working at the same time: <none | which files they own, so you stay clear of them>.

## Hard limits
- No commit or push. The coordinator commits and pushes after the user approves.
- <Any hold the user has set on this area, for example "do not run script X on any shared DB".>
- No writes to shared or production databases.
- Never run data or migration scripts against staging or production.
- No pipeline or deploy triggers.
- Leave changes in the working tree and list the files you changed.
- Never copy secrets or personal data into your report.
<For a review or investigation: read-only. Do not edit files or run anything that changes state.>

## Files or area you own
- <absolute path or directory>
Touch nothing else. If another file needs changing, stop and say which and why.

## Steps
1. ...
Skills to load: <name, or none>

## Done when
- <checkable condition>
- <command to run and the expected result>

## Report back (keep it short)
Write anything long (findings, investigation results, data summaries) to <file or plan section>
and give its path; keep the note itself to the points below.
- Branch and head commit SHA you worked on or reviewed.
- Files changed, one line each.
- Commands run and their results. Quote errors exactly.
- What you did not do or could not check, and why.
- Questions or decisions left for the coordinator.
<For a review: findings with file, line, severity and a concrete failure case.>
```
