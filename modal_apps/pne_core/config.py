import logging
import os
from pathlib import Path

PROMPT_DIR = "/root/r2-system/prompts/runtime"
WIDGETS_DIR = "/root/r2-system/widgets"
TRANSLATOR_VERSION = "pne-modal-v2-optimized"
INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "secret")
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_GEMINI_MODEL = os.getenv("PNE_GEMINI_MODEL", "gemini-2.5-flash")
WIDGET_CATALOG_PATH = Path(WIDGETS_DIR) / "catalog.yml"
LOGGER_NAME = "statsparrot.pne"


def get_logger() -> logging.Logger:
    logger = logging.getLogger(LOGGER_NAME)
    if not logger.handlers:
        logging.basicConfig(
            level=os.getenv("PNE_LOG_LEVEL", "INFO").upper(),
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
        )
    return logger


logger = get_logger()
