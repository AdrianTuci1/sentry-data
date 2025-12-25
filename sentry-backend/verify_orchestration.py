import asyncio
import sys
import os
import csv

# Add current directory to sys.path
sys.path.append(os.getcwd())

# Mocking duckdb and pydantic if not installed for the script to not crash immediately
# But the actual code imports them at top level... so we need them installed.
# We will assume user installs them as per instructions.

from app.services.orchestrator import orchestrator, WorkflowStatus

async def main():
    print("--- Testing Orchestration Flow ---\n")
    
    # 1. Create Dummy CSV
    csv_file = "sales.csv"
    with open(csv_file, "w") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "amount", "customer_id", "product", "sales_tax", "vat_price"])
        writer.writerow(["2024-01-01", "100", "C1", "P1", "10", "110"])
        writer.writerow(["2024-01-02", "150", "C2", "P1", "15", "165"])
    
    wf_id = "wf_test_1"
    
    # 2. Discovery
    print(f"1. Starting Discovery on {csv_file}...")
    proposals = await orchestrator.start_discovery(wf_id, csv_file)
    print(f"   Found {len(proposals)} proposals: {[p.title for p in proposals]}")
    
    if not proposals:
        print("   FAILED: No proposals found.")
        return

    # 3. Select Proposal (Forecasting)
    # The discovery service mocks proposals based on columns. "sales" -> Forecasting.
    target_proposal = next((p for p in proposals if "Forecast" in p.title), proposals[0])
    print(f"2. Selecting Proposal: {target_proposal.title} ({target_proposal.id})")
    
    await orchestrator.select_proposal(wf_id, target_proposal.id)
    
    # Allow async tasks to run slightly
    await asyncio.sleep(0.5)
    
    # 4. Check Status (Expect PAUSED due to 'sales' ambiguity trigger in mock)
    status = orchestrator.get_status(wf_id)
    print(f"3. Workflow Status: {status.status}")
    if status.status == WorkflowStatus.PAUSED:
        print(f"   Question: {status.last_human_question}")
        
        # 5. Provide Input
        print("4. Submitting Human Input: 'Use price_gross'")
        await orchestrator.submit_human_input(wf_id, "Use price_gross")
        
        # Check Final Status
        status = orchestrator.get_status(wf_id)
        print(f"5. Final Status: {status.status}")
        print(f"   Logs: {status.messages[-2:]}") # Last few logs
    
    else:
        print("   Didn't pause as expected (maybe heuristic didn't trigger).")
        print(f"   Logs: {status.messages}")

    # Cleanup
    if os.path.exists(csv_file):
        os.remove(csv_file)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except ImportError:
        print("Please install requirements first: pip install -r sentry-backend/requirements.txt")
