import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import yaml

from .config import REPO_ROOT, WIDGET_CATALOG_PATH, WIDGETS_DIR, logger


GENERIC_WIDGET_FALLBACKS = {
    "kpi": "metric-trend",
    "metric": "metric-trend",
    "score": "signal-scale",
    "card": "weather",
    "line-chart": "live-traffic",
    "bar-chart": "campaign-list",
    "column-chart": "campaign-list",
    "chart": "live-traffic",
    "pie": "semi-circle-donut",
    "pie-chart": "semi-circle-donut",
    "donut-chart": "semi-circle-donut",
    "table": "technical-health",
    "grid": "technical-health",
    "list": "campaign-list",
    "histogram": "productivity",
    "distribution": "productivity",
}


def _load_yaml(candidate_paths: List[Path]) -> Dict[str, Any]:
    for candidate in candidate_paths:
        if candidate.exists():
            with open(candidate, "r", encoding="utf-8") as handle:
                return yaml.safe_load(handle) or {}
    return {}


def normalize_widget_lookup_key(value: str) -> str:
    return (
        re.sub(r"-+", "-", re.sub(r"[^a-zA-Z0-9-]+", "-", re.sub(r"[_\s/]+", "-", re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", str(value or "").strip()))))
        .strip("-")
        .lower()
    )


@lru_cache(maxsize=1)
def load_widget_catalog() -> Dict[str, Dict[str, Any]]:
    candidate_paths = [
        WIDGET_CATALOG_PATH,
        REPO_ROOT / "r2-system" / "widgets" / "catalog.yml",
    ]
    try:
        parsed = _load_yaml(candidate_paths)
        return parsed.get("widgets", {}) or {}
    except Exception as error:
        logger.warning("Failed to load widget catalog: %s", error)
        return {}
    logger.warning("Widget catalog not found in any expected path.")
    return {}


@lru_cache(maxsize=1)
def load_widget_index() -> Dict[str, Any]:
    candidate_paths = [
        Path(WIDGETS_DIR) / "index.yml",
        REPO_ROOT / "r2-system" / "widgets" / "index.yml",
    ]
    try:
        return _load_yaml(candidate_paths)
    except Exception as error:
        logger.warning("Failed to load widget index: %s", error)
        return {}


def widget_defaults(widget_type: str) -> Dict[str, Any]:
    return load_widget_catalog().get(widget_type, {})


def _lookup_from_index(widget_type: str) -> Optional[Tuple[str, str]]:
    normalized = normalize_widget_lookup_key(widget_type)
    index = load_widget_index()
    lookups = index.get("lookups", {}) or {}
    for section_name, resolution_source in (
        ("aliases", "alias"),
        ("runtime_types", "runtime_type"),
        ("components", "component"),
        ("component_ids", "component_id"),
        ("manifest_paths", "manifest_path"),
    ):
        section = lookups.get(section_name, {}) or index.get(section_name, {}) or {}
        resolved = section.get(normalized) or section.get(widget_type) or section.get(str(widget_type or "").strip())
        if isinstance(resolved, str) and resolved:
            catalog = load_widget_catalog()
            if section_name == "manifest_paths":
                for widget_id, widget_data in catalog.items():
                    if widget_data.get("manifest_path") == resolved:
                        return widget_id, resolution_source
            elif resolved in catalog:
                return resolved, resolution_source
    return None


def resolve_widget_manifest_path(widget_type: str) -> Optional[Path]:
    widget = widget_defaults(widget_type)
    manifest_rel_path = widget.get("manifest_path")
    if not manifest_rel_path:
        return None

    candidate_paths = [
        Path(WIDGETS_DIR) / manifest_rel_path,
        REPO_ROOT / "r2-system" / "widgets" / manifest_rel_path,
    ]
    for candidate in candidate_paths:
        if candidate.exists():
            return candidate
    return None


def _required_manifest_aliases(widget_type: str) -> List[str]:
    manifest = load_widget_manifest(widget_type)
    return [
        str(alias.get("alias")).strip()
        for alias in manifest.get("sql_aliases", [])
        if isinstance(alias, dict) and alias.get("required") and str(alias.get("alias", "")).strip()
    ]


def _sql_mentions_alias(sql: str, alias: str) -> bool:
    normalized_sql = str(sql or "").lower()
    normalized_alias = str(alias or "").strip().lower()
    if not normalized_alias:
        return True

    patterns = [
        rf"\bas\s+{re.escape(normalized_alias)}\b",
        rf"['\"]{re.escape(normalized_alias)}['\"]\s*:=",
        rf"\b{re.escape(normalized_alias)}\b",
    ]
    return any(re.search(pattern, normalized_sql) for pattern in patterns)


def _infer_category_hints(widget_type: str) -> Set[str]:
    normalized = normalize_widget_lookup_key(widget_type)
    hints: Set[str] = set()

    if any(token in normalized for token in {"kpi", "metric", "score", "card", "gauge"}):
        hints.add("micro")
    if any(token in normalized for token in {"line", "area", "pie", "donut", "chart", "scatter"}):
        hints.add("charts")
    if any(token in normalized for token in {"table", "grid", "list"}):
        hints.update({"lists", "misc"})
    if any(token in normalized for token in {"hist", "distribution"}):
        hints.update({"micro", "charts"})

    return hints


def _resolve_generic_widget_fallback(widget_type: str) -> Optional[str]:
    normalized = normalize_widget_lookup_key(widget_type)
    catalog = load_widget_catalog()

    direct = GENERIC_WIDGET_FALLBACKS.get(normalized)
    if direct in catalog:
        return direct

    for key, resolved in GENERIC_WIDGET_FALLBACKS.items():
        if key in normalized and resolved in catalog:
            return resolved

    return None


def _resolve_widget_from_sql(widget_type: str, sql: str) -> Optional[str]:
    if not sql:
        return None

    catalog = load_widget_catalog()
    category_hints = _infer_category_hints(widget_type)
    matches: List[Tuple[bool, int, int, str]] = []

    for widget_id, widget in catalog.items():
        category = str(widget.get("category") or "").strip()
        if category_hints and category and category not in category_hints:
            continue

        required_aliases = _required_manifest_aliases(widget_id)
        if not required_aliases:
            continue

        matched_aliases = [alias for alias in required_aliases if _sql_mentions_alias(sql, alias)]
        if not matched_aliases:
            continue

        is_full_match = len(matched_aliases) == len(required_aliases)
        matches.append((is_full_match, len(matched_aliases), -len(required_aliases), widget_id))

    if not matches:
        return None

    matches.sort(reverse=True)
    best_widget_id = matches[0][3]
    if matches[0][0]:
        return best_widget_id

    fallback = _resolve_generic_widget_fallback(widget_type)
    if fallback:
        return fallback

    return best_widget_id


def resolve_widget_type(widget_type: str, sql: str = "", title: str = "") -> Dict[str, Any]:
    requested = str(widget_type or "").strip()
    catalog = load_widget_catalog()

    if requested in catalog:
        return {
            "requested": requested,
            "resolved": requested,
            "resolutionSource": "catalog",
            "manifestAvailable": bool(resolve_widget_manifest_path(requested)),
            "titleHint": title,
        }

    from_index = _lookup_from_index(requested)
    if from_index:
        resolved, resolution_source = from_index
        return {
            "requested": requested,
            "resolved": resolved,
            "resolutionSource": resolution_source,
            "manifestAvailable": bool(resolve_widget_manifest_path(resolved)),
            "titleHint": title,
        }

    from_sql = _resolve_widget_from_sql(requested, sql)
    if from_sql:
        return {
            "requested": requested,
            "resolved": from_sql,
            "resolutionSource": "sql_alias_match",
            "manifestAvailable": bool(resolve_widget_manifest_path(from_sql)),
            "titleHint": title,
        }

    fallback = _resolve_generic_widget_fallback(requested)
    if fallback:
        return {
            "requested": requested,
            "resolved": fallback,
            "resolutionSource": "generic_fallback",
            "manifestAvailable": bool(resolve_widget_manifest_path(fallback)),
            "titleHint": title,
        }

    unresolved = requested or "technical-health"
    return {
        "requested": requested,
        "resolved": unresolved,
        "resolutionSource": "unresolved",
        "manifestAvailable": bool(resolve_widget_manifest_path(unresolved)),
        "titleHint": title,
    }


def prefetch_widget_manifests(widget_types: List[str], candidates: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Dict[str, Any]]:
    manifest_status: Dict[str, Dict[str, Any]] = {}

    for index, raw_widget_type in enumerate(widget_types):
        candidate = candidates[index] if candidates and index < len(candidates) else {}
        resolution = resolve_widget_type(
            raw_widget_type,
            sql=str(candidate.get("sql") or ""),
            title=str(candidate.get("title") or ""),
        )
        manifest = load_widget_manifest(resolution["resolved"])
        manifest_status[resolution["requested"] or resolution["resolved"]] = {
            **resolution,
            "manifestLoaded": bool(manifest),
            "requiredAliases": _required_manifest_aliases(resolution["resolved"]),
        }

    return manifest_status


@lru_cache(maxsize=64)
def load_widget_manifest(widget_type: str) -> Dict[str, Any]:
    manifest_path = resolve_widget_manifest_path(widget_type)
    if not manifest_path:
        logger.warning("Widget manifest path not found for widget type %s", widget_type)
        return {}

    try:
        with open(manifest_path, "r", encoding="utf-8") as handle:
            return yaml.safe_load(handle) or {}
    except Exception as error:
        logger.warning("Failed to load widget manifest for %s from %s: %s", widget_type, manifest_path, error)
        return {}


def infer_expected_shape(widget_type: str, manifest: Dict[str, Any], fallback_shape: str) -> str:
    query_guidance = manifest.get("query_guidance", {}) if isinstance(manifest, dict) else {}
    return_shape = query_guidance.get("return_shape")
    sql_aliases = manifest.get("sql_aliases", []) if isinstance(manifest, dict) else []

    if widget_type in {"sparkline-stat", "live-traffic", "range-area-chart", "stream-graph"}:
        return "timeseries"
    if widget_type in {"technical-health", "audience-copilot", "campaign-list", "trend-spotter", "predictive"}:
        return "table"
    if return_shape == "list":
        return "table"
    if any(isinstance(alias, dict) and "[]" in str(alias.get("sql_type", "")) for alias in sql_aliases):
        return "table" if widget_type not in {"sparkline-stat", "live-traffic"} else "timeseries"
    return fallback_shape


def build_widget_contract(widget_type: str, expected_shape: str, fallback_fields: List[str]) -> Dict[str, Any]:
    resolution = resolve_widget_type(widget_type)
    resolved_widget_type = resolution["resolved"]
    widget = widget_defaults(resolved_widget_type)
    manifest = load_widget_manifest(resolved_widget_type)
    query_guidance = manifest.get("query_guidance", {}) if isinstance(manifest, dict) else {}
    manifest_fields = [
        alias.get("alias")
        for alias in manifest.get("sql_aliases", [])
        if isinstance(alias, dict) and alias.get("required")
    ]
    required_fields = manifest_fields or fallback_fields

    contract = {
        "widgetType": resolved_widget_type,
        "expectedShape": infer_expected_shape(resolved_widget_type, manifest, expected_shape),
        "requiredFields": required_fields,
        "alignmentMode": "strict",
        "source": "catalog_manifest" if widget else "runtime_contract",
    }

    if resolution["requested"] and resolution["requested"] != resolved_widget_type:
        contract["requestedWidgetType"] = resolution["requested"]
        contract["resolutionSource"] = resolution["resolutionSource"]

    manifest_path = resolve_widget_manifest_path(resolved_widget_type)
    if manifest_path:
        contract["manifestPath"] = str(manifest_path)
    if query_guidance.get("data_root"):
        contract["dataRoot"] = query_guidance["data_root"]
    if query_guidance.get("sql_shape"):
        contract["sqlShape"] = query_guidance["sql_shape"]

    return contract


def build_widget_presentation(widget_type: str) -> Dict[str, Any]:
    resolved_widget_type = resolve_widget_type(widget_type)["resolved"]
    widget = widget_defaults(resolved_widget_type)
    manifest = load_widget_manifest(resolved_widget_type)

    grid_span = manifest.get("grid_span") or widget.get("default_grid_span") or "default"
    color_theme = manifest.get("color_theme") or widget.get("default_color_theme") or "theme-productivity"

    return {
        "gridSpan": grid_span,
        "colorTheme": color_theme,
    }


def _matches_manifest_sql_type(value: Any, sql_type: str) -> bool:
    normalized_type = str(sql_type or "").strip().lower()
    if not normalized_type:
        return True

    candidate_types = [token.strip() for token in normalized_type.split("|") if token.strip()]
    if not candidate_types:
        return True

    for candidate_type in candidate_types:
        if candidate_type.endswith("[]"):
            base_type = candidate_type[:-2]
            if not isinstance(value, list):
                continue
            if not value:
                return True
            if all(_matches_manifest_sql_type(item, base_type) for item in value):
                return True
            continue

        if candidate_type == "object" and isinstance(value, dict):
            return True
        if candidate_type == "string" and isinstance(value, str):
            return True
        if candidate_type == "number" and isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value)):
            return True
        if candidate_type == "boolean" and isinstance(value, bool):
            return True
        if candidate_type == "null" and value is None:
            return True

    return False


def validate_widget_runtime_payload(widget_type: str, rows: List[Dict[str, Any]]) -> List[str]:
    manifest = load_widget_manifest(widget_type)
    if not manifest:
        return ["runtime_manifest_missing"]

    if not rows:
        return ["runtime_empty_dataset"]

    query_guidance = manifest.get("query_guidance", {}) if isinstance(manifest, dict) else {}
    sql_shape = str(query_guidance.get("sql_shape") or "").strip().lower()
    if sql_shape == "single_row" and len(rows) != 1:
        return [f"runtime_expected_single_row:{len(rows)}"]

    first_row = rows[0]
    if not isinstance(first_row, dict):
        return ["runtime_row_not_object"]

    reasons: List[str] = []
    alias_definitions = manifest.get("sql_aliases", []) if isinstance(manifest, dict) else []
    for alias_definition in alias_definitions:
        if not isinstance(alias_definition, dict):
            continue

        alias = str(alias_definition.get("alias") or "").strip()
        if not alias:
            continue

        required = bool(alias_definition.get("required"))
        if alias not in first_row:
            if required:
                reasons.append(f"runtime_missing_alias:{alias}")
            continue

        if first_row[alias] is None:
            continue

        sql_type = str(alias_definition.get("sql_type") or "").strip()
        if sql_type and not _matches_manifest_sql_type(first_row[alias], sql_type):
            reasons.append(f"runtime_invalid_alias_type:{alias}:{sql_type}")

    return reasons


def choose_widget_type(signal: str) -> str:
    choices = {
        "volume": "technical-health",
        "freshness": "weather",
        "trend": "sparkline-stat",
        "snapshot": "metric-trend",
        "reverse_etl": "trend-spotter",
        "ml": "predictive",
    }
    return choices.get(signal, "technical-health")
