import os
import duckdb
import json
import yaml
import boto3
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

def run_query_generation():
    # Path Inference (Zero-Injection)
    strategy_uri = f"s3://{r2_bucket}/system/config/business-metrics-strategy.yml"
    widget_catalog_uri = f"s3://{r2_bucket}/system/widgets/catalog.yml"
    discovery_uri = f"s3://{r2_bucket}/tenants/{tenant_id}/projects/{project_id}/discovery/source_classification.json"

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
        print("C. PICK VISUALIZERS: Pick EXACTLY ONE valid key from the WIDGET_CATALOG (e.g. 'animated-line', 'sankey'). DO NOT invent widget types!")
        print("D. BATCH FETCH MANIFESTS: Use fetch_batch_from_r2([f's3://{r2_bucket}/system/widgets/{p}' for p in paths]).")
        print("E. CONTRACT COMPLIANCE: Use 'sql_aliases' and 'data_structure_template' from manifests.")
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
            catalog_dict = yaml.safe_load(catalog_content)
            paths = [catalog_dict[w]['path'] for w in selected_widgets if w in catalog_dict and 'path' in catalog_dict[w]]
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
