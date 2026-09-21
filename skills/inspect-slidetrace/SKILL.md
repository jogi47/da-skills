---
name: inspect-slidetrace
description: Inspect and diagnose SlideTrace recording folders from any recorded website — session metadata, per-origin screenshots, interaction/timeline JSONL with stable locators, browser console logs and expanded objects, captured Fetch/XHR traffic with call-site initiators and trace/request-id correlation, performance chunks, postMessage evidence, redaction metadata and optional storage snapshots. Use when a user provides a local SlideTrace folder path and asks what happened, why UI behaviour occurred, which click caused a request, how to join a request to the backend's own account of it, whether a fix was active, or for evidence-backed debugging. For backend tracer runs use inspect-backend-trace; for Flutter app runs use inspect-iwx-mobile-trace.
---

# Inspect SlideTrace

Reconstruct the session from timestamps and raw evidence before diagnosing code.

**The recorder is site-agnostic.** It is a Chrome extension that captures whatever HTTP(S) page is
in front of it — a local dev server, a staging deployment, a third-party site. Everything in this
skill about *artifact shapes* holds for every recording. Everything about a *particular app* —
whether it emits structured console rows, whether its requests carry `traceparent`, whether its
backend returns `X-Request-Id`, how its test ids are named — **is discovered from the recording in
step 3, never assumed**. An absent convention is a property of that app, not a fault in the run.

Recorder repo, when the reader tool or the schema is needed:
`/Users/jogimac/playgrounds/chrome-spy/chrome-api-call-recorder` (`README.md` is the schema of
record).

## Delegation

- These delegation instructions apply only to the root agent. If you were spawned to inspect SlideTrace, skip this section, never spawn subagents, and perform the Workflow directly.
- Delegate when the investigation is large, chronology-heavy, compares multiple recordings, or benefits from retained context across follow-ups. Inspect directly when the question is narrow, only a few artifacts are relevant, subagents are unavailable, or delegation would add more latency than value.
- When delegating, check for an existing responsive `default` SlideTrace inspector first. Reuse it when prior trace context helps; send the new folder path and exact user question. Otherwise spawn at most one `default` inspector with isolated context (`fork_turns: none` when supported), passing the question, folder path, and this skill path.
- Wait for one reasonable bounded interval. If the inspector stalls, times out, is interrupted, or returns insufficient evidence, proceed with direct inspection. Do not repeatedly poll or let delegation block the answer.
- Avoid duplicating a healthy inspector's full raw investigation. The root agent may inspect targeted artifacts to resolve ambiguity, validate decisive evidence, or continue after fallback, and always owns the final diagnosis.

## Layout

```
<session-start>_<session-id>/
  session.json                     canonical session metadata — read first
  timeline/000001_timeline.jsonl   every artifact in one sequence
  interactions/*.jsonl             clicks, typing, navigation, postMessage
  performance/*.jsonl              navigation/resource timing, long tasks, LCP, CLS, heap
  <scheme>_<host>_<port>/          one folder per TOP-LEVEL page origin
    apis/<call>.json               one Fetch/XHR call each
    logs/*_console.jsonl           console output
    logs/objects/                  expanded console objects too large to inline
    screenshots/*.jpg              timer and interaction shots
    images/                        fetched image bodies up to 5 MiB
    storage/initial.json           localStorage + IndexedDB manifest, captured at Start
    storage/indexeddb/…            paged, best-effort record chunks
```

Grouping is by **top-level page origin**, not by the API's origin — an XHR to another host lands in
the page's folder. A navigation to a different top-level origin (an SSO hop, a payment redirect)
creates a **second origin folder in the same session**; read both, in timestamp order, before
concluding a flow was abandoned.

## Workflow

1. Resolve the supplied folder and inventory it with `rg --files`. Request filesystem approval when
   required. Note every origin folder — the count alone often tells you the flow.

2. Read `session.json` first. Record start/end timestamps, origin folders, and
   `captureConfiguration.redaction.mode` (`dev`, `strict`, `off`). In `dev` (the default) passwords,
   PINs and secrets read `[REDACTED]`, tokens are readable but unusable (`eyJ….eyJ….[SIGNATURE-REDACTED]`,
   `abcdef…[43 chars]`), URLs and emails are intact. In `strict` URLs, codes and tokens are gone too.
   In `off` only header values are redacted. A redacted value is evidence that the value existed,
   never a bug in the app. Also note `counts.screenshotsSkippedUnchanged` (timer shots dropped
   because the screen did not change), `filteredCounts` (hover event timings and repeated/kindless
   `postMessage`s dropped at source) and `droppedCounts` — filtered and dropped are different, and
   neither is a finding about the app by itself.

