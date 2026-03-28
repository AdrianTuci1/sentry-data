import json
from typing import List, Dict, Any

class InsightCatalog:
    """
    Manages the knowledge graph of what insights can be generated from what data sources.
    Evaluates requirements top-down and discoveries bottom-up.
    """
    def __init__(self):
        # A mock catalog. In production, this would be a JSON/DB or ChromaDB collection.
        self.catalog = {
            "web_analytics": {
                "required_sources": ["google_analytics", "facebook_ads", "orders_db"],
                "insights": [
                    "Time on site",
                    "Bounce rate",
                    "Pages per session",
                    "ROAS (Return on Ad Spend)"
                ]
            },
            "saas_metrics": {
                "required_sources": ["stripe", "postgresql_users"],
                "insights": [
                    "Time to value",
                    "LTV:CAC ratio",
                    "Stickiness (DAU/MAU)",
                    "MRR Churn"
                ]
            },
            "cybersecurity": {
                "required_sources": ["vpc_flow_logs", "auth0"],
                "insights": [
                    "Anomalous Login Spikes",
                    "Exfiltration Risk Score",
                    "Privilege Escalation Paths"
                ]
            }
        }
    
    def evaluate_requirements(self, requested_insight: str, available_sources: List[str]) -> Dict[str, Any]:
        """
        Top-Down approach: 
        User wants X. Do we have the required sources?
        """
        for category, data in self.catalog.items():
            if requested_insight in data["insights"]:
                missing = [s for s in data["required_sources"] if s not in available_sources]
                if missing:
                    return {
                        "status": "missing_dependencies",
                        "message": f"To deliver '{requested_insight}', we need the following sources: {missing}. Please connect them in Stats Parrot.",
                        "confidence_score": 20.0,
                        "action": "prompt_user_connection"
                    }
                else:
                    return {
                        "status": "ready",
                        "message": f"Sources verified for '{requested_insight}'. Instructing agents to build the target...",
                        "confidence_score": 95.0,
                        "action": "inject_build_goal"
                    }
        
        return {"status": "unknown_insight", "confidence_score": 50.0}

    def discover_opportunities(self, detected_schema_context: str) -> Dict[str, Any]:
        """
        Bottom-Up approach:
        We found data that looks like 'SaaS'. What can we proactively generate?
        """
        # Match string roughly for this mock. The real system uses the LLM/Vector similarity.
        context_lower = detected_schema_context.lower()
        
        for category, data in self.catalog.items():
            if category.split('_')[0] in context_lower:
                return {
                    "status": "opportunity_found",
                    "category": category,
                    "proactive_insights": data["insights"],
                    "message": f"Detected {category} patterns. We can automatically generate: {', '.join(data['insights'])}.",
                    "action": "inject_discovery_goal"
                }
                
        return {"status": "no_opportunities", "proactive_insights": []}
