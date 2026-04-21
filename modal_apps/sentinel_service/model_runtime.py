import json
import os
import pickle
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import MODEL_DOWNLOAD_DIR, MODEL_VOLUME_DIR
from .drift_model import RNNDriftPredictor

_drift_predictor = None
_drift_predictor_details: Dict[str, Any] = {"status": "not_loaded"}
_sentinel_models: Dict[str, Any] = {}
_sentinel_model_details: Dict[str, Any] = {"status": "not_loaded", "models": {}}


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


def model_bundle_artifact_uri(bundle_uri: str, artifact: str) -> str:
    return f"{bundle_uri.rstrip('/')}/{artifact}"


def resolve_model_dir() -> Path:
    bundle_uri = os.getenv("SENTINEL_MODEL_BUNDLE_URI", "")
    if bundle_uri:
        manifest_path = MODEL_DOWNLOAD_DIR / "sentinel_model_manifest.json"
        download_r2_artifact(model_bundle_artifact_uri(bundle_uri, "sentinel_model_manifest.json"), manifest_path)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        artifacts = {manifest.get("checkpoint", "drift_lstm.pth")}
        for model in (manifest.get("models") or {}).values():
            artifact = model.get("artifact") if isinstance(model, dict) else None
            if artifact:
                artifacts.add(artifact)
        for artifact in sorted(artifacts):
            download_r2_artifact(model_bundle_artifact_uri(bundle_uri, artifact), MODEL_DOWNLOAD_DIR / artifact)
        return MODEL_DOWNLOAD_DIR

    manifest_uri = os.getenv("SENTINEL_MODEL_MANIFEST_URI", "")
    if manifest_uri:
        manifest_path = MODEL_DOWNLOAD_DIR / "sentinel_model_manifest.json"
        download_r2_artifact(manifest_uri, manifest_path)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        artifacts = {manifest.get("checkpoint", "drift_lstm.pth")}
        for model in (manifest.get("models") or {}).values():
            artifact = model.get("artifact") if isinstance(model, dict) else None
            if artifact:
                artifacts.add(artifact)
        checkpoint_uri = os.getenv("SENTINEL_MODEL_CHECKPOINT_URI", "")
        for artifact in sorted(artifacts):
            artifact_uri = checkpoint_uri if artifact == manifest.get("checkpoint", "drift_lstm.pth") and checkpoint_uri else ""
            if not artifact_uri and manifest_uri.endswith("sentinel_model_manifest.json"):
                artifact_uri = manifest_uri.replace("sentinel_model_manifest.json", artifact)
            if artifact_uri:
                download_r2_artifact(artifact_uri, MODEL_DOWNLOAD_DIR / artifact)
        return MODEL_DOWNLOAD_DIR

    configured = os.getenv("SENTINEL_MODEL_DIR")
    if configured:
        return Path(configured)

    latest = MODEL_VOLUME_DIR / "sentinel" / "latest"
    if latest.exists():
        return latest

    return MODEL_VOLUME_DIR


def drift_predictor_details() -> Dict[str, Any]:
    return {
        **_drift_predictor_details,
        "sentinel_bundle": dict(_sentinel_model_details),
    }


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


def source_coverage_features(profile: Dict[str, Any]) -> List[float]:
    schema = profile.get("schema") or []
    schema_rows = schema if isinstance(schema, list) else []
    names = [str(column.get("name", "")).lower() for column in schema_rows if isinstance(column, dict)]
    dtypes = [str(column.get("dtype") or column.get("type") or "").lower() for column in schema_rows if isinstance(column, dict)]
    null_ratios = [numeric(column.get("nullable_ratio") or column.get("nullableRatio")) for column in schema_rows if isinstance(column, dict)]
    metrics = profile.get("metricCandidates") or profile.get("metric_candidates") or []
    timestamps = profile.get("timestampCandidates") or profile.get("timestamp_candidates") or []
    entity_keys = profile.get("entityKeyCandidates") or profile.get("entity_key_candidates") or []
    metric_count = len(metrics) or sum(any(token in name for token in ["revenue", "cost", "count", "rate", "score", "latency", "amount", "usage", "mrr", "arr"]) for name in names)
    temporal_count = len(timestamps) or sum(any(token in name for token in ["date", "time", "timestamp", "created", "updated"]) for name in names)
    entity_count = len(entity_keys) or sum(any(token in name for token in ["id", "account", "customer", "user", "tenant", "device"]) for name in names)
    numeric_count = sum(any(token in dtype for token in ["int", "float", "double", "number", "bool"]) for dtype in dtypes)
    storage_metrics = profile.get("storageMetrics") or profile.get("storage_metrics") or {}
    row_count = storage_metrics.get("rowCountEstimate") or storage_metrics.get("row_count_estimate") or len(profile.get("sampleRows") or profile.get("sample_rows") or [])
    avg_null = float(sum(null_ratios) / len(null_ratios)) if null_ratios else safe_null_ratio(profile.get("sampleRows") or profile.get("sample_rows") or [])
    max_null = max(null_ratios) if null_ratios else avg_null
    return [
        numeric(row_count) / 1000.0,
        len(schema_rows) / 100.0,
        metric_count / 20.0,
        temporal_count / 10.0,
        entity_count / 10.0,
        numeric_count / 50.0,
        avg_null,
        max_null,
        hash_bucket(profile.get("domain") or profile.get("sourceType") or profile.get("source_type")),
        hash_bucket(profile.get("grain")),
    ]


