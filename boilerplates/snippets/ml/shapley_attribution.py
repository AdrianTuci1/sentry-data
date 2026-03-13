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
    # PHASE 2: ML SHAPLEY ATTRIBUTION (LLM fills this in)
    #
    # INSTRUCTIONS FOR LLM:
    # 1. This is a FEATURE EXPLAINABILITY (SHAP) scenario. 
    # 2. Identify the target variable and train a rapid Tree-based model (XGBoost/LightGBM).
    # 3. Use `shap` library (e.g. `shap.TreeExplainer`) to calculate SHAP values for the dataset.
    # 4. Extract the global feature importance rankings (mean absolute SHAP values per feature).
    # 5. Print the `AGENT_DISCOVERY` JSON detailing exactly how much each feature drives the model output.
    # 6. Save the explainer or base model locally and use `upload_to_r2` to upload it to `model_output_uri`.
    # 
    # EXAMPLE:
    # -----------------------------------------------------------
    # import shap
    # from xgboost import XGBRegressor
    # import numpy as np
    # 
    # y = df['target_column']
    # X = df.drop(columns=['target_column']).fillna(0)
    # 
    # model = XGBRegressor().fit(X, y)
    # explainer = shap.TreeExplainer(model)
    # shap_values = explainer.shap_values(X)
    # 
    # # Calculate global feature importance
    # feature_importance = np.abs(shap_values).mean(0)
    # importance_dict = dict(zip(X.columns, feature_importance))
    # sorted_importance = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)[:10]
    # 
    # joblib.dump(model, '/tmp/model.pkl')
    # upload_to_r2('/tmp/model.pkl', model_output_uri)
    # 
    # print(f"AGENT_RESULT:{json.dumps({'status': 'success', 'model_uri': model_output_uri})}")
    # discovery_payload = {
    #     "type": "predictionModel", "id": "model_shap_0",
    #     "title": "SHAP Feature Attribution", "modelType": "shapley_attribution",
    #     "performance": {"primaryMetric": "Top SHAP Feature", "value": sorted_importance[0][0]},
    #     "topFeatures": [f[0] for f in sorted_importance]
    # }
    # print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")
    # -----------------------------------------------------------
    # --- LLM END ---

    print("2. [Training] Executing SHAP Attribution pipeline...")

    # Output your code here instead of the example above.
    
    print("Training process completed.")

if __name__ == '__main__':
    run_ml_training()
