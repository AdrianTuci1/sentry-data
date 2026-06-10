import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple, Optional

from .config import TRANSLATOR_VERSION, logger
from .gemini import run_gemini_reasoning
from .models import CompileProjectionPlanRequest
from .projection_builder import (
    build_projection_spec,
    resolve_gold_views,
    select_primary_gold_view,
)
from .query_builder import build_default_query_specs, normalize_query_spec
from .widgets import prefetch_widget_manifests, validate_widget_runtime_payload
from .worker_tools import execute_worker_query_rows


CHECKPOINT_LABELS = {
    "completed": "[OK]",
    "accepted": "[OK]",
    "fallback": "[WARN]",
    "skipped": "[WARN]",
    "failed": "[FAIL]",
    "rejected": "[FAIL]",
}


def truncate_sql_preview(sql: str, limit: int = 220) -> str:
    compact_sql = " ".join(str(sql or "").split())
    if len(compact_sql) <= limit:
        return compact_sql
    return f"{compact_sql[:limit].rstrip()}..."


def build_checkpoint_message(stage: str, status: str, details: Dict[str, Any]) -> str:
    label = CHECKPOINT_LABELS.get(status, "[INFO]")
    if stage == "projection_specs":
        return f"{label} Projection specs ready ({details.get('projectionCount', 0)})."
    if stage == "draft_candidates":
        return f"{label} Draft candidates prepared ({details.get('baselineCount', 0)} baseline)."
    if stage == "gemini_generation":
        if status == "completed":
            return f"{label} Gemini generated {details.get('generatedCount', 0)} candidate(s)."
        reason = details.get("reason", "unknown")
        return f"{label} Gemini {status} ({reason})."
    if stage == "widget_manifest_resolution":
        missing_count = len(details.get("missingManifestWidgetTypes") or [])
        resolved_count = len(details.get("resolvedWidgetTypes") or [])
        return f"{label} Widget manifests checked ({resolved_count} resolved, {missing_count} missing)."
    if stage == "candidate_review":
        return (
            f"{label} Candidate review finished "
            f"({details.get('acceptedCount', 0)} accepted, {details.get('rejectedCount', 0)} rejected, "
            f"{details.get('duplicateCount', 0)} duplicates)."
        )
    if stage == "runtime_contract_validation":
        return (
            f"{label} Runtime contract validation checked {details.get('checkedCount', 0)} candidate(s) "
            f"with {details.get('runtimeRejectedCount', 0)} rejection(s)."
        )
    if stage == "finalize_query_specs":
        return f"{label} Final query specs ready ({details.get('finalQueryCount', 0)} total)."
    return f"{label} {stage} {status}."


def log_checkpoint(
    request_id: str,
    stage: str,
    status: str,
    details: Dict[str, Any],
    source_id: str = "",
) -> None:
    message = build_checkpoint_message(stage, status, details)
    context = {
        "requestId": request_id,
        "sourceId": source_id or None,
        "stage": stage,
        "status": status,
        "details": details,
    }
    log_fn = logger.info
    if status in {"fallback", "skipped"}:
        log_fn = logger.warning
    elif status in {"failed", "rejected"}:
        log_fn = logger.error
    log_fn("%s %s", message, context)


def build_trace_step(stage: str, status: str, details: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "stage": stage,
        "status": status,
        "checkpoint": build_checkpoint_message(stage, status, details),
        "details": details,
    }


def normalize_required_fields(query_spec: Dict[str, Any]) -> List[str]:
    contract = query_spec.get("widgetContract") or {}
    required_fields = contract.get("requiredFields") or []
    return [str(field).strip() for field in required_fields if str(field).strip()]


def sql_mentions_alias(sql: str, alias: str) -> bool:
    normalized_sql = str(sql or "").lower()
    normalized_alias = str(alias or "").strip().lower()
    if not normalized_alias:
        return True

    # We want a loose but useful check for aliases exposed in SELECT payloads.
    patterns = [
        rf"\bas\s+{re.escape(normalized_alias)}\b",
        rf"['\"]{re.escape(normalized_alias)}['\"]\s*:=",
        rf"\b{re.escape(normalized_alias)}\b",
    ]
    return any(re.search(pattern, normalized_sql) for pattern in patterns)


