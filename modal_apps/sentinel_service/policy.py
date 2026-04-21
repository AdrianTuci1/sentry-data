from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .config import SENTINEL_VERSION
from .model_runtime import drift_predictor_details, evaluate_drift_from_sample
from .prompts import load_prompt
from .schemas import RuntimeEvaluationRequest


def now_iso() -> str:
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
        "model": drift_predictor_details(),
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
