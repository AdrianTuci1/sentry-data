from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

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

def align_score_logic(execution_score: Dict[str, Any]) -> Dict[str, Any]:
    """Ported from Sentinel: Ensures the execution plan is structurally sound."""
    score = deepcopy(execution_score)
    reasons: List[str] = []
    should_replan = False
    aligned = True

    source = score.get("source", {})
    uris = source.get("uris") or []
    virtual_silver = score.get("pnc_logic", {}).get("virtual_silver") or []
    metrics = score.get("analysis_goal", {}).get("metrics") or []
    infrastructure = score.setdefault("infrastructure", {})

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

    source_count = len(uris)
    target_latency_ms = score.get("metadata", {}).get("target_latency_ms", 45000)
    max_workers = int(infrastructure.get("max_workers", 1) or 1)
    
    if source_count >= 4 and target_latency_ms <= 45000 and max_workers < 24:
        infrastructure["max_workers"] = 24
        infrastructure["auto_scale"] = True
        reasons.append("capacity_hint_upgraded_for_multi_source_workload")

    status = "replan_required" if should_replan else ("aligned_with_warnings" if reasons else "aligned")
    return {
        "status": status,
        "aligned": aligned,
        "should_replan": should_replan,
        "reasons": reasons,
        "execution_score": score,
        "details": {
            "sentinel_version": "pne-integrated-v1",
            "checks": ["structural_completeness", "capacity_coherence"],
        },
    }
