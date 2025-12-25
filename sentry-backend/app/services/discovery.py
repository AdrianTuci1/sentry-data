from typing import List, Optional
from pydantic import BaseModel
import duckdb
import json

from app.services.llm_factory import llm_client
from app.services.agent.prompts import DISCOVERY_PROMPT

class Proposal(BaseModel):
    id: str
    title: str
    description: str
    target_variable: Optional[str] = None
    problem_type: str  # classification, regression, clustering, forecasting

class DiscoveryService:
    def __init__(self):
        pass

    async def analyze_dataset(self, file_path: str) -> List[Proposal]:
        """
        Analyzes the dataset and returns a list of ML proposals using LLM.
        """
        # 1. Get Schema using DuckDB
        columns = []
        sample_data = []
        try:
            conn = duckdb.connect()
            # Assuming CSV for now, but could be parquet
            start_q = f"SELECT * FROM '{file_path}' LIMIT 5"
            df = conn.execute(start_q).df()
            columns = df.columns.tolist()
            sample_data = df.to_dict(orient="records")
        except Exception as e:
            # If fail to read, return error proposal
             return [
                Proposal(
                    id="error",
                    title="Error analyzing file",
                    description=f"Could not read file: {str(e)}",
                    problem_type="error"
                )
            ]

        # 2. LLM Proposal Generation
        prompt = DISCOVERY_PROMPT.format(columns=columns, sample_data=sample_data)
        
        try:
            # We expect a JSON list of proposals
            response_json = await llm_client.complete(prompt, "You are a Data Scientist.", json_mode=True)
            proposals_data = response_json.get("proposals", [])
            
            # If root is list
            if isinstance(response_json, list):
                proposals_data = response_json

            proposals = []
            for i, p in enumerate(proposals_data):
                # Ensure fields exist
                if "Title" in p: p["title"] = p.pop("Title")
                if "Description" in p: p["description"] = p.pop("Description")
                # ... mapping keys if LLM capitalized them
                
                proposals.append(Proposal(
                    id=f"p_{i}",
                    title=p.get("title", "Untitled"),
                    description=p.get("description", "No description"),
                    target_variable=p.get("target_variable") or p.get("Target Variable"),
                    problem_type=p.get("problem_type") or p.get("Problem Type") or "unknown"
                ))
            
            return proposals

        except Exception as e:
            return [Proposal(id="err_llm", title="LLM Error", description=str(e), problem_type="error")]
