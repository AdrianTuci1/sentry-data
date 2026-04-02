import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import duckdb
import joblib
import modal
import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest, RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error, r2_score, silhouette_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "secret")
MODEL_ROOT = Path("/models")

image = (
    modal.Image.debian_slim()
    .pip_install(
        "fastapi[standard]",
        "pydantic",
        "duckdb",
        "daft",
        "pandas",
        "pyarrow",
        "scikit-learn",
        "joblib",
    )
    .run_commands(
        "python -c \"import duckdb; con = duckdb.connect(); con.execute('INSTALL httpfs;'); print('httpfs pre-installed OK')\""
    )
)

volume = modal.Volume.from_name("statsparrot-ml-models", create_if_missing=True)

app = modal.App("statsparrot-ml-executor")
web_app = FastAPI(title="StatsParrot ML Executor")


class TrainRequest(BaseModel):
    tenantId: str
    projectId: str
    requestId: str
    datasetUri: str
    taskType: Literal["classification", "regression", "clustering", "anomaly"]
    targetColumn: Optional[str] = None
    featureColumns: List[str] = Field(default_factory=list)
    modelName: Optional[str] = None
    testSize: float = 0.2
    randomState: int = 42
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)


class EvaluateRequest(BaseModel):
    tenantId: str
    projectId: str
    modelId: str
    datasetUri: str
    targetColumn: Optional[str] = None
    featureColumns: List[str] = Field(default_factory=list)


class InferRequest(BaseModel):
    tenantId: str
    projectId: str
    modelId: str
    records: List[Dict[str, Any]] = Field(default_factory=list)
    datasetUri: Optional[str] = None
    featureColumns: List[str] = Field(default_factory=list)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def verify_internal_secret(x_internal_secret: Optional[str]) -> None:
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized. Invalid internal secret.")


def model_dir(tenant_id: str, project_id: str) -> Path:
    path = MODEL_ROOT / tenant_id / project_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def configure_duckdb(con: duckdb.DuckDBPyConnection) -> None:
    r2_endpoint = os.getenv("R2_ENDPOINT", "")
    r2_access_key = os.getenv("R2_ACCESS_KEY_ID", "")
    r2_secret_key = os.getenv("R2_SECRET_ACCESS_KEY", "")

    if not r2_endpoint:
        return

    clean_endpoint = r2_endpoint.replace("https://", "").replace("http://", "")
    con.execute("LOAD httpfs;")
    con.execute("SET s3_use_ssl=true;")
    con.execute("SET s3_region='auto';")
    con.execute(f"SET s3_endpoint='{clean_endpoint}';")
    con.execute(f"SET s3_access_key_id='{r2_access_key}';")
    con.execute(f"SET s3_secret_access_key='{r2_secret_key}';")
    con.execute("SET s3_url_style='path';")


def load_dataset(dataset_uri: str) -> pd.DataFrame:
    con = duckdb.connect(":memory:")
    configure_duckdb(con)
    escaped_uri = dataset_uri.replace("'", "''")
    query = f"SELECT * FROM read_parquet('{escaped_uri}')"
    return con.execute(query).fetchdf()


def infer_feature_columns(df: pd.DataFrame, target_column: Optional[str], requested: List[str]) -> List[str]:
    if requested:
        return [column for column in requested if column in df.columns]

    numeric = [column for column in df.select_dtypes(include=["number", "bool"]).columns.tolist() if column != target_column]
    if numeric:
        return numeric

    fallback = [column for column in df.columns if column != target_column]
    return fallback[:12]


def build_estimator(task_type: str, hyperparameters: Dict[str, Any]) -> Any:
    if task_type == "classification":
        if hyperparameters.get("estimator") == "random_forest":
            return RandomForestClassifier(
                n_estimators=int(hyperparameters.get("n_estimators", 200)),
                random_state=int(hyperparameters.get("random_state", 42)),
            )
        return LogisticRegression(max_iter=int(hyperparameters.get("max_iter", 1000)))

    if task_type == "regression":
        return RandomForestRegressor(
            n_estimators=int(hyperparameters.get("n_estimators", 300)),
            random_state=int(hyperparameters.get("random_state", 42)),
        )

    if task_type == "clustering":
        return KMeans(
            n_clusters=int(hyperparameters.get("n_clusters", 4)),
            random_state=int(hyperparameters.get("random_state", 42)),
            n_init=int(hyperparameters.get("n_init", 10)),
        )

    if task_type == "anomaly":
        return IsolationForest(
            contamination=float(hyperparameters.get("contamination", 0.05)),
            random_state=int(hyperparameters.get("random_state", 42)),
        )

    raise HTTPException(status_code=400, detail=f"Unsupported task type: {task_type}")


