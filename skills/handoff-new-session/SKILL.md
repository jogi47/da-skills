---
name: handoff-new-session
description: Write a handoff document and start a fresh top-level session in the same project using available session-management tools. Use only when the user explicitly asks to hand work to a new session or thread.
---

# Handoff to a new session

Create a fresh top-level session, seeded with a self-contained handoff. Do not create a subagent.
Invocation authorises this handoff and launch, not additional Git, deployment or database actions.
Preserve the user's existing constraints and approval boundaries.

## Establish context

Discover the host's available session-management tools. Read current session metadata when supported:
project directory, title, id or link, branch/worktree, model and effort settings. Do not invent ids.

A plain project folder can be shared. If the current session uses a worktree, follow the host's
workspace rules. If a new top-level session cannot share it, ask whether to use the main checkout or
an isolated workspace. Do not commit changes or create shell worktrees to work around that limitation.

## Write the handoff

Save `handoff.md` in a new temporary directory using the platform's temporary-directory facility.
Keep it under about 1,500 words. Include:

1. Goal, adjusted to any focus the user supplied.
2. Completed, partial and remaining work. For every touched repository, read its current branch,
   commit SHA and working-tree status. Describe these as observed state, not checkout instructions.
3. Running processes this session started: command, PID or tool id, port/URL, logs, whether needed
   and how to stop. Verify known processes by PID or listening port; write "None" if none remain.
4. Ordered, concrete next steps.
5. User decisions, constraints and failed approaches with reasons.
6. Open questions.
7. Paths and links to plans, issues, PRs, artifacts and relevant code; reference rather than copy.
8. Skills to load and why.
9. This source session's id/link, if available, and how the new session can read its transcript with
   the host's tools. Never carry an older handoff's source forward as the current source.

Do not include secrets, environment values or personal member data.

For running processes, tell the new session to verify and reuse them before starting another on the
same port. Note which tool-managed processes may stop when this session closes. Transfer responsibility
only after the launch succeeds; do not stop or reconfigure them after handoff without coordination.

## Launch through the available host

Use the host's top-level launch tool, with fresh context and the full handoff text or an accessible
handoff file as the initial prompt. Include the absolute handoff path and tell the next session to
read repository guidance and referenced plans before editing. Leave model, effort and permissions
unset to inherit defaults unless the user requested otherwise.

Read the available tool schemas before launching. Select the project directory and workspace
strategy according to the user's choice and the host's supported capabilities. If the new session
starts nested, use an available detach operation and verify that it becomes top-level. Report a
refused or unsupported detach accurately.

If no top-level session API is available, deliver the handoff file and a short prompt the user can
paste into a new session. State that no session was launched. Never substitute a child agent for
the requested top-level session.

Preserve the source title with an appended ` 2`. Increment a trailing handoff number only if metadata
confirms that this session itself came from a handoff; ordinary numbers in a title are part of its name.
Respect the host's title length limit. Verify launch results before claiming success.

## Report and stop

Return the new session link, top-level/detach state, absolute handoff path and running processes
transferred. If launch failed, keep the handoff file and report the error. Do not retry by creating
multiple sessions when the result is ambiguous; inspect available session state first.

After a successful launch, stop work here. Answer later source-context questions briefly without
retaking the task.
