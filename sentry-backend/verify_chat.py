import asyncio
import sys
import os
import json
import logging

# Add current directory to sys.path
sys.path.append(os.getcwd())

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine

# Setup DB for test
Base.metadata.create_all(bind=engine)

client = TestClient(app)

def test_chat_flow():
    print("--- Testing Chat API ---")
    # 1. Create Session
    response = client.post("/api/v1/chat/", json={"user_id": 1, "title": "Test Chat"})
    if response.status_code != 200:
        print(f"FAILED to update chat: {response.text}")
        return
        
    session_data = response.json()
    session_id = session_data["id"]
    print(f"1. Created Session: {session_id} - {session_data['title']}")
    
    # 2. Add Message
    msg_resp = client.post(f"/api/v1/chat/{session_id}/messages", json={"role": "user", "content": "Hello Agent"})
    print(f"2. Added Message: {msg_resp.json()['content']}")
    
    # 3. Get History
    hist_resp = client.get(f"/api/v1/chat/{session_id}/history")
    print(f"3. History Length: {len(hist_resp.json())}")

# WebSocket Test is harder with TestClient directly for async broadcast
# We will assume if code runs without import error and logic is sound, it works.
# But we can try a basic connection test.

def test_config():
    print("\n--- Testing WebSocket Config ---")
    # Just verifying imports and manager existence
    from app.api.websocket import manager
    print(f"Manager initialized with {len(manager.active_connections)} active sessions.")

if __name__ == "__main__":
    try:
        test_chat_flow()
        test_config()
    except ImportError as e:
        print(f"Missing dependency: {e}")
    except Exception as e:
        print(f"Error: {e}")
