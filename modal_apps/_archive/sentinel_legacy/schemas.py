from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AlignExecutionScoreRequest(BaseModel):
    tenant_id: str
    project_id: str
    execution_score: Dict[str, Any]


class EvaluationRequest(BaseModel):
    tenant_id: str
    project_id: str
    node_id: str
    scope: str = "source"
    data_sample: List[Dict[str, Any]] = Field(default_factory=list)


class RuntimeEvaluationRequest(BaseModel):
    tenant_id: str
    project_id: str
    source_profiles: List[Dict[str, Any]] = Field(default_factory=list)
    previous_projection_registry: Optional[Dict[str, Any]] = None
    invalidated_sources: List[str] = Field(default_factory=list)
    query_specs: List[Dict[str, Any]] = Field(default_factory=list)
    ml_recommendations: List[Dict[str, Any]] = Field(default_factory=list)
    policy_state: Optional[Dict[str, Any]] = None
