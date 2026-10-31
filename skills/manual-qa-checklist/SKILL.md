---
name: manual-qa-checklist
description: Produce short, plain-English steps for a person to manually verify a change or fix. Use when the user asks what to test, what to manually check, or for a manual QA checklist. Focus on visible behaviour and expected results rather than server setup, commands or implementation details.
---

# Manual QA checklist

Read the relevant request, requirements and available change evidence. Identify the changed behaviour,
its important boundary cases and nearby regressions a person can observe. If the change is unknown,
ask for its scope rather than inventing features or expected results.

Return concise bullets in simple English. Each bullet gives one action and the expected visible
result. Put the main changed flow first, then relevant permissions, validation, persistence and failure
cases. Include only cases supported by the change or requirements.

Use actual screen, field and button names when known. State any necessary user role or starting data
briefly. Label uncertainty instead of presenting a guess as the expected behaviour.

Omit server/frontend startup, shell commands, code structure and environment setup unless requested.
Do not run tests or mark checks passed just because a checklist was requested. This is guidance for
manual QA, not an execution report.
