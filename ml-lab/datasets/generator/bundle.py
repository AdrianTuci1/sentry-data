from __future__ import annotations

import json
import random
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List

import pandas as pd

from .catalog import (
    DOMAIN_COMPATIBILITY_MAP,
    FAMILY_QUERY_PATTERNS,
    FOCUS_MODES,
    PROJECT_BLUEPRINTS,
    RL_CLUSTER_BLUEPRINTS,
    ROLE_FEATURE_HINTS,
    ROLE_PRIORITY,
    ROLE_WIDGET_HINTS,
    SOURCE_BLUEPRINTS,
    WIDGET_BLUEPRINTS,
)
from .common import ARTIFACT_VERSION, DEFAULT_SEED, _json_safe


def infer_semantic_role(column_name: str) -> str:
    lowered = column_name.lower()
    for role, needles in ROLE_PRIORITY:
        if any(needle in lowered for needle in needles):
            return role
    return "dimension"


def infer_unit(column_name: str, role: str) -> str:
    lowered = column_name.lower()
    if role == "temporal":
        return "timestamp"
    if role == "entity_id":
        return "identifier"
    if any(token in lowered for token in ["usd", "revenue", "mrr", "arr", "cost", "margin", "value", "cpc", "cac"]):
        return "usd"
    if any(token in lowered for token in ["rate", "ctr", "retention", "saturation_pct", "burn", "score"]):
        return "ratio"
    if "latency" in lowered:
        return "milliseconds"
    if "duration" in lowered or "cycle_days" in lowered:
        return "time"
    if "bytes" in lowered:
        return "bytes"
    if "energy" in lowered:
        return "kwh"
    if "temperature" in lowered:
        return "celsius"
    return "count"


def build_validation_rules(column_name: str, role: str) -> List[str]:
    rules = ["enforce_monotonic_time_if_temporal" if role == "temporal" else "track_null_ratio_by_partition"]
    if role in {"financial_metric", "marketing_spend", "cost_metric"}:
        rules.extend(["reject_negative_values_unless_credit_event", "monitor_scale_shifts_over_100x"])
    if role in {"quality_metric", "reliability_metric"}:
        rules.append("cap_ratio_metrics_inside_expected_band")
    if role == "security_metric":
        rules.extend(["alert_on_entropy_shift", "flag_unusual_region_spread"])
    if role == "sensor_metric":
        rules.append("validate_against_drift_and_maintenance_thresholds")
    if role == "performance_metric":
        rules.append("track_percentile_breaks_and_capacity_spikes")
    return rules


def build_query_aliases(column_name: str) -> List[str]:
    lowered = column_name.lower()
    aliases = {lowered, lowered.replace("_usd", ""), lowered.replace("_rate", "")}
    if lowered.endswith("_count"):
        aliases.add(lowered.replace("_count", ""))
    if "revenue" in lowered:
        aliases.update({"sales", "income"})
    if "sessions" in lowered:
        aliases.update({"visits", "traffic_sessions"})
    if "latency" in lowered:
        aliases.update({"response_time", "request_latency"})
    return sorted(alias for alias in aliases if alias)


