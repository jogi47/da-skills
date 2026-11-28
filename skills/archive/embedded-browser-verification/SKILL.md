---
name: embedded-browser-verification
description: Test a web flow in the user's embedded browser pane using available browser-control tools. Use when the user explicitly selects the in-app browser or browser pane for verification. Reuse its signed-in tab and keep it distinct from the user's external Chrome session.
---

# Embedded browser verification

Use the requested browser pane and its actual session. Discover available tab, navigation, interaction,
page-reading, console and network capabilities; do not assume provider-specific tool names.

## Session and scope

- Inspect existing tabs first and reuse the app's signed-in tab. Do not open extra tabs or switch to
  external Chrome. Stay on the app origin unless the requested flow requires another origin.
- If the pane is unavailable or its target is unclear, report that and establish the URL from the
  request, conversation or project guidance. Ask only for information that cannot be discovered.
- If a new tab or sign-in is needed, use the pane's supported navigation tools. Ask the user to sign
  in and continue after they confirm; do not enter personal credentials yourself.
- For an isolated local test session whose workflow explicitly supplies synthetic accounts, follow
  that workflow's sign-in procedure. Keep credential values out of chat, screenshots and reports.
- Perform interactions needed for the authorised test, including changes to synthetic test records
  when within scope. Do not infer permission for unrelated changes. Do not run mutating checks
  against production.
- Do not start or manage a development server unless the user or the project's test workflow
  authorises it. Navigating the pane to an existing URL does not authorise starting a server.

## Verify and report

1. Determine the target flow, acceptance criteria and starting state from the request and evidence.
2. Drive the flow end to end. Prefer accessible page structure and text for assertions; capture
   screenshots for appearance, layout and visual defects.
3. Inspect relevant console errors and failing network calls. Record HTTP status and request IDs
   (such as `x-request-id`) when exposed. Inspect attached server logs only when available and relevant.
4. Report actions taken, pass/fail/blocked for each criterion and supporting evidence. State missing
   access or observability honestly. A loaded page alone does not prove the flow passed.

Do not claim an automated suite ran from manual browser checks. Use the external Chrome verification
skill when the user selects Chrome instead of the embedded pane.
