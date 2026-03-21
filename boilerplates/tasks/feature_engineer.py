import os
import duckdb
import json
from datetime import datetime

# ==========================================
# AGENT 1.5: FEATURE ENGINEER (Silver → Gold)
# ==========================================
# Infrastructure & Context
tenant_id       = os.environ.get("tenantId", "unknown")
project_id      = os.environ.get("projectId", "unknown")
task_name       = os.environ.get("taskName", "FeatureEngineering_unknown")
r2_bucket       = os.environ.get("R2_BUCKET", "statsparrot-data")

# Extract source_id (e.g. Feature_Engineering_Olist_Products -> Olist_Products)
source_id       = task_name.replace("Feature_Engineering_", "") if "Feature_Engineering_" in task_name else "default"

def run_feature_engineering():
    # Path Inference (Zero-Injection)
    current_date    = datetime.now().strftime("%Y-%m-%d")
    normalized_glob = f"s3://{r2_bucket}/tenants/{tenant_id}/projects/{project_id}/silver/{source_id}/*/*.parquet"
    target_gold_uri = f"s3://{r2_bucket}/tenants/{tenant_id}/projects/{project_id}/gold/{source_id}/{current_date}/engineered.parquet"

    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCES_KEY_ID') or os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    con.execute("SET s3_use_ssl=true; SET s3_url_style='path';")

    try:
        print("\n1. Sovereign Discovery & Execution:")
        print("--- TASK_SPECIFIC_INSTRUCTIONS_START ---")
        print(f"A. ANALYZE SILVER: Read from {normalized_glob}.")
        print("B. FEATURE ENG: Create calculated columns, enrich data, and join if necessary.")
        print(f"C. SAVE TO GOLD: Write final engineered table to {target_gold_uri}.")
        print('D. REPORT DISCOVERY: Report the GOLD layer structure to the MindMap.')
        print(f'   AGENT_DISCOVERY:{{"adjustedData": [{{"id": "gold_table_{source_id}", "action_type_id": "act_{source_id}", "name": "Ecommerce > {source_id}", "title": "Engineered {source_id.replace("_", " ")}", "columns": [{{"id": "c_0", "name": "product_name", "type": "VARCHAR", "status": "ok", "title": "Product Name"}}]}}]}}')
        print("--- TASK_SPECIFIC_INSTRUCTIONS_END ---")

        # Discovery check
        try:
            res = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{normalized_glob}')").df()
            print(f"[Feature Engineer] Detected {len(res)} columns in Silver layer.")
        except Exception as e:
            print(f"[Feature Engineer] Warning: Input check failed: {e}")

        # Final result structure for the backend pipeline status
        result = {
            "sourceId": source_id,
            "success": True,
            "goldUri": target_gold_uri
        }
        print(f"AGENT_RESULT:{json.dumps(result)}")
        
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_feature_engineering()
