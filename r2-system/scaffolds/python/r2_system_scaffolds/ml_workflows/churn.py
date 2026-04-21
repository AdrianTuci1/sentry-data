SCAFFOLD = {
    "scaffold_id": "ml_workflows/churn.py",
    "task_type": "churn",
    "effective_task_type": "classification",
    "estimator": "random_forest_classifier",
    "description": "Churn-risk scaffold using supervised classification over retention and adoption signals.",
    "required_target": True,
    "target_hints": ["churn", "churned", "is_churned", "subscriber_churn", "account_closed"],
    "default_hyperparameters": {
        "n_estimators": 320,
        "random_state": 42,
        "class_weight": "balanced",
    },
    "allowed_modifications": [
        "featureColumns",
        "targetColumn",
        "testSize",
        "randomState",
        "n_estimators",
        "max_depth",
        "class_weight",
    ],
}
