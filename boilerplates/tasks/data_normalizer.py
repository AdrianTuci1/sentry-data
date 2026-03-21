import os
import duckdb
import json
from datetime import datetime

# ==========================================
# AGENT 1: DATA NORMALIZER (Bronze → Silver)
# ==========================================
# Infrastructure & Context
tenant_id       = os.environ.get("tenantId", "unknown")
project_id      = os.environ.get("projectId", "unknown")
task_name       = os.environ.get("taskName", "Normalization_unknown")
r2_bucket       = os.environ.get("R2_BUCKET", "statsparrot-data")

# Extract source_id (e.g. Normalization_Shopify_Orders -> Shopify_Orders)
source_id       = task_name.replace("Normalization_", "") if "Normalization_" in task_name else "default"

# Path Inference (Zero-Injection)
current_date    = datetime.now().strftime("%Y-%m-%d")
RAW_GLOB        = f"s3://{r2_bucket}/tenants/{tenant_id}/projects/{project_id}/bronze/{source_id}/*/*.parquet"
NORMALIZED_URI  = f"s3://{r2_bucket}/tenants/{tenant_id}/projects/{project_id}/silver/{source_id}/{current_date}/normalized.parquet"

def run_normalization():
    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCES_KEY_ID') or os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    con.execute("SET s3_use_ssl=true;")
    con.execute("SET s3_url_style='path';")

    try:
        print("\n1. Discovery & Instructions:")
        print("--- TASK_SPECIFIC_INSTRUCTIONS_START ---")
        print("A. ANALYZE BRONZE: Use con.execute to analyze the 'RAW_GLOB' schema.")
        print("B. NORMALIZE: Cast columns for consistency (dates, currencies, IDs).")
        print("C. DE-DUPE: Remove duplicates based on primary keys if possible.")
        print("D. SAVE TO SILVER: Store as a single Parquet file at 'NORMALIZED_URI'.")
        print("E. DISCOVERY: Populate and print the AGENT_DISCOVERY JSON using the provided scaffolding at the bottom of this script.")
        print("--- TASK_SPECIFIC_INSTRUCTIONS_END ---")

        # ==========================================
        # AGENT SCAFFOLDING
        # ==========================================
        result = {
            "sourceId": source_id,
            "success": True,
            "silverUri": NORMALIZED_URI
        }
        
        discovery = {
            "connector": [{"id": f"conn_{source_id}", "name": source_id, "type": "ecommerce", "status": "ok"}],
            "actionType": [{"id": f"act_{source_id}", "connector_id": f"conn_{source_id}", "name": "Batch Ingestion", "status": "ok"}]
        }
        
        print(f"AGENT_RESULT:{json.dumps(result)}")
        print(f"AGENT_DISCOVERY:{json.dumps(discovery)}")
        
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_normalization()
