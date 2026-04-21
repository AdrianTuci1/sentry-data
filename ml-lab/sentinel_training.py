#!/usr/bin/env python3
"""Train and publish Sentinel drift models from synthetic training bundles."""

from __future__ import annotations

import argparse
import json
import os
import pickle
import shutil
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor


class LSTMDriftModel(nn.Module):
    """PyTorch LSTM used by the Sentinel drift trainer."""

    def __init__(self, input_size=1, hidden_size=32, num_layers=2):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        out, _ = self.lstm(x, (h0, c0))
        return self.fc(out[:, -1, :])


@dataclass
class TrainingConfig:
    bundle_dir: str
    output_dir: str
    version: str
    sequence_length: int
    hidden_size: int
    num_layers: int
    epochs: int
    learning_rate: float
    batch_size: int
    drift_z_threshold: float
    test_size: float
    seed: int
    rows_per_source: int


def now_version() -> str:
    return datetime.now(timezone.utc).strftime("sentinel-%Y%m%d%H%M%S")


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def load_jsonl(path: Path) -> List[Dict[str, object]]:
    if not path.exists():
        return []
    rows: List[Dict[str, object]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def write_pickle(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        pickle.dump(payload, handle)


def hash_bucket(value: object, buckets: int = 997) -> float:
    if value is None:
        return 0.0
    return (sum(ord(character) for character in str(value)) % buckets) / float(buckets)


def numeric(value: object, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def discover_csv_files(bundle_dir: Path) -> List[Path]:
    csv_dir = bundle_dir / "csv"
    if csv_dir.exists():
        return sorted(csv_dir.glob("*.csv"))
    return sorted(bundle_dir.rglob("*.csv"))


def numeric_series_from_csv(path: Path) -> Iterable[Tuple[str, np.ndarray]]:
    df = pd.read_csv(path)
    for column in df.select_dtypes(include=["number", "bool"]).columns:
        values = pd.to_numeric(df[column], errors="coerce").dropna().astype(float).to_numpy()
        if len(values) >= 16 and np.nanstd(values) > 0:
            yield f"{path.stem}.{column}", values


def normalize(values: np.ndarray) -> np.ndarray:
    mean = float(np.mean(values))
    std = float(np.std(values)) or 1.0
    return ((values - mean) / std).astype(np.float32)


def build_windows(bundle_dir: Path, sequence_length: int, drift_z_threshold: float) -> Tuple[np.ndarray, np.ndarray, Dict[str, int]]:
    rows: List[np.ndarray] = []
    labels: List[float] = []
    source_counts: Dict[str, int] = {}

    for csv_file in discover_csv_files(bundle_dir):
        for series_name, raw_values in numeric_series_from_csv(csv_file):
            values = normalize(raw_values)
            source_count = 0
            for end in range(sequence_length, len(values)):
                window = values[end - sequence_length:end]
                current = values[end]
                baseline = window[:-1] if len(window) > 1 else window
                baseline_std = float(np.std(baseline)) or 1.0
                z_delta = abs(float(current) - float(np.mean(baseline))) / baseline_std
                label = 1.0 if z_delta >= drift_z_threshold else 0.0
                rows.append(window.reshape(sequence_length, 1))
                labels.append(label)
                source_count += 1
            if source_count:
                source_counts[series_name] = source_count

    if not rows:
        raise ValueError(f"No numeric training windows found in {bundle_dir}")

    return np.stack(rows).astype(np.float32), np.array(labels, dtype=np.float32).reshape(-1, 1), source_counts


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
    risky_tokens = ["drop", "delete", "update", "insert", "copy", "httpfs_secret", "pragma", "attach", "union"]
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
    return [
        numeric(payload.get("eventCount") or payload.get("event_count")) / 100.0,
        len(feature_columns) / 100.0 if isinstance(feature_columns, list) else 0.0,
        1.0 if payload.get("targetColumn") or payload.get("target_column") else 0.0,
        hash_bucket(payload.get("taskType") or payload.get("task_type")),
        hash_bucket(payload.get("scaffoldId") or payload.get("scaffold_id")),
        hash_bucket(payload.get("selected_widget")),
        hash_bucket(payload.get("tracked_field")),
        len(domains) / 10.0 if isinstance(domains, list) else 0.0,
        numeric(policy_adjustment.get("field_weight_shift")),
        numeric(policy_adjustment.get("widget_rerank_bonus")),
    ]


def train_coverage_ranker(bundle_dir: Path, version_dir: Path, config: TrainingConfig) -> Dict[str, object]:
    source_registry = load_json(bundle_dir / "metadata" / "source_registry.json", [])
    if not source_registry:
        raise ValueError("source_registry.json is required to train CoverageRanker.")

    X = np.array([source_coverage_features(source) for source in source_registry], dtype=np.float32)
    y = np.array([source_coverage_label(source) for source in source_registry], dtype=np.float32)
    model = RandomForestRegressor(n_estimators=120, random_state=config.seed, min_samples_leaf=1)
    model.fit(X, y)
    predictions = model.predict(X)
    artifact = {
        "model": model,
        "feature_names": [
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
        ],
    }
    write_pickle(version_dir / "coverage_ranker.pkl", artifact)
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
        safe_query = {
            **scenario,
            "sql": "select " + ", ".join((scenario.get("core_fields") or ["metric"])[:4]) + " from projection group by 1",
        }
        rows.append(safe_query)
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
    artifact = {
        "model": model,
        "feature_names": [
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
        ],
    }
    write_pickle(version_dir / "query_risk_model.pkl", artifact)
    metrics = {
        "accuracy": float(accuracy_score(y, predictions)),
        "f1": float(f1_score(y, predictions, zero_division=0)),
        "train_rows": int(len(y)),
    }
    if len(set(y.tolist())) > 1:
        metrics["auc"] = float(roc_auc_score(y, probabilities))
    return {
        "kind": "query_risk_random_forest",
        "artifact": "query_risk_model.pkl",
        "metrics": metrics,
    }


def train_interaction_policy_model(bundle_dir: Path, version_dir: Path, config: TrainingConfig) -> Dict[str, object]:
    events = load_jsonl(bundle_dir / "metadata" / "rl_feedback_events.jsonl")
    if not events:
        raise ValueError("rl_feedback_events.jsonl is required to train InteractionPolicyModel.")

    X = np.array([interaction_policy_features(event) for event in events], dtype=np.float32)
    y = np.array([numeric(event.get("reward"), 0.0) for event in events], dtype=np.float32)
    model = RandomForestRegressor(n_estimators=160, random_state=config.seed, min_samples_leaf=2)
    model.fit(X, y)
    predictions = model.predict(X)
    artifact = {
        "model": model,
        "feature_names": [
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
        ],
    }
    write_pickle(version_dir / "interaction_policy_model.pkl", artifact)
    return {
        "kind": "interaction_policy_random_forest",
        "artifact": "interaction_policy_model.pkl",
        "metrics": {
            "mae": float(mean_absolute_error(y, predictions)),
            "r2": float(r2_score(y, predictions)) if len(y) > 1 else 1.0,
            "train_rows": int(len(y)),
        },
    }


def train_drift_classifier(config: TrainingConfig, version_dir: Path) -> Dict[str, object]:
    torch.manual_seed(config.seed)
    np.random.seed(config.seed)

    X, y, source_counts = build_windows(Path(config.bundle_dir), config.sequence_length, config.drift_z_threshold)
    stratify = y.reshape(-1) if len(set(y.reshape(-1).tolist())) > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=config.test_size,
        random_state=config.seed,
        stratify=stratify,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = LSTMDriftModel(input_size=1, hidden_size=config.hidden_size, num_layers=config.num_layers).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=config.learning_rate)

    train_tensor = torch.from_numpy(X_train).to(device)
    target_tensor = torch.from_numpy(y_train).to(device)

    model.train()
    losses: List[float] = []
    for epoch in range(config.epochs):
        permutation = torch.randperm(train_tensor.size(0), device=device)
        epoch_losses: List[float] = []
        for start in range(0, train_tensor.size(0), config.batch_size):
            indices = permutation[start:start + config.batch_size]
            batch_x = train_tensor[indices]
            batch_y = target_tensor[indices]

            optimizer.zero_grad()
            logits = model(batch_x)
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()
            epoch_losses.append(float(loss.detach().cpu()))
        losses.append(float(np.mean(epoch_losses)))

    model.eval()
    with torch.no_grad():
        logits = model(torch.from_numpy(X_test).to(device))
        probabilities = torch.sigmoid(logits).cpu().numpy().reshape(-1)

    y_true = y_test.reshape(-1)
    y_pred = (probabilities >= 0.5).astype(float)
    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "positive_rate": float(np.mean(y_true)),
        "final_loss": losses[-1],
    }
    if len(set(y_true.tolist())) > 1:
        metrics["auc"] = float(roc_auc_score(y_true, probabilities))

    version_dir.mkdir(parents=True, exist_ok=True)

    checkpoint_path = version_dir / "drift_lstm.pth"
    torch.save(model.state_dict(), checkpoint_path)

    return {
        "kind": "drift_classifier_lstm",
        "artifact": "drift_lstm.pth",
        "metrics": metrics,
        "training_summary": {
            "window_count": int(len(X)),
            "train_windows": int(len(X_train)),
            "test_windows": int(len(X_test)),
            "source_series_count": len(source_counts),
            "source_counts": source_counts,
        },
    }


def train(config: TrainingConfig) -> Dict[str, object]:
    bundle_dir = Path(config.bundle_dir)
    if not (bundle_dir / "metadata" / "training_bundle_manifest.json").exists():
        from datasets.generator.bundle import materialize_training_bundle

        materialize_training_bundle(
            output_dir=str(bundle_dir),
            rows_per_source=config.rows_per_source,
            seed=config.seed,
        )

    version_dir = Path(config.output_dir) / config.version
    latest_dir = Path(config.output_dir) / "latest"
    version_dir.mkdir(parents=True, exist_ok=True)

    models = {
        "CoverageRanker": train_coverage_ranker(bundle_dir, version_dir, config),
        "DriftClassifier": train_drift_classifier(config, version_dir),
        "QueryRiskModel": train_query_risk_model(bundle_dir, version_dir, config),
        "InteractionPolicyModel": train_interaction_policy_model(bundle_dir, version_dir, config),
    }

    manifest_path = version_dir / "sentinel_model_manifest.json"
    manifest = {
        "model_id": config.version,
        "kind": "sentinel_model_bundle",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "config": asdict(config),
        "bundle_manifest": str(bundle_dir / "metadata" / "training_bundle_manifest.json"),
        "checkpoint": "drift_lstm.pth",
        "models": models,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    if latest_dir.exists() or latest_dir.is_symlink():
        if latest_dir.is_symlink() or latest_dir.is_file():
            latest_dir.unlink()
        else:
            shutil.rmtree(latest_dir)
    shutil.copytree(version_dir, latest_dir)

    return {
        "status": "trained",
        "version": config.version,
        "artifact_dir": str(version_dir),
        "latest_dir": str(latest_dir),
        "manifest_path": str(manifest_path),
        "models": models,
    }


def upload_directory_to_r2(local_dir: Path, bucket: str, prefix: str) -> Dict[str, str]:
    import boto3

    endpoint = os.getenv("R2_ENDPOINT") or os.getenv("R2_ENDPOINT_URL")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    if not endpoint or not access_key or not secret_key:
        raise ValueError("R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required for upload.")

    client = boto3.client(
        "s3",
        region_name=os.getenv("R2_REGION", "auto"),
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )

    uploaded: Dict[str, str] = {}
    for path in local_dir.rglob("*"):
        if not path.is_file():
            continue
        key = f"{prefix.rstrip('/')}/{path.relative_to(local_dir).as_posix()}"
        client.upload_file(str(path), bucket, key)
        uploaded[path.name] = f"s3://{bucket}/{key}"
    return uploaded


def main() -> int:
    parser = argparse.ArgumentParser(description="Train the full Sentinel model bundle from generated synthetic data.")
    parser.add_argument("--bundle-dir", default="ml-lab/.generated/training_bundle")
    parser.add_argument("--output-dir", default="ml-lab/checkpoints/sentinel")
    parser.add_argument("--version", default=now_version())
    parser.add_argument("--rows-per-source", type=int, default=320)
    parser.add_argument("--sequence-length", type=int, default=10)
    parser.add_argument("--hidden-size", type=int, default=32)
    parser.add_argument("--num-layers", type=int, default=2)
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--drift-z-threshold", type=float, default=2.25)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--upload-r2", action="store_true")
    parser.add_argument("--r2-bucket", default=os.getenv("R2_BUCKET_DATA") or os.getenv("R2_BUCKET") or "")
    parser.add_argument("--r2-prefix", default="system/r2-system/models/sentinel")
    args = parser.parse_args()

    config = TrainingConfig(
        bundle_dir=args.bundle_dir,
        output_dir=args.output_dir,
        version=args.version,
        sequence_length=args.sequence_length,
        hidden_size=args.hidden_size,
        num_layers=args.num_layers,
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        batch_size=args.batch_size,
        drift_z_threshold=args.drift_z_threshold,
        test_size=args.test_size,
        seed=args.seed,
        rows_per_source=args.rows_per_source,
    )
    result = train(config)

    if args.upload_r2:
        if not args.r2_bucket:
            raise ValueError("--r2-bucket or R2_BUCKET_DATA is required with --upload-r2.")
        version_dir = Path(result["artifact_dir"])
        uploaded = upload_directory_to_r2(version_dir, args.r2_bucket, f"{args.r2_prefix.rstrip('/')}/{args.version}")
        result["r2"] = uploaded

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
