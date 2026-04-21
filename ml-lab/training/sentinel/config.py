from dataclasses import dataclass
from datetime import datetime, timezone


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
