import re
from typing import Any, Dict, List, Optional, Set

from .helpers import build_projection_relation_source, build_projection_sql_source, hash_dict, quote_identifier
from .models import SourceProfile
from .projection_builder import select_metric_gold_view, select_primary_gold_view
from .widgets import build_widget_contract, build_widget_presentation, choose_widget_type, resolve_widget_type


def _normalize_columns(columns: List[str]) -> List[str]:
    return [str(column).strip() for column in columns if str(column).strip()]


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


def _extract_output_aliases(sql: str) -> List[str]:
    aliases: List[str] = []
    for match in re.finditer(r"\bas\s+(?:\"([^\"]+)\"|`([^`]+)`|([A-Za-z_][A-Za-z0-9_]*))", str(sql or ""), re.IGNORECASE):
        alias = next((group for group in match.groups() if group), "")
        if alias and alias not in aliases:
            aliases.append(alias)
    return aliases


def _strip_sql_terminator(sql: str) -> str:
    return str(sql or "").strip().rstrip(";").strip()


def _split_top_level_csv(value: str) -> List[str]:
    parts: List[str] = []
    current: List[str] = []
    depth = 0

    for character in str(value or ""):
        if character == "(":
            depth += 1
        elif character == ")" and depth > 0:
            depth -= 1

        if character == "," and depth == 0:
            segment = "".join(current).strip()
            if segment:
                parts.append(segment)
            current = []
            continue

        current.append(character)

    tail = "".join(current).strip()
    if tail:
        parts.append(tail)

    return parts


def _rewrite_struct_alias_syntax(sql: str) -> str:
    pattern = re.compile(
        r"(?P<agg>list)\s*\(\s*struct\s*\((?P<body>.*?)\)\s*\)\s*as\s+(?P<alias>[A-Za-z_][A-Za-z0-9_]*)",
        re.IGNORECASE | re.DOTALL,
    )

    def replacer(match: re.Match[str]) -> str:
        body = match.group("body")
        output_alias = match.group("alias")
        items: List[str] = []
        for segment in _split_top_level_csv(body):
            alias_match = re.match(r"(?P<expr>.+?)\s+as\s+(?P<alias>[A-Za-z_][A-Za-z0-9_]*)$", segment, re.IGNORECASE)
            if not alias_match:
                return match.group(0)
            expr = alias_match.group("expr").strip()
            alias = alias_match.group("alias").strip()
            items.append(f"{alias} := {expr}")

        if not items:
            return match.group(0)

        return f"list(struct_pack({', '.join(items)})) AS {output_alias}"

    return pattern.sub(replacer, sql)


def _wrap_sql_for_alias_contract(sql: str, required_fields: List[str]) -> str:
    missing_fields = [field for field in required_fields if not _sql_mentions_alias(sql, field)]
    if not missing_fields:
        return sql

    aliases = _extract_output_aliases(sql)
    if not aliases:
        return sql

    inner_sql = _strip_sql_terminator(sql)
    source = f"({inner_sql}) AS pne_payload"
    first_alias = quote_identifier(aliases[0])
    last_alias = quote_identifier(aliases[-1])

    if missing_fields == ["value"]:
        return f"SELECT {last_alias} AS value FROM {source}"

    if missing_fields == ["metrics"]:
        return (
            "SELECT list(struct_pack("
            f"name := CAST({first_alias} AS VARCHAR), "
            f"value := CAST({last_alias} AS VARCHAR), "
            "status := 'good'"
            ")) AS metrics "
            f"FROM {source}"
        )

    if missing_fields == ["campaigns"]:
        return (
            "SELECT list(struct_pack("
            f"name := CAST({first_alias} AS VARCHAR), "
            f"value := CAST({last_alias} AS VARCHAR), "
            "trend := ''"
            ")) AS campaigns "
            f"FROM {source}"
        )

    if missing_fields == ["benchmarks"]:
        return (
            "SELECT list(struct_pack("
            f"label := CAST({first_alias} AS VARCHAR), "
            f"score := CAST({last_alias} AS DOUBLE), "
            "target := NULL, "
            "delta := ''"
            ")) AS benchmarks "
            f"FROM {source}"
        )

    if missing_fields == ["platforms"]:
        return (
            "SELECT list(struct_pack("
            f"name := CAST({first_alias} AS VARCHAR), "
            f"value := CAST({last_alias} AS DOUBLE), "
            "color := '#34D399'"
            ")) AS platforms "
            f"FROM {source}"
        )

    if missing_fields == ["chartLabels", "chartSeries"] and len(aliases) >= 2:
        return (
            f"SELECT list(CAST({first_alias} AS VARCHAR) ORDER BY {first_alias}) AS chartLabels, "
            f"list(CAST({last_alias} AS DOUBLE) ORDER BY {first_alias}) AS chartSeries "
            f"FROM {source}"
        )

    return sql


