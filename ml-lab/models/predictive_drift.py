import torch
import torch.nn as nn
import numpy as np
import os

class LSTMDriftModel(nn.Module):
    """
    Real PyTorch LSTM for time-series drift prediction.
    Hidden dimension and layers are configurable.
    """
    def __init__(self, input_size=1, hidden_size=32, num_layers=2):
        super(LSTMDriftModel, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        out, _ = self.lstm(x, (h0, c0))
        out = self.fc(out[:, -1, :])
        return out

class RNNDriftPredictor:
    """
    Evaluates concept drift using a pre-trained LSTM model.
    If no model is found, it falls back to basic statistical checks.
    """
    def __init__(self, sequence_length: int = 10, model_path: str = "checkpoints/drift_lstm.pth"):
        self.sequence_length = sequence_length
        self.threshold = 0.15
        self.model_path = model_path
        self.model = None
        self._load_model()

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.model = LSTMDriftModel()
                self.model.load_state_dict(torch.load(self.model_path, map_location=torch.device('cpu')))
                self.model.eval()
                print(f"✅ LSTM Model loaded from {self.model_path}")
            except Exception as e:
                print(f"⚠️ Error loading LSTM model: {e}. Falling back to statistics.")
                self.model = None

    def evaluate_sequence(self, recent_values: list) -> dict:
        """
        Runs inference on recent data points via LSTM if available, else uses statistics.
        """
        if len(recent_values) < self.sequence_length:
            return {"drift_probability": 0.0, "status": "insufficient_data"}
        
        # Prepare data for model
        input_data = recent_values[-self.sequence_length:]
        
        if self.model:
            with torch.no_grad():
                tensor_input = torch.FloatTensor(input_data).view(1, self.sequence_length, 1)
                prediction = self.model(tensor_input).item()
                # Prediction is treated as 'next expected value' or 'drift score'
                # For this implementation, let's assume it predicts the drift probability [0, 1]
                drift_prob = float(prediction)
        else:
            # Fallback to simulated logic
            avg = sum(input_data) / len(input_data)
            if avg == 0: avg = 1
            last_val = input_data[-1]
            deviation = abs(last_val - avg) / avg
            drift_prob = min(deviation / self.threshold, 1.0)

        return {
            "drift_probability": drift_prob,
            "status": "drift_detected" if drift_prob > 0.8 else "stable",
            "using_ai": self.model is not None
        }
