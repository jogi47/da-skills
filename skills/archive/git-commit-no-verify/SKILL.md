---
name: git-commit-no-verify
description: Commit already staged Git changes with `--no-verify` using a conventional commit message. Use when the user explicitly wants to skip commit hooks but still commit only the current index without auto-staging files.
---

# Git Commit No Verify

Use this skill only when the user explicitly asks to skip commit hooks.

## Workflow

1. Verify staged changes exist.
- Run `git diff --cached --name-only`.
- If nothing is staged, stop and report that no staged changes are available to commit.

2. Review the staged diff.
- Inspect staged changes only.
- Ignore unstaged and untracked files unless the user asks for them.

3. Draft the commit message.
- Use `type(scope): description`.
- Allowed types: `feat`, `fix`, `test`, `refactor`, `docs`, `style`, `chore`, `perf`, `ci`, `build`, `revert`.
- Keep type, scope, and subject lowercase.
- Use imperative mood.
- Keep the subject line at 72 characters or fewer.
- Do not end the subject with a period.
- Keep optional body lines at 100 characters or fewer.
- Keep optional footer lines at 100 characters or fewer.
- Prefer a specific subject that names the behavior or module changed.
- Avoid vague subjects like `update files`, `make changes`, `misc`, or `wip`.
- If staged changes span unrelated concerns, do not block the commit. Use a broader but accurate subject, or add a body that names the separate concerns.
- Add a body when the diff has multiple related changes or the reason is not obvious.
- In the body, explain what changed and why; do not restate file names mechanically.

4. Commit non-interactively.
- Commit only the staged changes.
- Use `git commit --no-verify`.
- Return the commit SHA and final subject line.

## Guardrails

- Do not stage files automatically.
- Do not use `--no-verify` unless the user explicitly asked for it.
- Do not amend, rebase, reset, restore, or force-push unless explicitly asked.
