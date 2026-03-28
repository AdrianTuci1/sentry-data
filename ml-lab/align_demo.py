import json
from agents.llm_engine import GeminiFlashEngine

def demo_goal_alignment():
    engine = GeminiFlashEngine()
    
    # 1. Load the Gold Manifest (simulated)
    with open("gold_manifest.json", "r") as f:
        gold_manifest = json.load(f)
        
    # 2. Simulated ML Insight (High Drift detected in Meta Spend)
    drift_insight = {
        "drift_probability": 0.85,
        "status": "drift_detected",
        "using_ai": True
    }
    
    # 3. Align Goals
    print("🎯 Sentinel AI is aligning agent goals...")
    aligned_goals = engine.align_agent_goals(gold_manifest, drift_insight)
    
    print("\n✅ Final Aligned Goals for Worker Agents:")
    for i, goal in enumerate(aligned_goals, 1):
        print(f"{i}. {goal}")

if __name__ == "__main__":
    demo_goal_alignment()
