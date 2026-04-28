import json
import os
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import modal
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from pne_core.config import INTERNAL_SECRET, PROMPT_DIR, REPO_ROOT, TRANSLATOR_VERSION, WIDGETS_DIR, logger
from pne_core.models import CompileProjectionPlanRequest, CompileScoreRequest
from pne_core.policy import align_score_logic
from pne_core.planner import build_projection_plan_logic

# Modal image for the API runtime and Gemini/worker integrations.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]", 
        "pydantic", 
        "pyyaml", 
        "google-genai",
        "requests",
        "boto3",
        "torch==2.1.1", 
        "numpy==1.26.2", 
        "scikit-learn==1.3.2", 
        "pandas",
        "joblib"
    )
    .add_local_dir(str(REPO_ROOT / "r2-system" / "prompts" / "runtime"), remote_path=PROMPT_DIR)
    .add_local_dir(str(REPO_ROOT / "r2-system" / "widgets"), remote_path=WIDGETS_DIR)
    .add_local_dir(str(REPO_ROOT / "modal_apps" / "_archive" / "sentinel_legacy"), remote_path="/root/sentinel_legacy")
    .add_local_python_source("pne_core")
)

app = modal.App("statsparrot-pne")
web_app = FastAPI(title="StatsParrot Parrot Neural Engine")
OBSERVABILITY_DIR = Path(os.getenv("PNE_OBSERVABILITY_DIR", "/tmp/pne-observability"))


def log_human_checkpoint(label: str, route_name: str, request_id: Optional[str], message: str, **context: Any) -> None:
    details = {"route": route_name, "requestId": request_id, **context}
    log_fn = logger.info
    if label == "[WARN]":
        log_fn = logger.warning
    elif label == "[FAIL]":
        log_fn = logger.error
    log_fn("%s %s | context=%s", label, message, json.dumps(details, default=str))


def verify_internal_secret(secret: Optional[str]):
    if secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Invalid internal secret")

def log_route_start(route_name: str, request_id: Optional[str], **context: Any) -> None:
    details = {"route": route_name, "requestId": request_id, **context}
    logger.info("Handling PNE request: %s", json.dumps(details, default=str))
    log_human_checkpoint("[OK]", route_name, request_id, f"PNE request received for {route_name}.", **context)


def log_route_success(route_name: str, request_id: Optional[str], **context: Any) -> None:
    details = {"route": route_name, "requestId": request_id, **context}
    logger.info("Completed PNE request: %s", json.dumps(details, default=str))
    log_human_checkpoint("[OK]", route_name, request_id, f"PNE request completed for {route_name}.", **context)


def log_runtime_exception(route_name: str, request_id: Optional[str], error: Exception, **context: Any) -> None:
    details = {"route": route_name, "requestId": request_id, **context}
    logger.exception("PNE route failed: %s | context=%s", error, json.dumps(details, default=str))
    log_human_checkpoint("[FAIL]", route_name, request_id, f"PNE request failed for {route_name}: {error}", **context)


def build_observability_payload(route_name: str, request_id: str, result: Dict[str, Any]) -> Dict[str, Any]:
    projection_plan = result.get("projection_plan", {}) if isinstance(result, dict) else {}
    summary = result.get("summary", {}) if isinstance(result, dict) else {}
    summary_details = summary.get("details", {}) if isinstance(summary, dict) else {}
    return {
        "route": route_name,
        "requestId": request_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": result.get("status"),
        "summary": summary,
        "rejectionReport": summary_details.get("rejectionReport", {}),
        "planningTrace": result.get("planningTrace", []),
        "coverage": projection_plan.get("coverage", {}),
        "projectionPlanMeta": {
            "version": projection_plan.get("version"),
            "translatorVersion": projection_plan.get("translatorVersion"),
            "projectionCount": len(projection_plan.get("projectionSpecs", []) or []),
            "queryCount": len(projection_plan.get("querySpecs", []) or []),
        },
    }


def save_observability_to_r2(tenant_id: str, project_id: str, request_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    endpoint = os.getenv("R2_ENDPOINT") or os.getenv("R2_ENDPOINT_URL")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket = os.getenv("R2_BUCKET_DATA") or "statsparrot-data"

    if not endpoint or not access_key or not secret_key:
        logger.warning(
            "[WARN] Observability R2 upload skipped. context=%s",
            json.dumps(
                {
                    "requestId": request_id,
                    "tenantId": tenant_id,
                    "projectId": project_id,
                    "reason": "r2_credentials_missing",
                },
                default=str,
            ),
        )
        return None

    try:
        import boto3

        key = f"tenants/{tenant_id}/projects/{project_id}/runtime/requests/{request_id}/observability.json"
        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=os.getenv("R2_REGION", "auto"),
        )
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json",
        )
        uri = f"s3://{bucket}/{key}"
        logger.info(
            "[OK] Observability uploaded to R2. context=%s",
            json.dumps(
                {
                    "requestId": request_id,
                    "tenantId": tenant_id,
                    "projectId": project_id,
                    "bucket": bucket,
                    "key": key,
                    "uri": uri,
                },
                default=str,
            ),
        )
        return {
            "bucket": bucket,
            "key": key,
            "uri": uri,
            "storage": "r2",
        }
    except Exception as error:
        logger.exception(
            "[FAIL] Observability R2 upload failed. context=%s",
            json.dumps(
                {
                    "requestId": request_id,
                    "tenantId": tenant_id,
                    "projectId": project_id,
                    "error": str(error),
                },
                default=str,
            ),
        )
        return None


