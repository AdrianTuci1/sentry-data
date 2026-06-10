import json
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from .config import DEFAULT_GEMINI_MODEL, logger
from .helpers import build_fingerprint, build_projection_sql_source, hash_dict
from .models import CompileProjectionPlanRequest, SourceProfile
from .sentinel_tools import (
    analyze_data_health,
    check_data_drift,
    check_interaction_policy,
    check_schema_coverage,
    check_sql_risk,
)
from .widget_tools import inspect_category, inspect_manifest, inspect_manifests, list_widget_categories, lookup_catalog
from .worker_tools import execute_worker_query
from .widgets import build_widget_contract, build_widget_presentation, resolve_widget_type


def build_gemini_worker_context(req: CompileProjectionPlanRequest) -> Dict[str, Optional[str]]:
    return {
        "url": req.workerUrl,
        "secret": req.workerSecret,
        "tenantId": req.tenantId,
        "projectId": req.projectId,
    }


def extract_response_text(response: Any) -> str:
    texts: List[str] = []

    for candidate in getattr(response, "candidates", []) or []:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", []) or []:
            text = getattr(part, "text", None)
            if text:
                texts.append(text)

    return "\n".join(texts).strip()


def parse_query_specs_from_text(
    text: str,
    projection_id: str,
    source_id: str,
    input_fingerprint: str,
    sql_source: str,
    compiled_at: str,
) -> List[Dict[str, Any]]:
    if not text:
        return []

    json_payload = text
    if "```json" in text:
        json_payload = text.split("```json", 1)[1].split("```", 1)[0].strip()

    try:
        parsed = json.loads(json_payload)
    except json.JSONDecodeError:
        logger.warning("Gemini returned non-JSON projection plan text for source %s", source_id)
        return []

    if not isinstance(parsed, list):
        logger.warning("Gemini returned unexpected plan shape for source %s: %s", source_id, type(parsed).__name__)
        return []

    query_specs: List[Dict[str, Any]] = []
    for index, candidate in enumerate(parsed):
        if not isinstance(candidate, dict) or "sql" not in candidate:
            continue

        query_spec = dict(candidate)
        query_spec["sql"] = str(query_spec["sql"]).replace("virtual_view", sql_source)
        query_spec.setdefault("sourceId", source_id)
        query_spec.setdefault("inputFingerprint", input_fingerprint)
        query_spec.setdefault("queryId", f"{projection_id}_query_{index + 1}")
        query_spec.setdefault("projectionId", projection_id)
        query_spec.setdefault("status", "active")
        query_spec.setdefault(
            "dependencies",
            {
                "sourceIds": [source_id],
                "columns": [],
                "upstreamProjectionIds": [projection_id],
            },
        )
        query_spec.setdefault("executionPolicy", {"mode": "direct", "refreshStrategy": "always"})
        widget_resolution = resolve_widget_type(
            str(query_spec.get("widgetType") or "technical-health"),
            sql=str(query_spec.get("sql") or ""),
            title=str(query_spec.get("title") or ""),
        )
        widget_type = widget_resolution["resolved"]
        query_spec["widgetType"] = widget_type
        if widget_resolution["requested"] and widget_resolution["requested"] != widget_type:
            query_spec["requestedWidgetType"] = widget_resolution["requested"]
            query_spec["widgetResolution"] = widget_resolution
        presentation = build_widget_presentation(widget_type)
        query_spec["widgetContract"] = build_widget_contract(widget_type, "unknown", [])
        query_spec["gridSpan"] = query_spec.get("gridSpan") or presentation.get("gridSpan")
        query_spec["colorTheme"] = query_spec.get("colorTheme") or presentation.get("colorTheme")
        query_spec.setdefault("compiledAt", compiled_at)
        query_spec["queryHash"] = hash_dict(query_spec)
        query_specs.append(query_spec)

    return query_specs


def get_tool_dispatch() -> Dict[str, Callable[..., Any]]:
    return {
        "list_widget_categories": list_widget_categories,
        "inspect_category": inspect_category,
        "lookup_catalog": lookup_catalog,
        "inspect_manifest": inspect_manifest,
        "inspect_manifests": inspect_manifests,
        "analyze_data_health": analyze_data_health,
        "check_schema_coverage": check_schema_coverage,
        "check_sql_risk": check_sql_risk,
        "check_data_drift": check_data_drift,
        "check_interaction_policy": check_interaction_policy,
    }


def execute_tool_call(call: Any, worker_ctx: Dict[str, Optional[str]]) -> str:
    tool_name = getattr(call, "name", "")
    args = getattr(call, "args", {}) or {}

    if tool_name == "execute_worker_query":
        sql = args.get("sql")
        if not sql:
            return "Error: execute_worker_query called without sql."
        return execute_worker_query(sql=sql, **worker_ctx)

    fn = get_tool_dispatch().get(tool_name)
    if not fn:
        return f"Error: unknown tool '{tool_name}'."

    return fn(**args)