def query_risk_features(query: Dict[str, Any]) -> List[float]:
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


def interaction_policy_features(payload: Dict[str, Any], policy_state: Optional[Dict[str, Any]] = None) -> List[float]:
    policy_state = policy_state or {}
    feature_columns = payload.get("featureColumns") or payload.get("feature_columns") or []
    domains = payload.get("detected_domains") or payload.get("domains") or []
    return [
        numeric(policy_state.get("eventCount") or policy_state.get("event_count")) / 100.0,
        len(feature_columns) / 100.0 if isinstance(feature_columns, list) else 0.0,
        1.0 if payload.get("targetColumn") or payload.get("target_column") else 0.0,
        hash_bucket(payload.get("taskType") or payload.get("task_type")),
        hash_bucket(payload.get("scaffoldId") or payload.get("scaffold_id")),
        hash_bucket(payload.get("selected_widget")),
        hash_bucket(payload.get("tracked_field")),
        len(domains) / 10.0 if isinstance(domains, list) else 0.0,
        0.0,
        0.0,
    ]


def load_sentinel_models() -> Dict[str, Any]:
    global _sentinel_models, _sentinel_model_details
    if _sentinel_models:
        return _sentinel_models

    model_dir = resolve_model_dir()
    manifest_path = model_dir / "sentinel_model_manifest.json"
    if not manifest_path.exists():
        _sentinel_model_details = {"status": "missing", "model_dir": str(model_dir), "models": {}}
        return {}

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    loaded: Dict[str, Any] = {}
    details: Dict[str, Any] = {}
    for model_name, model_info in (manifest.get("models") or {}).items():
        artifact = model_info.get("artifact") if isinstance(model_info, dict) else None
        if not artifact or not artifact.endswith(".pkl"):
            continue
        artifact_path = model_dir / artifact
        if not artifact_path.exists():
            details[model_name] = {"status": "missing", "artifact": artifact}
            continue
        try:
            with artifact_path.open("rb") as handle:
                loaded[model_name] = pickle.load(handle)
            details[model_name] = {"status": "loaded", "artifact": artifact}
        except Exception as error:
            details[model_name] = {"status": "error", "artifact": artifact, "error": str(error)}

    _sentinel_models = loaded
    _sentinel_model_details = {
        "status": "loaded" if loaded else "fallback",
        "model_dir": str(model_dir),
        "manifest_path": str(manifest_path),
        "models": details,
    }
    return _sentinel_models


def evaluate_coverage_ranker(profile: Dict[str, Any], fallback_score: float) -> Dict[str, Any]:
    model_artifact = load_sentinel_models().get("CoverageRanker")
    if not model_artifact:
        return {"score": fallback_score, "using_ai": False}
    model = model_artifact["model"]
    score = float(model.predict([source_coverage_features(profile)])[0])
    return {"score": max(0.0, min(1.0, score)), "using_ai": True}


def evaluate_query_risk(query: Dict[str, Any], fallback_score: float) -> Dict[str, Any]:
    model_artifact = load_sentinel_models().get("QueryRiskModel")
    if not model_artifact:
        return {"score": fallback_score, "using_ai": False}
    model = model_artifact["model"]
    features = [query_risk_features(query)]
    if hasattr(model, "predict_proba"):
        score = float(model.predict_proba(features)[0][1])
    else:
        score = float(model.predict(features)[0])
    return {"score": max(0.0, min(1.0, score)), "using_ai": True}


def evaluate_interaction_policy(recommendation: Dict[str, Any], policy_state: Dict[str, Any], fallback_score: float) -> Dict[str, Any]:
    model_artifact = load_sentinel_models().get("InteractionPolicyModel")
    if not model_artifact:
        return {"score": fallback_score, "using_ai": False}
    model = model_artifact["model"]
    score = float(model.predict([interaction_policy_features(recommendation, policy_state)])[0])
    return {"score": max(0.0, min(1.0, score)), "using_ai": True}


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
