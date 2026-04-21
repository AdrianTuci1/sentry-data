from .anomaly import SCAFFOLD as ANOMALY
from .churn import SCAFFOLD as CHURN
from .classification import SCAFFOLD as CLASSIFICATION
from .clustering import SCAFFOLD as CLUSTERING
from .forecasting import SCAFFOLD as FORECASTING
from .regression import SCAFFOLD as REGRESSION
from .survival import SCAFFOLD as SURVIVAL


WORKFLOW_SCAFFOLDS = {
    "classification": CLASSIFICATION,
    "regression": REGRESSION,
    "clustering": CLUSTERING,
    "anomaly": ANOMALY,
    "churn": CHURN,
    "survival": SURVIVAL,
    "forecasting": FORECASTING,
}

__all__ = ["WORKFLOW_SCAFFOLDS"]
