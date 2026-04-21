from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .ml_workflows import WORKFLOW_SCAFFOLDS


@dataclass(frozen=True)
class WorkflowSpec:
    scaffold_id: str
    task_type: str
    effective_task_type: str
    estimator: str
    description: str
    required_target: bool
    default_hyperparameters: Dict[str, Any] = field(default_factory=dict)
    target_hints: List[str] = field(default_factory=list)
    allowed_modifications: List[str] = field(default_factory=list)


WORKFLOW_SPECS: Dict[str, WorkflowSpec] = {
    name: WorkflowSpec(**spec)
    for name, spec in WORKFLOW_SCAFFOLDS.items()
}


def resolve_workflow(task_type: str, scaffold_id: Optional[str] = None) -> WorkflowSpec:
    if scaffold_id:
        for spec in WORKFLOW_SPECS.values():
            if spec.scaffold_id == scaffold_id:
                return spec

    normalized = (task_type or "").strip().lower().replace("_", "-")
    aliases = {
        "forecast": "forecasting",
        "timeseries": "forecasting",
        "time-series": "forecasting",
        "customer-churn": "churn",
        "churn-risk": "churn",
        "survival-analytics": "survival",
        "outlier": "anomaly",
        "anomaly-detection": "anomaly",
    }
    key = aliases.get(normalized, normalized)

    if key not in WORKFLOW_SPECS:
        raise ValueError(f"Unsupported ML workflow: {task_type}")
    return WORKFLOW_SPECS[key]


def workflow_summary() -> List[Dict[str, Any]]:
    return [
        {
            "taskType": spec.task_type,
            "scaffoldId": spec.scaffold_id,
            "effectiveTaskType": spec.effective_task_type,
            "estimator": spec.estimator,
            "requiredTarget": spec.required_target,
            "description": spec.description,
            "allowedModifications": spec.allowed_modifications,
        }
        for spec in WORKFLOW_SPECS.values()
    ]