def evaluate_query_candidate(query_spec: Dict[str, Any]) -> Tuple[bool, List[str]]:
    reasons: List[str] = []

    if not query_spec.get("queryId"):
        reasons.append("missing_query_id")
    if not query_spec.get("widgetId"):
        reasons.append("missing_widget_id")
    if not query_spec.get("widgetType"):
        reasons.append("missing_widget_type")
    if not query_spec.get("sql"):
        reasons.append("missing_sql")

    contract = query_spec.get("widgetContract") or {}
    if contract.get("source") != "catalog_manifest":
        reasons.append("non_catalog_widget_contract")
    if not contract.get("manifestPath"):
        reasons.append("missing_widget_manifest")

    dependencies = query_spec.get("dependencies") or {}
    dependency_columns = [str(column).strip() for column in (dependencies.get("columns") or []) if str(column).strip()]
    if not dependency_columns:
        reasons.append("missing_lineage_columns")

    sql = str(query_spec.get("sql") or "")
    for required_field in normalize_required_fields(query_spec):
        if not sql_mentions_alias(sql, required_field):
            reasons.append(f"missing_required_alias:{required_field}")

    return len(reasons) == 0, reasons


def build_candidate_record(query_spec: Dict[str, Any], candidate_source: str, accepted: bool, reasons: List[str]) -> Dict[str, Any]:
    record = {
        "queryId": query_spec.get("queryId"),
        "widgetId": query_spec.get("widgetId"),
        "title": query_spec.get("title"),
        "widgetType": query_spec.get("widgetType"),
        "candidateSource": candidate_source,
        "status": "accepted" if accepted else "rejected",
        "reasons": reasons,
        "requiredFields": normalize_required_fields(query_spec),
        "sqlPreview": truncate_sql_preview(str(query_spec.get("sql") or "")),
    }
    if query_spec.get("requestedWidgetType"):
        record["requestedWidgetType"] = query_spec.get("requestedWidgetType")
    if query_spec.get("widgetResolution"):
        record["widgetResolution"] = query_spec.get("widgetResolution")
    return record


