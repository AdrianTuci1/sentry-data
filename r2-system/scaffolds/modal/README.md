# Modal Scaffolds

These files describe the deterministic execution envelopes Modal apps must honor.

They are not old-style agent templates. PNE, Sentinel, Analytics Worker, and ML Executor may use them as contracts for validation, prompt grounding, and artifact shape checks. The service code remains in `modal_apps/`.

## Contracts

- `pne_projection_plan.contract.json`: projection/query/ML plan compiler envelope.
- `sentinel_runtime_evaluation.contract.json`: invalidation and policy signal envelope.
- `ml_executor_manual_launch.contract.json`: manual ML execution envelope.

The backend mirrors these contracts in TypeScript types under `sentry-backend/src/types/parrot.ts`.
