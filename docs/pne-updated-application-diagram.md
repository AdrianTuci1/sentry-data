# PNE Updated Application Diagram

Aceasta este arhitectura actualizata pentru directia `PNE as universal warehouse intelligence`, unde aplicatia hosted ramane valida, dar PNE poate fi folosit si din Codex, Claude Code, Copilot, Antigravity sau orice agent care poate vorbi MCP, CLI sau HTTP.

## High Level

```mermaid
flowchart TD
    USER["User<br/>asks business/data question"] --> SURFACE["Agent Surface"]

    SURFACE --> CODEX["Codex Plugin"]
    SURFACE --> CLAUDE["Claude Code MCP"]
    SURFACE --> COPILOT["Copilot Extension / CLI"]
    SURFACE --> ANTI["Antigravity / CLI"]
    SURFACE --> HOSTED_UI["Hosted StatsParrot App"]

    CODEX --> MCP["MCP Tools<br/>pne_analyze_question + helpers"]
    CLAUDE --> MCP
    COPILOT --> CLI["CLI Bridge<br/>pne tool / stdin JSON"]
    ANTI --> CLI
    HOSTED_UI --> HOSTED_API["Hosted Backend API"]

    MCP --> BRIDGE["PNE Bridge"]
    CLI --> BRIDGE
    HOSTED_API --> BRIDGE

    BRIDGE --> CONFIG["~/.pne/config.json"]
    BRIDGE --> LOCAL_CACHE["~/.pne/cache.json"]
    BRIDGE --> TOOLGATE["PNE Tool Gateway"]
    BRIDGE --> MODE{"Runtime Mode"}
    MODE --> LOCAL["Local Runtime<br/>BYO warehouse"]
    MODE --> REMOTE["Hosted Runtime<br/>StatsParrot managed"]

    LOCAL --> PNECORE["pne-core"]
    REMOTE --> PNECORE
    REMOTE --> CONTROL["Hosted Control Plane"]

    TOOLGATE --> ENVTOOLS["Environment Tools<br/>setup guide, prereqs, account,<br/>capabilities, connectors, projects"]
    TOOLGATE --> DATATOOLS["Data Tools<br/>sources, snapshots, analytics, dashboards,<br/>widgets, analyze question"]
    TOOLGATE --> ACTIONTOOLS["Action Tools<br/>workspace/project mutations, public access,<br/>runtime run/poll, ML train, Sentinel feedback"]

    PNECORE --> CONNECTORS["connector-sdk"]
    PNECORE --> SENTINEL["sentinel-core"]
    PNECORE --> OBS["observability"]
    PNECORE --> CACHE["lightweight cache"]
    TOOLGATE --> PLAYBOOKS["agent-playbooks<br/>recommended next steps,<br/>session guidance, ML planning"]

    CONTROL --> CPAPI["/account/me<br/>/workspaces<br/>/projects<br/>/dashboard/:projectId<br/>/public/*<br/>/projects/connectors/catalog<br/>/projects/:id/runtime/*"]

    CONNECTORS --> BQ["BigQuery"]
    CONNECTORS --> SNOW["Snowflake"]
    CONNECTORS --> DUCK["DuckDB"]
    CONNECTORS --> PG["Postgres"]
    CONNECTORS --> CUSTOM["Custom Query Engine"]

    SENTINEL --> PACKS["sentinel-domain-packs"]
    SENTINEL --> TRUST["Review Signals<br/>relevance, risk, evidence, cost"]

    OBS --> TRACE["Trace / checkpoints"]
    CACHE --> PROFILE_CACHE["schema/profile cache"]
    CACHE --> RESULT_CACHE["query result cache"]
    CACHE --> SESSION_CACHE["session guidance cache"]

    PNECORE --> ANSWER["Answer + SQL + Evidence + Caveats + Follow-ups"]
    ANSWER --> SURFACE
```

## What Was Missing

The old diagram made PNE look too much like a question-answer engine. The missing piece was a **tool-access layer over the internal control plane and runtime state**.

The host agent should not start with:

- "ask PNE a question"

The host agent should start with:

- "what setup paths do I have?"
- "are BigQuery or DuckDB available locally?"
- "is a connector already configured?"
- "do we have a warehouse?"
- "do we have hosted workspaces?"
- "which projects already exist?"
- "which projects already have sources?"
- "which ones already have discovery metadata, projections, query specs, query configs, formulas and runtime artifacts?"

Only after that should it call `pne_analyze_question`.

## Agent Tool Sequence

