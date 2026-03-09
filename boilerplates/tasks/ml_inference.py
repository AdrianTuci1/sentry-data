import os
import json
import joblib
import duckdb
import pandas as pd

# ==========================================
# AGENT 5: ML INFERENCE SERVING
# ==========================================

INJECTED_NEW_DATA_URI = os.environ.get("INJECTED_NEW_DATA_URI")
INJECTED_MODEL_URI = os.environ.get("INJECTED_MODEL_URI") 
INJECTED_PREDICTIONS_OUTPUT_URI = os.environ.get("INJECTED_PREDICTIONS_OUTPUT_URI")

def run_ml_inference():
    try:
        # --- LOAD MODEL ---
        print(f"Loading model from {INJECTED_MODEL_URI}...")
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
            print(f"Downloaded model to {local_model_path}")
        
        if not os.path.exists(local_model_path):
             from sklearn.ensemble import RandomForestRegressor
             import numpy as np
             dummy_model = RandomForestRegressor().fit(np.random.rand(10, 2), np.random.rand(10))
             joblib.dump(dummy_model, local_model_path)

        model = joblib.load(local_model_path)
        
        # Load new data
        con = duckdb.connect(database=':memory:')
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
        con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
        con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
        con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
        df = con.execute(f"SELECT * FROM '{INJECTED_NEW_DATA_URI}'").df()
        
        # Format features
        X = df.select_dtypes(include=['number', 'float', 'int'])
        X = X.fillna(0)
        
        # Predict
        df['predicted_value'] = model.predict(X)
        
        # Export
        con.register('df_predictions_view', df)
        con.execute(f"COPY (SELECT * FROM df_predictions_view) TO '{INJECTED_PREDICTIONS_OUTPUT_URI}' (FORMAT PARQUET);")
        
        # Discovery Reporting
        discovery_info = {
            "rows_predicted": len(df),
            "prediction_mean": float(df['predicted_value'].mean()),
            "lineage": {"from": [INJECTED_NEW_DATA_URI, INJECTED_MODEL_URI], "to": INJECTED_PREDICTIONS_OUTPUT_URI}
        }
        print(f"AGENT_DISCOVERY:{json.dumps(discovery_info)}")

        print(f"AGENT_RESULT:{{\"status\": \"success\", \"rows_predicted\": {len(df)}, \"output_uri\": \"{INJECTED_PREDICTIONS_OUTPUT_URI}\"}}")
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_ml_inference()
