import os
import duckdb
import json

# This template is designed to be modified by the AI Agent.
# Your goal is to write queries that analyze `DATA_URI`, extract useful aggregations, 
# and output them as a JSON list.

DATA_URI = "REPLACE_WITH_DATA_URI_VARIABLE" # The Agent Manager will instruct you about this URI

def run_profiling():
    con = duckdb.connect(database=':memory:')
    
    # 1. Inspect Schema (you might want to print this during testing)
    # schema_info = con.execute(f"DESCRIBE SELECT * FROM '{DATA_URI}'").fetchall()
    # print("SCHEMA:", schema_info)
    
    # 2. Add your queries here! Ensure the SQL strings are valid DuckDB SQL
    aggregations = [
        {
            # Example for widget ID 'bar-chart'
            "widgetId": "bar-chart",
            "sqlString": "SELECT category, COUNT(*) as value FROM '{DATA_URI}' GROUP BY category ORDER BY value DESC LIMIT 10"
        }
    ]
    
    # 3. Print the EXACT JSON to STDOUT prefixed with AGENT_RESULT:
    print(f"AGENT_RESULT:{json.dumps(aggregations)}")

if __name__ == '__main__':
    run_profiling()
