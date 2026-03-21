import os
import duckdb
import json
from datetime import datetime
import boto3

# ==========================================
# AGENT 5: ML INFERENCE ENGINE
# ==========================================
# Infrastructure & Context
tenant_id   = os.environ.get("tenantId", "unknown")
project_id  = os.environ.get("projectId", "unknown")
r2_bucket   = os.environ.get("R2_BUCKET", "statsparrot-data")

def run_ml_inference():
    # Path Inference (Zero-Injection)
    current_date    = datetime.now().strftime("%Y-%m-%d")
    model_name      = "predictive_model" 
    predictions_uri = f"s3://{r2_bucket}/tenants/{tenant_id}/projects/{project_id}/gold/{model_name}/{current_date}/predictions.parquet"
    
    # Scan Gold layer for input features
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

    print("1. [Inference] Loading input tables from Gold layer...")
    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCES_KEY_ID') or os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    con.execute("SET s3_use_ssl=true;")
    con.execute("SET s3_url_style='path';")

    try:
        # Discovery Phase Instructions for LLM
        print("\n2. [Inference Strategy] Discovery & Instructions:")
        print("--- TASK_SPECIFIC_INSTRUCTIONS_START ---")
        print("A. LOAD FEATURES: Load relevant tables from the Gold layer.")
        print(f"B. LOAD MODEL: Pull the trained model from s3://{r2_bucket}/tenants/{tenant_id}/projects/{project_id}/system/models/active_model.pkl (NOT silver).")
        print("C. RUN PREDICTIONS: Apply the model to fresh features.")
        print(f"D. SAVE RESULTS: Store predictions into Gold Layer at {predictions_uri}.")
        print("E. DISCOVERY: Report your inference results using AGENT_DISCOVERY.")
        print("--- TASK_SPECIFIC_INSTRUCTIONS_END ---")

        # Example Success Output
        result = {
            "predictions": [
                {
                    "id": f"preds_{project_id}",
                    "title": "Model Predictions",
                    "path": predictions_uri
                }
            ]
        }
        print(f"AGENT_DISCOVERY:{json.dumps(result)}")
        
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_ml_inference()
