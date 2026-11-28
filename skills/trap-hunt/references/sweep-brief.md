# Sweep brief

Use for the read-only search for traps no detector covers. Give each agent one repo or a small group, and fill in the angle brackets. Run the agents in parallel; confirm every finding against the code before it enters the register.

---

Read-only audit of `<repo paths>` (`<stack, one line per repo>`). Goal: find traps that make a coding agent produce a wrong change, hidden technical debt, gotchas and needless complexity that are NOT already documented.

Already documented (skim, do not repeat): `<the repo's agent rule file>`, `<the project's trap doc>`, `<feature notes with trap sections>`, `<the repo's docs folder>`. Also skip anything in `docs/traps/register.json`.

Check each family with evidence (file and line, counts from search and line counts):

1. copies that drifted (same helper, table, map or pipeline block in several places or repos, now different)
2. magic codes (status, type or role literals compared inline; one enum name with different values)
3. docs that contradict the code (versions, endpoints and their consumers, env defaults, paths, deploy order)
4. silent failure (swallowed errors, env fallbacks to literals or other environments, permissive defaults, non-idempotent webhooks or jobs)
5. dangerous leftovers (superseded pipelines still triggerable, scripts that overwrite tracked files, ignored docs, dead code with no warning)
6. misleading names (misspellings, duplicate basenames or type names, folders named like files)
7. size and coupling (huge files, cross-module internals imported, many writers to one table, side effects at import)
8. gates that do not gate (steps that cannot fail, branch filters, analyzer baselines, deploys without tests, no CI)
9. dead config (settings or env keys nothing reads)
10. conditions that cannot fire
11. authority outside the repo (state held in a CI server or portal)
12. client copies of a server catalogue (enums, error codes, fields; hard casts in client models)

Report any new family that fits none of these.

Return at most `<25>` findings, most harmful first, each as:
`path:line | family | what it is | how it misleads an agent | fix that fits this repo's structure | could a script detect it (yes: how / no)`.
Then a totals line, a short "checked and clean" list, and what you are unsure of. No file dumps. Change nothing.