```mermaid
sequenceDiagram
    participant User
    participant Agent as Code Editor Agent
    participant Bridge as PNE Bridge
    participant Control as Hosted Control Plane
    participant Core as pne-core
    participant Warehouse as Warehouse / Query Engine

    User->>Agent: "Help me understand this analytics workspace"
    Agent->>Bridge: pne_get_setup_guide
    Bridge-->>Agent: connector recipes
    Agent->>Bridge: pne_check_local_prerequisites
    Bridge-->>Agent: local CLI/env status
    Agent->>Bridge: pne_get_recommended_next_steps
    Bridge-->>Agent: playbook guidance
    Agent->>Bridge: pne_get_environment_status
    Bridge->>Control: workspace/project inventory (hosted) or local connector status
    Control-->>Bridge: workspaces, projects, runtime summary
    Bridge-->>Agent: environment summary

    Agent->>Bridge: pne_get_project_status
    Bridge->>Control: project, sources, lineage, formulas
    Control-->>Bridge: project artifacts + runtime status
    Bridge-->>Agent: analyzed / not analyzed + artifact counts

    alt project already has usable sources
        Agent->>Bridge: pne_list_sources / pne_get_resource_snapshot
        Bridge-->>Agent: source capabilities + snapshot version
        Agent->>Bridge: pne_analyze_question
        Bridge->>Core: plan + review + optional execution
        Core->>Warehouse: introspect / query
        Warehouse-->>Core: metadata / rows
        Core-->>Bridge: SQL + evidence + next actions
        Bridge-->>Agent: normalized answer
    else project needs setup
        Agent-->>User: explain what is missing and suggest next step
    end
```

## Package View

```mermaid
flowchart LR
    PLUGIN["plugins/pne-warehouse-intelligence"] --> ADAPTER["packages/codex-adapter"]
    ADAPTER --> PNE["packages/pne-core"]
    PNE --> CONNECT["packages/connector-sdk"]
    PNE --> SENT["packages/sentinel-core"]
    PNE --> OBS["packages/observability"]
    SENT --> DOMAIN["packages/sentinel-domain-packs"]

    BACKEND["sentry-backend"] --> SENT_ADAPTER["SentinelCoreRuntimeAdapter"]
    SENT_ADAPTER --> SENT
    SENT_ADAPTER --> DOMAIN

    MODAL["modal_apps/pne.py"] -. "hosted adapter remains" .-> PNE
```

## Exposed vs Internal

```mermaid
flowchart LR
    Agent["Host Agent"] --> Exposed["Exposed Through PNE Bridge"]
    Exposed --> E1["pne_get_capabilities"]
    Exposed --> E2["pne_get_environment_status"]
    Exposed --> E3["pne_get_account_snapshot / connector catalog"]
    Exposed --> E4["pne_list_workspaces / create / inspect / invite"]
    Exposed --> E5["pne_list_projects / create / update / share"]
    Exposed --> E6["pne_get_project_status / project artifacts"]
    Exposed --> E7["pne_dashboard / analytics / widget payloads"]
    Exposed --> E8["pne_runtime / runtime requests / poll / overrides / ML train / Sentinel feedback"]
    Exposed --> E9["pne_public invitation/share flows"]
    Exposed --> E10["pne_list_sources / snapshots / analyze"]

    Internal["Still Internal / Partially Exposed"] --> I1["artifact upload / R2 bookkeeping"]
    Internal --> I2["lower-level runtime storage primitives"]
    Internal --> I3["webhook-only callbacks"]
    Internal --> I4["SSE stream transport itself"]
    Internal --> I5["fine-grained account/session management"]
```

Today, the bridge exposes most hosted read and action flows as first-class tools, including account, dashboard, runtime request polling and public-access inspection. The remaining internals are mostly low-level storage, webhook plumbing and raw SSE transport, not the main product zones an editor agent needs to navigate.

## Conversation Flow

```mermaid
sequenceDiagram
    participant User
    participant Agent as Agent Surface
    participant Bridge as PNE Bridge
    participant PNE as pne-core
    participant Cache as Cache
    participant Conn as connector-sdk
    participant Wh as Warehouse
    participant Sent as Sentinel

    User->>Agent: "Can we compute ROAS for this store?"
    Agent->>Bridge: MCP / CLI / HTTP request
    Bridge->>Cache: Load known warehouse profile

    alt no profile cached
        Bridge->>Conn: introspect()
        Conn->>Wh: schema/sample metadata query
        Wh-->>Conn: table profiles
        Conn-->>Bridge: source profiles
        Bridge->>Cache: save profile cache
    end

    Bridge->>PNE: analyze(question, sources)
    PNE->>Sent: review planned artifacts
    Sent-->>PNE: relevance/risk/evidence signals

    alt enough data and safe execution
        PNE->>Conn: dryRun + execute planned SQL
        Conn->>Wh: run SQL
        Wh-->>Conn: rows
        Conn-->>PNE: evidence
        PNE->>Cache: save result cache
    else missing inputs
        PNE-->>Bridge: caveats + follow-up questions
    end

    PNE-->>Bridge: answer + SQL + evidence + caveats
    Bridge-->>Agent: normalized response
    Agent-->>User: business answer with transparent SQL
```

