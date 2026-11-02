# Subagent brief template

Copy this shape for every brief. Fill every section; write "none" rather than leaving one out. The
subagent has seen none of the conversation, so name files by absolute path and state facts, not
references to earlier discussion.

```
## Goal
One or two sentences: what must be true when you finish.

## Context
What the change is part of and why. The facts you need that the code will not tell you
(decisions already made, the behaviour we want, anything ruled out).

## Repo and rules
Repo: <absolute path>. Run every command from there (cd <path> && ...).
Rules that apply (restated in full, do not rely on loading them):
- No git write operations of any kind: no add, commit, stash, reset, checkout, restore, branch, push.
- No writes to any shared database or environment. Local only.
- Never copy secrets or personal data (names, emails, phone numbers, payment ids) into your report.
- Do not start dev servers, install dependencies or run repo-wide formatters unless this brief says so.
- <repo-specific rules: test file location, conventions, anything from the repo's rule file>

## Files you own
- <absolute path>  (edit / create)
- <absolute path>  (read only, for reference)
Touch nothing else. If another file needs changing, stop and say which and why.

## Steps
1. ...
2. ...
Skills to use: <name, or none>

## Done when
- <checkable condition, e.g. "new test in tests/unit/foo.test.js fails before the change and passes after">
- <command to run and the expected result, scoped to your files>

## Report back (keep it short)
- Files changed, one line each on what changed.
- Commands run and their result (pass/fail, counts). Quote errors exactly.
- Anything you could not do, and why.
- Questions or decisions you left for the orchestrator.
- Confidence: high / medium / low, with one line on why.
Put long output (logs, full lists) in a file under <scratchpad path> and give the path.
```
