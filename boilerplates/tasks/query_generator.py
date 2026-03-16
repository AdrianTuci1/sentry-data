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
    gold_uris_raw        = os.environ.get("INJECTED_GOLD_URIS", "[]")
    manifest_uri         = os.environ.get("INJECTED_MANIFEST_URI", "")
    strategy_uri         = os.environ.get("INJECTED_STRATEGY_URI", "")
    metrics_discovery_raw = os.environ.get("INJECTED_METRICS_DISCOVERY", "[]")

    try:
        gold_uris = json.loads(gold_uris_raw)
    except:
        gold_uris = [os.environ.get("INJECTED_GOLD_URI", "")]

    print("1. Connecting to memory DB and loading HTTPFS extension...")
    con = duckdb.connect(database=':memory:')
    con.execute("LOAD httpfs;")  # Pre-installed at image build time

    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '').replace('https://', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    con.execute("SET s3_url_style='path';")

    # -------------------------------------------------------------------------
    # PHASE 1 & 2: DISCOVER GOLD LAYER SCHEMAS & SAMPLE DATA
    # -------------------------------------------------------------------------
    print(f"2. [Schema Discovery] Describing {len(gold_uris)} Gold Layer table(s)...")
    
    for i, gold_uri in enumerate(gold_uris):
        if not gold_uri: continue
        alias = f"gold_{i}"
        print(f"\n  ➤ Table {i} [{alias}]: {gold_uri}")
        
        try:
            schema_rows = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{gold_uri}')").fetchall()
            print("    Columns:")
            for col in schema_rows:
                print(f"      - {col[0]} ({col[1]})")
        except Exception as e:
            if "404" in str(e) or "NoSuchKey" in str(e):
                print(f"    AGENT_ERROR: Gold Layer not found. Did Feature Engineering fail or skip this?")
            else:
                print(f"    AGENT_ERROR: {str(e)}")
            continue

        try:
            print("    Sample stats:")
            sample = con.execute(f"SELECT * FROM read_parquet('{gold_uri}') USING SAMPLE 50 ROWS").fetchdf()
            for col in sample.columns:
                null_pct = round(sample[col].isna().mean() * 100, 1)
                if sample[col].dtype in ('float64', 'int64'):
                    print(f"      {col}: null={null_pct}% | min={sample[col].min()} | max={sample[col].max()} | mean={round(sample[col].mean(), 2)}")
                else:
                    top = sample[col].dropna().value_counts().head(2).to_dict()
                    print(f"      {col}: null={null_pct}% | top={top}")
        except Exception as e:
            print(f"    Sample failed (non-fatal): {str(e)}")

    # -------------------------------------------------------------------------
    # PHASE 3: LOAD METRIC GROUPS (from Feature Engineering discovery)
    # -------------------------------------------------------------------------
    print("4. [Context] Loading Feature Engineering metric groups...")
    try:
        metrics_discovery = json.loads(metrics_discovery_raw)
        print(f"  Received {len(metrics_discovery)} metric group(s):")
        for mg in metrics_discovery:
            mg_title = mg.get('title', '?')
            metrics = mg.get('metrics', mg.get('columns', []))
            print(f"    '{mg_title}': {len(metrics)} metric(s)")
            for m in metrics[:10]:
                print(f"      - {m.get('name','?')} ({m.get('type','?')})")
    except Exception as e:
        print(f"  Parse failed (non-fatal): {str(e)}")
        metrics_discovery = []

    # -------------------------------------------------------------------------
    # PHASE 4: READ FRONTEND WIDGET MANIFEST
    # This tells the LLM which widget types exist and what data each needs.
    # -------------------------------------------------------------------------
    print("5. [Manifest] Reading Frontend Widget Manifest...")
    manifest_yaml = ""
    if manifest_uri:
        try:
            manifest_yaml = fetch_from_r2(manifest_uri)
            manifest = yaml.safe_load(manifest_yaml)

            # Print available widget types and their data requirements
            print("  Available widget types:")
            widget_types = manifest.get('widget_types', {})
            for wtype, wspec in widget_types.items():
                desc = wspec.get('description', '')[:60]
                print(f"    - {wtype}: {desc}")

            # Print layout guidelines for gridSpan selection
            print("  Layout guidelines (gridSpan):")
            preferred = manifest.get('layout_guidelines', {}).get('preferred_spans', {})
            for wtype, span in preferred.items():
                if span != 'default':
                    print(f"    - {wtype}: {span}")
                    
        except Exception as e:
            print(f"  Manifest fetch failed (non-fatal): {str(e)}")

    # -------------------------------------------------------------------------
    # PHASE 4: FETCH BUSINESS STRATEGY
    # -------------------------------------------------------------------------
    if strategy_uri:
        print("\n4. [Strategy] Loading Business Metrics Strategy Matrix...")
        try:
            strategy_yaml = fetch_from_r2(strategy_uri)
            print("  --- STRATEGY MATRIX RULES ---")
            for line in strategy_yaml.split('\n'):
                print(f"    {line}")
            print("  -----------------------------")
        except Exception as e:
            print(f"  Strategy fetch failed (non-fatal): {str(e)}")

    # -------------------------------------------------------------------------
    # PHASE 5: ONE-SHOT QUERY + WIDGET CONFIG GENERATION (LLM fills this in)
    #
    # The LLM must generate for EACH insight:
    #   1. A DuckDB SQL query against read_parquet('{gold_uri}')
    #   2. Execute it, extract the value
    #   3. Choose a widget type from the manifest
    #   4. Set all widget properties: type, value, unit, colorTheme, gridSpan
    #
    # RULES:
    # - You have N gold tables available in the `gold_uris` array.
    # - Use read_parquet(gold_uris[i]) to read from a specific table.
    # - You can JOIN multiple tables if needed (e.g. read_parquet(gold_uris[0]) AS a JOIN read_parquet(gold_uris[1]) AS b ON a.id = b.id).
    # - Quote dot-columns: "traffic_source.name"
    # - DO NOT invent columns — only use those printed in Phase 1
    # - Test everything with test_run_script before finalizing
    #
    # WIDGET TYPE SELECTION GUIDE:
    #   Scalar (one number)          → "weather"  (value + unit)
    #   Scalar with progress         → "natural"  (value + unit + sliderValue 0-100)
    #   Time series                  → "predictive" (historical[] + forecast[])
    #   Category breakdown           → "bar-chart" or "pie-chart"
    #   Distribution                 → "funnel" (funnel[] array)
    #
    # EXAMPLE (LLM will overwrite with real code):
    # -----------------------------------------------------------
    # dashboards = []
    # dashboard_groups = []
    #
    # # --- Insight 1: Total LTV (scalar → weather widget) ---
    # dashboards.append({
    #     "id": "ins_total_ltv",
    #     "title": "Total Lifetime Value",
    #     "type": "weather",
    #     "colorTheme": "theme-revenue",
    #     "gridSpan": "default",
    #     "query": f"SELECT ROUND(SUM(total_ltv), 2) as total FROM read_parquet('{gold_uris[0]}')",
    #     "group_id": "grp_revenue",
    #     "adjusted_data_columns": ["total_ltv"]
    # })
    #
    # dashboard_groups.append({
    #     "id": "grp_revenue",
    #     "title": "Revenue & Monetization",
    #     "sources": ["ins_total_ltv"]
    # })
    #
    # discovery_payload = {
    #     "dashboardGroups": dashboard_groups,
    #     "dashboards": dashboards
    # }
    # print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")
    # -----------------------------------------------------------
    # --- LLM END ---

    print("6. Generating insight queries and widget configs...")

    print("Query generation completed.")

if __name__ == '__main__':
    run_query_generation()
