import os
import duckdb
import json

# ==========================================
# AGENT 2: FEATURE ENGINEERING (GOLD LAYER)
# ==========================================
# This template is modified by the AI Agent.
# Your goal: 
# 1. You are given a list of normalized Parquet URIs.
# 2. You must CREATE a final 'Gold Table' that joins these sources on common keys (e.g., Date).
# 3. Create intelligent derived features (e.g., CAC = Spend / Conversions).
# 4. Save the Gold Table to INJECTED_GOLD_URI.

# Node.js will inject this as a JSON string
INJECTED_NORMALIZED_URIS = json.loads(os.environ.get("INJECTED_DATA_URIS", "[]"))
INJECTED_GOLD_URI = os.environ.get("TARGET_GOLD_URI")

def run_feature_engineering():
    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    
    # LLM creates the complex JOIN and feature engineering SQL
    feature_query = f"""
        COPY (
            SELECT 
                *
            FROM '{INJECTED_NORMALIZED_URIS[0]}'
            LIMIT 10
        ) TO '{INJECTED_GOLD_URI}' (FORMAT PARQUET);
    """
    
    try:
        con.execute(feature_query)
        
        # Discovery Reporting: Fetch Gold Schema
        gold_schema = con.execute(f"DESCRIBE SELECT * FROM '{INJECTED_GOLD_URI}'").fetchall()
        discovery_info = {
            "gold_uri": INJECTED_GOLD_URI,
            "gold_schema": [{"name": c[0], "type": c[1]} for c in gold_schema],
            "input_uris": INJECTED_NORMALIZED_URIS
        }
        print(f"AGENT_DISCOVERY:{json.dumps(discovery_info)}")
        
        print(f"AGENT_RESULT:{{\"status\": \"success\", \"gold_uri\": \"{INJECTED_GOLD_URI}\"}}")
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_feature_engineering()
