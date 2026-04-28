from typing import Dict, List

from .helpers import build_fingerprint, build_projection_sql_source, hash_dict, quote_identifier
from .models import SourceProfile


def build_fallback_gold_views(profile: SourceProfile) -> List[Dict[str, object]]:
    source_id = profile.sourceId
    schema = profile.source_schema
    metric_columns = [column for column in schema if column.get("name") in profile.metricCandidates]
    views: List[Dict[str, object]] = [
        {
            "id": f"gold-{source_id}-core",
            "title": f"{profile.sourceName} Core View",
            "description": "Primary queryable virtual gold view generated directly from Bronze.",
            "columns": schema,
            "logic": {
                "intent": f"Expose a stable query layer for {profile.sourceName} directly from Bronze.",
                "code": f"SELECT * FROM {build_projection_sql_source(profile)}",
            },
        }
    ]
    if metric_columns:
        quoted_columns = ", ".join(
            [quote_identifier(column["name"]) for column in metric_columns if column.get("name")]
        )
        views.append(
            {
                "id": f"gold-{source_id}-metrics",
                "title": f"{profile.sourceName} Metrics View",
                "description": "Metric-oriented virtual view used for groups, insights, and recommendations.",
                "columns": metric_columns,
                "logic": {
                    "intent": f"Expose the metric slice of {profile.sourceName} for downstream analytics.",
                    "code": f"SELECT {quoted_columns} FROM {build_projection_sql_source(profile)}",
                },
            }
        )
    return views


def resolve_gold_views(profile: SourceProfile) -> List[Dict[str, object]]:
    return profile.goldViews or build_fallback_gold_views(profile)


def select_primary_gold_view(profile: SourceProfile) -> Dict[str, object]:
    gold_views = resolve_gold_views(profile)
    for view in gold_views:
        if str(view.get("id", "")).endswith("-core"):
            return view
    return gold_views[0]


def select_metric_gold_view(profile: SourceProfile) -> Dict[str, object]:
    gold_views = resolve_gold_views(profile)
    for view in gold_views:
        if str(view.get("id", "")).endswith("-metrics"):
            return view
    return select_primary_gold_view(profile)


def build_projection_spec(profile: SourceProfile, gold_view: Dict[str, object], compiled_at: str) -> Dict[str, object]:
    columns = gold_view.get("columns") or profile.source_schema
    projection_id = str(gold_view.get("id"))
    logic = gold_view.get("logic") or {
        "intent": gold_view.get("description") or f"Expose {profile.sourceName} without mutating the source.",
        "code": f"SELECT * FROM {build_projection_sql_source(profile)}",
    }

    # Projection IDs must match the frontend gold view IDs so lineage can reconnect correctly.
    spec = {
        "projectionId": projection_id,
        "title": gold_view.get("title") or f"Harmonized {profile.sourceName}",
        "sourceId": profile.sourceId,
        "sourceName": profile.sourceName,
        "version": "v1",
        "rawUri": profile.uri,
        "servingUri": profile.uri,
        "status": "active",
        "materialization": "virtual",
        "inputFingerprint": build_fingerprint(profile, profile.source_schema),
        "dependency": {"sourceIds": [profile.sourceId], "columns": [column.get("name") for column in columns]},
        "columns": columns,
        "logic": logic,
        "createdAt": compiled_at,
    }
    spec["specHash"] = hash_dict(spec)
    return spec

