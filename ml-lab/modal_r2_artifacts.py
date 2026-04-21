from pathlib import Path

import modal

BASE_DIR = Path(__file__).resolve().parent

image = modal.Image.debian_slim().pip_install(
    "numpy==1.26.2",
    "pandas==2.1.3",
    "pyarrow",
    "boto3",
).add_local_dir(str(BASE_DIR), remote_path="/root/ml-lab")

volume = modal.Volume.from_name("sentinel-ml-checkpoints", create_if_missing=True)
app = modal.App("sentinel-r2-artifacts")


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("sentry-r2-secrets")],
    timeout=3600,
)
def generate_and_upload_training_bundle(
    rows_per_source: int = 320,
    seed: int = 42,
    target_uri: str = "",
):
    import sys

    sys.path.insert(0, "/root/ml-lab")

    from datasets.generator.bundle import materialize_training_bundle
    from training.sentinel.io import default_training_bundle_uri, upload_directory_to_r2_uri

    output_dir = "/tmp/sentinel-training-bundle"
    manifest = materialize_training_bundle(
        output_dir=output_dir,
        rows_per_source=rows_per_source,
        seed=seed,
    )
    resolved_target_uri = target_uri or default_training_bundle_uri()
    if not resolved_target_uri:
        raise ValueError("target_uri, SENTINEL_TRAINING_BUNDLE_URI or R2_BUCKET_DATA/R2_BUCKET is required.")

    uploaded = upload_directory_to_r2_uri(Path(output_dir), resolved_target_uri)
    return {
        "status": "uploaded",
        "target_uri": resolved_target_uri,
        "manifest": manifest,
        "file_count": len(uploaded),
    }


@app.function(
    image=image,
    volumes={"/checkpoints": volume},
    secrets=[modal.Secret.from_name("sentry-r2-secrets")],
    timeout=1800,
)
def upload_model_bundle_from_volume(
    version: str = "",
    target_uri: str = "",
):
    import json
    import sys

    sys.path.insert(0, "/root/ml-lab")

    from training.sentinel.io import default_model_bundle_uri, upload_directory_to_r2_uri

    source_dir = Path("/checkpoints/sentinel") / (version or "latest")
    manifest_path = source_dir / "sentinel_model_manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Sentinel model manifest not found: {manifest_path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    resolved_version = version or manifest.get("model_id") or "latest"
    resolved_target_uri = target_uri or default_model_bundle_uri(resolved_version)
    if not resolved_target_uri:
        raise ValueError("target_uri, SENTINEL_MODEL_BUNDLE_URI or R2_BUCKET_DATA/R2_BUCKET is required.")

    uploaded = upload_directory_to_r2_uri(source_dir, resolved_target_uri)
    volume.commit()
    return {
        "status": "uploaded",
        "source_dir": str(source_dir),
        "target_uri": resolved_target_uri,
        "file_count": len(uploaded),
        "manifest": manifest,
    }


@app.local_entrypoint()
def main(
    action: str = "training-bundle",
    rows_per_source: int = 320,
    seed: int = 42,
    version: str = "",
    target_uri: str = "",
):
    if action == "training-bundle":
        result = generate_and_upload_training_bundle.remote(
            rows_per_source=rows_per_source,
            seed=seed,
            target_uri=target_uri,
        )
    elif action == "model-bundle":
        result = upload_model_bundle_from_volume.remote(
            version=version,
            target_uri=target_uri,
        )
    else:
        raise ValueError("action must be one of: training-bundle, model-bundle")

    print(result)
