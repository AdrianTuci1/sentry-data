import json
import os
import pickle
from pathlib import Path
from typing import Dict, List

from .env import load_ml_lab_env

load_ml_lab_env()

DEFAULT_TRAINING_BUNDLE_PREFIX = "system/r2-system/training/sentinel/generated/latest"
DEFAULT_MODEL_BUNDLE_PREFIX = "system/r2-system/models/sentinel"


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def load_jsonl(path: Path) -> List[Dict[str, object]]:
    if not path.exists():
        return []
    rows: List[Dict[str, object]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def write_pickle(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        pickle.dump(payload, handle)


def parse_s3_uri(uri: str) -> tuple[str, str]:
    if not uri.startswith("s3://"):
        raise ValueError("Only s3:// URIs are supported.")
    bucket_and_key = uri.replace("s3://", "", 1)
    bucket, key = bucket_and_key.split("/", 1)
    return bucket, key.rstrip("/")


def default_r2_bucket() -> str:
    return os.getenv("R2_BUCKET_DATA") or os.getenv("R2_BUCKET") or os.getenv("R2_BUCKET_BRONZE") or ""


def default_training_bundle_uri() -> str:
    configured = os.getenv("SENTINEL_TRAINING_BUNDLE_URI", "")
    if configured:
        return configured.rstrip("/")
    bucket = default_r2_bucket()
    return f"s3://{bucket}/{DEFAULT_TRAINING_BUNDLE_PREFIX}" if bucket else ""


def default_model_bundle_uri(version: str) -> str:
    configured = os.getenv("SENTINEL_MODEL_BUNDLE_URI", "")
    if configured:
        return configured.rstrip("/")
    bucket = default_r2_bucket()
    return f"s3://{bucket}/{DEFAULT_MODEL_BUNDLE_PREFIX}/{version}" if bucket else ""


def default_model_prefix() -> str:
    return os.getenv("SENTINEL_MODEL_R2_PREFIX", DEFAULT_MODEL_BUNDLE_PREFIX)


def r2_client():
    import boto3

    endpoint = os.getenv("R2_ENDPOINT") or os.getenv("R2_ENDPOINT_URL")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    if not endpoint or not access_key or not secret_key:
        raise ValueError("R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required.")

    return boto3.client(
        "s3",
        region_name=os.getenv("R2_REGION", "auto"),
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )


def upload_directory_to_r2(local_dir: Path, bucket: str, prefix: str) -> Dict[str, str]:
    client = r2_client()
    uploaded: Dict[str, str] = {}
    for path in local_dir.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(local_dir).as_posix()
        key = f"{prefix.rstrip('/')}/{relative}"
        client.upload_file(str(path), bucket, key)
        uploaded[relative] = f"s3://{bucket}/{key}"
    return uploaded


def upload_directory_to_r2_uri(local_dir: Path, target_uri: str) -> Dict[str, str]:
    bucket, prefix = parse_s3_uri(target_uri)
    return upload_directory_to_r2(local_dir=local_dir, bucket=bucket, prefix=prefix)


def delete_prefix_in_r2(bucket: str, prefix: str) -> int:
    client = r2_client()
    paginator = client.get_paginator("list_objects_v2")
    deleted_count = 0
    
    for page in paginator.paginate(Bucket=bucket, Prefix=f"{prefix.rstrip('/')}/"):
        keys = [item["Key"] for item in page.get("Contents", [])]
        if keys:
            client.delete_objects(
                Bucket=bucket,
                Delete={"Objects": [{"Key": k} for k in keys]}
            )
            deleted_count += len(keys)
            
    return deleted_count


def download_r2_prefix(source_uri: str, target_dir: Path) -> Dict[str, str]:
    bucket, prefix = parse_s3_uri(source_uri)
    client = r2_client()
    target_dir.mkdir(parents=True, exist_ok=True)

    downloaded: Dict[str, str] = {}
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=f"{prefix}/"):
        for item in page.get("Contents", []):
            key = item["Key"]
            if key.endswith("/"):
                continue
            relative = key[len(prefix):].lstrip("/")
            target_path = target_dir / relative
            target_path.parent.mkdir(parents=True, exist_ok=True)
            client.download_file(bucket, key, str(target_path))
            downloaded[relative] = str(target_path)

    if not downloaded:
        raise ValueError(f"No objects found at {source_uri}")
    return downloaded
