# PNE Bridge

`@statsparrot/pne` is the universal local bridge for PNE.

It supports:

- `pne init`
- `pne connect profile`
- `pne connect custom`
- `pne connect hosted`
- `pne connect bigquery`
- `pne connect duckdb-r2`
- `pne connect snowflake`
- `pne connect duckdb`
- `pne connect postgres`
- `pne capabilities`
- `pne sources`
- `pne resources`
- `pne tool`
- `pne serve`
- `pne mcp`
- `pne cache clear`

In addition to conversational analysis, the bridge now exposes:

- direct SQL execution for BI consumers
- portable widget query contracts
- PowerBI query and dataset definitions
- detailed ML experiment contracts for sandbox execution

The package is prepared for `npx` distribution by vendoring compiled runtime modules at pack time, so the published bridge can remain self-contained instead of relying on repo-local `file:` dependencies.

## Install

When published:

```bash
npx @statsparrot/pne mcp
```

For a shell installer:

```bash
curl -fsSL https://get.statsparrot.com/pne | sh
```

The installer writes a lightweight `pne` wrapper into `~/.local/bin` by default. That wrapper delegates to:

- `npx @statsparrot/pne ...` when `node` and `npx` are available
- hosted `PNE_ENDPOINT` only for the narrow fallback `pne tool pne_analyze_question`

For local tarball testing before publish:

```bash
cd ../../sentry-backend && npm run build
cd ../pne-bridge && npm pack
PNE_INSTALL_PACKAGE_SPEC="$(pwd)/statsparrot-pne-0.1.1.tgz" sh ./install.sh
```

## Quick Start

```bash
./scripts/pne init
./scripts/pne tool pne_get_setup_guide
./scripts/pne tool pne_check_local_prerequisites
./scripts/pne connect profile --id demo --file ./warehouse-profile.json
./scripts/pne tool pne_test_connector
./scripts/pne tool pne_list_sources
```

For hosted mode:

```bash
pne connect hosted --endpoint https://your-pne-host/analyze --api-key "$PNE_API_KEY"
printf '%s\n' '{"question":"Can we compute ROAS?","mode":"answer","hostContext":{"surface":"codex"}}' | pne tool pne_analyze_question
```

For custom engines:

```bash
pne connect custom \
  --id local \
  --profile-file ./warehouse-profile.json \
  --query-cmd "./scripts/run_query.sh"
```

For direct R2 parquet access through DuckDB:

```bash
pne connect duckdb-r2 \
  --id r2 \
  --database ./.pne/pne-r2.duckdb \
  --table raw_data \
  --uri "s3://statsparrot-data/tenants/test_tenant_1/projects/proj_ecommerce_demo/sources/Olist_Orders/**/*.parquet" \
  --endpoint "$R2_ENDPOINT" \
  --region "${R2_REGION:-auto}"

pne tool pne_test_connector
```

For multi-table R2 analysis through DuckDB:

```bash
pne connect duckdb-r2 \
  --id olist-r2 \
  --tables-json '[{"table":"olist_orders","name":"Olist Orders","uri":"s3://statsparrot-data/tenants/test_tenant_1/projects/proj_ecommerce_demo/sources/Olist_Orders/**/*.parquet"},{"table":"olist_reviews","name":"Olist Reviews","uri":"s3://statsparrot-data/tenants/test_tenant_1/projects/proj_ecommerce_demo/sources/Olist_Reviews/**/*.parquet"}]'

printf '%s\n' '{"question":"Do late deliveries correlate with lower review scores?","mode":"answer","executeQueries":true,"connectorId":"olist-r2"}' | pne tool pne_analyze_question
```

## Host Agent Flow

Use `pne mcp`, `pne serve`, or `pne tool` when a host agent should call PNE as a tool. The universal product surface is tool-calling, not a proprietary chat command.

### Codex MCP Example

```json
{
  "mcpServers": {
    "pne": {
      "command": "npx",
      "args": ["-y", "@statsparrot/pne", "mcp"],
      "env": {
        "PNE_ENDPOINT": "${PNE_ENDPOINT}",
        "PNE_API_KEY": "${PNE_API_KEY}"
      }
    }
  }
}
```

