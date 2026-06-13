---
name: git-commit
description: Commit already staged Git changes using a conventional commit message. Use when the user explicitly wants to create a commit from the current index only, without auto-staging files or including unrelated work.
---

# Git Commit

Use this skill only when the user explicitly asks to commit already staged changes.

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
- If staged changes span unrelated concerns, stop and report that separate commits are needed.
- Add a body when the diff has multiple related changes or the reason is not obvious.
- In the body, explain what changed and why; do not restate file names mechanically.

4. Commit non-interactively.
- Commit only the staged changes.
- Return the commit SHA and final subject line.

## Guardrails

- Do not stage files automatically.
- Do not amend, rebase, reset, restore, or force-push unless explicitly asked.
- Do not add generated-by or co-author trailers unless the user asked for them.
