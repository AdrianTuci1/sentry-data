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
from pathlib import Path
from typing import Any, Dict, List
from google import genai


DEFAULT_MODEL = "gemini-2.5-flash"


def build_prompt(domain: str, sources: List[str], rows_per_source: int, variety: str, widget_catalog: List[Dict[str, Any]], schema_context: Dict[str, Any] = None) -> str:
    # Use the FULL catalog in a compact format for "Full Knowledge" extraction
    catalog_reference = []
    for w in widget_catalog:
        hints = ", ".join(w.get("selection_hints", []))
        # Get just the alias names for the prompt
        aliases = ", ".join([a.get("alias") for a in w.get("sql_aliases", []) if a.get("alias")])
        catalog_reference.append(f"- {w['id']} | {w['title']} | Hints: {hints} | Aliases: {aliases}")

    catalog_str = "\n".join(catalog_reference)

    if not schema_context:
        # Phase 1: Metadata + Initial Data
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
  "widget_recommendations": [
    {{
      "widget_id": "string",
      "rationale": "string",
      "ground_truth_sql": "SQL string using DuckDB dialect and the alias requirements from the catalog."
    }}
  ],
  "quality_notes": ["string"]
}}

Target Sources: {", ".join(sources)}.
Initial rows per source: {rows_per_source}.
Variety mode: {variety}.

Widget Catalog Reference (FULL):
{catalog_str}

Rules:
- Generate varied field names, realistic distributions, edge cases, sparse fields, timestamps, ids, and numeric metrics.
- Include at least one timestamp, one entity id, two metrics, and two dimensions per source when plausible.
- Widget Recommendations: Select 3-6 widgets from the catalog that would be highly useful for this specific {domain} scenario.
- SQL Ground Truth: Provide a valid SQL query for EACH recommendation that would run against these synthetic sources.
- Ground Truth SQL MUST use the EXACT alias names required by the widget manifest (as shown in Expected Aliases).
- Do not use real personal data. Use synthetic ids and fake company/customer names only.
""".strip()
    else:
        # Phase 2: Bulk Data Fill
        schema_summary = json.dumps(schema_context, indent=2)
        return f"""
Continue generating synthetic rows for the following dataset schema. 
Generate EXACTLY {rows_per_source} additional unique rows for each source.

Schema Context:
{schema_summary}

Return ONLY valid JSON with this exact shape:
{{
  "sources": [
    {{
      "source_name": "string",
      "rows": [
        {{"column": "value"}}
      ]
    }}
  ]
}}

Rules:
- Ensure data consistency with the provided schema.
- Maintain the same distribution and variety style.
- Rows must be unique and not duplicates of previous ones.
""".strip()


def call_gemini(api_key: str, model_name: str, prompt: str, temperature: float) -> Dict[str, Any]:
    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config={
            "temperature": temperature,
            "response_mime_type": "application/json",
        },
    )

    if not response.text:
        raise RuntimeError("Gemini API returned an empty response.")

    return parse_json_payload(response.text)


def parse_json_payload(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*(.*?)```", text, flags=re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise


def initialize_dataset(payload: Dict[str, Any], output_dir: Path) -> Dict[str, Any]:
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
        
        csv_path = output_dir / f"{source_name}.csv"
        jsonl_path = output_dir / f"{source_name}.jsonl"

        # Initialize CSV with heart and first rows
        with csv_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns)
            writer.writeheader()
            for row in rows:
                writer.writerow({column: row.get(column) for column in columns})

        # Initialize JSONL
        with jsonl_path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")

        manifest["sources"].append({
            "source_name": source_name,
            "description": source.get("description"),
            "grain": source.get("grain"),
            "columns": source.get("columns", []),
            "row_count": len(rows),
            "csv_path": str(csv_path),
            "jsonl_path": str(jsonl_path),
        })

    # Write initial widget recommendations
    recommendations = payload.get("widget_recommendations") or []
    rec_path = output_dir / "widget_recommendations.jsonl"
    with rec_path.open("w", encoding="utf-8") as handle:
        for rec in recommendations:
            handle.write(json.dumps(rec, ensure_ascii=False) + "\n")
    
    manifest["recommendations_path"] = str(rec_path)
    manifest["recommendation_count"] = len(recommendations)
    return manifest

def append_to_dataset(batch_payload: Dict[str, Any], output_dir: Path, manifest: Dict[str, Any]) -> None:
    for b_source in batch_payload.get("sources", []):
        source_name = slugify(b_source["source_name"])
        rows = b_source.get("rows", [])
        if not rows: continue

        # Find in manifest to get columns
        m_source = next((s for s in manifest["sources"] if s["source_name"] == source_name), None)
        if not m_source: continue

        columns = [c["name"] for c in m_source["columns"]]
        csv_path = Path(m_source["csv_path"])
        jsonl_path = Path(m_source["jsonl_path"])

        # Append to CSV
        with csv_path.open("a", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns)
            for row in rows:
                # Filter row to only include known columns to avoid errors
                clean_row = {c: row.get(c) for c in columns}
                writer.writerow(clean_row)

        # Append to JSONL
        with jsonl_path.open("a", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        
        m_source["row_count"] += len(rows)

def finalize_manifest(manifest: Dict[str, Any], output_dir: Path) -> None:
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
    
    # Load widget catalog
    catalog_path = Path(__file__).parent / "widget_catalog.json"
    widget_catalog = []
    if catalog_path.exists():
        with catalog_path.open("r") as f:
            widget_catalog = json.load(f)
    else:
        print(f"Warning: widget_catalog.json not found at {catalog_path}. Selection logic will be limited.")

    # Phase 1: Metadata + Initial Batch
    initial_batch_size = min(10, args.rows_per_source)
    print(f"[Gemini] Generating metadata and initial {initial_batch_size} rows...")
    prompt = build_prompt(args.domain, sources, initial_batch_size, args.variety, widget_catalog)
    payload = call_gemini(api_key, args.model, prompt, args.temperature)
    
    if not payload:
        print("Failed to generate initial metadata.")
        return 1

    # Initialize files and manifest
    output_path = Path(args.output_dir)
    manifest = initialize_dataset(payload, output_path)
    print(f"[Streaming] Initialized files in {output_path}. You can now view them.")

    # Extract schema for context in Phase 2
    schema_context = {
        "domain": args.domain,
        "sources": []
    }
    for s in payload.get("sources", []):
        schema_context["sources"].append({
            "source_name": s["source_name"],
            "columns": s["columns"]
        })

    # Phase 2: Bulk Data Infill
    remaining_rows = args.rows_per_source - initial_batch_size
    batch_size = 50
    
    while remaining_rows > 0:
        current_batch = min(batch_size, remaining_rows)
        print(f"[Gemini] Generating batch of {current_batch} rows ({remaining_rows} remaining)...")
        
        batch_prompt = build_prompt(args.domain, sources, current_batch, args.variety, widget_catalog, schema_context=schema_context)
        batch_payload = call_gemini(api_key, args.model, batch_prompt, args.temperature)
        
        if batch_payload and "sources" in batch_payload:
            # Append rows incrementally
            append_to_dataset(batch_payload, output_path, manifest)
        
        remaining_rows -= current_batch

    finalize_manifest(manifest, output_path)
    print(f"Dataset generation complete in {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
