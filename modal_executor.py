import modal
import os
import subprocess

# Imaginea de bază care conține toate dependințele necesare agenților
# Adăugăm agent_manager.py direct în imagine la Build-time pentru viteză maximă!
image = modal.Image.debian_slim() \
    .pip_install("pandas", "duckdb", "google-genai", "boto3", "scikit-learn", "fastapi", "pyyaml", "xgboost", "lifelines", "shap", "textblob", "vaderSentiment", "lightgbm") \
    .run_commands(
        # Pre-install DuckDB httpfs extension at image build time.
        # This avoids a 30-90s INSTALL download at every sandbox cold start.
        "python -c \"import duckdb; con = duckdb.connect(); con.execute('INSTALL httpfs;'); print('httpfs pre-installed OK')\""
    ) \
    .add_local_file("boilerplates/manager/agent_manager.py", "/root/agent_manager.py")

app = modal.App("sentry-sandbox-executor")

@app.function(image=image, secrets=[modal.Secret.from_name("sentry-r2-secrets")], cpu=2.0, memory=2048, timeout=600)
@modal.fastapi_endpoint(method="POST")
def sandbox_executor(data: dict):
    """
    Endpoint apelat de Node.js care primește instrucțiunile.
    Rulează agent_manager.py care este deja prezent în imagine.
    """
    env_vars = data.get("envVars", {})
    
    # We must NOT mutate os.environ globally since Modal endpoints are 
    # executed concurrently in the same process/container instance.
    local_env = os.environ.copy()
    for key, val in env_vars.items():
        local_env[key] = str(val)

    try:
        # Fișierul este deja în /root/agent_manager.py datorită .add_local_file de mai sus!
        result = subprocess.run(
            ["python", "/root/agent_manager.py"],
            env=local_env,
            capture_output=True,
            text=True,
            timeout=540  # 9 min — sub limita de 600s a funcției Modal
        )
        return {
            "success": result.returncode == 0,
            "logs": result.stdout + "\n" + result.stderr,
            "error": None if result.returncode == 0 else result.stderr
        }
    except subprocess.TimeoutExpired as te:
        return {
            "success": False,
            "logs": (te.stdout or "") + "\n" + (te.stderr or ""),
            "error": f"Agent timed out after {te.timeout}s. Partial logs above."
        }
    except Exception as e:
        return {"success": False, "logs": "", "error": str(e)}

@app.local_entrypoint()
def main():
    """
    Permite rularea: modal run modal_executor.py
    Utilitate: Verifică dacă aplicația Modal este configurată corect.
    """
    print("✅ Modal App 'sentry-sandbox-executor' is ready.")
    print("👉 To deploy as a permanent API: modal deploy modal_executor.py")
    print("👉 To run in dev mode (hot-reload): modal serve modal_executor.py")
