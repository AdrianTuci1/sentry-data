from pathlib import Path

from .config import PROMPT_DIR


def load_prompt(filename: str) -> str:
    return Path(PROMPT_DIR, filename).read_text(encoding="utf-8")
