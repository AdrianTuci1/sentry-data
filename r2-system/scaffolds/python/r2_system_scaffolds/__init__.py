"""Runtime scaffolds mounted into StatsParrot Modal apps."""

from .duckdb_runtime import DuckDBRuntimePool, QuerySpec, storage_config_from_mapping
from .ml_registry import WORKFLOW_SPECS, resolve_workflow, workflow_summary

__all__ = [
    "DuckDBRuntimePool",
    "QuerySpec",
    "WORKFLOW_SPECS",
    "resolve_workflow",
    "storage_config_from_mapping",
    "workflow_summary",
]
