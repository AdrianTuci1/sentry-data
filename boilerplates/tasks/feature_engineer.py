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

    gold_uris_raw = os.environ.get("INJECTED_GOLD_URIS", "")
    if gold_uris_raw:
        target_gold_uris = json.loads(gold_uris_raw)
    else:
        target_gold_uris = [os.environ.get("INJECTED_GOLD_URI", "")]

    print("1. Connecting to memory DB and loading HTTPFS extension...")
    con = duckdb.connect(database=':memory:')
    con.execute("LOAD httpfs;")

    # Configure S3 for R2
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '').replace('https://', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    con.execute("SET s3_url_style='path';")

    # PHASE 1 & 2: DISCOVERY & PROFILING 
    print("2. [Schema Discovery] Reading Parquet metadata...")
    schemas = {}
    for i, uri in enumerate(normalized_uris):
        if not uri:
            continue
        alias = f"ds{i}"
        try:
            cols = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{uri}')").fetchall()
            schemas[alias] = [(col[0], col[1]) for col in cols]
            print(f"  [{alias}] {uri} -> Target Gold: {target_gold_uris[i] if i < len(target_gold_uris) else 'N/A'}")
            for col_name, col_type in schemas[alias]:
                print(f"    - {col_name} ({col_type})")
        except Exception as e:
            print(f"AGENT_ERROR: Failed to describe {uri}: {str(e)}")
            return

    print("3. [Data Profiling] Sampling 50 rows per source...")
    for i, uri in enumerate(normalized_uris):
        if not uri:
            continue
        alias = f"ds{i}"
        try:
            sample = con.execute(f"SELECT * FROM read_parquet('{uri}') USING SAMPLE 50 ROWS").fetchdf()
            print(f"  [{alias}] sample shape: {sample.shape[0]} rows × {sample.shape[1]} cols")
        except Exception as e:
            print(f"  [{alias}] Sample failed (non-fatal): {str(e)}")

    # PHASE 3: TRANSFORMATIONS (LLM)
    print("4. Executing feature engineering transformation (one-shot SQL)...")

    # --- LLM START: Transformation Logic ---
    # Rules for the LLM:
    # - You have N input sources (Silver) and N target outputs (Gold).
    # - Generate a SEPARATE `COPY` statement for EACH target URI.
    # - Do NOT try to join all sources into a single table unless explicitly requested. Keep them denormalized but cleaned 1-to-1 if possible.
    # - Example for 2 sources:
    # sql = f"""
    # COPY (SELECT col1, col2, agg_func() FROM read_parquet('{normalized_uris[0]}') GROUP BY 1, 2) TO '{target_gold_uris[0]}' (FORMAT PARQUET);
    # COPY (SELECT colA, colB FROM read_parquet('{normalized_uris[1]}')) TO '{target_gold_uris[1]}' (FORMAT PARQUET);
    # """
    # con.execute(sql)
    # --- LLM END ---

    # PHASE 4: VERIFICATION
    print("5. [Verification] Describing Gold Layer schemas...")
    all_tables_discovery = []
    
    for i, gold_uri in enumerate(target_gold_uris):
        try:
            gold_schema = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{gold_uri}')").fetchall()
            
            columns_discovery = []
            for j, col in enumerate(gold_schema):
                col_name = col[0]
                # Format technical names to human-readable titles (e.g. bounce_rate -> Bounce rate)
                col_title = col_name.replace("_", " ").capitalize()
                
                columns_discovery.append({
                    "id": f"c_{i}_{j}",
                    "name": col_name,
                    "title": col_title,
                    "type": "Decimal" if ("DOUBLE" in col[1] or "INT" in col[1] or "FLOAT" in col[1]) else "String",
                    "status": "ok"
                })

            all_tables_discovery.append({
                "id": f"gold_table_{i}",
                "title": f"Engineered Features {i}",
                "source": {"id": f"src_silver_{i}", "name": "Silver Layer", "type": "stream"},
                "lineage": {"action": "Feature Engineering", "type": "transform"},
                "columns": columns_discovery[:15]
            })
        except Exception as e:
            print(f"Warning: Failed to describe target gold layer {gold_uri}: {str(e)}")
            # We don't return here so other successful descriptions can still be sent.

    if not all_tables_discovery:
         print("AGENT_ERROR: No gold tables were successfully created/described.")
         return

    discovery_payload = {
        "tables": all_tables_discovery
    }

    print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")
    print("Feature Engineering completed successfully.")

if __name__ == '__main__':
    run_feature_engineering()
