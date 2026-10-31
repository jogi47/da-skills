---
name: jigar-artifact-writing
description: Jigar's writing rules for every piece of text that goes into an artifact (documents, progress pages, checklists, release notes) and anything else he publishes from one, such as ticket comments and update messages drafted from a page. Covers wording only (banned words, openers and sentence shapes, UK spelling, no em-dashes or emoji, layout, register), with a checker script for the mechanical rules. Use whenever writing, editing or reviewing artifact text, before every publish, and when Jigar asks to check a page's wording.
---

# Jigar's writing rules for artifacts

Every piece of text that goes into an artifact follows these rules. That covers new pages, every edit to an existing page, captions, chips, case lists and footers. The rules cover wording only. The artifact's design and structure come from the artifact skills, as before.

Most of the rules are mechanical, and `scripts/check_writing.py` catches most of those. Run it before every publish, then read the page once by eye for what a script cannot judge (see **Before it goes anywhere**).

These rules come from the team's shared writing rules (Sam's, October 2026). They also apply to anything Jigar sends out from an artifact, such as ticket comments, release notes and Slack updates, when he asks for those.

## Hard rules

Break one of these and the text isn't ready.

- **No em-dashes** (the long dash, U+2014, or `&mdash;` in HTML). Not for emphasis, not in examples. Use a colon, a comma, a semicolon, brackets or two sentences. The shorter en-dash is fine in number ranges only.
- **UK spelling throughout:** organise, colour, labelled, behaviour, programme, analyse, centre, recognise, authorisation. American spelling is out even when the topic is American. Code identifiers and quoted UI text keep their own spelling (`[Authorize]`, a button that says "Color").
- **No emoji.**
- **None of these words:** leverage, elevate, unlock, unleash, empower, robust, seamless, cutting-edge, world-class, rocket fuel, synergy, crucial, vital, pivotal, delve, dive into, deep dive, foster, harness, streamline, holistic, game-changer, move the needle, double down. Nor navigate, ecosystem, journey, realm or landscape as metaphors (a train journey is fine, and so is navigating away from a page in a product).
- **None of these openers or transitions:** "In today's fast-paced world", "Ultimately", "Fundamentally", "At the end of the day", "It is worth noting", "It is important to note", "That said".

## Sentence shapes to avoid

Each of these sounds machine-written. The fix is nearly always to make the plain statement and stop.

| Shape | Looks like | Write instead |
| --- | --- | --- |
| Contrastive triad | "It's not X. It's not Y. It's Z." | "It's Z." |
| Elevation formula | "Not just X, but Y" | Say Y. |
| Rhetorical question as a link | "So what does this mean?" | The answer, as a statement. |
| Negation then correction | "It isn't a bug, it's a design decision." | "It's a design decision." |
| Fragments stuck together | "Fast. Simple." | One proper sentence. |
| Paired metaphor | "Less a hammer, more a scalpel." | The instruction itself. |
| Applauding your own line | "And that matters." "Which is exactly the point." | Delete it. |
| Significance claim | "What matters more is...", "the thing everyone misses" | Delete the clause. If it matters, say what it costs in money, risk or time. |
| Validation filler | "Somebody has thought about this properly." | Delete it, or say what follows from it. |
| Announcing the sentence | "Worth flagging:", "To be clear,", "Let me be explicit" | Start with the statement. |
| Candour pat on the back | "It won't catch everything, and we won't pretend it will." | "It won't catch everything." Then say what happens to the ones it misses. |
| Corporate honesty label | "honest trade-off", "in the spirit of transparency" | State the trade-off. |

## Words to cut on sight

- **Quietly and silently**, unless you mean actual noise. "Saving can no longer switch a product off silently" on the V1.5.1 page became "A save now asks before switching a product off".
- **Deliberately.** If a choice needs a reason, give the reason.
- **"Earns its place"** and the family around it. If something belongs, include it and say nothing.
- **"Read" as interpretation:** "reads as", "reads like", "my read is". Use it only when someone is literally reading something. "Values read as they do in the report CSV" became "Values appear as they do in the report CSV".

## Openings, closings and layout

- Start with the point. No scene-setting.
- Stop when the point is made. No "Thoughts?" or "Something to consider" at the end.
- Prose by default. Bullets only for genuinely separate items: steps, options, named things.
- Bold and italics are for real emphasis, and that is rare.
- Headers once a document is long enough that people will scan it. Not on short notes.

## Veridate wording

Never write "the app" on its own. It is "the mobile app" or "the web portal" every time, because the product has both and the reader has to guess which you mean.

## Before it goes anywhere

1. Any banned word, opener or transition?
2. Any of the sentence shapes in the table?
3. Any stray quietly, silently, deliberately, or "read" that isn't literal reading?
4. Does it open on the point and stop when the point is made?
5. UK spelling everywhere?
6. Bullets where a paragraph would do?
7. Bold or italics used as decoration?
8. One register throughout? Smart, dry and direct for the team; warm and human for anything a client will see.
9. If a client will see it: does it sound like a partner on their side of the problem, with every risk still stated as plainly as before? Soften the stance, never the substance.

## The checker

Resolve commands relative to this skill directory, wherever installed.

```bash
python3 scripts/check_writing.py <file.html|file.md> [more files]
```

It reads HTML or Markdown, ignores `<script>`, `<style>`, `<code>`, `<pre>`, Markdown code spans and fences, and reports each finding with its line number:

| Level | What it catches | Exit code |
| --- | --- | --- |
| `HARD` | em-dashes, en-dashes outside a number range, emoji, banned words and openers, American spellings, "the app" on its own | 1 if any |
| `CUT` | quietly, silently, deliberately, "earns its place", "reads as", "reads like", "my read" | 0 |
| `LOOK` | phrases that often start a banned shape, metaphor words (navigate, journey, landscape...), spellings that depend on meaning (program, license, dialog) | 0 |

Fix every `HARD` finding. Rewrite every `CUT` unless the word is literal (real noise, someone actually reading). Look at each `LOOK` finding and decide; most need rewriting, and some are literal. The script cannot judge register, length, or whether a list should have been a paragraph, so the checklist above still needs a read by eye.

When a finding is a false positive the script cannot avoid (a quoted UI label, a product name), leave it and mention it when reporting the check.
