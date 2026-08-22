---
name: sq
description: "Swiss-army knife for querying databases (PostgreSQL, MySQL, SQLite, SQL Server, ClickHouse) and files (CSV, JSON, Excel). Use when: (1) Querying databases with sq's jq-like syntax or native SQL, (2) Working with multiple data sources simultaneously, (3) Converting between data formats (JSON, CSV, Excel, etc.), (4) Joining data across different databases or files, (5) Inspecting database schemas and table metadata."
---

# sq - Data Wrangler

Like sql+jq for databases and documents.

## Install

```bash
# macOS
brew install sq

# Linux
/bin/sh -c "$(curl -fsSL https://sq.io/install.sh)"

# Go
go install github.com/neilotoole/sq

# Docker
docker run -it ghcr.io/neilotoole/sq zsh
```

## Quick Reference

### Add Data Sources

```bash
# Database sources
sq add postgres://user:pass@localhost:5432/db
sq add mysql://user:pass@localhost:3306/db
sq add sqlserver://user:pass@localhost:1433/db
sq add sqlite3:///path/to/file.db
sq add clickhouse://user:pass@localhost:9000/db

# File sources
sq add --driver xlsx /path/to/file.xlsx
sq add --driver csv /path/to/file.csv
sq add --driver jsonl /path/to/file.jsonl

# From URL
sq add https://example.com/data.csv
```

### List & Inspect Sources

```bash
sq ls                    # List all sources
sq src @handle          # Set active source
sq src                  # Show active source
sq inspect @handle      # Show schema metadata
sq inspect @handle.table  # Show table metadata
sq ping @handle         # Test connection
sq rm @handle           # Remove source
```

### Query Data

```bash
# sq's jq-like syntax
sq '@handle.table | .column1, .column2 | .[0:10]'
sq '@handle.table | where(.id > 10) | .name'

# Native SQL
sq sql --src=@handle 'SELECT * FROM table LIMIT 10'

# With output format
sq '@handle.table' -j         # JSON
sq '@handle.table' -C          # CSV
sq '@handle.table' -x          # Excel
sq '@handle.table' --html      # HTML
sq '@handle.table' -y          # YAML
sq '@handle.table' --markdown  # Markdown
sq '@handle.table' --xml       # XML
sq '@handle.table' -r          # Raw bytes
```

### Cross-Source Joins

```bash
# Join tables within same source
sq '.actor | join(.film_actor, .actor_id) | join(.film, .film_id) | .first_name, .title'

# Join across different sources (CSV + Postgres + Excel)
sq '@pg1.table1, @excel1.sheet1 | join(.id) | .name, .email'
```

### Insert Query Results

```bash
# Insert results into another database table
sq '@src1.table1 | .col1, .col2' --insert=@dest.table2
# Create new table if not exists
sq '@csv.data' --insert=@postgres.new_table
```

### Table Commands

```bash
sq tbl copy @src.table @dest.table    # Copy table
sq tbl truncate @handle.table         # Truncate table
sq tbl drop @handle.table             # Drop table
```

### Diff

```bash
sq diff @src1 @src2           # Compare schema and row counts
sq diff --data @src1 @src2    # Compare row data
sq diff @src1.table1 @src2.table1  # Compare specific tables
```

### UNIX Pipes

```bash
# Pipe file content directly
cat ./file.xlsx | sq .Sheet1
cat ./data.csv | sq inspect
```

## Supported Drivers

| Driver     | Description                 |
| ---------- | --------------------------- |
| postgres   | PostgreSQL                  |
| mysql      | MySQL                       |
| sqlite3    | SQLite                      |
| sqlserver  | SQL Server / Azure SQL Edge |
| clickhouse | ClickHouse (beta)           |
| csv        | CSV files                   |
| tsv        | TSV files                   |
| json       | JSON files                  |
| jsona      | JSON Array (LF-delimited)   |
| jsonl      | JSON Lines                  |
| xlsx       | Excel XLSX                  |

## Handle Syntax

- `@handle` - reference a source
- `@handle.table` - reference a table
- `@handle."Sheet Name"` - reference Excel sheet with spaces (use quotes)
- `.[0:10]` - slice first 10 rows
- `where(.col > value)` - filter rows

## Output Formats

| Flag            | Format                     |
| --------------- | -------------------------- |
| `-t` / `-th`    | Text (with/without header) |
| `-j`            | JSON                       |
| `-A` / `-jsona` | JSON Array (LF-delimited)  |
| `-J` / `-jsonl` | JSON Lines                 |
| `-C` / `--csv`  | CSV                        |
| `--tsv`         | TSV                        |
| `-x` / `--xlsx` | Excel XLSX                 |
| `--html`        | HTML table                 |
| `-y` / `--yaml` | YAML                       |
| `--xml`         | XML                        |
| `--markdown`    | Markdown table             |
| `-r` / `--raw`  | Raw bytes                  |

## Current Sources

Run `sq ls` to see active sources:

- `@supabase` - PostgreSQL database
- `@BrainMo_Events_Mastersheet` - Excel file (10 sheets)

## Config Location

- Config: `~/.config/sq/`
- Logs: `~/Library/Logs/sq/`
