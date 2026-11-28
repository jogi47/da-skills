---
name: git-commit-on-new-branch
description: Create a new branch from the current base branch and commit only already-staged changes. Use when the user explicitly asks to branch and commit the existing index without staging other files or pushing.
---

# Commit staged changes on a new branch

Create a branch and commit the existing index. Preserve unstaged and untracked work.

## Workflow

1. Resolve the base branch from the user's request or an explicit repository default. If neither
   supplies it, ask. Never assume a branch such as `dev` exists or is the intended base.
2. Read repository instructions, `git status --short --branch` and `git branch --show-current`.
   The current branch must equal the resolved base. If it differs, or HEAD is detached, report it
   and stop; do not switch to the base branch.
3. Inspect `git diff --cached`. If nothing is staged, stop. Derive the branch name and commit message
   from the staged changes only. If the staged content contains secrets or sensitive data, report
   affected paths without exposing values and stop.
4. Choose a concise kebab-case branch name following repository conventions, without an agent-specific
   prefix. Check that the name is valid and unused. Create it from the current HEAD with
   `git switch -c <new-branch>`; do not fetch, pull or move the base.
5. Write a Conventional Commit message to a temporary file outside the repository, following local
   commit rules. Validate it with repository-provided commitlint when available. Run
   `git commit -F <message-file>` with hooks enabled. Do not stage, unstage or amend anything.
6. If branch creation or commit hooks fail, report the exact error and resulting branch/index state.
   Stop without resetting, stashing, discarding changes, bypassing hooks or retrying with a wider scope.
7. Report the base branch and how it was selected, new branch, commit SHA and subject, remaining
   unstaged/untracked changes, and that nothing was pushed.

This workflow does not authorise pushing, creating a PR, authentication changes or a cleanup of
unrelated work. Do not add agent attribution or co-author trailers unless requested.
