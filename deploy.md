# Sentry Platform — Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    VPS / Server                   │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Backend  │  │  Chat    │  │ Harness  │       │
│  │ :3000    │  │  :8080   │  │  :8081   │       │
│  │ Express  │  │  SSE+LLM │  │  BigQuery│       │
│  └────┬─────┘  └──────────┘  └────┬─────┘       │
│       │                            │             │
│       │  X-Internal-Token          │             │
│       ├────────────────────────────┤             │
│       │  proxy /chat/message       │             │
│       │                            │             │
│       │  trigger /generate         │             │
│       ├────────────────────────────┘             │
│                                                   │
│  External: GCP BigQuery, GCS, Gemini/OpenAI API   │
└─────────────────────────────────────────────────┘
```

## Quick start (Docker Compose)

```bash
# 1. Create .env file
cp .env.example .env
# Fill in secrets

# 2. Build and start
docker compose up -d

# 3. Verify
curl http://localhost:3000/health
```

## Environment Variables

### Backend (Express)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 3000 | HTTP port |
| NODE_ENV | No | development | production/development |
| JWT_SECRET | **Yes** | — | JWT signing secret |
| API_PREFIX | No | /api/v1 | API path prefix |
| CORS_ORIGIN | No | * | CORS allowed origin |
| CHAT_SERVICE_URL | No | http://localhost:8080 | Chat service URL |
| HARNESS_SERVICE_URL | No | http://localhost:8081 | Harness service URL |
| INTERNAL_TOKEN | **Yes** | — | Shared secret for service-to-service auth |
| GCP_PROJECT_ID | No | — | GCP project for BigQuery/GCS |
| GCS_BUCKET_NAME | No | sentry-platform-data | GCS bucket for specs/cache |
| ENABLE_MODAL_AGENTS | No | false | Legacy Modal flag (disable for VPS) |
| ENABLE_MELTANO_INGESTION | No | false | Meltano integration |
| ENABLE_BIGQUERY_ANALYTICS | No | false | BigQuery analytics queries |

### Chat Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 8080 | HTTP port |
| LLM_PROVIDER | No | gemini | gemini or openai |
| LLM_API_KEY | **Yes** | — | Gemini/OpenAI API key |
| LLM_MODEL | No | gemini-2.5-flash | Model name |
| BACKEND_URL | **Yes** | — | Backend API URL (for context) |
| INTERNAL_TOKEN | **Yes** | — | Must match backend |

### Harness Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 8081 | HTTP port |
| LLM_PROVIDER | No | gemini | gemini or openai |
| LLM_API_KEY | **Yes** | — | Gemini/OpenAI API key |
| LLM_MODEL | No | gemini-2.5-flash | Model name |
| GCS_BUCKET | **Yes** | — | GCS bucket for specs |
| INTERNAL_TOKEN | **Yes** | — | Must match backend |
| GOOGLE_APPLICATION_CREDENTIALS | **Yes** | — | GCP service account JSON path |

### Frontend (Vite)

Build-time env vars prefixed with `VITE_`:

| Variable | Default | Description |
|----------|---------|-------------|
| VITE_DEV_MODE | true | false for production |
| VITE_API_URL | http://localhost:3000/api/v1 | Backend API URL |
| VITE_PROMETHEUS_URL | http://localhost:9090 | Prometheus URL |

## GitHub Actions Deploy

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/sentry-data
            git pull origin main

            # Build and restart
            docker compose up -d --build

            # Build frontend
            cd sentry-frontend
            npm ci
            npx vite build --outDir ../backend/public

            # Restart
            cd ..
            docker compose restart backend

            # Cleanup old images
            docker image prune -f
```

## Services Directory

```
services/
├── chat/
│   ├── index.js       SSE streaming + LLM tools
│   ├── Dockerfile
│   └── package.json
└── harness/
    ├── index.js       BigQuery discovery + spec generation
    ├── Dockerfile
    └── package.json
```

## Deploy to Cloud Run (alternative to VPS)

```bash
# Chat service
cd services/chat
gcloud run deploy sentry-chat \
  --source . --region europe-west1 \
  --no-allow-unauthenticated \
  --set-env-vars LLM_PROVIDER=gemini,LLM_MODEL=gemini-2.5-flash,BACKEND_URL=https://api.example.com/api/v1,INTERNAL_TOKEN=secret

# Harness service
cd services/harness
gcloud run deploy sentry-harness \
  --source . --region europe-west1 \
  --no-allow-unauthenticated \
  --set-env-vars LLM_PROVIDER=gemini,LLM_MODEL=gemini-2.5-flash,GCS_BUCKET=sentry-platform-data,INTERNAL_TOKEN=secret
## Cleanup

Removed: `backend/src/harness/` (Python Modal harness)

Replaced by: `services/harness/` (Node.js, Docker/Cloud Run)
