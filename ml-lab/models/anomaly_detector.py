import pandas as pd
from pyod.models.iforest import IForest
from typing import Dict, Any

class UnsupervisedAnomalyDetector:
    def __init__(self, contamination: float = 0.05):
        self.model = IForest(contamination=contamination, random_state=42)
        
    def fit_predict(self, df: pd.DataFrame, feature_cols: list) -> Dict[str, Any]:
        """
        Fits Isolation Forest on the dataset and returns anomaly indices.
        """
        X = df[feature_cols].fillna(0)
        self.model.fit(X)
        
        preds = self.model.predict(X)
        scores = self.model.decision_function(X) # Higher score -> more anomalous
        
        anomaly_count = sum(preds)
        anomaly_ratio = anomaly_count / len(df)
        
        is_drift_detected = anomaly_ratio > self.model.contamination * 1.5
        
        return {
            "is_drift_detected": bool(is_drift_detected),
            "anomaly_ratio": float(anomaly_ratio),
            "max_anomaly_score": float(max(scores)),
            "message": f"Detected {anomaly_count} anomalies. Drift: {is_drift_detected}"
        }
    def detect_technical_errors(self, df: pd.DataFrame, feature_cols: list) -> Dict[str, Any]:
        """
        Specialized check for 'usual transformation problems' like NULL spikes or scaling errors.
        """
        results = {}
        for col in feature_cols:
            # 1. Zero/Null Spike Check
            zero_ratio = (df[col] == 0).sum() / len(df)
            null_ratio = df[col].isna().sum() / len(df)
            
            # 2. Scale Shift Check (Relative to history)
            mean_val = df[col].mean()
            std_val = df[col].std()
            
            is_technical_anomaly = False
            reason = None
            
            if zero_ratio > 0.5 or null_ratio > 0.5:
                is_technical_anomaly = True
                reason = f"Transformation Error: Spike in zeros/nulls ({zero_ratio*100:.1f}%)"
            elif std_val > 0 and mean_val < (std_val / 10.0): # Heuristic for scale drop
                is_technical_anomaly = True
                reason = "Transformation Error: Potential Scale/Unit mismatch detected."
                
            if is_technical_anomaly:
                results[col] = {
                    "is_anomaly": True,
                    "type": "technical_transformation_error",
                    "reason": reason
                }
                
        return {
            "has_technical_errors": len(results) > 0,
            "errors": results
        }
