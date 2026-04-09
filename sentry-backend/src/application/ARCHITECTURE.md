# Application Architecture

`sentry-backend` is now a Parrot OS control plane, not a DAG orchestrator.

## Runtime Flow

1. `sentry-meltano` or a customer-owned object store lands raw source data.
2. `OrchestrationService` starts a Parrot runtime request.
3. `ParrotNeuralEngineService` builds the execution score.
4. `SentinelClient` aligns and validates the score.
5. `BronzeDiscoveryService` infers source metadata directly from Bronze.
6. `WorkloadPlannerService` chooses `modal` or `ray_daft`.
7. `ExecutionPlaneService` submits the plan to the execution control plane.
8. `MindMapManifestService` generates the source-to-insight mindmap manifest and YAML.
9. `ReverseEtlHeadService` stages governed Reverse ETL outputs and receipts.

## Core Services

- `OrchestrationService`: top-level runtime coordinator.
- `ParrotRuntimeService`: request lifecycle, progress, artifacts, and project runtime state.
- `ParrotNeuralEngineService`: translator/compiler for Bronze-first execution logic.
- `SentinelClient`: alignment and safety validation.
- `BronzeDiscoveryService`: schema, semantic typing, and zero-ETL source metadata discovery.
- `WorkloadPlannerService`: execution sizing and provider selection.
- `ExecutionPlaneService`: submission to Modal or Ray/Daft control planes.
- `MindMapManifestService`: frontend-facing mindmap structure, YAML, and editable logic.
- `ReverseEtlHeadService`: DNS-gated Reverse ETL policy and receipts.

## Persistence

- Client/project runtime artifacts are stored in object storage under `runtime/...`.
- DynamoDB keeps higher-level project state, runtime pointers, and commercial metadata.
- Queryable zero-ETL projections should live under `projections/...` rather than materialized `silver/gold` copies.
- Reverse ETL stays guarded by DNS TXT ownership checks, VM limits, and stop conditions.

## Execution Plane

- `Node.js` stays in the control plane.
- Heavy execution belongs to `Modal` or `Kubernetes + Ray + Daft`.
- The Python analytics worker now exposes a minimal execution control plane for plan submission and status tracking until the full K8s/Ray control plane is in place.
