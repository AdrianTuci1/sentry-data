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
    # PHASE 2: ML FORECASTING TRAINING (LLM fills this in)
    #
    # INSTRUCTIONS FOR LLM:
    # 1. This is a TIME-SERIES FORECASTING scenario (e.g. Sales Prediction, Demand Forecasting). 
    # 2. Identify the date/time column and the numerical target variable.
    # 3. Clean and prepare 'df': sort by date, handle missing daily values using interpolation or forward-fill.
    # 4. Extract time-based features: day of week, month, rolling averages, lags.
    # 5. Train a Forecasting model. Since `xgboost` and `lightgbm` are available, framing it as a supervised regression task using lags is highly recommended over ARIMA.
    # 6. Evaluate using TimeSeriesSplit (or simply train on past, validate on most recent). Metric: MAE or MAPE.
    # 7. Save the model locally and use `upload_to_r2` to upload it to `model_output_uri`.
    # 8. Print the `AGENT_DISCOVERY` JSON with performance metrics and top lag/time features.
    # 
    # EXAMPLE:
    # -----------------------------------------------------------
    # from xgboost import XGBRegressor
    # from sklearn.metrics import mean_absolute_error
    # 
    # # df is already sorted by date 
    # df['lag_1'] = df['target_metric'].shift(1)
    # df = df.dropna()
    # 
    # train = df.iloc[:-30]
    # test = df.iloc[-30:]
    # 
    # X_train, y_train = train[['lag_1']], train['target_metric']
    # X_test, y_test = test[['lag_1']], test['target_metric']
    # 
    # model = XGBRegressor()
    # model.fit(X_train, y_train)
    # mae = mean_absolute_error(y_test, model.predict(X_test))
    # 
    # joblib.dump(model, '/tmp/model.pkl')
    # upload_to_r2('/tmp/model.pkl', model_output_uri)
    # 
    # print(f"AGENT_RESULT:{json.dumps({'status': 'success', 'model_uri': model_output_uri})}")
    # discovery_payload = {
    #     "type": "predictionModel", "id": "model_forecast_0",
    #     "title": "Sales Forecasting Model", "modelType": "forecasting",
    #     "performance": {"primaryMetric": "MAE", "value": mae},
    #     "topFeatures": ["lag_1"]
    # }
    # print(f"AGENT_DISCOVERY:{json.dumps(discovery_payload)}")
    # -----------------------------------------------------------
    # --- LLM END ---

    print("2. [Training] Executing Forecasting pipeline...")

    # Output your code here instead of the example above.
    
    print("Training process completed.")

if __name__ == '__main__':
    run_ml_training()
