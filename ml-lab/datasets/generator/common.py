from __future__ import annotations

from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd

DEFAULT_SEED = 42
REFERENCE_TS = datetime(2026, 1, 1, 9, 0, 0)
ARTIFACT_VERSION = "2.1"


def _rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def _time_index(rows: int, freq: str) -> pd.DatetimeIndex:
    normalized_freq = "h" if freq == "H" else freq
    return pd.date_range(end=REFERENCE_TS, periods=rows, freq=normalized_freq)


def _series_wave(rows: int, amplitude: float, cycles: float, phase: float = 0.0) -> np.ndarray:
    x = np.linspace(phase, phase + (np.pi * cycles), rows)
    return np.sin(x) * amplitude


def _clip(values: np.ndarray, lower: float, upper: float) -> np.ndarray:
    return np.clip(values, lower, upper)


def _json_safe(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if pd.isna(value):
        return None
    return value


__all__ = [
    "ARTIFACT_VERSION",
    "DEFAULT_SEED",
    "REFERENCE_TS",
    "_clip",
    "_json_safe",
    "_rng",
    "_series_wave",
    "_time_index",
]
