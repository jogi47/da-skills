# Host commands

Templates use `<source>`, `<destination>`, `<title>` and `<description-file>` as placeholders.
Resolve each from verified repository state; pass values as quoted arguments or structured parameters.

## GitHub

Find an open PR for the exact branch pair:

```sh
gh pr list --head "<source>" --base "<destination>" --state open --json url,number
```

For current-branch mode, omit `--base` in a separate query to detect source PRs with another target.
For previous title/description conventions:

```sh
gh pr list --head "<source>" --base "<destination>" --state merged --limit 1 --json number,title,body
```

Create after the proposal is approved:

```sh
gh pr create --base "<destination>" --head "<source>" --title "<title>" --body-file "<description-file>"
```

Add `--draft` only when requested. Never merge or enable auto-merge.

## Azure DevOps

Resolve organisation, project and repository from the remote or verified CLI configuration. Ensure
all queries and creation target that repository; pass explicit resolved identifiers if auto-detection
is ambiguous. Never hardcode another project's identifiers.

```sh
az repos pr list --source-branch "<source>" --target-branch "<destination>" --status active --output json
az repos pr list --source-branch "<source>" --target-branch "<destination>" --status completed --top 1 --output json
```

For current-branch mode, also query the source without a target filter. Verify the most recent
completed result was merged before borrowing its conventions.

Create after the proposal is approved:

```sh
az repos pr create --source-branch "<source>" --target-branch "<destination>" --title "<title>" --description "$(cat "<description-file>")" --draft false --output json
```

Use a real, quoted temporary-file path in command substitution; do not interpolate description text
into shell source. Set `--draft true` only when requested. Do not enable auto-complete. Return the web
PR URL, constructing it from the verified host/repository and returned id if necessary, not an API URL.
