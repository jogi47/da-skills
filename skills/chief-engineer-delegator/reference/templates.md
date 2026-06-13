# Chief Engineer Delegator Templates

Use these templates only when helpful. Keep mission-specific prompts concise.

## Worker Table

```markdown
| Thread ID | State | Current Task | Last Update | Next Chief Action | Notes |
|---|---|---|---|---|---|
| `...` | idle | none | 2026-06-10 | none | reusable same-branch worker |
```

States: `idle`, `planning`, `working`, `needs-review`, `held`, `blocked`, `archived`.

## Fresh Task Boundary

```text
New task in the same worker thread. Previous task is complete; do not continue old scope.
Use the scratchpad and this prompt as current source of truth.
```

## Worker Prompt

```text
You are a worker thread running in the SAME repo checkout and SAME branch: [repo path].
Do not create or switch worktrees/branches.
This task is the only active scope unless the chief explicitly says otherwise.

Task: [one narrow task]

Context:
- [source ticket/plan/user decision]
- [known files and facts]
- [risk boundaries]
- [scratchpad path and relevant decisions]
- Allowed edit scope: [files/folders]
- No-touch areas: [files/folders]

Must follow repo instructions:
- Read relevant docs/files first.
- Create required plan doc before code if repo workflow requires it.
- Stop after plan and ask for approval unless explicitly cleared to proceed.
- Use minimal changes.
- Do not revert unrelated changes.
- Run required verification.
- Be blunt: ask concise questions if scope, product behavior, safety, or verification is unclear.

Expected output:
- Plan path or changed files.
- Verification run/results.
- Blockers or risks.
```

## Explorer Prompt

```text
You are a read-only explorer subagent in the SAME repo checkout and SAME branch: [repo path].
Do not edit files, format files, install packages, stage/commit, create branches/worktrees, or start long-running servers.

Question: [specific fact to determine]

Context:
- [task/user concern]
- [known worker output or plan path, if relevant]
- [files/folders to inspect]
- [files/folders to avoid if needed]

Expected output:
- exact files/lines checked
- commands run
- facts found
- inferences clearly labeled
- gaps/uncertainties
```

## Approval Message

```text
Plan approved.

Proceed on SAME checkout/branch only.
Edit only:
- [file list]

Implementation constraints:
- [minimal change rules]

Verification:
- [commands/checks]

Stop after implementation + verification with changed files and results.
```
