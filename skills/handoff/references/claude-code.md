# Host note: Claude Code (desktop app Code tab, or CLI)

How the session writing the handoff finds its own facts in Claude Code, and the host lines it writes
into the handoff's Source session section. The rules in `SKILL.md` still apply. Load a deferred tool
with ToolSearch before calling it.

## Recognise the host

- `mcp__ccd_session_mgmt__*` or `mcp__ccd_session__*` tools are present (loaded or deferred): the
  Claude desktop app, Code tab.
- None of those, but this is Claude Code (Claude Code tools such as `ToolSearch` and `SendMessage`):
  the Claude Code CLI or an IDE extension.

## Find the facts

- **Session id and title (desktop app only):** `mcp__ccd_session_mgmt__get_session` with `"self"`
  returns `sessionId` (`local_...`) and `title`. The CLI has no equivalent; record no id there.
- **Transcript file:** `~/.claude/projects/<project folder with / and . replaced by ->/<uuid>.jsonl`.
  The uuid is not the desktop app's `local_...` id. Find the file by searching that folder for a phrase
  unique to this conversation (`grep -l '<phrase>' <folder>/*.jsonl`) and confirm exactly one file
  matches. Record its absolute path.

## Lines for the Source session section

Write `Host: Claude Code (desktop app)` or `Host: Claude Code (CLI)`, then these routes (drop any whose
value was not found):

- **Read it, any agent:** the transcript file above. It is Claude Code's JSONL format: one event per
  line, with user and assistant messages under `message.content`.
- **Read it, a Claude desktop session:** `mcp__ccd_session_mgmt__list_events` with `session_id` set to
  the `local_...` id, or `mcp__ccd_session_mgmt__search_session_transcripts` for a keyword.
- **Ask it, a Claude Code session on the same machine:** `SendMessage` with `to` set to the `local_...`
  id (desktop source only). A CLI source has no address; ask through the user.
- **Ask it, any other agent:** put the question to the user, who can paste it into the source session.
