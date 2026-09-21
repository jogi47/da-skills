---
name: inspect-backend-trace
description: Inspect and diagnose backend tracer run directories written by the iwx-tracer family (iwx-tracer for the .NET InspectionWorx API, clubmatch-tracer for the Node/Fastify ClubMatch API, and any fork sharing their artifact contract) — per-request journeys, backend log records, OpenTelemetry spans, runtime samples and the coverage trust artifact. Use when a user provides a local tracer run path (runs/<ISO-timestamp>/) and asks what the backend did, why a request failed, or for evidence-backed diagnosis. For the Flutter app use inspect-iwx-mobile-trace; for browser SlideTrace folders use inspect-slidetrace; for teacher-helper runs use inspect-teacher-trace.
---

# Inspect backend trace

Reconstruct what each request did, in order, before diagnosing code.

These tracers record from **outside** the backend — stdout plus an OpenTelemetry Collector — so the
application is uninstrumented beyond what it already logs. Everything here is observation, and every
gap in it is named in `coverage.json` rather than left as silence.

One run directory looks the same whichever tracer wrote it: the **artifact contract is shared**, the
**capture layer is not**. Everything in this skill that is contract holds everywhere; everything that
depends on the target's runtime is marked as such and is resolved from the run itself in step 0.

## Delegation

- These instructions apply only to the root agent. If you were spawned to inspect a run, skip this
  section, never spawn subagents, and perform the Workflow directly.
- Delegate when the investigation spans many requests, compares runs, or benefits from retained
  context across follow-ups. Inspect directly when the question is narrow.
- When delegating, reuse an existing responsive inspector before spawning a new one. Pass the run
  path, the exact question, and this skill path.
- Do not let delegation block the answer. The root agent owns the final diagnosis.

## 0. Identify the tracer and the target — before reading anything else

The run says which tool wrote it and which backend it traced. Never assume from the folder name.

```bash
jq '{service, target: .target.key, project: .target.project, command: .target.command,
     repo: .target.repo, instrumentation: .instrumentation.home}' <run>/meta.json
```

- `target.command` is the decisive field: `dotnet` means a .NET target, `node` a Node one.
- `instrumentation.home` points **inside the tracer repo that wrote the run** — that is where the
  target's limitations doc and artifact contract live.
- `meta.json` may legitimately be absent (see **Technique**); `index.json` `run.target`, `service`
  and `coverage.json` `spans.byScope` answer the same question from a run that never finished.

Known tracers at the time of writing:

| Tracer repo | Target | Runtime | Span scopes to expect | CLI |
| --- | --- | --- | --- | --- |
| `~/playgrounds/iwx-tracer` | `inspectionworx-api` (InspectionWorx API) | .NET, ASP.NET Core, EF Core / Npgsql, Hangfire | `Microsoft.AspNetCore`, `OpenTelemetry.Instrumentation.EntityFrameworkCore`, `Npgsql`, `System.Net.Http` | `node bin/iwx-tracer.mjs` |
| `~/playgrounds/clubmatch-tracer` | `clubmatch-api` (ClubMatch backend) | Node 18+, Fastify, MongoDB / Mongoose, Redis / BullMQ | `@opentelemetry/instrumentation-http`, `-fastify`, `-mongodb`, `-mongoose`, `-ioredis`, `-redis` | `node bin/clubmatch-tracer.mjs` |

A run from a tracer not in that table is still readable: the contract is the same. Read its repo's
`docs/*-artifact-contract.md` and `docs/*-limitations.md` before treating any absence as a finding.

**Limitation numbers are per-repo and do not match across tracers.** `L2` in `iwx-tracer` is the
log-coverage limitation; in `clubmatch-tracer` that is `L1`. Cite limitations by **name and file
path**, never by bare number, and read the file in the tracer repo the run came from.

## Read in this order. Do not skip step 2.

1. **`index.json`** — the front door. `headline` gives the run in one object; `readingOrder`
   restates this list with the run's own words.
