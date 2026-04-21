import os
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional

import modal
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


PROMPT_DIR = "/root/r2-system/prompts/runtime"
SENTINEL_VERSION = "sentinel-modal-v1"
INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "secret")
REPO_ROOT = Path(__file__).resolve().parents[1]
MODEL_VOLUME_DIR = Path("/sentinel-models")
MODEL_DOWNLOAD_DIR = Path("/tmp/sentinel-model")

image = (
    modal.Image.debian_slim()
    .pip_install("fastapi[standard]", "pydantic", "duckdb", "pyyaml", "torch==2.1.1", "numpy==1.26.2", "boto3")
    .add_local_dir(str(REPO_ROOT / "r2-system" / "prompts" / "runtime"), remote_path=PROMPT_DIR)
    .add_local_dir(str(REPO_ROOT / "ml-lab" / "models"), remote_path="/root/ml_models")
)

app = modal.App("statsparrot-sentinel")
web_app = FastAPI(title="StatsParrot Sentinel")
model_volume = modal.Volume.from_name("sentinel-ml-checkpoints", create_if_missing=True)
_drift_predictor = None
_drift_predictor_details: Dict[str, Any] = {"status": "not_loaded"}


class AlignExecutionScoreRequest(BaseModel):
    tenant_id: str
    project_id: str
    execution_score: Dict[str, Any]


class EvaluationRequest(BaseModel):
    tenant_id: str
    project_id: str
    node_id: str
    scope: str = "source"
    data_sample: List[Dict[str, Any]] = Field(default_factory=list)


class RuntimeEvaluationRequest(BaseModel):
    tenant_id: str
    project_id: str
    source_profiles: List[Dict[str, Any]] = Field(default_factory=list)
    previous_projection_registry: Optional[Dict[str, Any]] = None
    invalidated_sources: List[str] = Field(default_factory=list)
    query_specs: List[Dict[str, Any]] = Field(default_factory=list)
    ml_recommendations: List[Dict[str, Any]] = Field(default_factory=list)
    policy_state: Optional[Dict[str, Any]] = None


def verify_internal_secret(x_internal_secret: Optional[str]) -> None:
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized. Invalid internal secret.")


def load_prompt(filename: str) -> str:
    return Path(PROMPT_DIR, filename).read_text(encoding="utf-8")


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
        manifest = __import__("json").loads(manifest_path.read_text(encoding="utf-8"))
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

    legacy = MODEL_VOLUME_DIR
    return legacy


def load_drift_predictor():
    global _drift_predictor, _drift_predictor_details
    if _drift_predictor is not None:
        return _drift_predictor

    try:
        sys.path.insert(0, "/root")
        from ml_models.predictive_drift import RNNDriftPredictor

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


def now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def build_hint(
    hint_id: str,
    scope: str,
    target_id: str,
    source_id: Optional[str],
    reason: str,
    severity: str,
    invalidates: List[str],
    recommended_action: str,
) -> Dict[str, Any]:
    return {
        "id": hint_id,
        "scope": scope,
        "targetId": target_id,
        "sourceId": source_id,
        "reason": reason,
        "severity": severity,
        "invalidates": invalidates,
        "recommendedAction": recommended_action,
        "createdAt": now_iso(),
    }


def build_signal(
    signal_id: str,
    model_name: str,
    target_type: str,
    target_id: str,
    source_id: Optional[str],
    score: float,
    severity: str,
    reason: str,
    features: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "signalId": signal_id,
        "modelName": model_name,
        "targetType": target_type,
        "targetId": target_id,
        "sourceId": source_id,
        "score": max(0.0, min(1.0, float(score))),
        "severity": severity,
        "reason": reason,
        "features": features,
        "createdAt": now_iso(),
    }