def _repair_sql_for_widget_runtime(sql: str, widget_type: str, required_fields: List[str]) -> str:
    repaired_sql = _rewrite_struct_alias_syntax(str(sql or ""))
    aliases = _extract_output_aliases(repaired_sql)
    inner_sql = _strip_sql_terminator(repaired_sql)

    if widget_type == "live-traffic" and {"chartLabels", "chartSeries"}.issubset(set(aliases)):
        if "list(" not in repaired_sql.lower():
            source = f"({inner_sql}) AS pne_payload"
            return (
                "SELECT "
                "list(CAST(chartLabels AS VARCHAR) ORDER BY chartLabels) AS chartLabels, "
                "list(CAST(chartSeries AS DOUBLE) ORDER BY chartLabels) AS chartSeries "
                f"FROM {source}"
            )

    if widget_type in {"campaign-list", "mpl-benchmark-bars"} and ("group by" in repaired_sql.lower() or " from " in repaired_sql.lower()):
        if widget_type == "campaign-list" and {"name", "value"}.issubset(set(aliases)):
            source = f"({inner_sql}) AS pne_payload"
            return (
                "SELECT list(struct_pack("
                "name := CAST(name AS VARCHAR), "
                "value := CAST(value AS VARCHAR), "
                "trend := COALESCE(CAST(trend AS VARCHAR), '')"
                ") ORDER BY value DESC) AS campaigns "
                f"FROM {source}"
            )
        if widget_type == "mpl-benchmark-bars" and {"label", "value"}.issubset(set(aliases)):
            source = f"({inner_sql}) AS pne_payload"
            return (
                "SELECT list(struct_pack("
                "label := CAST(label AS VARCHAR), "
                "score := CAST(value AS DOUBLE), "
                "target := NULL, "
                "delta := ''"
                ")) AS benchmarks "
                f"FROM {source}"
            )

    return _wrap_sql_for_alias_contract(repaired_sql, required_fields)


def _view_columns(view: Dict[str, Any]) -> Set[str]:
    return {
        str(column.get("name")).strip()
        for column in (view.get("columns") or [])
        if isinstance(column, dict) and str(column.get("name", "")).strip()
    }


def _infer_dependency_columns_from_sql(profile: SourceProfile, sql: str) -> List[str]:
    normalized_sql = str(sql or "")
    inferred_columns: List[str] = []

    for column in profile.source_schema:
        column_name = str(column.get("name") or "").strip()
        if not column_name:
            continue

        patterns = [
            rf"\b{re.escape(column_name)}\b",
            rf'"{re.escape(column_name)}"',
            rf"`{re.escape(column_name)}`",
        ]
        if any(re.search(pattern, normalized_sql, flags=re.IGNORECASE) for pattern in patterns):
            inferred_columns.append(column_name)

    return inferred_columns


def _fallback_dependency_columns(profile: SourceProfile) -> List[str]:
    columns = [
        str(column.get("name") or "").strip()
        for column in profile.source_schema
        if isinstance(column, dict) and str(column.get("name") or "").strip()
    ]
    if columns:
        return columns

    primary_view = select_primary_gold_view(profile)
    return sorted(_view_columns(primary_view))


