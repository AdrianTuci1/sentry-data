import os
import duckdb
import json
import boto3
from urllib.parse import urlparse

from datetime import datetime

# ==========================================
# AGENT 4: ML ARCHITECT (Sovereign Mode)
# ==========================================
# Infrastructure & Context
tenant_id   = os.environ.get("tenantId", "unknown")
project_id  = os.environ.get("projectId", "unknown")
r2_bucket   = os.environ.get("R2_BUCKET", "statsparrot-data")

def run_ml_architecture():
    # Path Inference (Zero-Injection)
    current_date = datetime.now().strftime("%Y-%m-%d")
    MODEL_URI = f"s3://{r2_bucket}/tenants/{tenant_id}/projects/{project_id}/system/models/latest_model.joblib"
    mindmap_discovery_uri = f"s3://{r2_bucket}/tenants/{tenant_id}/projects/{project_id}/discovery/source_classification.json"
    print(f"0. [Sovereign] Pulling Mind Map from {mindmap_discovery_uri}...")
    
    # Gold Layer Inference (to find prediction targets)
    gold_prefix = f"tenants/{tenant_id}/projects/{project_id}/gold/"
    gold_uris = []
    try:
        s3 = boto3.client('s3', 
            endpoint_url=os.environ.get("R2_ENDPOINT_URL") or f"https://{os.environ.get('R2_ENDPOINT_CLEAN')}",
            aws_access_key_id=os.environ.get("R2_ACCES_KEY_ID") or os.environ.get("R2_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY"),
            region_name=os.environ.get("R2_REGION", "auto")
        )
        resp = s3.list_objects_v2(Bucket=r2_bucket, Prefix=gold_prefix)
        if 'Contents' in resp:
            gold_uris = [f"s3://{r2_bucket}/{obj['Key']}" for obj in resp['Contents'] if obj['Key'].endswith('.parquet')]
    except Exception as e:
        print(f"    Gold scan failed: {str(e)}")

    print("1. Connecting to memory DB and loading HTTPFS extension...")
    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCES_KEY_ID') or os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    con.execute("SET s3_use_ssl=true;")
    con.execute("SET s3_url_style='path';")

    try:
        # Instruction Phase
        print("\n2. [ML Strategy] Discovery & Instructions:")
        print("--- TASK_SPECIFIC_INSTRUCTIONS_START ---")
        print("A. ANALYZE ENTITIES: Look at the mindmap and Gold tables provided.")
        print("B. TARGET SELECTION: Identify which 'metric' or 'column' should be the target for prediction (e.g., probability_of_churn).")
        print("C. FEATURE SELECTION: Choose relevant features from the Gold layer.")
        print("D. IMPLEMENT: Write a script that trains a simple model (Sklearn/XGBoost) and saves it to 'MODEL_URI'.")
        print("E. STRATEGY: Report your architecture using AGENT_RESULT.")
        print("--- TASK_SPECIFIC_INSTRUCTIONS_END ---")

        # Example Strategy Output
        result_payload = {
            "status": "success",
            "target_variable": "target_col",
            "recommended_snippet": "classification",
            "strategic_reason": "Explanation of strategy",
            "features": ["feature_1", "feature_2"],
            "primary_join_key": "id"
        }
        print(f"AGENT_RESULT:{json.dumps(result_payload)}")
        
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_ml_architecture()
