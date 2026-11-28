---
name: chrome-ui-verification
description: Verify routes, UI fixes, navigation, interactions, visual behavior, browser console output, and network activity in the user's Chrome browser through available browser-control tools, directly or with at most one reusable verification subagent when delegation is supported and authorised. Use for frontend inspection, reproduction, debugging, and acceptance checks. Do not use this workflow for repository-owned automated test suites.
---

# Chrome UI Verification

Perform manual frontend verification in the user's Chrome browser.

## Delegation

- Verify directly when the request is a narrow flow, needs the current browser
  state, or delegation would add more latency than value. When delegation is supported and authorised, delegate when checks
  span multiple routes, repeated states, or substantial console/network
  evidence, or when retained verification context helps across follow-ups.
- When delegating, check for an existing responsive session-scoped
  verification subagent first. Reuse it when prior context helps; otherwise
  start at most one verifier. Never keep multiple verification
  subagents for the same thread.
- Instruct the subagent to use this skill, make no application-code changes,
  and return concise verification evidence.
- Wait for one reasonable bounded interval. If the verifier stalls, times out,
  is interrupted, or returns insufficient evidence, continue with direct
  Chrome verification. Do not repeatedly poll or let delegation block the
  answer.
- When already running as the delegated subagent, verify directly and do not
  delegate again. The root agent may validate targeted evidence and always owns
  the final conclusion.
- Do not create or configure a dedicated custom verification agent.

## Browser Rules

- Use available browser-control tools connected to the user's Chrome session.
- Discover the tools and connection requirements; do not assume a particular agent,
  extension, integration or tool name.
- Do not use Playwright CLI, a separate automation browser, an embedded browser,
  recordings, screenshots, or another browser as a substitute for manual
  Chrome interaction. Screenshots captured during the Chrome session may
  support the result.
- Inspect existing Chrome tabs first and reuse the target app's authenticated tab.
  Create a tab only when no existing-tab constraint applies and the flow needs one.
- When the user selects an already-open, signed-in tab, keep that tab. If it is
  logged out or on the wrong app, report the mismatch and ask for the intended
  state; do not log in or open another tab as a workaround.
- Stay on the app origin unless the test requires navigation elsewhere. Do not
  log out or change the profile as part of unrelated setup.
- Reuse the user's Chrome profile, authenticated session, and existing tabs when
  appropriate.
- Ask the user to reconnect or open Chrome only when Chrome control is
  unavailable or disconnected.
- If authentication is required and unavailable, ask the user to sign in in
  Chrome and confirm when ready.

## Test Scope

- Drive the authorised flow end to end, including form submissions and changes
  to synthetic test records when needed by the requested checks.
- Do not infer permission for unrelated data changes. Do not run mutating
  checks against production.
- Prefer accessible page structure and text for behavioural assertions; use
  screenshots for visual findings.

## Server Boundary

- Never manually start, restart, stop, or otherwise manage the frontend
  development server.
- Assume the user manages the server and it is normally running.
- If the URL is unreachable, ask the user to start the server or confirm the
  correct URL. Do not run a server command.

## Verification Workflow

1. Determine the target URL, route, viewport, and behavior from the request and
   repository guidance.
2. Connect to Chrome and navigate to the target.
3. Reproduce the relevant user flow, including route transitions when the issue
   concerns navigation, layout movement, state persistence, or flicker.
4. Inspect visible behavior and, when relevant, console errors and network
   requests.
5. Repeat the exact flow after a fix and test relevant boundary states.
6. Report actions taken and pass/fail/blocked per acceptance criterion. Include
   relevant console errors, failing network calls with HTTP status and request
   IDs such as `x-request-id` when available, and screenshots for visual bugs.
   State anything that could not be verified.

## Automated Tests

- Allow repository-owned automated tests, including Playwright E2E, screenshot,
  and visual-regression suites.
- Run them only through documented repository test commands.
- Allow a configured test runner to manage its own isolated test server.
- Do not describe automated test output as manual Chrome verification.

## Evidence Rules

- Use screenshots and recordings as supporting evidence only; do not treat them
  as a replacement for the requested Chrome verification.
- Never claim manual Chrome verification or automated tests passed unless they
  actually ran successfully.
- State clearly when Chrome, authentication, the server, or another dependency
  prevented completion.
