from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.services.orchestrator import orchestrator, WorkflowStatus, Proposal

router = APIRouter()

class StartDiscoveryRequest(BaseModel):
    file_path: str

class ProposalSelectionRequest(BaseModel):
    proposal_id: str

class HumanInputRequest(BaseModel):
    answer: str

@router.post("/discovery/{workflow_id}")
async def start_discovery(workflow_id: str, request: StartDiscoveryRequest):
    """
    Step 1: Uploads file (mocked as path) and starts discovery analysis.
    Returns generated proposals.
    """
    proposals = await orchestrator.start_discovery(workflow_id, request.file_path)
    return {"workflow_id": workflow_id, "proposals": proposals}

@router.get("/{workflow_id}/status")
async def get_workflow_status(workflow_id: str):
    """
    Get current state, logs, and any pending questions for the user.
    """
    return orchestrator.get_status(workflow_id)

@router.post("/{workflow_id}/select_proposal")
async def select_proposal(workflow_id: str, request: ProposalSelectionRequest):
    """
    Step 2: User selects a proposal. Agent starts planning and execution.
    """
    try:
        res = await orchestrator.select_proposal(workflow_id, request.proposal_id)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{workflow_id}/human_input")
async def submit_human_input(workflow_id: str, request: HumanInputRequest):
    """
    Step 3 (Optional): User provides answer to agent's question during PAUSED state.
    """
    res = await orchestrator.submit_human_input(workflow_id, request.answer)
    return res

@router.post("/trigger")
def trigger_workflow():
    # Keep old placeholder just in case
    return {"msg": "Legacy trigger - use new orchestration endpoints."}
