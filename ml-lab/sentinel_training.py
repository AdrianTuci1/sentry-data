#!/usr/bin/env python3
"""Train and publish Sentinel drift models from synthetic training bundles."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from models.predictive_drift import LSTMDriftModel


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


def now_version() -> str:
    return datetime.now(timezone.utc).strftime("sentinel-%Y%m%d%H%M%S")


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


def train(config: TrainingConfig) -> Dict[str, object]:
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

    version_dir = Path(config.output_dir) / config.version
    latest_dir = Path(config.output_dir) / "latest"
    version_dir.mkdir(parents=True, exist_ok=True)

    checkpoint_path = version_dir / "drift_lstm.pth"
    manifest_path = version_dir / "sentinel_model_manifest.json"
    torch.save(model.state_dict(), checkpoint_path)

    manifest = {
        "model_id": config.version,
        "kind": "sentinel_drift_lstm",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "checkpoint": "drift_lstm.pth",
        "config": asdict(config),
        "metrics": metrics,
        "training_summary": {
            "window_count": int(len(X)),
            "train_windows": int(len(X_train)),
            "test_windows": int(len(X_test)),
            "source_series_count": len(source_counts),
            "source_counts": source_counts,
        },
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
        "metrics": metrics,
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
    parser = argparse.ArgumentParser(description="Train Sentinel drift model from synthetic bundle data.")
    parser.add_argument("--bundle-dir", default="ml-lab/datasets/training_bundle")
    parser.add_argument("--output-dir", default="ml-lab/checkpoints/sentinel")
    parser.add_argument("--version", default=now_version())
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