2. **`coverage.json`** — **how much to trust the run.** Read before drawing any conclusion.
   - `state` — `complete` or `partial`. **Capture, not the backend's health.** A backend that
     aborted on startup still yields `complete`, because everything it wrote was captured;
     `exitCode` travels beside it so the two are never confused. Ctrl+C and `--duration` are
     `partial` by design.
   - `logs.partial` — lines that could not be parsed as JSON, kept raw. Non-zero is normal (MSBuild
     output on .NET, startup banners and `process.stdout` writes on Node), and is where a build
     failure hides. On a target whose logging is unstructured, *most* records are partial and that
     is the contract working, not failing.
   - `correlation.traceIdsMissingFromTraces` — logs referencing spans the Collector never got. Any
     conclusion drawn by joining the two is incomplete by that much.
   - `correlation.serverTraceIdsMissingFromLogs` — the reverse: a request served whose log output
     never arrived. Evidence of dropped **logs**, not dropped spans. On a target whose log lines
     carry no request id at all this equals the request count and means only that — see
     **Correlating**.
   - `spans.present` vs `spans.expected` — "no spans collected" and "spans never attempted" are
     different answers. Never conflate them.
   - `spans.byScope` — an instrumentation that should be there and is not shows up as a missing
     scope. Compare against the scope list for this target in step 0.
   - `logging.measured` — `false` (or `silentRatio: null`) means the silence metric could not be
     computed, not that nothing was silent.
3. **`journey.json`** — the deliverable, organised **per request**. Usually answers the question
   without opening anything else. Carries `summary`, `silenceRanking` and `queryRanking`.
4. Only then `application.log`, `spans.jsonl`, `traces.json`, `runtime.jsonl`.

## Structure

```
runs/<runId>/
  index.json coverage.json journey.json meta.json
  application.log    JSONL  one record per backend log line
  spans.jsonl        JSONL  one span per line - grep and jq THIS
  traces.json        JSON   OTel spans as the Collector exported them (authoritative)
  runtime.jsonl      JSONL  periodic process samples
  otel-logs/         the instrumentation's own diagnostics, for a run with no spans
```

`journey.json` and `index.json` are **derived** — pure functions of the other files, regenerable
with the tracer's `finalize` command (`make finalize` in its repo). **If either disagrees with the
files it summarises, the files win.**

Each `journey.requests[]` entry carries `source` (`logs` | `span-only`) and `routed`. A
**`span-only`** entry is a request that reached the server but wrote no log line the tracer could
attribute. Two different causes, and they are not read the same way:

- **A few span-only entries among logged ones** — the framework short-circuited before its request
  logging ran. In practice a Swagger UI or static asset. When the framework matched no route,
  `routed: false`.
- **Every entry span-only, `requestId: null` throughout** — the target's log lines carry no request
  id at all, so nothing can be attributed. That is a property of the target and of the tracer's
  correlation shim, not evidence that the requests were silent. Check
  `coverage.correlation.withRequestId` before saying anything about logging.

**Unrouted requests are excluded from every silence figure**, so `silentRatio` measures endpoints
rather than static assets; `summary.spanOnly` counts them and `summary.requests` does not.

Each `journey.requests[]` entry: `requestId`, `traceId`, `connectionId`, `method`, `path`,
`statusCode`, `elapsedMs`, `route`, `startedAt`, `endedAt`, `outcome`
(`ok` | `client-error` | `server-error` | `unknown`), `incomplete`, ordered `logs`, `exceptions`,
`spans` as a **tree**, `spanCount`, `spansExpected`, `queries` (see **Repeated queries** below), and
`runtime`.

## Correlating

- **`requestId` is the spine**, not `traceId`. Journeys are keyed on it deliberately: it is the
  framework's own per-request identity and is on every request-scoped log line, whereas `traceId`
  is absent whenever spans were not collected. Journeys therefore still work on a logs-only run.
- **`traceId` is the only join** from a log line to its span in `traces.json` / `spans.jsonl`. Never
  invent a correlation; every join key is nullable and `null` means the framework gave nothing.
- **Some keys are permanently null on some targets, by contract.** On the Fastify target
  `connectionId` is always null (Fastify has no connection-scoped identity), and so are `eventId`
  and `template` (ASP.NET structured-logging ideas with no Node counterpart). The key is present
  because the contract requires it, not because a value may appear later. A permanently-null field
  is never a finding — check the target's limitations doc before reporting one.
- **`runtime.jsonl` has no join keys at all** — sampled externally, correlated by `timestamp` only.
  `cpu.percent` is a rate, so it is `null` on the first sample of a process.
- Records with neither key are startup and shutdown lines. Expected, not a fault —
  `coverage.correlation.withNeither` counts them.
- Where the target logs structurally, `template` + `state` are kept separate from `message` so you
  can group every occurrence of one log statement without string-matching rendered text. Prefer
  grouping on `template` when it is populated.

## The silence metric

`journey.summary.silent` / `silentDoingRealWork` / `silentRatio`, ranked in
`journey.silenceRanking`: requests the backend served **without writing a log line**. This is the
backend counterpart to `inspect-iwx-mobile-trace`'s blind-spot metric.

**A high ratio is usually not a finding.** See **Known omissions** below: on these targets the
business layer is effectively silent by design, so most successful requests log nothing. Use the
ranking to notice a request that did substantial work — high `elapsedMs` or `spanCount` — and left
no account of *why*. That is where an unexplained decision hides.

