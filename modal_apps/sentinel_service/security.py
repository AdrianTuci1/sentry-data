from typing import Optional

from fastapi import HTTPException

from .config import INTERNAL_SECRET


def verify_internal_secret(x_internal_secret: Optional[str]) -> None:
    if x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized. Invalid internal secret.")
