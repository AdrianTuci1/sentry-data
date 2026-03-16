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
    injected_uris_raw = os.environ.get("INJECTED_GOLD_URIS", "")
    injected_uri = os.environ.get("INJECTED_GOLD_URI", "")
    model_output_uri = os.environ.get("INJECTED_MODEL_OUTPUT_URI", "")

    if injected_uris_raw:
        gold_uris = json.loads(injected_uris_raw)
    else:
        gold_uris = [injected_uri] if injected_uri else []

    print(f"1. [Data Loading] Connecting to DuckDB and preparing {len(gold_uris)} Gold Tables...")
    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '').replace('https://', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")

    # PHASE 1: PREPARE DATASET (LLM fills this in)
    # Use: con.execute("SELECT ... FROM read_parquet('...')")
    # You MUST create a pandas DataFrame 'df' for training.
    # --- LLM START ---
    
    # Example (single source):
    # df = con.execute(f"SELECT * FROM read_parquet('{gold_uris[0]}')").fetchdf()
    
    # Example (multi-source join):
    # df = con.execute(f"SELECT a.*, b.feat FROM read_parquet('{gold_uris[0]}') a JOIN read_parquet('{gold_uris[1]}') b ON a.id = b.id").fetchdf()

    # -------------------------------------------------------------------------
    # PHASE 2: ML REGRESSION TRAINING (LLM fills this in)
    #
    # INSTRUCTIONS FOR LLM:
    # 1. This is a REGRESSION scenario. 
    # 2. Identify a continuous target variable (e.g., LTV, revenue).
    # 3. Clean and prepare 'df': handle missing values, encode categoricals.
    # 4. Train a Regression model using xgboost (XGBRegressor) or lightgbm (LGBMRegressor) for superior performance.
    # 5. Evaluate (RMSE, R2).
    # 6. Save the model locally (e.g., /tmp/model.pkl) and use `upload_to_r2` to upload it to `model_output_uri`.
    # 7. Print the `AGENT_DISCOVERY` JSON with performance metrics and top features.
    # 
    # EXAMPLE:
    # -----------------------------------------------------------
    # from xgboost import XGBRegressor
    # from sklearn.metrics import mean_squared_error
    # 
    # y = df['target_column']
    # X = df.drop(columns=['target_column'])
    # X = X.fillna(0) # Basic imputation
    # 
    # model = XGBRegressor()
    # model.fit(X, y)
    # rmse = mean_squared_error(y, model.predict(X), squared=False)
    # 
    # joblib.dump(model, '/tmp/model.pkl')
    # upload_to_r2('/tmp/model.pkl', model_output_uri)
    # 
    # print(f"AGENT_RESULT:{json.dumps({'status': 'success', 'model_uri': model_output_uri})}")
    # discovery_payload = {
    #     "type": "predictionModel", "id": "model_reg_0",
    #     "title": "Regression Model", "modelType": "regression",
    #     "performance": {"primaryMetric": "RMSE", "value": rmse},
    #     "topFeatures": ["feature_1", "feature_2"]
    # }
    # print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")
    # -----------------------------------------------------------
    # --- LLM END ---

    print("2. [Training] Executing regression pipeline...")

    # Output your code here instead of the example above.
    
    print("Training process completed.")

if __name__ == '__main__':
    run_ml_training()