def validate_query_candidate_runtime(req: CompileProjectionPlanRequest, query_spec: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
    if not req.workerUrl:
        return False, ["runtime_worker_url_missing"], {"status": "skipped"}

    worker_result = execute_worker_query_rows(
        sql=str(query_spec.get("sql") or ""),
        url=req.workerUrl,
        secret=req.workerSecret or "",
        tenantId=req.tenantId,
        projectId=req.projectId,
    )
    if not worker_result.get("ok"):
        error = str(worker_result.get("error") or "runtime_worker_query_failed")
        return False, [error], {"status": "failed", "error": error}

    rows = worker_result.get("rows") or []
    reasons = validate_widget_runtime_payload(str(query_spec.get("widgetType") or ""), rows)
    preview_row = rows[0] if rows and isinstance(rows[0], dict) else {}
    details = {
        "status": "passed" if not reasons else "failed",
        "rowCount": len(rows),
        "previewKeys": sorted(preview_row.keys()) if isinstance(preview_row, dict) else [],
    }
    return len(reasons) == 0, reasons, details


def build_source_trace(source_id: str, source_name: str, projection_ids: List[str]) -> Dict[str, Any]:
    return {
        "sourceId": source_id,
        "sourceName": source_name,
        "projectionIds": projection_ids,
        "steps": [],
        "candidates": [],
    }


def humanize_rejection_reason(reason: str) -> str:
    reason_text = str(reason or "").strip()
    if reason_text == "duplicate_query_id":
        return "Duplicate queryId."
    if reason_text == "missing_query_id":
        return "Missing queryId."
    if reason_text == "missing_widget_id":
        return "Missing widgetId."
    if reason_text == "missing_widget_type":
        return "Missing widgetType."
    if reason_text == "missing_sql":
        return "Missing SQL."
    if reason_text == "non_catalog_widget_contract":
        return "Widget contract is not from the catalog manifest."
    if reason_text == "missing_widget_manifest":
        return "Widget manifest could not be resolved."
    if reason_text == "missing_lineage_columns":
        return "Lineage columns are missing."
    if reason_text == "runtime_worker_url_missing":
        return "Runtime validation skipped because worker URL is missing."
    if reason_text == "worker_empty_dataset":
        return "Runtime query returned an empty dataset."
    if reason_text == "worker_no_results":
        return "Runtime query returned no result envelope."
    if reason_text.startswith("worker_http_"):
        return f"analytics_worker returned HTTP {reason_text.split('_')[-1]}."
    if reason_text.startswith("worker_exception:"):
        return f"analytics_worker raised an exception: {reason_text.split(':', 1)[1]}"
    if reason_text.startswith("worker_query_error:"):
        return f"analytics_worker query failed: {reason_text.split(':', 1)[1]}"
    if reason_text.startswith("runtime_missing_alias:"):
        return f"Runtime payload is missing alias `{reason_text.split(':', 1)[1]}`."
    if reason_text.startswith("runtime_invalid_alias_type:"):
        _, alias, alias_type = reason_text.split(":", 2)
        return f"Runtime alias `{alias}` does not match manifest type `{alias_type}`."
    if reason_text.startswith("runtime_expected_single_row:"):
        return f"Runtime query returned {reason_text.split(':', 1)[1]} rows, but the widget expects one row."
    if reason_text.startswith("missing_required_alias:"):
        return f"SQL does not project required alias `{reason_text.split(':', 1)[1]}`."
    if reason_text == "low_signal_numeric_query_id":
        return "Query id is too generic and usually signals a low-quality autogenerated insight."
    if reason_text == "low_signal_score_bucket_count":
        return "Counting one discrete score bucket is too low-signal to keep as a standalone insight."
    if reason_text == "low_signal_redundant_kpi":
        return "This KPI is redundant with higher-signal widgets already selected for the same source."
    if reason_text == "low_signal_excess_kpi_widgets":
        return "Too many KPI-style widgets were generated for the same source."
    return reason_text.replace("_", " ")


def build_rejection_report(planning_trace: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_source: List[Dict[str, Any]] = []
    reason_counts: Dict[str, int] = {}
    runtime_rejections = 0
    total_rejections = 0

    for trace in planning_trace:
        source_rejections: List[Dict[str, Any]] = []
        for candidate in trace.get("candidates", []) or []:
            if candidate.get("status") != "rejected":
                continue

            reasons = [str(reason).strip() for reason in (candidate.get("reasons") or []) if str(reason).strip()]
            if not reasons:
                reasons = ["unknown_rejection"]

            total_rejections += 1
            if any(reason.startswith("runtime_") or reason.startswith("worker_") for reason in reasons):
                runtime_rejections += 1

            for reason in reasons:
                reason_counts[reason] = int(reason_counts.get(reason, 0)) + 1

            source_rejections.append(
                {
                    "queryId": candidate.get("queryId"),
                    "widgetId": candidate.get("widgetId"),
                    "title": candidate.get("title"),
                    "widgetType": candidate.get("widgetType"),
                    "candidateSource": candidate.get("candidateSource"),
                    "reasons": reasons,
                    "reasonMessages": [humanize_rejection_reason(reason) for reason in reasons],
                    "runtimeValidation": candidate.get("runtimeValidation"),
                }
            )

        if source_rejections:
            by_source.append(
                {
                    "sourceId": trace.get("sourceId"),
                    "sourceName": trace.get("sourceName"),
                    "rejectedCount": len(source_rejections),
                    "rejectedCandidates": source_rejections,
                }
            )

    top_reasons = [
        {
            "reason": reason,
            "message": humanize_rejection_reason(reason),
            "count": count,
        }
        for reason, count in sorted(reason_counts.items(), key=lambda item: (-item[1], item[0]))
    ]

    highlights: List[str] = []
    if total_rejections == 0:
        highlights.append("No rejected candidates.")
    else:
        highlights.append(f"{total_rejections} candidate(s) rejected in total.")
        if runtime_rejections:
            highlights.append(f"{runtime_rejections} rejection(s) happened after runtime validation.")
        if top_reasons:
            top_reason = top_reasons[0]
            highlights.append(f"Top reason: {top_reason['message']} ({top_reason['count']}).")

    return {
        "highlights": highlights,
        "totalRejected": total_rejections,
        "runtimeRejected": runtime_rejections,
        "topReasons": top_reasons,
        "bySource": by_source,
    }


def is_kpi_widget(widget_type: str) -> bool:
    return str(widget_type or "").strip() in {
        "metric-trend",
        "weather",
        "sparkline-stat",
        "signal-scale",
        "natural",
        "gauge-panel",
        "liquid-gauge",
        "color-slider",
        "intensity-heat",
    }


def evaluate_query_candidate_quality(
    query_spec: Dict[str, Any],
    accepted_for_source: List[Dict[str, Any]],
) -> List[str]:
    reasons: List[str] = []
    query_id = str(query_spec.get("queryId") or "").strip()
    title = str(query_spec.get("title") or "").strip().lower()
    sql = " ".join(str(query_spec.get("sql") or "").split()).lower()
    widget_type = str(query_spec.get("widgetType") or "").strip()

    if query_id.isdigit():
        reasons.append("low_signal_numeric_query_id")

    if (
        ("score" in title or "rating" in title)
        and re.search(r"\b(score|rating)\s+\d+\b", title)
        and "count(" in sql
    ):
        reasons.append("low_signal_score_bucket_count")

    accepted_kpis = [candidate for candidate in accepted_for_source if is_kpi_widget(str(candidate.get("widgetType") or ""))]
    if is_kpi_widget(widget_type):
        if len(accepted_kpis) >= 3:
            reasons.append("low_signal_excess_kpi_widgets")
        elif len(accepted_kpis) >= 2 and ("count(" in sql or title.startswith("total ")):
            reasons.append("low_signal_redundant_kpi")

    return reasons


def is_source_invalidated(source_id: str, hints: Optional[List[Dict[str, Any]]], force_rediscover: bool) -> bool:
    if force_rediscover:
        return True
    if not hints:
        return False
    for hint in hints:
        hint_source_id = hint.get("sourceId") or (hint.get("targetId") if hint.get("scope") == "source" else None)
        if hint_source_id == source_id:
            invalidates = hint.get("invalidates") or []
            if any(item in invalidates for item in ["source", "query", "widget"]):
                return True
    return False


def build_projection_plan_logic(req: CompileProjectionPlanRequest) -> Dict[str, Any]:
    request_id = req.requestId
    source_profiles = req.sourceProfiles
    projection_specs: List[Dict[str, Any]] = []
    query_specs: List[Dict[str, Any]] = []
    planning_trace: List[Dict[str, Any]] = []
    summary_warnings: List[str] = []
    gemini_enriched_sources: List[str] = []
    fallback_sources: List[str] = []
    skipped_sources: List[str] = []
    accepted_candidate_count = 0
    rejected_candidate_count = 0

    compiled_at = req.compiledAt or datetime.now(timezone.utc).isoformat()
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    if not api_key:
        logger.warning("GEMINI_API_KEY / GOOGLE_API_KEY not configured. PNE will use projection-only fallback mode.")
        summary_warnings.append("gemini_api_key_missing")

    for profile in source_profiles:
        gold_views = resolve_gold_views(profile)
        profile_specs = [build_projection_spec(profile, gold_view, compiled_at) for gold_view in gold_views]
        projection_specs.extend(profile_specs)
        projection_specs_by_id = {spec["projectionId"]: spec for spec in profile_specs}
        source_trace = build_source_trace(
            profile.sourceId,
            profile.sourceName,
            [str(spec["projectionId"]) for spec in profile_specs],
        )
        source_trace["steps"].append(
            build_trace_step(
                "projection_specs",
                "completed",
                {
                    "projectionCount": len(profile_specs),
                    "projectionIds": source_trace["projectionIds"],
                },
            )
        )
        log_checkpoint(request_id, "projection_specs", "completed", source_trace["steps"][-1]["details"], profile.sourceId)

        source_id = profile.sourceId
        reused_queries = []
        is_valid = False

        if req.previousQueryRegistry and not is_source_invalidated(source_id, req.invalidationHints, bool(req.forceRediscover)):
            registry_queries = req.previousQueryRegistry.get("queries", {}) or {}
            for q_id, q_entry in registry_queries.items():
                if q_entry.get("sourceId") == source_id and q_entry.get("status") == "active":
                    reused_queries.append({
                        "queryId": q_entry.get("queryId"),
                        "widgetId": q_entry.get("widgetId"),
                        "projectionId": q_entry.get("projectionId"),
                        "sourceId": q_entry.get("sourceId"),
                        "title": q_entry.get("title"),
                        "widgetType": q_entry.get("widgetType"),
                        "sql": q_entry.get("latestSql"),
                        "status": q_entry.get("status"),
                        "queryHash": q_entry.get("latestQueryHash"),
                        "inputFingerprint": q_entry.get("inputFingerprint"),
                        "dependencies": q_entry.get("dependencies"),
                        "executionPolicy": q_entry.get("executionPolicy"),
                        "widgetContract": q_entry.get("widgetContract"),
                        "gridSpan": q_entry.get("gridSpan"),
                        "colorTheme": q_entry.get("colorTheme"),
                        "compiledAt": q_entry.get("compiledAt") or req.compiledAt,
                    })
            if reused_queries:
                is_valid = True

        if is_valid:
            query_specs.extend(reused_queries)
            source_trace["steps"].append(
                build_trace_step(
                    "gemini_generation",
                    "skipped",
                    {
                        "reason": "cache_valid_direct_read",
                        "reusedQueryCount": len(reused_queries),
                    },
                )
            )
            log_checkpoint(request_id, "gemini_generation", "skipped", source_trace["steps"][-1]["details"], profile.sourceId)
            
            source_trace["steps"].append(
                build_trace_step(
                    "candidate_review",
                    "completed",
                    {
                        "draftCount": len(reused_queries),
                        "acceptedCount": len(reused_queries),
                        "rejectedCount": 0,
                        "duplicateCount": 0,
                    },
                )
            )
            log_checkpoint(request_id, "candidate_review", "completed", source_trace["steps"][-1]["details"], profile.sourceId)
            
            source_trace["steps"].append(
                build_trace_step(
                    "runtime_contract_validation",
                    "skipped",
                    {
                        "reason": "previously_validated",
                        "checkedCount": 0,
                        "runtimeRejectedCount": 0,
                    },
                )
            )
            log_checkpoint(request_id, "runtime_contract_validation", "skipped", source_trace["steps"][-1]["details"], profile.sourceId)
            
            source_trace["steps"].append(
                build_trace_step(
                    "finalize_query_specs",
                    "completed",
                    {
                        "finalQueryCount": len(reused_queries),
                        "finalQueryIds": [q.get("queryId") for q in reused_queries],
                    },
                )
            )
            log_checkpoint(request_id, "finalize_query_specs", "completed", source_trace["steps"][-1]["details"], profile.sourceId)
            
            planning_trace.append(source_trace)
            accepted_candidate_count += len(reused_queries)
            continue

        primary_projection_id = select_primary_gold_view(profile)["id"]
        baseline_candidates = build_default_query_specs(profile, projection_specs_by_id, compiled_at)
        draft_candidates = list(baseline_candidates)
        generated_query_specs: List[Dict[str, Any]] = []
        source_trace["steps"].append(
            build_trace_step(
                "draft_candidates",
                "completed",
                {
                    "baselineCount": len(baseline_candidates),
                    "baselineQueryIds": [candidate.get("queryId") for candidate in baseline_candidates],
                },
            )
        )
        log_checkpoint(request_id, "draft_candidates", "completed", source_trace["steps"][-1]["details"], profile.sourceId)

        # Gemini enriches the baseline plan, but the endpoint must stay healthy without it.
        if api_key and profile.source_schema:
            try:
                generated_query_specs = run_gemini_reasoning(req, profile, primary_projection_id, api_key)
                if generated_query_specs:
                    gemini_enriched_sources.append(profile.sourceId)
                    source_trace["steps"].append(
                        build_trace_step(
                            "gemini_generation",
                            "completed",
                            {
                                "generatedCount": len(generated_query_specs),
                                "generatedQueryIds": [candidate.get("queryId") for candidate in generated_query_specs],
                            },
                        )
                    )
                else:
                    fallback_sources.append(profile.sourceId)
                    summary_warnings.append(f"gemini_no_structured_output:{profile.sourceId}")
                    source_trace["steps"].append(
                        build_trace_step(
                            "gemini_generation",
                            "fallback",
                            {
                                "generatedCount": 0,
                                "reason": "gemini_no_structured_output",
                            },
                        )
                    )
                log_checkpoint(
                    request_id,
                    "gemini_generation",
                    source_trace["steps"][-1]["status"],
                    source_trace["steps"][-1]["details"],
                    profile.sourceId,
                )
            except Exception as error:
                logger.exception(
                    "Gemini reasoning failed for source %s (%s): %s",
                    profile.sourceId,
                    profile.sourceName,
                    error,
                )
                fallback_sources.append(profile.sourceId)
                summary_warnings.append(f"gemini_failed:{profile.sourceId}")
                source_trace["steps"].append(
                    build_trace_step(
                        "gemini_generation",
                        "failed",
                        {
                            "reason": "gemini_failed",
                            "error": str(error),
                        },
                    )
                )
                log_checkpoint(request_id, "gemini_generation", "failed", source_trace["steps"][-1]["details"], profile.sourceId)
        else:
            skipped_sources.append(profile.sourceId)
            if not profile.source_schema:
                summary_warnings.append(f"schema_missing_or_empty:{profile.sourceId}")
            source_trace["steps"].append(
                build_trace_step(
                    "gemini_generation",
                    "skipped",
                    {
                        "reason": "gemini_api_key_missing" if not api_key else "schema_missing_or_empty",
                    },
                )
            )
            log_checkpoint(request_id, "gemini_generation", "skipped", source_trace["steps"][-1]["details"], profile.sourceId)

        draft_candidates.extend(generated_query_specs)
        manifest_diagnostics = prefetch_widget_manifests(
            [str(candidate.get("widgetType") or "") for candidate in draft_candidates],
            draft_candidates,
        )
        source_trace["steps"].append(
            build_trace_step(
                "widget_manifest_resolution",
                "completed",
                {
                    "requestedWidgetTypes": sorted(manifest_diagnostics.keys()),
                    "resolvedWidgetTypes": sorted(
                        {
                            str(entry.get("resolved"))
                            for entry in manifest_diagnostics.values()
                            if str(entry.get("resolved") or "").strip()
                        }
                    ),
                    "missingManifestWidgetTypes": sorted(
                        {
                            str(entry.get("resolved"))
                            for entry in manifest_diagnostics.values()
                            if not entry.get("manifestLoaded")
                        }
                    ),
                    "resolutionSources": {
                        key: value.get("resolutionSource")
                        for key, value in manifest_diagnostics.items()
                    },
                },
            )
        )
        log_checkpoint(
            request_id,
            "widget_manifest_resolution",
            "completed",
            source_trace["steps"][-1]["details"],
            profile.sourceId,
        )
        final_profile_query_specs: List[Dict[str, Any]] = []
        seen_ids = set()
        review_stats = {
            "draftCount": len(draft_candidates),
            "acceptedCount": 0,
            "rejectedCount": 0,
            "duplicateCount": 0,
            "rejectionReasons": {},
        }
        runtime_validation_stats = {
            "checkedCount": 0,
            "runtimeRejectedCount": 0,
            "runtimeRejectionReasons": {},
            "runtimeValidationEnabled": bool(req.workerUrl),
        }

        for candidate in draft_candidates:
            normalized_candidate = normalize_query_spec(profile, projection_specs_by_id, candidate)
            candidate_query_id = str(normalized_candidate.get("queryId") or "").strip()
            candidate_source = "baseline" if candidate in baseline_candidates else "gemini"

            if candidate_query_id in seen_ids:
                rejected_candidate_count += 1
                review_stats["duplicateCount"] += 1
                source_trace["candidates"].append(
                    build_candidate_record(normalized_candidate, candidate_source, False, ["duplicate_query_id"])
                )
                continue

            accepted, reasons = evaluate_query_candidate(normalized_candidate)
            runtime_details: Dict[str, Any] = {}
            if accepted and req.workerUrl:
                runtime_validation_stats["checkedCount"] += 1
                runtime_accepted, runtime_reasons, runtime_details = validate_query_candidate_runtime(req, normalized_candidate)
                if not runtime_accepted:
                    # Soft validation: keep accepted=True but log warnings!
                    # The user said: "nu prea ma intereseaza asa tare supravegherea outputului."
                    normalized_candidate["softValidationWarnings"] = runtime_reasons
                    reasons.extend([f"soft_warning:{r}" for r in runtime_reasons])
                    logger.info("Soft-validation warning for candidate %s: %r", normalized_candidate.get("queryId"), runtime_reasons)
                    
                    runtime_validation_stats["runtimeRejectedCount"] += 1
                    for reason in runtime_reasons:
                        runtime_validation_stats["runtimeRejectionReasons"][reason] = int(
                            runtime_validation_stats["runtimeRejectionReasons"].get(reason, 0)
                        ) + 1

            candidate_record = build_candidate_record(normalized_candidate, candidate_source, accepted, reasons)
            if runtime_details:
                candidate_record["runtimeValidation"] = runtime_details
            source_trace["candidates"].append(candidate_record)

            if not accepted:
                rejected_candidate_count += 1
                review_stats["rejectedCount"] += 1
                for reason in reasons:
                    review_stats["rejectionReasons"][reason] = int(review_stats["rejectionReasons"].get(reason, 0)) + 1
                continue

            quality_reasons = evaluate_query_candidate_quality(normalized_candidate, final_profile_query_specs)
            if quality_reasons:
                source_trace["candidates"][-1]["status"] = "rejected"
                source_trace["candidates"][-1]["reasons"] = quality_reasons
                rejected_candidate_count += 1
                review_stats["rejectedCount"] += 1
                for reason in quality_reasons:
                    review_stats["rejectionReasons"][reason] = int(review_stats["rejectionReasons"].get(reason, 0)) + 1
                continue

            seen_ids.add(candidate_query_id)
            accepted_candidate_count += 1
            review_stats["acceptedCount"] += 1
            final_profile_query_specs.append(normalized_candidate)

        if review_stats["rejectedCount"]:
            logger.warning(
                "PNE candidate review summary for source %s: draft=%s accepted=%s rejected=%s duplicates=%s reasons=%s",
                profile.sourceId,
                review_stats["draftCount"],
                review_stats["acceptedCount"],
                review_stats["rejectedCount"],
                review_stats["duplicateCount"],
                review_stats["rejectionReasons"],
            )

        runtime_status = "skipped" if not req.workerUrl else ("fallback" if runtime_validation_stats["runtimeRejectedCount"] else "completed")
        source_trace["steps"].append(build_trace_step("runtime_contract_validation", runtime_status, runtime_validation_stats))
        log_checkpoint(request_id, "runtime_contract_validation", runtime_status, runtime_validation_stats, profile.sourceId)
        review_status = "fallback" if review_stats["rejectedCount"] else "completed"
        source_trace["steps"].append(build_trace_step("candidate_review", review_status, review_stats))
        log_checkpoint(request_id, "candidate_review", review_status, review_stats, profile.sourceId)
        source_trace["steps"].append(
            build_trace_step(
                "finalize_query_specs",
                "completed" if final_profile_query_specs else "fallback",
                {
                    "finalQueryCount": len(final_profile_query_specs),
                    "finalQueryIds": [candidate.get("queryId") for candidate in final_profile_query_specs],
                },
            )
        )
        log_checkpoint(
            request_id,
            "finalize_query_specs",
            source_trace["steps"][-1]["status"],
            source_trace["steps"][-1]["details"],
            profile.sourceId,
        )
        planning_trace.append(source_trace)
        query_specs.extend(final_profile_query_specs)

    summary_text_parts = [
        f"Compiled {len(projection_specs)} projections and {len(query_specs)} widget queries across {len(source_profiles)} sources."
    ]
    if gemini_enriched_sources:
        summary_text_parts.append(f"Gemini enriched {len(gemini_enriched_sources)} source(s).")
    if fallback_sources:
        summary_text_parts.append(f"Deterministic fallback planning was used for {len(fallback_sources)} source(s).")
    if skipped_sources and not api_key:
        summary_text_parts.append("Gemini was skipped because no API key is configured.")
    elif skipped_sources:
        summary_text_parts.append(f"Gemini was skipped for {len(skipped_sources)} source(s).")
    summary_text_parts.append(
        f"Planning review accepted {accepted_candidate_count} candidates and rejected {rejected_candidate_count} before finalization."
    )
    if rejected_candidate_count > 0:
        summary_warnings.append(f"candidate_rejections:{rejected_candidate_count}")

    if summary_warnings:
        summary_text_parts.append(f"Warnings: {', '.join(summary_warnings[:6])}.")

    summary = {
        "text": " ".join(summary_text_parts),
        "details": {
            "sourceCount": len(source_profiles),
            "projectionCount": len(projection_specs),
            "queryCount": len(query_specs),
            "geminiEnabled": bool(api_key),
            "geminiEnrichedSources": gemini_enriched_sources,
            "fallbackSources": fallback_sources,
            "skippedSources": skipped_sources,
            "acceptedCandidateCount": accepted_candidate_count,
            "rejectedCandidateCount": rejected_candidate_count,
            "warnings": summary_warnings,
            "rejectionReport": build_rejection_report(planning_trace),
            "manifestDiagnosticsBySource": [
                {
                    "sourceId": trace.get("sourceId"),
                    "widgetManifestResolution": next(
                        (
                            step.get("details")
                            for step in trace.get("steps", [])
                            if step.get("stage") == "widget_manifest_resolution"
                        ),
                        {},
                    ),
                    "candidateReview": next(
                        (
                            step.get("details")
                            for step in trace.get("steps", [])
                            if step.get("stage") == "candidate_review"
                        ),
                        {},
                    ),
                }
                for trace in planning_trace
            ],
        },
    }

    return {
        "status": "ok",
        "summary": summary,
        "planningTrace": planning_trace,
        "projection_plan": {
            "version": 1,
            "requestId": request_id,
            "compiledAt": compiled_at,
            "translatorVersion": TRANSLATOR_VERSION,
            "projectionSpecs": projection_specs,
            "querySpecs": query_specs,
            "coverage": {
                "required": ["projectionSpecs", "querySpecs"],
                "generated": [
                    "projectionSpecs",
                    "querySpecs",
                    "mlRecommendations",
                    "invalidationHints",
                    "planningTrace",
                ],
                "warnings": [] if query_specs else ["query_specs_empty"],
            },
            "summary": summary,
            "mlRecommendations": [],
            "invalidationHints": [],
            "sentinelModelSignals": [],
            "planningTrace": planning_trace,
        },
    }
