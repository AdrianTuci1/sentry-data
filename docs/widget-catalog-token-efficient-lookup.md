# Token-Efficient Widget Catalog Lookup for LLMs

## Short Answer

Yes. The LLM should not read the full widget catalog and all manifests as prompt text.

The efficient pattern is:

1. Use a small lookup layer to resolve intent into a shortlist of widget IDs.
2. Read only the catalog entries for those shortlisted widgets.
3. Fetch only the manifest for the final selected widget, or at most the top 2-3 finalists.

In other words, the artifacts stay in storage, while the LLM only sees the minimum subset needed for the decision.

## Why Token Waste Happens

Token waste appears when we do one of these:

- paste the full `catalog.yml` into the prompt
- paste the full `index.yml` into the prompt
- paste all manifests before the model has picked a widget
- ask the LLM to semantically search raw YAML by itself

That approach makes the model spend tokens on retrieval instead of on planning the SQL.

## Recommended Retrieval Architecture

Use the artifacts in three layers:

1. `index.yml`
2. `catalog.yml`
3. `*/manifest.yml`

Each layer has a different purpose.

### 1. `index.yml` is the lookup layer

Use [index.yml](/Users/adriantucicovenco/Proiecte/sentry-data/boilerplates/widgets/index.yml) for cheap resolution:

- alias -> canonical widget id
- runtime type -> canonical widget id
- component id override -> canonical widget id
- widget id -> manifest path

This file is not meant to be fully injected into the LLM prompt either. It should be read by the orchestrator or a small helper tool that returns only the resolved result.

Example:

- `animated-line` -> `live-traffic`
- `marketing-roas` -> `metric-trend`
- `light-dial` -> `color-slider`

### 2. `catalog.yml` is the shortlist layer

Use [catalog.yml](/Users/adriantucicovenco/Proiecte/sentry-data/boilerplates/widgets/catalog.yml) to rank a small set of candidates.

Each entry contains only lightweight decision metadata:

- `id`
- `title`
- `description`
- `category`
- `selection_hints`
- `aliases`
- `manifest_path`

This is enough to answer:

- Which widgets are plausible for this analytical intent?
- Which 3 widgets should the LLM compare?
- Which widget is the best fit before reading the full SQL contract?

### 3. `manifest.yml` is the contract layer

Use the widget manifest only after the candidate is chosen.

Each manifest contains the expensive technical details:

- `sql_aliases`
- `data_structure_template`
- `query_guidance`
- `insight_payload_contract`

This is the part the LLM needs for SQL generation, but only for the final widget choice.

## Best Practice: Two-Stage or Three-Stage Retrieval

### Stage A: Resolve the user intent into widget ids

The orchestration layer should do one of these:

- exact match on widget id
- alias lookup
- runtime type lookup
- component id override lookup
- keyword scoring over catalog metadata

The LLM should receive only a compact shortlist like:

```json
[
  {
    "id": "metric-trend",
    "title": "Metric Trend",
    "description": "Single KPI card with optional unit and period-over-period delta."
  },
  {
    "id": "sparkline-stat",
    "title": "Sparkline Stat",
    "description": "KPI with a small sparkline showing recent movement."
  },
  {
    "id": "signal-scale",
    "title": "Signal Scale",
    "description": "Segmented signal gauge for directional quality or intensity."
  }
]
```

That is much cheaper than sending the whole catalog.

### Stage B: Let the LLM choose one widget

Now the LLM decides which widget best matches the analysis goal.

At this stage it does not need:

- full manifests
- all aliases for all widgets
- all SQL examples for all widgets

It only needs the shortlist.

### Stage C: Fetch one manifest on demand

After the LLM picks the widget, fetch exactly one manifest and give the model only that contract.

Example:

1. LLM chooses `real-mapbox`
2. orchestrator resolves manifest path from `index.yml`
3. orchestrator fetches `geospatial/real-mapbox/manifest.yml`
4. LLM generates SQL according to `sql_aliases`

This keeps the prompt narrow and task-specific.

## The Key Rule

Artifacts should be searched by code, not by the LLM token-by-token.

The LLM should reason about a small answer returned from a retrieval layer, not about the raw full artifact set.

## What This Looks Like In Practice

### Preferred flow

1. User asks for an insight.
2. A resolver function searches `index.yml` and `catalog.yml`.
3. Resolver returns top 3 candidates.
4. LLM picks one.
5. Resolver fetches only that widget manifest.
6. LLM writes SQL using `sql_aliases`.
7. SQL result is placed under `data`.

### Anti-pattern

1. Load full catalog into prompt.
2. Load full index into prompt.
3. Load many manifests "just in case".
4. Ask the LLM to figure it out from raw YAML.

That is accurate but expensive.

## What We Already Have In This Repo

We already have the right building blocks:

- [index.js](/Users/adriantucicovenco/Proiecte/sentry-data/boilerplates/widgets/index.js)
  Exports the canonical widget inventory and lookup helpers.
- [catalog.yml](/Users/adriantucicovenco/Proiecte/sentry-data/boilerplates/widgets/catalog.yml)
  Stores lightweight catalog metadata per widget.
- [index.yml](/Users/adriantucicovenco/Proiecte/sentry-data/boilerplates/widgets/index.yml)
  Stores lookup tables for aliases, runtime types, component ids and manifest paths.
- [query_generator.py](/Users/adriantucicovenco/Proiecte/sentry-data/boilerplates/tasks/query_generator.py)
  Already knows how to resolve selected widgets through `catalog.yml` and `index.yml`.

## Recommended Runtime Pattern

The best runtime design is:

- keep `catalog.yml` and `index.yml` outside the LLM prompt
- expose a small resolver tool or service
- return only compact search results to the LLM
- fetch manifest content only when the widget is selected

This can be implemented as:

- a backend endpoint
- an MCP tool
- an in-process helper used by the orchestration layer

## Minimal Resolver Interface

A practical interface looks like this:

### `search_widgets(query, limit=5)`

Returns:

```json
[
  {
    "id": "lead-clustering",
    "title": "Lead Clustering",
    "description": "2D scatter for ML clusters and named points.",
    "manifest_path": "ml/lead-clustering/manifest.yml"
  }
]
```

### `get_widget_manifest(widget_id)`

Returns only the chosen manifest.

This keeps the expensive contract fetch out of the initial prompt.

## Recommended Ranking Strategy

Use cheap deterministic ranking before calling the LLM:

1. exact widget id match
2. alias match
3. runtime type match
4. component id override match
5. keyword score over:
   - title
   - description
   - selection hints
   - aliases
   - category

The model should receive only the top few candidates after this pass.

## Why This Works Well

This pattern is efficient because:

- YAML artifacts remain machine-readable source material
- retrieval is deterministic and cheap
- the LLM spends tokens on selection and SQL design
- manifests are only loaded when they matter
- the contract stays precise because the final step still uses the full manifest

## Practical Conclusion

Yes, the LLM can search the catalog without wasting tokens, but only if the search is done outside the prompt.

The right mental model is:

- `index.yml` for resolution
- `catalog.yml` for shortlisting
- `manifest.yml` for final execution contract

The LLM should never be the raw retrieval engine for all widget artifacts. It should be the decision and generation engine on top of a small retrieved subset.
