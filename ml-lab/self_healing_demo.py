import json
import pandas as pd
from datasets.generator import generate_failed_transformations
from models.anomaly_detector import UnsupervisedAnomalyDetector
from agents.llm_engine import GeminiFlashEngine

def demo_self_healing():
    print("🛠️  Starting Self-Healing Loop Demo...")
    
    # 1. Simulate a 'Bad' Transformation (Transformation Bug)
    # The generator injects a NULL/Zero spike and a Scale shift
    df = generate_failed_transformations(100)
    print("📊 Data Sample (with injected failures):")
    print(df.iloc[45:55]) # See the NULL spike
    
    # 2. ML Observation: Detect Technical Errors
    detector = UnsupervisedAnomalyDetector()
    tech_errors = detector.detect_technical_errors(df, ["mrr"])
    
    if tech_errors["has_technical_errors"]:
        print("\n🔍 ML Observation: Technical Errors detected!")
        print(json.dumps(tech_errors["errors"], indent=2))
        
        # 3. Sentinel AI: Align Agent Goal to 'Repair'
        engine = GeminiFlashEngine()
        corrective_goals = engine.generate_self_healing_goals(tech_errors)
        
        print("\n⚡ Sentinel AI generated SELF-HEALING Goals:")
        for i, goal in enumerate(corrective_goals, 1):
            print(f"{i}. {goal}")
    else:
        print("✅ No technical errors detected.")

if __name__ == "__main__":
    demo_self_healing()
