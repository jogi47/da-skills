# Clubmatch profile

Use this when the ticket, repository or request is Clubmatch (the Tappable organisation, project
Clubmatch). Values and rules here replace the discovery steps in `SKILL.md` for the things they state.
Anything not stated here is still discovered. Checked against the live project on 19 Nov 2026.

## Fixed values

| | |
|---|---|
| Org | `--org https://dev.azure.com/Tappable` (pass it on every command) |
| Project | `--project Clubmatch` |
| Team | `Clubmatch Team` |
| Current sprint | discover it; V2.3 was `Clubmatch\V2.3` in Nov 2026 |
| Ticket link | the sprint taskboard, see below |
| Code | GitHub `Clubmatch-LTD/*` repos; PRs are checked with `gh`. ADO repos also exist, so confirm which one a PR is on before using `az repos pr`. |

**Ticket links open the sprint board.** Every ticket number shown to the user is a link to the sprint
taskboard with the item open: `https://dev.azure.com/Tappable/Clubmatch/_sprints/taskboard/Clubmatch%20Team/<iteration path, backslash as slash, URL-encoded>?workitem=<id>`.
Read each item's `System.IterationPath` first; never guess the sprint. An item at the root iteration
`Clubmatch` has no sprint page, so use `https://dev.azure.com/Tappable/Clubmatch/_workitems/edit/<id>`.

## Gotchas

- `az devops invoke --resource workitems` crashes. Use `az boards query` and `az boards work-item show`.
- A flat WIQL query on `[System.Parent]` fails. Read children from `--expand relations`
  (`System.LinkTypes.Hierarchy-Forward`), and the parent from `Hierarchy-Reverse`.
- The comments API version is `7.1-preview`. `7.1-preview.4` and `7.0-preview.3` fail with "could not
  convert string to float".
- `az rest` and a bearer token from `az account get-access-token` do not work: the Azure CLI login
  is for another tenant. Use `az boards`, `az repos` and `az devops invoke`.
- `az boards query` returns only the fields named in `SELECT`.
- In the Claude sandbox, `az` calls that reach the network must run outside the sandbox.

## States seen in use

These are what existing V2.3 items carry; confirm against the ticket before writing.

- Bug: New, Committed, In Review, Blocked, Done. There is no In Progress; use Committed.
- Story Bug: New, In Review, Done.
- Infrastructure Change: Committed, In Review, Done.
- Task: To Do, In Progress, In Review, Done. There is no "Ready for QA".

## Rules

- **Read-only unless asked**, as in `SKILL.md`. Never create a ticket unless the user asks for that
  specific ticket, and preview title and description first.
- **No "done, what changed, tested" comments.** A comment is for a question that needs an answer
  (a blocked ticket or an open decision), in the humble tone `SKILL.md` describes. What changed and how
  it was tested goes on the progress page (`dev-progress-page` skill) and in the pull request.
- **Never touch pipelines** from this skill.

## Marking finished work, only when asked

"Update the tickets for <ids>" or "mark them for QA" is the ask for that set of tickets. "Status only"
or "just the state" means change the state and nothing else: create no tasks, move no other items.
Never act on a ticket outside the named set.

1. **Read first.** For each ticket read its type, state, parent and child tasks (title, state,
   assignee). A Fix task or a QA task may already exist; never create a second one.
2. **Check the type before anything else.**
   - A **Story Bug gets no Fix or QA task.** Set the Story Bug itself to In Review and stop. Child
     tasks under it would make a PBI, Story Bug, Task chain, which the sprint taskboard refuses to show.
     The same goes for any item whose parent is a PBI or Story Bug.
   - A **Bug with no parent, or under a Feature,** takes the Fix and QA tasks below.
   - Any other type (for example Infrastructure Change) is not covered. Set only the parent to In
     Review and say that tasks were not created because the type has no rule.
3. **Parent to In Review.** Done comes only after the merge to dev and QA. A merged ticket stays In
   Review. A step still open outside the code (data to fix on Dev, say) does not stop In Review; it
   goes on the progress page.
4. **Fix task.** If a Fix or Implement task already exists (assigned to Jigar), set it to the parent's
   state, In Review and not Done. If none exists, create a child Task titled **Fix**, assigned to
   Jigar, in the current sprint, and set it to In Review.
5. **QA task.** Create a child Task titled **QA**, assigned to Ryan, in the current sprint, left in
   To Do. Take Ryan's identity from an existing QA task in the sprint; if there is none, ask. Skip it
   when a QA task is already there. **Never edit, reassign or move Ryan's existing QA tasks.**
6. Tasks carry no description, estimate or tags.
7. **Read every touched item back** and report ticket by ticket what changed.

Commands are in `../cli-recipes.md`. A new task starts in To Do; for a Fix task run the state update
after linking it. Link the parent only for items that may have tasks (never for a Story Bug).