def build_field_specs(source_registry: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    aggregated: Dict[str, Dict[str, Any]] = {}

    for source in source_registry:
        for field in source["schema"]:
            column_name = field["name"]
            spec = aggregated.setdefault(
                column_name,
                {
                    "field_name": column_name,
                    "semantic_role": infer_semantic_role(column_name),
                    "data_types_seen": set(),
                    "source_coverage": set(),
                    "domain_coverage": set(),
                    "nullable_ratio_max": 0.0,
                    "min_value_observed": None,
                    "max_value_observed": None,
                    "sample_values": [],
                },
            )

            spec["data_types_seen"].add(field["dtype"])
            spec["source_coverage"].add(source["source_name"])
            spec["domain_coverage"].add(source["domain"])
            spec["nullable_ratio_max"] = max(spec["nullable_ratio_max"], field["nullable_ratio"])
            if field["min_value"] is not None:
                current_min = spec["min_value_observed"]
                spec["min_value_observed"] = field["min_value"] if current_min is None else min(current_min, field["min_value"])
            if field["max_value"] is not None:
                current_max = spec["max_value_observed"]
                spec["max_value_observed"] = field["max_value"] if current_max is None else max(current_max, field["max_value"])
            for value in field["sample_values"]:
                if value not in spec["sample_values"] and len(spec["sample_values"]) < 6:
                    spec["sample_values"].append(value)

    finalized: List[Dict[str, Any]] = []
    for spec in aggregated.values():
        role = spec["semantic_role"]
        finalized.append(
            {
                "field_name": spec["field_name"],
                "semantic_role": role,
                "unit": infer_unit(spec["field_name"], role),
                "data_types_seen": sorted(spec["data_types_seen"]),
                "source_coverage": sorted(spec["source_coverage"]),
                "domain_coverage": sorted(spec["domain_coverage"]),
                "nullable_ratio_max": round(float(spec["nullable_ratio_max"]), 4),
                "min_value_observed": _json_safe(spec["min_value_observed"]),
                "max_value_observed": _json_safe(spec["max_value_observed"]),
                "sample_values": [_json_safe(value) for value in spec["sample_values"]],
                "validation_rules": build_validation_rules(spec["field_name"], role),
                "normalization_strategy": {
                    "primary": "zscore_by_source" if role not in {"entity_id", "dimension", "temporal"} else "identity",
                    "secondary": "winsorize_p99" if role in {"financial_metric", "marketing_spend", "traffic_metric", "sensor_metric"} else "none",
                },
                "feature_hints": ROLE_FEATURE_HINTS.get(role, ["group_level_aggregate"]),
                "recommended_widgets": ROLE_WIDGET_HINTS.get(role, ["executive_mixed_signal_wall"]),
                "query_aliases": build_query_aliases(spec["field_name"]),
                "join_hints": ["timestamp"] + (["domain_dimension_key"] if role not in {"temporal", "entity_id"} else []),
            }
        )

    return sorted(finalized, key=lambda item: (item["semantic_role"], item["field_name"]))


def build_source_registry(source_frames: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    registry: List[Dict[str, Any]] = []

    for source_name, payload in source_frames.items():
        df = payload["df"]
        schema = []
        for column in df.columns:
            series = df[column]
            non_null = series.dropna()
            sample_values = [_json_safe(value) for value in non_null.head(4).tolist()]
            numeric_series = pd.to_numeric(series, errors="coerce")
            min_value = None
            max_value = None
            if numeric_series.notna().any():
                min_value = float(numeric_series.min())
                max_value = float(numeric_series.max())

            schema.append(
                {
                    "name": column,
                    "dtype": str(series.dtype),
                    "nullable_ratio": float(series.isna().mean()),
                    "min_value": min_value,
                    "max_value": max_value,
                    "sample_values": sample_values,
                }
            )

        registry.append(
            {
                "source_name": source_name,
                "domain": payload["domain"],
                "grain": payload["grain"],
                "description": payload["description"],
                "row_count": int(len(df)),
                "join_keys": payload["join_keys"],
                "schema": schema,
            }
        )

    return sorted(registry, key=lambda item: item["source_name"])


def build_widget_catalog() -> List[Dict[str, Any]]:
    catalog: List[Dict[str, Any]] = []
    for widget in WIDGET_BLUEPRINTS:
        catalog.append(
            {
                **widget,
                "query_pattern": FAMILY_QUERY_PATTERNS[widget["family"]],
                "script_expectations": [
                    "emit_clean_fact_table",
                    "annotate_quality_checks",
                    "return_widget_ready_payload",
                ],
                "clustering_axes": ["business_impact", "actionability", "data_readiness"],
                "ranking_features": {
                    "domain_overlap_weight": 0.45,
                    "field_role_match_weight": 0.35,
                    "freshness_weight": 0.12,
                    "explainability_weight": 0.08,
                },
            }
        )
    return catalog


def recommend_widgets(domains: Iterable[str], widget_catalog: List[Dict[str, Any]], limit: int = 6) -> List[str]:
    domain_set = set(domains)
    for domain in list(domain_set):
        domain_set.update(DOMAIN_COMPATIBILITY_MAP.get(domain, {domain}))
    scored = []
    for widget in widget_catalog:
        overlap = len(domain_set.intersection(widget["domains"]))
        score = (overlap * 5) + len(widget["required_roles"]) + (1 if "rl_control" in widget["domains"] and "rl_control" in domain_set else 0)
        scored.append((score, widget["id"]))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return [widget_id for _, widget_id in scored[:limit]]


def project_fields_for_domains(field_specs: List[Dict[str, Any]], domains: Iterable[str], limit: int = 10) -> List[str]:
    domain_set = set(domains)
    candidates = []
    for spec in field_specs:
        overlap = len(domain_set.intersection(spec["domain_coverage"]))
        if overlap == 0 or spec["semantic_role"] in {"temporal", "entity_id", "dimension"}:
            continue
        score = (overlap * 4) + len(spec["source_coverage"])
        candidates.append((score, spec["field_name"]))
    candidates.sort(key=lambda item: (-item[0], item[1]))
    return [field_name for _, field_name in candidates[:limit]]


def build_domain_detection_scenarios(
    field_specs: List[Dict[str, Any]],
    widget_catalog: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    scenarios: List[Dict[str, Any]] = []
    for blueprint in PROJECT_BLUEPRINTS:
        for focus in FOCUS_MODES:
            domains = blueprint["domains"]
            scenarios.append(
                {
                    "scenario_id": f"{blueprint['project_slug']}__{focus['slug']}",
                    "project_slug": blueprint["project_slug"],
                    "focus_mode": focus["slug"],
                    "instruction": f"{focus['description']} Use the detected domains to choose the strongest professional widgets and feature engineering path.",
                    "detected_domains": domains,
                    "source_mix": blueprint["sources"],
                    "field_focus": project_fields_for_domains(field_specs, domains, limit=12),
                    "recommended_widgets": recommend_widgets(domains, widget_catalog, limit=7),
                    "expected_agent_actions": [
                        "detect dominant domains",
                        "prioritize joinable high-signal fields",
                        "select widget families that cover overview plus drilldown",
                        "produce SQL and Python artifacts ready for orchestration",
                    ],
                    "quality_gates": [
                        "no orphan dimensions in final fact tables",
                        "every metric must carry freshness and null checks",
                        "mixed-source joins must expose confidence score",
                    ],
                    "output_contract": {
                        "sql_grain": focus["sql_grain"],
                        "dashboard_count_target": 6,
                        "insight_bundle": "professional_real_world",
                    },
                }
            )
    return scenarios


def build_query_generation_scenarios(
    field_specs: List[Dict[str, Any]],
    widget_catalog: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    scenarios: List[Dict[str, Any]] = []
    for blueprint in PROJECT_BLUEPRINTS:
        fields = project_fields_for_domains(field_specs, blueprint["domains"], limit=14)
        widgets = recommend_widgets(blueprint["domains"], widget_catalog, limit=8)
        for focus in FOCUS_MODES:
            scenarios.append(
                {
                    "scenario_id": f"query__{blueprint['project_slug']}__{focus['slug']}",
                    "instruction": (
                        f"Generate professional SQL and Python tasks for project '{blueprint['project_slug']}'. "
                        f"Detected domains: {', '.join(blueprint['domains'])}. "
                        f"Focus: {focus['description']}"
                    ),
                    "sources": blueprint["sources"],
                    "core_fields": fields,
                    "target_widgets": widgets,
                    "expected_sql_modules": [
                        "staging_normalization",
                        "daily_or_weekly_fact_table",
                        "feature_store_projection",
                        "widget_specific_serving_queries",
                    ],
                    "expected_python_modules": [
                        "domain_sensitive_feature_engineering",
                        "outlier_and_drift_detection",
                        "clustering_or_forecasting_if_needed",
                        "policy_feedback_packaging",
                    ],
                    "join_strategy": {
                        "primary_key": "timestamp",
                        "secondary_keys": ["tenant_id", "workspace_id", "campaign_cluster", "service_name", "branch_id", "business_unit", "tower_cluster", "facility_id"],
                        "mixed_source_policy": "prefer confidence-scored left joins with documented coverage gaps",
                    },
                    "acceptance_criteria": [
                        "queries are professional and production-shaped",
                        "feature definitions use explicit windows and units",
                        "outputs can drive both dashboards and agent goals",
                    ],
                }
            )
    return scenarios


def build_rl_cluster_profiles() -> List[Dict[str, Any]]:
    profiles: List[Dict[str, Any]] = []
    base_vectors = [
        {"growth": 0.92, "efficiency": 0.71, "reliability": 0.42, "security": 0.18, "forecasting": 0.77, "exploration": 0.69},
        {"growth": 0.54, "efficiency": 0.63, "reliability": 0.48, "security": 0.22, "forecasting": 0.58, "exploration": 0.74},
        {"growth": 0.41, "efficiency": 0.79, "reliability": 0.91, "security": 0.38, "forecasting": 0.62, "exploration": 0.44},
        {"growth": 0.28, "efficiency": 0.51, "reliability": 0.66, "security": 0.95, "forecasting": 0.37, "exploration": 0.33},
        {"growth": 0.88, "efficiency": 0.84, "reliability": 0.32, "security": 0.18, "forecasting": 0.69, "exploration": 0.58},
        {"growth": 0.72, "efficiency": 0.58, "reliability": 0.35, "security": 0.14, "forecasting": 0.46, "exploration": 0.91},
        {"growth": 0.61, "efficiency": 0.81, "reliability": 0.76, "security": 0.33, "forecasting": 0.66, "exploration": 0.87},
        {"growth": 0.49, "efficiency": 0.68, "reliability": 0.72, "security": 0.24, "forecasting": 0.56, "exploration": 0.64},
        {"growth": 0.66, "efficiency": 0.74, "reliability": 0.58, "security": 0.82, "forecasting": 0.52, "exploration": 0.43},
        {"growth": 0.63, "efficiency": 0.88, "reliability": 0.47, "security": 0.21, "forecasting": 0.72, "exploration": 0.49},
        {"growth": 0.57, "efficiency": 0.69, "reliability": 0.84, "security": 0.29, "forecasting": 0.55, "exploration": 0.61},
        {"growth": 0.44, "efficiency": 0.62, "reliability": 0.73, "security": 0.18, "forecasting": 0.68, "exploration": 0.58},
    ]

    for blueprint, vector in zip(RL_CLUSTER_BLUEPRINTS, base_vectors):
        profiles.append(
            {
                "cluster_id": blueprint["cluster_id"],
                "dominant_domains": blueprint["dominant_domains"],
                "dominant_objectives": blueprint["dominant_objectives"],
                "tracked_fields": blueprint["tracked_fields"],
                "preferred_widgets": blueprint["preferred_widgets"],
                "preference_vector": vector,
                "adaptation_policy": {
                    "minimum_users_for_shift": 9,
                    "reward_delta_threshold": 0.08,
                    "field_adjustment_mode": "per_field_reweight_and_widget_rerank",
                },
            }
        )
    return profiles


def build_rl_feedback_events(cluster_profiles: List[Dict[str, Any]], seed: int = DEFAULT_SEED) -> List[Dict[str, Any]]:
    rng = random.Random(seed)
    events: List[Dict[str, Any]] = []
    deviation_directions = [
        "toward_efficiency",
        "toward_deeper_diagnostics",
        "toward_forecasting",
        "toward_security",
        "toward_mixed_source_views",
        "toward_simpler_exec_boards",
    ]

    for cluster in cluster_profiles:
        for idx in range(24):
            tracked_field = rng.choice(cluster["tracked_fields"])
            reward = round(rng.uniform(0.42, 0.96), 4)
            deviation = rng.choice(deviation_directions)
            field_weight_shift = round(rng.uniform(0.04, 0.22), 4)
            events.append(
                {
                    "event_id": f"{cluster['cluster_id']}__{idx:03d}",
                    "cluster_id": cluster["cluster_id"],
                    "user_id": f"user_{cluster['cluster_id'][:6]}_{idx:03d}",
                    "detected_domains": cluster["dominant_domains"],
                    "selected_widget": rng.choice(cluster["preferred_widgets"]),
                    "tracked_field": tracked_field,
                    "reward": reward,
                    "deviation_direction": deviation,
                    "policy_adjustment": {
                        "field_weight_shift": field_weight_shift,
                        "widget_rerank_bonus": round(field_weight_shift * 0.6, 4),
                        "narrative_shift": "more_operational" if "diagnostics" in deviation else "more_executive",
                    },
                    "feedback_summary": f"Cluster moved {deviation} and increased attention on '{tracked_field}'.",
                }
            )
    return events


def build_collective_adaptation_signals(cluster_profiles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    signals: List[Dict[str, Any]] = []
    for cluster in cluster_profiles:
        adjustments = []
        for idx, field_name in enumerate(cluster["tracked_fields"]):
            adjustments.append(
                {
                    "field_name": field_name,
                    "direction": "increase_priority" if idx % 2 == 0 else "increase_diagnostic_depth",
                    "weight_shift": round(0.08 + (idx * 0.03), 3),
                    "trigger": "collective_user_deviation",
                }
            )

        signals.append(
            {
                "cluster_id": cluster["cluster_id"],
                "dominant_domains": cluster["dominant_domains"],
                "minimum_users_for_shift": cluster["adaptation_policy"]["minimum_users_for_shift"],
                "reward_delta_threshold": cluster["adaptation_policy"]["reward_delta_threshold"],
                "field_adjustments": adjustments,
                "recommended_widgets": cluster["preferred_widgets"][:3],
            }
        )
    return signals


def build_source_frames(rows_per_source: int = 240, seed: int = DEFAULT_SEED) -> Dict[str, Dict[str, Any]]:
    source_frames: Dict[str, Dict[str, Any]] = {}
    for idx, blueprint in enumerate(SOURCE_BLUEPRINTS):
        generator = blueprint["generator"]
        kwargs = dict(blueprint.get("generator_kwargs", {}))
        kwargs.update(
            {
                "rows": rows_per_source,
                "inject_anomalies": blueprint["inject_anomalies"],
                "seed": seed + (idx * 19),
            }
        )
        df = generator(**kwargs)
        source_frames[blueprint["source_name"]] = {
            "domain": blueprint["domain"],
            "grain": blueprint["grain"],
            "description": blueprint["description"],
            "join_keys": blueprint["join_keys"],
            "df": df,
        }
    return source_frames


def build_training_bundle(rows_per_source: int = 240, seed: int = DEFAULT_SEED) -> Dict[str, Any]:
    source_frames = build_source_frames(rows_per_source=rows_per_source, seed=seed)
    source_registry = build_source_registry(source_frames)
    field_specs = build_field_specs(source_registry)
    widget_catalog = build_widget_catalog()
    domain_detection = build_domain_detection_scenarios(field_specs, widget_catalog)
    query_generation = build_query_generation_scenarios(field_specs, widget_catalog)
    rl_cluster_profiles = build_rl_cluster_profiles()
    rl_feedback_events = build_rl_feedback_events(rl_cluster_profiles, seed=seed)
    collective_adaptation = build_collective_adaptation_signals(rl_cluster_profiles)

    return {
        "version": ARTIFACT_VERSION,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "rows_per_source": rows_per_source,
        "seed": seed,
        "source_frames": source_frames,
        "source_registry": source_registry,
        "field_specs": field_specs,
        "widget_catalog": widget_catalog,
        "domain_detection_scenarios": domain_detection,
        "query_generation_scenarios": query_generation,
        "rl_cluster_profiles": rl_cluster_profiles,
        "rl_feedback_events": rl_feedback_events,
        "collective_adaptation_signals": collective_adaptation,
    }


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def _write_jsonl(path: Path, rows: Iterable[Dict[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row) + "\n")
            count += 1
    return count


def materialize_training_bundle(output_dir: str = "ml-lab/datasets/training_bundle", rows_per_source: int = 240, seed: int = DEFAULT_SEED) -> Dict[str, Any]:
    output_path = Path(output_dir)
    csv_dir = output_path / "csv"
    parquet_dir = output_path / "parquet"
    metadata_dir = output_path / "metadata"
    bundle = build_training_bundle(rows_per_source=rows_per_source, seed=seed)

    source_exports = []
    for source_name, payload in bundle["source_frames"].items():
        df = payload["df"]
        csv_path = csv_dir / f"{source_name}.csv"
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(csv_path, index=False)

        parquet_status = "skipped"
        parquet_path = parquet_dir / f"{source_name}.parquet"
        try:
            parquet_path.parent.mkdir(parents=True, exist_ok=True)
            df.to_parquet(parquet_path, index=False)
            parquet_status = "written"
        except Exception as exc:
            parquet_status = f"skipped:{type(exc).__name__}"

        source_exports.append(
            {
                "source_name": source_name,
                "csv_path": str(csv_path),
                "parquet_path": str(parquet_path),
                "parquet_status": parquet_status,
                "row_count": len(df),
            }
        )

    _write_json(metadata_dir / "source_registry.json", bundle["source_registry"])
    _write_json(metadata_dir / "field_specs.json", bundle["field_specs"])
    _write_json(metadata_dir / "widget_training_catalog.json", bundle["widget_catalog"])
    _write_json(metadata_dir / "rl_cluster_profiles.json", bundle["rl_cluster_profiles"])
    _write_json(metadata_dir / "collective_adaptation_signals.json", bundle["collective_adaptation_signals"])
    domain_detection_count = _write_jsonl(metadata_dir / "domain_detection_scenarios.jsonl", bundle["domain_detection_scenarios"])
    query_generation_count = _write_jsonl(metadata_dir / "query_generation_scenarios.jsonl", bundle["query_generation_scenarios"])
    rl_feedback_count = _write_jsonl(metadata_dir / "rl_feedback_events.jsonl", bundle["rl_feedback_events"])

    manifest = {
        "version": bundle["version"],
        "generated_at": bundle["generated_at"],
        "seed": seed,
        "rows_per_source": rows_per_source,
        "source_exports": source_exports,
        "metadata_exports": {
            "source_registry": str(metadata_dir / "source_registry.json"),
            "field_specs": str(metadata_dir / "field_specs.json"),
            "widget_training_catalog": str(metadata_dir / "widget_training_catalog.json"),
            "rl_cluster_profiles": str(metadata_dir / "rl_cluster_profiles.json"),
            "collective_adaptation_signals": str(metadata_dir / "collective_adaptation_signals.json"),
            "domain_detection_scenarios": {
                "path": str(metadata_dir / "domain_detection_scenarios.jsonl"),
                "row_count": domain_detection_count,
            },
            "query_generation_scenarios": {
                "path": str(metadata_dir / "query_generation_scenarios.jsonl"),
                "row_count": query_generation_count,
            },
            "rl_feedback_events": {
                "path": str(metadata_dir / "rl_feedback_events.jsonl"),
                "row_count": rl_feedback_count,
            },
        },
        "summary": {
            "source_count": len(bundle["source_frames"]),
            "field_spec_count": len(bundle["field_specs"]),
            "widget_count": len(bundle["widget_catalog"]),
            "domain_detection_scenarios": domain_detection_count,
            "query_generation_scenarios": query_generation_count,
            "rl_cluster_count": len(bundle["rl_cluster_profiles"]),
            "rl_feedback_events": rl_feedback_count,
        },
    }

    _write_json(metadata_dir / "training_bundle_manifest.json", manifest)
    return manifest


__all__ = [
    "build_collective_adaptation_signals",
    "build_domain_detection_scenarios",
    "build_field_specs",
    "build_query_generation_scenarios",
    "build_rl_cluster_profiles",
    "build_rl_feedback_events",
    "build_source_frames",
    "build_source_registry",
    "build_training_bundle",
    "build_widget_catalog",
    "infer_semantic_role",
    "infer_unit",
    "materialize_training_bundle",
    "project_fields_for_domains",
    "recommend_widgets",
]

