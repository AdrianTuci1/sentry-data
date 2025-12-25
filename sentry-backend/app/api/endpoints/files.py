from fastapi import APIRouter

router = APIRouter()

@router.get("/scan")
def scan_files(path: str):
    return {"msg": f"Scan files at {path} placeholder"}
