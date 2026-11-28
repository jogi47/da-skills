# Host: Claude desktop app (Code tab)

Read with `../SKILL.md`. Where they differ, this file wins. Here a child is a Claude Code session.

## Tools

The session tools may be deferred. Load them with one `ToolSearch` call:
`select:mcp__ccd_session__start_session,mcp__ccd_session_mgmt__list_sessions,mcp__ccd_session_mgmt__list_events,mcp__ccd_session_mgmt__archive_session,SendMessage`

| Need | Tool |
|---|---|
| List this workspace's children | `list_sessions`; keep only sessions whose project folder is this workspace |
| This coordinator's own id | `$CLAUDE_CODE_HOST_SESSION_ID` (the `local_…` id), or `$CLAUDE_CODE_SESSION_ID` if that is empty |
| Which children are yours | sessions this coordinator started, as recorded in its ledger |
| Start a child | `start_session` with a full brief (settings below) |
| Follow-up to an idle child | `SendMessage` with `to` set to its `local_…` session id and only the delta |
| Read a child | `list_events`, latest few, paged |
| Archive a child | `archive_session`, only on the user's yes |

Use only visible sessions the user can open; never hidden Agent-tool subagents. Link a session in a
reply by its `local_…` id.

## Child settings

- `context: "fresh"`, with `background` of at least 80 characters, and a complete brief from
  `../briefs/desktop.md`.
- `model`: the current Sonnet id; `effort: "high"`. Change only when the user names another model or
  effort for that task.
- `permission_mode`: omit, so the child inherits yours. Never pass a higher one.

## Ledger

`tmp/coordinator/desktop-<id>.md`, with the id from the environment as above. It survives compaction
because it comes from the environment. Cleanup touches only other `desktop-*` files; `t3-*` files belong
to coordinators in T3 Code.

## Worktrees

- `use_worktree` branches the repo the session starts in. If the workspace folder is its own git repo
  with the product repos nested inside, never pass `use_worktree: true` from the workspace folder.
- `start_session` accepts `cwd` only when the user named that repo or folder in their own words for
  this task. When they did, a writing child may start with `cwd` set to the product repo, and then in
  its own worktree there if parallel writers need it.
- When they did not, the default is the product repo's main checkout, reached from the workspace
  folder (`use_worktree` omitted), with one writer at a time per repo. If two writers on one repo are
  needed at once, ask the user to name the repo so `cwd` can be used.

## Pull requests

A PR you opened needs nothing further from the host; report its link and state as `../SKILL.md`
section 9 says.
