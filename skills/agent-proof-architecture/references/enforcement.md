# Enforcement by stack

Ways to turn each rule into a guardrail that fails. Pick the cheapest one the repo can already run. Check the current documentation of any tool before adding it, because options change between versions.

## Contents

- Any stack
- TypeScript and JavaScript
- .NET
- Python
- Dart and Flutter
- Databases

## Any stack

- **Architecture tests.** A plain test that walks the source tree and asserts a rule ("no file under `features/*/` imports another feature's `internal/`"). It needs no new tool, runs with the normal test command and can carry a full teaching message.
- **Generated registries with a drift check.** When a central list cannot be avoided, generate it from the owned folders and add a CI step that regenerates it and fails if the result differs from the committed file.
- **Ratchets for existing violations.** Record today's violations as a baseline and fail only on new ones. Many tools support this directly (see below); otherwise store a count or a list in the repo and compare in the architecture test.
- **CODEOWNERS (or the platform's equivalent required reviewers).** Put the guardrail config, the exceptions file and any remaining shared roots under architecture review.
- **Dead-code reports.** Contributors leave code whose callers they cannot see. A tool that lists unused exports, files and dependencies makes removal safe.

## TypeScript and JavaScript

| Rule | Guardrail options |
|---|---|
| 2. Forbidden dependencies | `dependency-cruiser` `forbidden` rules (each rule has a `comment` shown on failure). ESLint `no-restricted-imports` with `patterns` and a custom `message`. `eslint-plugin-boundaries` for element types and allowed directions. A package's `exports` field in `package.json` to hide internals. pnpm's strict `node_modules`, so a workspace package can import only what it declares. TypeScript project references to make layers separate compile units. |
| 3. Single writer | Export the write commands only from the owning module, and let an import rule allow the table, store or client write API only inside that module (for example only `**/*.repository.ts` may import the Drizzle or Prisma table objects for writes). Export read-only types (`Readonly<T>`, `ReadonlyArray<T>`) to everyone else. |
| 4. Discovery over shared roots | File-based routing (TanStack Router, React Router framework mode, Next.js, Remix). Vite `import.meta.glob('./features/*/entry.ts', { eager: true })`. A small codegen script that writes the registry, plus the drift check. |
| 5. Exceptions and ratchets | `// eslint-disable-next-line <rule> -- <reason>` (the `--` reason is part of the syntax). ESLint bulk suppressions file for baselines in recent ESLint 9 releases. `dependency-cruiser` known-violations baseline. `betterer` for general ratchets. |
| Dead code | `knip` for unused files, exports and dependencies. |

## .NET

| Rule | Guardrail options |
|---|---|
| 2. Forbidden dependencies | Project references (a project cannot use what it does not reference). `internal` visibility, with `InternalsVisibleTo` only for the test project. Architecture tests with NetArchTest or ArchUnitNET. `Microsoft.CodeAnalysis.BannedApiAnalyzers` with a `BannedSymbols.txt` whose entries carry the message to show. |
| 3. Single writer | One `DbContext` (or one repository) per aggregate owns writes; other projects get a read model or a query interface. Private setters and methods on entities so state changes only through named methods. |
| 4. Discovery over shared roots | Assembly scanning to register handlers, endpoints and validators (for example MediatR or a convention-based endpoint module interface), instead of a central registration list. Source generators where reflection is not wanted. |
| 5. Exceptions | `#pragma warning disable <id> // reason` on the narrowest span, or `[SuppressMessage(..., Justification = "...")]`. Keep `.editorconfig` severities and the banned-symbols file under architecture review. |

## Python

| Rule | Guardrail options |
|---|---|
| 2. Forbidden dependencies | `import-linter` contracts: layers, forbidden imports and independence between features. |
| 3. Single writer | One service module owns writes to each table; enforce with an `import-linter` forbidden contract on the ORM models' write paths, or database permissions. |
| 4. Discovery | Entry points in `pyproject.toml`, or `pkgutil` and `importlib` scanning of a features package. |
| Dead code | `vulture`. |

## Dart and Flutter

| Rule | Guardrail options |
|---|---|
| 2. Forbidden dependencies | Keep internals under `lib/src/` and export only the public API from the package's top-level library. Split layers into separate packages in a workspace so imports need a declared dependency. Add an import-rule lint (a `custom_lint` rule or an import-lint package) for rules within one package. |
| 3. Single writer | One notifier, bloc or repository owns each piece of state and exposes named methods; widgets never write the underlying store directly. |
| 4. Discovery | `build_runner` code generation for route tables and registries, with the drift check in CI. |

## Databases

Database rules hold no matter which code path, script or person touches the data, so they are the strongest single-writer guardrail.

- Give each service or worker its own database role, and grant `INSERT`, `UPDATE` and `DELETE` only on the tables it owns.
- Use triggers or check constraints for invariants that must never break (for example "a submitted record is read-only").
- Raise errors with a message that names the rule and the correct path, the same as any other guardrail.
- Keep migrations as the only writer of schema, and fail CI when the schema and the migrations drift apart.
