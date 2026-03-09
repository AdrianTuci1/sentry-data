import os
import duckdb
import json
from sklearn.metrics import mean_squared_error, mean_absolute_error

# ==========================================
# AGENT 6: ML EVALUATOR & DRIFT DETECTION
# ==========================================
# This template runs on a cron job.
# It compares the history of predictions (made by Agent 5) against the ACTUAL ground-truth
# that just arrived in the Gold Table (Agent 2).
# Goal: 
# 1. Join `predicted_value` vs `actual_value` on common Entity IDs/Dates.
# 2. Calculate Drift or Error (MSE).
# 3. If Threshold exceeded, trigger retraining.

INJECTED_PREDICTIONS_URI = "REPLACE_WITH_PREDICTIONS_URI"
INJECTED_ACTUALS_URI = "REPLACE_WITH_ACTUALS_URI" 
ERROR_THRESHOLD_MSE = "REPLACE_WITH_THRESHOLD_NUMBER"

def evaluate_model():
    con = duckdb.connect(database=':memory:')
    
    try:
        # The agent must write the SQL to join predictions to freshly arrived actuals
        join_query = f"""
            SELECT 
                p.predicted_value,
                a.actual_target_value as actual_value
            FROM '{INJECTED_PREDICTIONS_URI}' p
            JOIN '{INJECTED_ACTUALS_URI}' a ON p.date = a.date AND p.entity_id = a.entity_id
        """
        
        df = con.execute(join_query).df()
        
        if len(df) == 0:
            print("AGENT_RESULT:{\"status\": \"skipped\", \"reason\": \"No actuals overlap yet\"}")
            return
            
        mse = mean_squared_error(df['actual_value'], df['predicted_value'])
        
        needs_retraining = False
        if mse > float(ERROR_THRESHOLD_MSE):
            needs_retraining = True
            
        print(f"AGENT_RESULT:{{\"status\": \"success\", \"mse\": {mse}, \"trigger_retraining\": {str(needs_retraining).lower()}}}")
        
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    evaluate_model()
