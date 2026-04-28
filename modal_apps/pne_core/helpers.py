import hashlib
import json
import re
from typing import Any, Dict, List

from .models import SourceProfile


def hash_dict(payload: Dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def build_fingerprint(profile: SourceProfile, schema: List[Dict[str, Any]]) -> str:
    if profile.fingerprint:
        return profile.fingerprint
    return hash_dict(
        {
            "sourceId": profile.sourceId,
            "sourceName": profile.sourceName,
            "uri": profile.uri,
            "schema": schema,
        }
    )


def escape_sql_string(value: str) -> str:
    return value.replace("'", "''")


def build_projection_sql_source(profile: SourceProfile) -> str:
    return f"read_parquet('{escape_sql_string(profile.uri)}')"


def _is_executable_projection_sql(candidate: str) -> bool:
    normalized = str(candidate or "").strip()
    if not normalized or not re.match(r"^(select|with)\b", normalized, flags=re.IGNORECASE):
        return False

    # Bronze/silver/gold logical table names from discovery are semantic references,
    # not executable DuckDB relations inside the analytics worker.
    if re.search(r"\b(bronze|silver|gold)\.[A-Za-z0-9_-]+\b", normalized, flags=re.IGNORECASE):
        return False

    return True


def build_projection_relation_source(projection_spec: Dict[str, Any], profile: SourceProfile) -> str:
    logic = projection_spec.get("logic") if isinstance(projection_spec, dict) else {}
    if isinstance(logic, dict):
        for key in ("effective_query", "compiled_code", "code"):
            candidate = str(logic.get(key) or "").strip()
            if _is_executable_projection_sql(candidate):
                stripped = candidate.rstrip(";").strip()
                return f"({stripped}) AS pne_projection"

    serving_uri = str(projection_spec.get("servingUri") or "").strip() if isinstance(projection_spec, dict) else ""
    if serving_uri:
        return f"read_parquet('{escape_sql_string(serving_uri)}')"

    return build_projection_sql_source(profile)


def quote_identifier(identifier: str) -> str:
    escaped = identifier.replace('"', '""')
    return f'"{escaped}"'
