# Host notes: T3 Code (any provider)

Exact tools and fields for the launch. The handoff content and the rules in `SKILL.md` still apply.
Inside T3, prefer T3's own tools over a provider's session tools.

## Context

- `t3_thread_list` returns `currentThreadId`; read that thread with `t3_thread_read` for its title,
  project, branch and `worktreePath`. `t3_thread_configure` without mutations reads the current model
  settings if needed.
- The new session reads this one with `t3_thread_read`. Only if an essential answer is still missing,
  and messaging the source is authorised, it may send one precise question with `t3_thread_send`; that
  can start a turn in the source. It never asks the source to resume or take the task back.

## Launch

Use `t3_thread_launch`. Never use `delegate_task`, native subagent tools or `t3_thread_transfer` (a fork
copies the context the handoff replaces).

- Use a stable `clientRequestId`. After an error or a lost response, retry with the same key so no
  duplicate thread is created.
- Omit provider, model and mode settings so they are inherited, unless the user asked for a change.
  Never switch providers silently.
- Bind the workspace before the new agent starts: `workspaceStrategy: {type: "root"}` for the project
  checkout, or `{type: "existing_worktree", worktreePath: "<verified current worktree>"}` when sharing
  the current worktree is supported and intended. Do not omit this for a worktree: the default is the
  project root.
- Never create a shell worktree or assume uncommitted edits copy to a new worktree. If the intended
  checkout cannot be bound, save the handoff and ask the user which checkout to use.
- `title`: the numbered title from `SKILL.md`.
- `message`: the full handoff, prefixed with: "Continue the work handed off from <source title/id/link>.
  Read the repository rules and referenced plans before editing. The handoff is your brief; a copy is
  saved at <absolute path>. Verify the checkout and process state before acting."
- Add `delegatedFrom` only when the source environment, thread id and title are all known. A handoff
  still launches a top-level thread.

## After launch

Read the new thread with `t3_thread_read` to confirm its title and checkout. It is already top-level, so
no detach step is needed. If the title changed, restore it with `t3_thread_update`. If the checkout is
wrong, stop its turn with `t3_thread_interrupt` and report the mismatch before it edits the wrong tree.
Do not monitor the new thread to task completion.
