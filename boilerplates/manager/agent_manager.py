import os
import json
import traceback
import subprocess
import boto3
import re
from urllib.parse import urlparse
import requests
from google import genai
from google.genai import types

# ======================================================================================
# UNIVERSAL SYSTEM PROMPT
# ======================================================================================
UNIVERSAL_SYSTEM_PROMPT = """
You are a Sovereign Data Agent. Your goal is to execute a specific data task by completing and refining a boilerplate Python script.

CORE OPERATIONAL PROTOCOLS:
1. SOVEREIGN DISCOVERY: You do NOT have a static view of the environment. You MUST use the `test_run_script` tool to probe the environment, list files in R2, read schemas, and understand the data structure.
2. ITERATIVE REFINEMENT: Start with the provided boilerplate. Run it, observe errors or output, and refine the code until it achieves the objective.
3. DUCKDB & R2: Use DuckDB for data processing. Connect to R2 using the provided S3 credentials and endpoint.
4. ZERO-INJECTION ARCHITECTURE: You communicate primarily via formatted print statements in your script:
   - `print(f'AGENT_RESULT:{json.dumps(data)}')`: For final data results.
   - `print(f'AGENT_DISCOVERY:{json.dumps(metadata)}')`: For schema/manifest discovery.
   - `print(f'AGENT_ERROR:{msg}')`: For reporting critical failures.
5. AUTONOMY: Do not ask for permissions. Use your tools to find what you need (e.g., check `boilerplates/widgets/catalog.yml` if you need widget info).

Your final response should be a concise summary of what you accomplished, ending with the keyword 'COMPLETED'.
"""

# ======================================================================================
# CONFIGURATION & UTILS
# ======================================================================================
class Config:
    def __init__(self):
        # Context (Injected)
        self.task_name = os.environ.get("taskName", "unknown")
        self.tenant_id = os.environ.get("tenantId", "unknown")
        self.project_id = os.environ.get("projectId", "unknown")
        
        # Sentinel RL Goals
        raw_goals = os.environ.get("SENTINEL_GOALS", "[]")
        try:
            self.sentinel_goals = json.loads(raw_goals)
        except:
            self.sentinel_goals = []

        # R2 Credentials
        self.region = os.environ.get("R2_REGION", "auto")
        self.access_key = os.environ.get("R2_ACCES_KEY_ID") or os.environ.get("R2_ACCESS_KEY_ID")
        self.secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
        
        # Endpoint Logic
        raw_url = os.environ.get("R2_ENDPOINT") or os.environ.get("R2_ENDPOINT_URL")
        raw_clean = os.environ.get("R2_ENDPOINT_CLEAN")
        self.endpoint_clean = self._clean_url(raw_clean or raw_url)
        self.endpoint_url = f"https://{self.endpoint_clean}" if self.endpoint_clean else None
        
        # Buckets
        self.bucket = os.environ.get("R2_BUCKET") or os.environ.get("R2_BUCKET_DATA") or "statsparrot-data"
        
        # LLM (Gemini)
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.model = os.environ.get("AGENT_MODEL") or "gemini-2.0-flash-exp"
        self.agent_prompt_override = os.environ.get("AGENT_PROMPT")

    def _clean_url(self, url):
        if not url: return None
        return url.strip().replace("https://", "").replace("http://", "").rstrip("/")

    def get_s3_client(self):
        return boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region
        )

# ======================================================================================
# DATA & EXECUTION SERVICES
# ======================================================================================
class R2Service:
    def __init__(self, config: Config):
        self.config = config
        self.s3 = config.get_s3_client()

    def fetch_text(self, uri: str) -> str:
        if not uri: return ""
        try:
            parsed = urlparse(uri)
            bucket = parsed.netloc
            key = parsed.path.lstrip('/')
            response = self.s3.get_object(Bucket=bucket, Key=key)
            return response['Body'].read().decode('utf-8')
        except Exception as e:
            print(f"[R2Service] Error fetching {uri}: {e}")
            raise

    def exists(self, uri: str) -> bool:
        try:
            parsed = urlparse(uri)
            self.s3.head_object(Bucket=parsed.netloc, Key=parsed.path.lstrip('/'))
            return True
        except:
            return False

