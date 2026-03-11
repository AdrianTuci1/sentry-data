import duckdb
import json
import os
import yaml
import boto3
from urllib.parse import urlparse

def fetch_from_r2(uri: str) -> str:
    """Fetch a text file (manifest, config) from R2/S3."""
    parsed = urlparse(uri)
    bucket = parsed.netloc
    key = parsed.path.lstrip('/')
    s3 = boto3.client(
        's3',
        endpoint_url=os.environ.get("R2_ENDPOINT_URL", ""),
        aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID", ""),
        aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY", ""),
        region_name=os.environ.get("R2_REGION", "auto"),
    )
    return s3.get_object(Bucket=bucket, Key=key)['Body'].read().decode('utf-8')

def run_query_generation():
    # Injected by Orchestrator
    gold_uri             = os.environ.get("INJECTED_GOLD_URI", "")
    manifest_uri         = os.environ.get("INJECTED_MANIFEST_URI", "")
    metrics_discovery_raw = os.environ.get("INJECTED_METRICS_DISCOVERY", "[]")

    print("1. Connecting to memory DB and loading HTTPFS extension...")
    con = duckdb.connect(database=':memory:')
    con.execute("LOAD httpfs;")  # Pre-installed at image build time — LOAD only

    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '').replace('https://', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    con.execute("SET s3_url_style='path';")

    # -------------------------------------------------------------------------
    # PHASE 1: DISCOVER GOLD LAYER SCHEMA (Parquet footer only — no data scan)
    # -------------------------------------------------------------------------
    print(f"2. [Schema Discovery] Describing Gold Layer (metadata only): {gold_uri}")
    try:
        schema_rows = con.execute(
            f"DESCRIBE SELECT * FROM read_parquet('{gold_uri}')"
        ).fetchall()
    except Exception as e:
        if "404" in str(e) or "NoSuchKey" in str(e):
            print(f"AGENT_ERROR: Gold Layer not found at {gold_uri}. Did Feature Engineering complete?")
        else:
            print(f"AGENT_ERROR: {str(e)}")
        return

    print("  Gold Layer columns:")
    gold_columns = []
    for col in schema_rows:
        col_name, col_type = col[0], col[1]
        gold_columns.append({"name": col_name, "type": col_type})
        print(f"    - {col_name} ({col_type})")

    # -------------------------------------------------------------------------
    # PHASE 2: SAMPLE GOLD DATA (50 rows for value intuition)
    # Used by LLM to understand actual value ranges before writing queries
    # -------------------------------------------------------------------------
    print("3. [Data Profiling] Sampling 50 rows from Gold Layer...")
    try:
        sample = con.execute(
            f"SELECT * FROM read_parquet('{gold_uri}') USING SAMPLE 50 ROWS"
        ).fetchdf()
        print(f"  Sample shape: {sample.shape[0]} rows × {sample.shape[1]} cols")
        for col in sample.columns:
            null_pct = round(sample[col].isna().mean() * 100, 1)
            if sample[col].dtype in ('float64', 'int64'):
                print(f"    {col}: null={null_pct}% | min={sample[col].min()} | max={sample[col].max()} | mean={round(sample[col].mean(), 2)}")
            else:
                top = sample[col].dropna().value_counts().head(3).to_dict()
                print(f"    {col}: null={null_pct}% | top_values={top}")
    except Exception as e:
        print(f"  Sample failed (non-fatal): {str(e)}")

    # -------------------------------------------------------------------------
    # PHASE 3: LOAD METRIC GROUPS (from Feature Engineering discovery)
    # These are the "groups" that connect adjusted_data → insights
    # -------------------------------------------------------------------------
    print("4. [Context] Loading Feature Engineering metric groups...")
    try:
        metrics_discovery = json.loads(metrics_discovery_raw)
        print(f"  Received {len(metrics_discovery)} metric group(s) from Feature Engineering:")
        for mg in metrics_discovery:
            mg_id = mg.get('id', '?')
            mg_title = mg.get('title', '?')
            metrics = mg.get('metrics', mg.get('columns', []))
            print(f"    Group [{mg_id}] '{mg_title}': {len(metrics)} metric(s)")
            for m in metrics[:10]:
                print(f"      - {m.get('name','?')} ({m.get('type','?')})")
    except Exception as e:
        print(f"  Could not parse INJECTED_METRICS_DISCOVERY (non-fatal): {str(e)}")
        metrics_discovery = []

    # -------------------------------------------------------------------------
    # PHASE 4: READ FRONTEND MANIFEST (understand dashboard/insight schema)
    # -------------------------------------------------------------------------
    print("5. [Manifest] Reading Frontend Widget Manifest...")
    manifest_content = ""
    if manifest_uri:
        try:
            manifest_content = fetch_from_r2(manifest_uri)
            print(f"  Manifest loaded ({len(manifest_content)} chars). Schema understood.")
        except Exception as e:
            print(f"  Manifest fetch failed (non-fatal): {str(e)}")

    # -------------------------------------------------------------------------
    # PHASE 5: ONE-SHOT QUERY + INSIGHT GENERATION (LLM fills this in)
    #
    # The LLM must now generate, for each metric group (group):
    #   1. A DuckDB SQL query that computes the insight value from gold_uri
    #   2. An AGENT_DISCOVERY payload with dashboardGroups and dashboards
    #
    # LINEAGE MODEL:
    #   connection → action_type → origin → adjusted_data (Gold) → group → insight
    #
    # RULES FOR LLM:
    # - Use read_parquet('{gold_uri}') — always single-quoted URI
    # - Quote dot-columns: "traffic_source.name"
    # - Each "insight" is ONE scalar or time-series query result
    # - Each "group" is a dashboardGroup that bundles related insights
    # - Output AGENT_DISCOVERY with the exact schema from the manifest
    # - DO NOT invent column names — only use those printed in Phase 1
    # - Test your queries with test_run_script before finalizing
    #
    # EXAMPLE structure (LLM will overwrite with real SQL):
    # insights = []
    # groups = []
    #
    # --- For each metric in the gold schema, generate a query: ---
    # result = con.execute(f"""
    #     SELECT
    #         DATE_TRUNC('day', event_date) AS period,
    #         SUM(revenue) AS total_revenue,
    #         COUNT(DISTINCT user_id) AS unique_users,
    #         ROUND(SUM(revenue) / COUNT(DISTINCT user_id), 2) AS arpu
    #     FROM read_parquet('{gold_uri}')
    #     GROUP BY 1
    #     ORDER BY 1
    # """).fetchall()
    #
    # --- Build insight node ---
    # insights.append({
    #     "id": "ins_revenue",
    #     "title": "Total Revenue by Day",
    #     "query": "SELECT ...",
    #     "result_preview": result[:3],
    #     "group_id": "grp_financial",
    #     "adjusted_data_columns": ["revenue", "user_id"],  # lineage: which Gold cols feed this
    #     "status": "ok"
    # })
    # groups.append({"id": "grp_financial", "title": "Financial KPIs", "insight_ids": ["ins_revenue"]})
    #
    # --- LLM END ---
    print("6. Generating insight queries and assembling discovery payload...")

    # =========================================================================
    # DISCOVERY OUTPUT — LLM must produce this format:
    # =========================================================================
    # discovery_payload = {
    #     "dashboardGroups": [
    #         {
    #             "id": "grp_X",
    #             "title": "Group Title",
    #             "sources": ["ins_A", "ins_B"]   # insight IDs that belong to this group
    #         }
    #     ],
    #     "dashboards": [
    #         {
    #             "id": "ins_A",
    #             "title": "Insight Title",
    #             "group_id": "grp_X",
    #             "query": "SELECT ... FROM read_parquet('s3://...')",
    #             "adjusted_data_columns": ["col1", "col2"],  # Gold cols used
    #             "result_preview": [[...], [...]]            # max 3 sample rows
    #         }
    #     ]
    # }
    # print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")
    # print("Query generation completed successfully.")

    print("Query generation completed.")

if __name__ == '__main__':
    run_query_generation()
