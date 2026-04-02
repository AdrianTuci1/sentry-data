# Stats Parrot

Stats Parrot is a fully agnostic DataOS.

It aligns user data to user interests without violating privacy, using metadata instead of exposing raw business data to the reasoning layer. The same system can be used for ecommerce, marketing, BI, banking, cybersecurity, LLM training, logistics, and other big data workloads.

## What It Does

- ingests raw data into Bronze,
- discovers structure and meaning from metadata,
- compiles virtual transformations directly from Bronze,
- generates groups, insights, widget queries, and recommended actions,
- can push outputs through Reverse ETL with strict safety controls.

The goal is simple: one control plane for discovery, analytics, recommendations, and operational outputs.

## Core Innovation

### Parrot Neural Engine

`Parrot Neural Engine` is the translator of the system.

Instead of forcing a rigid Bronze -> Silver -> Gold persistence chain, it reads Bronze directly and compiles:

- virtual transformations,
- virtual gold views,
- query logic,
- feature logic,
- output recommendations.

This is the main architectural shift: the system stores less intermediate data and stores more metadata, intent, and execution state.

### Sentinel

`Sentinel` is the decision and validation layer.

It checks whether the engine is still aligned with reality:

- schema drift,
- semantic drift,
- quality anomalies,
- invalid user edits,
- unsafe Reverse ETL actions.

If a change is wrong, unsafe, or inconsistent, Sentinel rejects it or asks for a re-plan.

## Privacy Model

Stats Parrot is designed to reason primarily over metadata:

- inferred schema,
- semantic tags,
- column roles,
- source freshness,
- quality signals,
- feature definitions,
- query definitions,
- intent and edit history.

The point is to align data to the user's goals without turning the reasoning layer into a raw-data leak.

## Architecture

The runtime has five roles:

- `sentry-meltano`: ingestion head
- `sentry-backend`: control body
- `parrot-neural-engine`: translator
- `sentinel`: validation and decision layer
- `reverse-etl head`: secure outbound layer

### Current State

Today, `Parrot Neural Engine` still uses Modal as the execution substrate.

That means the architecture is already split at the control layer, but the final execution runtime is not fully moved yet to dedicated user-owned VM orchestration.

### Target State

The intended execution stack is:

- `Kubernetes` for orchestration,
- `Ray` for distributed scheduling,
- `Daft` for fast data execution,
- isolated VM-style execution for outbound and heavy jobs.

So the innovation is already in the translation and decision model, while the full compute substrate is still being completed.

## Why It Is Different

Classic systems break when schemas drift, duplicate data into too many layers, and hide compute power behind hard engineering work.

Stats Parrot does the opposite:

- it adapts to change,
- it keeps transformations virtual as much as possible,
- it lets the user shape the system through intent,
- it can expose the actual logic instead of pretending to be magic.

## Mindmap Model

The platform can expose the project as a layered mindmap:

```yaml
sources:
transformations:
gold:
groups:
insights:
```

Recommended structure:

- `sources`, `transformations`, and `gold` are tracked per source
- `groups` and `insights` are global, because they can combine multiple sources

This gives the user one editable model of the whole system.

## Intent and Code

The user can manipulate every layer of the mindmap in two ways:

- by changing **intent**
- by changing **code**

### Intent Editing

Intent means changing what the system should do, not how every line is written.

Examples:

- "normalize dates from this source"
- "create a gold view for customer lifetime"
- "recommend an ML model but do not launch it"
- "prepare Reverse ETL for Salesforce only"

The engine recompiles the logic from that intent.

### Code Editing

The user can also inspect and edit the calculation logic directly:

- transformation logic,
- feature logic,
- query logic,
- Reverse ETL logic.

That matters because the product should not feel like a toy. The user must be able to see the real logic, challenge it, and edit it.

### Sentinel Guardrails

If the user changes intent or code:

- `Sentinel` validates the structure,
- rejects broken or unsafe logic,
- accepts valid updates,
- or forces a re-plan.

So the system is editable, but not uncontrolled.

## ML Model Strategy

ML models do not need to launch automatically.

The preferred approach is:

- detect candidate ML opportunities,
- surface them as a blue group such as `ML Recommended`,
- let the user inspect the reason, proposed features, and expected output,
- launch only after manual confirmation.

The same pattern applies to `Reverse ETL Recommended`.

This keeps the system powerful without making hidden decisions for the user.

## Reverse ETL Security

Reverse ETL is dangerous if uncontrolled because it can launch outbound execution and affect third-party systems.

Stats Parrot uses multiple protections:

- DNS TXT verification to prove domain ownership
- VM launch tied to verified user ownership
- rate limiting
- stop conditions for errors like `not allowed` and `too many requests`
- hard limits before expanded outbound execution is allowed

Current rule of thumb:

- no outbound VM launch without DNS verification
- stop after repeated permission or rate-limit failures
- cap unverified outbound execution aggressively

The point is to prevent malicious or careless actors from turning Reverse ETL into an abuse vector.

## Supported Needs

Stats Parrot is built for any metadata-driven big data workload, including:

- ecommerce
- marketing
- BI
- banking
- cybersecurity
- LLM training
- logistics
- and other high-volume analytical systems

## Summary

Stats Parrot is a metadata-driven DataOS.

`Parrot Neural Engine` compiles the logic.

`Sentinel` protects the truth.

The user controls the system through intent or direct code.

Reverse ETL is powerful but constrained by verification and safety rules.

The decision layer is already here. The full execution layer is moving from Modal toward `K8s + Ray + Daft + isolated VM execution`.
