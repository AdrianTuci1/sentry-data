import importlib.util
import os
from pathlib import Path

import modal


REPO_ROOT = Path(__file__).resolve().parents[1]
WORKER_LOCAL_DIR = REPO_ROOT / "sentry-analytics-worker"
WIDGETS_LOCAL_DIR = REPO_ROOT / "boilerplates" / "widgets"
WORKER_REMOTE_DIR = "/root/sentry-analytics-worker"
WIDGETS_REMOTE_DIR = "/opt/statsparrot/widgets"
NODE_RUNTIME_DIR = "/opt/statsparrot/node-runtime"
APP_NAME = "statsparrot-analytics-worker"

image = (
    modal.Image.debian_slim()
    .pip_install("fastapi[standard]", "pydantic", "duckdb", "python-dotenv")
    .run_commands(
        "apt-get update && apt-get install -y nodejs npm",
        "python -c \"import duckdb; con = duckdb.connect(); con.execute('INSTALL httpfs;'); print('httpfs pre-installed OK')\"",
        f"npm install --prefix {NODE_RUNTIME_DIR} js-yaml"
    )
    .add_local_dir(str(WORKER_LOCAL_DIR), remote_path=WORKER_REMOTE_DIR)
    .add_local_dir(str(WIDGETS_LOCAL_DIR), remote_path=WIDGETS_REMOTE_DIR)
)

app = modal.App(APP_NAME)


def load_worker_app():
    os.environ.setdefault("NODE_PATH", f"{NODE_RUNTIME_DIR}/node_modules")
    os.environ.setdefault("STATS_PARROT_WIDGETS_DIR", WIDGETS_REMOTE_DIR)
    os.environ.setdefault("STATS_PARROT_WIDGET_ARTIFACT_SCRIPT", f"{WIDGETS_REMOTE_DIR}/generate-artifacts.mjs")

    module_path = f"{WORKER_REMOTE_DIR}/main.py"
    spec = importlib.util.spec_from_file_location("statsparrot_analytics_worker_main", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load analytics worker from {module_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("sentry-r2-secrets")],
    timeout=1800,
    cpu=2.0,
    memory=4096
)
@modal.asgi_app()
def fastapi_app():
    return load_worker_app()


@app.local_entrypoint()
def main():
    print("StatsParrot Analytics Worker is ready.")
    print("Deploy: modal deploy modal_apps/analytics_worker.py")
    print("Serve:  modal serve modal_apps/analytics_worker.py")