class ScriptExecutor:
    @staticmethod
    def run(script_content: str, timeout=60) -> str:
        path = "/tmp/current_task_script.py"
        with open(path, "w") as f:
            f.write(script_content)
        try:
            res = subprocess.run(
                ["python", path],
                capture_output=True,
                text=True,
                timeout=timeout,
                env=os.environ.copy()
            )
            return f"--- STDOUT ---\n{res.stdout}\n--- STDERR ---\n{res.stderr}\nExit Code: {res.returncode}"
        except Exception as e:
            return f"Execution failed: {e}"

# ======================================================================================
# AGENT ORCHESTRATOR
# ======================================================================================
class AgentOrchestrator:
    def __init__(self, config: Config, r2: R2Service):
        self.config = config
        self.r2 = r2
        self.client = genai.Client(api_key=self.config.api_key)

    def run_discovery_loop(self, boilerplate_code: str, base_task: str):
        print(f"[Orchestrator] Starting Gemini loop for: {self.config.task_name}")
        
        # Resolve actual system prompt
        base_prompt = UNIVERSAL_SYSTEM_PROMPT
        if self.config.agent_prompt_override:
            base_prompt = self.config.agent_prompt_override
        else:
            prompt_uri = f"s3://{self.config.bucket}/system/boilerplates/prompts/{base_task}.txt"
            if self.r2.exists(prompt_uri):
                try:
                    task_prompt = self.r2.fetch_text(prompt_uri)
                    base_prompt += f"\n\nTASK-SPECIFIC INSTRUCTIONS:\n{task_prompt}"
                except: pass

        # Prepare Context
        r2_vars = {
            "R2_ENDPOINT": self.config.endpoint_url,
            "R2_BUCKET": self.config.bucket,
            "R2_ACCESS_KEY": self.config.access_key
        }
        ctx_str = f"Task: {self.config.task_name}\nProject: {self.config.project_id}\nTenant: {self.config.tenant_id}"
        infra_str = "\n".join([f"{k} = {v}" for k, v in r2_vars.items()])
        
        sentinel_str = ""
        if self.config.sentinel_goals:
            sentinel_str = "\n\nSENTINEL MANDATES (MUST FOLLOW):\n- " + "\n- ".join(self.config.sentinel_goals)

        user_msg = (
            f"CONTEXT:\n{ctx_str}\n\nINFRASTRUCTURE:\n{infra_str}{sentinel_str}\n\n"
            f"BOILERPLATE:\n```python\n{boilerplate_code}\n```\n"
            "Execute and complete the task."
        )

        tools = [types.Tool(function_declarations=[
            types.FunctionDeclaration(
                name="test_run_script",
                description="Run Python code to test logic or discover environment info.",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={"script_content": types.Schema(type="STRING")},
                    required=["script_content"]
                )
            )
        ])]

        chat = self.client.chats.create(
            model=self.config.model,
            config=types.GenerateContentConfig(
                system_instruction=base_prompt,
                tools=tools
            )
        )

        max_steps = 15
        last_out = ""
        last_script = boilerplate_code

        for step in range(1, max_steps + 1):
            print(f"[Orchestrator] Step {step}...")
            # If it's the first step, we send the initial message. 
            # If we have tool results, we send those as Part list.
            if step == 1:
                response = chat.send_message(user_msg)
            else:
                response = chat.send_message(last_out)
            
            tool_calls = [part.function_call for part in response.candidates[0].content.parts if part.function_call]
            text_content = "".join([part.text for part in response.candidates[0].content.parts if part.text]) or ""
            
            if tool_calls:
                tool_results = []
                for fc in tool_calls:
                    if fc.name == "test_run_script":
                        code = fc.args["script_content"]
                        print(f"[Orchestrator] Executing tool code...")
                        last_script = code
                        exec_out = ScriptExecutor.run(code)
                        tool_results.append(types.Part.from_function_response(
                            name="test_run_script",
                            response={"result": exec_out}
                        ))
                        last_out = exec_out # Keep for reporting if loop ends
                last_out = tool_results # Pass Part lists back to Gemini
            else:
                # Final answer check
                content = text_content
                code_in_text = self._extract_code(content)
                
                if code_in_text:
                    if code_in_text.strip() != last_script.strip():
                        print("[Orchestrator] Verifying code from text...")
                        last_script = code_in_text
                        last_out = ScriptExecutor.run(code_in_text)
                    
                    if "AGENT_ERROR" in last_out or "Exit Code: 1" in last_out:
                        last_out = f"Failed:\n{last_out}\nPlease fix."
                        continue
                    
                    if "AGENT_RESULT:" not in last_out and "AGENT_DISCOVERY:" not in last_out:
                        last_out = f"Failed:\nYour script completed but DID NOT output any metadata. You MUST print the single JSON block with either AGENT_RESULT: or AGENT_DISCOVERY: exactly as requested. Stdout:\n{last_out}\nPlease fix your script to print the final result."
                        continue
                
                # Usage tracking
                tokens = {}
                try:
                    tokens = {
                        "prompt_tokens": response.usage_metadata.prompt_token_count,
                        "candidates_tokens": response.usage_metadata.candidates_token_count,
                        "total_tokens": response.usage_metadata.total_token_count
                    }
                except: pass

                self._report_final(last_script, last_out, content, tokens)
                return

    def _extract_code(self, text):
        if not text: return ""
        m = re.findall(r"```python(.*?)```", text, re.DOTALL)
        if not m: return ""
        return m[-1].strip()

    def _report_final(self, script, output, text, usage):
        print("--- AGENT_FINAL_SCRIPT_START ---")
        print(script)
        print("--- AGENT_FINAL_SCRIPT_END ---")
        if usage: print(f"AGENT_TOKENS:{json.dumps(usage)}")
        
        # Discovery Metadata
        if "--- AGENT_DISCOVERY_METADATA_START ---" in text:
            meta = text.split("--- AGENT_DISCOVERY_METADATA_START ---")[1].split("--- AGENT_DISCOVERY_METADATA_END ---")[0]
            print(f"--- AGENT_DISCOVERY_METADATA ---\n{meta.strip()}")

        # Ensure output is string for concatenation
        out_str = output if isinstance(output, str) else str(output)
        concise = "\n".join([l for l in out_str.splitlines() if any(x in l for x in ["AGENT_RESULT:", "AGENT_DISCOVERY:", "AGENT_ERROR:"])])
        print(f"--- AGENT_EXECUTION_STDOUT ---\n{concise or out_str[-500:]}")

