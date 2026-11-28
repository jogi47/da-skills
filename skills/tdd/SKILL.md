---
name: tdd
description: Test-driven development as a red → green loop, with refactoring left to a later cleanup pass. Use when the user wants to build features or fix bugs test-first, mentions TDD or "red-green-refactor", or wants integration tests.
---

# Test-Driven Development

TDD is the red → green loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns, the rules of the loop and when it is done.

When exploring the codebase, read `GLOSSARY.md` (if it exists) so test names and interface vocabulary match the project's domain language, and respect ADRs in the area you're touching. Put test files where the repo's own rules say (a central test folder, beside the source, a naming pattern); when the rules are silent, follow the existing tests.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: "user can checkout with valid cart" tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

**Name the seams before the first test.** You can't test everything, so choosing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case. Write the seams under test into the plan (or the first message, when there is no plan), each with a one-line note on what it catches and what it misses.

- When the plan is approved, or the seam is obvious (the function or endpoint the task names, the public entry point the bug comes through), go ahead.
- Ask the user only when the choice is genuinely open: several plausible public interfaces, or a seam that would need a new interface to exist.

When the shape of that interface is itself in question (how deep the module is, where the seam belongs, what the interface should expose), call the Skill tool with "codebase-design" for the vocabulary. It is the shared source of the module, interface, depth, seam, adapter, leverage and locality terms, and it is a reference to consult, not a session to run.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **Red for the right reason.** Run the test and read the failure. It must fail on its assertion, showing the missing or wrong behavior. A failure from an import error, a typo, a missing fixture or a test that never ran is not red: fix the test until it fails for the reason you expect.
- **Green, then the neighbours.** Run the test and watch it pass, then run the tests around the code you touched, so the slice did not break something next to it.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** Minimal code is allowed to be rough while the loop runs. Tidy it in a separate pass once the slices are green, with the tests unchanged and still green (the `simplify` skill does this pass), before the work is called finished.

## Fixing a bug

The same loop, with the first test fixed by the bug:

1. Reproduce the bug as a failing test at the seam the bug comes through, using the input from the report. Red must show the wrong behavior the user saw, not a different failure.
2. If you cannot make it fail, you have not found the bug yet: keep diagnosing (the `diagnosing-bugs` skill) before changing code.
3. Make the smallest fix that turns it green, then run the neighbours.
4. Keep the test. It is the regression guard.

## When the loop is done

- Every agreed seam has at least one test that was seen red for the right reason and is now green.
- The tidy pass is done and the tests are still green.
- The full suite for the touched area passes once at the end.
- No skipped, focused (`.only`) or commented-out tests are left behind.
