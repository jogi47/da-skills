---
name: inspect-iwx-mobile-trace
description: Inspect and diagnose iwx-mobile-tracer run directories capturing the InspectionWorx Flutter app on an Android emulator — per-interaction journeys, taps with widget attribution, before/after screenshots, dart:io API traffic with bodies, Flutter logs, errors, frame timings and lifecycle events. Use when a user provides a local run folder path (or points at iwx-emulator-tracer/runs/) and asks what the user did, why the app behaved that way, which tap caused a request, or for evidence-backed mobile debugging.
---

# Inspect iwx-mobile-trace

Reconstruct what the user did, then what the app did in response, before diagnosing code.

The tracer records from **outside** the app — Dart VM Service plus adb — so the app itself is
uninstrumented. Everything here is observation, and every gap in that observation is named in
`coverage.json` rather than left as silence.

## Delegation

- These instructions apply only to the root agent. If you were spawned to inspect a run, skip
  this section, never spawn subagents, and perform the Workflow directly.
- Delegate when the investigation spans many interactions, compares runs, or benefits from
  retained context across follow-ups. Inspect directly when the question is narrow.
- When delegating, reuse an existing responsive inspector before spawning a new one. Pass the
  run path, the exact question, and this skill path.
- Do not let delegation block the answer. The root agent owns the final diagnosis.

## Read in this order. Do not skip step 2.

1. **`index.json`** — the front door. Says what the run holds, how big, and what to read first.
2. **`coverage.json`** — **how much to trust the run.** Read before drawing any conclusion.
   Check in particular:
   - `state` — `complete` or `partial`. This describes **capture, not the app's health**. A run
     stopped with Ctrl+C is `complete`; one whose app crashed is `partial`.
   - `interactions.lostContacts` — touch contacts seen but not recorded. Non-zero means the
     interaction list is a **lower bound**; do not conclude "the user did not tap X".
   - `trust.droppedRecords`, `trust.screenshotsSkipped` — buffer and capture losses.
   - `interactions.geometryAvailable` — false means taps carry coordinates but no widget.
   - `network.omission` — what the network capture cannot see.
3. **`journey.json`** — the deliverable, organised **per interaction**, not per stream. Usually
   answers the question without opening anything else.
4. Only then the raw streams.

## Structure

```
runs/<runId>/
  index.json coverage.json journey.json session.json meta.json
  timeline/*.jsonl      every event in one ordered spine
  apis/*.json           one file per HTTP call, headers and bodies, auth redacted
  screenshots/*.png     named by reason: session-start, before, after, idle, session-end
  logs/ errors/ interactions/ performance/ lifecycle/
```

Each `journey.json` step carries: `interactionId`, `at {x,y}`, `screen`, `widget`,
`screenshots.before/after`, `apis[]`, `logs`, `errors[]`, `jankyFrames`, `blindSpot`.

## Correlating

- **`sequence` is the only total order.** Four transports (VM Service, logcat, getevent,
  screencap) have different latencies, so wall-clock timestamps between streams disagree.
  Never order events by `timestamp` across streams; use `sequence`.
- **`interactionId` is the spine.** Every log line, API call and error is attributed to the
  most recent preceding interaction. Events before the first interaction are in
  `journey.startup`.
- **`screen`** is the route where the interaction *happened*. A tap that navigates shows the
  old screen; the next interaction shows the new one. That is correct, not a bug.
- To join a request to the backend, read `traceId`. It is currently always `null` — the join
  to an `iwx-tracer` run is heuristic, on `(method, path, time window)`. Say so when you use it.

## The blind-spot metric

`journey.blindSpots` lists interactions that produced **no API call, no log line and no error**.
This is the mobile counterpart to `iwx-tracer`'s silence metric and is usually where the bug is:
a tap the app appeared to swallow. Check the before/after screenshots for those interactions
first — if the screen did not change either, the handler never fired.

A high blind-spot ratio can also mean the taps landed on inert areas. Distinguish the two with
the screenshots before claiming a defect.

## Known omissions — absences that are not evidence of absence

`coverage.json` states these per run. Do not diagnose around them without saying so:

- **`adb shell input` is invisible.** It injects through InputManager and never reaches
  `/dev/input`. Only real touches are recorded. A run driven by automation will show zero
  interactions while still showing the API calls those taps caused.
- **Debug and profile builds only.** The VM Service and HTTP profiling do not exist in release.
- **`dart:io` traffic only.** For this app that is believed to be everything (dio, uploads via
  FormData/MultipartFile, and Flutter's `NetworkImage` all use `dart:io`); traffic originating
  inside native platform code would not appear.
- **Widget names are coarse for leaves.** Flutter truncates the render tree's creator chain, so
  a tap often resolves to a framework widget (`Text`, `Padding`, `Material`) rather than app
  code. `widget.rect` and `creatorChain` are the reliable parts. The **screen** is always app
  code with `file:line`.
- **Android only.** On iOS the app swaps dio to `cupertino_http`, bypassing `dart:io` entirely.

## Technique

- Use `jq` and targeted `rg`. Inspect keys before values; `apis/*.json` and the render-derived
  fields can be large.
- Inspect screenshots with the image viewer when visible state matters. A before/after pair
  plus the API list is stronger evidence than either alone.
- `meta.json.stats` holds per-collector counts — useful when a stream looks empty and you need
  to know whether it was quiet or broken.
- Read `session.json` to confirm which app build this was: target commit,
  `workingTreeDirty`, env, and `--dart-define` set. A dirty working tree means the binary does
  not match any commit.

## Guardrails

- Authorization headers are redacted at capture as `[redacted N chars]`. Never attempt to
  recover a token, and do not quote cookies or other credential material.
- Screenshots and response bodies contain real product and staging data. Quote only what the
  diagnosis needs.
- Keep the investigation read-only unless a fix is requested.
- Separate fact from inference. "No log line" means nothing was captured, which is not the same
  as nothing having happened — check `coverage.json` before treating silence as evidence.
- Verify chronology before claiming a run predates a code change. Compare the run's UTC
  timestamps and `session.json.target.commit` against source and build times.

## Report

State concisely:

- what the user did, in order, and what the app did in response
- the decisive evidence, cited by artifact path
- root cause, or the narrowest hypothesis the evidence supports
- confidence, and which evidence is missing or degraded per `coverage.json`
- which expected paths this run did not exercise
- whether app code, backend, or the trace itself needs action
