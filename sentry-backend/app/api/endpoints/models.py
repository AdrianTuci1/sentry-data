from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def list_models():
    return {"msg": "List models endpoint placeholder"}
