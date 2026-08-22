---
name: inspect-teacher-trace
description: Inspect and diagnose teacher-helper telemetry run folders containing logs, spans, outbound interactions, inbound API exchanges, runtime samples, coverage, indexes, and journeys. Use for evidence-backed application behavior, request/span correlation, timing, warnings or errors, payload completeness, process attribution, partial-run health, or comparison with another run.
---

# Inspect Teacher Trace

Reconstruct a teacher-helper run from its normalized evidence before diagnosing application behavior. Keep this workflow generic: it applies to any backend or service run, not only timetable extraction.

## Workflow

1. Resolve the supplied run directory and inventory it with `rg --files`. Confirm it is the intended run before reading data. Use the CLI repository at `/Users/jogimac/playgrounds/teacher-helper` when it is not installed as `teacher-helper`.

2. Generate the bounded read-only diagnostics report first:

   ```bash
   cd /Users/jogimac/playgrounds/teacher-helper
   node bin/teacher-helper.mjs trace-diagnostics --run /path/to/run
   ```

   For a reusable report, add `--output /tmp/trace-diagnostics.json`. For a comparison, add `--baseline /path/to/older-run`; compare aggregate metrics only, never IDs, timestamps, or line numbers.

   Read bounded summaries rather than dumping record arrays:

   ```bash
   jq '{status,runHealth,applicationLogs:(.applicationLogs | {total,levels,services}),correlation:.correlation.summary,journeys:(.journeys | {total,included,omitted}),timing:(.timing | {run,inboundRequests,server,interactions,external,database,internalStages}),runtime:(.runtime | del(.health.records)),errors:(.errors | {total,categories,attribution}),capture:(.capture | del(.unmatchedExternal.records))}' /tmp/trace-diagnostics.json
   ```

3. Establish run health before interpreting behavior. The eight derived artifacts are:
   `application.log`, `traces.json`, `interactions.jsonl`, `requests.jsonl`, `runtime.jsonl`, `coverage.json`, `index.json`, and `journey.json`.

   The first five are newline-delimited JSON streams; `traces.json` is not one JSON document. The final three are JSON documents.

   - `complete`: all eight are readable and `coverage.json` reports `state: "complete"`.
   - `partial`: an artifact is missing/invalid, finalization is incomplete, or `.capture/` shards remain. Report the exact gap.
   - `not_observable`: the report contains no observable logs, spans, or interactions; consult `runHealth` separately for artifact/finalization gaps.
   - Invalid or unreadable paths are command errors, not application findings.

   Empty streams can be valid when no matching work occurred. Do not call that a failure without corroborating evidence.

   If `runHealth.finalizationState` is not `"complete"` or `runHealth.captureShards` is `"present"`, treat the run as live or incompletely flushed. Pause behavioral diagnosis and ask the user to stop the backend/trace process gracefully, wait for telemetry finalization, then rerun the diagnostics command against the same directory. Never kill processes or edit the run directory yourself. If finalization is complete but an artifact is missing or corrupt, report the static gap instead of asking for a backend stop.

4. Read the application timeline from `application.log`. Use targeted `jq`/`rg`, not a full dump. For each decisive record retain its source line, UTC timestamp, service, stream, level, message, `data.event`, and any `traceId`, `spanId`, or `requestId`. Summarize level/service/event counts before drilling into individual records.

5. Assess correlation using the diagnostics report and raw references:

   - Prefer `requestId` when it is present.
   - Use `traceId` to group a trace; make a request-level claim only when that trace contains one request context.
   - Treat multiple request IDs in one trace as `ambiguous`.
   - Treat records with neither usable identifier as `unavailable`.

   Report exact, trace-only, ambiguous, and unavailable counts separately. Use `journeys.records` to connect logs, interactions, spans, and database evidence; source lines and span coordinates remain the authoritative lookup keys.

   For inbound API coverage, use `inboundApiCapture.preflightRequests` and `inboundApiCapture.applicationCorrelation`; report `OPTIONS` separately from application methods. CORS preflight requests often have no application span and must not obscure correlation for `GET`, `POST`, and other workload methods. Never call a request sampled merely because it has a capture record; require a trace/span identifier.

6. Reconstruct request journeys in timestamp order. Inspect the bounded `journeys` section, then open only the referenced raw records. Distinguish user interactions, application logs, outbound calls, database spans, and warnings/errors. Do not infer an internal stage that was not emitted.

7. Read timing as observable timing only. Use `timing.run`, `timing.journeys`, `timing.inboundRequests`, `timing.server`, `timing.interactions`, `timing.external`, and `timing.database`. Treat `timing.internalStages` as unavailable unless spans or application logs explicitly emitted those boundaries. Explain clock or missing-endpoint limitations instead of inventing durations.

8. Classify failures from `errors.records` and `errors.categories` (for example HTTP, transport, database, or application). Check each record's `attribution`: `proven`, `heuristic`, or `unattributed`. Proximity is not proof; state the evidence supporting any causal claim. Include warnings when they affect capture or interpretation.

9. Check capture quality in `capture` and `coverage.json`: inbound and outbound body status, truncation or unsupported captures, deduplication, instrumentation scopes, write failures, unmatched external spans, and leftover `.capture/` shards. A missing interaction is a capture-quality finding only when the run exercised the corresponding instrumented operation.

   - Treat `captured-binary` with `encoding: "base64"` as lossless binary capture. Verify DOCX and other archive-based MIME types this way.
   - Distinguish size truncation from `partial` streaming responses. If `partial` records are aborted SSE or other streams, report that explicitly.
   - Check local Collector exporter recursion by matching the configured local collector host and port, normally `127.0.0.1:4318` or `localhost:4318`. Do not classify hosted endpoints such as Langfuse `/v1/traces` as local exporter recursion.
   - Inspect `externalCommunication.uncaptured.records`. A payload interaction may exist but fail span matching; report that as correlation/matching debt, not absent payload evidence.

10. Inspect runtime attribution. Use `runtime.workloadProcesses`, `runtime.auxiliaryProcesses`, `runtime.attribution`, and `runtime.pidCoverage`. Treat top-level maxima as workload-only when attribution is exact; compare with `runtime.allProcesses` to expose compiler, preload, or watcher pressure without blaming request-serving processes. If attribution is partial or unavailable, state that limitation.

11. Inspect raw files selectively. Start with JSON keys and counts, then use exact event/request/trace IDs and line or coordinate references. `teacher-helper logs --run /path/to/run` is the optional lnav view. Keep the run directory and backend source read-only unless the user explicitly requests a change.

## Evidence rules

- Separate observed facts, supported hypotheses, and unknowns.
- Use UTC chronology; do not use filesystem mtime as proof of runtime code.
- Preserve the eight artifacts as the source of truth; the diagnostics report is a bounded index, not a replacement.
- Do not expose raw authorization headers, cookies, credentials, or unrelated bodies in a report.
- Do not infer application stages, request ownership, or causality from absence or timestamp proximity alone.
- Do not turn a trace-reading task into a backend or product-code change. If code diagnosis is requested, inspect implementation only after establishing the trace facts and reproduce the captured shape in a regression test before editing.

## Report format

Return a concise, evidence-backed report with:

- what happened and when;
- run health and exact artifact gaps;
- decisive evidence with file + line/coordinate references;
- correlation quality and the reconstructed timeline;
- inbound request/response and external payload completeness;
- observable timing, warnings, errors, and capture limitations;
- workload versus auxiliary runtime pressure;
- narrowest supported root cause or hypothesis, with confidence;
- scenarios the run did not exercise or evidence that is unavailable;
- next action, categorized as data, instrumentation, application code, or no action.
