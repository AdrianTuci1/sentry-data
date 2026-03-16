import os
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import duckdb
from dotenv import load_dotenv

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

# -------------------------------------------------------------
# Middleware
# -------------------------------------------------------------
def verify_internal_secret(x_internal_secret: Optional[str] = Header(None)):
    if not x_internal_secret or x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized. Invalid internal secret.")
    return True

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("WORKER_PORT", "4000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
