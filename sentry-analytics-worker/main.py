import os
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import duckdb
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

app = FastAPI(title="Sentry Analytics Worker")

INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "secret")
R2_ENDPOINT = os.getenv("R2_ENDPOINT", "")
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_REGION = os.getenv("R2_REGION", "auto")

# -------------------------------------------------------------
# Global DuckDB Connection Setup
# -------------------------------------------------------------
print("[DuckDB] Initializing new native In-Memory Database...")
con = duckdb.connect(':memory:')
execution_submissions: Dict[str, Dict[str, Any]] = {}

def setup_duckdb():
    print("[DuckDB] Loading HTTPFS extension...")
    try:
        con.execute("INSTALL httpfs;")
    except Exception:
        pass  # Already installed
    con.execute("LOAD httpfs;")
    
    # Clean the endpoint domain if necessary (e.g. remove https://)
    clean_endpoint = R2_ENDPOINT.replace("https://", "")
    
    print(f"[DuckDB] Configuring R2 Credentials...")
    print(f"         Endpoint: {clean_endpoint}")
    mask = lambda s: f"{s[:4]}...{s[-4:]}" if len(s) > 8 else "****"
    print(f"         Access Key: {mask(R2_ACCESS_KEY)}")
    
    con.execute("SET s3_use_ssl=true;")
    con.execute("SET s3_region='auto';")
    con.execute(f"SET s3_endpoint='{clean_endpoint}';")
    con.execute(f"SET s3_access_key_id='{R2_ACCESS_KEY}';")
    con.execute(f"SET s3_secret_access_key='{R2_SECRET_KEY}';")
    con.execute("SET s3_url_style='path';")
    # con.execute("SET s3_use_v2_auth=true;") # R2 supports both, path style often needs true
    
    print("[DuckDB] Setup Complete.")

setup_duckdb()

# -------------------------------------------------------------
# Types & Validation Models
# -------------------------------------------------------------
class QueryItem(BaseModel):
    widgetId: str
    sqlString: str

class ExecutePayload(BaseModel):
    tenantId: str
    projectId: str
    queries: List[QueryItem]


class ExecutionSubmitPayload(BaseModel):
    tenantId: str
    projectId: str
    requestId: str
    provider: Optional[str] = None
    executionPlan: Dict[str, Any]
    executionScoreUri: str
    namespace: Optional[str] = None
    cluster: Optional[str] = None
    queue: Optional[str] = None

# -------------------------------------------------------------
# Middleware
# -------------------------------------------------------------
def verify_internal_secret(x_internal_secret: Optional[str] = Header(None)):
    if not x_internal_secret or x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized. Invalid internal secret.")
    return True


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sanitize_job_name(value: str) -> str:
    safe = ''.join(ch if ch.isalnum() else '-' for ch in value.lower())
    collapsed = '-'.join(part for part in safe.split('-') if part)
    return collapsed[:48] or 'parrot-job'