PNE accepts:

- the raw user question
- optional `conversation`
- optional `hostContext`
- optional `interpretedIntent`

The response includes:

- `answer`
- `sql`
- `evidence`
- `caveats`
- `followUps`
- `nextActions`
- `agentPackage`

For direct BI-style SQL execution:

```bash
printf '%s\n' '{"connectorId":"olist-r2-all","sql":"SELECT COUNT(*) AS review_count FROM olist_reviews"}' | pne tool pne_execute_sql
```

For widget contracts and PowerBI definitions:

```bash
pne tool pne_get_widget_catalog
printf '%s\n' '{"widgetType":"metric-trend","rows":{"value":42}}' | pne tool pne_resolve_widget_contract
printf '%s\n' '{"connectorId":"olist-r2-all","widgetType":"sparkline-stat","queryName":"ReviewScoreTrend","sql":"SELECT DATE_TRUNC(review_creation_date, DAY) AS period, AVG(review_score) AS value FROM olist_reviews GROUP BY period ORDER BY period"}' | pne tool pne_build_powerbi_query
```

For ML experiment contracts:

```bash
printf '%s\n' '{"sources":[{"sourceId":"olist_order_items","sourceName":"Olist Order Items","columns":[{"name":"order_id","semanticType":"id"},{"name":"shipping_limit_date","semanticType":"timestamp"},{"name":"price","semanticType":"metric"}]}],"candidate":{"candidateId":"olist_order_items-forecasting","taskType":"forecasting","sourceId":"olist_order_items","title":"Forecast price over time","targetColumn":"price","featureColumns":["shipping_limit_date"]}}' | pne tool pne_build_ml_experiment_contract
```

Example:

```bash
printf '%s\n' '{
  "question":"Can we compute LTV?",
  "mode":"answer",
  "hostContext":{"surface":"codex","agentName":"Codex","modelName":"gpt-5.5"},
  "interpretedIntent":{"metrics":["ltv"],"unresolvedQuestions":["Which source contains revenue?"]}
}' | pne tool pne_analyze_question
```

## MCP Tools

The bridge exposes these MCP tools:

- `pne_get_capabilities`
- `pne_get_setup_guide`
- `pne_get_session_state`
- `pne_reset_session_state`
- `pne_get_recommended_next_steps`
- `pne_plan_ml_model`
- `pne_build_ml_experiment_contract`
- `pne_check_local_prerequisites`
- `pne_list_configured_connectors`
- `pne_configure_connector`
- `pne_test_connector`
- `pne_execute_sql`
- `pne_get_widget_catalog`
- `pne_resolve_widget_contract`
- `pne_build_powerbi_query`
- `pne_build_powerbi_dataset`
- `pne_get_account_snapshot`
- `pne_get_environment_status`
- `pne_get_connector_catalog`
- `pne_list_workspaces`
- `pne_create_workspace`
- `pne_get_workspace_detail`
- `pne_get_workspace_members`
- `pne_get_workspace_invitations`
- `pne_create_workspace_invitation`
- `pne_get_workspace_activity`
- `pne_list_projects`
- `pne_create_project`
- `pne_update_project`
- `pne_get_project_status`
- `pne_list_project_share_links`
- `pne_create_project_share_link`
- `pne_list_project_sources`
- `pne_add_project_source`
- `pne_delete_project_source`
- `pne_get_project_lineage`
- `pne_get_project_analytics`
- `pne_get_project_formulas`
- `pne_get_project_overrides`
- `pne_list_project_recommendations`
- `pne_train_project_recommendation`
- `pne_run_project_runtime`
- `pne_list_runtime_requests`
- `pne_get_runtime_request_status`
- `pne_get_runtime_request_artifacts`
- `pne_poll_runtime_request`
- `pne_check_project_updates`
- `pne_discover_project_sources`
- `pne_create_project_override`
- `pne_record_sentinel_feedback`
- `pne_get_dashboard_data`
- `pne_get_dashboard_manifest`
- `pne_get_dashboard_widget_data`
- `pne_reload_widget_registry`
- `pne_preview_workspace_invitation`
- `pne_accept_workspace_invitation`
- `pne_get_shared_project`
- `pne_list_sources`
- `pne_get_resource_snapshot`
- `pne_analyze_question`
- `pne_analyze_warehouse` as a backward-compatible alias