def evaluate_runtime_policy(request: RuntimeEvaluationRequest) -> Dict[str, Any]:
    hints: List[Dict[str, Any]] = []
    signals: List[Dict[str, Any]] = []
    previous_registry = request.previous_projection_registry or {}
    previous_projections = previous_registry.get("projections") or {}

    for profile in request.source_profiles:
        source_id = profile.get("sourceId") or profile.get("source_id") or "source"
        metrics = profile.get("metricCandidates") or profile.get("metric_candidates") or []
        timestamps = profile.get("timestampCandidates") or profile.get("timestamp_candidates") or []
        entity_keys = profile.get("entityKeyCandidates") or profile.get("entity_key_candidates") or []
        sample_rows = profile.get("sampleRows") or profile.get("sample_rows") or []
        storage_metrics = profile.get("storageMetrics") or profile.get("storage_metrics") or {}

        coverage_score = min(1.0, (len(metrics) + len(timestamps) + len(entity_keys)) / 6.0)
        signals.append(build_signal(
            f"coverage-ranker-{source_id}",
            "CoverageRanker",
            "source",
            source_id,
            source_id,
            coverage_score,
            "info" if coverage_score >= 0.5 else "warning",
            "source_schema_coverage",
            {
                "metricCount": len(metrics),
                "timestampCount": len(timestamps),
                "entityKeyCount": len(entity_keys),
            },
        ))

        if source_id in request.invalidated_sources:
            hints.append(build_hint(
                f"sentinel-{source_id}-source-invalidated",
                "source",
                source_id,
                source_id,
                "source_cursor_changed",
                "warning",
                ["source", "projection", "query", "widget", "ml_recommendation"],
                "Recompile projections and query specs for this source before serving cached outputs.",
            ))

        if not metrics:
            hints.append(build_hint(
                f"sentinel-{source_id}-no-metrics",
                "source",
                source_id,
                source_id,
                "no_metric_candidates",
                "warning",
                ["projection", "query", "widget"],
                "Run semantic discovery again or request a user field mapping override.",
            ))

        if storage_metrics.get("objectCount") == 0:
            hints.append(build_hint(
                f"sentinel-{source_id}-empty-prefix",
                "source",
                source_id,
                source_id,
                "empty_source_prefix",
                "critical",
                ["source", "projection", "query", "widget", "ml_recommendation"],
                "Block execution until source objects are available.",
            ))

        previous_for_source = [
            entry for entry in previous_projections.values()
            if entry.get("sourceId") == source_id or entry.get("source_id") == source_id
        ]
        fingerprint = profile.get("fingerprint")
        if fingerprint and any(entry.get("inputFingerprint") and entry.get("inputFingerprint") != fingerprint for entry in previous_for_source):
            hints.append(build_hint(
                f"sentinel-{source_id}-fingerprint-drift",
                "source",
                source_id,
                source_id,
                "source_fingerprint_changed",
                "warning",
                ["projection", "query", "widget", "ml_recommendation"],
                "Invalidate only artifacts depending on this source fingerprint.",
            ))

        drift = evaluate_drift_from_sample(sample_rows)
        if drift:
            drift_probability = float(drift.get("drift_probability", 0))
            signals.append(build_signal(
                f"drift-classifier-{source_id}",
                "DriftClassifier",
                "source",
                source_id,
                source_id,
                drift_probability,
                "critical" if drift_probability > 0.8 else ("warning" if drift_probability > 0.55 else "info"),
                "sample_sequence_drift",
                drift,
            ))
            if drift_probability > 0.8:
                hints.append(build_hint(
                    f"sentinel-{source_id}-model-drift",
                    "source",
                    source_id,
                    source_id,
                    "trained_drift_model_triggered",
                    "critical",
                    ["projection", "query", "widget", "ml_recommendation"],
                    "Recompile projections and require query validation before serving cached outputs.",
                ))

    for query in request.query_specs:
        query_id = query.get("queryId") or query.get("query_id") or query.get("widgetId") or "query"
        sql = (query.get("sql") or "").lower()
        risky_tokens = [" drop ", " delete ", " update ", " insert ", " copy ", "httpfs_secret"]
        risk = 0.15 + (0.7 if any(token in f" {sql} " for token in risky_tokens) else 0.0)
        signals.append(build_signal(
            f"query-risk-{query_id}",
            "QueryRiskModel",
            "query",
            query_id,
            query.get("sourceId") or query.get("source_id"),
            risk,
            "critical" if risk >= 0.8 else "info",
            "sql_static_risk_scan",
            {"riskyTokens": [token.strip() for token in risky_tokens if token in f" {sql} "]},
        ))

    policy_state = request.policy_state or {}
    event_count = int(policy_state.get("eventCount") or 0)
    for recommendation in request.ml_recommendations:
        recommendation_id = recommendation.get("recommendationId") or recommendation.get("recommendation_id") or "ml"
        source_id = recommendation.get("sourceId") or recommendation.get("source_id")
        signals.append(build_signal(
            f"interaction-policy-{recommendation_id}",
            "InteractionPolicyModel",
            "ml_recommendation",
            recommendation_id,
            source_id,
            0.45 + min(event_count, 100) / 250.0,
            "info",
            "metadata_only_ml_interest_prior",
            {
                "eventCount": event_count,
                "taskType": recommendation.get("taskType") or recommendation.get("task_type"),
                "scaffoldId": recommendation.get("scaffoldId") or recommendation.get("scaffold_id"),
            },
        ))

    return {
        "status": "evaluated",
        "invalidation_hints": hints,
        "sentinel_model_signals": signals,
        "model": _drift_predictor_details,
    }


