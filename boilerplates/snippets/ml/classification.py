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
    # PHASE 2: ML CLASSIFICATION TRAINING (LLM fills this in)
    #
    # INSTRUCTIONS FOR LLM:
    # 1. This is a CLASSIFICATION scenario. 
    # 2. Identify a binary or multi-class target variable (e.g., is_churned).
    # 3. Clean and prepare 'df': handle missing values, encode categoricals, check for imbalance.
    # 4. Train a Classification model using xgboost (XGBClassifier) or lightgbm (LGBMClassifier) for superior performance.
    # 5. Evaluate (AUC-ROC, F1-score).
    # 6. Save the model locally (e.g., /tmp/model.pkl) and use `upload_to_r2` to upload it to `model_output_uri`.
    # 7. Print the `AGENT_DISCOVERY` JSON with performance metrics and top features (e.g. from model.feature_importances_).
    # 
    # EXAMPLE:
    # -----------------------------------------------------------
    # from xgboost import XGBClassifier
    # from sklearn.metrics import roc_auc_score
    # 
    # y = df['is_churned']
    # X = df.drop(columns=['is_churned'])
    # X = X.fillna(0) # Basic imputation
    # 
    # model = XGBClassifier(scale_pos_weight=1.0)
    # model.fit(X, y)
    # auc = roc_auc_score(y, model.predict_proba(X)[:, 1])
    # 
    # joblib.dump(model, '/tmp/model.pkl')
    # upload_to_r2('/tmp/model.pkl', model_output_uri)
    # 
    # print(f"AGENT_RESULT:{json.dumps({'status': 'success', 'model_uri': model_output_uri})}")
    # discovery_payload = {
    #     "type": "predictionModel", "id": "model_clf_0",
    #     "title": "Churn Classification Model", "modelType": "classification",
    #     "performance": {"primaryMetric": "AUC", "value": auc},
    #     "topFeatures": ["feature_1", "feature_2"]
    # }
    # print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")
    # -----------------------------------------------------------
    # --- LLM END ---

    print("2. [Training] Executing classification pipeline...")

    # Output your code here instead of the example above.
    
    print("Training process completed.")

if __name__ == '__main__':
    run_ml_training()
