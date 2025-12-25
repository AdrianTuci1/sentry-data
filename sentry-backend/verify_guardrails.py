import asyncio
import sys
import os

# Add current directory to sys.path
sys.path.append(os.getcwd())

from app.services.agent.planner import AgentPlanner

async def main():
    planner = AgentPlanner()

    test_queries = [
        "Train a Random Forest model on sales data.",
        "Build a snake game in Python.",
        "Create a dashboard for my model metrics.",
        "Write a script to scrape a movie website for fun.",
        "Analyze the null values in this csv."
    ]

    print("--- Testing Agent Guardrails ---\n")
    for query in test_queries:
        print(f"Query: '{query}'")
        # Since we are mocking the LLM check, this runs quickly
        steps = await planner.plan(query)
        if steps and steps[0].tool == "refuse_request":
            print(f"Result: REFUSED - {steps[0].args['reason']}")
        else:
            print("Result: ACCEPTED - " + str([s.description for s in steps]))
        print("-" * 30)

if __name__ == "__main__":
    asyncio.run(main())
