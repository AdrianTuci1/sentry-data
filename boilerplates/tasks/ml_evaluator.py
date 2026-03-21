import os
import duckdb
import json
import boto3
from sklearn.metrics import mean_squared_error

# ==========================================
# AGENT 6: ML EVALUATOR & DRIFT DETECTION
# ==========================================
# Infrastructure & Context
tenant_id       = os.environ.get("tenantId", "unknown")
project_id      = os.environ.get("projectId", "unknown")
r2_bucket       = os.environ.get("R2_BUCKET", "statsparrot-data")
ERROR_THRESHOLD = float(os.environ.get("ERROR_THRESHOLD", 0.5))

def run_ml_evaluation():
    # Path Inference (Zero-Injection)
    gold_prefix = f"tenants/{tenant_id}/projects/{project_id}/gold/"
    
    predictions_uri = ""
    actuals_uri = ""

    print(f"0. [Sovereign] Scanning Gold Layer in {gold_prefix} for evaluation datasets...")
    try:
        s3 = boto3.client('s3', 
            endpoint_url=os.environ.get("R2_ENDPOINT_URL") or f"https://{os.environ.get('R2_ENDPOINT_CLEAN')}",
            aws_access_key_id=os.environ.get("R2_ACCES_KEY_ID") or os.environ.get("R2_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY"),
            region_name=os.environ.get("R2_REGION", "auto")
        )
        resp = s3.list_objects_v2(Bucket=r2_bucket, Prefix=gold_prefix)
        if 'Contents' in resp:
            keys = [obj['Key'] for obj in resp['Contents'] if obj['Key'].endswith('.parquet')]
            # Heuristic: predictions usually contain '/predictions' or 'ml_'
            pred_keys = [k for k in keys if '/predictions' in k.lower() or '/ml_' in k.lower()]
            actual_keys = [k for k in keys if k not in pred_keys]
            
            if pred_keys: predictions_uri = f"s3://{r2_bucket}/{pred_keys[-1]}" # latest prediction
            if actual_keys: actuals_uri = f"s3://{r2_bucket}/{actual_keys[0]}" # first actual
    except Exception as e:
        print(f"    Scanning failed: {str(e)}")

    if not predictions_uri or not actuals_uri:
        print(f"AGENT_RESULT:{{\"status\": \"skipped\", \"reason\": \"Missing datasets (Preds: {bool(predictions_uri)}, Actuals: {bool(actuals_uri)})\"}}")
        return

    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCES_KEY_ID') or os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    con.execute("SET s3_use_ssl=true;")
    con.execute("SET s3_url_style='path';")

    try:
        print("\n2. [ML Evaluation & Training] Instructions:")
        print("--- TASK_SPECIFIC_INSTRUCTIONS_START ---")
        print("A. DRIFT: Evaluate MSE. If no actuals exist, assume needs_retraining=True.")
        print(f"B. TRAINING: If needs_retraining=True, train a model using Gold features and save it using joblib to s3://{r2_bucket}/tenants/{tenant_id}/projects/{project_id}/system/models/active_model.pkl.")
        print("C. METADATA: You MUST output BOTH AGENT_RESULT (status) and AGENT_DISCOVERY (model metadata) in the prints below.")
        print("--- TASK_SPECIFIC_INSTRUCTIONS_END ---")

        print(f"\nEvaluating Model Drift (Threshold: {ERROR_THRESHOLD})...")
        print(f"  ➤ Predictions: {predictions_uri}")
        print(f"  ➤ Actuals: {actuals_uri}")

        # Join predictions to actuals
        join_query = f"""
            SELECT 
                p.*,
                a.actual_target_value as actual_value
            FROM read_parquet('{predictions_uri}') p
            JOIN read_parquet('{actuals_uri}') a ON p.date = a.date AND p.entity_id = a.entity_id
        """
        
        df = con.execute(join_query).df()
        
        if len(df) == 0:
            print("AGENT_RESULT:{\"status\": \"skipped\", \"reason\": \"No actuals overlap yet\"}")
            return
            
        # Assuming the predicted column in the Parquet is 'predicted_value'
        # This is where the Agent usually iterates and fixes the column name if it fails
        pred_col = 'predicted_value' if 'predicted_value' in df.columns else df.columns[0]
        mse = mean_squared_error(df['actual_value'], df[pred_col])
        
        needs_retraining = mse > ERROR_THRESHOLD
            
        print(f"AGENT_RESULT:{{\"status\": \"success\", \"mse\": {mse}, \"trigger_retraining\": {str(needs_retraining).lower()}}}")
        
        discovery = {
            "id": f"model_{project_id}",
            "title": f"Predictive Model for {project_id}",
            "target": "actual_target_value",
            "features": [],
            "accuracy_estimate": 1.0 - min(mse, 1.0)
        }
        print(f"AGENT_DISCOVERY:{json.dumps(discovery)}")
        
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_ml_evaluation()
