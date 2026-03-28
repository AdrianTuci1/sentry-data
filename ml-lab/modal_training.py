import modal
import os

# Define the image with all necessary ML dependencies
image = modal.Image.debian_slim().pip_install(
    "torch==2.1.1",
    "numpy==1.26.2",
    "pandas==2.1.3",
    "scikit-learn==1.3.2",
    "sentence-transformers",
    "duckdb"
).add_local_dir("models", remote_path="/root/models") \
 .add_local_dir("core", remote_path="/root/core") \
 .add_local_dir("datasets", remote_path="/root/datasets")

# Persistent volume for model weights
volume = modal.Volume.from_name("sentinel-ml-checkpoints", create_if_missing=True)

app = modal.App("sentinel-training")

@app.function(
    image=image,
    gpu="any", # Use any available GPU
    volumes={"/checkpoints": volume},
    timeout=1800 # 30 minutes
)
def train_drift_model(epochs: int = 50, lr: float = 0.001):
    import torch
    import torch.nn as nn
    import numpy as np
    from models.predictive_drift import LSTMDriftModel
    
    print("🚀 Starting training on Modal GPU...")
    
    # 1. Prepare simulated data (as per point 3 in CHECKPOINTS.md)
    # In a real scenario, this would load from S3/R2 or the Volume
    def generate_dummy_data(seq_len=10, num_samples=1000):
        X = np.random.rand(num_samples, seq_len, 1).astype(np.float32)
        # Target: 1 if last value is > 0.8, else 0 (very simple drift proxy)
        y = (X[:, -1, 0] > 0.8).astype(np.float32).reshape(-1, 1)
        return torch.from_numpy(X), torch.from_numpy(y)

    X_train, y_train = generate_dummy_data()
    
    # 2. Initialize Model, Loss, Optimizer
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    model = LSTMDriftModel().to(device)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    
    X_train, y_train = X_train.to(device), y_train.to(device)
    
    # 3. Training Loop
    model.train()
    for epoch in range(epochs):
        optimizer.zero_grad()
        outputs = model(X_train)
        loss = criterion(outputs, y_train)
        loss.backward()
        optimizer.step()
        
        if (epoch+1) % 10 == 0:
            print(f"Epoch [{epoch+1}/{epochs}], Loss: {loss.item():.4f}")
            
    # 4. Gold Discovery Automation (New Step)
    from core.gold_discovery import GoldDiscoveryEngine
    from core.data_loader import MultiSourceDataLoader
    from datasets.generator import generate_ga4_data, generate_marketing_data, generate_ecommerce_data
    
    # Simulate a full data collection session
    loader = MultiSourceDataLoader()
    loader.load_source("ga4", generate_ga4_data(100))
    loader.load_source("meta", generate_marketing_data(100, "meta"))
    loader.load_source("ecommerce", generate_ecommerce_data(100))
    df_unified = loader.get_unified_metrics()
    
    discovery = GoldDiscoveryEngine()
    gold_manifest = discovery.discover_gold_metrics(df_unified)
    
    # 5. Save Model + Gold Manifest to Volume
    os.makedirs("/checkpoints", exist_ok=True)
    
    # Model weights
    torch.save(model.state_dict(), "/checkpoints/drift_lstm.pth")
    
    # Gold Manifest
    with open("/checkpoints/gold_manifest.json", "w") as f:
        json.dump(gold_manifest, f, indent=2)
        
    volume.commit()
    
    print(f"✅ Training & Gold Discovery complete.")
    print(f"👉 Selected Gold Metrics: {gold_manifest['gold_layer']['selected_metrics']}")
    
    return {"status": "success", "gold_metrics": gold_manifest['gold_layer']['selected_metrics']}

@app.local_entrypoint()
def main():
    print("Preparing to run training remotely...")
    train_drift_model.remote()
