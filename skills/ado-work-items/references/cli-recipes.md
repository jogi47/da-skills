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

This version comes from the published comments API. A server/extension may expose another compatible
version; inspect an actual version error and supported API metadata rather than assuming a past
project's workaround applies everywhere. Continue with returned continuation tokens when paged.

For wiki content, resolve the wiki id and page id/path first, then use the installed wiki commands
or the wiki pages API. Do not assume a wiki's name equals the project name.

## Writes, only for the approved proposal

Write a JSON payload to a private temporary file using a JSON serializer, for example a comment body
with a `text` property. Never interpolate client text into shell source.

```sh
az devops invoke --org "<org-url>" --area wit --resource comments --route-parameters project="<project>" workItemId=<id> --http-method POST --in-file "<comment-json-file>" --api-version 7.1-preview.4 -o json
az boards work-item update --org "<org-url>" --id <id> --state "<verified-state>" --assigned-to "<verified-identity>"
az boards work-item create --org "<org-url>" --project "<project>" --type "<verified-type>" --title "<approved-title>" --iteration "<verified-path>" -o json
az boards work-item relation add --org "<org-url>" --id <child-id> --relation-type parent --target-id <parent-id>
```

Omit unrequested fields. Task creation and parent linking are separate writes; if one fails, report
partial state and inspect before retrying. Confirm attachment support and comment format before
promising inline screenshots; local CLI limitations are not universal service limitations.
