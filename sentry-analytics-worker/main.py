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
    
    print("[DuckDB] Configuring R2 Credentials...")
    con.execute(f"SET s3_region='{R2_REGION}';")
    con.execute(f"SET s3_endpoint='{clean_endpoint}';")
    con.execute(f"SET s3_access_key_id='{R2_ACCESS_KEY}';")
    con.execute(f"SET s3_secret_access_key='{R2_SECRET_KEY}';")
    con.execute("SET s3_url_style='path';")
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
        return {"status": "ok", "service": "analytics-worker-python", "db": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/execute", dependencies=[Depends(verify_internal_secret)])
def execute_queries(payload: ExecutePayload):
    print(f"[QueryController] Received execution request for Project: {payload.projectId}")
    
    results = []
    
    for q in payload.queries:
        try:
            # We fetch as a list of dictionaries (records) which maps nicely to JSON
            # DuckDB fetchdf() requires pandas, but we can just use fetchall() and descriptions
            cursor = con.execute(q.sqlString)
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
            
            data_dicts = [dict(zip(columns, row)) for row in rows]
            
            results.append({
                "widgetId": q.widgetId,
                "data": data_dicts,
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
