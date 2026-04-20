#!/usr/bin/env python3
"""
Generate varied synthetic datasets through the Gemini API.

The script intentionally keeps dependencies to the Python standard library so it
can run in the repo without changing the ML lab environment.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List


DEFAULT_MODEL = "gemini-2.5-flash"
API_BASE = "https://generativelanguage.googleapis.com/v1beta"


def build_prompt(domain: str, sources: List[str], rows_per_source: int, variety: str) -> str:
    return f"""
You generate realistic but fully synthetic business datasets for analytics and ML testing.

Return ONLY valid JSON with this exact shape:
{{
  "dataset_name": "string",
  "domain": "{domain}",
  "sources": [
    {{
      "source_name": "string",
      "description": "string",
      "grain": "event|day|account|order|ticket|session|device",
      "columns": [
        {{"name": "string", "type": "string", "semantic_role": "id|timestamp|metric|dimension|quality_metric"}}
      ],
      "rows": [
        {{"column": "value"}}
      ]
    }}
  ],
  "quality_notes": ["string"]
}}

Rules:
- Generate exactly these sources: {", ".join(sources)}.
- Generate {rows_per_source} rows for each source.
- Use varied field names, realistic distributions, edge cases, sparse fields, timestamps, ids, and numeric metrics.
- Include at least one timestamp, one entity id, two metrics, and two dimensions per source when plausible.
- Do not use real personal data. Use synthetic ids and fake company/customer names only.
- Make rows internally coherent enough for SQL aggregation and ML feature tests.
- Variety mode: {variety}.
""".strip()


def call_gemini(api_key: str, model: str, prompt: str, temperature: float) -> Dict[str, Any]:
    encoded_model = urllib.parse.quote(model, safe="")
    url = f"{API_BASE}/models/{encoded_model}:generateContent?key={urllib.parse.quote(api_key)}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
        },
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini API failed with HTTP {error.code}: {details}") from error

    envelope = json.loads(body)
    text = envelope["candidates"][0]["content"]["parts"][0]["text"]
    return parse_json_payload(text)


def parse_json_payload(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*(.*?)```", text, flags=re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise


def write_dataset(payload: Dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "dataset_name": payload.get("dataset_name", "gemini_synthetic_dataset"),
        "domain": payload.get("domain"),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sources": [],
        "quality_notes": payload.get("quality_notes", []),
    }

    for source in payload.get("sources", []):
        source_name = slugify(str(source.get("source_name") or "source"))
        rows = source.get("rows") or []
        columns = [column.get("name") for column in source.get("columns", []) if column.get("name")]
        if not columns and rows:
            columns = sorted({key for row in rows for key in row.keys()})

        csv_path = output_dir / f"{source_name}.csv"
        jsonl_path = output_dir / f"{source_name}.jsonl"

        with csv_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns)
            writer.writeheader()
            for row in rows:
                writer.writerow({column: row.get(column) for column in columns})

        with jsonl_path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")

        manifest["sources"].append(
            {
                "source_name": source_name,
                "description": source.get("description"),
                "grain": source.get("grain"),
                "columns": source.get("columns", []),
                "row_count": len(rows),
                "csv_path": str(csv_path),
                "jsonl_path": str(jsonl_path),
            }
        )

    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_") or "source"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate synthetic source datasets with Gemini.")
    parser.add_argument("--domain", default="omnichannel_commerce", help="Business domain to synthesize.")
    parser.add_argument("--sources", default="orders,web_sessions,ad_spend", help="Comma-separated source names.")
    parser.add_argument("--rows-per-source", type=int, default=40, help="Rows to request per source.")
    parser.add_argument("--variety", default="high", choices=["medium", "high", "stress"], help="Variety and edge-case level.")
    parser.add_argument("--temperature", type=float, default=0.9)
    parser.add_argument("--model", default=os.getenv("GEMINI_MODEL", DEFAULT_MODEL))
    parser.add_argument("--output-dir", default="ml-lab/datasets/gemini_synthetic")
    args = parser.parse_args()

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is required.", file=sys.stderr)
        return 2

    sources = [source.strip() for source in args.sources.split(",") if source.strip()]
    prompt = build_prompt(args.domain, sources, args.rows_per_source, args.variety)
    payload = call_gemini(api_key, args.model, prompt, args.temperature)
    write_dataset(payload, Path(args.output_dir))
    print(f"Wrote synthetic dataset to {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