**`silentRatio: null` / `logging.measured: false` means not measured.** No log line in the run
carried a request id, so the metric would be a fact about the tracer, not the target. Report it as
unmeasured. Never round it to 0% (which credits the target with logging it may not do) or to 100%
(which blames it for a tracer gap).

## Known omissions — absences that are not evidence of absence

Every tracer in the family states these in `docs/*-limitations.md` in its own repo, under its own
numbering. Read that file for the run you are inspecting; do not diagnose around these without
saying so.

- **The tracer improves log legibility, not log coverage.** No external tool can log a decision the
  application never made a log call for. Both targets log sparsely — InspectionWorx has ~36 log
  calls across 467 files, with 2 of 145 business-layer files logging at all; the ClubMatch backend
  runs Fastify with `logger: false` and logs through unstructured `console.*`. **A sparse
  `application.log` is an accurate report, not a tracer fault.** Check `coverage.json` first.
- **Spans need Docker and the vendored instrumentation** (the CLR profiler under
  `vendor/otel-dotnet-auto`, or the OTel Node packages under `vendor/otel-node`). Either missing
  degrades the run to logs-only rather than failing it. `spans.expected` is how you tell, and
  `meta.collector.reachable` / `meta.instrumentation.usable` say which half was absent. Docker being
  down also takes the target's own database container with it, so the backend then fails to start
  for an unrelated reason — two failures, one cause.
- **A silently disabled instrumentation looks like silence.** If one fails to patch, its spans
  simply do not appear. `spans.byScope` against step 0's expected list is the only guard.
- **Spans from the very end of a run can be lost.** Nothing flushes the span batcher when the target
  is signalled — installing a shutdown hook would change how the application exits. A run stopped
  abruptly may be short a few spans at the tail, and nothing in the artifacts says which.
- **Derived artifacts can go stale.** `journey.json` and `index.json` are regenerated, not live. On
  any disagreement, trust `application.log` and `traces.json`.
- **Local targets only.** Every tracer in the family refuses anything but a local backend by design.

## Repeated queries — the N+1 signal

`journey.requests[].queries` is `{ total, distinct, repeated: [{ statement, count }] }`, and
`journey.queryRanking` ranks requests by **repetition** (`total - distinct`), not by query volume.
`diagnose` prints it under "repeated database queries".

- **Repetition is the defect, volume is not.** An endpoint issuing twenty distinct queries is doing
  twenty things. One issuing twenty of the same query is doing one thing badly — usually a lookup
  inside a loop over rows the caller already had.
- **A round trip is counted once.** Where two instrumentations both see one call, the inner span
  carrying an identical statement is not counted twice: EF Core over Npgsql on .NET, Mongoose over
  the MongoDB driver on Node. So `queries.total` is round trips, and is smaller than the number of
  spans carrying a statement. That de-duplication rule was written against EF Core/Npgsql; on the
  Mongo side it is not yet confirmed against a real N+1, so **if counts ever look doubled, look
  here first**.
- **Not every counted round trip is SQL.** On the Node target Redis/ioredis statements are round
  trips too and appear in these counts. Repeated cache `get`s on one request are still worth
  noticing, but say which store they hit.
- **`SAVEPOINT` / `COMMIT` are EF's transaction control**, not an N+1. They are round trips, so they
  appear honestly in the counts. Do not report one as a defect.
- Statements are grouped byte-for-byte as the Collector wrote them, already literal-stripped. Two
  statements differing only in whitespace group separately — that is deliberate, not a bug.
- Empty on a logs-only run, like `silenceRanking`.

**A finding here is a claim about the target backend, not about the run.** Any fix belongs in that
backend's repo under its own plan.

## Runtime per request

`journey.requests[].runtime` is `{samples, cpuPercentPeak, workingSetDeltaBytes}`.

**`samples: 0` is the normal answer, not a gap in the capture.** Sampling is every 2s against
requests of 1–300ms, so most requests contain no sample at all. Nothing is interpolated and no
nearest sample is substituted, so a null here means "not measured", never "zero". Do not report a
request as cheap because its runtime block is empty. To actually measure one, re-run with a lower
`--sample-interval`. Heap, GC and event-loop figures are absent by design — they are not observable
from outside the process — so their absence is never a finding either.

## Joining to a caller's run

**First check whether this target returns its request id to callers.** The InspectionWorx API
returns it as the **`X-Request-Id`** response header, so any caller that captured response headers
holds an exact key into this run's `journey.requests[]`. The ClubMatch backend does **not** emit
that header today, so only the heuristic join below applies there. Confirm before claiming an exact
join — grep the target repo rather than assuming.