# ======================================================================================
# MAIN ENTRY POINT
# ======================================================================================
def main():
    try:
        cfg = Config()
        r2 = R2Service(cfg)
        
        # Phase 1: Sovereign Agent check (Workspace Isolation)
        # We check the 'agents' folder instead of the legacy 'system/scripts' cache
        agent_uri = f"s3://{cfg.bucket}/tenants/{cfg.tenant_id}/projects/{cfg.project_id}/agents/{cfg.task_name}.py"
        if r2.exists(agent_uri):
            print(f"[Main] SOVEREIGN AGENT HIT: {agent_uri}")
            code = r2.fetch_text(agent_uri)
            print(f"--- AGENT_EXECUTION_STDOUT ---\n{ScriptExecutor.run(code)}")
            return

        # Phase 2: Generation
        prompt_task = cfg.task_name.lower()
        base_task = prompt_task
        
        if base_task.startswith("normalization_"): 
            base_task = "data_normalizer"
            prompt_task = "data_normalizer"
        elif base_task.startswith("feature_engineering_"): 
            base_task = "feature_engineer"
            prompt_task = "feature_engineer"
        elif any(x in base_task for x in ["ml_architect", "ml_evaluator", "ml_trainer", "ml_inference", "data_profiler"]):
            for x in ["ml_architect", "ml_evaluator", "ml_trainer", "ml_inference", "data_profiler"]:
                if x in base_task:
                    # ml_trainer uses ml_evaluator boilerplate
                    base_task = "ml_evaluator" if x == "ml_trainer" else x
                    prompt_task = x
                    break
        elif base_task.startswith("query_generator"):
            base_task = "query_generator"
            # prompt_task remains "query_generator_v2" if that was requested
        
        bp_uri = f"s3://{cfg.bucket}/system/boilerplates/tasks/{base_task}.py"
        bp_code = r2.fetch_text(bp_uri)
        
        AgentOrchestrator(cfg, r2).run_discovery_loop(bp_code, prompt_task)

    except Exception as e:
        print(f"MANAGER_CRASH:{e}")
        traceback.print_exc()
        import sys; sys.exit(1)

if __name__ == "__main__":
    main()
