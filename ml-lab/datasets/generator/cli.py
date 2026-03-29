from __future__ import annotations

import argparse
import json

from .bundle import materialize_training_bundle
from .common import DEFAULT_SEED


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Materialize multi-domain training datasets for ml-lab.")
    parser.add_argument("--output-dir", default="ml-lab/datasets/training_bundle", help="Directory where bundle artifacts will be written.")
    parser.add_argument("--rows-per-source", type=int, default=240, help="Number of rows to generate per source dataset.")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="Deterministic seed for synthetic data generation.")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    manifest = materialize_training_bundle(
        output_dir=args.output_dir,
        rows_per_source=args.rows_per_source,
        seed=args.seed,
    )
    print(json.dumps(manifest["summary"], indent=2))


__all__ = ["build_parser", "main"]
