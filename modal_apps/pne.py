import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import modal
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


PROMPT_DIR = "/root/parrot-prompts"
TRANSLATOR_VERSION = "pne-modal-v1"
INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "secret")
REPO_ROOT = Path(__file__).resolve().parents[1]

image = (
    modal.Image.debian_slim()
    .pip_install("fastapi[standard]", "pydantic", "duckdb", "pyyaml")
    .add_local_dir(str(REPO_ROOT / "parrot-prompts"), remote_path=PROMPT_DIR)
)

app = modal.App("statsparrot-pne")
web_app = FastAPI(title="StatsParrot Parrot Neural Engine")


class RuntimeContextPayload(BaseModel):
    tenantId: str
    projectId: str
    rawSourceUris: List[str] = Field(default_factory=list)
    sourceNames: List[str] = Field(default_factory=list)
    runtimeMode: Optional[str] = None


class DnsTxtVerificationPayload(BaseModel):
    required: bool = True
    recordName: str
    domain: Optional[str] = None
    verified: bool = False
    verifiedAt: Optional[str] = None
    status: str


class ReverseEtlLimitsPayload(BaseModel):
    maxUnverifiedVms: int = 2
    stopOnErrors: List[str] = Field(default_factory=list)
    consecutiveErrorThreshold: int = 3
    requireManualVerificationAfterLimit: bool = True


class ReverseEtlPayload(BaseModel):
    enabled: bool = True
    vmMode: str = "user_owned"
    dnsTxtVerification: DnsTxtVerificationPayload
    deliveryTargets: List[str] = Field(default_factory=list)
    limits: ReverseEtlLimitsPayload
    activeVmCount: int = 0
    status: str


class CompileExecutionScoreRequest(BaseModel):
    requestId: str
    context: RuntimeContextPayload
    reverseEtl: ReverseEtlPayload


def verify_internal_secret(x_internal_secret: Optional[str]) -> None:
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized. Invalid internal secret.")


def load_prompt(filename: str) -> str:
    return Path(PROMPT_DIR, filename).read_text(encoding="utf-8")


def model_to_dict(model: BaseModel) -> Dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def compute_source_fingerprint(raw_source_uris: List[str], source_names: List[str]) -> str:
    payload = json.dumps({"uris": raw_source_uris, "sourceNames": source_names}, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def infer_source_type(raw_source_uris: List[str]) -> str:
    if not raw_source_uris:
        return "unknown"
    if all(uri.endswith(".parquet") or "parquet" in uri for uri in raw_source_uris):
        return "s3_parquet"
    if all(uri.startswith("s3://") for uri in raw_source_uris):
        return "s3_object"
    return "multi_source" if len(raw_source_uris) > 1 else "direct_source"


def build_execution_score(request: CompileExecutionScoreRequest) -> Dict[str, Any]:
    ctx = request.context
    reverse_etl = request.reverseEtl
    source_fingerprint = compute_source_fingerprint(ctx.rawSourceUris, ctx.sourceNames)
    created_at = os.getenv("PARROT_CREATED_AT") or datetime.now(timezone.utc).isoformat()
    prompt_text = load_prompt("pne_compile_execution_score.md")

    return {
        "metadata": {
            "request_id": request.requestId,
            "priority": "high",
            "target_latency_ms": 45000,
            "runtime_mode": "parrot_os",
            "translator_version": TRANSLATOR_VERSION,
            "source_fingerprint": source_fingerprint,
            "created_at": created_at,
        },
        "source": {
            "type": infer_source_type(ctx.rawSourceUris),
            "uri": ctx.rawSourceUris[0] if ctx.rawSourceUris else "",
            "uris": ctx.rawSourceUris,
            "source_names": ctx.sourceNames,
            "schema_discovery": "dynamic",
            "sampling_rate": 0.05,
        },
        "pnc_logic": {
            "virtual_silver": [
                {
                    "op": "schema_harmonize",
                    "strategy": "dynamic_inference",
                    "inputs": ctx.sourceNames if ctx.sourceNames else ctx.rawSourceUris,
                    "sentinel_verify": True,
                },
                {
                    "op": "null_policy",
                    "strategy": "adaptive_imputation",
                    "sentinel_verify": True,
                },
                {
                    "op": "type_cast",
                    "strategy": "best_effort_semantic_cast",
                    "sentinel_verify": True,
                },
            ],
            "virtual_gold_features": [
                {
                    "op": "derive_business_features",
                    "strategy": "adaptive_feature_bundle",
                    "engine": "daft_vectorized",
                },
                {
                    "op": "segment_entities",
                    "strategy": "source_aware_segmentation",
                    "engine": "daft_vectorized",
                },
                {
                    "op": "prepare_query_views",
                    "targets": ["insights", "dashboards", "reverse_etl"],
                    "engine": "daft_vectorized",
                },
            ],
        },
        "analysis_goal": {
            "type": "segmentation_and_insight",
            "group_by": ["source_name", "freshness_bucket"],
            "metrics": ["count(*)", "count(distinct entity_id)", "freshness_score"],
            "transformers_options": {
                "use_cross_attention": True,
                "latent_dim": 128,
                "prompt_reference": "pne_compile_execution_score.md",
            },
        },
        "sentinel_constraints": {
            "max_null_ratio": 0.02,
            "allow_outliers": False,
            "expected_distribution": "adaptive",
            "fail_on_anomaly": "trigger_llm_replan",
        },
        "infrastructure": {
            "engine": "modal_compat",
            "worker_type": "modal_sandbox",
            "min_workers": 1,
            "max_workers": 16,
            "auto_scale": True,
        },
        "output_streams": {
            "reverse_etl": {
                "enabled": reverse_etl.enabled,
                "vm_mode": reverse_etl.vmMode,
                "dns_txt_verification": {
                    "required": reverse_etl.dnsTxtVerification.required,
                    "record_name": reverse_etl.dnsTxtVerification.recordName,
                    "domain": reverse_etl.dnsTxtVerification.domain,
                    "verified": reverse_etl.dnsTxtVerification.verified,
                },
                "delivery_targets": reverse_etl.deliveryTargets,
                "limits": model_to_dict(reverse_etl.limits),
                "active_vm_count": reverse_etl.activeVmCount,
                "status": reverse_etl.status,
            }
        },
        "details": {
            "prompt_file": "pne_compile_execution_score.md",
            "prompt_preview": prompt_text.splitlines()[:8],
            "steps": [
                "fingerprint_sources",
                "compile_virtual_silver",
                "compile_virtual_gold",
                "apply_reverse_etl_policy",
                "emit_execution_score",
            ],
        },
    }


@web_app.post("/api/v1/compile_execution_score")
def compile_execution_score(request: CompileExecutionScoreRequest, x_internal_secret: Optional[str] = Header(None)):
    verify_internal_secret(x_internal_secret)
    execution_score = build_execution_score(request)
    return {
        "status": "compiled",
        "translator_version": TRANSLATOR_VERSION,
        "execution_score": execution_score,
        "details": execution_score["details"],
    }


@web_app.get("/health")
def health():
    return {"status": "ok", "service": "statsparrot-pne", "translator_version": TRANSLATOR_VERSION}


@app.function(image=image, timeout=300)
@modal.asgi_app()
def fastapi_app():
    return web_app


@app.local_entrypoint()
def main():
    print("StatsParrot PNE is ready.")
    print("Deploy: modal deploy modal_apps/pne.py")
    print("Serve:  modal serve modal_apps/pne.py")