def write_observability_file(route_name: str, request_id: str, result: Dict[str, Any], tenant_id: str, project_id: str) -> Dict[str, Any]:
    payload = build_observability_payload(route_name, request_id, result)
    OBSERVABILITY_DIR.mkdir(parents=True, exist_ok=True)
    target_path = OBSERVABILITY_DIR / f"{request_id}.json"
    target_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    r2_location = save_observability_to_r2(tenant_id, project_id, request_id, payload)
    logger.info(
        "[OK] Observability file written. context=%s",
        json.dumps({"route": route_name, "requestId": request_id, "path": str(target_path)}, default=str),
    )
    return {
        "path": str(target_path),
        "storage": "container_local",
        "payload": payload,
        "r2": r2_location,
    }

@web_app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    body = (await request.body()).decode("utf-8", errors="replace")
    logger.error(
        "PNE request validation failed on %s: errors=%s body=%s",
        request.url.path,
        json.dumps(exc.errors(), default=str),
        body[:4000],
    )
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "error": "validation_error",
            "detail": exc.errors(),
        },
    )

# --- Routes ---
@web_app.post("/api/v1/compile_projection_plan")
def compile_projection_plan(req: CompileProjectionPlanRequest, x_internal_secret: Optional[str] = Header(None)):
    try:
        log_route_start(
            "compile_projection_plan",
            req.requestId,
            source_count=len(req.sourceProfiles),
            compiled_at=req.compiledAt,
        )
        verify_internal_secret(x_internal_secret)
        result = build_projection_plan_logic(req)
        observability = write_observability_file("compile_projection_plan", req.requestId, result, req.tenantId, req.projectId)
        result["observability"] = observability["payload"]
        result["observabilityFile"] = {
            "path": observability["path"],
            "storage": observability["storage"],
        }
        if observability.get("r2"):
            result["observabilityFile"]["r2"] = observability["r2"]
            result["observabilityR2"] = observability["r2"]
        if isinstance(result.get("projection_plan"), dict):
            result["projection_plan"]["observabilityFile"] = result["observabilityFile"]
        projection_plan = result.get("projection_plan", {})
        summary_details = projection_plan.get("summary", {}).get("details", {})
        log_route_success(
            "compile_projection_plan",
            req.requestId,
            source_count=summary_details.get("sourceCount"),
            projection_count=summary_details.get("projectionCount"),
            query_count=summary_details.get("queryCount"),
            accepted_candidates=summary_details.get("acceptedCandidateCount"),
            rejected_candidates=summary_details.get("rejectedCandidateCount"),
        )
        return result
    except Exception as error:
        log_runtime_exception("compile_projection_plan", getattr(req, "requestId", None), error)
        raise HTTPException(status_code=500, detail={"error": str(error), "trace": traceback.format_exc()})

@web_app.post("/api/v1/compile_execution_score")
def compile_execution_score(req: CompileScoreRequest, x_internal_secret: Optional[str] = Header(None)):
    try:
        log_route_start("compile_execution_score", req.requestId)
        verify_internal_secret(x_internal_secret)
        # Fast placeholder score
        result = {
            "status": "ok",
            "execution_score": {
                "metadata": {"request_id": req.requestId, "created_at": datetime.now(timezone.utc).isoformat()},
                "source": {"uris": req.context.get("rawSourceUris", [])},
                "pnc_logic": {"virtual_silver": [{"op": "harmonize"}]},
                "analysis_goal": {"metrics": ["count"]},
                "infrastructure": {"engine": "modal", "min_workers": 1, "max_workers": 24}
            }
        }
        log_route_success("compile_execution_score", req.requestId, source_uri_count=len(req.context.get("rawSourceUris", [])))
        return result
    except Exception as error:
        log_runtime_exception("compile_execution_score", getattr(req, "requestId", None), error)
        raise HTTPException(status_code=500, detail=str(error))

@web_app.post("/api/v1/align_execution_score")
def align_execution_score(req: Dict[str, Any], x_internal_secret: Optional[str] = Header(None)):
    try:
        request_id = req.get("requestId") or req.get("executionScore", {}).get("metadata", {}).get("request_id")
        log_route_start("align_execution_score", request_id)
        verify_internal_secret(x_internal_secret)
        result = align_score_logic(req.get("executionScore", {}))
        log_route_success("align_execution_score", request_id, aligned=result.get("aligned"), should_replan=result.get("shouldReplan"))
        return result
    except Exception as error:
        request_id = req.get("requestId") or req.get("executionScore", {}).get("metadata", {}).get("request_id")
        log_runtime_exception("align_execution_score", request_id, error)
        raise HTTPException(status_code=500, detail=str(error))

@web_app.get("/health")
def health():
    return {"status": "ok", "version": TRANSLATOR_VERSION}

@app.function(
    image=image, 
    cpu=4.0,
    memory=16384,
    secrets=[modal.Secret.from_name("sentry-r2-secrets")], 
    timeout=300
)
@modal.asgi_app()
def fastapi_app():
    return web_app
