# Sentry Platform — Infrastructure Architecture

## Runtime platforms

| Platform | Use case | Deploy | Cost model |
|----------|----------|--------|------------|
| **Express backend** | Main API, auth, CRUD, Meltano proxy | Local dev / GCE | Fixed VM |
| **Cloud Run** | Chat Agent, lightweight API agents | `gcloud run deploy` | Pay-per-request, $0 idle |
| **Modal** | Harness (BigQuery+LLM), ML training, heavy compute | `modal deploy` | Pay-per-second GPU/CPU |

## Why Cloud Run for Chat, not Modal

| | Cloud Run | Modal |
|---|---|---|
| Cold start | 0-2s | 5-30s |
| SSE/WebSocket | Native | Awkward |
| Auth (IAP) | Built-in | Manual |
| Scale to zero | Yes ($0 idle) | Yes ($0 idle) |
| Container size | Up to 32GB RAM | Up to 1TB RAM |
| GPU | No | Yes (A100, H100) |

**Rule: API agents → Cloud Run. Compute agents → Modal.**

---

## Auth Flow

```
┌──────────┐  JWT (Bearer ***)   ┌──────────────┐  X-Internal-Token  ┌─────────────┐
│ Frontend │ ──────────────────> │   Backend    │ ─────────────────> │  Cloud Run  │
│ (React)  │                     │  (Express)   │                    │  (Chat AI)  │
└──────────┘                     └──────────────┘                    └─────────────┘
                                       │                                    │
                                       │  User's JWT (backendToken)         │
                                       │  passed in body to Cloud Run       │
                                       │  so it can call backend APIs       │
                                       └────────────────────────────────────┘
```

1. Frontend authenticates with backend (`POST /auth/login` → JWT)
2. Frontend sends `Authorization: Bearer <jwt>` on every request
3. Backend validates JWT via `middleware/auth.js`
4. For Chat: backend proxies to Cloud Run with `X-Internal-Token` (service secret)
5. Cloud Run validates `X-Internal-Token` — no public endpoint
6. Cloud Run uses user's JWT (`backendToken` in body) to call backend APIs on user's behalf

**Frontend never talks to Cloud Run directly. Cloud Run has no public endpoint.**

---

## Environment variables

### Backend (Express)
```
PORT=3000
JWT_SECRET=...
CHAT_SERVICE_URL=http://localhost:8080  # or Cloud Run URL
INTERNAL_TOKEN=shared-secret-between-services
ENABLE_MODAL_AGENTS=true
MODAL_API_URL=...
```

### Chat Service (Cloud Run)
```
PORT=8080
LLM_PROVIDER=gemini
LLM_API_KEY=...
LLM_MODEL=gemini-2.5-flash
BACKEND_URL=http://backend:3000/api/v1
INTERNAL_TOKEN=shared-secret-between-services
```

---

## Service deployment

### Express backend
```bash
cd backend
npm install
npm start
```

### Chat Service (Cloud Run)
```bash
cd chat-service
gcloud run deploy sentry-chat \
  --source . \
  --region europe-west1 \
  --no-allow-unauthenticated \
  --set-env-vars LLM_PROVIDER=gemini,LLM_MODEL=gemini-2.5-flash,BACKEND_URL=https://api.example.com/api/v1,INTERNAL_TOKEN=<secret>
```

### Harness (Modal)
```bash
cd backend/src/harness
modal deploy modal_app.py
```

### Monitoring agent (Hermes cron)
```
Daily 9am → triggers backend POST /specs/:orgId/:projectId/generate
```

---

## Agent types and where they run

| Agent | Platform | Trigger | Purpose |
|-------|----------|---------|---------|
| Spec generator | Modal | API / new connector | Data discovery → widget spec |
| Monitoring | Modal | Daily cron | Freshness, schema, new tables |
| Chat AI | Cloud Run | Per message (SSE) | Conversational assistant |
| ML Trainer | Modal | Manual / scheduled | Model training + inference |

---

## Data flow summary

```
Sources (GA4, Stripe, ...)
  │
  ├── Meltano → BigQuery landing zone
  │     │
  │     ├── Transformations (scheduled queries)
  │     │     pageviews_clean, sessions_daily, conversions_clean
  │     │
  │     └── Harness (Modal)
  │           ├── Data discovery
  │           ├── Spec generation (LLM)
  │           └── dashboard_spec.json → GCS
  │
  ├── Frontend widgets
  │     ├── DataResolver (cache + route)
  │     │     ├── analytics/warehouse → BigQuery
  │     │     ├── prometheus → Prometheus API
  │     │     ├── api → REST endpoint
  │     │     └── demo → mock data
  │     └── WidgetRenderer (async, loading states)
  │
  ├── Chat AI (Cloud Run)
  │     ├── SSE streaming
  │     ├── Context injection (org, project, catalog)
  │     └── 5 tools: connect, widget, suggest, query, navigate
  │
  └── Monitoring (daily)
        ├── Freshness check
        ├── Schema drift
        ├── New table detection → trigger harness
        └── Alerts → Firestore
```
