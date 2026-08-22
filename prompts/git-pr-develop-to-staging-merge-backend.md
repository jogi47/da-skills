# Create and Merge Develop-to-Staging Pull Request

Create and merge a GitHub pull request from `develop` into `staging` for the current repository.

## Requirements

1. Always use the GitHub account `jigar-LY`. Switch to it if another account is active, and leave `jigar-LY` active afterward.
2. Check whether an open `develop` → `staging` pull request already exists.
3. If none exists, create one titled `Develop`.
4. Merge it using a merge commit.
5. Do not wait for the `docker build validate` check. Use an admin override if required.
6. Do not delete either branch.
7. Confirm completion with the pull request URL and merge result.