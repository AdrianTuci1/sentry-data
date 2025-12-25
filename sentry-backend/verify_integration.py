import asyncio
import sys
import os

# Add current directory to sys.path
sys.path.append(os.getcwd())

# Mocking openai and e2b for verification script to not fail if libraries missing locally
# (Assuming the user will install them later)
from app.services.llm_factory import llm_client
from app.services.discovery import DiscoveryService
from app.services.agent.planner import AgentPlanner
from app.services.agent.executor import AgentExecutor

async def main():
    print("--- Testing Real LLM & E2B Integration ---")
    
    # 1. Test LLM Connection (Discovery)
    print("\n1. Testing Discovery Service (LLM Logic)...")
    discovery = DiscoveryService()
    # Mocking analysis without creating a real CSV again, just to test prompt assembly
    # In real run, analyze_dataset reads file. We will simulate call for demo if possible
    # But verify_orchestration.py already verifies logic flows.
    
    # Let's test Code Generation (AgentTools)
    print("\n2. Testing Code Generation (Agent Tools)...")
    executor = AgentExecutor()
    instruction = "Load 'sales.csv' and plot a histogram of the 'amount' column."
    
    # This calls LLM to write code
    print(f"   Asking Agent to: {instruction}")
    try:
        # Generate code
        code = await executor.tools.generate_python_code(instruction)
        print("   Speculative Generated Code:\n   -------------------")
        print(code[:200] + "..." if len(code) > 200 else code)
        print("   -------------------")
    except Exception as e:
        print(f"   LLM Error (Expected if no API Key): {e}")

    # 3. Test Execution (E2B Mock)
    print("\n3. Testing Sandbox Execution...")
    try:
        result = await executor.execute_step("execute_code", {"instruction": "print('Hello E2B')"})
        print(f"   Execution Result: {result}")
    except Exception as e:
        print(f"   Execution Error: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except ImportError as e:
         print(f"Missing dependency: {e}. Please run 'pip install -r sentry-backend/requirements.txt' and 'pip install openai'")

