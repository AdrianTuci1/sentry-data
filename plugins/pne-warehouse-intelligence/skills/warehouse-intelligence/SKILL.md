---
name: warehouse-intelligence
description: Use PNE to reason about warehouse schemas, validate whether business metrics can be computed, produce SQL, and return evidence-backed caveats from agent surfaces such as Codex, Claude Code, Copilot, Antigravity, MCP clients, or CLI workflows.
---

# Warehouse Intelligence

Use this skill when the user asks questions about a warehouse, dataset, business metric, SQL plan, or whether metrics like LTV, ROAS, CAC, retention, churn, delivery SLA, or review quality can be computed from available tables.

## Workflow

1. Identify the user's business question.
2. Collect warehouse context if available:
   - table names
   - columns and types
   - semantic candidates such as timestamps, metrics and entity keys
   - sample rows only when safe and explicitly available
3. Call PNE through one of the universal surfaces:
   - MCP tool `pne_analyze_question`
   - MCP helper tools `pne_get_setup_guide`, `pne_check_local_prerequisites`, `pne_get_session_state`, `pne_get_recommended_next_steps`, `pne_get_capabilities`, `pne_get_environment_status`, `pne_list_workspaces`, `pne_list_projects`, `pne_get_project_status`, `pne_list_runtime_requests`, `pne_get_runtime_request_status`, `pne_get_runtime_request_artifacts`, `pne_poll_runtime_request`, `pne_list_sources`, `pne_get_resource_snapshot`, `pne_plan_ml_model`
   - CLI script `scripts/pne-agent-bridge.mjs`
   - hosted HTTP endpoint configured with `PNE_ENDPOINT`
4. Return:
   - direct answer
   - SQL blocks
   - evidence summary
   - caveats
   - follow-up questions for missing business inputs

Before calling `pne_analyze_question`, prefer checking:

- what setup path is recommended?
- are local prerequisites available?
- what does the playbook recommend as the next step?
- is a warehouse connected?
- is hosted control plane available?
- which workspace/project is relevant?
- does the project already have sources and runtime artifacts?
- if runtime was just started, has the request actually completed yet?

If the user asks about model building, prediction, anomaly detection or forecasting:

- inspect `pne_plan_ml_model` before proposing a model direction
- be explicit when the schema is not ML-ready
- prefer a baseline model plan over vague “we could use AI” suggestions

If you trigger a hosted runtime:

- do not assume completion immediately
- prefer `pne_poll_runtime_request` as the primary follow-up tool
- use `pne_get_runtime_request_artifacts` only when the run is terminal or when the user explicitly wants partial artifacts

## Answer Style

- Be explicit when a metric cannot be computed from the current schema.
- Do not invent revenue, spend, customer identity, attribution or cohort fields.
- Show SQL when the user asks for implementation details or validation.
- Prefer business relevance over raw profiling metrics.
- Treat dashboards as one output, not the default product surface.

## Universal Connection Strategy

- MCP is the primary protocol for compatible agent tools.
- CLI stdin/stdout is the fallback for agents that can run shell commands.
- HTTP is the hosted service bridge.
- Product-specific adapters should be thin wrappers over the same request and response schema.