def resolve_projection_for_columns(
    profile: SourceProfile,
    projection_specs_by_id: Dict[str, Dict[str, object]],
    columns: List[str],
    preferred_projection_id: Optional[str] = None,
) -> str:
    requested_columns = set(_normalize_columns(columns))
    if not requested_columns:
        if preferred_projection_id and preferred_projection_id in projection_specs_by_id:
            return preferred_projection_id
        primary_view = select_primary_gold_view(profile)
        return str(primary_view["id"])

    gold_views = profile.goldViews or [select_primary_gold_view(profile)]
    candidate_views = []
    for gold_view in gold_views:
        view_id = str(gold_view.get("id") or "")
        if view_id not in projection_specs_by_id:
            continue

        view_columns = _view_columns(gold_view)
        overlap_count = len(requested_columns.intersection(view_columns))
        if overlap_count == 0:
            continue

        candidate_views.append(
            {
                "id": view_id,
                "viewColumns": view_columns,
                "overlapCount": overlap_count,
                "isFullMatch": requested_columns.issubset(view_columns),
                "columnCount": len(view_columns),
            }
        )

    full_matches = [candidate for candidate in candidate_views if candidate["isFullMatch"]]
    if full_matches:
        if preferred_projection_id and any(candidate["id"] == preferred_projection_id for candidate in full_matches):
            return preferred_projection_id

        # Prefer the smallest projection that fully contains the needed columns.
        full_matches.sort(key=lambda candidate: (candidate["columnCount"], candidate["id"]))
        return str(full_matches[0]["id"])

    if preferred_projection_id and preferred_projection_id in projection_specs_by_id:
        return preferred_projection_id

    if candidate_views:
        candidate_views.sort(key=lambda candidate: (-candidate["overlapCount"], candidate["columnCount"], candidate["id"]))
        return str(candidate_views[0]["id"])

    primary_view = select_primary_gold_view(profile)
    return str(primary_view["id"])


def normalize_query_spec(
    profile: SourceProfile,
    projection_specs_by_id: Dict[str, Dict[str, object]],
    query_spec: Dict[str, Any],
) -> Dict[str, Any]:
    normalized = dict(query_spec)
    query_id = str(normalized.get("queryId") or "").strip()
    widget_resolution = resolve_widget_type(
        str(normalized.get("widgetType") or ""),
        sql=str(normalized.get("sql") or ""),
        title=str(normalized.get("title") or ""),
    )
    dependencies = dict(normalized.get("dependencies") or {})
    dependency_columns = _normalize_columns(list(dependencies.get("columns") or []))
    if not dependency_columns:
        dependency_columns = _infer_dependency_columns_from_sql(profile, str(normalized.get("sql") or ""))
    if not dependency_columns and normalized.get("sql"):
        dependency_columns = _fallback_dependency_columns(profile)
    preferred_projection_id = str(normalized.get("projectionId") or "").strip() or None
    resolved_projection_id = resolve_projection_for_columns(
        profile,
        projection_specs_by_id,
        dependency_columns,
        preferred_projection_id,
    )

    dependencies["columns"] = dependency_columns
    dependencies["sourceIds"] = [profile.sourceId]
    dependencies["upstreamProjectionIds"] = [resolved_projection_id]
    projection_spec = projection_specs_by_id.get(resolved_projection_id, {})
    projection_source = build_projection_relation_source(projection_spec, profile)
    raw_source = build_projection_sql_source(profile)

    normalized["widgetType"] = widget_resolution["resolved"]
    if widget_resolution["requested"] and widget_resolution["requested"] != widget_resolution["resolved"]:
        normalized["requestedWidgetType"] = widget_resolution["requested"]
        normalized["widgetResolution"] = widget_resolution

    existing_contract = normalized.get("widgetContract") if isinstance(normalized.get("widgetContract"), dict) else {}
    fallback_fields = _normalize_columns(list(existing_contract.get("requiredFields") or []))
    expected_shape = str(existing_contract.get("expectedShape") or "unknown")
    normalized["widgetContract"] = build_widget_contract(widget_resolution["resolved"], expected_shape, fallback_fields)
    normalized_sql = str(normalized.get("sql") or "")
    normalized_sql = normalized_sql.replace("virtual_view", projection_source)
    normalized_sql = normalized_sql.replace(raw_source, projection_source)
    normalized["sql"] = _repair_sql_for_widget_runtime(
        normalized_sql,
        widget_resolution["resolved"],
        _normalize_columns(list(normalized["widgetContract"].get("requiredFields") or [])),
    )
    presentation = build_widget_presentation(widget_resolution["resolved"])
    normalized["gridSpan"] = normalized.get("gridSpan") or presentation.get("gridSpan")
    normalized["colorTheme"] = normalized.get("colorTheme") or presentation.get("colorTheme")

    normalized["sourceId"] = profile.sourceId
    normalized["projectionId"] = resolved_projection_id
    normalized["dependencies"] = dependencies
    widget_id = str(normalized.get("widgetId") or "").strip()
    requested_widget_type = str(normalized.get("requestedWidgetType") or "").strip()
    if query_id and (
        not widget_id
        or widget_id == normalized["widgetType"]
        or (requested_widget_type and widget_id == requested_widget_type)
    ):
        normalized["widgetId"] = query_id
    normalized["queryHash"] = hash_dict(normalized)
    return normalized


