from pathlib import Path

import modal

BASE_DIR = Path(__file__).resolve().parent

image = modal.Image.debian_slim().pip_install(
    "torch==2.1.1",
    "numpy==1.26.2",
    "pandas==2.1.3",
    "scikit-learn==1.3.2",
    "pyarrow",
    "boto3",
).add_local_dir(str(BASE_DIR), remote_path="/root/ml-lab")

volume = modal.Volume.from_name("sentinel-ml-checkpoints", create_if_missing=True)

app = modal.App("sentinel-training")

EXECUTOR_PROFILES = {
    "cpu-large": {
        "cpu": 8.0,
        "memory": 32768,
        "gpu": None,
        "timeout": 7200,
        "description": "CPU executor for reproducible smoke tests and lower-cost runs.",
    },
    "gpu-a10g": {
        "cpu": 8.0,
        "memory": 32768,
        "gpu": "A10G",
        "timeout": 7200,
        "description": "GPU executor for full Sentinel drift training.",
    },
}


def _run_training_job(
    epochs: int = 40,
    lr: float = 0.001,
    hidden_size: int = 32,
    num_layers: int = 2,
    sequence_length: int = 10,
    batch_size: int = 128,
    rows_per_source: int = 320,
    seed: int = 42,
    drift_z_threshold: float = 2.25,
    upload_r2: bool = True,
    executor: str = "gpu-a10g",
):
    import os
    import sys

    sys.path.insert(0, "/root/ml-lab")

    from datasets.generator.bundle import materialize_training_bundle
    from sentinel_training import TrainingConfig, train, upload_directory_to_r2

    bundle_dir = "/checkpoints/training_bundle"
    output_dir = "/checkpoints/sentinel"
    version = os.getenv("SENTINEL_MODEL_VERSION", "")

    if not version:
        from sentinel_training import now_version
        version = now_version()

    print(f"Starting Sentinel training on Modal executor '{executor}'.")
    print(f"Generating synthetic bundle at {bundle_dir}")
    materialize_training_bundle(output_dir=bundle_dir, rows_per_source=rows_per_source, seed=seed)

    result = train(TrainingConfig(
        bundle_dir=bundle_dir,
        output_dir=output_dir,
        version=version,
        sequence_length=sequence_length,
        hidden_size=hidden_size,
        num_layers=num_layers,
        epochs=epochs,
        learning_rate=lr,
        batch_size=batch_size,
        drift_z_threshold=drift_z_threshold,
        test_size=0.2,
        seed=seed,
    ))

    if upload_r2:
        bucket = os.getenv("R2_BUCKET_DATA") or os.getenv("R2_BUCKET")
        if bucket:
            uploaded = upload_directory_to_r2(
                local_dir=Path(result["artifact_dir"]),
                bucket=bucket,
                prefix=f"system/r2-system/models/sentinel/{version}",
            )
            result["r2"] = uploaded

    volume.commit()
    print(result)
    return result


@app.function(
    image=image,
    cpu=EXECUTOR_PROFILES["cpu-large"]["cpu"],
    memory=EXECUTOR_PROFILES["cpu-large"]["memory"],
    volumes={"/checkpoints": volume},
    secrets=[modal.Secret.from_name("sentry-r2-secrets")],
    timeout=EXECUTOR_PROFILES["cpu-large"]["timeout"],
)
def train_drift_model_cpu(
    epochs: int = 40,
    lr: float = 0.001,
    hidden_size: int = 32,
    num_layers: int = 2,
    sequence_length: int = 10,
    batch_size: int = 128,
    rows_per_source: int = 320,
    seed: int = 42,
    drift_z_threshold: float = 2.25,
    upload_r2: bool = True,
):
    return _run_training_job(
        epochs=epochs,
        lr=lr,
        hidden_size=hidden_size,
        num_layers=num_layers,
        sequence_length=sequence_length,
        batch_size=batch_size,
        rows_per_source=rows_per_source,
        seed=seed,
        drift_z_threshold=drift_z_threshold,
        upload_r2=upload_r2,
        executor="cpu-large",
    )


@app.function(
    image=image,
    cpu=EXECUTOR_PROFILES["gpu-a10g"]["cpu"],
    memory=EXECUTOR_PROFILES["gpu-a10g"]["memory"],
    gpu=EXECUTOR_PROFILES["gpu-a10g"]["gpu"],
    volumes={"/checkpoints": volume},
    secrets=[modal.Secret.from_name("sentry-r2-secrets")],
    timeout=EXECUTOR_PROFILES["gpu-a10g"]["timeout"],
)
def train_drift_model_gpu(
    epochs: int = 40,
    lr: float = 0.001,
    hidden_size: int = 32,
    num_layers: int = 2,
    sequence_length: int = 10,
    batch_size: int = 128,
    rows_per_source: int = 320,
    seed: int = 42,
    drift_z_threshold: float = 2.25,
    upload_r2: bool = True,
):
    return _run_training_job(
        epochs=epochs,
        lr=lr,
        hidden_size=hidden_size,
        num_layers=num_layers,
        sequence_length=sequence_length,
        batch_size=batch_size,
        rows_per_source=rows_per_source,
        seed=seed,
        drift_z_threshold=drift_z_threshold,
        upload_r2=upload_r2,
        executor="gpu-a10g",
    )


train_drift_model = train_drift_model_gpu


@app.local_entrypoint()
def main(
    executor: str = "gpu-a10g",
    epochs: int = 40,
    lr: float = 0.001,
    hidden_size: int = 32,
    num_layers: int = 2,
    sequence_length: int = 10,
    batch_size: int = 128,
    rows_per_source: int = 320,
    seed: int = 42,
    drift_z_threshold: float = 2.25,
    upload_r2: bool = True,
):
    if executor not in EXECUTOR_PROFILES:
        raise ValueError(f"Unknown executor '{executor}'. Choose one of: {', '.join(EXECUTOR_PROFILES)}")

    print("Preparing to run training remotely...")
    selected_runner = train_drift_model_cpu if executor == "cpu-large" else train_drift_model_gpu
    print(f"Selected executor: {executor} ({EXECUTOR_PROFILES[executor]['description']})")
    selected_runner.remote(
        epochs=epochs,
        lr=lr,
        hidden_size=hidden_size,
        num_layers=num_layers,
        sequence_length=sequence_length,
        batch_size=batch_size,
        rows_per_source=rows_per_source,
        seed=seed,
        drift_z_threshold=drift_z_threshold,
        upload_r2=upload_r2,
    )
