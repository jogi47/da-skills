---
tags: [skill-creator]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Add a refund endpoint for admins: POST /admin/orders/:id/refund. It should mark the order as refunded and email the customer that their refund is on the way. Keep it consistent with how the admin cancel works. When you're done, put a short summary of what you changed in summary.md.

Input files: package.json, pnpm-workspace.yaml, AGENTS.md, apps/, packages/
