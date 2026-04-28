from typing import List, Optional

import modal
from fastapi import Header

from .config import SENTINEL_VERSION, app, image, model_volume, web_app
from .model_runtime import (
    drift_predictor_details,
    evaluate_drift_from_sample,
    load_drift_predictor,
    load_sentinel_models,
    numeric_columns,
    safe_null_ratio,
)
from .policy import align_score, evaluate_runtime_policy
from .prompts import load_prompt
from .schemas import AlignExecutionScoreRequest, EvaluationRequest, RuntimeEvaluationRequest
from .security import verify_internal_secret


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
            "model": drift_predictor_details(),
            "prompt_file": "sentinel_evaluate_node.md",
            "prompt_preview": prompt_text.splitlines()[:6],
        },
    }


@web_app.post("/api/v1/evaluate_runtime")
def evaluate_runtime(request: RuntimeEvaluationRequest, x_internal_secret: Optional[str] = Header(None)):
    verify_internal_secret(x_internal_secret)
    try:
        return evaluate_runtime_policy(request)
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }


@web_app.get("/health")
def health():
    load_drift_predictor()
    load_sentinel_models()
    return {
        "status": "ok",
        "service": "statsparrot-sentinel",
        "sentinel_version": SENTINEL_VERSION,
        "model": drift_predictor_details(),
    }


@app.function(
    image=image,
    volumes={"/sentinel-models": model_volume},
    secrets=[modal.Secret.from_name("sentry-r2-secrets")],
    env={
        "SENTINEL_MODEL_BUNDLE_URI": "s3://statsparrot-data/system/r2-system/models/sentinel/latest"
    },
    timeout=300
)
@modal.asgi_app()
def fastapi_app():
    return web_app


@app.local_entrypoint()
def main():
    print("StatsParrot Sentinel is ready.")
    print("Deploy: modal deploy modal_apps/sentinel.py")
    print("Serve:  modal serve modal_apps/sentinel.py")
