from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.core.config import settings
# from app.api.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/")
def root():
    return {"message": "Welcome to Sentry Data Backend"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

from app.api import websocket
from app.api.endpoints import chat, agent

# app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(websocket.router)
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(agent.router, prefix="/api/v1/agent", tags=["agent"])

from app.api.endpoints import lakehouse
app.include_router(lakehouse.router, prefix="/api/v1/lakehouse", tags=["lakehouse"])


