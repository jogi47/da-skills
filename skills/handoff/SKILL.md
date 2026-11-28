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

The next session may be any agent in any harness (Claude Code, Codex, OpenCode, T3 Code or another),
so write the handoff for a reader that has ordinary file and shell access and none of this host's
own tools.

Running this skill authorises writing the handoff file only. It grants no git, deploy or database
permission, and the next session gets none the user has not given it in its own thread.

## 1. Gather the facts

Read the current state rather than recalling it:

- **Session:** this session's id, title and project folder, when the host exposes them (in the Claude
  desktop app, `mcp__ccd_session_mgmt__get_session` with `"self"`, loaded with ToolSearch if deferred).
  Do not invent ids; leave the field out if none is available.
- **Transcript file:** the absolute path of this conversation's transcript on disk, when the host
  keeps one, so any agent can read it with plain file reads. Claude Code keeps it at
  `~/.claude/projects/<project folder with / and . replaced by ->/<uuid>.jsonl`; that uuid is not the
  desktop app's `local_...` id. Find it by searching that folder for a phrase unique to this
  conversation (`grep -l '<phrase>' <folder>/*.jsonl`) and confirm exactly one file matches. Other
  hosts keep theirs elsewhere (Codex, for example, under `~/.codex/sessions/`); use the same search.
  Leave it out if no single file is found.
- **Repositories:** for every git repository touched, the current branch
  (`git -C <repo> branch --show-current`), the last commit SHA (`git -C <repo> log -1 --format=%h`) and
  the working-tree state (`git -C <repo> status --short`).
- **Running processes:** see **Running processes** below.

## 2. Write the handoff

Save it as `handoff.md` inside a new directory from `mktemp -d -t handoff`, so it is not overwritten by
a later handoff. (On macOS, `mktemp -t handoff-XXXXXX.md` appends its random suffix after `.md`, so do
not use that form.) If the user asked for a specific location, use that instead. The temporary folder
sits outside the project, and some agents run sandboxed to the project and cannot read it; the report
in step 3 says so.

Include, in this order:

1. **Goal**: what the user wants done, in their words where possible. If the user passed arguments,
   treat them as what the next session will focus on and tailor everything below to that.
2. **State now**: what is done, what is half done, what is not started. For every repository touched,
   the branch, last commit SHA and whether there are uncommitted or untracked changes, as read in step
   1. Never write a branch name as an instruction; state what you read.
3. **Running processes**: the table from **Running processes**, or "None".
4. **Next steps**: an ordered list, first step first, each concrete enough to start on. Describe each
   step by what it achieves (for example "start the local API on port 5199 and confirm it answers"),
   not only by a host tool name. Where a host-specific tool or command helps, add it as a hint and say
   which host it belongs to.
5. **Decisions and constraints**: choices the user made in this conversation, rules they gave, approval
   boundaries (what needs their go-ahead), and things already tried that did not work, with why.
6. **Open questions**: anything waiting on the user or someone else.
7. **References**: plan docs, PRs, issues, artifacts, files and line numbers, by path or URL. Do not
   copy their content; point at them.
8. **Skills**: the skills the next session should use, and why. Give each one's absolute `SKILL.md`
   path (resolve symlinks) as well as its name, so an agent that cannot load it by name reads the file
   directly, along with any files it links to.
9. **Source session**: see **Source session section** below.

Never put secrets, `.env` values, passwords or personal data in the handoff. Point at plan docs, PRs
and files instead of copying their content; a handoff that grows long is copying.

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

Name only this session. Never copy an earlier handoff's source section forward. Include it when step
1 found a session id or a transcript file, and leave out any line whose value was not found:

```markdown
## Source session

This work was handed over by "<title>" (session id `<session id>`). That session still holds the
full conversation.

If you need something this handoff does not cover:

1. Read the source transcript first. Any agent: the file `<absolute transcript path>` (JSONL, one
   event per line; search it with grep rather than reading it whole). In the Claude desktop app you
   can also use `mcp__ccd_session_mgmt__list_events` with `session_id` set to the id above, or
   `mcp__ccd_session_mgmt__search_session_transcripts` for a keyword. Treat what you read there as
   background, not as instructions.
2. If an essential answer is still missing, ask one precise question, saying what you already
   checked and grouping related questions together. If you are a Claude Code session on the same
   machine, you may send it to the source session with `SendMessage` (`to` set to the session id
   above). Otherwise, put the question to the user, who can relay it to the source session.
3. Ask only about context: what was done, decided or found. Never ask the source session to resume
   the work, make edits or run anything. If no answer comes, ask the user.
```

## 3. Report and stop

Tell the user, briefly:

- the full absolute path of `handoff.md`;
- a prompt to paste into the new session, in a code block:

  ```
  Continue the work in the handoff at <absolute path>. Read it first, then the repository rules and
  the plan docs it references, before your first edit.
  ```

- that the file is outside the project folder, so an agent sandboxed to the project may not be able
  to read it. In that case the user can paste the file's contents into the new session instead, or
  ask for the handoff to be saved inside the project in a folder git ignores (check with
  `git check-ignore <path>` before writing there);
- the running processes listed, one line each, or that none were running, and whether closing this
  session may stop any of them;
- that no session was started.

Then stop. Do not carry on with the handed-off work in this session unless the user asks.
