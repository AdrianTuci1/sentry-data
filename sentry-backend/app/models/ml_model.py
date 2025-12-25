from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON
from app.core.database import Base

class MLModel(Base):
    __tablename__ = "ml_models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    version = Column(String, nullable=False)
    status = Column(String, default="training")  # training, ready, failed
    s3_path = Column(String, nullable=True)
    metrics = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
