---
name: handoff
description: Write a self-contained handoff document for the current conversation to a file, so the user can start a new session themselves and continue the work from it. Starts no session and spawns no agent. Manual use only, through /handoff.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

# Handoff to a file

Write a handoff document a fresh agent can act on without this conversation, save it to a file, and
give the user its path and a short prompt to paste into a new session. This skill does not start a
session, create a subagent or hand anything to another agent; the user decides when and where the work
continues. To launch the new session as well, use `handoff-new-session` instead.

Running this skill authorises writing the handoff file only. It grants no git, deploy or database
permission, and the next session gets none the user has not given it in its own thread.

## 1. Gather the facts

Read the current state rather than recalling it:

- **Session:** this session's id, title and project folder, when the host exposes them (in the Claude
  desktop app, `mcp__ccd_session_mgmt__get_session` with `"self"`, loaded with ToolSearch if deferred).
  Do not invent ids; leave the field out if none is available.
- **Repositories:** for every git repository touched, the current branch
  (`git -C <repo> branch --show-current`), the last commit SHA (`git -C <repo> log -1 --format=%h`) and
  the working-tree state (`git -C <repo> status --short`).
- **Running processes:** see **Running processes** below.

## 2. Write the handoff

Save it as `handoff.md` inside a new directory from `mktemp -d -t handoff`, so it is not overwritten by
a later handoff. (On macOS, `mktemp -t handoff-XXXXXX.md` appends its random suffix after `.md`, so do
not use that form.) If the user asked for a specific location, use that instead.

Include, in this order:

1. **Goal**: what the user wants done, in their words where possible. If the user passed arguments,
   treat them as what the next session will focus on and tailor everything below to that.
2. **State now**: what is done, what is half done, what is not started. For every repository touched,
   the branch, last commit SHA and whether there are uncommitted or untracked changes, as read in step
   1. Never write a branch name as an instruction; state what you read.
3. **Running processes**: the table from **Running processes**, or "None".
4. **Next steps**: an ordered list, first step first, each concrete enough to start on.
5. **Decisions and constraints**: choices the user made in this conversation, rules they gave, approval
   boundaries (what needs their go-ahead), and things already tried that did not work, with why.
6. **Open questions**: anything waiting on the user or someone else.
7. **References**: plan docs, PRs, issues, artifacts, files and line numbers, by path or URL. Do not
   copy their content; point at them.
8. **Skills**: the skills the next session should load, and why.
9. **Source session**: see **Source session section** below.

Never put secrets, `.env` values, passwords or personal data in the handoff. Keep it under about 1,500
words; a longer one means it is copying content that should be referenced instead.

### Running processes

List everything this session started that is still running, so the next session reuses it instead of
starting a second copy on the same port. Use only the tools this session has; skip a source that does
not apply:

- dev servers started through the host's preview tools (in Claude Code, `preview_list`);
- commands run in the background (command, PID if known, output file);
- terminal tabs this session opened;
- simulators, emulators, test sessions and anything else this session booted or started.

Confirm each one is still alive, by port (`lsof -nP -iTCP:<port> -sTCP:LISTEN`) or PID
(`ps -p <pid>`). Drop anything that has stopped, and list the rest:

| What | How started | Port / URL | PID or id | Logs | Still needed? | How to stop |
|---|---|---|---|---|---|---|
| local API | dev server preview `backend` | 3000 | PID `...` | server logs | yes, step 2 | kill the PID on 3000 |

Write "None" when nothing is running, so the next session knows it was checked. Under the table, tell
the next session to check each process is still alive by port or PID before relying on it, and to
reuse rather than restart it. Note that processes started by this session's own tools (preview
servers, background commands) may stop when this session is closed or archived.

### Source session section

Name only this session. Never copy an earlier handoff's source section forward. Include it only when
step 1 found a session id:

```markdown
## Source session

This work was handed over by "<title>" (`<session id>`). That session still holds the full
conversation. If you need something this handoff does not cover, read its transcript first (in the
Claude desktop app: `mcp__ccd_session_mgmt__list_events` with `session_id` set to the id above, or
`mcp__ccd_session_mgmt__search_session_transcripts` for a keyword). Do not hand work back to it.
```

## 3. Report and stop

Tell the user, briefly:

- the full absolute path of `handoff.md`;
- a prompt to paste into the new session, in a code block:

  ```
  Continue the work in the handoff at <absolute path>. Read it first, then the repository rules and
  the plan docs it references, before your first edit.
  ```

- the running processes listed, one line each, or that none were running, and whether closing this
  session may stop any of them;
- that no session was started.

Then stop. Do not carry on with the handed-off work in this session unless the user asks.