def build_default_query_specs(
    profile: SourceProfile,
    projection_specs_by_id: Dict[str, Dict[str, object]],
    compiled_at: str,
) -> List[Dict[str, object]]:
    source_id = profile.sourceId
    primary_view = select_primary_gold_view(profile)
    metric_view = select_metric_gold_view(profile)
    primary_projection = projection_specs_by_id[str(primary_view["id"])]
    metric_projection = projection_specs_by_id[str(metric_view["id"])]
    primary_projection_id = str(primary_projection["projectionId"])
    metric_projection_id = str(metric_projection["projectionId"])
    input_fingerprint = str(primary_projection["inputFingerprint"])
    columns = [column.get("name") for column in profile.source_schema if column.get("name")]
    primary_sql_source = build_projection_relation_source(primary_projection, profile)
    metric_sql_source = build_projection_relation_source(metric_projection, profile)
    query_specs: List[Dict[str, object]] = []

    def append_query(spec: Dict[str, object]) -> None:
        spec["queryHash"] = hash_dict(spec)
        query_specs.append(spec)

    volume_widget = choose_widget_type("volume")
    volume_presentation = build_widget_presentation(volume_widget)

    append_query(
        {
            "queryId": f"{primary_projection_id}_row_count",
            "widgetId": f"{source_id}_row_count",
            "projectionId": primary_projection_id,
            "sourceId": source_id,
            "title": f"{profile.sourceName} Row Count",
            "widgetType": volume_widget,
            "sql": (
                "SELECT list(struct_pack("
                "name := 'Rows', "
                "value := CAST(row_count AS VARCHAR), "
                "status := 'good'"
                ")) AS metrics "
                f"FROM (SELECT COUNT(*) AS row_count FROM {primary_sql_source}) AS row_summary"
            ),
            "status": "active",
            "inputFingerprint": input_fingerprint,
            "dependencies": {
                "sourceIds": [source_id],
                "columns": columns,
                "upstreamProjectionIds": [primary_projection_id],
            },
            "executionPolicy": {"mode": "direct", "refreshStrategy": "always"},
            "widgetContract": build_widget_contract(volume_widget, "table", ["metrics"]),
            **volume_presentation,
            "compiledAt": compiled_at,
        }
    )

    timestamp_column = next(iter(profile.timestampCandidates), None)
    metric_column = next(iter(profile.metricCandidates), None)

    if timestamp_column:
        freshness_widget = choose_widget_type("freshness")
        freshness_presentation = build_widget_presentation(freshness_widget)
        append_query(
            {
                "queryId": f"{primary_projection_id}_freshness",
                "widgetId": f"{source_id}_freshness",
                "projectionId": primary_projection_id,
                "sourceId": source_id,
                "title": f"{profile.sourceName} Freshness",
                "widgetType": freshness_widget,
                "sql": (
                    f"SELECT DATE_DIFF('minute', CAST(MAX({quote_identifier(timestamp_column)}) AS TIMESTAMP), CAST(CURRENT_TIMESTAMP AS TIMESTAMP)) AS value, "
                    "'min lag' AS unit "
                    f"FROM {primary_sql_source}"
                ),
                "status": "active",
                "inputFingerprint": input_fingerprint,
                "dependencies": {
                    "sourceIds": [source_id],
                    "columns": [timestamp_column],
                    "upstreamProjectionIds": [primary_projection_id],
                },
                "executionPolicy": {"mode": "direct", "refreshStrategy": "always"},
                "widgetContract": build_widget_contract(freshness_widget, "scalar", ["value"]),
                **freshness_presentation,
                "compiledAt": compiled_at,
            }
        )

    if timestamp_column and metric_column:
        trend_widget = choose_widget_type("trend")
        trend_presentation = build_widget_presentation(trend_widget)
        trend_projection_id = resolve_projection_for_columns(
            profile,
            projection_specs_by_id,
            [timestamp_column, metric_column],
            metric_projection_id,
        )
        trend_projection = projection_specs_by_id[trend_projection_id]
        trend_sql_source = build_projection_relation_source(trend_projection, profile)
        append_query(
            {
                "queryId": f"{trend_projection_id}_{metric_column}_trend",
                "widgetId": f"{source_id}_{metric_column}_trend",
                "projectionId": trend_projection_id,
                "sourceId": source_id,
                "title": f"{profile.sourceName} {metric_column} Trend",
                "widgetType": trend_widget,
                "sql": (
                    "WITH series AS ("
                    f"SELECT DATE_TRUNC('day', {quote_identifier(timestamp_column)}) AS period, "
                    f"AVG({quote_identifier(metric_column)}) AS metric_value "
                    f"FROM {trend_sql_source} "
                    f"WHERE {quote_identifier(metric_column)} IS NOT NULL "
                    "GROUP BY 1 "
                    "ORDER BY 1 DESC "
                    "LIMIT 12"
                    ") "
                    "SELECT "
                    "CAST(MAX(metric_value) FILTER (WHERE period = (SELECT MAX(period) FROM series)) AS DOUBLE) AS value, "
                    "'units' AS unit, "
                    "list(metric_value ORDER BY period) AS dataPoints "
                    "FROM series"
                ),
                "status": "active",
                "inputFingerprint": input_fingerprint,
                "dependencies": {
                    "sourceIds": [source_id],
                    "columns": [timestamp_column, metric_column],
                    "upstreamProjectionIds": [trend_projection_id],
                },
                "executionPolicy": {"mode": "direct", "refreshStrategy": "always"},
                "widgetContract": build_widget_contract(trend_widget, "timeseries", ["value", "dataPoints"]),
                **trend_presentation,
                "compiledAt": compiled_at,
            }
        )
    elif metric_column:
        snapshot_widget = choose_widget_type("snapshot")
        snapshot_presentation = build_widget_presentation(snapshot_widget)
        append_query(
            {
                "queryId": f"{metric_projection_id}_{metric_column}_snapshot",
                "widgetId": f"{source_id}_{metric_column}_snapshot",
                "projectionId": metric_projection_id,
                "sourceId": source_id,
                "title": f"{profile.sourceName} {metric_column} Snapshot",
                "widgetType": snapshot_widget,
                "sql": (
                    f"SELECT AVG({quote_identifier(metric_column)}) AS value, "
                    "'units' AS unit, "
                    "'baseline' AS trendLabel "
                    f"FROM {metric_sql_source} WHERE {quote_identifier(metric_column)} IS NOT NULL"
                ),
                "status": "active",
                "inputFingerprint": input_fingerprint,
                "dependencies": {
                    "sourceIds": [source_id],
                    "columns": [metric_column],
                    "upstreamProjectionIds": [metric_projection_id],
                },
                "executionPolicy": {"mode": "direct", "refreshStrategy": "always"},
                "widgetContract": build_widget_contract(snapshot_widget, "scalar", ["value"]),
                **snapshot_presentation,
                "compiledAt": compiled_at,
            }
        )

    return query_specs
