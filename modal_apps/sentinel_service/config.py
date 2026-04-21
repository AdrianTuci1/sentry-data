import os
from pathlib import Path

import modal
from fastapi import FastAPI


PROMPT_DIR = "/root/r2-system/prompts/runtime"
SENTINEL_VERSION = "sentinel-modal-v1"
INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "secret")
REPO_ROOT = Path(__file__).resolve().parents[2]
MODEL_VOLUME_DIR = Path("/sentinel-models")
MODEL_DOWNLOAD_DIR = Path("/tmp/sentinel-model")

image = (
    modal.Image.debian_slim()
    .pip_install("fastapi[standard]", "pydantic", "duckdb", "pyyaml", "torch==2.1.1", "numpy==1.26.2", "boto3")
    .add_local_dir(str(REPO_ROOT / "r2-system" / "prompts" / "runtime"), remote_path=PROMPT_DIR)
)

app = modal.App("statsparrot-sentinel")
web_app = FastAPI(title="StatsParrot Sentinel")
model_volume = modal.Volume.from_name("sentinel-ml-checkpoints", create_if_missing=True)
