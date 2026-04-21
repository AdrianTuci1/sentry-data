from .config import TrainingConfig, now_version
from .io import download_r2_prefix, upload_directory_to_r2


def train(*args, **kwargs):
    from .pipeline import train as run_train

    return run_train(*args, **kwargs)

__all__ = ["TrainingConfig", "download_r2_prefix", "now_version", "train", "upload_directory_to_r2"]
