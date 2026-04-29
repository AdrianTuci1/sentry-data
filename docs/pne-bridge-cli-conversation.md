# PNE Bridge CLI And Conversation Flow

`@statsparrot/pne` este bridge-ul universal dintre agenti si query engine.

El poate rula in patru moduri:

- `CLI tool mode`: `pne tool pne_analyze_question`
- `MCP stdio`: `pne mcp`
- `local HTTP`: `pne serve --port 8765`
- `hosted proxy`: `pne connect hosted --endpoint https://...`

## Install Shapes

Developer install:

```bash
npx @statsparrot/pne init
```

Repo-local control:

```bash
./scripts/pne init
```

Binary-style install target:

```bash
curl -fsSL https://get.statsparrot.com/pne | sh
```

The shell installer can create a `pne` wrapper that uses `npx` when Node is available. Without Node, it can still proxy hosted tool calls to `PNE_ENDPOINT` through `curl`.

## Connect A Warehouse

Profile-only mode:

```bash
pne connect profile --id demo --file ./warehouse-profile.json
pne sources
```

Real connectors:

```bash
pne connect bigquery --id bq --project my-project --dataset ecommerce
pne connect snowflake --id snow --connection analytics --database RAW --schema PUBLIC
pne connect duckdb --id local-duck --database ./warehouse.duckdb
pne connect postgres --id app-db --connection-string postgresql://user:pass@host:5432/db
```

Custom query engine:

```bash
pne connect custom \
  --id local \
  --profile-file ./warehouse-profile.json \
  --query-cmd "./scripts/run-query.sh"
```

Hosted PNE:

```bash
pne connect hosted --id hosted --endpoint https://pne.example.com/analyze
```

## Tools

```bash
pne tool pne_get_capabilities
pne tool pne_get_environment_status
pne tool pne_list_workspaces
pne tool pne_list_projects
pne tool pne_get_project_status
pne tool pne_list_project_sources
pne tool pne_get_project_lineage
pne tool pne_get_project_formulas
pne tool pne_get_project_overrides
pne tool pne_list_project_recommendations
pne tool pne_run_project_runtime
pne tool pne_check_project_updates
pne tool pne_discover_project_sources
pne tool pne_create_project_override
pne tool pne_list_sources
pne tool pne_get_resource_snapshot
printf '%s\n' '{"question":"Can we compute LTV for this store?","mode":"answer","hostContext":{"surface":"codex"}}' | pne tool pne_analyze_question
```

For JSON-native agents:

```bash
pne analyze-json < request.json
```

## Serve

```bash
pne serve --port 8765
```

Then call:

```bash
curl -fsSL http://localhost:8765/analyze \
  -H "Content-Type: application/json" \
  -d '{"question":"Can we compute ROAS?","mode":"answer"}'
```

Or use the tool endpoint directly:

```bash
curl -fsSL http://localhost:8765/tool \
  -H "Content-Type: application/json" \
  -d '{"toolName":"pne_analyze_question","arguments":{"question":"Can we compute LTV?","mode":"answer","hostContext":{"surface":"codex"}}}'
```

Additional GET endpoints:

- `/capabilities`
- `/environment`
- `/workspaces`
- `/projects`
- `/sources`
- `/resources`

## MCP

```bash
pne mcp
```

The MCP tools are:

- `pne_get_capabilities`
- `pne_get_environment_status`
- `pne_list_workspaces`
- `pne_list_projects`
- `pne_get_project_status`
- `pne_list_project_sources`
- `pne_get_project_lineage`
- `pne_get_project_formulas`
- `pne_get_project_overrides`
- `pne_list_project_recommendations`
- `pne_run_project_runtime`
- `pne_check_project_updates`
- `pne_discover_project_sources`
- `pne_create_project_override`
- `pne_list_sources`
- `pne_get_resource_snapshot`
- `pne_analyze_question`
- `pne_analyze_warehouse`

It accepts:

- `question`
- `mode`
- `domain`
- `connectorId`
- `sources`
- `executeQueries`

## Cache

The bridge keeps lightweight local cache under:

`~/.pne/cache.json`

Currently cached:

- source/table profiles by connector id
- versioned resource snapshots by connector id

Clear it with:

```bash
pne cache clear
```

This keeps repeated conversations from re-introspecting the warehouse every turn. Query result caching should stay opt-in because result freshness and access policies are business-sensitive.

## Conversation Model

No warehouse connected:

```text
User: What can you do?
PNE: I am not connected to a warehouse yet. Do you want to connect hosted PNE, a local profile file, or a custom query command?
```

Warehouse connected, first discovery:

```text
User: What can I do with this warehouse?
PNE: I found Orders, Products and Reviews. I can analyze order volume, delivery delays, review quality and category mix. I cannot compute ROAS because I do not see spend data.
```

Hosted environment discovery:

```text
Agent: Do we have workspaces and projects already analyzed?
PNE: I found 1 workspace and 3 projects. 2 already have discovery metadata and query configs. Project A has sources plus runtime artifacts; Project B has sources but no completed runtime yet.
```

Metric missing inputs:

```text
User: Can we compute LTV?
PNE: Not reliably yet. I see customer_id and order timestamps, but I do not see revenue. Which table contains revenue or paid amount?
```

Analysis planning:

```text
User: Why are reviews getting worse?
PNE: I will compare review score over time, category mix and delivery delays. Sentinel will review the SQL for relevance and risk before execution.
```

Evidence-backed answer:

```text
User: Execute it.
PNE: Review score dropped most sharply in categories where late delivery increased. Here are the queries, evidence preview, caveats and follow-up checks.
```

## Design Rules

- Credentials stay local in BYO mode.
- Hosted PNE receives only schema/profile, planned SQL, safe aggregates and observability.
- PNE must say when LTV, ROAS, CAC or another metric cannot be computed from available fields.
- Sentinel reviews every planned artifact for relevance, risk and evidence quality.
- Dashboard output is optional; the primary product surface is tool-called conversational analysis with transparent SQL.
