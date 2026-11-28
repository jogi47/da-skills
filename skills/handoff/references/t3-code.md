# Host note: T3 Code (any provider)

How the session writing the handoff finds its own facts in T3 Code, and the host lines it writes into
the handoff's Source session section. The rules in `SKILL.md` still apply. Inside T3, prefer T3's own
tools over a provider's session tools.

## Recognise the host

`t3_thread_*` tools are present (for example `t3_thread_list`, `t3_thread_read`). Note the provider
this thread runs on (Claude, Codex or another), since it decides whether a transcript file exists.

## Find the facts

- **Thread id and title:** `t3_thread_list` returns `currentThreadId`; read that thread with
  `t3_thread_read` for its title, project and `worktreePath`.
- **Transcript file:** T3 keeps the thread in its own store, which only T3 tools read. The provider
  may also write its own transcript file (Claude Code under `~/.claude/projects/`, Codex under
  `~/.codex/sessions/`). Search the provider's folder for a phrase unique to this conversation
  (`grep -rl '<phrase>' <folder>`) and record the path only if exactly one file matches.

## Lines for the Source session section

Write `Host: T3 Code (<provider>)`, then these routes (drop any whose value was not found):

- **Read it, any agent:** the provider's transcript file, if one was found, with its format (Claude
  Code JSONL or Codex JSONL).
- **Read it, a T3 thread:** `t3_thread_read` with the thread id above.
- **Ask it, a T3 thread:** one precise question with `t3_thread_send` to the thread id. This starts a
  turn in the source thread.
- **Ask it, any other agent:** put the question to the user, who can paste it into the source thread.
