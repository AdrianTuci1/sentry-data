#!/bin/bash

# StatsParrot Unified Modal Deployment Script
# This script deploys both PNE and Sentinel services to Modal.

# Ensure we are running from the project root
cd "$(dirname "$0")/.."

echo "🚀 Starting StatsParrot Unified Deployment..."

# 1. Deploy PNE
echo "----------------------------------------"
echo "🧠 Deploying PNE (Parrot Neural Engine)..."
python3 -m modal deploy modal_apps/pne.py

# 2. Deploy Sentinel
echo "----------------------------------------"
echo "👮 Deploying Sentinel Service..."
# Note: sentinel.py imports from the sentinel_service package
python3 -m modal deploy modal_apps/sentinel.py

# 3. Deploy Analytics Worker
echo "----------------------------------------"
echo "📊 Deploying Analytics Worker..."
python3 -m modal deploy modal_apps/analytics_worker.py

echo "----------------------------------------"
echo "✅ Deployment Complete!"
echo "Check your Modal dashboard for the URLs and update your backend .env file:"
echo "  PNE_API_URL=https://<your-id>--statsparrot-pne-fastapi-app.modal.run"
echo "  SENTINEL_API_URL=https://<your-id>--statsparrot-sentinel-fastapi-app.modal.run"
echo "  ANALYTICS_WORKER_API_URL=https://<your-id>--statsparrot-analytics-worker-fastapi-app.modal.run"
echo "----------------------------------------"
