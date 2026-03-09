import modal
import os
import subprocess

# Imaginea de bază care conține toate dependințele necesare agenților
# Adăugăm agent_manager.py direct în imagine la Build-time pentru viteză maximă!
image = modal.Image.debian_slim() \
    .pip_install("pandas", "duckdb", "openai", "boto3", "scikit-learn", "fastapi") \
    .add_local_file("boilerplates/manager/agent_manager.py", "/root/agent_manager.py")

app = modal.App("sentry-sandbox-executor")

@app.function(image=image, secrets=[modal.Secret.from_name("sentry-r2-secrets")])
@modal.fastapi_endpoint(method="POST")
def sandbox_executor(data: dict):
    """
    Endpoint apelat de Node.js care primește instrucțiunile.
    Rulează agent_manager.py care este deja prezent în imagine.
    """
    env_vars = data.get("envVars", {})
    
    # Setăm variabilele de mediu (Prompts, R2 URIs etc.)
    # Modal le va aplica procesului de execuție
    for key, val in env_vars.items():
        os.environ[key] = str(val)

    try:
        # Fișierul este deja în /root/agent_manager.py datorită .add_local_file de mai sus!
        result = subprocess.run(
            ["python", "/root/agent_manager.py"],
            capture_output=True,
            text=True,
            timeout=600 # Agenții pot lucra mai mult timp (10 min)
        )
        return {
            "success": result.returncode == 0,
            "logs": result.stdout + "\n" + result.stderr,
            "error": None if result.returncode == 0 else result.stderr
        }
    except Exception as e:
        return {"success": False, "logs": "", "error": str(e)}
