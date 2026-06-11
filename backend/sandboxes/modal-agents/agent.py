import os
import json
import modal
from google.cloud import storage, bigquery
from google.oauth2.credentials import Credentials

# Modal app definition
app = modal.App("sentry-agent")

# Image with dependencies
image = modal.Image.debian_slim().pip_install_from_requirements("requirements.txt")

@app.function(image=image, secrets=[modal.Secret.from_name("sentry-agent-secrets")])
def run_agent(session_id: str, org_id: str, project_id: str, context: dict, credentials: dict):
    """
    Main agent function that runs in Modal sandbox.
    Receives temporary credentials and context from backend.
    """
    # Initialize GCS client with temporary token
    gcs_creds = Credentials(token=credentials["gcsToken"])
    storage_client = storage.Client(project=credentials["bigQueryProjectId"], credentials=gcs_creds)
    bucket = storage_client.bucket(credentials["bucketName"])
    prefix = credentials["prefix"]
    
    # Initialize BigQuery client
    bq_creds = Credentials(token=credentials["gcsToken"])
    bq_client = bigquery.Client(project=credentials["bigQueryProjectId"], credentials=bq_creds)
    dataset_name = credentials["bigQueryDataset"]
    
    # Agent logic here
    result = {
        "sessionId": session_id,
        "orgId": org_id,
        "projectId": project_id,
        "status": "completed",
        "context": context,
        "output": {},
        "timestamp": modal.datetime.now().isoformat(),
    }
    
    # Save result to GCS
    result_blob = bucket.blob(f"{prefix}/results/{session_id}.json")
    result_blob.upload_from_string(json.dumps(result))
    
    # Notify backend webhook
    import requests
    webhook_url = os.environ.get("BACKEND_WEBHOOK_URL")
    if webhook_url:
        requests.post(
            f"{webhook_url}/organizations/{org_id}/projects/{project_id}/agents/{session_id}/webhook",
            json={"status": "completed", "result": result},
            headers={"X-Modal-Secret": os.environ.get("MODAL_WEBHOOK_SECRET", "")},
        )
    
    return result

@app.local_entrypoint()
def main():
    """Local testing entrypoint"""
    print("Sentry Agent - Modal Sandbox")
    print("Use backend API to launch agents")