def train_model(request: TrainRequest) -> Dict[str, Any]:
    df = load_dataset(request.datasetUri)
    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty.")

    feature_columns = infer_feature_columns(df, request.targetColumn, request.featureColumns)
    if not feature_columns:
        raise HTTPException(status_code=400, detail="No usable feature columns were detected.")

    task_type = request.taskType
    estimator = build_estimator(task_type, request.hyperparameters)
    model_id = request.modelName or f"ml-{task_type}-{uuid.uuid4().hex[:12]}"
    created_at = now_iso()

    if task_type in {"classification", "regression"}:
        if not request.targetColumn or request.targetColumn not in df.columns:
            raise HTTPException(status_code=400, detail="A valid targetColumn is required for supervised training.")

        training_df = df[feature_columns + [request.targetColumn]].dropna()
        if training_df.empty:
            raise HTTPException(status_code=400, detail="No rows remain after dropping nulls for supervised training.")

        X = training_df[feature_columns]
        y = training_df[request.targetColumn]
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=request.testSize,
            random_state=request.randomState,
        )

        pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("estimator", estimator),
        ])
        pipeline.fit(X_train, y_train)
        predictions = pipeline.predict(X_test)

        if task_type == "classification":
            metrics = {
                "accuracy": float(accuracy_score(y_test, predictions)),
                "f1_weighted": float(f1_score(y_test, predictions, average="weighted", zero_division=0)),
            }
        else:
            metrics = {
                "rmse": float(mean_squared_error(y_test, predictions, squared=False)),
                "mae": float(mean_absolute_error(y_test, predictions)),
                "r2": float(r2_score(y_test, predictions)),
            }

        fitted_model = pipeline
        training_summary = {
            "rows_used": int(len(training_df)),
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
        }
    else:
        training_df = df[feature_columns].dropna()
        if training_df.empty:
            raise HTTPException(status_code=400, detail="No rows remain after dropping nulls for unsupervised training.")

        fitted_model = Pipeline([
            ("scaler", StandardScaler()),
            ("estimator", estimator),
        ])
        fitted_model.fit(training_df)

        metrics: Dict[str, Any] = {}
        if task_type == "clustering":
            labels = fitted_model.predict(training_df)
            cluster_count = len(set(labels.tolist()))
            metrics["cluster_count"] = int(cluster_count)
            if cluster_count > 1 and len(training_df) > cluster_count:
                transformed = fitted_model.named_steps["scaler"].transform(training_df)
                metrics["silhouette"] = float(silhouette_score(transformed, labels))
        else:
            labels = fitted_model.predict(training_df)
            anomaly_ratio = float((labels == -1).sum() / max(len(labels), 1))
            metrics["anomaly_ratio"] = anomaly_ratio

        training_summary = {
            "rows_used": int(len(training_df)),
            "train_rows": int(len(training_df)),
            "test_rows": 0,
        }

    directory = model_dir(request.tenantId, request.projectId)
    model_path = directory / f"{model_id}.joblib"
    metadata_path = directory / f"{model_id}.json"

    metadata = {
        "model_id": model_id,
        "tenant_id": request.tenantId,
        "project_id": request.projectId,
        "request_id": request.requestId,
        "task_type": task_type,
        "target_column": request.targetColumn,
        "feature_columns": feature_columns,
        "dataset_uri": request.datasetUri,
        "metrics": metrics,
        "created_at": created_at,
        "training_summary": training_summary,
        "engine_used": "duckdb_local",
        "daft_ready": True,
    }

    joblib.dump(fitted_model, model_path)
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    volume.commit()

    return {
        "status": "trained",
        "model_id": model_id,
        "model_uri": str(model_path),
        "metadata_uri": str(metadata_path),
        "metrics": metrics,
        "feature_columns": feature_columns,
        "task_type": task_type,
        "engine_used": "duckdb_local",
        "daft_ready": True,
    }


def load_model_and_metadata(tenant_id: str, project_id: str, model_id: str) -> tuple[Any, Dict[str, Any]]:
    volume.reload()
    directory = model_dir(tenant_id, project_id)
    model_path = directory / f"{model_id}.joblib"
    metadata_path = directory / f"{model_id}.json"

    if not model_path.exists() or not metadata_path.exists():
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found.")

    model = joblib.load(model_path)
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    return model, metadata


