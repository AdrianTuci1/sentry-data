SCAFFOLD = {
    "scaffold_id": "ml_workflows/classification.py",
    "task_type": "classification",
    "effective_task_type": "classification",
    "estimator": "random_forest_classifier",
    "description": "Supervised classification scaffold for labeled categorical outcomes.",
    "required_target": True,
    "target_hints": ["label", "class", "status", "converted", "won"],
    "default_hyperparameters": {
        "n_estimators": 240,
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
