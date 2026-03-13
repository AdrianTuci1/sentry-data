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
    print(f"Successfully uploaded payload to {s3_uri}")

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
    # PHASE 2: ML SENTIMENT ANALYSIS (LLM fills this in)
    #
    # INSTRUCTIONS FOR LLM:
    # 1. This is a MARKET SENTIMENT scenario. 
    # 2. Identify text columns (e.g., reviews, comments, feedback).
    # 3. Use `textblob` or `vaderSentiment` (both are installed) to calculate sentiment polarity/scores for the text.
    # 4. Calculate the average sentiment across the dataset.
    # 5. Print the `AGENT_DISCOVERY` JSON with the overall sentiment score.
    # 6. You do not necessarily need to save a machine learning model, but you must output a placeholder or summary artifact to `upload_to_r2`.
    # 
    # EXAMPLE:
    # -----------------------------------------------------------
    # from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    # 
    # text_col = 'customer_feedback'
    # df[text_col] = df[text_col].fillna("")
    # 
    # analyzer = SentimentIntensityAnalyzer()
    # df['sentiment_score'] = df[text_col].apply(lambda x: analyzer.polarity_scores(x)['compound'])
    # avg_sentiment = df['sentiment_score'].mean()
    # 
    # # Save results mapping to R2 (as a DataFrame or basic summary)
    # joblib.dump({"avg_sentiment": avg_sentiment}, '/tmp/model.pkl')
    # upload_to_r2('/tmp/model.pkl', model_output_uri)
    # 
    # print(f"AGENT_RESULT:{json.dumps({'status': 'success', 'model_uri': model_output_uri})}")
    # discovery_payload = {
    #     "type": "predictionModel", "id": "model_sentiment_0",
    #     "title": "Market Sentiment Analysis", "modelType": "sentiment",
    #     "performance": {"primaryMetric": "Average Sentiment", "value": avg_sentiment},
    #     "topFeatures": []
    # }
    # print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")
    # -----------------------------------------------------------
    # --- LLM END ---

    print("2. [Training] Executing Sentiment Analysis pipeline...")

    # Output your code here instead of the example above.
    
    print("Training process completed.")

if __name__ == '__main__':
    run_ml_training()
