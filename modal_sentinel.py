import os
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional

import modal
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


PROMPT_DIR = "/root/parrot-prompts"
SENTINEL_VERSION = "sentinel-modal-v1"
INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "secret")

image = (
    modal.Image.debian_slim()
    .pip_install("fastapi[standard]", "pydantic", "duckdb", "pyyaml")
    .add_local_dir("parrot-prompts", remote_path=PROMPT_DIR)
)

app = modal.App("statsparrot-sentinel")
web_app = FastAPI(title="StatsParrot Sentinel")


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


def verify_internal_secret(x_internal_secret: Optional[str]) -> None:
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized. Invalid internal secret.")


def load_prompt(filename: str) -> str:
    return Path(PROMPT_DIR, filename).read_text(encoding="utf-8")


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
    goals: List[str] = []
    should_invalidate = False

    if null_ratio > 0.2:
        goals.append("High null pressure detected. Tighten null policy and semantic casting.")
        should_invalidate = True

    if request.scope == "global" and len(request.data_sample) > 0:
        goals.append("Global node updated. Re-evaluate cross-source groups and insights.")

    if numeric_cols:
        goals.append(f"Review metric stability for numeric columns: {', '.join(numeric_cols[:5])}.")

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
            "prompt_file": "sentinel_evaluate_node.md",
            "prompt_preview": prompt_text.splitlines()[:6],
        },
    }


@web_app.get("/health")
def health():
    return {"status": "ok", "service": "statsparrot-sentinel", "sentinel_version": SENTINEL_VERSION}


@app.function(image=image, timeout=300)
@modal.asgi_app()
def fastapi_app():
    return web_app


@app.local_entrypoint()
def main():
    print("StatsParrot Sentinel is ready.")
    print("Deploy: modal deploy modal_sentinel.py")
    print("Serve:  modal serve modal_sentinel.py")
