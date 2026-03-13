import os
import json
import duckdb
import pandas as pd
import joblib
import boto3
from urllib.parse import urlparse

def upload_to_r2(local_path: str, s3_uri: str):
    parsed = urlparse(s3_uri)
    bucket = parsed.netloc
    key = parsed.path.lstrip('/')
    s3 = boto3.client(
        's3',
        endpoint_url=os.environ.get("R2_ENDPOINT_URL", ""),
        aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID", ""),
        aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY", ""),
        region_name=os.environ.get("R2_REGION", "auto"),
    )
    s3.upload_file(local_path, bucket, key)
    print(f"Successfully uploaded model to {s3_uri}")

def run_ml_training():
    gold_uri = os.environ.get("INJECTED_GOLD_URI", "")
    model_output_uri = os.environ.get("INJECTED_MODEL_OUTPUT_URI", "")

    print("1. [Data Loading] Connecting to DuckDB and loading Gold Layer...")
    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '').replace('https://', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")

    try:
        df = con.execute(f"SELECT * FROM read_parquet('{gold_uri}')").fetchdf()
        print(f"Loaded {len(df)} rows and {len(df.columns)} columns.")
    except Exception as e:
        print(f"AGENT_ERROR: Failed to load data: {str(e)}")
        return

    # -------------------------------------------------------------------------
    # PHASE 2: ML SURVIVAL ANALYTICS TRAINING (LLM fills this in)
    #
    # INSTRUCTIONS FOR LLM:
    # 1. This is a SURVIVAL ANALYTICS scenario (time-to-event). 
    # 2. Identify 'duration' and 'event_observed' (censoring) columns.
    # 3. Clean and prepare 'df'. You can use `lifelines` if available, or structure as regression/classification on time windows.
    # 4. Train the model (e.g. CoxPHFitter).
    # 5. Evaluate (Concordance Index / c-index).
    # 6. Save the model locally (e.g., /tmp/model.pkl) and use `upload_to_r2` to upload it to `model_output_uri`.
    # 7. Print the `AGENT_DISCOVERY` JSON with performance metrics and top hazard features.
    # 
    # EXAMPLE:
    # -----------------------------------------------------------
    # from lifelines import CoxPHFitter
    # 
    # df = df.fillna(0) # Basic imputation
    # 
    # cph = CoxPHFitter()
    # cph.fit(df, duration_col='T', event_col='E')
    # c_index = cph.concordance_index_
    # 
    # joblib.dump(cph, '/tmp/model.pkl')
    # upload_to_r2('/tmp/model.pkl', model_output_uri)
    # 
    # print(f"AGENT_RESULT:{json.dumps({'status': 'success', 'model_uri': model_output_uri})}")
    # discovery_payload = {
    #     "type": "predictionModel", "id": "model_surv_0",
    #     "title": "Time-to-Churn Survival Model", "modelType": "survival",
    #     "performance": {"primaryMetric": "c-index", "value": c_index},
    #     "topFeatures": ["feature_1", "feature_2"]
    # }
    # print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")
    # -----------------------------------------------------------
    # --- LLM END ---

    print("2. [Training] Executing survival pipeline...")

    # Output your code here instead of the example above.
    
    print("Training process completed.")

if __name__ == '__main__':
    run_ml_training()
