# Application Layer Architecture

This document describes the core architecture of the `sentry-backend` application layer, specifically focusing on the data pipeline orchestration and agent execution flow.

```mermaid
flowchart TD
    %% Define Styles
    classDef service fill:#f9f,stroke:#333,stroke-width:2px;
    classDef resolver fill:#bbf,stroke:#333,stroke-width:2px;
    classDef runner fill:#bfb,stroke:#333,stroke-width:2px;
    classDef executor fill:#fbb,stroke:#333,stroke-width:2px;
    classDef config fill:#ddd,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5;

    %% Entry Points
    API["REST / GraphQL Webhooks"] --> OS
    Cron["Scheduled Jobs / Cron"] --> OS

    %% Orchestration & Config
    PC(["PipelineConfig"]):::config -.-> OS
    PC -.-> PR
    
    subgraph ApplicationLayer ["src/application/"]
        OS["OrchestrationService"]:::service
        PR{"PathResolver"}:::resolver
        
        %% Runners
        subgraph Pipeline ["pipeline/"]
            HR["HotPathRunner"]:::runner
            CR["ColdPathRunner"]:::runner
            MR["MLPathRunner"]:::runner
            
            AE["AgentExecutor"]:::executor
            TT["TokenTracker"]
            CV["CoreVitalsCollector"]
            SF["SchemaFingerprint"]
        end
    end

    %% Flow
    OS -->|"runPipeline(context)"| PR
    SF -.->|"Compute Hash"| PR
    
    PR -->|"Path: 'hot'"| HR
    PR -->|"Path: 'cold'"| CR
    PR -->|"Path: 'ml'"| MR

    %% Executor relationship
    HR -->|"Execute Cached Task"| AE
    CR -->|"Execute Generative Task"| AE
    MR -->|"Execute Architecture/Trainer Task"| AE

    %% Telemetry
    AE -->|"Record Usage"| TT
    OS -->|"Generate Report"| CV

    %% External Dependencies (Conceptual)
    subgraph External ["Infrastructure / MicroVMs"]
        Modal["Modal Sandboxes"]
        Dynamo[("DynamoDB ProjectEntity")]
        R2[("Cloudflare R2 Storage")]
    end

    AE -->|"Deploy & Run agent_manager.py"| Modal
    OS -->|"Save Vitals & Discovery"| Dynamo
    AE -.->|"Read/Write Scripts"| R2
```

## Component Overview

### Core Orchestration
- **`OrchestrationService`**: The entry point for all pipeline executions. It acts as a thin coordinator, receiving a trigger, invoking the `PathResolver`, and delegating the actual work to the appropriate runner based on the resolved path. It handles saving the final discovery metadata and telemetry vitals to the database.
- **`PipelineConfig`**: A centralized configuration file used to manually override pipeline behavior (e.g., force a Hot Path run for development purposes, disable ML paths for quick testing).

### Pipeline Resolution
- **`PathResolver`**: Analyzes the `PipelineContext` (tenant, project state, schema hashes) to determine the optimal execution path:
    - Checks if forced validation is requested.
    - Uses **`SchemaFingerprint`** to detect schema drift (Cold Path).
    - Checks script cache validity (Hot Path).
    - Checks scheduling configurations (ML Path).

### Path Runners
- **`HotPathRunner`**: Executes the pipeline entirely from verified, cached scripts stored in R2. Zero LLM tokens are used. Fastest execution path.
- **`ColdPathRunner`**: The fallback when schemas change or cache is missed. Runs the full generative DAG, including Source Classification and structural data discovery (Bronze -> Silver -> Gold).
- **`MLPathRunner`**: Specialized runner for executing advanced modeling. Operates in two steps: 
    1. Runs the *ML Architect* to strategically decide the model type (Regression, Classification, etc.).
    2. Runs the *ML Trainer* by injecting the corresponding boilerplate python snippet.

### Agent Execution & Auditing
- **`AgentExecutor`**: The crucial link between the Node.js backend and the isolated microVMs (Modal). It handles the sandbox lifecycle, injects variables, executes the python scripts, catches standard output, and maps standard print logs (`AGENT_DISCOVERY`, `AGENT_RESULT`) back into structured TypeScript objects.
- **`TokenTracker`**: Estimates token usage based on the log byte size outputted by `AgentExecutor` and records it for billing/informational purposes.
- **`CoreVitalsCollector`**: Aggregates latency, cache hit rates, and pathway choices into a final report saved on the project.