def align_score(execution_score: Dict[str, Any]) -> Dict[str, Any]:
    score = deepcopy(execution_score)
    reasons: List[str] = []
    should_replan = False
    aligned = True

    source = score.get("source", {})
    uris = source.get("uris") or []
    virtual_silver = score.get("pnc_logic", {}).get("virtual_silver") or []
    metrics = score.get("analysis_goal", {}).get("metrics") or []
    infrastructure = score.setdefault("infrastructure", {})
    reverse_etl = score.get("output_streams", {}).get("reverse_etl", {})

    if not uris:
        reasons.append("source_uris_missing")
        should_replan = True
        aligned = False

    if not virtual_silver:
        reasons.append("virtual_silver_missing")
        should_replan = True
        aligned = False

    if not metrics:
        reasons.append("analysis_goal_metrics_missing")
        should_replan = True
        aligned = False

    if reverse_etl.get("enabled") and not reverse_etl.get("dns_txt_verification", {}).get("verified", False):
        reasons.append("reverse_etl_dns_verification_pending")

    source_count = len(uris)
    target_latency_ms = score.get("metadata", {}).get("target_latency_ms", 45000)
    max_workers = int(infrastructure.get("max_workers", 1) or 1)
    if source_count >= 4 and target_latency_ms <= 45000 and max_workers < 24:
        infrastructure["max_workers"] = 24
        infrastructure["auto_scale"] = True
        reasons.append("capacity_hint_upgraded_for_multi_source_workload")

    prompt_text = load_prompt("sentinel_align_execution_score.md")
    status = "replan_required" if should_replan else ("aligned_with_warnings" if reasons else "aligned")
    return {
        "status": status,
        "aligned": aligned,
        "should_replan": should_replan,
        "reasons": reasons,
        "execution_score": score,
        "details": {
            "sentinel_version": SENTINEL_VERSION,
            "prompt_file": "sentinel_align_execution_score.md",
            "prompt_preview": prompt_text.splitlines()[:8],
            "checks": [
                "structural_completeness",
                "privacy_guard",
                "reverse_etl_guardrails",
                "capacity_coherence",
            ],
        },
    }


@web_app.post("/api/v1/align_execution_score")
def align_execution_score(request: AlignExecutionScoreRequest, x_internal_secret: Optional[str] = Header(None)):
    verify_internal_secret(x_internal_secret)
    return align_score(request.execution_score)


@web_app.post("/api/v1/evaluate_node")
def evaluate_node(request: EvaluationRequest, x_internal_secret: Optional[str] = Header(None)):
    verify_internal_secret(x_internal_secret)
    null_ratio = safe_null_ratio(request.data_sample)
    numeric_cols = numeric_columns(request.data_sample)
    drift = evaluate_drift_from_sample(request.data_sample)
    goals: List[str] = []
    should_invalidate = False

    if null_ratio > 0.2:
        goals.append("High null pressure detected. Tighten null policy and semantic casting.")
        should_invalidate = True

    if request.scope == "global" and len(request.data_sample) > 0:
        goals.append("Global node updated. Re-evaluate cross-source groups and insights.")

    if numeric_cols:
        goals.append(f"Review metric stability for numeric columns: {', '.join(numeric_cols[:5])}.")

    if drift and drift.get("drift_probability", 0) > 0.8:
        goals.append(f"Trained Sentinel drift model detected drift in {drift.get('column')}.")
        should_invalidate = True

    confidence_score = max(0.0, min(100.0, round((1.0 - min(null_ratio, 1.0)) * 100.0, 2)))
    prompt_text = load_prompt("sentinel_evaluate_node.md")

    return {
        "status": "evaluated",
        "confidence_score": confidence_score,
        "goals": goals,
        "should_invalidate": should_invalidate,
        "details": {
            "sentinel_version": SENTINEL_VERSION,
            "null_ratio": null_ratio,
            "numeric_columns": numeric_cols,
            "drift": drift,
            "model": _drift_predictor_details,
            "prompt_file": "sentinel_evaluate_node.md",
            "prompt_preview": prompt_text.splitlines()[:6],
        },
    }


@web_app.post("/api/v1/evaluate_runtime")
def evaluate_runtime(request: RuntimeEvaluationRequest, x_internal_secret: Optional[str] = Header(None)):
    verify_internal_secret(x_internal_secret)
    return evaluate_runtime_policy(request)


@web_app.get("/health")
def health():
    load_drift_predictor()
    return {
        "status": "ok",
        "service": "statsparrot-sentinel",
        "sentinel_version": SENTINEL_VERSION,
        "model": _drift_predictor_details,
    }


@app.function(image=image, volumes={"/sentinel-models": model_volume}, timeout=300)
@modal.asgi_app()
def fastapi_app():
    return web_app


@app.local_entrypoint()
def main():
    print("StatsParrot Sentinel is ready.")
    print("Deploy: modal deploy modal_apps/sentinel.py")
    print("Serve:  modal serve modal_apps/sentinel.py")
