from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import asyncio

from app.services.discovery import DiscoveryService, Proposal
from app.services.agent.planner import AgentPlanner
from app.services.agent.executor import AgentExecutor
# Import manager from websocket (circular import risk handles via function call or delayed import in larger app)
# For simplicity, we import manager.
from app.api.websocket import manager

# --- Data Models ---
class WorkflowStatus(str, Enum):
    IDLE = "IDLE"
    DISCOVERY = "DISCOVERY"     # Analyzing data
    PROPOSAL = "PROPOSAL"       # Waiting for user to pick a model
    PLANNING = "PLANNING"       # Agent creating plan
    EXECUTION = "EXECUTION"     # Running steps
    PAUSED = "PAUSED"           # Waiting for Human Input
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class WorkflowState(BaseModel):
    id: str
    status: WorkflowStatus
    current_step_index: int = 0
    total_steps: int = 0
    proposals: List[Proposal] = []
    selected_proposal: Optional[Proposal] = None
    params: Dict[str, Any] = {}
    last_human_question: Optional[str] = None
    messages: List[str] = [] # Log of events

# --- Orchestrator ---
class Orchestrator:
    def __init__(self):
        self.active_workflows: Dict[str, WorkflowState] = {}
        self.discovery_service = DiscoveryService()
        self.planner = AgentPlanner()
        self.executor = AgentExecutor()

    def _get_workflow(self, workflow_id: str) -> WorkflowState:
        if workflow_id not in self.active_workflows:
            # Create new if doesn't exist for demo simplicity
            self.active_workflows[workflow_id] = WorkflowState(id=workflow_id, status=WorkflowStatus.IDLE)
        return self.active_workflows[workflow_id]

    async def start_discovery(self, workflow_id: str, file_path: str):
        wf = self._get_workflow(workflow_id)
        wf.status = WorkflowStatus.DISCOVERY
        wf.params["file_path"] = file_path
        wf.messages.append(f"Started discovery on {file_path}")
        await manager.broadcast_json({"type": "status", "status": "DISCOVERY", "msg": "Started discovery..."}, workflow_id)
        
        # Async execution
        proposals = await self.discovery_service.analyze_dataset(file_path)
        wf.proposals = proposals
        wf.status = WorkflowStatus.PROPOSAL
        wf.messages.append(f"Discovery complete. Found {len(proposals)} proposals.")
        await manager.broadcast_json({"type": "proposals", "proposals": [p.dict() for p in proposals]}, workflow_id)
        return list(proposals)

    async def select_proposal(self, workflow_id: str, proposal_id: str):
        wf = self._get_workflow(workflow_id)
        # Find proposal
        selected = next((p for p in wf.proposals if p.id == proposal_id), None)
        if not selected:
            raise ValueError("Invalid proposal ID")
        
        wf.selected_proposal = selected
        wf.status = WorkflowStatus.PLANNING
        wf.messages.append(f"Selected proposal: {selected.title}")
        await manager.broadcast_json({"type": "status", "status": "PLANNING", "msg": f"Selected {selected.title}"}, workflow_id)
        
        # Trigger Planning immediately
        asyncio.create_task(self._run_planning_and_execution(workflow_id))
        return {"status": "Planning started"}

    async def _run_planning_and_execution(self, workflow_id: str):
        wf = self._get_workflow(workflow_id)
        
        # 1. Plan
        query = f"Execute: {wf.selected_proposal.title}. {wf.selected_proposal.description}"
        plan_steps = await self.planner.plan(query)
        
        # Check for refusal based on guardrails
        if plan_steps and plan_steps[0].tool == "refuse_request":
             wf.status = WorkflowStatus.FAILED
             msg = f"Agent Refused: {plan_steps[0].args.get('reason')}"
             wf.messages.append(msg)
             await manager.broadcast_json({"type": "error", "msg": msg}, workflow_id)
             return

        wf.total_steps = len(plan_steps)
        wf.status = WorkflowStatus.EXECUTION
        await manager.broadcast_json({"type": "plan", "steps": [s.dict() for s in plan_steps]}, workflow_id)
        
        # 2. Execute Loop
        for i, step in enumerate(plan_steps):
            wf.current_step_index = i
            await manager.broadcast_json({"type": "progress", "step": i, "total": wf.total_steps, "tool": step.tool}, workflow_id)
            
            # --- SIMIPULATE HUMAN IN THE LOOP ---
            # Randomly determining if we need clarity (mock logic)
            # In real system, executor would return a "NEED_INPUT" signal
            if i == 0 and "sales" in wf.selected_proposal.target_variable.lower() if wf.selected_proposal.target_variable else False:
                 wf.status = WorkflowStatus.PAUSED
                 wf.last_human_question = "I found multiple price columns. Should I use 'price_net' or 'price_gross'?"
                 wf.messages.append("Paused for human input.")
                 await manager.broadcast_json({"type": "human_input_request", "question": wf.last_human_question}, workflow_id)
                 return # Exit loop, wait for callback

            result = await self.executor.execute_step(step.tool, step.args)
            wf.messages.append(f"Step {i+1} Result: {result}")
            await manager.broadcast_json({"type": "log", "msg": result}, workflow_id)
        
        wf.status = WorkflowStatus.COMPLETED
        wf.messages.append("Workflow completed successfully.")
        await manager.broadcast_json({"type": "status", "status": "COMPLETED"}, workflow_id)

    async def submit_human_input(self, workflow_id: str, answer: str):
        wf = self._get_workflow(workflow_id)
        if wf.status != WorkflowStatus.PAUSED:
            return {"error": "Workflow is not paused"}
        
        wf.messages.append(f"User Input: {answer}")
        wf.last_human_question = None
        wf.status = WorkflowStatus.EXECUTION
        
        # Resume execution (simplification: restarting loop or continuing)
        # For demo, just finish immediately
        wf.messages.append("Resuming with user input...")
        wf.status = WorkflowStatus.COMPLETED
        return {"status": "Resumed"}

    def get_status(self, workflow_id: str):
        return self._get_workflow(workflow_id)

orchestrator = Orchestrator()
