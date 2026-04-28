import os
import json
import pickle
import zlib
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import torch
    import torch.nn as nn
except ImportError:
    torch = None
    class nn:
        class Module: pass

MODEL_VOLUME_DIR = Path("/sentinel-models")

class LSTMDriftModel(nn.Module):
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

_sentinel_models: Dict[str, Any] = {}

def hash_bucket(value: object, buckets: int = 997) -> float:
    if value is None: return 0.0
    return (zlib.adler32(str(value).encode("utf-8")) % buckets) / float(buckets)

def query_risk_features(sql: str, widget_type: str) -> List[float]:
    sql_low = sql.lower()
    risky_tokens = ["drop", "delete", "union", "cross join", "information_schema"]
    return [
        len(sql) / 4000.0,
        sum(token in sql_low for token in risky_tokens) / len(risky_tokens),
        sql_low.count(" join ") / 10.0,
        sql_low.count(" select ") / 10.0,
        hash_bucket(widget_type),
        0.0, 0.0, 0.0, 0.0, 0.0 # Padding for model input
    ]

def load_sentinel_models():
    global _sentinel_models
    if _sentinel_models: return _sentinel_models
    
    manifest_path = MODEL_VOLUME_DIR / "sentinel" / "latest" / "sentinel_model_manifest.json"
    if not manifest_path.exists():
        return {}

    try:
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
        
        loaded = {}
        model_dir = manifest_path.parent
        for m_name, m_info in manifest.get("models", {}).items():
            artifact = m_info.get("artifact")
            if artifact and artifact.endswith(".pkl"):
                pth = model_dir / artifact
                if pth.exists():
                    with open(pth, "rb") as h:
                        loaded[m_name] = pickle.load(h)
        _sentinel_models = loaded
        return loaded
    except:
        return {}

def consult_sentinel_internal(proposed_sql: str, widget_type: str) -> str:
    """
    Directly evaluates the operational risk and UX viability using internal ML models.
    """
    models = load_sentinel_models()
    risk_model_pkg = models.get("QueryRiskModel")
    
    if not risk_model_pkg:
        if "JOIN" in proposed_sql.upper() and any(k in widget_type for k in ["metric", "kpi"]):
            return "Sentinel Logic Alert: Joins detected in KPI. Latency risk: High."
        return "Sentinel Status: OK (Heuristic)."

    try:
        model = risk_model_pkg["model"]
        features = [query_risk_features(proposed_sql, widget_type)]
        if hasattr(model, "predict_proba"):
            score = float(model.predict_proba(features)[0][1])
        else:
            score = float(model.predict(features)[0])
        
        risk_label = "HIGH" if score > 0.7 else "MEDIUM" if score > 0.4 else "LOW"
        return f"Sentinel ML Analysis: Internal Risk Score is {round(score, 2)} ({risk_label})."
    except Exception as e:
        return f"Sentinel ML Engine Error: {str(e)}"
