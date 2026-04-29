# Universal Agent Integration

PNE should not depend on one coding agent product. The universal integration strategy is:

1. MCP first.
2. CLI fallback.
3. HTTP bridge for hosted PNE.
4. Thin product-specific adapters only where a host requires them.

## Supported Surfaces

`Codex`

- Uses the plugin manifest and skill.
- Can call the MCP server when the host enables plugin MCP servers.
- Can also run the CLI bridge with JSON on stdin through `pne tool pne_analyze_question`.

`Claude Code`

- Primary path is MCP.
- Configure the MCP server command to run `scripts/pne-mcp-server.mjs`.
- Set `PNE_ENDPOINT` and optionally `PNE_API_KEY`.

`GitHub Copilot`

- Universal path is CLI or MCP where supported by the host environment.
- Product-specific extensions should be thin wrappers around the same tool schema and resource snapshot model.

`Antigravity`

- Universal path is CLI or MCP where supported by the host environment.
- Product-specific integration should call the hosted PNE HTTP endpoint or launch the MCP server, never bypassing the tool contract.

## Request Shape

```json
{
  "requestId": "pne-demo-1",
  "question": "Can we compute ROAS for this online store?",
  "mode": "answer",
  "domain": "ecommerce",
  "hostContext": {
    "surface": "codex",
    "agentName": "Codex",
    "modelName": "gpt-5.5",
    "sessionId": "thread-123"
  },
  "interpretedIntent": {
    "goal": "Assess whether ROAS is calculable and propose first-pass analysis",
    "metrics": ["roas", "revenue", "spend"],
    "dimensions": ["campaign_id"],
    "expectedDeliverable": "answer",
    "unresolvedQuestions": ["Which source contains ad spend?"]
  },
  "sources": [
    {
      "sourceId": "orders",
      "sourceName": "Orders",
      "engine": "bigquery",
      "tableId": "project.dataset.orders",
      "columns": [
        { "name": "order_id", "type": "STRING", "semanticType": "id" },
        { "name": "customer_id", "type": "STRING", "semanticType": "id" },
        { "name": "order_purchase_timestamp", "type": "TIMESTAMP", "semanticType": "timestamp" }
      ],
      "entityKeyCandidates": ["customer_id"],
      "timestampCandidates": ["order_purchase_timestamp"]
    }
  ]
}
```

## CLI Usage

```bash
export PNE_ENDPOINT="https://your-pne-host/analyze"
node plugins/pne-warehouse-intelligence/scripts/pne-agent-bridge.mjs < request.json
```

## MCP Usage

Use `.mcp.json` from this plugin and set:

```bash
export PNE_ENDPOINT="https://your-pne-host/analyze"
export PNE_API_KEY="optional-token"
```

The MCP tools are:

- `pne_get_capabilities`
- `pne_get_environment_status`
- `pne_list_workspaces`
- `pne_list_projects`
- `pne_get_project_status`
- `pne_list_sources`
- `pne_get_resource_snapshot`
- `pne_analyze_question`
- `pne_analyze_warehouse` for backward compatibility

It returns JSON with:

- answer
- SQL blocks
- caveats
- follow-up questions
- evidence
- next actions
- agent package
- raw PNE response

Resource snapshots let host agents version their memory of connected sources and refresh only when the connector profile changes.

Hosted project status lets host agents answer higher-level questions such as:

- Do we already have a warehouse connected?
- Do we have workspaces and projects?
- Which projects already have discovery metadata, projections and query configs?
- Which projects still need sources or a runtime run?

## Design Principle

The adapter layer should stay thin. Host agents own natural-language conversation and tool calling. PNE owns warehouse-native planning, connector grounding, Sentinel review and observability.
