from pathlib import Path

import modal

BASE_DIR = Path(__file__).resolve().parent

image = modal.Image.debian_slim().pip_install(
    "torch==2.1.1",
    "numpy==1.26.2",
    "pandas==2.1.3",
    "scikit-learn==1.3.2",
    "sentence-transformers",
    "duckdb",
    "pyarrow",
    "boto3",
).add_local_dir(str(BASE_DIR), remote_path="/root/ml-lab")

volume = modal.Volume.from_name("sentinel-ml-checkpoints", create_if_missing=True)

app = modal.App("sentinel-training")

@app.function(
    image=image,
    gpu="any",
    volumes={"/checkpoints": volume},
    secrets=[modal.Secret.from_name("sentry-r2-secrets")],
    timeout=3600,
)
def train_drift_model(
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

    print("Starting Sentinel training on Modal.")
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

@app.local_entrypoint()
def main(
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
    print("Preparing to run training remotely...")
    train_drift_model.remote(
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
