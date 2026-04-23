import json
import os
from pathlib import Path
from typing import List, Dict

try:
    from google import genai
except ImportError:
    print("google-genai not installed. Skipping vault generation.")
    genai = None

def generate_query_batch(client, model_id: str, count: int, domains: List[str]) -> List[Dict]:
    prompt = f"""
    Generate {count} diverse SQL query scenarios for a business intelligence platform.
    
    Domains to cover: {', '.join(domains)}
    
    For each scenario, provide:
    1. sql: The SQL query string.
    2. label: 1 if the query is RISKY (data leakage, resource exhaustion, suspicious patterns, SQL injection, unauthorized access probes), 0 if it is SAFE (regular analytical queries).
    3. domain: The domain name.
    4. reason: A short explanation.
    
    Return the result ONLY as a JSON list of objects.
    """
    
    response = client.models.generate_content(
        model=model_id,
        contents=prompt
    )
    
    text = response.text.strip()
    if text.startswith("```json"):
        text = text[7:-3].strip()
    elif text.startswith("```"):
        text = text[3:-3].strip()
        
    return json.loads(text)

def generate_query_vault(output_path: Path, total_count: int = 500, batch_size: int = 100):
    if not genai:
        return
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found. Skipping vault generation.")
        return

    client = genai.Client(api_key=api_key)
    model_id = "gemini-2.5-flash" 
    domains = ["ecommerce", "marketing", "logistics", "saas", "cybersecurity"]

    all_data = []
    num_batches = total_count // batch_size
    
    print(f"🚀 Generating {total_count} SQL scenarios in {num_batches} batches using {model_id}...")
    
    for i in range(num_batches):
        print(f"\n--- 📦 Batch {i+1}/{num_batches} ---")
        try:
            batch = generate_query_batch(client, model_id, batch_size, domains)
            
            # Live Preview: Print first 5 queries of each batch
            print(f"🔍 Preview (first 5 of {len(batch)}):")
            for item in batch[:5]:
                status = "🚨 RISKY" if item['label'] == 1 else "✅ SAFE"
                print(f"  [{status}] {item['sql'][:80]}...")
            
            all_data.extend(batch)
            
            # Incremental save
            with output_path.open("w", encoding="utf-8") as f:
                for item in all_data:
                    f.write(json.dumps(item) + "\n")
            print(f"💾 Saved. Total scenarios so far: {len(all_data)}")
                    
        except Exception as e:
            print(f"  ❌ Batch {i+1} failed: {e}")

    print(f"✅ Vault materialized to {output_path} ({len(all_data)} scenarios)")

if __name__ == "__main__":
    vault_file = Path(".generated/query_vault.jsonl")
    vault_file.parent.mkdir(parents=True, exist_ok=True)
    generate_query_vault(vault_file)