def evaluate_model(request: EvaluateRequest) -> Dict[str, Any]:
    model, metadata = load_model_and_metadata(request.tenantId, request.projectId, request.modelId)
    df = load_dataset(request.datasetUri)
    feature_columns = infer_feature_columns(df, request.targetColumn or metadata.get("target_column"), request.featureColumns or metadata.get("feature_columns", []))
    task_type = metadata["task_type"]

    if task_type in {"classification", "regression"}:
        target_column = request.targetColumn or metadata.get("target_column")
        if not target_column or target_column not in df.columns:
            raise HTTPException(status_code=400, detail="Evaluation requires a valid target column.")
        evaluation_df = df[feature_columns + [target_column]].dropna()
        if evaluation_df.empty:
            raise HTTPException(status_code=400, detail="No rows remain after dropping nulls for evaluation.")
        X = evaluation_df[feature_columns]
        y = evaluation_df[target_column]
        predictions = model.predict(X)

        if task_type == "classification":
            metrics = {
                "accuracy": float(accuracy_score(y, predictions)),
                "f1_weighted": float(f1_score(y, predictions, average="weighted", zero_division=0)),
            }
        else:
            metrics = {
                "rmse": float(mean_squared_error(y, predictions, squared=False)),
                "mae": float(mean_absolute_error(y, predictions)),
                "r2": float(r2_score(y, predictions)),
            }
    else:
        evaluation_df = df[feature_columns].dropna()
        if evaluation_df.empty:
            raise HTTPException(status_code=400, detail="No rows remain after dropping nulls for evaluation.")
        predictions = model.predict(evaluation_df)
        if task_type == "clustering":
            cluster_count = len(set(predictions.tolist()))
            metrics = {"cluster_count": int(cluster_count)}
        else:
            metrics = {"anomaly_ratio": float((predictions == -1).sum() / max(len(predictions), 1))}

    return {
        "status": "evaluated",
        "model_id": request.modelId,
        "task_type": task_type,
        "feature_columns": feature_columns,
        "metrics": metrics,
        "training_metrics": metadata.get("metrics", {}),
    }


def infer_with_model(request: InferRequest) -> Dict[str, Any]:
    model, metadata = load_model_and_metadata(request.tenantId, request.projectId, request.modelId)

    if request.datasetUri:
        df = load_dataset(request.datasetUri)
    else:
        if not request.records:
            raise HTTPException(status_code=400, detail="Provide either datasetUri or records for inference.")
        df = pd.DataFrame(request.records)

    feature_columns = infer_feature_columns(df, metadata.get("target_column"), request.featureColumns or metadata.get("feature_columns", []))
    inference_df = df[feature_columns].dropna()
    if inference_df.empty:
        raise HTTPException(status_code=400, detail="No rows remain after dropping nulls for inference.")

    predictions = model.predict(inference_df)
    output_records = inference_df.copy()
    output_records["prediction"] = predictions

    return {
        "status": "completed",
        "model_id": request.modelId,
        "task_type": metadata["task_type"],
        "feature_columns": feature_columns,
        "predictions": output_records.head(200).to_dict(orient="records"),
        "row_count": int(len(output_records)),
    }


@web_app.post("/api/v1/ml/train")
def train(request: TrainRequest, x_internal_secret: Optional[str] = Header(None)):
    verify_internal_secret(x_internal_secret)
    return train_model(request)


@web_app.post("/api/v1/ml/evaluate")
def evaluate(request: EvaluateRequest, x_internal_secret: Optional[str] = Header(None)):
    verify_internal_secret(x_internal_secret)
    return evaluate_model(request)


@web_app.post("/api/v1/ml/infer")
def infer(request: InferRequest, x_internal_secret: Optional[str] = Header(None)):
    verify_internal_secret(x_internal_secret)
    return infer_with_model(request)


@web_app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "statsparrot-ml-executor",
        "volume": "statsparrot-ml-models",
        "engines": ["duckdb_local", "daft_ready"],
    }


@app.function(image=image, volumes={"/models": volume}, timeout=1800, cpu=4.0, memory=8192)
@modal.asgi_app()
def fastapi_app():
    return web_app


@app.local_entrypoint()
def main():
    print("StatsParrot ML Executor is ready.")
    print("Deploy: modal deploy modal_ml_executor.py")
    print("Serve:  modal serve modal_ml_executor.py")
