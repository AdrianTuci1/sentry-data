from pathlib import Path
from typing import Dict, List

import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, r2_score, roc_auc_score

from .config import TrainingConfig
from .features import interaction_policy_features, query_risk_features, source_coverage_features, source_coverage_label
from .io import load_json, load_jsonl, write_pickle


def train_coverage_ranker(bundle_dir: Path, version_dir: Path, config: TrainingConfig) -> Dict[str, object]:
    source_registry = load_json(bundle_dir / "metadata" / "source_registry.json", [])
    if not source_registry:
        raise ValueError("source_registry.json is required to train CoverageRanker.")

    X = np.array([source_coverage_features(source) for source in source_registry], dtype=np.float32)
    y = np.array([source_coverage_label(source) for source in source_registry], dtype=np.float32)
    model = RandomForestRegressor(n_estimators=120, random_state=config.seed, min_samples_leaf=1)
    model.fit(X, y)
    predictions = model.predict(X)
    write_pickle(version_dir / "coverage_ranker.pkl", {"model": model, "feature_names": COVERAGE_FEATURES})
    return {
        "kind": "coverage_ranker_random_forest",
        "artifact": "coverage_ranker.pkl",
        "metrics": {
            "mae": float(mean_absolute_error(y, predictions)),
            "r2": float(r2_score(y, predictions)) if len(y) > 1 else 1.0,
            "train_rows": int(len(y)),
        },
    }


def train_query_risk_model(bundle_dir: Path, version_dir: Path, config: TrainingConfig) -> Dict[str, object]:
    scenarios = load_jsonl(bundle_dir / "metadata" / "query_generation_scenarios.jsonl")
    rows: List[Dict[str, object]] = []
    labels: List[int] = []

    for scenario in scenarios:
        rows.append({
            **scenario,
            "sql": "select " + ", ".join((scenario.get("core_fields") or ["metric"])[:4]) + " from projection group by 1",
        })
        labels.append(0)
        for risky_sql in [
            "drop table bronze.source",
            "delete from projection where 1=1",
            "copy data to 's3://external-bucket/out.csv'",
            "select httpfs_secret from system.runtime",
        ]:
            rows.append({**scenario, "sql": risky_sql})
            labels.append(1)

    if len(set(labels)) < 2:
        raise ValueError("QueryRiskModel requires both safe and risky synthetic examples.")

    X = np.array([query_risk_features(row) for row in rows], dtype=np.float32)
    y = np.array(labels, dtype=np.int64)
    model = RandomForestClassifier(n_estimators=120, random_state=config.seed, class_weight="balanced")
    model.fit(X, y)
    predictions = model.predict(X)
    probabilities = model.predict_proba(X)[:, 1]
    write_pickle(version_dir / "query_risk_model.pkl", {"model": model, "feature_names": QUERY_RISK_FEATURES})
    metrics = {
        "accuracy": float(accuracy_score(y, predictions)),
        "f1": float(f1_score(y, predictions, zero_division=0)),
        "train_rows": int(len(y)),
    }
    if len(set(y.tolist())) > 1:
        metrics["auc"] = float(roc_auc_score(y, probabilities))
    return {"kind": "query_risk_random_forest", "artifact": "query_risk_model.pkl", "metrics": metrics}


def train_interaction_policy_model(bundle_dir: Path, version_dir: Path, config: TrainingConfig) -> Dict[str, object]:
    events = load_jsonl(bundle_dir / "metadata" / "rl_feedback_events.jsonl")
    if not events:
        raise ValueError("rl_feedback_events.jsonl is required to train InteractionPolicyModel.")

    X = np.array([interaction_policy_features(event) for event in events], dtype=np.float32)
    y = np.array([float(event.get("reward") or 0.0) for event in events], dtype=np.float32)
    model = RandomForestRegressor(n_estimators=160, random_state=config.seed, min_samples_leaf=2)
    model.fit(X, y)
    predictions = model.predict(X)
    write_pickle(version_dir / "interaction_policy_model.pkl", {"model": model, "feature_names": INTERACTION_POLICY_FEATURES})
    return {
        "kind": "interaction_policy_random_forest",
        "artifact": "interaction_policy_model.pkl",
        "metrics": {
            "mae": float(mean_absolute_error(y, predictions)),
            "r2": float(r2_score(y, predictions)) if len(y) > 1 else 1.0,
            "train_rows": int(len(y)),
        },
    }


COVERAGE_FEATURES = [
    "row_count_k",
    "schema_width_100",
    "metric_count_20",
    "temporal_count_10",
    "entity_count_10",
    "numeric_count_50",
    "avg_null_ratio",
    "max_null_ratio",
    "domain_hash",
    "grain_hash",
]

QUERY_RISK_FEATURES = [
    "sql_len_4k",
    "risky_token_ratio",
    "join_count_10",
    "select_count_10",
    "statement_count_5",
    "source_count_10",
    "core_field_count_50",
    "widget_count_50",
    "widget_type_hash",
    "execution_mode_hash",
]

INTERACTION_POLICY_FEATURES = [
    "event_count_100",
    "feature_count_100",
    "has_target",
    "task_type_hash",
    "scaffold_hash",
    "selected_widget_hash",
    "tracked_field_hash",
    "domain_count_10",
    "field_weight_shift",
    "widget_rerank_bonus",
]
