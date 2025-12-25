import uuid
import time
import random
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

# --- Domain Models (Internal State) ---

class AgentState(BaseModel):
    session_id: str
    current_mode: str = "chat" # chat, marketing, llm, image
    workspace_state: Dict[str, Any] = {}
    # Persist simplified metadata for simulation
    marketing_selected_cols: List[str] = []
    llm_config: Dict[str, Any] = {"lr": 0.001, "batch": 32}
    llm_run_status: Optional[Dict[str, Any]] = None
    image_queue: List[Dict[str, Any]] = []
    image_process_status: Optional[Dict[str, Any]] = None

# In-memory storage for demo sessions
sessions: Dict[str, AgentState] = {}

# --- MOCK DATA ---
MOCK_MARKETING_TABLES = [
    {
        "id": "users", "x": 50, "y": 50, "title": "Users",
        "columns": [
            {"id": "user_id", "name": "user_id", "type": "int", "status": "ok"},
            {"id": "age", "name": "age", "type": "int", "status": "warning", "issue": "Missing values (5%)"},
            {"id": "gender", "name": "gender", "type": "string", "status": "ok"},
            {"id": "signup_date", "name": "signup_date", "type": "date", "status": "ok"}
        ]
    }, # ... shortened for brevity, frontend has full copy or we can send all
    {
        "id": "campaigns", "x": 350, "y": 50, "title": "Campaigns",
        "columns": [
            {"id": "camp_id", "name": "campaign_id", "type": "int", "status": "ok"},
            {"id": "budget", "name": "budget", "type": "float", "status": "critical", "issue": "Outliers detected"},
            {"id": "channel", "name": "channel", "type": "string", "status": "ok"}
        ]
    },
    {
        "id": "interactions", "x": 200, "y": 300, "title": "Interactions",
        "columns": [
            {"id": "int_id", "name": "interaction_id", "type": "int", "status": "ok"},
            {"id": "user_ref", "name": "user_id", "type": "fk", "status": "ok"},
            {"id": "camp_ref", "name": "campaign_id", "type": "fk", "status": "ok"},
            {"id": "click", "name": "is_click", "type": "bool", "status": "ok"},
            {"id": "conv", "name": "conversion", "type": "bool", "status": "warning", "issue": "Imbalanced class"}
        ]
    }
]
MOCK_CONNECTIONS = [
     {"from_table": "users", "from_col": "user_id", "to_table": "interactions", "to_col": "user_ref"},
     {"from_table": "campaigns", "from_col": "camp_id", "to_table": "interactions", "to_col": "camp_ref"}
]

class AgentService:
    def get_or_create_session(self, session_id: str) -> AgentState:
        if session_id not in sessions:
            # Initialize Image Queue on first load
            q = [
                {"id": 101, "src": "IMG_492.jpg", "pred": "Scratch", "conf": 0.65},
                {"id": 102, "src": "IMG_493.jpg", "pred": "Normal", "conf": 0.52},
                {"id": 103, "src": "IMG_494.jpg", "pred": "Dent", "conf": 0.71},
            ]
            sessions[session_id] = AgentState(session_id=session_id, image_queue=q)
        return sessions[session_id]

    def process_interaction(self, session_id: str, user_input: str, action: Optional[str], payload: Dict[str, Any]) -> Dict[str, Any]:
        state = self.get_or_create_session(session_id)
        response = {
            "message": "I'm not sure how to help with that.",
            "current_workspace": "none",
            "workspace_data": {}
        }

        # --- 1. INTENT SWITCHING (Chat -> Mode) ---
        txt = (user_input or "").lower()
        if "marketing" in txt:
            state.current_mode = "marketing"
            response["message"] = "I've loaded the Marketing Data workspace. We need to select features for the conversion model. I've highlighted potential data quality issues."
        elif "llm" in txt or "train" in txt:
            if state.current_mode != "marketing": # Don't switch if just chatting about training
               state.current_mode = "llm"
               response["message"] = "I've prepared the LLM Fine-tuning environment. Please review the hyperparameters before we start the run."
        elif "image" in txt or "classify" in txt:
            state.current_mode = "image"
            response["message"] = "I've loaded the Active Learning queue. There are several low-confidence predictions from yesterday's batch that need human review."

        # --- 2. ACTION HANDLING (Mode Specific) ---
        
        # MARKETNG LOGIC
        if state.current_mode == "marketing":
            if action == "select_column":
                col_id = payload.get("col_id")
                if col_id:
                    if col_id in state.marketing_selected_cols:
                        state.marketing_selected_cols.remove(col_id)
                    else:
                        state.marketing_selected_cols.append(col_id)
                    response["message"] = f"Updated selection. Currently {len(state.marketing_selected_cols)} features selected."
            
            elif action == "train_model":
                 state.workspace_state["view"] = "results"
                 response["message"] = "Model trained successfully! The Random Forest classifier achieved 92.4% precision. The ROI is estimated at 3.5x."

            # Construct View Data
            if state.workspace_state.get("view") == "results":
                 response["current_workspace"] = "marketing_results"
                 response["workspace_data"] = {
                     "metrics": {"precision": 0.924, "recall": 0.881, "roi": 3.5},
                     "features": [
                        {"name": "previous_clicks", "val": 0.85},
                        {"name": "campaign_budget", "val": 0.65},
                     ]
                 }
            else:
                response["current_workspace"] = "marketing_engineering"
                response["workspace_data"] = {
                    "tables": MOCK_MARKETING_TABLES,
                    "connections": MOCK_CONNECTIONS,
                    "selected_columns": state.marketing_selected_cols
                }

        # LLM LOGIC
        elif state.current_mode == "llm":
            if action == "start_run":
                state.llm_run_status = {
                    "status": "running", "epoch": 1, "loss": 2.5, "time_left": 7200, "gpu": 94
                }
                response["message"] = "Training run #402 started. Monitoring GPU utilization..."
            
            elif action == "stop_run":
                 if state.llm_run_status: state.llm_run_status["status"] = "stopped"
                 response["message"] = "Training paused."

            if state.llm_run_status and state.llm_run_status["status"] == "running":
                # Sim progress
                s = state.llm_run_status
                s["loss"] = max(0.1, s["loss"] - 0.05)
                s["time_left"] -= 10
                if s["loss"] < 2.0 and s["epoch"] == 1: s["epoch"] = 2
                
                response["current_workspace"] = "llm_training"
                response["workspace_data"] = s
            else:
                response["current_workspace"] = "llm_setup"
                response["workspace_data"] = {
                    "dataset": "sentry_docs_v2.jsonl",
                    "config": state.llm_config
                }

        # IMAGE LOGIC
        elif state.current_mode == "image":
            if action == "label":
                img_id = payload.get("image_id")
                # Remove from queue
                state.image_queue = [i for i in state.image_queue if i["id"] != img_id]
                response["message"] = "Label saved. Continuing..."
            
            elif action == "start_process":
                 state.image_process_status = {
                     "status": "processing", "processed": 450, "total": 1000
                 }
                 response["message"] = "Batch processing started for 'Quality_Control_Day_2'."

            if state.image_process_status and state.image_process_status["status"] == "processing":
                 s = state.image_process_status
                 if s["processed"] < s["total"]:
                     s["processed"] += 15
                 else:
                     s["status"] = "completed"
                     response["message"] = "Batch processing complete."
                 
                 response["current_workspace"] = "image_processing"
                 response["workspace_data"] = s
            else:
                response["current_workspace"] = "image_review"
                response["workspace_data"] = {"queue": state.image_queue}

        return response

agent_service = AgentService()
