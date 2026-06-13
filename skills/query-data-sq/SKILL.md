---
name: query-data-sq
description: Query, inspect, join, convert, and export databases and data files with the sq CLI. Use when the user asks to work with PostgreSQL, MySQL, SQLite, SQL Server, ClickHouse, CSV, TSV, JSON, JSONL, or Excel data from the terminal, including schema inspection, native SQL, cross-source joins, and format conversion.
---

# Query Data With sq

Use `sq` for terminal data work across databases and files.

## Prerequisite Check

1. Run `command -v sq`.
2. If missing, tell the user `sq` is required and ask whether to install it.
3. Prefer the install method available on the host:
   - Linux/macOS install script: `/bin/sh -c "$(curl -fsSL https://sq.io/install.sh)"`
   - Go: `go install github.com/neilotoole/sq@latest`
   - Docker: `docker run -it ghcr.io/neilotoole/sq zsh`
4. If no install method is available, ask the user to install Go or Docker, or follow the sq install script manually.
5. After install, run `sq --help` or `sq version`.

Do not assume any preconfigured sources exist on another machine.

## Add Sources

Database sources:

```bash
sq add postgres://user:pass@localhost:5432/db
sq add mysql://user:pass@localhost:3306/db
sq add sqlserver://user:pass@localhost:1433/db
sq add sqlite3:///path/to/file.db
sq add clickhouse://user:pass@localhost:9000/db
```

File sources:

```bash
sq add --driver xlsx /path/to/file.xlsx
sq add --driver csv /path/to/file.csv
sq add --driver jsonl /path/to/file.jsonl
sq add https://example.com/data.csv
```

Ask before storing credentials in sq config. Prefer password prompts or environment-specific connection strings when appropriate.

## Inspect Sources

```bash
sq ls
sq src @handle
sq src
sq inspect @handle
sq inspect @handle.table
sq ping @handle
sq rm @handle
```

## Query Data

sq expression syntax:

```bash
sq '@handle.table | .column1, .column2 | .[0:10]'
sq '@handle.table | where(.id > 10) | .name'
```

Native SQL:

```bash
sq sql --src=@handle 'SELECT * FROM table LIMIT 10'
```

Output formats:

```bash
sq '@handle.table' --json
sq '@handle.table' --csv
sq '@handle.table' --xlsx
sq '@handle.table' --html
sq '@handle.table' --yaml
sq '@handle.table' --markdown
sq '@handle.table' --xml
sq '@handle.table' --raw
```

## Join, Copy, Diff

```bash
sq '.actor | join(.film_actor, .actor_id) | join(.film, .film_id) | .first_name, .title'
sq '@pg.table1, @excel.sheet1 | join(.id) | .name, .email'
sq '@src.table | .col1, .col2' --insert=@dest.new_table
sq tbl copy @src.table @dest.table
sq tbl truncate @handle.table
sq tbl drop @handle.table
sq diff @src1 @src2
sq diff --data @src1 @src2
```

Confirm before destructive commands such as `truncate`, `drop`, overwrites, or inserts into production-like databases.

## Handle Syntax

- `@handle`: source.
- `@handle.table`: table.
- `@handle."Sheet Name"`: Excel sheet with spaces.
- `.[0:10]`: first 10 rows.
- `where(.col > value)`: filter rows.

## Safety

- Inspect schema before writing queries against unknown data.
- Redact credentials from output.
- Prefer read-only queries unless the user explicitly asks for mutation/export.
- Use `--markdown`, `--csv`, or compact JSON for final-friendly output.
