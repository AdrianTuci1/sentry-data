from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.services.agent_service import agent_service

router = APIRouter()

class AgentInteractRequest(BaseModel):
    session_id: str
    user_input: Optional[str] = None
    action: Optional[str] = None
    payload: Dict[str, Any] = {}

class AgentInteractResponse(BaseModel):
    message: str
    current_workspace: str
    workspace_data: Dict[str, Any]

@router.post("/interact", response_model=AgentInteractResponse)
def interact(req: AgentInteractRequest):
    """
    Unified endpoint for User <-> Agent interaction.
    Handles chat text, intent switching, and UI actions (clicks).
    """
    response = agent_service.process_interaction(
        req.session_id, req.user_input, req.action, req.payload
    )
    return response
