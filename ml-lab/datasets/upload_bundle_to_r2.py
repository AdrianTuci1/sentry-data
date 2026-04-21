#!/usr/bin/env python3
"""Upload a generated Sentinel synthetic training bundle to R2."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from training.sentinel.io import default_training_bundle_uri, upload_directory_to_r2_uri


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Upload a generated synthetic training bundle directory to R2.")
    parser.add_argument("--bundle-dir", default="ml-lab/.generated/training_bundle")
    parser.add_argument("--target-uri", default=default_training_bundle_uri(), help="R2/S3 prefix. Defaults to SENTINEL_TRAINING_BUNDLE_URI or s3://$R2_BUCKET_DATA/system/r2-system/training/sentinel/generated/latest.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if not args.target_uri:
        raise ValueError("--target-uri or R2_BUCKET_DATA/R2_BUCKET is required.")
    bundle_dir = Path(args.bundle_dir)
    manifest_path = bundle_dir / "metadata" / "training_bundle_manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Bundle manifest not found: {manifest_path}")

    uploaded = upload_directory_to_r2_uri(bundle_dir, args.target_uri)
    print(json.dumps({
        "status": "uploaded",
        "source_dir": str(bundle_dir),
        "target_uri": args.target_uri.rstrip("/"),
        "file_count": len(uploaded),
        "uploaded": uploaded,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
