#!/bin/bash

# StatsParrot Unified Modal Deployment Script
# This script deploys both PNE and Sentinel services to Modal.

echo "🚀 Starting StatsParrot Unified Deployment..."

# 1. Deploy PNE
echo "----------------------------------------"
echo "🧠 Deploying PNE (Parrot Neural Engine)..."
modal deploy modal_apps/pne.py

# 2. Deploy Sentinel
echo "----------------------------------------"
echo "👮 Deploying Sentinel Service..."
# Note: sentinel.py imports from the sentinel_service package
modal deploy modal_apps/sentinel.py

echo "----------------------------------------"
echo "✅ Deployment Complete!"
echo "Check your Modal dashboard for the URLs and update your backend .env file:"
echo "  PNE_API_URL=https://<your-id>--statsparrot-pne-fastapi-app.modal.run"
echo "  SENTINEL_API_URL=https://<your-id>--statsparrot-sentinel-fastapi-app.modal.run"
echo "----------------------------------------"
