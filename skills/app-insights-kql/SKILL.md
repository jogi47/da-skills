---
name: app-insights-kql
description: Investigate Azure Application Insights telemetry with read-only KQL for failure rates, slow routes, exceptions and request correlation. Use when the user asks why a deployed service failed or was slow, or wants to join a client trace to server telemetry. Discover the target Azure resources and schema rather than assuming a project or environment.
---

# Application Insights diagnostics

Run read-only queries through available Azure tools or `az monitor app-insights query`. Do not
change subscriptions, resources, logging, retention, alerts or sampling settings as part of diagnosis.

## Establish scope and schema

1. Resolve the environment, subscription, resource group, Application Insights component (or workspace)
   and time window from the user, repository guidance or verified resource metadata. Read only the
   requested scope. Do not guess production resources or silently query a different environment.
2. Pass the subscription explicitly to CLI commands instead of changing the active account context.
   If access is unavailable, report it; do not start authentication or change permissions.
3. Inspect the target's table/column schema with a bounded metadata query before using recipes.
   Application Insights queries can expose `requests`, `traces`, `exceptions`, `dependencies` with
   camel-case columns; workspace queries can expose `AppRequests`, `AppTraces`, `AppExceptions`,
   `AppDependencies` with different column names. Adapt to the actual endpoint.
4. Establish telemetry coverage, role/service names, ingestion delay, retention and sampling when
   available. Do not assume every environment emits telemetry or that local runs never do.

The CLI invocation and example queries are in [query-recipes.md](references/query-recipes.md).

## Diagnose from bounded evidence

Start with aggregates: failing routes, status-code counts, latency and exception types. Narrow to a
service and time window, then correlate a specific request only when necessary. Use sampling weights
(`itemCount`, or the schema's equivalent) for event-count estimates when available; do not sum
arbitrary duplicated telemetry as distinct requests. Label raw row counts and estimates accurately.

A client request id and a distributed trace id are different identifiers. Discover which custom
property holds the former, and use the actual operation/trace field for the latter. Join on exact
ids when captured; label a `(method, path, time)` join as heuristic. Do not assume all traces carry
both ids, that every log is duplicated, or that a custom property has a universal name.

Empty exception/dependency tables do not prove success: inspect request outcomes and known collection
gaps. Latency percentiles from sampled rows need a sampling caveat unless an appropriate weighted
aggregation is used. State ingestion/retention limits that affect the conclusion.

## Data and reporting

Select named non-sensitive columns. Avoid raw URLs with query strings, request/response bodies,
rendered messages and unfiltered custom dimensions, which can contain secrets or customer data.
Prefer routes, message templates, status codes, timings and aggregate counts. Retrieve a request id
or trace id only when needed for correlation and treat it as diagnostic data.

For each finding, state the environment, resource, time window, query and supporting result. Separate
observed failures from a suspected cause. Do not reproduce a live issue, contact a database or mutate
the service simply because telemetry was requested.

Official references: [query CLI](https://learn.microsoft.com/en-us/cli/azure/monitor/app-insights),
[telemetry model](https://learn.microsoft.com/en-us/azure/azure-monitor/app/data-model-complete).
