# QMD MCP Setup

Use this only when the user asks to configure QMD as an MCP server or explicitly wants MCP instead of the default CLI workflow.

## Install

```bash
npm install -g @tobilu/qmd
qmd collection add <markdown-folder> --name <collection-name>
qmd embed
```

If `npm` is missing, ask the user to install Node.js/npm first, or ask approval to install it with the platform package manager when available.

## MCP Command

Use this server command:

```json
{
  "command": "qmd",
  "args": ["mcp"]
}
```

## HTTP Mode

```bash
qmd mcp --http
qmd mcp --http --daemon
qmd mcp stop
```

Default HTTP port: `8181`.

## Tools

| Tool | Use |
| --- | --- |
| `search` | Keyword search with `query`, optional `collection`, optional `limit` |
| `vector_search` | Semantic search with `query`, optional `collection`, optional `limit` |
| `deep_search` | Broader context search with `query`, optional `collection`, optional `limit` |

Example payload:

```json
{
  "query": "connection pool timeout",
  "collection": "docs",
  "limit": 10
}
```

Use CLI commands such as `qmd get` or `qmd collection list` when the MCP server does not expose that operation.

## Troubleshooting

- Not starting: run `command -v qmd` and `qmd mcp` manually.
- No results: run `qmd collection list`, then `qmd embed`.
- Slow first search: model/index loading can take time; later searches should be faster.
