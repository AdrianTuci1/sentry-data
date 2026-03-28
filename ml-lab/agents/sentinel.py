import logging
from typing import List, Dict, Any
from models.anomaly_detector import UnsupervisedAnomalyDetector
from models.predictive_drift import RNNDriftPredictor
from models.data_explainer import UniversalDataExplainer
from vector_store.client import VectorStoreClient
from core.config import settings
from agents.llm_engine import GeminiFlashEngine
from agents.insight_catalog import InsightCatalog

logger = logging.getLogger(__name__)

class SentinelAgent:
    """
    The orchestrator of the ML capabilities.
    Evaluates data and context, and decides if DAG nodes need invalidation.
    Injects goals for the generator agents.
    """
    def __init__(self):
        self.anomaly_detector = UnsupervisedAnomalyDetector(contamination=settings.ANOMALY_THRESHOLD)
        self.drift_predictor = RNNDriftPredictor()
        self.data_explainer = UniversalDataExplainer()
        self.vector_store = VectorStoreClient(persist_dir=settings.CHROMA_PERSIST_DIRECTORY)
        self.llm_engine = GeminiFlashEngine()
        self.catalog = InsightCatalog()
        self.rl_reward_state = 0.0 # Will be fetched from DynamoDB later
        
    def evaluate_node(self, tenant_id: str, project_id: str, node_id: str, data_sample: pd.DataFrame, scope: str = "source") -> Dict[str, Any]:
        """
        Runs the full Sentinel evaluation pipeline on a node's data sample or global combination.
        """
        # 1. Profile Data types to find numeric columns
        numeric_cols = data_sample.select_dtypes(include=['float64', 'int64']).columns.tolist()
        
        # 2. Anomaly Detection (Only for Local Source Scope, skipped for Global)
        anomaly_results = {"status": "skipped", "anomaly_ratio": 0.0}
        drift_results = {"status": "skipped", "drift_probability": 0.0}
        
        if scope == "source":
            if len(numeric_cols) > 0 and len(data_sample) > 50:
                anomaly_results = self.anomaly_detector.fit_predict(data_sample, numeric_cols)
                
            # 3. Simulate RNN predicting on a single numeric column if time-series
            if len(numeric_cols) > 0:
                # We just take the first numeric col's recent values as simulation
                recent_vals = data_sample[numeric_cols[0]].tail(20).tolist()
                drift_results = self.drift_predictor.evaluate_sequence(recent_vals)
            
        # 4. Confidence Score Calculation
        base_confidence = 100.0
        base_confidence -= (anomaly_results.get("anomaly_ratio", 0.0) * 100)
        base_confidence -= (drift_results.get("drift_probability", 0.0) * 20)
        
        confidence_score = max(0.0, min(100.0, base_confidence))
        
        # 5. RL Goal Injection Rules via Gemini & Catalog
        should_invalidate = anomaly_results.get("is_drift_detected", False) or drift_results.get("status") == "drift_detected"
        
        # Identify context using LLM Core
        raw_schema_dump = " ".join(numeric_cols) + (" mrr subscription global" if "mrr" in numeric_cols else "")
        if scope == "global":
            raw_schema_dump += " MULTI_SOURCE_COMBINED"
        
        domain = self.llm_engine.analyze_schema_context(raw_schema_dump)
        
        # Catalog Discovery (Bottom-Up)
        discovery = self.catalog.discover_opportunities(domain)
        agents_goals = self.llm_engine.generate_agent_instructions(discovery, self.rl_reward_state)
        
        goals = agents_goals.copy() if scope == "global" else []
        
        if anomaly_results.get("is_drift_detected"):
            goals.append(f"Hard anomaly drift detected. Implement tighter thresholds on columns: {numeric_cols}.")
        if drift_results.get("status") == "drift_detected":
            goals.append(f"Predictive series drift. Re-calculate sliding windows to avoid trailing.")
            
        return {
            "status": "evaluated",
            "confidence_score": round(confidence_score, 2),
            "should_invalidate": should_invalidate,
            "goals": goals,
            "reinforcement_learning": {
                "inferred_domain": domain,
                "discovery": discovery
            },
            "details": {
                "anomaly": anomaly_results,
                "drift": drift_results
            }
        }
