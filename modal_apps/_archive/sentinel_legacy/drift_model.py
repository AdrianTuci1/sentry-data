import json
import os
from pathlib import Path
from typing import Optional

try:
    import torch
    import torch.nn as nn
except ImportError:
    # Safe fallback for local Modal CLI inspection
    torch = None
    class nn:
        class Module: pass

class LSTMDriftModel(nn.Module):
    """PyTorch LSTM used by trained Sentinel drift checkpoints."""

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


class RNNDriftPredictor:
    """Evaluate concept drift with a trained LSTM, falling back to statistics."""

    def __init__(
        self,
        sequence_length: int = 10,
        model_path: str = "checkpoints/drift_lstm.pth",
        manifest_path: Optional[str] = None,
    ):
        self.sequence_length = sequence_length
        self.threshold = 0.15
        self.model_path = model_path
        self.manifest_path = manifest_path
        self.model = None
        self.manifest = {}
        self._load_model()

    def _load_model(self):
        manifest_path = self.manifest_path
        if manifest_path is None:
            candidate = Path(self.model_path).with_name("sentinel_model_manifest.json")
            manifest_path = str(candidate) if candidate.exists() else None

        if manifest_path and os.path.exists(manifest_path):
            try:
                with open(manifest_path, "r", encoding="utf-8") as handle:
                    self.manifest = json.load(handle)
                config = self.manifest.get("config", {})
                self.sequence_length = int(config.get("sequence_length", self.sequence_length))
                self.threshold = float(config.get("drift_z_threshold", self.threshold))
            except Exception as error:
                print(f"Error loading Sentinel manifest: {error}.")

        if os.path.exists(self.model_path):
            try:
                config = self.manifest.get("config", {})
                self.model = LSTMDriftModel(
                    input_size=1,
                    hidden_size=int(config.get("hidden_size", 32)),
                    num_layers=int(config.get("num_layers", 2)),
                )
                self.model.load_state_dict(torch.load(self.model_path, map_location=torch.device("cpu")))
                self.model.eval()
                print(f"LSTM model loaded from {self.model_path}")
            except Exception as error:
                print(f"Error loading LSTM model: {error}. Falling back to statistics.")
                self.model = None

    def evaluate_sequence(self, recent_values: list) -> dict:
        if len(recent_values) < self.sequence_length:
            return {"drift_probability": 0.0, "status": "insufficient_data"}

        input_data = recent_values[-self.sequence_length:]

        if self.model:
            with torch.no_grad():
                tensor_input = torch.FloatTensor(input_data).view(1, self.sequence_length, 1)
                prediction = self.model(tensor_input)
                drift_prob = float(torch.sigmoid(prediction).item())
        else:
            avg = sum(input_data) / len(input_data)
            if avg == 0:
                avg = 1
            last_val = input_data[-1]
            deviation = abs(last_val - avg) / avg
            drift_prob = min(deviation / self.threshold, 1.0)

        return {
            "drift_probability": drift_prob,
            "status": "drift_detected" if drift_prob > 0.8 else "stable",
            "using_ai": self.model is not None,
        }
