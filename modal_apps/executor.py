import modal
from fastapi import FastAPI


app = modal.App("statsparrot-runtime-scaffold")
web_app = FastAPI(title="StatsParrot Runtime Scaffold")
image = modal.Image.debian_slim().pip_install("fastapi[standard]")


@web_app.post("/api/v1/runtime/scaffold")
def runtime_scaffold(data: dict):
    return {
        "success": False,
        "status": "deprecated_agent_manager_removed",
        "message": (
            "The old sandbox agent manager was removed. Use PNE for projection plans, "
            "Sentinel for runtime evaluation, Analytics Worker for query execution, "
            "and ML Executor for approved model launches."
        ),
        "received": {
            "task": data.get("task") or data.get("taskName"),
        },
    }


@app.function(image=image, timeout=120)
@modal.asgi_app()
def fastapi_app():
    return web_app


@app.local_entrypoint()
def main():
    print("StatsParrot runtime scaffold is ready.")
    print("The old agent manager executor has been removed.")
    print("Deploy: modal deploy modal_apps/executor.py")
