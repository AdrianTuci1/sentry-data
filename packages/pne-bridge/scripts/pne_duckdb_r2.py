#!/usr/bin/env python3
import argparse
import json
import math
import os
import re
import sys
from pathlib import Path

import duckdb


def load_env_file() -> None:
    for candidate in (Path("sentry-backend/.env"), Path(".env")):
        if not candidate.exists():
            continue
        for raw_line in candidate.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key, value)


def infer_semantic_type(column_name: str, column_type: str) -> str:
    normalized_name = column_name.lower()
    normalized_type = column_type.lower()
    if normalized_name.endswith("_id") or normalized_name == "id":
        return "id"
    if "date" in normalized_name or "time" in normalized_name or "timestamp" in normalized_type:
        return "timestamp"
    if any(token in normalized_type for token in ("int", "decimal", "numeric", "double", "float", "real", "bigint")):
        return "metric"
    if "json" in normalized_type:
        return "json"
    if any(token in normalized_type for token in ("char", "text", "string", "varchar")):
        return "dimension"
    return "unknown"


def json_safe(value):
    if value is None:
        return None
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, (int, str, bool)):
        return value
    return str(value)


def sql_escape(value: str) -> str:
    return value.replace("'", "''")


def normalize_sql(sql: str) -> str:
    return re.sub(
        r"DATE_TRUNC\(([^,]+),\s*DAY\)",
        lambda match: f"DATE_TRUNC('day', {match.group(1).strip()})",
        sql,
        flags=re.IGNORECASE,
    )


def load_specs(args):
    if getattr(args, "spec_file", None):
        payload = json.loads(Path(args.spec_file).read_text())
        if isinstance(payload, dict):
            payload = payload.get("tables") or payload.get("sources") or []
        specs = []
        for item in payload:
            specs.append({
                "table": item["table"],
                "name": item.get("name") or item["table"],
                "uri": item["uri"],
            })
        return specs

    return [{
        "table": args.table,
        "name": args.name or args.table,
        "uri": args.uri,
    }]


def connect(specs):
    load_env_file()
    con = duckdb.connect(":memory:")
    con.execute("INSTALL httpfs")
    con.execute("LOAD httpfs")
    region = sql_escape(os.environ.get("R2_REGION", "auto"))
    con.execute(f"SET s3_region='{region}'")
    endpoint = os.environ.get("R2_ENDPOINT", "").replace("https://", "").replace("http://", "")
    if endpoint:
        con.execute(f"SET s3_endpoint='{sql_escape(endpoint)}'")
    access_key = os.environ.get("R2_ACCESS_KEY_ID", "")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "")
    session_token = os.environ.get("R2_SESSION_TOKEN", "")
    if access_key:
        con.execute(f"SET s3_access_key_id='{sql_escape(access_key)}'")
    if secret_key:
        con.execute(f"SET s3_secret_access_key='{sql_escape(secret_key)}'")
    if session_token:
        con.execute(f"SET s3_session_token='{sql_escape(session_token)}'")
    con.execute("SET s3_url_style='path'")
    con.execute("SET s3_use_ssl=true")

    first = True
    for spec in specs:
        uri = spec["uri"]
        table_name = spec["table"]
        con.execute(f"CREATE OR REPLACE VIEW {table_name} AS SELECT * FROM read_parquet('{sql_escape(uri)}')")
        if first:
            con.execute(f"CREATE OR REPLACE VIEW source_data AS SELECT * FROM {table_name}")
            first = False
    return con


def do_introspect(args) -> int:
    specs = load_specs(args)
    con = connect(specs)
    profiles = []

    for spec in specs:
        table_name = spec["table"]
        schema_rows = con.execute(f"DESCRIBE SELECT * FROM {table_name}").fetchall()
        columns = []
        metric_candidates = []
        entity_key_candidates = []
        timestamp_candidates = []

        for row in schema_rows:
            name = str(row[0])
            column_type = str(row[1])
            semantic_type = infer_semantic_type(name, column_type)
            column = {
                "name": name,
                "type": column_type,
                "nullable": str(row[2]).upper() != "NO",
                "semanticType": semantic_type,
            }
            columns.append(column)
            if semantic_type == "metric":
                metric_candidates.append(name)
            elif semantic_type == "id":
                entity_key_candidates.append(name)
            elif semantic_type == "timestamp":
                timestamp_candidates.append(name)

        sample_result = con.execute(f"SELECT * FROM {table_name} LIMIT 3")
        sample_columns = [desc[0] for desc in sample_result.description]
        sample_rows = []
        for row in sample_result.fetchall():
            sample_rows.append({name: json_safe(value) for name, value in zip(sample_columns, row)})

        profiles.append({
            "tableId": table_name,
            "displayName": spec["name"],
            "engine": "duckdb",
            "columns": columns,
            "metricCandidates": metric_candidates,
            "entityKeyCandidates": entity_key_candidates,
            "timestampCandidates": timestamp_candidates,
            "sampleRows": sample_rows,
            "metadata": {
                "uri": spec["uri"],
                "storage": "r2",
            },
        })

    sys.stdout.write(json.dumps(profiles, indent=2))
    return 0


def do_query(args) -> int:
    payload = json.loads(sys.stdin.read() or "{}")
    request_id = payload.get("requestId") or f"query-{os.getpid()}"
    sql = payload.get("sql")
    if not sql:
        sys.stdout.write(json.dumps({
            "requestId": request_id,
            "rows": [],
            "rowCount": 0,
            "error": {
                "code": "missing_sql",
                "message": "Missing sql in request payload."
            }
        }))
        return 0

    con = connect(load_specs(args))
    result = con.execute(normalize_sql(sql))
    columns = [desc[0] for desc in (result.description or [])]
    rows = [
        {name: json_safe(value) for name, value in zip(columns, row)}
        for row in result.fetchall()
    ]
    sys.stdout.write(json.dumps({
        "requestId": request_id,
        "rows": rows,
        "rowCount": len(rows)
    }, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    for name in ("introspect", "query"):
        sub = subparsers.add_parser(name)
        sub.add_argument("--uri")
        sub.add_argument("--table", default="source_data")
        sub.add_argument("--name")
        sub.add_argument("--spec-file")

    args = parser.parse_args()
    if not args.spec_file and not args.uri:
        parser.error("Either --uri or --spec-file is required.")
    if args.command == "introspect":
        return do_introspect(args)
    return do_query(args)


if __name__ == "__main__":
    raise SystemExit(main())
