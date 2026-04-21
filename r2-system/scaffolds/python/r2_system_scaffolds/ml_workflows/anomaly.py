SCAFFOLD = {
    "scaffold_id": "ml_workflows/anomaly.py",
    "task_type": "anomaly",
    "effective_task_type": "anomaly",
    "estimator": "isolation_forest",
    "description": "Unsupervised anomaly detection scaffold for drift, risk, and outlier streams.",
    "required_target": False,
    "target_hints": [],
    "default_hyperparameters": {
        "contamination": 0.05,
        "random_state": 42,
    },
    "allowed_modifications": [
        "featureColumns",
        "contamination",
        "randomState",
    ],
}
