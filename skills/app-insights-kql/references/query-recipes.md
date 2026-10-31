# Read-only query recipes

Resolve all placeholders first. These examples use the Application Insights schema; inspect and
adapt table/column names for the actual endpoint. Keep every query time-bounded and output-limited.

```sh
az monitor app-insights query --subscription "<subscription>" --resource-group "<resource-group>" --app "<component>" --analytics-query '<KQL>' --offset 1h -o json
```

Use an explicit start/end time for reproducible historical investigations. Installed CLI help is the
authority for accepted arguments. Read-only schema discovery, for example `requests | getschema`,
returns field metadata instead of arbitrary telemetry payloads.

## Failing routes

```kql
requests
| where timestamp > ago(1h)
| summarize total=sum(itemCount), failed=sumif(itemCount, success == false) by name
| where failed > 0
| top 20 by failed
```

Verify that `name` is a sanitised route name before reporting it. Filter to the requested service
role when several services share a component. If `itemCount` is absent, inspect the schema and label
unweighted counts accordingly.

## Status codes over time

```kql
requests
| where timestamp > ago(1h) and name == '<verified-route-name>'
| summarize estimatedEvents=sum(itemCount) by resultCode, bin(timestamp, 5m)
| order by timestamp asc
| take 100
```

## Exception grouping

```kql
exceptions
| where timestamp > ago(1h)
| summarize estimatedEvents=sum(itemCount), lastSeen=max(timestamp) by type
| top 20 by estimatedEvents
```

## One distributed operation

```kql
requests
| where timestamp > ago(1h) and operation_Id == '<trace-id>'
| project timestamp, name, resultCode, success, duration, operation_Id
| order by timestamp asc
| take 100
```

Repeat for dependencies or traces using their verified columns. A request-id lookup might use
`tostring(customDimensions.RequestId)` only if that property exists in this application's logging
contract. Prefer a verified safe message-template property over the rendered `message` field.
Escape supplied identifiers as data in query construction; do not concatenate arbitrary client text
into KQL. Do not project complete payload bags merely to discover a correlation field.
