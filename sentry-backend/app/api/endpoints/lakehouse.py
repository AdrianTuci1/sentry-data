from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Optional
from app.services.lakehouse import LakehouseService
from app.services.meltano_manager import MeltanoManager
from app.agents.etl_agent import ETLAgent

router = APIRouter()
lakehouse = LakehouseService()
meltano = MeltanoManager()
etl_agent = ETLAgent()

class ProjectCreate(BaseModel):
    project_id: str

class File(BaseModel):
    name: str
    path: str
    size: int
    last_modified: str
    type: str

class ETLRecommendation(BaseModel):
    type: str
    source: str
    action: str
    confidence: float
    description: str

class ConnectorCreate(BaseModel):
    plugin_name: str
    variant: Optional[str] = None
    type: str = "extractor" # extractor or loader

@router.get("/projects", response_model=List[str])
async def list_projects():
    return lakehouse.list_projects()

@router.post("/projects")
async def create_project(project: ProjectCreate):
    success = lakehouse.create_project_folder(project.project_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create project folder")
    return {"status": "created", "project_id": project.project_id}

@router.get("/projects/{project_id}/files", response_model=List[File])
async def list_files(project_id: str):
    return lakehouse.list_files(project_id)

@router.get("/projects/{project_id}/discover", response_model=List[ETLRecommendation])
async def discover_etl(project_id: str):
    return await etl_agent.discover_sources(project_id)

@router.post("/connectors")
async def add_connector(connector: ConnectorCreate):
    if connector.type == "extractor":
        result = meltano.add_extractor(connector.plugin_name, connector.variant)
    elif connector.type == "loader":
        result = meltano.add_loader(connector.plugin_name, connector.variant)
    else:
        raise HTTPException(status_code=400, detail="Invalid connector type")
        
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["stderr"])
    return result

@router.get("/connectors")
async def list_connectors():
    return meltano.list_plugins()
