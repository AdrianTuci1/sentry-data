import json
from pathlib import Path
from typing import Dict, List, Optional

import yaml

from .config import WIDGETS_DIR
from .widgets import load_widget_catalog, load_widget_index, prefetch_widget_manifests, required_manifest_aliases, resolve_widget_type


def lookup_catalog(query: Optional[str] = None, category: Optional[str] = None, limit: int = 8) -> str:
    """Scans catalog and index metadata, returning canonical widget ids for shortlist selection."""
    widgets = load_widget_catalog()
    if not widgets:
        catalog_path = Path(WIDGETS_DIR) / "catalog.yml"
        if not catalog_path.exists():
            return "Catalog not found."

        with open(catalog_path, "r", encoding="utf-8") as handle:
            catalog = yaml.safe_load(handle) or {}
        widgets = catalog.get("widgets", {}) or {}

    normalized_query = str(query or "").strip().lower()
    results = []
    for widget_id, widget_data in widgets.items():
        if category and str(widget_data.get("category") or "").strip() != category:
            continue

        haystack = " ".join(
            str(value)
            for value in (
                widget_id,
                widget_data.get("title"),
                widget_data.get("description"),
                " ".join(widget_data.get("aliases", []) or []),
                " ".join(widget_data.get("selection_hints", []) or []),
                " ".join(widget_data.get("search_keywords", []) or []),
            )
            if value
        ).lower()
        score = 0
        if normalized_query:
            for token in normalized_query.split():
                if token in haystack:
                    score += 1
        if normalized_query and score == 0:
            continue

        results.append(
            {
                "id": widget_id,
                "title": widget_data.get("title"),
                "description": widget_data.get("description"),
                "category": widget_data.get("category"),
                "aliases": widget_data.get("aliases", [])[:4],
                "manifest_path": widget_data.get("manifest_path"),
                "score": score,
            }
        )

    results.sort(key=lambda item: (-int(item.get("score", 0)), str(item.get("id") or "")))
    payload = {
        "query": query,
        "category": category,
        "matches": results[: max(1, min(limit, 20))] if results else [],
        "index_sections": sorted((load_widget_index() or {}).keys()),
    }
    return json.dumps(payload, ensure_ascii=False)


def inspect_manifest(widget_id: str) -> str:
    """Reads the exact manifest required by a widget runtime type."""
    resolution = resolve_widget_type(widget_id)
    resolved_widget_id = resolution["resolved"]
    catalog_path = Path(WIDGETS_DIR) / "catalog.yml"
    try:
        with open(catalog_path, "r", encoding="utf-8") as handle:
            catalog = yaml.safe_load(handle) or {}

        widget_data = catalog.get("widgets", {}).get(resolved_widget_id)
        if not widget_data:
            return f"Widget {resolved_widget_id} not found."

        manifest_rel_path = widget_data.get("manifest_path")
        if not manifest_rel_path:
            return f"Manifest path not found for {resolved_widget_id}."

        manifest_path = Path(WIDGETS_DIR) / manifest_rel_path
        if not manifest_path.exists():
            return f"Manifest file missing: {manifest_rel_path}"

        return manifest_path.read_text(encoding="utf-8")
    except Exception as error:
        return f"Failed to fetch manifest: {str(error)}"


def inspect_manifests(widget_ids: List[str]) -> str:
    """Reads manifest metadata for all selected widgets in one batch."""
    manifest_status = prefetch_widget_manifests(widget_ids or [])
    return json.dumps(manifest_status, ensure_ascii=False)


def list_widget_categories() -> str:
    """Returns a structured overview of all widget categories and their widget counts."""
    catalog = load_widget_catalog()
    if not catalog:
        return "Catalog not found."

    by_category: Dict[str, List[str]] = {}
    for widget_id, widget_data in catalog.items():
        category = str(widget_data.get("category") or "uncategorized").strip()
        by_category.setdefault(category, []).append(widget_id)

    lines = []
    for category in sorted(by_category.keys()):
        widget_ids = by_category[category]
        widgets_str = ", ".join(sorted(widget_ids))
        lines.append(f"**{category} ({len(widget_ids)}):** {widgets_str}")

    lines.append(f"\nTotal: {len(catalog)} widgets in {len(by_category)} categories.")
    return "\n".join(lines)


def inspect_category(category: str) -> str:
    """Returns detailed information for all widgets in a given category."""
    catalog = load_widget_catalog()
    if not catalog:
        return "Catalog not found."

    category = str(category or "").strip().lower()
    matches = []
    for widget_id, widget_data in catalog.items():
        if str(widget_data.get("category") or "").strip().lower() != category:
            continue
        required_aliases = required_manifest_aliases(widget_id)
        matches.append(
            {
                "id": widget_id,
                "title": widget_data.get("title"),
                "description": widget_data.get("description"),
                "selection_hints": widget_data.get("selection_hints", []),
                "sql_shape": widget_data.get("sql_shape"),
                "required_aliases": required_aliases,
                "manifest_path": widget_data.get("manifest_path"),
            }
        )

    if not matches:
        available = sorted(
            set(
                str(w.get("category") or "uncategorized").strip().lower()
                for w in catalog.values()
            )
        )
        return f"Category '{category}' not found. Available categories: {', '.join(available)}"

    return json.dumps({"category": category, "widgets": matches}, ensure_ascii=False)
