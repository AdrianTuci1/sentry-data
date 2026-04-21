import os
from pathlib import Path
from typing import Iterable, Optional, Tuple


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def candidate_env_files() -> Iterable[Path]:
    configured = os.getenv("ML_LAB_ENV_FILE") or os.getenv("SENTRY_BACKEND_ENV_FILE")
    if configured:
        yield Path(configured).expanduser()
    root = repo_root()
    yield root / "sentry-backend" / ".env"
    yield root / "ml-lab" / ".env"
    yield root / ".env"


def parse_env_line(line: str) -> Optional[Tuple[str, str]]:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        return None
    key, value = stripped.split("=", 1)
    key = key.strip()
    value = value.strip().strip("'").strip('"')
    if not key:
        return None
    return key, value


def load_ml_lab_env(override: bool = False) -> list[str]:
    loaded: list[str] = []
    for env_file in candidate_env_files():
        if not env_file.exists():
            continue
        for line in env_file.read_text(encoding="utf-8").splitlines():
            parsed = parse_env_line(line)
            if not parsed:
                continue
            key, value = parsed
            if override or key not in os.environ:
                os.environ[key] = value
                loaded.append(key)
        break
    return loaded
