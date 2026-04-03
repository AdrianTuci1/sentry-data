import os
import duckdb
import json
import yaml
import boto3
import re
from urllib.parse import urlparse

# ==========================================
# AGENT 7: QUERY GENERATOR (Sovereign Mode)
# ==========================================
# Infrastructure & Context
tenant_id            = os.environ.get("tenantId", "unknown")
project_id           = os.environ.get("projectId", "unknown")
r2_bucket            = os.environ.get("R2_BUCKET", "statsparrot-data")

def fetch_from_r2(uri: str) -> str:
    """Helper to fetch from R2 using environment credentials."""
    parsed = urlparse(uri)
    bucket_name = parsed.netloc
    object_key = parsed.path.lstrip('/')
    
    s3_client = boto3.client('s3',
        endpoint_url=os.environ.get("R2_ENDPOINT_URL") or f"https://{os.environ.get('R2_ENDPOINT_CLEAN')}",
        aws_access_key_id=os.environ.get("R2_ACCES_KEY_ID") or os.environ.get("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY"),
        region_name=os.environ.get("R2_REGION", "auto")
    )
    
    response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
    return response['Body'].read().decode('utf-8')

def fetch_batch_from_r2(uris: list) -> dict:
    """Helper to fetch multiple URIs in one call (efficient for agents)."""
    results = {}
    for uri in uris:
        try:
            results[uri] = fetch_from_r2(uri)
        except Exception as e:
            results[uri] = f"Error: {str(e)}"
    return results

def normalize_lookup_key(value: str) -> str:
    normalized = ''.join(
        character.lower() if character.isalnum() else '-'
        for character in str(value or '').strip()
    )
    return re.sub(r'-+', '-', normalized).strip('-')

def parse_widget_catalog(content: str) -> dict:
    parsed = yaml.safe_load(content) if content else {}
    if not isinstance(parsed, dict):
        return {}

    widgets = parsed.get('widgets', parsed)

    if isinstance(widgets, dict):
        return widgets

    if isinstance(widgets, list):
        widget_map = {}
        for entry in widgets:
            if isinstance(entry, dict) and entry.get('id'):
                widget_map[entry['id']] = entry
        return widget_map

    return {}

def parse_widget_index(content: str) -> dict:
    parsed = yaml.safe_load(content) if content else {}
    if not isinstance(parsed, dict):
        return {
            'aliases': {},
            'runtime_types': {},
            'components': {},
            'component_ids': {},
            'manifest_paths': {},
        }

    lookups = parsed.get('lookups', {})

    return {
        'aliases': lookups.get('aliases', parsed.get('aliases', {})) or {},
        'runtime_types': lookups.get('runtime_types', parsed.get('runtime_types', {})) or {},
        'components': lookups.get('components', parsed.get('components', {})) or {},
        'component_ids': lookups.get('component_ids', parsed.get('component_ids', {})) or {},
        'manifest_paths': lookups.get('manifest_paths', parsed.get('manifest_paths', {})) or {},
    }

def resolve_widget_id(selection: str, catalog: dict, index: dict):
    if not selection:
        return None

    if selection in catalog:
        return selection

    normalized = normalize_lookup_key(selection)

    if normalized in catalog:
        return normalized

    for lookup_name in ['aliases', 'runtime_types', 'components', 'component_ids']:
        resolved = index.get(lookup_name, {}).get(normalized)
        if resolved and resolved in catalog:
            return resolved

    return None

def resolve_manifest_paths(selected_widgets: list, catalog: dict, index: dict) -> list:
    manifest_paths = []

    for selection in selected_widgets:
        widget_id = resolve_widget_id(selection, catalog, index)
        if not widget_id:
            continue

        widget_entry = catalog.get(widget_id, {})
        manifest_path = (
            widget_entry.get('manifest_path')
            or widget_entry.get('path')
            or index.get('manifest_paths', {}).get(widget_id)
        )

        if manifest_path and manifest_path not in manifest_paths:
            manifest_paths.append(manifest_path)

    return manifest_paths