def build_ray_manifest(payload: ExecutionSubmitPayload) -> Dict[str, Any]:
    plan = payload.executionPlan
    resources = plan.get("resources", {})
    scheduler = plan.get("scheduler", {})
    driver_cpu = max(int(resources.get("driver_cpu", 1)), 1)
    driver_memory = max(int(resources.get("driver_memory_gb", 4)), 1)
    worker_cpu = max(int(resources.get("worker_cpu", 2)), 1)
    worker_memory = max(int(resources.get("worker_memory_gb", 8)), 1)
    min_workers = max(int(resources.get("min_workers", 1)), 1)
    max_workers = max(int(resources.get("max_workers", min_workers)), min_workers)
    job_name = f"parrot-{sanitize_job_name(payload.requestId)}"
    queue = payload.queue or scheduler.get("queue") or "parrot-default"
    namespace = payload.namespace or scheduler.get("namespace") or "statsparrot"

    return {
        "apiVersion": "ray.io/v1",
        "kind": "RayJob",
        "metadata": {
            "name": job_name,
            "namespace": namespace,
            "labels": {
                "statsparrot/request-id": payload.requestId,
                "statsparrot/project-id": payload.projectId,
                "statsparrot/queue": queue
            }
        },
        "spec": {
            "entrypoint": "python -m parrot_runtime.execute",
            "shutdownAfterJobFinishes": False,
            "ttlSecondsAfterFinished": 3600,
            "runtimeEnvYAML": "\n".join([
                "env_vars:",
                f"  PARROT_REQUEST_ID: {payload.requestId}",
                f"  PARROT_EXECUTION_SCORE_URI: {payload.executionScoreUri}",
                f"  PARROT_PROJECT_ID: {payload.projectId}",
                f"  PARROT_TENANT_ID: {payload.tenantId}",
            ]),
            "rayClusterSpec": {
                "headGroupSpec": {
                    "serviceType": "ClusterIP",
                    "rayStartParams": {
                        "dashboard-host": "0.0.0.0"
                    },
                    "template": {
                        "spec": {
                            "containers": [
                                {
                                    "name": "ray-head",
                                    "image": "statsparrot/ray-daft:latest",
                                    "resources": {
                                        "requests": {
                                            "cpu": str(driver_cpu),
                                            "memory": f"{driver_memory}Gi"
                                        },
                                        "limits": {
                                            "cpu": str(driver_cpu),
                                            "memory": f"{driver_memory}Gi"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                },
                "workerGroupSpecs": [
                    {
                        "groupName": "parrot-workers",
                        "replicas": min_workers,
                        "minReplicas": min_workers,
                        "maxReplicas": max_workers,
                        "template": {
                            "spec": {
                                "containers": [
                                    {
                                        "name": "ray-worker",
                                        "image": "statsparrot/ray-daft:latest",
                                        "resources": {
                                            "requests": {
                                                "cpu": str(worker_cpu),
                                                "memory": f"{worker_memory}Gi"
                                            },
                                            "limits": {
                                                "cpu": str(worker_cpu),
                                                "memory": f"{worker_memory}Gi"
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ]
            }
        }
    }


def build_modal_descriptor(payload: ExecutionSubmitPayload) -> Dict[str, Any]:
    plan = payload.executionPlan
    resources = plan.get("resources", {})

    return {
        "app": "statsparrot-parrot-runtime",
        "function": "execute_parrot_plan",
        "image": "statsparrot/modal-runtime:latest",
        "entrypoint": "python -m parrot_runtime.execute",
        "scaled_workers": {
            "min": max(int(resources.get("min_workers", 1)), 1),
            "max": max(int(resources.get("max_workers", 1)), 1)
        },
        "resources": {
            "cpu": max(int(resources.get("worker_cpu", 2)), 1),
            "memory_gb": max(int(resources.get("worker_memory_gb", 8)), 1)
        },
        "env": {
            "PARROT_REQUEST_ID": payload.requestId,
            "PARROT_EXECUTION_SCORE_URI": payload.executionScoreUri,
            "PARROT_PROJECT_ID": payload.projectId,
            "PARROT_TENANT_ID": payload.tenantId
        }
    }


def build_execution_submission(payload: ExecutionSubmitPayload) -> Dict[str, Any]:
    plan = payload.executionPlan
    engine = plan.get("engine", "modal")
    provider = payload.provider or engine
    submission_id = f"{engine}-{payload.requestId}"
    submitted_at = iso_now()
    status_url = f"/execution/submissions/{submission_id}"

    if engine == "ray_daft":
        control_payload = {
            "scheduler": {
                "platform": "kubernetes",
                "namespace": payload.namespace or plan.get("scheduler", {}).get("namespace"),
                "cluster": payload.cluster or plan.get("scheduler", {}).get("cluster"),
                "queue": payload.queue or plan.get("scheduler", {}).get("queue")
            },
            "ray_job": build_ray_manifest(payload),
            "daft_runtime": {
                "runner": "ray",
                "shuffle": "distributed",
                "parallelism": max(int(plan.get("estimated_gold_views", 1)), int(plan.get("source_count", 1)) * 2),
                "target_latency_ms": plan.get("target_latency_ms", 45000)
            }
        }
        message = "Ray/Daft execution plan submitted to the Python control plane."
    else:
        control_payload = {
            "scheduler": {
                "platform": "modal",
                "queue": payload.queue or plan.get("scheduler", {}).get("queue") or "modal-default"
            },
            "modal_job": build_modal_descriptor(payload)
        }
        message = "Modal execution plan submitted to the Python control plane."

    submission = {
        "submission_id": submission_id,
        "request_id": payload.requestId,
        "engine": engine,
        "provider": provider,
        "status": "submitted",
        "submitted_at": submitted_at,
        "message": message,
        "status_url": status_url,
        "response": control_payload
    }
    execution_submissions[submission_id] = submission
    return submission

# -------------------------------------------------------------
# Routes
# -------------------------------------------------------------
@app.get("/health")
def health_check():
    try:
        # Simple test query
        res = con.execute("SELECT 1 as is_alive").fetchall()
        
        # Check R2 config (masking keys)
        mask = lambda s: f"{s[:4]}...{s[-4:]}" if len(s) > 8 else "****"
        config_status = {
            "endpoint": R2_ENDPOINT,
            "access_key": mask(R2_ACCESS_KEY),
            "region": R2_REGION,
            "duckdb_version": duckdb.__version__
        }
        
        return {
            "status": "ok", 
            "service": "analytics-worker-python", 
            "db": res,
            "config": config_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/execute", dependencies=[Depends(verify_internal_secret)])
def execute_queries(payload: ExecutePayload):
    print(f"[QueryController] Received execution request for Project: {payload.projectId}")
    
    results = []
    
    import time
    for q in payload.queries:
        try:
            start_time = time.time()
            print(f"[DuckDB] Executing widget {q.widgetId}...")
            print(f"         SQL: {q.sqlString}")
            
            # We fetch as a list of dictionaries (records) which maps nicely to JSON
            cursor = con.execute(q.sqlString)
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
            latency = (time.time() - start_time) * 1000
            
            data_dicts = [dict(zip(columns, row)) for row in rows]
            print(f"[DuckDB] Success: {len(data_dicts)} rows in {latency:.2f}ms")
            
            results.append({
                "widgetId": q.widgetId,
                "data": data_dicts,
                "latency_ms": latency,
                "error": None
            })
        except Exception as e:
            print(f"[DuckDB] Error executing widget {q.widgetId}: {e}")
            results.append({
                "widgetId": q.widgetId,
                "data": None,
                "error": str(e)
            })
            
    return {
        "tenantId": payload.tenantId,
        "projectId": payload.projectId,
        "results": results
    }


@app.post("/execution/submit", dependencies=[Depends(verify_internal_secret)])
def submit_execution(payload: ExecutionSubmitPayload):
    print(f"[ExecutionControl] Received {payload.executionPlan.get('engine', 'modal')} plan for request {payload.requestId}")
    return build_execution_submission(payload)


@app.get("/execution/submissions/{submission_id}", dependencies=[Depends(verify_internal_secret)])
def get_execution_submission(submission_id: str):
    submission = execution_submissions.get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Execution submission not found.")

    return submission

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("WORKER_PORT", "4000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
