# Python Runtime Scaffolds

These scaffolds are mounted only by Modal apps. They are not backend code and they are not old free-form agent tasks.

Modal services use this package to keep execution deterministic:

- `r2_system_scaffolds.duckdb_runtime`: shared DuckDB connection, lease, keepalive, and query helpers.
- `r2_system_scaffolds.ml_registry`: approved ML workflow registry.
- `r2_system_scaffolds.ml_workflows/*`: Python workflow scaffolds that an ML agent may parameterize, but should not replace with code generated from zero.

The backend remains a separate service. It calls Modal endpoints and receives status, results, metadata, and model artifact references.

## Runtime Rule

Agents can modify parameters, selected columns, SQL, model hyperparameters, and approved extension points. They should not rewrite these scaffolds at runtime or bypass their guardrails.
