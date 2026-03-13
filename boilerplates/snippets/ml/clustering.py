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
    # PHASE 2: ML CLUSTERING TRAINING (LLM fills this in)
    #
    # INSTRUCTIONS FOR LLM:
    # 1. This is an UNSUPERVISED CLUSTERING scenario (e.g. Customer Segmentation, RFM grouping). 
    # 2. Select numerical features that represent behavior or value.
    # 3. Clean and prepare 'df': handle missing values, scale the data (StandardScaler is critical).
    # 4. Train a Clustering model (e.g. KMeans, DBSCAN from scikit-learn).
    # 5. Evaluate using Silhouette Score or simply determine cluster sizes.
    # 6. Save the model locally and use `upload_to_r2` to upload it to `model_output_uri`.
    # 7. Print the `AGENT_DISCOVERY` JSON with performance metrics (e.g. Silhouette Score) and cluster characteristics.
    # 
    # EXAMPLE:
    # -----------------------------------------------------------
    # from sklearn.cluster import KMeans
    # from sklearn.preprocessing import StandardScaler
    # from sklearn.metrics import silhouette_score
    # 
    # X = df.select_dtypes(include=['number', 'float', 'int']).fillna(0)
    # scaler = StandardScaler()
    # X_scaled = scaler.fit_transform(X)
    # 
    # model = KMeans(n_clusters=4, random_state=42)
    # labels = model.fit_predict(X_scaled)
    # sil_score = silhouette_score(X_scaled, labels)
    # 
    # joblib.dump({"model": model, "scaler": scaler}, '/tmp/model.pkl')
    # upload_to_r2('/tmp/model.pkl', model_output_uri)
    # 
    # print(f"AGENT_RESULT:{json.dumps({'status': 'success', 'model_uri': model_output_uri})}")
    # discovery_payload = {
    #     "type": "predictionModel", "id": "model_cluster_0",
    #     "title": "Customer Segmentation Model", "modelType": "clustering",
    #     "performance": {"primaryMetric": "Silhouette Score", "value": sil_score},
    #     "topFeatures": list(X.columns[:3])
    # }
    # print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")
    # -----------------------------------------------------------
    # --- LLM END ---

    print("2. [Training] Executing Clustering pipeline...")

    # Output your code here instead of the example above.
    
    print("Training process completed.")

if __name__ == '__main__':
    run_ml_training()
