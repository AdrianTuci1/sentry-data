import os
import duckdb
import json

# ==========================================
# AGENT 2: FEATURE ENGINEERING (GOLD LAYER)
# ==========================================

INJECTED_NORMALIZED_URIS = json.loads(os.environ.get("INJECTED_DATA_URIS", "[]"))
INJECTED_GOLD_URI = os.environ.get("TARGET_GOLD_URI")

def run_feature_engineering():
    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    
    try:
        print("1. Connecting to memory DB and loading HTTPFS extension...")
        
        # Discovery Reporting (Frontend Compatibility)
        # Sample the gold table after generation to provide real metrics
        
        # EXECUTION: Create Gold Table
        print(f"2. Designing Gold schema to write to {INJECTED_GOLD_URI}...")
        
        # LLM: Replace this with real logic
        feature_query = f"""
            COPY (
                SELECT * FROM read_parquet({INJECTED_NORMALIZED_URIS})
            ) TO '{INJECTED_GOLD_URI}' (FORMAT PARQUET);
        """
        print("3. Executing transformations and writing Gold Parquet to R2...")
        con.execute(feature_query)
        
        # 4. Post-execution Discovery
        print("4. Sampling Gold layer for discovery reporting...")
        schema = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{INJECTED_GOLD_URI}')").fetchall()
        
        # Table Columns (Clean subset for Gold layer)
        columns = []
        for i, col in enumerate(schema):
            columns.append({
                "id": f"gc_{i}",
                "name": col[0],
                "type": col[1],
                "status": "ok"
            })

        # Business Metrics (Subset of columns representing KPIs)
        metrics = []
        for i, col in enumerate(schema[:10]): 
            metrics.append({
                "id": f"m_{i}",
                "name": col[0],
                "value": "calculated",
                "status": "ok"
            })
            
        # Helper for descriptive naming
        def beautify(name):
            return name.replace("_", " ").title()

        # Prune and beautify columns
        pruned_columns = [
            { "id": f"c_{i}", "name": beautify(c["name"]), "type": c["type"], "status": "ok" }
            for i, c in enumerate(columns[:10])
        ]

        discovery_payload = {
            "tables": [
                {
                    "id": "gold_table",
                    "title": "clickstream events", # Step 3: Origin
                    "type": "tables",
                    "source": { "id": "ga4_conn", "name": "Google Analytics 4", "type": "stream" }, # Step 1: Connector
                    "lineage": { "action": "stream", "type": "transform" }, # Step 2: Action Type
                    "columns": pruned_columns # Step 4: Adjusted Data
                }
            ]
        }
        print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")

        print("5. Feature Engineering successfully completed.")
        print(f"AGENT_RESULT:{{\"status\": \"success\", \"gold_uri\": \"{INJECTED_GOLD_URI}\"}}")
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_feature_engineering()
