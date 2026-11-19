# Azure DevOps CLI recipes

Placeholders below must come from resolved project context. Use installed command help to verify
supported arguments. Do not paste placeholder text as a real identifier. These commands assume an
already authenticated `az` CLI with its Azure DevOps extension.

## Read

```sh
az boards iteration team list --org "<org-url>" --project "<project>" --team "<team>" --timeframe current -o json
az boards work-item show --org "<org-url>" --id <id> --expand all -o json
az boards query --org "<org-url>" --project "<project>" --wiql "<verified-WIQL>" -o json
az repos pr list --org "<org-url>" --project "<project>" --repository "<repository>" --status active -o json
az repos pr show --org "<org-url>" --id <pr-id> -o json
```

Work item fields use `System.*` or project-defined `Custom.*` names. Inspect actual fields before
querying them. Use exact resolved iteration paths, not a hardcoded sprint name. `--expand` and
`--fields` may be mutually exclusive; inspect the installed CLI's help.

Comments via the WIT API:

```sh
az devops invoke --org "<org-url>" --area wit --resource comments --route-parameters project="<project>" workItemId=<id> --api-version 7.1-preview.4 -o json
```

`7.1-preview.4` is the published version, but the Tappable organisation (Clubmatch and Inspection
Worx) rejects it with "could not convert string to float"; use `7.1-preview` there, in the write below
too. Elsewhere inspect an actual version error and supported API metadata rather than assuming. Pass
`--org` and each argument as separate literal arguments (an unquoted shell variable holding several
arguments may not split in zsh). Continue with returned continuation tokens when paged.

Children of an item are read from its relations, not a flat WIQL `[System.Parent]` query:

```sh
az boards work-item show --org "<org-url>" --id <id> --expand relations -o json   # Hierarchy-Forward = children
```

For wiki content, resolve the wiki id and page id/path first, then use the installed wiki commands
or the wiki pages API. Do not assume a wiki's name equals the project name.

## Writes, only for the approved proposal

Write a JSON payload to a private temporary file using a JSON serializer, for example a comment body
with a `text` property. Never interpolate client text into shell source.

```sh
az devops invoke --org "<org-url>" --area wit --resource comments --route-parameters project="<project>" workItemId=<id> --http-method POST --in-file "<comment-json-file>" --api-version "<7.1-preview on Tappable>" -o json
az boards work-item update --org "<org-url>" --id <id> --state "<verified-state>" --assigned-to "<verified-identity>"
az boards work-item create --org "<org-url>" --project "<project>" --type "<verified-type>" --title "<approved-title>" --iteration "<verified-path>" -o json
az boards work-item relation add --org "<org-url>" --id <child-id> --relation-type parent --target-id <parent-id>
```

Undo a wrong parent link (only for a link this session created):

```sh
az boards work-item relation remove --org "<org-url>" --id <child-id> --relation-type parent --target-id <parent-id> --yes
```

Omit unrequested fields. Task creation and parent linking are separate writes; if one fails, report
partial state and inspect before retrying. Confirm attachment support and comment format before
promising inline screenshots; local CLI limitations are not universal service limitations.
