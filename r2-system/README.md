# R2 System

`r2-system` is the source tree for runtime assets that are safe to publish into R2 under `system/r2-system/...`.

It replaces the old `boilerplates` directory. The old agent manager, task templates, and prompt files were removed because the current runtime no longer asks an LLM to edit and execute arbitrary ETL scripts.

## Valid Assets

- `widgets/`: widget manifests, component artifacts, catalog indexes, and `generate-artifacts.mjs`.
- `prompts/runtime/`: prompts consumed by Modal PNE and Sentinel services.
- `scaffolds/modal/`: current Modal service contracts and deterministic execution envelopes.

## R2 Layout

```text
system/r2-system/widgets/...
system/r2-system/prompts/runtime/...
system/r2-system/scaffolds/modal/...
```

## Runtime Policy

Agents should not be forced through stale Python task boilerplates. The current control plane compiles projections, query specs, ML recommendations, and Sentinel validation hints as typed runtime contracts. Modal services execute deterministic service code and may read prompts or scaffold contracts from this directory, but they should not mutate raw customer data or create hidden ETL layers.
