import json
import os
from typing import Optional, Any
from app.core.config import settings

# In a real scenario, allow switching providers.
# using openai for now.
# pip install openai
import openai 

class LLMFactory:
    def __init__(self):
        # Initialize OpenAI client
        # In production, check prompt injection, etc.
        self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.default_model = "gpt-4-turbo-preview"

    async def complete(
        self, 
        prompt: str, 
        system_prompt: str, 
        json_mode: bool = False,
        model: str = None
    ) -> Any:
        try:
            response = await self.client.chat.completions.create(
                model=model or self.default_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"} if json_mode else None,
                temperature=0.0
            )
            
            content = response.choices[0].message.content
            if json_mode:
                return json.loads(content)
            return content
            
        except Exception as e:
            # Fallback or error handling
            print(f"LLM Error: {e}")
            if json_mode:
                return {}
            return f"Error communicating with AI: {str(e)}"

llm_client = LLMFactory()
