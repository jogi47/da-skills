# Child brief template (T3 Code, Codex children)

Copy this shape for every child the coordinator starts. Fill every section; write "none" rather than
leaving one out. The child has seen none of the coordinator's conversation and runs on Codex, so name
files by absolute path, state facts rather than references to earlier discussion, and do not assume it
has loaded any rules file or skill you have not named here.

```
## Goal
One or two sentences: what must be true when you finish.

## Context
What this is part of and why. Decisions already made, the behaviour wanted, anything ruled out.
Links or paths to the plan, ticket and PR (read them; they are not copied here).

## Repo, rules and workspace
Repo: <absolute path of the repo's main checkout>.
Rules: before anything else, read <absolute path of the main checkout's AGENTS.md, or its
CLAUDE.local.md where there is no AGENTS.md> in full. It holds the workspace and repo rules and wins
over this brief where they differ. Your worktree does not contain it.
Where you work: <main checkout of <repo> | your own worktree at <absolute path>>.
Branch: <name>, cut from origin/<base> with --no-track.
Other children working at the same time: <none | which files they own, so you stay clear of them>.

## Limits
- You may commit your own work on your branch, and push it to its own remote branch once the checks
  under "Done when" pass. Before pushing, confirm `git rev-parse --abbrev-ref @{u}` is not dev,
  development, stag, stage, main, production, sandbox or anyone else's branch. If the push fails, say
  so and stop; the coordinator pushes.
- Do not open, merge or close a PR, push any shared branch, or rewrite pushed commits.
- Do not write to the sandbox, dev, stag or prod databases. Local MongoDB and local data only.
- Do not run data or migration scripts against any shared environment.
- Do not trigger, re-run or cancel any pipeline, workflow, deploy or store release.
- Holds on this area: <none | the hold, for example "do not run script X on any shared DB">.
- Never copy secrets or member personal data into files, commits or your report.
<For a review or investigation: read-only. Edit nothing, commit nothing, run nothing that changes state.>

## Files or area you own
- <absolute path or directory>
Touch nothing else. If another file needs changing, stop and say which and why.

## Steps
1. ...
Skills: <none | name, for a skill under ~/.agents/skills, ~/.codex/skills or the workspace's
.agents/skills | "read and follow <absolute path>/SKILL.md", for a skill only under ~/.claude/skills>

## Done when
- <checkable condition>
- <command to run and the expected result>

## Report back (keep it short)
Write anything long (findings, investigation results, data summaries) to <file or plan section>
and give its path; keep the note itself to the points below.
- Branch, head commit SHA, and whether it is pushed (remote branch name).
- Files changed, one line each.
- Commands run and their results. Quote errors exactly.
- What you did not do or could not check, and why (a blocked command or missing access: say exactly
  which, so the coordinator can get it unblocked).
- What you left running (local API, simulator, dev server, background job), or "nothing".
- If you stop while a background job is still running, say "waiting on <job>", not "done".
- Questions or decisions left for the coordinator.
<For a review: branch and SHA reviewed, then findings with file, line, severity and a concrete
failure case.>
<For PR work: end with one line, PR <full URL>, head <SHA>, checks and reviews <state>.>
```
