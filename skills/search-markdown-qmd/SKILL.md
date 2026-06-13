---
name: search-markdown-qmd
description: Search local Markdown knowledge bases, documentation, and notes with QMD lexical, semantic, and hybrid retrieval. Use when the user asks to find information across Markdown files, search notes, query docs, retrieve a document by path/id, or set up QMD/MCP access for a Markdown corpus.
---

# Search Markdown With QMD

Use the `qmd` CLI by default. Use QMD MCP only when the user explicitly asks for MCP setup/use, or when MCP tools are already available and the CLI cannot be used.

## Prerequisite Check

1. Run `command -v qmd`.
2. If missing, tell the user QMD is required and ask whether to install it:
   - Requires Node.js/npm.
   - Install command: `npm install -g @tobilu/qmd`
3. If `npm` is missing, ask the user to install Node.js/npm first, or ask approval to install it with the platform package manager when available.
4. After install, run `qmd status` or `qmd collection list` before searching.

If CLI is missing but `mcp__qmd__*` tools are already available, ask whether to use MCP as a fallback. Do not pretend search is available when neither CLI nor MCP is configured.

## Setup A Corpus

When no collection exists, ask for the Markdown folder path, then run:

```bash
qmd collection add <markdown-folder> --name <collection-name>
qmd embed
```

Use short, descriptive collection names like `docs`, `notes`, or the project name. `qmd embed` may download local embedding/model assets once on the host; subsequent searches reuse them.

For MCP client setup or MCP fallback, read [mcp-setup.md](references/mcp-setup.md) only when needed.

## Query Strategy

Use the narrowest query type that fits:

| Need | Query type |
| --- | --- |
| Exact names, identifiers, phrases | `lex` |
| Natural-language concepts | `vec` |
| Unknown vocabulary | `expand` |
| Best recall | `lex` + `vec` |
| Expected answer shape is known | `hyde` |

Put the best query first because fusion gives it extra weight.

## CLI Usage

```bash
qmd query "how are refunds processed"
qmd query $'lex: refund handler\nvec: how are payment refunds processed'
qmd query $'expand: authentication session expiry'
qmd search '"rate limiter" burst'
qmd get "#abc123"
```

## MCP Fallback

Use the MCP tool that matches the search need. QMD MCP tools take a single `query` and optional `collection`.

Keyword search:

```json
{
  "query": "connection pool timeout",
  "collection": "docs",
  "limit": 10
}
```

Semantic search:

```json
{
  "query": "how are database connection timeouts handled",
  "collection": "docs",
  "limit": 10
}
```

Deep search:

```json
{
  "query": "find the docs that explain rate limiter burst behavior and timeout tradeoffs",
  "collection": "docs",
  "limit": 10
}
```

Use `search` for exact terms, `vector_search` for semantic questions, and `deep_search` for broader context gathering. If MCP does not expose document retrieval by path/id, fall back to the CLI `qmd get`.

## Search Rules

- Use `lex` for code identifiers, exact phrases, filenames, and product names.
- Use `vec` for conceptual questions.
- Use `hyde` with a 50-100 word hypothetical answer when the user describes the answer shape.
- Use `expand` at most once per query set.
- If results are weak, refine with project terms, filenames, or known vocabulary from top hits.
