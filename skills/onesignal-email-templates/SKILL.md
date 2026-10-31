---
name: onesignal-email-templates
description: Read, back up, edit and update OneSignal email templates with a dry-run diff, live-change checks and rollback backups. Use when the user asks to inspect or change template HTML, resolve template references, or restore a prior template body. Discover project configuration and environment sharing instead of assuming a particular application.
---

# OneSignal email templates

Use the bundled Node.js helper for the OneSignal templates API. Resolve commands relative to this
skill's installed directory; Node 21.7+ and the system `diff` command are required. No npm packages.
Connected template tools are also acceptable when they provide equivalent backup, preview and
verification behaviour.

## Configuration and scope

Identify the project's OneSignal app, configuration file, template references and output directory
from the user or repository guidance. The helper reads an explicit `--env-file` internally; never
print its contents or put credentials in command arguments, chat or commits.

Default key names are `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY` and any `*_TEMPLATE_ID` entries. Use
`--app-id-key <key-name>` and `--api-key-key <key-name>` for projects with different names. These flags
hold key names, not credential values. Authentication defaults to `Key`; an explicitly required legacy
setup can use `--auth-scheme Basic`. Do not guess credentials or retry with other accounts.

`--env` is a configuration label, not an isolation boundary. Determine whether environments share
apps or template ids before proposing changes. Any applied update changes a live remote template;
the script requires both `--apply` and `--allow-live`, regardless of the label.

Use a private `--out` directory outside source control. The default is `tmp/onesignal/<label>/`
under the invoking directory, independent of the skill's installation path. Verify it is ignored if
inside a repository. Backups can include template content and sender settings; do not publish them.

## Read, edit, preview

```sh
node scripts/os-templates.mjs list --env <label> --env-file <config-path> --out <private-output>
node scripts/os-templates.mjs pull RECEIPT_TEMPLATE_ID --env <label> --env-file <config-path> --out <private-output>
node scripts/os-templates.mjs push RECEIPT_TEMPLATE_ID --env <label> --env-file <config-path> --out <private-output>
```

References can be a `*_TEMPLATE_ID` config key, a template UUID, or `name:<exact template name>`.
Use the same config/key/auth/output arguments across pull, preview and apply.

- `list` maps templates to configured key names while masking ids in output.
- `pull` backs up the full remote JSON and writes editable `.html`, `.orig.html` and metadata files.
  It refuses to overwrite a working copy with unpushed edits. Keep the original snapshot unchanged.
- Edit the pulled HTML only. Preserve the project's Liquid variables, branding and conditional blocks.
  The helper checks matching block-tag counts, not full Liquid syntax or rendering. Inspect and render
  meaningful cases with project tooling, especially missing and populated dynamic data.
- `push` without `--apply` checks for live-body drift and prints a unified diff. It makes no remote
  write. If the source template changed, retain your local edits, pull a fresh copy into another private
  directory and reconcile before previewing again.

If a template belongs to a visual editor, establish whether HTML updates preserve editability before
continuing. Do not overwrite it with a source-controlled reference copy that may be stale.

## Apply and verify

Show the exact diff, affected template names and verified environment sharing. An edit or dry-run
request does not authorise applying it. Apply only the named proposal when the user explicitly asks
to make it live; reuse approval already given for that proposal.

Run the same push command with `--apply --allow-live`. The helper backs up the live JSON, preserves
known email settings, re-reads the result and checks the body and those settings. It does not send a
notification or modify backend template mappings. A successful API update does not prove dynamic
email rendering; report any rendering or integration checks still pending. Test sends need their own
authorised recipient/data scope.

For rollback, copy the desired `email_body` from a backup into a working HTML file based on a fresh
pull, then preview and apply through the same process. This restores the body only; restoration of
other settings needs a separate proposal. If an update result is uncertain, read back before retrying.

Run local mocked checks with `node --test tests/*.test.mjs`; they never contact OneSignal.
Official references: [view template](https://documentation.onesignal.com/reference/view-template),
[update template](https://documentation.onesignal.com/reference/update-template).
