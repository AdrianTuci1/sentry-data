import os
import json
import traceback
import subprocess
import boto3
import re
from urllib.parse import urlparse
from google import genai
from google.genai import types

# R2 Fetching Credentials
R2_BOILERPLATE_URI = os.environ.get("R2_BOILERPLATE_URI")
R2_PROMPT_URI = os.environ.get("R2_PROMPT_URI")
R2_VERIFIED_SCRIPT_URI = os.environ.get("R2_VERIFIED_SCRIPT_URI")
R2_REGION = os.environ.get("R2_REGION", "auto")
R2_ENDPOINT = os.environ.get("R2_ENDPOINT_URL")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")

# These will be dynamically injected by Node.js via Environment Variables
raw_system_prompt = os.environ.get("INJECTED_SYSTEM_PROMPT")
INJECTED_DATA_URI = os.environ.get("INJECTED_DATA_URI", "")

# Model configuration — set via Modal Secrets dashboard
AGENT_MODEL = os.environ.get("AGENT_MODEL", "gemini-2.0-flash")

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

# Gemini client — API key set via Modal Secrets dashboard
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def extract_code(text: str) -> str:
    """Extracts python code from markdown blocks."""
    if not text: return ""
    match = re.search(r"```python\n([\s\S]*?)\n```", text)
    if match: return match[1]
    # Fallback to the whole text if it looks like code and has no backticks
    if "import " in text and "def " in text and "```" not in text:
        return text
    return ""

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
            timeout=60
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
        
    print(f"[Agent Manager] CACHE MISS: Starting Gemini generation loop (model={AGENT_MODEL})...")
    boilerplate_code = fetch_from_r2(R2_BOILERPLATE_URI)
    
    # Resolve system prompt: either injected text or fetch from R2
    system_prompt = raw_system_prompt
    if not system_prompt and R2_PROMPT_URI:
        system_prompt = fetch_from_r2(R2_PROMPT_URI)
    if not system_prompt:
        system_prompt = "You are an AI Agent."
    
    # Collect all INJECTED_ environment variables and R2 Config to pass to the LLM
    r2_context = {
        "R2_REGION": R2_REGION,
        "R2_ENDPOINT_CLEAN": os.environ.get("R2_ENDPOINT_CLEAN"),
        "R2_ACCESS_KEY_ID": R2_ACCESS_KEY_ID,
        "R2_SECRET_ACCESS_KEY": R2_SECRET_ACCESS_KEY
    }
    injected_vars_str = "\n".join([f"{k} = {v}" for k, v in os.environ.items() if k.startswith("INJECTED_")])
    r2_vars_str = "\n".join([f"{k} = {v}" for k, v in r2_context.items()])

    user_message = (
        f"TECHNICAL CONTEXT:\n{r2_vars_str}\n\n"
        f"TARGET PARAMETERS:\n{injected_vars_str}\n\n"
        f"Start from this boilerplate:\n```python\n{boilerplate_code}\n```\n\n"
        "CRITICAL RULES:\n"
        "1. You MUST write the ENTIRE script in every response. DO NOT use placeholders like '# ...' or '...'. Truncation causes a syntax error.\n"
        "2. You MUST report your discovery (schema, groups, widgets) via a print() statement inside your script:\n"
        "   `print(f'AGENT_DISCOVERY:{json.dumps(discovery_payload)}')` where discovery_payload follows the manifest schema.\n"
        "3. BE DESCRIPTIVE: Print your progress clearly (e.g., '1. Sampled data...', '2. Formulated SQL...', '3. Validated schema...') so the user can follow your reasoning in the logs.\n"
        "4. NO LAZINESS: Do not omit helper functions like `get_grid_spans`. Rewriting the whole file is mandatory.\n"
    )

    # Gemini tools definition
    tool = types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="test_run_script",
            description="Executes the Python script to test your logic. Returns stdout and stderr.",
            parameters={
                "type": "OBJECT",
                "properties": {
                    "script_content": {
                        "type": "STRING",
                        "description": "The full Python script content to execute."
                    }
                },
                "required": ["script_content"]
            }
        )
    ])

    gen_config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        tools=[tool],
    )

    # Build initial conversation
    contents = [
        types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
    ]

    max_steps = 10  # Increased to allow complex discovery + generation loops
    step = 0
    final_script = boilerplate_code

    while step < max_steps:
        step += 1
        print(f"[Agent Manager] === Step {step}/{max_steps}: Calling Gemini... ===")
        try:
            response = client.models.generate_content(
                model=AGENT_MODEL,
                contents=contents,
                config=gen_config,
            )
        except Exception as llm_err:
            print(f"[Agent Manager] FATAL: Gemini API call failed at step {step}: {llm_err}")
            raise
        
        candidate = response.candidates[0]
        model_content = candidate.content
        contents.append(model_content)

        # Separate function calls from text parts
        function_calls = [part for part in model_content.parts if part.function_call]
        text_parts = [part.text for part in model_content.parts if part.text]
        
        print(f"[Agent Manager] Step {step}: Gemini responded. function_calls={len(function_calls)}, finish_reason={candidate.finish_reason}")

        if function_calls:
            function_response_parts = []
            for part in function_calls:
                fc = part.function_call
                if fc.name == "test_run_script":
                    script_code = fc.args.get("script_content", "")
                    if script_code: final_script = script_code
                    print(f"[Agent Manager] Step {step}: Executing test_run_script...")
                    result = test_run_script(script_code)
                    print(f"[Agent Manager] Step {step}: Script execution complete. Output preview: {result[:300]}")
                    function_response_parts.append(
                        types.Part.from_function_response(
                            name="test_run_script",
                            response={"result": result}
                        )
                    )
            
            # Send tool results back to Gemini
            contents.append(types.Content(role="user", parts=function_response_parts))
        else:
            # LLM sent a final text response
            text_content = "\n".join(text_parts)
            extracted = extract_code(text_content)
            if extracted:
                print("[Agent Manager] LLM provided code in final message. Verifying one last time...")
                final_script = extracted
                final_output = test_run_script(final_script)
                
                if "AGENT_ERROR" in final_output or "Exit Code: 1" in final_output:
                    print(f"[Agent Manager] Final code failed verification. Retrying loop... (Step {step})")
                    contents.append(types.Content(role="user", parts=[types.Part.from_text(
                        text=f"Your final code failed verification:\n{final_output}\n\nPlease fix the error(s) and provide the FULL corrected script using the `test_run_script` tool."
                    )]))
                    continue
                
                output_to_report = final_output
            else:
                output_to_report = test_run_script(final_script)

            print("[Agent Manager] LLM generation complete and verified.")
            
            # Emit the script so Node.js can save it to R2 for future reuse
            print("--- AGENT_FINAL_SCRIPT_START ---")
            print(final_script)
            print("--- AGENT_FINAL_SCRIPT_END ---")

            # Allow LLM to output discovery metadata
            if "--- AGENT_DISCOVERY_METADATA_START ---" in text_content:
                metadata_block = text_content.split("--- AGENT_DISCOVERY_METADATA_START ---")[1].split("--- AGENT_DISCOVERY_METADATA_END ---")[0]
                print("--- AGENT_DISCOVERY_METADATA ---")
                print(metadata_block.strip())
            
            print(f"--- AGENT_EXECUTION_STDOUT ---\n{output_to_report}")
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
