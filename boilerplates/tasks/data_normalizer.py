import os
import duckdb
import json

# ==========================================
# AGENT 1: DISCOVERY & NORMALIZATION
# ==========================================
# This template is modified by the AI Agent.
# Your goal: 
# 1. Read the raw data from INJECTED_RAW_URI
# 2. Understand its schema (e.g. GA4, Shopify, Facebook Ads)
# 3. Write a SQL transformation that normalizes this into a standard schema.
# 4. Save the normalized Parquet file to INJECTED_NORMALIZED_URI

INJECTED_RAW_URI = os.environ.get("INJECTED_RAW_URI") 
INJECTED_NORMALIZED_URI = os.environ.get("INJECTED_NORMALIZED_URI")

def run_normalization():
    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    
    # Example agent observation step: 
    # schema = con.execute(f"DESCRIBE SELECT * FROM '{INJECTED_RAW_URI}'").fetchall()
    # print(schema)
    
    # Exclude complex nested types (like structs/lists) to prevent downstream joining errors
    schema = con.execute(f"DESCRIBE SELECT * FROM '{INJECTED_RAW_URI}'").fetchall()
    safe_columns = []
    for col in schema:
        col_name = col[0]
        col_type = col[1]
        if not col_type.startswith('STRUCT') and not col_type.startswith('LIST'):
            safe_columns.append(f'"{col_name}"')
            
    cols_str = ", ".join(safe_columns) if safe_columns else "*"
    
    # Discovery Reporting
    discovery_info = {
        "source_uri": INJECTED_RAW_URI,
        "schema": [{"name": c[0], "type": c[1]} for c in schema],
        "normalized_columns": safe_columns,
        "lineage": {"from": INJECTED_RAW_URI, "to": INJECTED_NORMALIZED_URI}
    }
    print(f"AGENT_DISCOVERY:{json.dumps(discovery_info)}")
    
    # LLM must replace this query with the correct mapping for the specific source
    normalization_query = f"""
        COPY (
            SELECT 
                {cols_str}
            FROM '{INJECTED_RAW_URI}'
        ) TO '{INJECTED_NORMALIZED_URI}' (FORMAT PARQUET);
    """
    
    try:
        con.execute(normalization_query)
        # The agent must print this exact success message to signal completion to Node.js
        print(f"AGENT_RESULT:{{\"status\": \"success\", \"output_uri\": \"{INJECTED_NORMALIZED_URI}\"}}")
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_normalization()
