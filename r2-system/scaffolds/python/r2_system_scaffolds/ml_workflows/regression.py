SCAFFOLD = {
    "scaffold_id": "ml_workflows/regression.py",
    "task_type": "regression",
    "effective_task_type": "regression",
    "estimator": "random_forest_regressor",
    "description": "Supervised regression scaffold for continuous business metrics.",
    "required_target": True,
    "target_hints": ["revenue", "cost", "mrr", "arr", "margin", "usage", "score"],
    "default_hyperparameters": {
        "n_estimators": 320,
        "random_state": 42,
    },
    "allowed_modifications": [
        "featureColumns",
        "targetColumn",
        "testSize",
        "randomState",
        "n_estimators",
        "max_depth",
    ],
}
