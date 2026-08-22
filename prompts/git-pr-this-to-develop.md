# Create an Auto-Merge PR to `develop`

Create a ready-for-review PR from the current branch to `develop` using GitHub CLI (`gh`).

## Requirements

1. Run `gh auth status`.
   - If it fails, retry once.
   - If the retry fails, report the exact error and stop.

2. Determine the current branch.
   - Stop and report an error if the current branch is `develop`.
   - Do not switch branches.

3. Check for an existing open PR from the current branch to `develop`.
   - If one exists, do not create a duplicate; use the existing PR.
   - Otherwise, create a new ready-for-review PR.

4. Enable auto-merge using the merge-commit strategy.
   - Merge only after all required checks and reviews pass.
   - Do not bypass branch protections.

5. Verify that `autoMergeRequest` is enabled using `gh pr view`.

## Restrictions

- Do not pull.
- Do not commit.
- Do not push.
- Do not switch branches.
- Do not create a draft PR.
- Do not start a new authentication flow.

## Output

Return the PR URL and confirm that auto-merge is enabled.