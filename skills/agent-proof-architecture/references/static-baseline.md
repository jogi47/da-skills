# Static baseline

The settings that should be on in every repo before any rule of its own is added. They cost a line of config each, and they catch the mistakes a narrow-context contributor makes most often: an unchecked `undefined`, a promise nobody awaits, a `switch` that misses a new case, a suppression with no reason, a check that only runs on one laptop.

[enforcement.md](enforcement.md) turns the five rules into guardrails. This file is the floor underneath them. `/correct` adds rules after a mistake has happened; this checklist is for switching on what should already be there.

Check the current documentation of a tool before changing its settings, because option names change between versions.

## Contents

- How to use it
- Any stack
- TypeScript and JavaScript
- .NET
- Python
- Dart and Flutter
- Turning a setting on over existing code
- Report format

## How to use it

- **Designing a new repo:** turn on every item marked *day one* in the stack's table. With no code yet, each one is free.
- **Auditing a repo:** check every item in "Any stack" and the stack's table. Record each as on, partly on (say where it is off) or off, with the file that shows it. An item that is on locally but not run in CI counts as partly on.
- **Fixing:** a setting that is off and finds nothing goes straight on. A setting that finds existing violations goes on with a ratchet (see the section below), never with a blanket disable.

Order the fixes by payoff: CI gating first (nothing else matters if it is not run), then compiler strictness, then type-aware lint, then the rest.

## Any stack

| Item | What "on" means | Day one |
|---|---|---|
| CI runs every static check | Typecheck, lint, format check, tests and the dead-code report run on every pull request, and the platform requires them to pass before merge. Git hooks are a convenience: they can be skipped, so they never count as the check. | yes |
| Warnings fail | Lint and compiler warnings fail the build (`--max-warnings 0`, warnings as errors), or the repo has no warning level at all. A warning nobody has to fix is ignored. | yes |
| Suppressions carry a reason | Every disable comment names the rule and gives a reason, and a lint rule rejects one without. Unused suppressions are errors too, so stale ones are removed. | yes |
| Generated files cannot drift | Migrations against the schema, a generated API client against its spec, a generated registry against its folders: CI regenerates and fails on a difference. | when the first generated file appears |
| Gated tests run somewhere | A suite skipped without an environment variable (database tests, integration tests) runs in at least one CI job. A test that never runs proves nothing. | when the first gated suite appears |
| Installs are reproducible | CI installs from the lockfile and fails if it would change (`pnpm install --frozen-lockfile`, `npm ci`, `dotnet restore --locked-mode`). | yes |
| One runtime version | The runtime version in the version file, the package engines field, the CI image and the type definitions agree. | yes |
| Inputs are parsed at the seams | Environment variables, request bodies and replies from other services are parsed with a schema at the point they enter, so the types inside are true. | yes |

## TypeScript and JavaScript

| Item | Setting | Day one |
|---|---|---|
| Strict compiler | `"strict": true` | yes |
| Index access may be missing | `"noUncheckedIndexedAccess": true` (an array or record lookup is `T \| undefined`) | yes |
| Optional means absent | `"exactOptionalPropertyTypes": true` | yes; ratchet on existing code, it is noisy |
| Overrides are marked | `"noImplicitOverride": true` | yes |
| No fall-through or missing returns | `"noFallthroughCasesInSwitch": true`, `"noImplicitReturns": true` | yes |
| Module syntax is explicit | `"verbatimModuleSyntax": true` (or `"isolatedModules": true` on older setups) | yes |
| Type-aware lint | typescript-eslint `strictTypeChecked` (or `recommendedTypeChecked` at least), with `parserOptions.projectService` | yes |
| Promises are handled | `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises` (both in the type-checked configs) | yes |
| Every case is handled | `@typescript-eslint/switch-exhaustiveness-check`, so adding a union member fails each `switch` that misses it | yes |
| No escape hatches without a reason | `@typescript-eslint/no-explicit-any` as an error; `@typescript-eslint/ban-ts-comment` with `allow-with-description` for `@ts-expect-error`, and `@ts-ignore` banned | yes |
| Disable comments need a reason | `@eslint-community/eslint-comments/require-description`, and `linterOptions.reportUnusedDisableDirectives: "error"` | yes |
| Formatting is checked | `prettier --check .` (or the formatter in use) in CI | yes |
| Dead code is reported | `knip` in CI | yes |

## .NET

| Item | Setting | Day one |
|---|---|---|
| Nullable reference types | `<Nullable>enable</Nullable>` in `Directory.Build.props` | yes |
| Warnings fail | `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`; any exclusion goes in `<WarningsNotAsErrors>` with a comment saying why | yes |
| Analysers on | `<AnalysisLevel>latest-recommended</AnalysisLevel>` (or `latest-all` with severities tuned in `.editorconfig`) | yes |
| Style enforced in the build | `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>`, with severities in `.editorconfig` | yes |
| Formatting is checked | `dotnet format --verify-no-changes` in CI | yes |
| Suppressions carry a reason | `[SuppressMessage(..., Justification = "...")]` or `#pragma warning disable <id> // reason` on the narrowest span; no file-wide or project-wide disables without review | yes |

## Python

| Item | Setting | Day one |
|---|---|---|
| Strict types | `mypy --strict`, or `pyright` in `strict` mode | yes |
| Lint | `ruff check` with a chosen rule set beyond the defaults (bugbear, pyupgrade, simplify at least) | yes |
| Formatting is checked | `ruff format --check` (or `black --check`) | yes |
| Suppressions carry a reason | `# type: ignore[code]` and `# noqa: CODE` always name the code; ruff's `PGH` rules reject blanket ones | yes |
| Dead code | `vulture` in CI | optional |

## Dart and Flutter

| Item | Setting | Day one |
|---|---|---|
| Strict analyser | In `analysis_options.yaml`, under `analyzer: language:`, set `strict-casts`, `strict-inference` and `strict-raw-types` to `true` | yes |
| A maintained lint set | `package:flutter_lints` or `package:lints/recommended.yaml` as the base, plus `unawaited_futures` and `discarded_futures` | yes |
| Infos fail | `flutter analyze --fatal-infos` (or `dart analyze --fatal-infos`) in CI | yes |
| Formatting is checked | `dart format --output=none --set-exit-if-changed .` | yes |

## Turning a setting on over existing code

A strict setting turned on over a large codebase finds hundreds of violations. Do not leave it off for that reason, and do not turn it on with blanket disables.

1. Turn it on, and count the violations.
2. Small count: fix them in the same change.
3. Large count: record a baseline the tool understands (ESLint bulk suppressions, a `betterer` result file, a `dependency-cruiser` known-violations file, a .NET `.editorconfig` severity scoped to the old folders), and fail only on new violations. Add a check that the baseline may only shrink.
4. For compiler flags that cannot be baselined per line, turn them on one package or project at a time, starting with the one that changes most.

## Report format

In an audit, add this section after "Already well guarded":

```markdown
### Static baseline

| Item | State | Evidence | Fix | Effort |
|------|-------|----------|-----|--------|
| CI runs every static check | partly on | `azure-pipelines.yml` runs lint and tests, not typecheck or `knip` | add both steps | small |
```

List only items that are off or partly on; name the items that are fully on in one line beneath the table.
