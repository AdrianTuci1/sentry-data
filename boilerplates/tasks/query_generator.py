import os
import duckdb
import json

# ==========================================
# AGENT 3: SQL QUERY GENERATOR (FRONTEND/ANALYTICS)
# ==========================================
# This template is modified by the AI Agent.
# Your goal: 
# 1. Look at the Gold Layer Table (INJECTED_GOLD_URI) schema.
# 2. Look at the visual `frontend-widget-manifest.yml` specification rules.
# 3. Create the exact DuckDB Queries that provide the data shapes required by the UI.
# 4. Output a JSON list of {"widgetId": "", "sqlString": ""} pairs.

INJECTED_GOLD_URI = os.environ.get("INJECTED_GOLD_URI")

def run_query_generation():
    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    
    # Example agent observation setup (you should run DESCRIBE in the ReAct loop to see columns)
    
    # You MUST replace this list with queries that match the exact data structure 
    # expected by Sentry's frontend widgets! 
    # Example: 'animated-line' needs 'value', 'unit', 'dataPoints' (array).
    queries = [
        {
            "widgetId": "animated-line-visitors",
            "sqlString": f"SELECT 100 as value, 'visitors' as unit, [10, 20, 30] as dataPoints FROM '{INJECTED_GOLD_URI}' LIMIT 1"
        }
    ]
    
    try:
        # Before finalizing, test your queries to ensure they run successfully!
        for q in queries:
            con.execute(q['sqlString']).fetchall()
            
        # Discovery Reporting: Widgets
        discovery_info = {
            "generated_widgets": [q['widgetId'] for q in queries],
            "lineage": {"from": INJECTED_GOLD_URI, "to": "frontend_widgets"}
        }
        print(f"AGENT_DISCOVERY:{json.dumps(discovery_info)}")

        print(f"AGENT_RESULT:{json.dumps(queries)}")
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_query_generation()