def run_query_generation():
    # Path Inference (Zero-Injection)
    strategy_uri = f"s3://{r2_bucket}/system/config/business-metrics-strategy.yml"
    widget_catalog_uri = f"s3://{r2_bucket}/system/widgets/catalog.yml"
    widget_index_uri = f"s3://{r2_bucket}/system/widgets/index.yml"
    discovery_uri = f"s3://{r2_bucket}/tenants/{tenant_id}/projects/{project_id}/discovery/source_classification.json"
    catalog_content = ""
    index_content = ""

    # 1. [Discovery] Pull Pipeline Discovery and Business Strategy
    print(f"\n1. [Discovery] Pulling context from R2...")
    
    try:
        strategy_content = fetch_from_r2(strategy_uri)
        print("--- BUSINESS_STRATEGY_START ---")
        print(strategy_content)
        print("--- BUSINESS_STRATEGY_END ---")
    except:
        print("    Warning: Could not fetch Business Strategy.")

    try:
        catalog_content = fetch_from_r2(widget_catalog_uri)
        print("\n--- WIDGET_CATALOG_START ---")
        print(catalog_content)
        print("--- WIDGET_CATALOG_END ---")
    except:
        print("    Warning: Could not fetch Widget Catalog.")

    try:
        index_content = fetch_from_r2(widget_index_uri)
        print("\n--- WIDGET_INDEX_START ---")
        print(index_content)
        print("--- WIDGET_INDEX_END ---")
    except:
        print("    Warning: Could not fetch Widget Index.")

    try:
        pipeline_discovery = fetch_from_r2(discovery_uri)
        print("\n--- PIPELINE_DISCOVERY_START ---")
        print(pipeline_discovery)
        print("--- PIPELINE_DISCOVERY_END ---")
    except:
        print("    Warning: Could not fetch Pipeline Discovery.")

    # 2. [Discovery] Scan Gold Layer for lineage
    gold_prefix = f"tenants/{tenant_id}/projects/{project_id}/gold/"
    gold_uris = []
    print(f"\n2. [Discovery] Scanning Gold Layer in {gold_prefix}...")
    try:
        s3 = boto3.client('s3', 
            endpoint_url=os.environ.get("R2_ENDPOINT_URL") or f"https://{os.environ.get('R2_ENDPOINT_CLEAN')}",
            aws_access_key_id=os.environ.get("R2_ACCES_KEY_ID") or os.environ.get("R2_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY"),
            region_name=os.environ.get("R2_REGION", "auto")
        )
        resp = s3.list_objects_v2(Bucket=r2_bucket, Prefix=gold_prefix)
        if 'Contents' in resp:
            gold_uris = [f"s3://{r2_bucket}/{obj['Key']}" for obj in resp['Contents'] if obj['Key'].endswith('.parquet')]
        print(f"    Found {len(gold_uris)} Gold Tables.")
    except Exception as e:
        print(f"    Scanning failed: {str(e)}")

    print("\n3. [Discovery] Initializing DuckDB and printing Schemas...")
    con = duckdb.connect(database=':memory:')
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute(f"SET s3_region='{os.environ.get('R2_REGION', 'auto')}';")
    con.execute(f"SET s3_endpoint='{os.environ.get('R2_ENDPOINT_CLEAN', '')}';")
    con.execute(f"SET s3_access_key_id='{os.environ.get('R2_ACCES_KEY_ID') or os.environ.get('R2_ACCESS_KEY_ID', '')}';")
    con.execute(f"SET s3_secret_access_key='{os.environ.get('R2_SECRET_ACCESS_KEY', '')}';")
    con.execute("SET s3_use_ssl=true; SET s3_url_style='path';")

    for uri in gold_uris:
        print(f"--- SCHEMA_START: {uri} ---")
        try:
            schema = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{uri}')").df()
            print(schema.to_string())
        except Exception as e:
            print(f"Error reading schema: {str(e)}")
        print(f"--- SCHEMA_END ---")

    try:
        print("\n4. Instructions for Implementation:")
        print("--- TASK_SPECIFIC_INSTRUCTIONS_START ---")
        print("A. ANALYZE SCHEMAS: Review the Gold Layer table schemas above.")
        print("B. CONSULT WISHLIST: Prioritize metrics from the Business Strategy.")
        print("C. PICK VISUALIZERS: Pick canonical widget IDs from the WIDGET_CATALOG. If you think in aliases or runtime types first, resolve them through WIDGET_INDEX before continuing.")
        print("D. BATCH FETCH MANIFESTS: Resolve widget IDs to manifest paths using catalog.yml + index.yml, then use fetch_batch_from_r2([f's3://{r2_bucket}/system/widgets/{p}' for p in paths]).")
        print("E. CONTRACT COMPLIANCE: Use 'sql_aliases' and 'data_structure_template' from manifests. All SQL-derived fields must live under the `data` object.")
        print("F. IMPLEMENT: Write final SQL queries tailored for DuckDB and report results.")
        print("G. SINGLE JSON OUTPUT: Populate and print the AGENT_DISCOVERY JSON using the provided scaffolding at the bottom of this script.")
        print("--- TASK_SPECIFIC_INSTRUCTIONS_END ---")

        # ==========================================
        # AGENT SCAFFOLDING
        # ==========================================
        # 1. Fill `selected_widgets` with the EXACT keys from the WIDGET_CATALOG above.
        #    e.g. selected_widgets = ["animated-line", "funnel"]
        selected_widgets = [] 
        
        if selected_widgets:
            print("\n--- SELECTED_WIDGETS_MANIFESTS_START ---")
            catalog_dict = parse_widget_catalog(catalog_content)
            widget_index = parse_widget_index(index_content)
            paths = resolve_manifest_paths(selected_widgets, catalog_dict, widget_index)
            manifests = fetch_batch_from_r2([f"s3://{r2_bucket}/system/widgets/{p}" for p in paths])
            for uri, content in manifests.items():
                if not content.startswith("Error"):
                    try:
                        man = yaml.safe_load(content)
                        print(f"Widget Manifest ({uri}):")
                        print(f"  SQL Aliases: {man.get('sql_aliases', [])}")
                        print(f"  Data Template: {json.dumps(man.get('data_structure_template', {}))}\n")
                    except: pass
            print("--- SELECTED_WIDGETS_MANIFESTS_END ---")

        # 2. Final Output Scaffolding
        # Fill these lists with your generated insights
        generated_groups = [] # e.g. [{"id": "grp_1", "name": "Sales Overview", "title": "Sales Overview", "adjusted_data_ids": ["gold_Olist_Orders"]}]
        generated_insights = [] # e.g. [{"id": "ins_1", "group_id": "grp_1", "name": "Revenue Trend", "title": "Revenue Trend", "type": "animated-line", "query": "SELECT ...", "lineage": {"source_keys": ["gold_Olist_Orders"]}, "adjusted_data_columns": ["revenue", "order_date"]}]
        generated_metrics = [] # e.g. [{"name": "total_revenue", "sql": "SUM(price)"}]
        
        discovery = {
            "group": generated_groups,
            "insight": generated_insights,
            "metricGroups": generated_metrics
        }
        
        print("\nGenerating dashboard configuration based on discovered metadata...")
        print(f"AGENT_DISCOVERY:{json.dumps(discovery)}")
        
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    run_query_generation()
