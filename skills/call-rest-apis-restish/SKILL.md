---
name: call-rest-apis-restish
description: Configure and call REST APIs with the restish CLI, including OpenAPI discovery, auth profiles, endpoint testing, output conversion, and response filtering. Use when the user asks to call an API, inspect or configure a REST endpoint, use an OpenAPI spec from a service, test authenticated requests, or transform REST responses from the terminal.
---

# Call REST APIs With Restish

Use `restish` when a REST API or OpenAPI-backed service should be called from the terminal.

## Prerequisite Check

1. Run `command -v restish`.
2. If missing, tell the user `restish` is required and ask whether to install it.
3. Prefer the Go install path when Go is available:
   - `go install github.com/danielgtaylor/restish@latest`
4. If Go is missing, ask the user to install Go first or follow the restish project install instructions manually.
5. After install, run `restish --help` or `restish --version`.

Do not call APIs with fabricated auth, base URLs, or configured profiles.

## Configure An API

First check whether the API exposes an OpenAPI/service description:

```bash
curl -sI <base-url>/
```

Prefer automatic discovery when the API has:

```text
Link: </openapi.json>; rel="service-desc"
```

or when the spec is hosted at `/openapi.json` or `/openapi.yaml`.

Use local spec files only when discovery is unavailable:

```bash
curl -s <base-url>/<spec-path> > <api-name>-openapi.json
```

Then configure `restish api edit` or update the restish API config with:

```json
{
  "<api-name>": {
    "base": "<base-url>",
    "spec_files": ["<absolute-path-to-openapi-json>"],
    "profiles": {
      "default": {
        "headers": {
          "Authorization": "Bearer <token>"
        }
      }
    }
  }
}
```

Ask before writing credentials to config files. Prefer environment variables or temporary headers when the user does not want persisted auth.

## Common Calls

```bash
restish <api-name> /api/v1/health
restish <api-name> /api/v1/users -v
restish <api-name> -p admin /api/v1/users
restish api show <api-name>
restish api sync <api-name>
```

Use generated OpenAPI command names only after confirming them with `restish <api-name> --help`.

## Auth Patterns

Bearer token:

```json
{
  "headers": {
    "Authorization": "Bearer <token>"
  }
}
```

API key query param:

```json
{
  "query": {
    "api_key": "<key>"
  }
}
```

HTTP basic:

```json
{
  "auth": {
    "name": "http-basic",
    "params": {
      "username": "<user>",
      "password": "<password>"
    }
  }
}
```

OAuth client credentials:

```json
{
  "auth": {
    "name": "oauth-client-credentials",
    "params": {
      "client_id": "<client-id>",
      "client_secret": "<client-secret>",
      "token_url": "<token-url>",
      "scopes": "<scopes>"
    }
  }
}
```

## Output And Filtering

```bash
restish <api-name> /endpoint --rsh-output-format json
restish <api-name> /endpoint --rsh-output-format yaml
restish <api-name> /endpoint --rsh-output-format table
restish <api-name> /users --rsh-filter 'body.{id, name, email}'
restish <api-name> /items --rsh-filter 'body[0]'
restish <api-name> /users --rsh-filter 'body[age >= 18]'
restish <api-name> /data --rsh-filter '..url'
restish <api-name> /endpoint --rsh-filter 'body.id' --rsh-raw
```

## Safety

- Confirm base URL, auth profile, and write operations before mutating remote data.
- Use `--rsh-verbose` when debugging auth or headers.
- Do not print secrets in the final response.
- Summarize status codes, response shape, and key fields instead of dumping large JSON.
