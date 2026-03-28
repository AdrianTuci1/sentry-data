from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Stats Parrot - Sentinel AI"
    API_V1_STR: str = "/api/v1"
    
    # Vector store config
    CHROMA_PERSIST_DIRECTORY: str = "./vector_db"
    
    # Sentinel Config
    DRIFT_THRESHOLD: float = 0.05
    ANOMALY_THRESHOLD: float = 0.1

    class Config:
        env_file = ".env"

settings = Settings()
