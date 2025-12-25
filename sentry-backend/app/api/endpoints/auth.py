from fastapi import APIRouter

router = APIRouter()

@router.post("/login")
def login():
    return {"msg": "Login endpoint placeholder"}

@router.post("/signup")
def signup():
    return {"msg": "Signup endpoint placeholder"}
