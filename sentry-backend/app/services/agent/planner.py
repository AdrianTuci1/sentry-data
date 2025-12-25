import json
from typing import List, Optional
from pydantic import BaseModel

from app.services.agent.prompts import SYSTEM_PROMPT, GUARDRAIL_CHECK_PROMPT
from app.services.llm_factory import llm_client

class Step(BaseModel):
    id: int
    description: str
    tool: str
    args: dict

class AgentPlanner:
    def __init__(self):
        pass

    async def check_guardrails(self, query: str) -> bool:
        """
        Uses LLM to check if the query is allowed.
        """
        prompt = GUARDRAIL_CHECK_PROMPT.format(query=query)
        result = await llm_client.complete(prompt, "You are a content moderator.", json_mode=True)
        # Default to False if error
        return result.get("allowed", False)

    async def plan(self, query: str) -> List[Step]:
        # 1. Check Guardrails
        is_allowed = await self.check_guardrails(query)
        if not is_allowed:
            return [
                Step(
                    id=0,
                    description="Refuse request due to guardrails.",
                    tool="refuse_request",
                    args={"reason": "Request falls outside the Machine Learning/Data Science domain."}
                )
            ]

        # 2. Plan Generation
        # For simplicity in this demo, we'll map a basic plan.
        # Ideally, we ask the LLM to return a JSON list of steps.
        PLAN_PROMPT = f"""
        User Query: {query}
        
        Break this down into sequential steps to achieve the goal using available tools.
        Available Tools:
        - "generate_code": Write a Python script. args: {{"instruction": "what to write", "filename": "script.py"}}
        - "execute_code": Run a python script. args: {{"filename": "script.py"}}
        
        Return a JSON object with a key "steps" containing a list of objects {{ "id": int, "description": str, "tool": str, "args": dict }}.
        """
        
        plan_data = await llm_client.complete(PLAN_PROMPT, SYSTEM_PROMPT, json_mode=True)
        steps_raw = plan_data.get("steps", [])
        
        steps = []
        for s in steps_raw:
             steps.append(Step(**s))
             
        return steps
