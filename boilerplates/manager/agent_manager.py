import os
import json
import traceback
import subprocess
import boto3
from urllib.parse import urlparse
from openai import OpenAI

# R2 Fetching Credentials
R2_BOILERPLATE_URI = os.environ.get("R2_BOILERPLATE_URI")
R2_PROMPT_URI = os.environ.get("R2_PROMPT_URI") # New: Path to the detailed system prompt
R2_VERIFIED_SCRIPT_URI = os.environ.get("R2_VERIFIED_SCRIPT_URI") # New: Path to a previously generated script
R2_REGION = os.environ.get("R2_REGION", "auto")
R2_ENDPOINT = os.environ.get("R2_ENDPOINT_URL")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")

# These will be dynamically injected by Node.js via Environment Variables
raw_system_prompt = os.environ.get("INJECTED_SYSTEM_PROMPT")
INJECTED_DATA_URI = os.environ.get("INJECTED_DATA_URI", "")

# Model configuration
AGENT_MODEL = os.environ.get("AGENT_MODEL", "gpt-5-mini-2025-08-07")

def fetch_from_r2(uri: str) -> str:
    """Downloads a file from S3/R2."""
    print(f"[Agent Manager] Fetching from: {uri}")
    parsed = urlparse(uri)
    bucket_name = parsed.netloc
    object_key = parsed.path.lstrip('/')
    
    s3_client = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name=R2_REGION
    )
    
    response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
    content = response['Body'].read().decode('utf-8')
    return content

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def test_run_script(script_content: str) -> str:
    """Saves the script to a temporary file and runs it, returning stdout and stderr."""
    file_path = "/tmp/current_task_script.py"
    with open(file_path, "w") as f:
        f.write(script_content)
    
    try:
        result = subprocess.run(
            ["python", file_path], 
            capture_output=True, 
            text=True, 
            timeout=60 # Increased timeout for heavy transforms
        )
        output = f"--- STDOUT ---\n{result.stdout}\n--- STDERR ---\n{result.stderr}\nExit Code: {result.returncode}"
        return output
    except Exception as e:
        return f"Execution Failed: {str(e)}"

def run_agent_loop():
    # --- PHASE 1: DIRECT EXECUTION (Smart Orchestration) ---
    if R2_VERIFIED_SCRIPT_URI:
        print(f"[Agent Manager] CACHE HIT: Running verified script from {R2_VERIFIED_SCRIPT_URI}")
        verified_code = fetch_from_r2(R2_VERIFIED_SCRIPT_URI)
        output = test_run_script(verified_code)
        print(f"--- AGENT_EXECUTION_STDOUT ---\n{output}")
        return

    # --- PHASE 2: GENERATION (LLM Discovery) ---
    if not R2_BOILERPLATE_URI:
        raise ValueError("Neither R2_VERIFIED_SCRIPT_URI nor R2_BOILERPLATE_URI provided!")
        
    print(f"[Agent Manager] CACHE MISS: Starting LLM generation loop...")
    boilerplate_code = fetch_from_r2(R2_BOILERPLATE_URI)
    
    # Resolve system prompt: either injected text or fetch from R2
    system_prompt = raw_system_prompt
    if not system_prompt and R2_PROMPT_URI:
        system_prompt = fetch_from_r2(R2_PROMPT_URI)
    if not system_prompt:
        system_prompt = "You are an AI Agent."
    
    # Collect all INJECTED_ environment variables to pass to the LLM
    injected_vars_str = "\n".join([f"{k} = {v}" for k, v in os.environ.items() if k.startswith("INJECTED_")])
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": (
            f"Here are your target URIs and parameters to replace in the boilerplate:\n{injected_vars_str}\n\n"
            f"Start from this boilerplate:\n```python\n{boilerplate_code}\n```\n\n"
            "CRITICAL: After you have a verified working script, provide a summary of what you discovered about the data (schema, key features, lineage) in your final message "
            "between '--- AGENT_DISCOVERY_METADATA_START ---' and '--- AGENT_DISCOVERY_METADATA_END ---' tags in JSON format."
        )}
    ]

    tools = [
        {
            "type": "function",
            "function": {
                "name": "test_run_script",
                "description": "Executes the Python script to test your logic.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "script_content": {"type": "string"}
                    },
                    "required": ["script_content"],
                },
            }
        }
    ]

    max_steps = 10
    step = 0
    final_script = boilerplate_code

    while step < max_steps:
        step += 1
        response = client.chat.completions.create(
            model=AGENT_MODEL,
            messages=messages,
            tools=tools,
            tool_choice="auto"
        )
        
        message = response.choices[0].message
        messages.append(message)

        if message.tool_calls:
            for tool_call in message.tool_calls:
                if tool_call.function.name == "test_run_script":
                    args = json.loads(tool_call.function.arguments)
                    script_code = args.get("script_content", "")
                    if script_code: final_script = script_code
                    result = test_run_script(script_code)
                    messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": result})
        else:
            print("[Agent Manager] LLM generation complete.")
            final_output = test_run_script(final_script)
            
            # Emit the script so Node.js can save it to R2 for future reuse
            print("--- AGENT_FINAL_SCRIPT_START ---")
            print(final_script)
            print("--- AGENT_FINAL_SCRIPT_END ---")

            # NEW: Allow LLM to output discovery metadata (schema, lineage, etc.)
            # We look for a special block in the LLM's final message
            if "--- AGENT_DISCOVERY_METADATA_START ---" in message.content:
                metadata_block = message.content.split("--- AGENT_DISCOVERY_METADATA_START ---")[1].split("--- AGENT_DISCOVERY_METADATA_END ---")[0]
                print("--- AGENT_DISCOVERY_METADATA ---")
                print(metadata_block.strip())
            
            print(f"--- AGENT_EXECUTION_STDOUT ---\n{final_output}")
            return

    print("[Agent Manager] Hit max steps limit.")

if __name__ == "__main__":
    try:
        run_agent_loop()
    except Exception as e:
        import sys
        print(f"MANAGER_CRASH:{str(e)}")
        traceback.print_exc()
        sys.exit(1)

