# PNE Next-Phase Plan

## Goal

Move PNE from a usable universal bridge to a guided, adaptive system that can:

- onboard a user from zero connector state to a working warehouse connection,
- let an external code-editor agent navigate the whole product through tools,
- preserve warehouse-native intelligence for analytics,
- prepare a clean path for a second vertical such as cybersecurity research,
- version logic artifacts in GitHub without turning GitHub into a runtime cache.

This phase assumes the current branch already has:

- `pne-bridge` with `CLI`, `MCP`, `HTTP`,
- hosted control-plane and dashboard inspection tools,
- local connector setup for `BigQuery`, `Snowflake`, `DuckDB`, `DuckDB + R2`, `Postgres`,
- basic setup and connector testing tools.

## Product Decisions

### 1. Agent Model

PNE remains a bridge, not an autonomous agent.

The host agent:

- understands the user request,
- decides which PNE tools to call,
- explains status and tradeoffs to the user,
- decides when to ask a clarifying question.

PNE:

- exposes environment, control-plane, runtime, dashboard and warehouse tools,
- returns structured evidence and next actions,
- does deterministic planning, execution, validation and review.

### 2. Cybersecurity Direction

Cybersecurity should **not** be a fork of the current analytics product right now.

It should begin as:

- a new vertical package family in the same modular stack,
- a new domain pack plus playbooks,
- a different artifact taxonomy and review policy,
- a separate product surface later if workflows diverge too much.

Recommended shape:

- keep `pne-core`, `connector-sdk`, `sentinel-core`, `observability`,
- add `sentinel-domain-pack-cyber`,
- add `agent-playbooks/cybersecurity`,
- evaluate later whether a separate repo is needed.

### 3. GitHub for Registries, Not Runtime Cache

GitHub should store:

- projection definitions,
- query definitions,
- playbooks,
- domain-pack metadata,
- connector recipes,
- lightweight manifests and versioned logic.

GitHub should **not** store:

- materialized query results,
- warehouse extracts,
- feedback event streams,
- hot runtime cache,
- large artifact payloads.

Runtime cache should stay in:

- local bridge cache,
- hosted object storage,
- lightweight DB/state stores when needed.

## Workstreams

## Workstream A: Agent Playbooks

### Objective

Make Codex or another host agent behave like a good guided operator from first contact to usable data.

### New Module

Add a new package:

- `packages/agent-playbooks`

Suggested contents:

- `src/core.ts`
- `src/playbooks/setup.ts`
- `src/playbooks/hosted.ts`
- `src/playbooks/bigquery.ts`
- `src/playbooks/duckdb-r2.ts`
- `src/playbooks/project-inspection.ts`
- `src/playbooks/analysis.ts`
- `src/types.ts`

### Responsibilities

- map environment states to next-step instructions,
- propose the next tool call candidates for the host agent,
- turn PNE tool outputs into agent-facing guidance,
- encode fallback and recovery logic,
- remain deterministic and versionable.

### First Playbooks

1. `bootstrap_no_connector`
- use `pne_get_setup_guide`
- use `pne_check_local_prerequisites`
- recommend the best connector path

2. `connect_bigquery`
- verify `bq`
- configure connector
- test connector
- inspect sources

3. `connect_duckdb_r2`
- verify `duckdb`
- verify R2 env vars or explicit settings
- configure `duckdb-r2`
- test connector
- inspect sources

4. `hosted_workspace_navigation`
- inspect account snapshot
- inspect environment
- list workspaces
- list projects
- inspect project status

5. `project_needs_runtime`
- inspect sources
- suggest adding/discovering sources
- run runtime
- inspect formulas, lineage, analytics

6. `analysis_readiness`
- decide if the project is ready for `pne_analyze_question`
- explain why not if blocked

### Output Shape

Playbooks should return:

- `status`
- `recommendedToolCalls`
- `userExplanation`
- `blockingIssues`
- `recoveryActions`

### Acceptance Criteria

- host agent can guide a user from no connector to tested connector without improvising the flow,
- host agent can decide whether to guide toward hosted mode or local BYO mode,
- host agent can explain why analysis is or is not ready.

## Workstream B: Adaptive Memory and Session Guidance

### Objective

Let the bridge and playbooks become adaptive without turning them into an opaque agent.

### Additions

Extend local and hosted state with:

- session memory,
- last successful connector choice,
- preferred connector path,
- recurring warehouse/project targets,
- prior failures and recovery steps.

### Local Memory Artifacts

Suggested files:

- `~/.pne/config.json`
- `~/.pne/cache.json`
- `~/.pne/session.json`

Suggested session data:

- `lastConnectorId`
- `recentProjects`
- `recentQuestions`
- `lastFailedStep`
- `lastPlaybook`
- `preferredMode`

### Rules

- session memory should be small and human-readable,
- memory should be tool-visible,
- no hidden long-term model memory in local mode,
- explicit versioning for memory schema.

