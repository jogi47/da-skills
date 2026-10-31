---
name: dev-progress-page
description: Build and keep a development progress page as a standalone HTML page or published document, one closed panel per ticket (what changed, how to test with Passed/Partly tested/Not tested/Failed per case, screenshots with a full-screen viewer, ticket links), in Jigar's uncluttered layout - title only, a strip with one square per ticket, sections that fold to a one-line count, and all deploy history in a closed footer. render.py builds the page or a single panel from JSON and lists every panel's status chips for the check after a merge. Use when starting a sprint or release progress page, adding a finished ticket to one, restyling a cluttered one, or re-checking its statuses after a merge, deploy or build.
---

# Development progress page

A progress page tells the team, QA and the client contact what each ticket now does, how to test it and
where it is (built, merged, on Dev, waiting). Use the target project's tickets, environments and build names.

Every word on the page follows the `jigar-artifact-writing` skill. Load it before writing text, and run
its checker before every publish.

## The layout, and why

Readers open the page to find one ticket. Everything else stays folded until they ask for it.

| Part | What it holds | What it never holds |
|---|---|---|
| Header | An eyebrow (`Sprint 16 · 1.5.2 · 22 October to 4 November 2026`) and the title | Intro paragraphs, merge history, instructions |
| Strip | One square per ticket in section order, with the done count; a tooltip names the ticket | Prose |
| Sections | A folding heading per group ("Sprint 16 scope", "Bugs", "Carried over from Sprint 15", "Fixes from the 28 October defect sweep", "Open questions on finished work", "Waiting on an answer"), each with a one-line count such as "6 fixed and tested, on the sprint branch, not merged yet" | Long explanations: one short intro paragraph at most |
| Panels | One per ticket, closed: label, title and status chips on the outside; What changed, How to test (itself closed), screenshots and ticket links inside | Other tickets' news |
| Footer | One closed "About this page and earlier deploys": how to read the page, then the PR, deploy and build history, newest last | Anything a reader needs to find a ticket |

No Expand all or Collapse all buttons. A strip square or an in-page link opens its panel and scrolls to
it; printing opens every panel.

Order the sections by what QA tests next, and the panels inside a section by feature code (F2, F3,
F3b, F4 ... S2, S3) or by ticket number. Put tasks and story bugs straight after their parent.

## Panel content

- **Label** (`item-no`): `<ticket> · <feature code> · <web portal | mobile app | backend, ...> · <PBI | Bug | Task under N | Story bug under N>`.
- **Title**: what is now true, in plain words ("Minimum life on dispatch is locked while a run is live"), not the ticket's title.
- **Chips**, in this order:
  1. what was done: `Built and tested`, `Fixed and tested`, `Code fixed and tested`;
  2. where it is: `On the sprint branch, not merged yet`, `On Dev, ready for QA`, `In Android build 1.5.2 (28888), ready for QA`, `On Dev and in Android build ...`;
  3. what is left, as a `warn` chip: `Camera read needs a real phone`, `Excel on Windows needs QA`, `Stage and Prod to be checked before merging`.
- **What changed**: what was wrong (or asked), what it does now, what did not change, then one line of
  tests and suite totals. Name the web portal or the mobile app every time.
- **How to test**: numbered cases (`1.1`, `1.2` ...), each a step and an "Expect ..." line, with a status
  (`pass`, `partly`, `not`, `fail`) and how it was checked: "Browser", "Emulator", "API against a local
  backend", "Unit test", or why it was not ("Needs a real phone", "Not merged yet"). The last case is
  "Repeat on Dev", Not tested until it has been.
- **Screenshots**: `wide` for web portal shots, `phone` for mobile app shots, `strip` for one control.
  Each has a caption naming the ticket and what it proves (`26590 · Mobile app after the fix: the same
  day reads "Today"`), an alt text, and a two-to-four-word label. Show before and after when the change is
  visual. Look at every screenshot before it goes on the page.
- **Tickets**: the ticket, its parent, and any task merged into it.

A ticket with nothing to show on screen (an API refusal, a CSV column) can carry a short extra block
instead of screenshots, such as "The end of the CSV" with the header and one row in `<code>`.

## Building a page

Resolve commands relative to this skill directory, wherever installed. Install the sibling
`jigar-artifact-writing` skill too. `render.py` needs only Python 3. Text fields are HTML fragments: `<code>`, `<b>` and `<a>` are allowed,
and a literal `&`, `<` or `>` is written `&amp;`, `&lt;` or `&gt;`.

```bash
python3 render.py page.json > page.html
```

`examples/page.example.json` shows every field. The page JSON:

| Field | Meaning |
|---|---|
| `title`, `eyebrow` | The header |
| `ticket_url` | Ticket link with `{no}`, e.g. `https://dev.azure.com/acme/Acme/_workitems/edit/{no}` |
| `strip_heading` | Above the strip; default "Tickets" |
| `strip_count` | Optional; otherwise "X of Y done · Z waiting on a decision" from the items' states |
| `sections[]` | `id`, `title`, `count`, optional `intro[]`, `items[]`, optional `strip_only[]` (`no`, `title`, `state`) for a strip square with no panel, linked to its ticket |
| `items[]` | `id`, `label`, `title`, optional `strip_title`, `state` (`done`, `part`, `wait`, `todo`), `chips[]` (`text`, `kind`: `pass`, `warn`, `plain`), `changed[]`, optional `extra_html`, `cases[]` (`step`, `expect`, `status`, `how`), optional `case_prefix`, `shots` (`layout`, `items[]`: `file`, `caption`, `alt`, `label`), `tickets[]` (`no`, `title`) |
| `about.paragraphs[]` | The closed footer |

Keep the JSON beside the page (for example `tmp/sprint-17-progress.json`) and the screenshots in their
own folder (`tmp/sprint-17-shots/`). Save screenshots straight into that folder: a scratchpad can be
wiped mid-session.

## Adding a ticket to an existing page

Pages built by hand before this skill (Sprint 15 and 16) have no JSON. Render the one panel and paste it
under its section, then add its strip square and update the section's count and the strip count:

```bash
python3 render.py --panel item.json
```

`item.json` is one entry of `items[]` plus `ticket_url`.

## After every merge, deploy or build

A stale "not merged yet" tells QA not to test something already on Dev. After any merge, deploy or new
mobile build, list every panel's chips and check each one against the repos and the pipelines, not only
the panels you touched:

```bash
python3 render.py --chips page.html
```

Check the target project's deployment branch, CD stages and latest mobile distribution run;
for example, `git log origin/dev --merges` when `dev` is its deployment branch. Fix every stale chip, the strip tooltips, the section counts and the footer history in
the same publish. Change "Repeat on Dev" from "Not merged yet" to "On Dev since <date>; retest still to do"
once it is deployed.

## Publishing

1. Load `jigar-artifact-writing`, then run its checker and fix every HARD finding:
   `python3 ../jigar-artifact-writing/scripts/check_writing.py page.html`.
2. Check the structure: as many `<article` as `</article>`, and as many `<details` as `</details>`.
3. Inspect it with available browser or rendering tools at phone and desktop widths, with one panel opened.
4. Deliver the HTML with its screenshots, or use the user-selected publishing tool when publishing is requested.
   Keep screenshot paths under `shots/` relative to the page. Follow the selected tool's asset-upload
   and update semantics; preserve existing attachments when updating.
5. From another session, pass the page's URL as `url` and read the live version first: someone may have
   published since. Merge their changes in rather than overwrite them.
6. Give the resulting file or share link. Include a share key only when required by the selected host.
