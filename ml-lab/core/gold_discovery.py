import json
import os
import pandas as pd
from models.data_explainer import UniversalDataExplainer

class GoldDiscoveryEngine:
    """
    Automates the selection of Gold metrics from Silver data.
    The goal is to simplify the user experience by auto-suggesting 
    which features are actual KPIs vs noise.
    """
    def __init__(self):
        self.explainer = UniversalDataExplainer()
        
    def discover_gold_metrics(self, df: pd.DataFrame, top_k: int = 5) -> dict:
        """
        Analyzes columns and returns a manifest of selected Gold metrics.
        """
        columns = [c for c in df.columns if c != "timestamp"]
        explanations = self.explainer.explain_columns(columns)["explanations"]
        
        scores = {}
        for col in columns:
            role_info = explanations.get(col, {})
            role = role_info.get("inferred_role", "unknown")
            confidence = role_info.get("confidence", 0.5)
            
            # 1. Base Utility Score from Ontology
            utility = 0.0
            if role in ["financial_metric", "conversion_metric"]:
                utility = 1.0
            elif role in ["marketing_spend", "traffic_metric"]:
                utility = 0.8
            elif role == "temporal":
                utility = 0.0 # Skip temporal columns as KPIs
                
            # 2. Informational Value (Variance)
            # Standardize variance to [0, 1]
            try:
                variance = df[col].std() / (df[col].mean() + 1e-6)
                informational_bonus = min(variance, 0.2)
            except:
                informational_bonus = 0
                
            scores[col] = (utility * confidence) + informational_bonus
            
        # Select Top K
        sorted_metrics = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        gold_metrics = [m[0] for m in sorted_metrics[:top_k]]
        
        manifest = {
            "version": "1.0",
            "gold_layer": {
                "selected_metrics": gold_metrics,
                "all_scores": scores,
                "ontology_mapping": explanations
            },
            "status": "ready_for_dashboard"
        }
        
        return manifest

if __name__ == "__main__":
    # Test discovery with unified data
    from core.data_loader import MultiSourceDataLoader
    from datasets.generator import generate_ga4_data, generate_marketing_data, generate_ecommerce_data
    
    loader = MultiSourceDataLoader()
    loader.load_source("ga4", generate_ga4_data(100))
    loader.load_source("meta", generate_marketing_data(100, "meta"))
    loader.load_source("ecommerce", generate_ecommerce_data(100))
    
    df = loader.get_unified_metrics()
    
    engine = GoldDiscoveryEngine()
    manifest = engine.discover_gold_metrics(df)
    
    print("\n✨ Auto-Discovered Gold Metrics:")
    print(json.dumps(manifest["gold_layer"]["selected_metrics"], indent=2))
    
    with open("gold_manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)
