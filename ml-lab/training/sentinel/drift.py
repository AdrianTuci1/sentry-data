from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split

from .config import TrainingConfig


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
    for _ in range(config.epochs):
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
    torch.save(model.state_dict(), version_dir / "drift_lstm.pth")

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
