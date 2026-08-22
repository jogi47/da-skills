---
name: inspect-slidetrace
description: Inspect and diagnose SlideTrace recording folders containing session metadata, screenshots, interaction/timeline JSONL, browser console logs and objects, captured API traffic, and optional storage snapshots. Use when a user provides a local SlideTrace folder path and asks what happened, why UI behavior occurred, whether a fix was active, or for evidence-backed debugging.
---

# Inspect SlideTrace

Reconstruct the session from timestamps and raw evidence before diagnosing code.

## Delegation

- These delegation instructions apply only to the root agent. If you were spawned to inspect SlideTrace, skip this section, never spawn subagents, and perform the Workflow directly.
- Delegate when the investigation is large, chronology-heavy, compares multiple recordings, or benefits from retained context across follow-ups. Inspect directly when the question is narrow, only a few artifacts are relevant, subagents are unavailable, or delegation would add more latency than value.
- When delegating, check for an existing responsive `default` SlideTrace inspector first. Reuse it when prior trace context helps; send the new folder path and exact user question. Otherwise spawn at most one `default` inspector with isolated context (`fork_turns: none` when supported), passing the question, folder path, and this skill path.
- Wait for one reasonable bounded interval. If the inspector stalls, times out, is interrupted, or returns insufficient evidence, proceed with direct inspection. Do not repeatedly poll or let delegation block the answer.
- Avoid duplicating a healthy inspector's full raw investigation. The root agent may inspect targeted artifacts to resolve ambiguity, validate decisive evidence, or continue after fallback, and always owns the final diagnosis.

## Workflow

1. Resolve the supplied folder and inventory it with `rg --files`. Request filesystem approval when required.
2. Read `session.json` first. Record start/end timestamps and origin folders.
3. Correlate, in timestamp order:
   - `*_interactions.jsonl` for clicks, typing, and navigation
   - screenshots for visible state; inspect relevant images with `view_image`
   - API captures for request URLs, query parameters, status, and narrowly selected response fields
   - `*_console.jsonl` and timeline logs for application state and errors
   - `logs/objects/` when console entries reference expanded objects
   - `storage/initial.json` and `storage/indexeddb/` when persistence, Undo/Redo, sync, offline, queued-action, or stale-state behaviour matters
4. Use `jq` and targeted `rg` patterns. Inspect keys before values. Avoid broad output from large JSON/JSONL files.
5. Separate facts from inference. Distinguish automatic UI changes from user clicks, reloads, navigation, and hot updates.
6. Verify chronology before claiming a trace predates code. Compare UTC recording timestamps with source/build/runtime timestamps; a source mtime alone does not prove the browser loaded that code.
7. If code diagnosis is requested, trace the relevant implementation only after establishing recording facts. Reproduce the captured data shape in a regression test before changing behavior.

## Guardrails

- Do not expose authorization headers, tokens, cookies, or unrelated personal data.
- Do not recommend new accounts or data resets without evidence.
- Treat screenshots plus interaction/API timestamps as stronger evidence than appearance alone.
- Use video transcription only for actual video/audio. Inspect ordinary SlideTrace JSON and screenshots directly.
- Keep investigation read-only unless the user asks for a fix.
- Inspect storage conditionally and narrowly; it may contain unrelated user state.

## Report

State concisely:

- what happened and when
- decisive evidence
- root cause or narrowest supported hypothesis
- confidence and any missing evidence
- which expected scenarios the recording did not exercise
- whether code, cached runtime, or account data needs action