## HTTP Endpoints

When `pne serve` is running, the bridge exposes:

- `GET /health`
- `GET /setup/guide`
- `GET /setup/prerequisites`
- `GET /session`
- `GET /connectors`
- `GET /account/me`
- `GET /capabilities`
- `GET /connectors/catalog`
- `GET /environment`
- `GET /workspaces`
- `GET /workspaces/:workspaceId`
- `GET /workspaces/:workspaceId/members`
- `GET /workspaces/:workspaceId/invitations`
- `GET /workspaces/:workspaceId/activity`
- `GET /projects`
- `GET /projects/:projectId`
- `GET /projects/:projectId/share-links`
- `GET /projects/:projectId/sources`
- `GET /projects/:projectId/lineage`
- `GET /projects/:projectId/analytics`
- `GET /projects/:projectId/runtime/code-formulas`
- `GET /projects/:projectId/runtime/overrides`
- `GET /projects/:projectId/ml/recommendations`
- `GET /projects/:projectId/runtime/requests`
- `GET /projects/:projectId/runtime/requests/:requestId`
- `GET /projects/:projectId/runtime/requests/:requestId/artifacts`
- `GET /projects/:projectId/runtime/poll`
- `GET /dashboard/:projectId`
- `GET /dashboard/:projectId/manifest`
- `GET /dashboard/:projectId/widget/:widgetId`
- `GET /dashboard/system/reload`
- `GET /public/invitations/:tenantId/:workspaceId/:inviteToken`
- `GET /public/projects/:tenantId/:projectId/share/:shareToken`
- `GET /sources`
- `GET /resources`
- `POST /analyze`
- `POST /connectors`
- `POST /session/reset`
- `POST /playbooks/recommend`
- `POST /ml/plan`
- `POST /tool`

## Agent Model

Host agents should not treat PNE like a chat assistant. They should use it as a discovery and orchestration bridge:

1. Ask `pne_get_setup_guide` and `pne_check_local_prerequisites`
2. Ask `pne_get_recommended_next_steps`
3. If no connector is configured, use `pne_configure_connector` or guide the user through `pne connect ...`
4. Run `pne_test_connector`
5. Ask `pne_get_environment_status`
6. Ask `pne_list_workspaces` / `pne_list_projects` when hosted mode is connected
7. Ask `pne_get_project_status` to inspect whether a project already has sources, projections, query specs and runtime artifacts
8. Ask deeper inspection tools such as `pne_list_project_sources`, `pne_get_project_lineage`, `pne_get_project_formulas`, `pne_get_project_overrides` or `pne_list_project_recommendations`
9. If the user asks for ML direction, inspect `pne_plan_ml_model`
10. If needed, inspect adjacent product zones such as `pne_get_account_snapshot`, `pne_get_dashboard_data`, `pne_get_dashboard_manifest`, `pne_get_dashboard_widget_data`, `pne_preview_workspace_invitation` or `pne_get_shared_project`
11. If needed, call hosted mutation tools such as `pne_create_workspace`, `pne_create_project`, `pne_add_project_source`, `pne_run_project_runtime`, `pne_check_project_updates`, `pne_discover_project_sources`, `pne_train_project_recommendation`, `pne_create_project_override`, `pne_record_sentinel_feedback` or `pne_accept_workspace_invitation`
12. If runtime was triggered, follow it with `pne_poll_runtime_request` or the lower-level runtime request tools before assuming artifacts exist
13. Ask `pne_list_sources` or `pne_get_resource_snapshot`
14. Call `pne_analyze_question` only after the agent understands the environment

The code editor agent navigates PNE as a tool graph. PNE is not the conversational agent; it is the bridge that exposes account state, workspace/project control plane state, dashboard/runtime artifacts, public access flows and warehouse analysis primitives.
