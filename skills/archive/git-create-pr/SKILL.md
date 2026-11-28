---
name: git-create-pr
description: Prepare and create a GitHub or Azure DevOps pull request from the current branch or an explicitly named remote source branch into a destination branch. Use when the user asks to raise a PR, including between long-lived branches, without staging, committing, pushing, merging or changing the working tree.
---

# Create a pull request

Prepare a reviewable PR from existing remote commits. Support two modes:

- **Current branch:** use the checked-out branch as source; reject detached HEAD.
- **Explicit source:** use the named remote source, even when another branch is checked out.
  If the request calls for a named source but omits it, ask rather than defaulting to the current branch.

Resolve the destination from the user or an explicit repository default; ask if neither supplies one.
Never default to `main`, `master` or `production` without explicit user direction. Do not infer a
production target from the remote's default branch.

## Inspect state

1. Read repository guidance and PR templates. Work from the repository root.
2. Inspect `git remote get-url origin` and resolve its actual host. Support GitHub (`gh`) and Azure
   DevOps (`az`), including SSH aliases whose resolved host can be verified. If the host is unclear,
   report that and ask. Do not invent an organisation, project or repository.
3. Confirm both branches exist with `git ls-remote --heads origin refs/heads/<source> refs/heads/<destination>`.
   Stop if missing or identical. In current-branch mode, stop on a dirty working tree, a missing remote
   source, or local source commits absent from the remote. In explicit-source mode, apply those same
   checks if the source is currently checked out; otherwise leave the unrelated working tree alone.
4. Verify local `origin/<branch>` refs against the remote SHAs before using them.
   Current-branch mode performs no fetch; if refs are missing or stale, report it and stop.
   Explicit-source mode may refresh only the two named remote-tracking refs using explicit refspecs
   (`refs/heads/<branch>:refs/remotes/origin/<branch>`). Never pull, checkout, merge or update local branches.
   If refs cannot be refreshed normally, stop rather than forcing an update.
5. Look for an open PR for the same source/destination in the same repository. Return its URL instead
   of creating a duplicate. In current-branch mode, also report an existing source-branch PR targeting
   a different destination and resolve the ambiguity before creating another.
6. Read commits and the actual three-dot diff from `origin/<destination>` to `origin/<source>`.
   Count source-only commits (total and non-merge) and destination-only commits. Stop if the source
   contains nothing the destination lacks. Record the full head and base SHAs.
7. In explicit-source mode, check merge conflicts with
   `git merge-tree --write-tree --name-only origin/<destination> origin/<source>` when supported.
   Exit 0 means clean; exit 1 means conflicts. Report conflicts without fixing them. Other errors mean
   the check failed, not that it was clean. If unavailable, mark conflicts unchecked.

Use available host tools or [host-commands.md](references/host-commands.md) for PR queries and creation.
Check installed command help when needed. If authentication fails, report it; do not start login or
switch accounts without the user's instruction.

## Prepare the title and description

For an explicit branch-to-branch sync, inspect the most recent merged PR between the same branches
and reuse its title format and section structure when appropriate. Otherwise follow the repository's
PR template and commit/title conventions. Derive the content from the real commits and diff, never
from branch names alone. Conventional titles should be imperative, at most 72 characters and have no
trailing full stop unless repository rules differ.

Include the problem and resulting behaviour, why it changed, tests actually run and their results
(or `Not run`), material risks, and relevant plan/spec links. Explicit-source PRs also include commit
counts, changed files and the conflict-check result. Call out response-shape changes, removed fields,
new unauthenticated routes and dependency changes when present in the diff.

Write the exact description to a temporary file outside the repository. Pass it as a file or a
structured argument to preserve Markdown. For the Azure CLI workflow, keep it within 4,000 characters;
shorten detail while retaining required sections, test results, conflict status and risks.

## Preview, create and report

Show the source, destination, host, title, full description, relevant counts/conflict status and exact
creation command or structured request. Obtain approval for that concrete proposal before creating
unless the user already explicitly authorised creation without another confirmation. Do all read-only
preparation first. Do not ask again for an approval already given to the same proposal.

After approval, verify that the branch SHAs still match the reviewed proposal. If they changed, refresh
the diff and proposal rather than publishing a stale description. Create a regular PR unless a draft
was requested. Report its id and web URL. Follow any host-required PR registration/linking workflow.
If the creation result is ambiguous, query existing PRs before retrying to avoid duplicates.

Do not stage, commit, amend, push, create/switch branches, stash, discard work, merge, enable auto-merge,
or trigger/queue/cancel/retry CI. Record a limitation instead of changing scope to complete creation.
