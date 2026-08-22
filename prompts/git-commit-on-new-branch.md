# Create a Branch and Commit Staged Changes

Create a new branch from the local `develop` branch and commit only the changes that are already staged. Preserve all unstaged and untracked changes without staging or committing them. Do not push.

## Requirements

1. Inspect the repository using `git status`.
   - Confirm the current branch is exactly `develop`.
   - If it is not `develop`, report the current branch and stop.
   - Do not switch to `develop`.

2. Inspect the staged changes using `git diff --cached`.
   - If nothing is staged, report this and stop.
   - Derive the branch name and commit message only from the staged changes.
   - Check the staged content for credentials, secrets, environment files, or sensitive data. If found, report it and stop.

3. Create and switch to a relevant branch.
   - Use a concise kebab-case name prefixed with `codex/`.
   - Example: `codex/add-student-search`.
   - Ensure the branch does not already exist.
   - Preserve the existing index and working directory when creating the branch.

4. Commit only the already-staged changes.
   - Do not run `git add`, `git restore --staged`, or otherwise modify the staging area.
   - Use a relevant Conventional Commit message such as `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, or `chore:`.
   - Do not use `--no-verify`.
   - If the commit or its hooks fail, report the exact error and stop.

5. Report:
   - New branch name.
   - Commit hash and message.
   - Remaining unstaged and untracked changes.
   - Confirmation that nothing was pushed.

## Restrictions

- Do not stage unstaged or untracked files.
- Do not pull or fetch.
- Do not push.
- Do not create a PR.
- Do not amend an existing commit.
- Do not bypass commit hooks.
- Do not stash, reset, discard, or overwrite changes.
- Do not start an authentication flow.