# Application Layer Architecture

This document describes the core architecture of the `sentry-backend` application layer, specifically focusing on the unified data pipeline orchestration.

```mermaid
flowchart TD
    %% Define Styles
    classDef service fill:#f9f,stroke:#333,stroke-width:2px;
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
        
        %% Runners
        subgraph Pipeline ["pipeline/"]
            PR["PipelineRunner"]:::runner
            MR["MLPathRunner"]:::runner
            
            AE["AgentExecutor"]:::executor
            TT["TokenTracker"]
            CV["CoreVitalsCollector"]
            SF["SchemaFingerprint"]
        end
    end

    %% Flow
    OS -->|"execute(context)"| PR
    OS -->|"execute(context)"| MR
    SF -.->|"Compute Delta"| PR
    
    PR -->|"Per-Source Blocks"| AE
    MR -->|"Architecture/Trainer/Inference"| AE

    %% Telemetry
    AE -->|"Record Usage"| TT
    OS -->|"Generate Report"| CV

    %% External Dependencies
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
- **`OrchestrationService`**: The primary coordinator. It triggers the `PipelineRunner` for the ETL phase and optionally the `MLPathRunner` for predictions. It manages high-level discovery aggregation and telemetry persistence.
- **`PipelineConfig`**: Centralized configuration for feature toggles (e.g., enabling/disabling the ML path).

### Smart Execution
- **`PipelineRunner`**: The "brain" of the ETL phase. It uses **`SchemaFingerprint`** to detect schema drift or new sources and executes parallel ETL blocks (Normalization -> Feature Engineering) for each source. It identifies cache hits vs misses per-source, ensuring minimal token usage for existing data.
- **`MLPathRunner`**: Specialized runner for executing advanced modeling. It designs strategy (Architect), trains models (Trainer), and generates predictions (Inference) in a unified, multi-source aware manner.

### Agent Execution & Auditing
- **`AgentExecutor`**: The bridge to isolated microVMs (Modal). It handles script deployment, environment injection, and maps agent outputs (`AGENT_DISCOVERY`, `AGENT_RESULT`) back to the application context.
- **`TokenTracker`**: Audits and estimates token consumption from LLM-driven tasks.
- **`CoreVitalsCollector`**: Collects performance metrics and execution details for each pipeline run.
