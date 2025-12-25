from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.session import ChatSession, ChatMessage
from app.models.user import User

router = APIRouter()

# --- Schemas ---
class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Chat"
    user_id: int # In real auth, get from token

class ChatMessageCreate(BaseModel):
    content: str
    role: str # user / assistant

class ChatSessionOut(BaseModel):
    id: int
    title: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    timestamp: datetime
    class Config:
        from_attributes = True

# --- Endpoints ---

@router.post("/", response_model=ChatSessionOut)
def create_session(session_in: ChatSessionCreate, db: Session = Depends(get_db)):
    # Verify user exists (simplification)
    user = db.query(User).filter(User.id == session_in.user_id).first()
    if not user:
        # Create dummy user if not exists for demo flow simplicity
        user = User(id=session_in.user_id, email=f"user{session_in.user_id}@example.com", full_name="Demo User")
        db.add(user)
        db.commit()
    
    new_session = ChatSession(user_id=session_in.user_id, title=session_in.title)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.get("/", response_model=List[ChatSessionOut])
def get_user_sessions(user_id: int, db: Session = Depends(get_db)):
    return db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.created_at.desc()).all()

@router.get("/{session_id}/history", response_model=List[ChatMessageOut])
def get_session_history(session_id: int, db: Session = Depends(get_db)):
    # session verification can be added here
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp.asc()).all()
    return messages

@router.post("/{session_id}/messages", response_model=ChatMessageOut)
def add_message(session_id: int, msg: ChatMessageCreate, db: Session = Depends(get_db)):
    new_msg = ChatMessage(session_id=session_id, role=msg.role, content=msg.content)
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    return new_msg
