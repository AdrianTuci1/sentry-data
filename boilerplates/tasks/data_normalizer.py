import os
import duckdb
import json

# ==========================================
# AGENT 1: DISCOVERY & NORMALIZATION
# ==========================================

INJECTED_RAW_URI = os.environ.get("INJECTED_RAW_URI") 
INJECTED_NORMALIZED_URI = os.environ.get("INJECTED_NORMALIZED_URI")

def run_normalization():
    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    safe_columns = []
    dropped_columns = []
    
    try:
        # Discovery Step
        schema = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{INJECTED_RAW_URI}')").fetchall()
        
        # Exclude complex nested types
        for i, col in enumerate(schema):
            col_name, col_type = col[0], col[1]
            if not col_type.startswith('STRUCT') and not col_type.startswith('LIST'):
                safe_columns.append(f'"{col_name}"')
            else:
                dropped_columns.append(col_name)
                
        cols_str = ", ".join(safe_columns) if safe_columns else "*"
        
        # Discovery Reporting (Frontend Compatibility)
        discovery_info = {
            "type": "tables",
            "id": "normalization_0",
            "title": "Normalized Source",
            "source": { "id": "s_raw", "name": "Raw Source", "type": "parquet" },
            "lineage": { "action": "Normalization", "type": "transform" },
            "findings": [f"Discovered {len(schema)} columns in raw source"],
            "transformations": [
                f"Kept {len(safe_columns)} simple columns",
                f"Dropped {len(dropped_columns)} complex nested columns" if dropped_columns else "No complex columns found"
            ]
        }
        print(f"AGENT_DISCOVERY:{json.dumps(discovery_info)}")
        
        # EXECUTION: Create Silver Table
        normalization_query = f"""
            COPY (
                SELECT {cols_str} FROM read_parquet('{INJECTED_RAW_URI}')
            ) TO '{INJECTED_NORMALIZED_URI}' (FORMAT PARQUET);
        """
        con.execute(normalization_query)
        
        print(f"AGENT_RESULT:{{\"status\": \"success\", \"output_uri\": \"{INJECTED_NORMALIZED_URI}\"}}")
        
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_normalization()