def run_gemini_reasoning(
    req: CompileProjectionPlanRequest,
    profile: SourceProfile,
    projection_id: str,
    api_key: str,
) -> List[Dict[str, Any]]:
    schema = profile.source_schema
    if not schema:
        return []

    from google import genai
    from google.genai import types

    schema_fmt = ", ".join([f"{column.get('name')} {column.get('type', 'UNKNOWN')}" for column in schema])
    sql_source = build_projection_sql_source(profile)
    sample_rows = profile.sampleRows[:3] if profile.sampleRows else []
    timestamp_candidates = ", ".join(profile.timestampCandidates[:6]) or "none"
    metric_candidates = ", ".join(profile.metricCandidates[:6]) or "none"
    entity_candidates = ", ".join(profile.entityKeyCandidates[:6]) or "none"
    system_instruction = (
        "You are the Parrot Neural Engine. "
        "Your task is to plan dashboard widgets for a data source. "
        "\n\n=== DISCOVERY ===\n"
        "Always start by calling list_widget_categories() to see the full catalog. "
        "Then inspect 2-3 promising categories with inspect_category() to find widgets that fit the data. "
        "Finally inspect the manifest of every widget you plan to emit with inspect_manifest(). "
        "\n\n=== DIVERSITY ===\n"
        "Never emit two widgets from the same category unless the data genuinely requires it. "
        "Cover at least 3 different categories in your output. "
        "Generate at most 3 high-signal widgets per source beyond the deterministic baseline. "
        "Prefer one meaningful trend, one ranked breakdown, and at most one compact KPI. "
        "Avoid repetitive count-only widgets when a richer trend or ranked list is possible. "
        "Avoid emitting one widget per discrete bucket or score value. "
        "\n\n=== OUTPUT FORMAT ===\n"
        "When you answer, return only a JSON array. "
        "Each item must contain at least: queryId, widgetId, title, widgetType, and sql. "
        "Every widgetType must be a canonical catalog widget id, not a generic label like line_chart or table. "
        "Use descriptive stable ids such as source_metric_trend, never bare integers like 1 or 2. "
        "\n\n=== SQL REQUIREMENTS ===\n"
        "Your SQL must return exactly the aliases required by the manifest with the correct runtime shape. "
        "The manifest's sql_aliases and sql_shape fields are the source of truth. "
        "Prefer one final row per widget payload and package nested arrays or objects with DuckDB list/struct aggregations. "
        "Round non-count numeric outputs to at most 2 decimal places unless the metric is naturally an integer count. "
        "Use SQL directly executable by the analytics worker. "
        "Favor business insights, comparisons, and movement over raw totals unless the total is genuinely important. "
        f"\n\n=== DATA CONTEXT ===\n"
        f"Base relation: {sql_source}. "
        f"Schema: {schema_fmt}. "
        f"Timestamp candidates: {timestamp_candidates}. "
        f"Metric candidates: {metric_candidates}. "
        f"Entity key candidates: {entity_candidates}. "
        f"Sample rows: {json.dumps(sample_rows, ensure_ascii=False)}"
    )
    worker_ctx = build_gemini_worker_context(req)
    client = genai.Client(api_key=api_key)

    tools = [
        list_widget_categories,
        inspect_category,
        lookup_catalog,
        inspect_manifest,
        inspect_manifests,
        analyze_data_health,
        execute_worker_query,
        check_schema_coverage,
        check_sql_risk,
        check_data_drift,
        check_interaction_policy,
    ]

    chat = client.chats.create(
        model=DEFAULT_GEMINI_MODEL,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.1,
            tools=tools,
        ),
    )
    response = chat.send_message(
        "Plan dashboard widgets for this data. Return only non-trivial business insights that would be worth showing on a client dashboard."
    )

    # Keep the tool loop bounded so a noisy model session cannot block the endpoint.
    for _ in range(8):
        function_calls = getattr(response, "function_calls", None) or []
        if not function_calls:
            break

        tool_responses = []
        for call in function_calls:
            tool_result = execute_tool_call(call, worker_ctx)
            tool_responses.append(
                types.Part.from_function_response(
                    name=getattr(call, "name", "unknown_tool"),
                    response={"result": tool_result},
                )
            )

        response = chat.send_message(tool_responses)

    response_text = extract_response_text(response)
    if not response_text:
        logger.info("Gemini returned no text plan for source %s", profile.sourceId)
        return []

    return parse_query_specs_from_text(
        text=response_text,
        projection_id=projection_id,
        source_id=profile.sourceId,
        input_fingerprint=build_fingerprint(profile, schema),
        sql_source=sql_source,
        compiled_at=req.compiledAt or datetime.now(timezone.utc).isoformat(),
    )
