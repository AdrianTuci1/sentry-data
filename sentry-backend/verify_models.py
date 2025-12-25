import sys
import os

# Add current directory to sys.path
sys.path.append(os.getcwd())

try:
    from app.core.database import Base, engine
    from app.models.user import User
    from app.models.session import ChatSession, ChatMessage
    from app.models.ml_model import MLModel
    print("SUCCESS: All models imported successfully.")
except ImportError as e:
    print(f"ERROR: Import failed - {e}")
except Exception as e:
    print(f"ERROR: {e}")
