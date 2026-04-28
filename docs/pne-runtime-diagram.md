# PNE Runtime Diagram

Acest document descrie fluxul actual pentru `PNE`, `Sentinel`, `analytics_worker`, backend și frontend.

## Overview

```mermaid
flowchart TD
    A["OrchestrationService.runRuntime()<br/>sentry-backend"] --> B["ParrotRuntimeService.bootstrapRun()"]
    B --> C["PNE compile_execution_score<br/>modal_apps/pne.py"]
    C --> D["PNE align_execution_score"]
    D --> E["Sentinel alignment / policy"]
    E --> F["ParrotRuntimeService.compileProjectionPlan()"]
    F --> G["PNE compile_projection_plan<br/>build_projection_plan_logic()"]

    G --> H["projection_builder.py<br/>build projectionSpecs"]
    G --> I["gemini.py<br/>generate candidate querySpecs"]
    G --> J["query_builder.py<br/>normalize widget + SQL contract"]
    G --> K["worker_tools.py<br/>runtime validation via analytics_worker"]
    G --> L["widgets.py<br/>manifest / payload validation"]
    G --> M["observability.json<br/>tmp + R2"]

    K --> N["analytics_worker<br/>execute DuckDB SQL"]
    N --> G

    G --> O["ParrotProjectionPlan"]
    O --> P["ParrotRuntimeService.buildRuntimeInvalidationHints()"]
    P --> Q["SentinelModelSuite"]
    Q --> R["BusinessRelevanceModel"]
    Q --> S["QueryRiskModel"]
    Q --> T["CoverageRanker"]
    Q --> U["DriftClassifier"]
    Q --> V["InteractionPolicyModel"]

    R --> W["Filter low-relevance querySpecs"]
    S --> X["Add query risk hints"]
    T --> Y["Add coverage signals"]
    U --> Z["Add drift hints"]
    V --> AA["Add policy signals"]

    W --> AB["MindMapManifestService / compact discovery"]
    X --> AB
    Y --> AB
    Z --> AB
    AA --> AB

    AB --> AC["project.discoveryMetadata"]
    AB --> AD["project.queryConfigs"]

    AC --> AE["AnalyticsService.getDashboardData()"]
    AD --> AE
    AE --> AF["analytics_worker executes widget SQL"]
    AF --> AG["WidgetDataMapper"]
    AG --> AH["/api/dashboard/:projectId"]
    AH --> AI["Frontend insights / micrographics"]
```

## Main Responsibilities

```mermaid
flowchart LR
    PNE["PNE"] --> PNE1["Plan projections"]
    PNE --> PNE2["Generate candidate widgets"]
    PNE --> PNE3["Normalize SQL to widget contract"]
    PNE --> PNE4["Validate runtime payloads"]

    SENT["Sentinel"] --> S1["Alignment"]
    SENT --> S2["Invalidation hints"]
    SENT --> S3["Risk scoring"]
    SENT --> S4["Business relevance scoring"]

    WORKER["analytics_worker"] --> W1["Run DuckDB SQL"]
    WORKER --> W2["Return widget rows"]

    BACK["Backend"] --> B1["Persist discoveryMetadata"]
    BACK --> B2["Build queryConfigs"]
    BACK --> B3["Hydrate dashboard responses"]

    FE["Frontend"] --> F1["Render widgets"]
    FE --> F2["Defensive shape normalization"]
```

## Current Decision Flow

```mermaid
sequenceDiagram
    participant ORCH as OrchestrationService
    participant PRT as ParrotRuntimeService
    participant PNE as PNE
    participant GEM as Gemini
    participant WRK as analytics_worker
    participant SEN as SentinelModelSuite
    participant ANA as AnalyticsService
    participant FE as Frontend

    ORCH->>PRT: bootstrapRun()
    PRT->>PNE: compile_execution_score
    PNE-->>PRT: execution_score
    PRT->>PNE: align_execution_score
    PNE-->>PRT: aligned execution_score

    ORCH->>PRT: compileProjectionPlan(runtimeState)
    PRT->>PNE: compile_projection_plan
    PNE->>GEM: generate widget candidates
    GEM-->>PNE: draft query specs
    PNE->>WRK: validate each candidate at runtime
    WRK-->>PNE: rows / parser errors / binder errors
    PNE-->>PRT: projectionPlan + observability

    PRT->>SEN: evaluateRuntime(querySpecs, sources, policy)
    SEN-->>PRT: hints + model signals
    PRT->>PRT: filter low business relevance querySpecs

    ORCH->>ORCH: save discoveryMetadata + queryConfigs
    ANA->>WRK: execute widget SQL for dashboard
    WRK-->>ANA: result rows
    ANA-->>FE: hydrated dashboard payload
    FE-->>FE: render widgets safely
```

## Important Notes

- `PNE` este generatorul principal de `querySpecs`.
- `Sentinel` nu mai este doar observator; acum poate filtra query-uri cu relevanță mică pentru dashboardul principal.
- `analytics_worker` este singura sursă de execuție SQL pentru validarea runtime și pentru dashboard hydration.
- `projectionSpecs` există logic și pot influența sursa SQL, dar query-urile finale tot trebuie să fie SQL executabil real pentru worker.
- `observability` este produs în `PNE` și urcat în `R2` pentru debugging persistent.

## Key Files

- `modal_apps/pne.py`
- `modal_apps/pne_core/planner.py`
- `modal_apps/pne_core/gemini.py`
- `modal_apps/pne_core/query_builder.py`
- `modal_apps/pne_core/widgets.py`
- `modal_apps/pne_core/worker_tools.py`
- `sentry-backend/src/application/services/ParrotRuntimeService.ts`
- `sentry-backend/src/application/services/OrchestrationService.ts`
- `sentry-backend/src/application/services/SentinelModels.ts`
- `sentry-backend/src/application/services/AnalyticsService.ts`
- `sentry-frontend/src/components/visuals/Insights.jsx`
