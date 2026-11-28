---
name: principle-prove-it-works
description: "Apply after completing a task, before declaring done. Verify against the real artifact (run the feature, read the actual value, inspect the diff), not a proxy, self-report, or 'it compiles.'"
---

# Prove It Works

Verify every output by checking the real thing directly: run the feature, read the actual value, inspect the diff. Proxies (file mtimes, self-reports, cached output, "it compiles") do not count. When a check fails, suspect the observation method before the system.

A check counts only if it could have failed. See it fail without the change, or against a wrong value, before you trust its pass.

Before you report done, pair each claim with its evidence: the command and what it printed, or the value you read. Report a claim with no evidence as unverified; do not drop it or soften it into a pass.

Use the project's own verification route first. If its CLAUDE.md or skill list names verify skills, run skills or check scripts, run those; ad hoc checks only fill what they miss.

Script the check when you can. A deterministic script that reruns the comparison beats a one-time look. Keep its output where the human can see it, and commit it only when the trail must be auditable later.
