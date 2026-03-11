import duckdb
import json
import os

def run_feature_engineering():
    # Injected by Orchestrator
    normalized_uris_raw = os.environ.get("INJECTED_NORMALIZED_URIS", "")
    if normalized_uris_raw:
        normalized_uris = json.loads(normalized_uris_raw)
    else:
        normalized_uris = [os.environ.get("INJECTED_NORMALIZED_URI", "")]

    target_gold_uri = os.environ.get("INJECTED_GOLD_URI", "")

    print("1. Connecting to memory DB and loading HTTPFS extension...")
    con = duckdb.connect(database=':memory:')
    con.execute("LOAD httpfs;")  # Pre-installed at image build time — LOAD only

    # Configure S3 for R2
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '').replace('https://', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    con.execute("SET s3_url_style='path';")

    # -------------------------------------------------------------------------
    # PHASE 1: SCHEMA DISCOVERY (cheap — reads only Parquet footer metadata)
    # A real data engineer reads the schema FIRST, never the full data.
    # -------------------------------------------------------------------------
    print("2. [Schema Discovery] Reading Parquet metadata (no full table scan)...")
    schemas = {}
    for i, uri in enumerate(normalized_uris):
        if not uri:
            continue
        alias = f"ds{i}"
        try:
            # DESCRIBE reads only the Parquet file footer — no data rows transferred
            cols = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{uri}')").fetchall()
            schemas[alias] = [(col[0], col[1]) for col in cols]
            print(f"  [{alias}] {uri}")
            for col_name, col_type in schemas[alias]:
                print(f"    - {col_name} ({col_type})")
        except Exception as e:
            print(f"AGENT_ERROR: Failed to describe {uri}: {str(e)}")
            return

    # -------------------------------------------------------------------------
    # PHASE 2: STATISTICAL SAMPLE (50 rows — just enough to understand the data)
    # This is what a real data engineer does: sample, don't scan.
    # -------------------------------------------------------------------------
    print("3. [Data Profiling] Sampling 50 rows per source for value inspection...")
    for i, uri in enumerate(normalized_uris):
        if not uri:
            continue
        alias = f"ds{i}"
        try:
            # USING SAMPLE — DuckDB reads a small random subset, not the full file
            sample = con.execute(
                f"SELECT * FROM read_parquet('{uri}') USING SAMPLE 50 ROWS"
            ).fetchdf()
            print(f"  [{alias}] sample shape: {sample.shape[0]} rows × {sample.shape[1]} cols")
            # Print null rates and basic stats for numeric columns — gives LLM full context
            for col in sample.columns:
                null_pct = round(sample[col].isna().mean() * 100, 1)
                if sample[col].dtype in ('float64', 'int64'):
                    print(f"    {col}: null={null_pct}% | min={sample[col].min()} | max={sample[col].max()} | mean={round(sample[col].mean(), 2)}")
                else:
                    top = sample[col].dropna().value_counts().head(3).to_dict()
                    print(f"    {col}: null={null_pct}% | top_values={top}")
        except Exception as e:
            print(f"  [{alias}] Sample failed (non-fatal): {str(e)}")

    # -------------------------------------------------------------------------
    # PHASE 3: ONE-SHOT SQL TRANSFORMATION (LLM fills this in)
    # The LLM sees the full schema + sample stats above and writes the SQL
    # in a SINGLE pass — no iterative data reads.
    # -------------------------------------------------------------------------
    print("4. Executing feature engineering transformation (one-shot SQL)...")

    # --- LLM START: Transformation Logic ---
    # Rules for the LLM:
    # - Use aliases: FROM read_parquet('uri') AS ds0, JOIN read_parquet('uri') AS ds1
    # - Prefix ALL columns: ds0.user_id, ds1.event_name
    # - Quote dot-columns: "traffic_source.name"
    # - GA4 event params live in event_params.key / event_params.value.int_value
    # - Write ONE COPY ... TO statement, no intermediate reads
    #
    # EXAMPLE (LLM will overwrite this):
    # sql = f"""
    # COPY (
    #     SELECT
    #         ds0.user_id,
    #         COUNT(*) FILTER (WHERE ds0.event_name = 'session_start') AS sessions,
    #         AVG(CASE WHEN "event_params.key" = 'engaged_time_msec'
    #                  THEN "event_params.value.int_value" END) / 1000.0 AS avg_engaged_sec
    #     FROM read_parquet('{normalized_uris[0]}') AS ds0
    #     GROUP BY 1
    # ) TO '{target_gold_uri}' (FORMAT PARQUET);
    # """
    # con.execute(sql)
    # --- LLM END ---

    # -------------------------------------------------------------------------
    # PHASE 4: VERIFY OUTPUT + DYNAMIC DISCOVERY PAYLOAD
    # Read only the gold layer schema — never re-read source data.
    # -------------------------------------------------------------------------
    print("5. [Verification] Describing Gold Layer schema (metadata only)...")
    try:
        gold_schema = con.execute(
            f"DESCRIBE SELECT * FROM read_parquet('{target_gold_uri}')"
        ).fetchall()
    except Exception as e:
        print(f"AGENT_ERROR: Failed to describe target gold layer: {str(e)}")
        return

    columns_discovery = []
    for i, col in enumerate(gold_schema):
        columns_discovery.append({
            "id": f"c_{i}",
            "name": col[0],
            "type": "Decimal" if ("DOUBLE" in col[1] or "INT" in col[1] or "FLOAT" in col[1]) else "String",
            "status": "ok"
        })

    discovery_payload = {
        "tables": [
            {
                "id": "gold_table",
                "title": "Engineered Features",
                "source": {"id": "src_silver", "name": "Silver Layer", "type": "stream"},
                "lineage": {"action": "Feature Engineering", "type": "transform"},
                "columns": columns_discovery[:15]  # Top 15 features max
            }
        ]
    }

    print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")
    print("Feature Engineering completed successfully.")

if __name__ == '__main__':
    run_feature_engineering()
