SCAFFOLD = {
    "scaffold_id": "ml_workflows/forecasting.py",
    "task_type": "forecasting",
    "effective_task_type": "regression",
    "estimator": "random_forest_regressor",
    "description": "Forecasting scaffold for timestamped metrics, using supervised regression over lag-ready features.",
    "required_target": True,
    "target_hints": ["forecast", "revenue", "demand", "mrr", "usage", "volume", "sessions"],
    "default_hyperparameters": {
        "n_estimators": 360,
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
