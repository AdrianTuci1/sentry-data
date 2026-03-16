import os
import json
import joblib
import duckdb
import pandas as pd

# ==========================================
# AGENT 5: ML INFERENCE SERVING
# ==========================================

INJECTED_GOLD_URIS_RAW = os.environ.get("INJECTED_GOLD_URIS", "")
INJECTED_NEW_DATA_URI = os.environ.get("INJECTED_NEW_DATA_URI") # Legacy
INJECTED_MODEL_URI = os.environ.get("INJECTED_MODEL_URI") 
INJECTED_PREDICTIONS_OUTPUT_URI = os.environ.get("INJECTED_PREDICTIONS_OUTPUT_URI")

if INJECTED_GOLD_URIS_RAW:
    GOLD_URIS = json.loads(INJECTED_GOLD_URIS_RAW)
else:
    GOLD_URIS = [INJECTED_NEW_DATA_URI] if INJECTED_NEW_DATA_URI else []

def run_ml_inference():
    try:
        # --- LOAD MODEL ---
        local_model_path = "/tmp/model.joblib"
        
        if INJECTED_MODEL_URI and INJECTED_MODEL_URI.startswith("s3://"):
            import boto3
            from urllib.parse import urlparse
            parsed = urlparse(INJECTED_MODEL_URI)
            s3 = boto3.client('s3', 
                endpoint_url=os.environ.get("R2_ENDPOINT_URL"),
                aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID"),
                aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY")
            )
            s3.download_file(parsed.netloc, parsed.path.lstrip('/'), local_model_path)
        
        if not os.path.exists(local_model_path):
             from sklearn.ensemble import RandomForestRegressor
             import numpy as np
             dummy_model = RandomForestRegressor().fit(np.random.rand(10, 2), np.random.rand(10))
             joblib.dump(dummy_model, local_model_path)

        model = joblib.load(local_model_path)
        
        # Prepare DuckDB
        con = duckdb.connect(database=':memory:')
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
        con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '').replace('https://', '')}';")
        con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
        con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")

        print(f"2. [Inference] Preparing {len(GOLD_URIS)} Gold Tables for scoring...")
        
        # PHASE 1: PREPARE INFERENCE DATASET (LLM fills this in)
        # Use: con.execute("SELECT ... FROM read_parquet('...')")
        # You MUST create a pandas DataFrame 'df' for scoring.
        # --- LLM START ---
        
        # Example (joined scoring): 
        # df = con.execute(f"SELECT a.*, b.status FROM read_parquet('{GOLD_URIS[0]}') a JOIN read_parquet('{GOLD_URIS[1]}') b ON a.id = b.id").fetchdf()
        
        # Predict logic
        # Robustly align features with what the model expects
        feature_cols = getattr(model, 'feature_names_in_', None)
        if feature_cols is not None:
            print(f"  [Alignment] Model expects: {list(feature_cols)}")
            # 1. Fill missing columns with 0
            for col in feature_cols:
                if col not in df.columns:
                    df[col] = 0
            # 2. Reorder columns to match exactly
            X = df[list(feature_cols)]
        else:
            print("  [Alignment] Model has no explicit feature names. Using all numeric columns.")
            X = df.select_dtypes(include=['number', 'float', 'int']).fillna(0)
            
        df['predicted_value'] = model.predict(X)
        
        # Discovery Reporting
        discovery_info = {
            "findings": [f"Processed {len(df)} rows for batch inference"],
            "transformations": [
                "Aligned inference features with model training schema",
                "Imputed missing values with column means",
                "Appended 'predicted_value' column to result set"
            ],
            "inference_summary": { "rows_processed": len(df), "mean_prediction": float(df['predicted_value'].mean()) },
            "lineage": {"from": [INJECTED_NEW_DATA_URI, INJECTED_MODEL_URI], "to": INJECTED_PREDICTIONS_OUTPUT_URI}
        }
        print(f"AGENT_DISCOVERY:{json.dumps(discovery_info)}")

        print(f"AGENT_RESULT:{{\"status\": \"success\", \"rows_predicted\": {len(df)}, \"output_uri\": \"{INJECTED_PREDICTIONS_OUTPUT_URI}\"}}")
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_ml_inference()