3. **Profile the recording before interpreting it.** Four cheap commands establish which conventions
   this app actually has. Do not carry an assumption from another app's recording into this one.

   ```bash
   S=<session>; O=$S/<origin-folder>
   # does the app propagate trace context, and does its backend return a request id?
   jq -s 'map(.correlation) | {records: length,
          withTraceId: map(select(.traceId != null)) | length,
          withRequestId: map(select(.xRequestId != null)) | length}' $O/apis/*.json
   # who actually calls the API — and can the stacks tell callers apart?
   jq -r '[.initiator.callerFrame.functionName, .initiator.appFrame.functionName,
           .request.method, .request.url] | @tsv' $O/apis/*.json | sort | uniq -c | sort -rn | head
   # does the app emit structured console rows, and under which prefix?
   jq -r '.message' $O/logs/*_console.jsonl | grep -oE '^\[[a-z0-9:._-]+\]' | sort | uniq -c | sort -rn
   # how are its controls identified?
   jq -r 'select(.target) | "\(.target.strategy)\t\(.target.brittle)\t\(.target.locator)"' \
     $S/interactions/*.jsonl | sort | uniq -c | sort -rn | head
   ```

   What the answers mean:

   - **`withTraceId` / `withRequestId` are 0** — normal for many apps. The frontend injects no
     `traceparent`, or the backend returns no `X-Request-Id` (verified example: the ClubMatch
     backend does not; the InspectionWorx API does, from its request-logging middleware). Use the
     join ladder in step 8 instead of reporting the nulls as a gap.
   - **`callerFrame` is the call site; `appFrame` is usually the shared wrapper.** `callerFrame`
     skips framework plumbing and names such as `commonRequest`, `apiCall` or a bare `post`, so a
     record reads `clubMetricRequest` rather than `commonRequest`. A high `withCallerFrame` with
     `distinctCallerFrames: 1` (both reported by the reader tool) means every request enters through
     one function and the stacks genuinely cannot separate callers — say so rather than attributing.
     `asyncStackStatus: "unavailable"` means another debugger held the tab and only the sync stack
     exists.
   - **Structured console rows** appear when the app logs them itself, under its own prefix — e.g.
     `[veridate:api]`, `[veridate:auth]`, `[veridate:route]`, `[veridate:store]` in the
     InspectionWorx frontend, whose `api` row carries the backend's `requestId` (and a `traceId`
     where the app has one). Discover the prefix; never assume one. **No such rows is not evidence
     that nothing happened** — an app may simply not log this way, and some apps emit them only from
     a dev server, not from a built bundle.
   - **Locators**: `target.locator` is a selector string, with `strategy`, `brittle`, `tag`,
     `role`, `accessibleName` and `attributes` beside it on `target`. Prefer
     `strategy: "data-testid"` (`[data-testid="report-centre-reset-filters-button"]`); id naming is
     the app's own convention, often `<feature>-<element>-<role>`. A `brittle: true` CSS locator
     (`div > div:nth-of-type(1) > …`) means that control has no test id yet — a testability gap
     worth reporting, not a defect. When only brittle locators exist, name the control by
     `accessibleName` in the report, since the selector will not survive a re-render.

4. Correlate, in timestamp order, using `timeline/` as the spine — it carries every artifact with a
   session-wide `sequence`, ISO timestamp, `sessionElapsedMs` and session-relative path:

   - `interactions/*.jsonl` for clicks, typing, drags, forms, focus, scroll, navigation/history and
     cross-frame `postMessage`. `correlationId` ties pointerdown, click and the interaction
     screenshot together. A field with `valueRedacted: true` and a `valueLength` was typed into but
     not stored — password, card, one-time-code fields, and every editable element inside a payment
     provider's frame.
   - `postMessage` entries (`eventType: "message"`) are often the only record of a popup, SSO or
     payment outcome: they carry `origin`, `sameOrigin`, the announced `kind`, top-level key names,
     booleans and numbers. Payload strings are never stored, so do not expect the code or token.
   - screenshots for visible state; inspect relevant images with `view_image`. Timeline screenshot
     events carry `trigger: "timer"` or `trigger: "interaction"` with `interactionType` and the
     click's `correlationId`; the interaction shot is what the click produced, ~250 ms later, and is
     never deduplicated — an unchanged screen after a click is evidence.
   - `apis/*.json` for request URLs, query parameters, status, timing and narrowly selected response
     fields, plus `correlation` and `initiator` as profiled in step 3. An omitted body records an
     `omissionReason` (Chrome discarded it, size limit, multipart upload) — that is a capture limit,
     not an empty response.
   - `logs/*_console.jsonl` and timeline logs for application state and errors, including any
     structured rows step 3 found.
   - `logs/objects/` when console entries reference expanded objects.
   - `performance/*.jsonl` when the question is slowness, jank or memory: navigation and resource
     timing, long tasks, LCP, layout shifts, main-thread stalls, heap usage. Entries timestamped
     before Start are discarded and counted; a rising `droppedCounts.performanceBeforeSessionStart`
     is a recorder symptom, not an app one.
   - `storage/initial.json` and `storage/indexeddb/` when persistence, Undo/Redo, sync, offline,
     queued-action or stale-state behaviour matters. It is a Start-time snapshot, paged and
     best-effort; the manifest reports its own incompleteness.