## Hosted Mode

```mermaid
flowchart TD
    UI["StatsParrot UI"] --> BACK["sentry-backend"]
    AGENT["Code Editor Agent"] --> BRIDGEHOST["PNE Bridge (hosted mode)"]
    BRIDGEHOST --> BACK
    BACK --> MODAL["Modal PNE"]
    MODAL --> WORKER["analytics_worker"]
    WORKER --> R2["R2 / Parquet"]
    BACK --> SENT["SentinelCoreRuntimeAdapter"]
    SENT --> SCORE["Business relevance + risk signals"]
    BACK --> DASH["Dashboard payload"]
    DASH --> UI
```

Hosted mode keeps the current product path:

`UI -> backend -> PNE Modal -> analytics_worker -> Sentinel review -> dashboard`

The updated hosted agent path is:

`Agent -> PNE Bridge -> hosted control plane -> project/runtime artifacts -> PNE/worker when analysis is needed`

## BYO Warehouse Mode

```mermaid
flowchart TD
    AGENT["Codex / Claude Code / Copilot / Antigravity"] --> TOOL["MCP / CLI / HTTP"]
    TOOL --> BRIDGE["Local PNE Bridge"]
    BRIDGE --> CACHE["Local config + cache"]
    BRIDGE --> PNE["pne-core"]
    PNE --> CONNECTOR["connector-sdk"]
    CONNECTOR --> WH["User warehouse"]
    PNE --> SENTINEL["sentinel-core"]
    SENTINEL --> RESPONSE["reviewed answer"]
    RESPONSE --> AGENT
```

In BYO mode, credentials stay local. Hosted PNE should receive only the minimum safe context:

- schema/profile
- planned SQL
- aggregate previews where allowed
- Sentinel and observability metadata

## User Conversation States

```mermaid
stateDiagram-v2
    [*] --> NoConnection
    NoConnection --> Setup: "I do not have warehouse access yet"
    Setup --> Discovering: configure connector
    Discovering --> SourceChoice: introspect tables
    SourceChoice --> Capabilities: choose source/table
    Capabilities --> Planning: ask business question
    Planning --> MissingInputs: metric cannot be computed
    Planning --> Review: candidate SQL planned
    Review --> Execute: user allows execution / policy allows
    Execute --> Answer: evidence-backed response
    MissingInputs --> SourceChoice: user points to missing table
    Answer --> Planning: follow-up question
```

Example first conversation:

```text
User: What can I do with this warehouse?
PNE: I found Orders, Products and Reviews. I can analyze order volume, delivery delays, review quality and category mix. I cannot compute ROAS because I do not see spend data.
```

Example missing data conversation:

```text
User: Can we compute LTV?
PNE: Not reliably yet. I see customer_id and orders, but I do not see revenue or paid amount. Which table contains order value or payments?
```

Example analysis conversation:

```text
User: Why are reviews getting worse?
PNE: I will compare review score over time, category mix and delivery delay. The first query checks whether review score movement aligns with late delivery share.
```

## Implementation Status

Implemented now:

- `pne-core` contracts and runtime shell
- `connector-sdk` interfaces, registry, SQL function connector, BigQuery, Snowflake, DuckDB and Postgres CLI-backed connectors
- `sentinel-core` artifact review
- `sentinel-domain-packs`
- `observability` recorder and sinks
- `codex-adapter`
- `pne-warehouse-intelligence` plugin scaffold with MCP and CLI bridge
- `pne-bridge` CLI with `init`, `connect`, real connector configs, `capabilities`, `environment`, `sources`, `resources`, `tool`, `serve`, `mcp`, `cache clear`
- hosted inventory tools for workspaces, projects and project analysis status

Still to harden:

- first-class hosted mutation tools such as `run_runtime`, override management and training triggers
- hosted `/analyze` endpoint alignment with the universal envelope
- installer script for `curl -fsSL ... | sh`
- published `npx @statsparrot/pne` package
