from typing import List, Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # session_id -> List[WebSocket]
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str, session_id: str):
        # if session_id is "all", broadcast to everyone (optional)
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                await connection.send_text(message)

    async def broadcast_json(self, data: dict, session_id: str):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                await connection.send_json(data)

manager = ConnectionManager()

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            data_text = await websocket.receive_text()
            # Handle incoming user message
            # logic: forward to Orchestrator or just verify liveliness
            try:
                data = json.loads(data_text)
                message_type = data.get("type")
                content = data.get("content")
                
                # If responding to human input question
                if message_type == "human_input":
                     from app.services.orchestrator import orchestrator
                     # We assume workflow_id is linked to session_id somehow, 
                     # OR the frontend passes workflow_id in the message payload.
                     workflow_id = data.get("workflow_id")
                     if workflow_id:
                         await orchestrator.submit_human_input(workflow_id, content)
                         await manager.broadcast_json({"type": "system", "content": "Input received, resuming..."}, session_id)
                
            except json.JSONDecodeError:
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
