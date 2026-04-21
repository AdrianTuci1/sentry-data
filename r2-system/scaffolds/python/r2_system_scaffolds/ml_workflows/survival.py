SCAFFOLD = {
    "scaffold_id": "ml_workflows/survival.py",
    "task_type": "survival",
    "effective_task_type": "regression",
    "estimator": "random_forest_regressor",
    "description": "Survival analytics scaffold for duration or time-to-event risk scoring.",
    "required_target": True,
    "target_hints": ["duration", "tenure", "time_to_event", "days_until_churn", "survival_days"],
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
