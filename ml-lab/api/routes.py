from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List

router = APIRouter()

class EvaluationRequest(BaseModel):
    tenant_id: str
    project_id: str
    node_id: str
    scope: str = "source"  # "source" for Local, "global" for Project-Level
    data_sample: List[Dict[str, Any]]

class GoalResponse(BaseModel):
    status: str
    confidence_score: float
    goals: List[str]
    should_invalidate: bool

@router.post("/evaluate_node", response_model=GoalResponse)
async def evaluate_node(request: EvaluationRequest):
    """
    Evaluates a specific DAG node for anomalies or drift.
    Returns goals and whether the node's cache should be invalidated.
    """
    import pandas as pd
    from agents.sentinel import SentinelAgent
    
    agent = SentinelAgent()
    df = pd.DataFrame(request.data_sample)
    
    result = agent.evaluate_node(
        tenant_id=request.tenant_id,
        project_id=request.project_id,
        node_id=request.node_id,
        data_sample=df,
        scope=request.scope
    )
    
    return {
        "status": result["status"],
        "confidence_score": result["confidence_score"],
        "goals": result["goals"],
        "should_invalidate": result.get("should_invalidate", False)
    }

@router.get("/health")
async def health_check():
    return {"status": "ok"}
