from pathlib import Path
from typing import Dict, List

import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, r2_score, roc_auc_score
from sklearn.model_selection import train_test_split

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
    # Industrial Upgrade: Load from the Vault inside the bundle
    vault_path = bundle_dir / "metadata" / "query_vault.jsonl"
    rows: List[Dict[str, object]] = []
    labels: List[int] = []

    if vault_path.exists():
        print(f"📊 Loading {vault_path}...")
        vault_data = load_jsonl(vault_path)
        for item in vault_data:
            # We map the vault item to the expected feature format
            rows.append({
                "sql": item.get("sql", ""),
                "detected_domains": [item.get("domain", "general")],
                "task_type": "adhoc_query"
            })
            labels.append(int(item.get("label", 0)))
    else:
        # Fallback to basic scenarios if vault is missing
        print("⚠️ Query Vault missing, using basic scenarios.")
        scenarios = load_jsonl(bundle_dir / "metadata" / "query_generation_scenarios.jsonl")
        for scenario in scenarios:
            core_fields = (scenario.get("core_fields") or ["metric"])[:4]
            # Safe queries
            rows.append({**scenario, "sql": f"SELECT {', '.join(core_fields)} FROM table"})
            labels.append(0)
            # Risky queries
            rows.append({**scenario, "sql": "DROP TABLE critical_data"})
            labels.append(1)

    if len(set(labels)) < 2:
        raise ValueError("QueryRiskModel requires both safe and risky synthetic examples.")

    X = np.array([query_risk_features(row) for row in rows], dtype=np.float32)
    y = np.array(labels, dtype=np.int64)

    # Split into train/test to prevent overfitting validation
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=config.test_size, random_state=config.seed, stratify=y
    )

    model = RandomForestClassifier(n_estimators=120, random_state=config.seed, class_weight="balanced")
    model.fit(X_train, y_train)
    
    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)[:, 1]
    
    write_pickle(version_dir / "query_risk_model.pkl", {"model": model, "feature_names": QUERY_RISK_FEATURES})
    
    metrics = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "f1": float(f1_score(y_test, predictions, zero_division=0)),
        "train_rows": int(len(y_train)),
        "test_rows": int(len(y_test)),
    }
    if len(set(y_test.tolist())) > 1:
        metrics["auc"] = float(roc_auc_score(y_test, probabilities))
    return {"kind": "query_risk_random_forest", "artifact": "query_risk_model.pkl", "metrics": metrics}


def train_interaction_policy_model(bundle_dir: Path, version_dir: Path, config: TrainingConfig) -> Dict[str, object]:
    events = load_jsonl(bundle_dir / "metadata" / "rl_feedback_events.jsonl")
    if not events:
        raise ValueError("rl_feedback_events.jsonl is required to train InteractionPolicyModel.")

    X = np.array([interaction_policy_features(event) for event in events], dtype=np.float32)
    y = np.array([float(event.get("reward") or 0.0) for event in events], dtype=np.float32)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=config.test_size, random_state=config.seed
    )

    model = RandomForestRegressor(n_estimators=160, random_state=config.seed, min_samples_leaf=2)
    model.fit(X_train, y_train)
    
    predictions = model.predict(X_test)
    
    write_pickle(version_dir / "interaction_policy_model.pkl", {"model": model, "feature_names": INTERACTION_POLICY_FEATURES})
    
    return {
        "kind": "interaction_policy_random_forest",
        "artifact": "interaction_policy_model.pkl",
        "metrics": {
            "mae": float(mean_absolute_error(y_test, predictions)),
            "r2": float(r2_score(y_test, predictions)) if len(y_test) > 1 else 1.0,
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
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
