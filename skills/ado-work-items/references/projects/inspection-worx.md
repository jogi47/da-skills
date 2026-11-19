# Inspection Worx (Veridate) profile

Use this when the ticket, repository or request is Inspection Worx. Values and rules here replace the
discovery steps in `SKILL.md` for the things they state. Anything not stated here is still discovered.
This is the content of the Inspection Worx workspace's own `ado-work-items` skill, kept here so the
same rules serve every workspace.

## Fixed values

| | |
|---|---|
| Org | `--org https://tappable.visualstudio.com` (pass it on every command) |
| Project | `--project "Inspection Worx"` |
| Team | `Inspection Worx Team` |
| Ticket link | `https://tappable.visualstudio.com/Inspection%20Worx/_workitems/edit/<id>` |
| Repos | `inspection-worx-be`, `inspection-worx-fe` (Azure DevOps, so `az repos pr` applies) |

## Gotchas

- `az rest` against Azure DevOps fails ("Identity ... has not been materialized"): the AAD login is the
  Veridate tenant, not the Tappable DevOps identity. Use `az boards`, `az repos` and `az devops invoke`.
- The comments API version is `7.1-preview`; `7.1-preview.4` errors.
- Tickets may be stale: some sprints use a scope document and design images as the work items, with
  tickets only for reporting. Check memory for the current sprint's rules before planning from one.
- Ticket content is client data. Summarise it; do not paste whole descriptions into repos or plan docs.
  Drafts live in the workspace's gitignored `tmp/`.

## Images in a ticket

Screenshots pasted into a description, repro steps or comment are inline
`<img src=".../_apis/wit/attachments/<guid>?fileName=image.png">` tags, not `AttachedFile` relations,
and a description can be nothing but an image. Before summarising a ticket, search every field and
every comment for `_apis/wit/attachments/<guid>`, and check `relations` for `AttachedFile`. Download
each into its own new folder in the scratchpad and look at it with the Read tool:

```sh
az devops invoke --org https://tappable.visualstudio.com --area wit --resource attachments \
  --route-parameters project="Inspection Worx" id=<guid> --query-parameters download=true \
  --api-version 7.1 --accept-media-type application/octet-stream --out-file <scratchpad>/att-<id>/<guid>.png
```

Downloading works; uploading does not (`az devops invoke ... --in-file <image>` fails with "Unable to
decode file ... with 'utf-8' encoding"). If a question needs a screenshot, post the text and tell the
user which file to add by editing the comment. Screenshots are client data: scratchpad only, never a repo.

## Questions on tickets

The reader is Mark or Mike. Follow the tone rules in `SKILL.md`, and also:

- Wording follows `jigar-artifact-writing`: UK spelling, no em-dashes, "the mobile app" or "the web
  portal", never "the app" on its own.
- Endpoint paths are fine in a comment; repo file paths, branch names, commit SHAs, secrets and test
  credentials are not.
- Mentions: `<a href="#" data-vss-mention="version:2.0,<identity id>">@<Display Name></a>`, with the
  identity id taken from `System.CreatedBy` or `AssignedTo` on a ticket that person touched. The API
  does not say whether a notification went out, so ask the user to check one ticket after the first post.

## Marking finished work, only when asked

When a fix or PBI is built, tested and committed (not yet merged), Jigar hands it to QA like this.
"Update the tickets for <ids>" is the ask for that set; do nothing to a ticket outside it.

1. **Read first.** List each ticket's child tasks (title, state, assignee). The dev task and the QA
   task may already exist; never create a second one.
2. **Check the ticket's type first.** A **Story Bug gets no Fix or QA task**: set the Story Bug itself
   to In Review and stop. Child Tasks under one make a PBI, Story Bug, Task chain, and the sprint
   taskboard hides the ticket. The same goes for any item whose parent is a PBI or Story Bug. Only a
   Bug under a Feature, or with no parent, takes Fix and QA tasks.
3. **Parent (Bug or PBI) to In Review.** Done comes only after the merge to dev and Mark's QA. A ticket
   with a step still open outside the code still goes to In Review; that step goes on the progress page.
4. **Dev task to In Review.** If Mark already made one ("Fix" on a bug, "Implement" on a PBI, "Portal"
   or "Mobile" when the work is split), move it and assign it to Jigar if it has no assignee. If there
   is none, create a child Task titled **Fix**, assigned to Jigar (`jigar@tappable.co.uk`), in the
   current sprint, then set it to In Review.
5. **QA task.** Create a child Task titled **QA**, assigned to Mark Dickens (`mark@tappable.co.uk`), in
   the current sprint, left in **To Do**. Skip it when a QA task is already there (for example Mark's
   "QA - Retest on Dev: ...").
6. Tasks carry no description, estimate or tags. No progress comment goes on the ticket.
7. Read every touched item back and report ticket by ticket.

States in this project: Bug and PBI New, Approved, Client reviewed, Committed, In Review, Blocked, Done,
Removed (Bug also Unable to Replicate); Task To Do, In Progress, Blocked, In Review, Done, Removed.
Commands are in `../cli-recipes.md`.