### Acceptance Criteria

- if a user fails BigQuery setup once, the next guided step knows where it failed,
- if a user uses the same hosted workspace repeatedly, the agent can resume there quickly,
- no opaque non-versioned memory blobs.

## Workstream C: Cybersecurity Research Vertical

### Objective

Support warehouse-native cyber investigation without polluting the ecommerce/BI assumptions.

### New Packages

- `packages/sentinel-domain-pack-cyber`
- `packages/cyber-artifacts`
- `packages/agent-playbooks-cyber` or `agent-playbooks/src/playbooks/cyber/*`

### Artifact Taxonomy

Current analytics artifacts focus on:

- projections,
- queries,
- insights,
- widgets,
- recommendations.

Cyber should add:

- `event_stream`
- `ioc_set`
- `asset_inventory`
- `identity_inventory`
- `incident_hypothesis`
- `timeline`
- `correlation_rule`
- `detection_candidate`
- `investigation_claim`

### Review Criteria

`sentinel-core` plus `cyber pack` should score:

- evidence quality,
- source coverage,
- false positive risk,
- false negative risk,
- confidence,
- severity inflation,
- blast radius uncertainty,
- time-window mismatch,
- IOC quality.

### Connector Needs

Cyber likely needs more than classic SQL warehouses over time:

- BigQuery and Snowflake still matter,
- DuckDB over parquet logs matters,
- future connectors may include SIEM-export tables or lakehouse logs.

### Recommendation

Phase the cyber work like this:

1. start in the same mono-repo,
2. build a separate domain pack and playbooks,
3. prove the artifact model,
4. only split to a dedicated product surface if user workflows diverge sharply.

### Acceptance Criteria

- no ecommerce heuristics leak into cyber flows,
- cyber claims are evidence-first,
- the agent can say “insufficient coverage” instead of pretending certainty.

## Workstream D: GitHub-Backed Registries

### Objective

Version logic artifacts and reviewable changes in GitHub while keeping runtime execution state outside Git.

### New Module

Add:

- `packages/github-registry-sync`

### GitHub-Tracked Artifacts

Store in GitHub:

- `projectionSpecs`
- `querySpecs`
- `playbooks`
- `sentinel domain packs`
- `connector recipes`
- `manifest snapshots`
- lightweight environment summaries when useful

Suggested repo layout:

```text
registry/
  workspaces/
    <workspace-id>/
      projects/
        <project-id>/
          projections/
          queries/
          playbooks/
          manifests/
          metadata/
```

### Sync Modes

1. `local export`
- bridge exports current logic to a Git working tree

2. `hosted sync`
- hosted runtime writes reviewed logic artifacts to a GitHub repo or branch

3. `PR mode`
- material changes create a branch and PR instead of writing directly to default branch

### What Not To Sync

- runtime query results,
- dashboard payload caches,
- event feedback logs,
- warehouse snapshots,
- large generated artifacts.

### Acceptance Criteria

- projection/query logic is diffable and reviewable in GitHub,
- runtime still works without GitHub,
- GitHub sync failure does not block analysis runtime.

## Workstream E: Agent-Friendly Runtime Polling

### Objective

Expose runtime progress without forcing agents to own raw SSE transport.

### New Bridge Tools

Add later:

- `pne_list_runtime_requests`
- `pne_get_runtime_request_status`
- `pne_get_runtime_request_artifacts`
- `pne_poll_runtime_request`

These should read from hosted runtime progress artifacts and normalize them for tool-calling.

### Why

The remaining gap in “all zones navigable” is not raw SSE itself. It is the lack of an agent-friendly polling abstraction over runtime state.

### Acceptance Criteria

- the host agent can monitor a runtime run through repeated tool calls,
- no direct SSE stream parsing is required in the host agent.

## Execution Order

### Phase 1

- add `agent-playbooks` package
- add setup/navigation playbooks
- add `session.json` local memory schema
- add bridge tool to read session state

### Phase 2

- add runtime polling tools
- integrate playbooks into plugin skill instructions
- expose “recommended next tool calls” in a formal schema

### Phase 3

- add `github-registry-sync`
- support export of projections/queries/playbooks to Git layout
- add hosted optional sync mode

### Phase 4

- add `sentinel-domain-pack-cyber`
- add cyber artifact taxonomy
- add cyber-specific playbooks

## Immediate Next Changes

The next concrete coding slice should be:

1. create `packages/agent-playbooks`
2. add:
   - `pne_get_session_state`
   - `pne_reset_session_state`
   - `pne_get_recommended_next_steps`
3. make the plugin skill use those tools first
4. add runtime polling tools after that

## Compatibility Rule

Every addition must keep the existing hosted path intact:

`UI -> backend -> Modal PNE -> analytics_worker -> Sentinel -> dashboard`

New modules should sit beside the hosted path first, then be adopted gradually.
