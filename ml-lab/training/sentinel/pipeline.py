import json
import shutil
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

from .config import TrainingConfig
from .drift import train_drift_classifier
from .features import FAMILIES, ROLES
from .io import download_r2_prefix, upload_directory_to_r2, delete_prefix_in_r2
from .tabular import train_coverage_ranker, train_interaction_policy_model, train_query_risk_model


def ensure_bundle(config: TrainingConfig, bundle_r2_uri: Optional[str] = None) -> Dict[str, object]:
    bundle_dir = Path(config.bundle_dir)
    manifest_path = bundle_dir / "metadata" / "training_bundle_manifest.json"
    
    # Industrial Upgrade: If an R2 URI is provided, we FORCE a refresh to avoid stale volume bugs
    if bundle_r2_uri:
        if bundle_dir.exists():
            print(f"🔄 Force-refreshing bundle directory from R2: {bundle_r2_uri}")
            shutil.rmtree(bundle_dir)
        
        bundle_dir.mkdir(parents=True, exist_ok=True)
        downloaded = download_r2_prefix(bundle_r2_uri, bundle_dir)
        return {"source": "r2", "uri": bundle_r2_uri, "downloaded_files": len(downloaded)}

    if manifest_path.exists():
        return {"source": "local", "manifest_path": str(manifest_path)}

    from datasets.generator.bundle import materialize_training_bundle

    manifest = materialize_training_bundle(
        output_dir=str(bundle_dir),
        rows_per_source=config.rows_per_source,
        seed=config.seed,
    )
    return {"source": "generated", "manifest": manifest}


def train(config: TrainingConfig, bundle_r2_uri: Optional[str] = None) -> Dict[str, object]:
    bundle_info = ensure_bundle(config, bundle_r2_uri=bundle_r2_uri)
    bundle_dir = Path(config.bundle_dir)
    version_dir = Path(config.output_dir) / config.version
    latest_dir = Path(config.output_dir) / "latest"
    version_dir.mkdir(parents=True, exist_ok=True)

    models = {
        "CoverageRanker": train_coverage_ranker(bundle_dir, version_dir, config),
        "DriftClassifier": train_drift_classifier(config, version_dir),
        "QueryRiskModel": train_query_risk_model(bundle_dir, version_dir, config),
        "InteractionPolicyModel": train_interaction_policy_model(bundle_dir, version_dir, config),
    }

    manifest_path = version_dir / "sentinel_model_manifest.json"
    manifest = {
        "model_id": config.version,
        "kind": "sentinel_model_bundle",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "config": asdict(config),
        "bundle_manifest": str(bundle_dir / "metadata" / "training_bundle_manifest.json"),
        "bundle_source": bundle_info,
        "checkpoint": "drift_lstm.pth",
        "metadata": {
            "roles": ROLES,
            "families": FAMILIES,
        },
        "models": models,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    if latest_dir.exists() or latest_dir.is_symlink():
        if latest_dir.is_symlink() or latest_dir.is_file():
            latest_dir.unlink()
        else:
            shutil.rmtree(latest_dir)
    shutil.copytree(version_dir, latest_dir)

    return {
        "status": "trained",
        "version": config.version,
        "artifact_dir": str(version_dir),
        "latest_dir": str(latest_dir),
        "manifest_path": str(manifest_path),
        "bundle_source": bundle_info,
        "models": models,
    }


def train_and_upload(config: TrainingConfig, bucket: str, prefix: str, bundle_r2_uri: Optional[str] = None) -> Dict[str, object]:
    result = train(config, bundle_r2_uri=bundle_r2_uri)
    uploaded = upload_directory_to_r2(
        local_dir=Path(result["artifact_dir"]),
        bucket=bucket,
        prefix=f"{prefix.rstrip('/')}/{config.version}",
    )
    result["r2"] = uploaded
    
    # Industrial Upgrade: Update the 'latest' pointer in R2
    latest_prefix = f"{prefix.rstrip('/')}/latest"
    print(f"Updating 'latest' model pointer at s3://{bucket}/{latest_prefix}...")
    delete_prefix_in_r2(bucket, latest_prefix)
    upload_directory_to_r2(
        local_dir=Path(result["artifact_dir"]),
        bucket=bucket,
        prefix=latest_prefix,
    )
    
    result["model_bundle_uri"] = f"s3://{bucket}/{prefix.rstrip('/')}/{config.version}"
    result["latest_bundle_uri"] = f"s3://{bucket}/{latest_prefix}"
    return result
