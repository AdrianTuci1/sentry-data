import zlib
from typing import Dict, List, Set

import numpy as np


def hash_bucket(value: object, buckets: int = 997) -> float:
    if value is None:
        return 0.0
    # Use adler32 for stable, collision-resistant hashing across platforms
    return (zlib.adler32(str(value).encode("utf-8")) % buckets) / float(buckets)


# Semantic Mappings for Industrial Strength Features
# These are used to provide the model with "context" instead of just raw strings
ROLES = [
    "temporal", "entity_id", "cost_metric", "marketing_spend", "financial_metric",
    "conversion_metric", "traffic_metric", "adoption_metric", "performance_metric",
    "reliability_metric", "security_metric", "sensor_metric", "quality_metric", "dimension"
]

FAMILIES = [
    "scorecard-grid", "waterfall", "line-ribbon", "radar", "funnel", "heatmap",
    "scatter", "treemap", "sankey", "table", "clusters", "network"
]

ROLE_TO_IDX = {role: i / len(ROLES) for i, role in enumerate(ROLES)}
FAMILY_TO_IDX = {family: i / len(FAMILIES) for i, family in enumerate(FAMILIES)}


def numeric(value: object, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def source_coverage_features(source: Dict[str, object]) -> List[float]:
    schema = source.get("schema") or []
    schema_rows = schema if isinstance(schema, list) else []
    names = [str(column.get("name", "")).lower() for column in schema_rows if isinstance(column, dict)]
    dtypes = [str(column.get("dtype", "")).lower() for column in schema_rows if isinstance(column, dict)]
    null_ratios = [numeric(column.get("nullable_ratio")) for column in schema_rows if isinstance(column, dict)]
    metric_count = sum(any(token in name for token in ["revenue", "cost", "count", "rate", "score", "latency", "amount", "usage", "mrr", "arr"]) for name in names)
    temporal_count = sum(any(token in name for token in ["date", "time", "timestamp", "created", "updated"]) for name in names)
    entity_count = sum(any(token in name for token in ["id", "account", "customer", "user", "tenant", "device"]) for name in names)
    numeric_count = sum(any(token in dtype for token in ["int", "float", "double", "bool"]) for dtype in dtypes)
    avg_null = float(np.mean(null_ratios)) if null_ratios else 0.0
    max_null = max(null_ratios) if null_ratios else 0.0
    return [
        numeric(source.get("row_count")) / 1000.0,
        len(schema_rows) / 100.0,
        metric_count / 20.0,
        temporal_count / 10.0,
        entity_count / 10.0,
        numeric_count / 50.0,
        avg_null,
        max_null,
        hash_bucket(source.get("domain")),
        hash_bucket(source.get("grain")),
    ]


def source_coverage_label(source: Dict[str, object]) -> float:
    features = source_coverage_features(source)
    metric_score = min(1.0, features[2] * 20 / 3)
    temporal_score = min(1.0, features[3] * 10)
    entity_score = min(1.0, features[4] * 10 / 2)
    null_penalty = min(0.5, features[6] * 0.8)
    row_score = min(1.0, features[0] * 1000 / 120)
    return max(0.0, min(1.0, (metric_score * 0.34) + (temporal_score * 0.22) + (entity_score * 0.18) + (row_score * 0.16) + 0.1 - null_penalty))


def query_risk_features(query: Dict[str, object]) -> List[float]:
    sql = str(query.get("sql") or query.get("instruction") or "").lower()
    # Expanded list of risky tokens including resource exhaustion and structural manipulation
    risky_tokens = [
        "drop", "delete", "update", "insert", "copy", "httpfs_secret", 
        "pragma", "attach", "union", "limit 0", "cross join", 
        "pg_sleep", "sleep(", "system.", "information_schema", "benchmark"
    ]
    return [
        len(sql) / 4000.0,
        sum(token in sql for token in risky_tokens) / len(risky_tokens),
        sql.count(" join ") / 10.0,
        sql.count(" select ") / 10.0,
        sql.count(";") / 5.0,
        len(query.get("sources") or []) / 10.0 if isinstance(query.get("sources"), list) else 0.0,
        len(query.get("core_fields") or []) / 50.0 if isinstance(query.get("core_fields"), list) else 0.0,
        len(query.get("target_widgets") or []) / 50.0 if isinstance(query.get("target_widgets"), list) else 0.0,
        hash_bucket(query.get("widgetType") or query.get("widget_type")),
        hash_bucket(query.get("executionPolicy", {}).get("mode") if isinstance(query.get("executionPolicy"), dict) else None),
    ]


def interaction_policy_features(payload: Dict[str, object]) -> List[float]:
    policy_adjustment = payload.get("policy_adjustment") if isinstance(payload.get("policy_adjustment"), dict) else {}
    feature_columns = payload.get("featureColumns") or payload.get("feature_columns") or []
    domains = payload.get("detected_domains") or payload.get("domains") or []
    
    # Industrial Upgrade: Semantic Context
    # We extract the role and family if available in the metadata
    field_role = payload.get("field_role") or "dimension"
    widget_family = payload.get("widget_family") or "table"
    
    # Compatibility Score (Logical Signal)
    # in Industrial mode, we check if the widget belongs to the hinted family for the role
    is_hinted = 1.0 if payload.get("is_hinted_match") else 0.0
    
    return [
        numeric(payload.get("eventCount") or payload.get("event_count")) / 100.0,
        len(feature_columns) / 100.0 if isinstance(feature_columns, list) else 0.0,
        1.0 if payload.get("targetColumn") or payload.get("target_column") else 0.0,
        hash_bucket(payload.get("taskType") or payload.get("task_type")),
        hash_bucket(payload.get("scaffoldId") or payload.get("scaffold_id")),
        # Semantic Encodings
        ROLE_TO_IDX.get(field_role, 0.99),
        FAMILY_TO_IDX.get(widget_family, 0.99),
        is_hinted,
        # Raw Hashing
        hash_bucket(payload.get("selected_widget")),
        hash_bucket(payload.get("tracked_field")),
        len(domains) / 10.0 if isinstance(domains, list) else 0.0,
        numeric(policy_adjustment.get("field_weight_shift")),
        numeric(policy_adjustment.get("widget_rerank_bonus")),
    ]
