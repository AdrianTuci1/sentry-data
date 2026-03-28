import torch
from sentence_transformers import SentenceTransformer, util

class UniversalDataExplainer:
    """
    A Deep Learning Meta-Model using Sentence Transformers.
    Maps raw column names into semantic dimensions (Ontology).
    """
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = SentenceTransformer(model_name).to(self.device)
        
        # Define our Unified Sentry Ontology
        self.ontology = {
            "marketing_spend": ["spend", "cost", "budget", "ad_cost"],
            "conversion_metric": ["conversions", "orders", "sales", "signups"],
            "traffic_metric": ["page_views", "sessions", "visitors", "reach"],
            "financial_metric": ["revenue", "mrr", "churn", "aov"],
            "entity_id": ["user_id", "project_id", "pixel_id", "ad_id"],
            "temporal": ["timestamp", "date", "created_at"]
        }
        
        # Pre-calculate ontology embeddings
        self.ontology_embeddings = {}
        for role, keywords in self.ontology.items():
            combined_text = " ".join(keywords)
            self.ontology_embeddings[role] = self.model.encode(combined_text, convert_to_tensor=True)

    def explain_columns(self, column_names: list) -> dict:
        """
        Maps column names to roles in our ontology.
        """
        explanations = {}
        for col in column_names:
            col_emb = self.model.encode(col.replace("_", " "), convert_to_tensor=True)
            
            # Find closest role
            best_role = "unknown"
            max_sim = -1.0
            
            for role, role_emb in self.ontology_embeddings.items():
                sim = util.pytorch_cos_sim(col_emb, role_emb).item()
                if sim > max_sim:
                    max_sim = sim
                    best_role = role
            
            explanations[col] = {
                "inferred_role": best_role,
                "confidence": float(max_sim)
            }
            
        return {
            "explanations": explanations,
            "overall_match_score": sum(e["confidence"] for e in explanations.values()) / len(explanations) if explanations else 0
        }

if __name__ == "__main__":
    # Test column interpretation
    explainer = UniversalDataExplainer()
    test_cols = ["fb_spend_usd", "ga4_sessions", "shopify_orders", "customer_guid"]
    results = explainer.explain_columns(test_cols)
    import json
    print(json.dumps(results, indent=2))
