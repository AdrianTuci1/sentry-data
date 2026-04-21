SCAFFOLD = {
    "scaffold_id": "ml_workflows/clustering.py",
    "task_type": "clustering",
    "effective_task_type": "clustering",
    "estimator": "kmeans",
    "description": "Unsupervised clustering scaffold for segmentation and cohort discovery.",
    "required_target": False,
    "target_hints": [],
    "default_hyperparameters": {
        "n_clusters": 4,
        "n_init": 10,
        "random_state": 42,
    },
    "allowed_modifications": [
        "featureColumns",
        "n_clusters",
        "n_init",
        "randomState",
    ],
}