5. Use `jq` and targeted `rg` patterns. Inspect keys before values. Avoid broad output from large
   JSON/JSONL files. The reader tool summarises a whole session and validates Schema v2, v1 `.jsonl`
   and legacy `.txt`:

   ```bash
   node /Users/jogimac/playgrounds/chrome-spy/chrome-api-call-recorder/tools/read-recording.mjs <session>
   ```

   It prints `correlation` (how many API records carry a trace id, a backend request id, an app
   frame, a caller frame, plus `distinctCallerFrames` and async-stack availability),
   `redactionMode`, `redactionViolations` (credentials the mode should have hidden — report them),
   dropped and filtered counts, and `--acceptance` for a pass/fail.

6. Separate facts from inference. Distinguish automatic UI changes from user clicks, reloads,
   navigation, and hot updates.

7. Verify chronology before claiming a trace predates code. Compare UTC recording timestamps with
   source/build/runtime timestamps; a source mtime alone does not prove the browser loaded that
   code.

8. **Joining a request to the backend's own account of it — take the first rung that this recording
   supports, and say which one you used:**

   1. **`correlation.xRequestId`** — the backend's `X-Request-Id`. Exact. Look it up in a backend
      tracer run's `journey.requests[]` (see `inspect-backend-trace`), or in the backend log's own
      request-id scope.
   2. **`correlation.traceId`** — the caller's `traceparent`. Exact against any APM the backend
      reports to (App Insights for InspectionWorx) and against span `traceId` in a tracer run.
   3. **The app's own structured console row**, when step 3 found one carrying a `requestId` or
      `traceId`. On the InspectionWorx frontend the `[veridate:api]` row's `requestId` is the
      backend's id even in recordings whose API records have a null `correlation` block — which is
      most of them. Match the row to the call by URL, method and timestamp first.
   4. **Method, path and time window**, plus `initiator.callerFrame` to disambiguate two callers of
      the same endpoint. Close to unambiguous for a single user against a local backend; degrades
      with concurrent traffic. This is the only rung available for apps that propagate no trace
      context and whose backend returns no request id.

9. If code diagnosis is requested, trace the relevant implementation only after establishing
   recording facts. Reproduce the captured data shape in a regression test before changing
   behaviour.

## Guardrails

- Do not expose authorization headers, tokens, cookies, or unrelated personal data. In a `dev`-mode
  recording tokens are already unusable but still quote only their prefix or length; a signature-
  stripped JWT's claims (role, tenant/client id, expiry) may be read and cited.
- A recording of a **third-party or public site** carries other people's content and possibly the
  user's own logged-in state. Quote only what the diagnosis needs, and never re-post captured
  content anywhere.
- Two API records with the same URL within ~200 ms are a duplicate fetch, an app defect worth
  reporting, unless `callerFrame` shows two different callers with different intent.
- Do not recommend new accounts or data resets without evidence.
- Treat screenshots plus interaction/API timestamps as stronger evidence than appearance alone.
- Use video transcription only for actual video/audio. Inspect ordinary SlideTrace JSON and screenshots directly.
- Keep investigation read-only unless the user asks for a fix.
- Inspect storage conditionally and narrowly; it may contain unrelated user state.
- Recorder limits are documented, not silent: omitted bodies, capped chunks, dropped buffer entries,
  service-worker restarts losing in-flight correlation. Check the recorder README before reporting
  an absence as an application defect.

## Report

State concisely:

- which app/origins the recording covers, and over what window
- what happened and when
- decisive evidence
- root cause or narrowest supported hypothesis, naming the control by its locator (test id where the
  app has one) and the request by its `xRequestId` / `traceId`, or by method, path and time where it
  has neither
- which join rung from step 8 you used
- confidence and any missing evidence
- which expected scenarios the recording did not exercise
- whether code, cached runtime, or account data needs action
- the redaction mode, and any `redactionViolations` the reader reported
