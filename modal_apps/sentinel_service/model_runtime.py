import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import MODEL_DOWNLOAD_DIR, MODEL_VOLUME_DIR
from .drift_model import RNNDriftPredictor

_drift_predictor = None
_drift_predictor_details: Dict[str, Any] = {"status": "not_loaded"}


def parse_s3_uri(uri: str) -> tuple[str, str]:
    if not uri.startswith("s3://"):
        raise ValueError("Only s3:// URIs are supported.")
    bucket_and_key = uri.replace("s3://", "", 1)
    bucket, key = bucket_and_key.split("/", 1)
    return bucket, key


def download_r2_artifact(uri: str, target_path: Path) -> None:
    import boto3

    bucket, key = parse_s3_uri(uri)
    endpoint = os.getenv("R2_ENDPOINT") or os.getenv("R2_ENDPOINT_URL")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    if not endpoint or not access_key or not secret_key:
        raise RuntimeError("R2 credentials are required to download Sentinel model artifacts.")

    client = boto3.client(
        "s3",
        region_name=os.getenv("R2_REGION", "auto"),
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )
    target_path.parent.mkdir(parents=True, exist_ok=True)
    client.download_file(bucket, key, str(target_path))


def resolve_model_dir() -> Path:
    manifest_uri = os.getenv("SENTINEL_MODEL_MANIFEST_URI", "")
    if manifest_uri:
        manifest_path = MODEL_DOWNLOAD_DIR / "sentinel_model_manifest.json"
        download_r2_artifact(manifest_uri, manifest_path)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        checkpoint_name = manifest.get("checkpoint", "drift_lstm.pth")
        checkpoint_uri = os.getenv("SENTINEL_MODEL_CHECKPOINT_URI", "")
        if not checkpoint_uri and manifest_uri.endswith("sentinel_model_manifest.json"):
            checkpoint_uri = manifest_uri.replace("sentinel_model_manifest.json", checkpoint_name)
        if checkpoint_uri:
            download_r2_artifact(checkpoint_uri, MODEL_DOWNLOAD_DIR / checkpoint_name)
        return MODEL_DOWNLOAD_DIR

    configured = os.getenv("SENTINEL_MODEL_DIR")
    if configured:
        return Path(configured)

    latest = MODEL_VOLUME_DIR / "sentinel" / "latest"
    if latest.exists():
        return latest

    return MODEL_VOLUME_DIR


def drift_predictor_details() -> Dict[str, Any]:
    return dict(_drift_predictor_details)


def load_drift_predictor():
    global _drift_predictor, _drift_predictor_details
    if _drift_predictor is not None:
        return _drift_predictor

    try:
        model_dir = resolve_model_dir()
        manifest_path = model_dir / "sentinel_model_manifest.json"
        checkpoint_path = model_dir / "drift_lstm.pth"
        if not checkpoint_path.exists():
            _drift_predictor_details = {"status": "missing", "model_dir": str(model_dir)}
            return None

        _drift_predictor = RNNDriftPredictor(
            model_path=str(checkpoint_path),
            manifest_path=str(manifest_path) if manifest_path.exists() else None,
        )
        _drift_predictor_details = {
            "status": "loaded" if _drift_predictor.model is not None else "fallback",
            "model_dir": str(model_dir),
            "manifest_path": str(manifest_path) if manifest_path.exists() else None,
        }
        return _drift_predictor
    except Exception as error:
        _drift_predictor_details = {"status": "error", "error": str(error)}
        return None


def safe_null_ratio(data_sample: List[Dict[str, Any]]) -> float:
    if not data_sample:
        return 0.0
    total_fields = 0
    null_fields = 0
    for row in data_sample:
        for value in row.values():
            total_fields += 1
            if value is None or value == "":
                null_fields += 1
    return 0.0 if total_fields == 0 else null_fields / total_fields


def numeric_columns(data_sample: List[Dict[str, Any]]) -> List[str]:
    columns = set()
    for row in data_sample:
        for key, value in row.items():
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                columns.add(key)
    return sorted(columns)


def numeric_series(data_sample: List[Dict[str, Any]], column: str) -> List[float]:
    values: List[float] = []
    for row in data_sample:
        value = row.get(column)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            values.append(float(value))
    return values


def evaluate_drift_from_sample(data_sample: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    predictor = load_drift_predictor()
    if predictor is None or not data_sample:
        return None

    best_result: Optional[Dict[str, Any]] = None
    for column in numeric_columns(data_sample):
        values = numeric_series(data_sample, column)
        if len(values) < predictor.sequence_length:
            continue
        result = predictor.evaluate_sequence(values)
        candidate = {
            "column": column,
            **result,
        }
        if best_result is None or candidate.get("drift_probability", 0) > best_result.get("drift_probability", 0):
            best_result = candidate
    return best_result
