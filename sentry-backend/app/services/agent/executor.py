from typing import Any, Dict
from e2b import Sandbox
from app.core.config import settings
from app.services.agent.tools import AgentTools

class AgentExecutor:
    def __init__(self):
        self.tools = AgentTools()

    async def execute_step(self, tool: str, args: Dict[str, Any]) -> str:
        if tool == "refuse_request":
            return f"Refused: {args.get('reason')}"
        
        # Tools supported by Planner
        if tool == "generate_code":
            instruction = args.get("instruction")
            filename = args.get("filename", "script.py")
            code = await self.tools.generate_python_code(instruction)
            
            # In a real flow, we might save this to S3 or just pass it to the next step state.
            # For now, we return it.
            return f"Generated Code for {filename}:\n{code}"

        if tool == "execute_code":
            # Just simulation of "execute" if we don't have the code. 
            # In a real plan, generate & execute might be combined or stateful.
            # For demonstration, let's assume 'code' is passed or we generate it on the fly if needed.
            # Ideally, the Planner passes the code or the previous step's output.
            
            # Let's assume we generate code here if it wasn't a separate step
            instruction = args.get("instruction", "Run analysis")
            code = await self.tools.generate_python_code(instruction)
            
            return await self._run_in_sandbox(code)
        
        if tool == "analyze_data":
            # Legacy tool support from mock planner
            code = await self.tools.generate_python_code(f"Analyze the data matching query: {args.get('query')}")
            return await self._run_in_sandbox(code)

        return f"Tool {tool} not implemented."

    async def _run_in_sandbox(self, code: str) -> str:
        if not settings.E2B_API_KEY:
            return "E2B_API_KEY not set. Skipping sandbox execution.\nCode:\n" + code

        try:
            # Initialize Sandbox
            # Using context manager is safiest for cleanup
            # sandbox = Sandbox(api_key=settings.E2B_API_KEY) # Sync API for simplicity in this demo wrapper
             # NOTE: Check if E2B SDK is async. Standard python SDK is sync usually, need to wrap or use async version if available.
             # Assuming standard usage:
             
             # from e2b import Sandbox
             # sandbox = Sandbox()
             # result = sandbox.process.run_code(code)
             # sandbox.close()
            
            # Mocking actual call to avoid hanging if key is invalid during verifying
            return f"[E2B SANDBOX MOCK] Executed Step.\nOutput: Success\n(Real execution pending valid Code Interpreter template)"

        except Exception as e:
            return f"Sandbox Execution Error: {str(e)}"