When the header is present:

- **`inspect-iwx-mobile-trace` runs** — the id is already on the journey step, at
  `journey.steps[].apis[].backendRequestId`; there is no second file to open. Read that run's
  `coverage.backendJoin.state` first (`exact` | `mixed` | `heuristic`): on a `mixed` run only some
  calls carry it, and only those join exactly. The raw header is still in its `apis/*.json` as
  `response.headers["x-request-id"]` if you need to see it.
- **`iwx` CLI runs** — `call` and `replay` print it after the status as `[0HN…:0001]`, and `--json`
  carries it as `requestId`. Kept scenario files do not: `export` strips it, because it is a run
  fact rather than part of the contract.

Otherwise, fall back to the heuristic `(method, path, time window)` join — also the fallback when a
capture predates the header or a build omits it. It is close to unambiguous against a local backend
with one developer and degrades with concurrent traffic. **Say which of the two joins you used**, and
prefer this run's own `requestId` for any claim about what the backend did.

A caller's `traceId` is still `null` in these runs: no `traceparent` is injected, so nothing carries
the *caller's* journey id into the backend's. That direction is unbuilt, and none of the joins above
need it.

## Technique

- **Grep `spans.jsonl`, not `traces.json`.** One span per line, with `traceId`, `spanId`,
  `parentSpanId`, `scope`, `name`, `startedAt`, `endedAt`, `durationMs`, `dbStatement`,
  `httpMethod`, `httpPath`, `httpRoute` and `httpStatusCode` flat on it. `traces.json` is the
  Collector's own output — one nested batch per line — and remains authoritative if the two ever
  disagree, but it is not a file you can search. `spans.jsonl` is absent (not empty) on a logs-only
  run; `index.json` `telemetry.resource` holds the resource block, written once instead of thousands
  of times.

  ```bash
  jq -r 'select(.dbStatement) | "\(.durationMs)ms \(.scope) \(.dbStatement)"' <run>/spans.jsonl
  ```

- **`raw` is present only on `partial` records** (`schemaVersion` 2 and later). On a line that
  parsed, everything it held is already in `timestamp`, `level`, `category`, `eventId`, `message`,
  `template`, `state`, `exception` and the correlation ids — there is no second copy to fall back
  on, and none is needed. Runs captured before the change carry `schemaVersion: 1` and still have
  `raw` on every record; check the version before assuming either shape.
- Filter `application.log` by `level` first; `Error` and `Critical` records carry `exception` with a
  full stack trace, which usually names the failing file and line directly. On a target with no
  structured levels, read it as a stream instead:
  `jq -r '"\(.timestamp) [\(.stream)] \(.message)"' <run>/application.log`.
- Read `meta.json` to confirm which build this was: target path, git commit and branch, the
  environment overlay, exit code and `endReason`. **A dirty working tree (`target.repo.dirty`) means
  the binary matches no commit** — check before claiming a run predates or postdates a code change.
- **`meta.json` is the one file a run can legitimately lack.** It is written near the end of a
  trace, so a hard kill leaves a run without it whose derived artifacts `finalize` can still
  rebuild. `coverage.endReason` and `coverage.exitCode` are then both `null` — which means "this
  run never finished", **not** "it exited cleanly". Say the build is unknown rather than guessing
  it from the directory timestamp.
- `outcome: "server-error"` plus a non-empty `exceptions` array is the fastest path to a 5xx.
- The tracer's own `diagnose` command is read-only and safe to run against a finished run; it prints
  coverage, the silence ranking and the repeated-query ranking in one pass.

## Guardrails

- Run directories hold real captured data — request and response bodies on the InspectionWorx
  target, and database statements with their **real values** on both. Quote only what the diagnosis
  needs. Never paste bodies, statements, tokens or cookies into a doc or a chat.
- `runs/` is gitignored in every tracer repo. Never commit one.
- Keep the investigation read-only unless a fix is requested.
- Separate fact from inference. "No log line" means nothing was captured, which given the log-
  coverage limitation is usually not the same as nothing having happened.
- A 500 in a run may be caused by seeded or drifted **data** rather than by code. Read the exception
  before calling it a defect.

## Report

State concisely:

- which tracer and which target this run came from, and the target's commit
- what the backend did, per request, in order
- the decisive evidence, cited by artifact path and `requestId` (or `traceId` where the run has no
  request ids)
- root cause, or the narrowest hypothesis the evidence supports
- confidence, and which evidence is missing or degraded per `coverage.json`
- which expected paths this run did not exercise
- whether backend code, the caller, the data, or the trace itself needs action
