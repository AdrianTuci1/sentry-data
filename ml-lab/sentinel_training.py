#!/usr/bin/env python3
"""Train and publish the Sentinel model bundle."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from training.sentinel import TrainingConfig, now_version, train, upload_directory_to_r2
from training.sentinel.io import default_model_bundle_uri, default_model_prefix, default_r2_bucket, default_training_bundle_uri, parse_s3_uri


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train the full Sentinel model bundle from generated or R2-backed synthetic data.")
    parser.add_argument("--bundle-dir", default="ml-lab/.generated/training_bundle")
    parser.add_argument("--bundle-r2-uri", default=default_training_bundle_uri())
    parser.add_argument("--output-dir", default="ml-lab/checkpoints/sentinel")
    parser.add_argument("--version", default=now_version())
    parser.add_argument("--rows-per-source", type=int, default=320)
    parser.add_argument("--sequence-length", type=int, default=10)
    parser.add_argument("--hidden-size", type=int, default=32)
    parser.add_argument("--num-layers", type=int, default=2)
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--drift-z-threshold", type=float, default=2.25)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--upload-r2", action="store_true")
    parser.add_argument("--model-r2-uri", default="")
    parser.add_argument("--r2-bucket", default=default_r2_bucket())
    parser.add_argument("--r2-prefix", default=default_model_prefix())
    return parser


def build_config(args: argparse.Namespace) -> TrainingConfig:
    return TrainingConfig(
        bundle_dir=args.bundle_dir,
        output_dir=args.output_dir,
        version=args.version,
        sequence_length=args.sequence_length,
        hidden_size=args.hidden_size,
        num_layers=args.num_layers,
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        batch_size=args.batch_size,
        drift_z_threshold=args.drift_z_threshold,
        test_size=args.test_size,
        seed=args.seed,
        rows_per_source=args.rows_per_source,
    )


def main() -> int:
    args = build_parser().parse_args()
    config = build_config(args)
    result = train(config, bundle_r2_uri=args.bundle_r2_uri or None)

    if args.upload_r2:
        model_r2_uri = args.model_r2_uri or default_model_bundle_uri(args.version)
        if model_r2_uri:
            bucket, prefix = parse_s3_uri(model_r2_uri)
        else:
            if not args.r2_bucket:
                raise ValueError("--model-r2-uri, --r2-bucket or R2_BUCKET_DATA is required with --upload-r2.")
            bucket = args.r2_bucket
            prefix = f"{args.r2_prefix.rstrip('/')}/{args.version}"
        uploaded = upload_directory_to_r2(
            local_dir=Path(result["artifact_dir"]),
            bucket=bucket,
            prefix=prefix,
        )
        result["r2"] = uploaded
        result["model_bundle_uri"] = f"s3://{bucket}/{prefix}"

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
