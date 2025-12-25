from app.services.llm_factory import llm_client

class AgentTools:
    def __init__(self):
        pass

    async def generate_python_code(self, instruction: str, context: str = "") -> str:
        """
        Generates Python code based on the instruction.
        """
        CODE_PROMPT = f"""
        You are a Python Expert. Write a valid Python script to accomplish the following:
        
        Instruction: {instruction}
        Context: {context}
        
        Requirements:
        - The code should be self-contained.
        - Print the output of the analysis or training metrics to stdout so we can capture it.
        - If creating files, save them to the current directory.
        
        Return ONLY the python code, no markdown backticks.
        """
        
        code = await llm_client.complete(CODE_PROMPT, "You are a Python Expert.")
        # Cleanup markdown if present
        code = code.strip()
        if code.startswith("```python"):
            code = code[9:]
        if code.startswith("```"):
            code = code[3:]
        if code.endswith("```"):
            code = code[:-3]
            
        return code.strip()
