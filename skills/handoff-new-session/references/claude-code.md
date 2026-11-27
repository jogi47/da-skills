# Host notes: Claude desktop app (Code tab)

Exact tools and fields for the launch. The handoff content and the rules in `SKILL.md` still apply.
Load a deferred tool with ToolSearch before calling it.

## Context

- `mcp__ccd_session_mgmt__get_session` with `"self"`: note `cwd`, `title`, `model`, `effort`,
  `permissionMode` and any worktree or branch fields. `parentSessionId` set with `detached: true`
  means this session itself came from a handoff (this matters for the title number).
- A session that shares another session's app worktree cannot be detached to top level. When this
  session runs in an app worktree, ask the user: a new worktree cut from this branch (commit first;
  uncommitted edits stay here), or the repository's main folder from
  `mcp__ccd_session__list_start_targets`.
- Running processes: `preview_list` for preview servers, `mcp__terminal__list_terminal_tabs` for
  terminal tabs, plus background commands this session started.
- The new session can read this one's transcript with `mcp__ccd_session_mgmt__list_events`
  (`session_id`) or `mcp__ccd_session_mgmt__search_session_transcripts`, and can ask it a question
  as described under "Asking the source session" below.

## Launch

`mcp__ccd_session__start_session` with:

| Field | Value |
|---|---|
| `initiation` | `"user_asked"` |
| `context` | `"fresh"` (a fork would copy the whole conversation, which the handoff replaces) |
| `title` | the numbered title from `SKILL.md` |
| `prompt` | the full handoff text, opening with: "You are continuing work handed off from session \"<title>\" (`<sessionId>`). The handoff below is your brief; its Source session section says how to read that session's transcript and, if the transcript does not answer something, how to ask it one precise question with `SendMessage`. Read the referenced plan docs and the repository rules before your first edit. A copy is saved at `<handoff path>`." |
| `background` | two or three sentences: the overall goal and the key constraints (at least 80 characters) |
| `use_worktree` | `false` for a plain folder; otherwise as the user chose |
| `wake_when_done` | omit |

Leave `model`, `effort` and `permission_mode` unset. Set `cwd` only when the user chose the main
repository folder. The result returns the new session's id (`local_...`).

After it starts, compare its title (`get_session` on the new id) with the one you chose and restore it
with `mcp__ccd_session_mgmt__set_session_title` if the app changed it.

## Detach

`mcp__ccd_session_mgmt__detach_session` with the new id makes it a top-level thread: it no longer nests
under this session, is not archived with it, and this session is not told when its turns end. If the
detach is refused (a shared worktree, an unattended session), say so and tell the user they can
right-click the session in the sidebar and choose "Detach to top level".

## Asking the source session

Write this into the handoff's Source session section so the new session knows the route, at the
start and later in the work:

- Read the source transcript first (`list_events`, `search_session_transcripts`). Most answers are
  already there, and reading costs the source nothing.
- If an essential answer is still missing, send one precise question with `SendMessage`, `to` set
  to the source's `local_...` id (or `mcp__ccd_session_mgmt__send_message` with `session_id`). After
  a detach, "parent" no longer resolves, so always use the id. Make the first line the question
  itself, say what was already checked, and group related questions into one message.
- A question starts a turn in the source session, which costs tokens and may wait behind its
  current work. Keep working on anything the answer does not block; the reply arrives as a
  cross-session message.
- Ask only about context: what was done, decided or found. Never ask the source to resume the task,
  make edits, or run anything, and never ask it to do something this session's permissions refused.
- If the send fails, or the source is archived, cleared or does not reply, ask the user instead.

## Report

Give the new session as a link, `[<title>](#<local_id>)`. If processes were started by this session's
own tools (preview servers, background commands), add that archiving or closing this session may stop
them, so keep it open until the new session has confirmed or restarted them.
