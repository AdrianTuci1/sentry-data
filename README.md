# Sentry Platform

> **Social Media Intelligence & Analytics Platform** — Monitorizează, analizează și optimizează prezența brandurilor pe rețele sociale cu ajutorul AI.

Platformă completă de analytics și monitorizare social media, structurată pe 3 nivele ierarhice: **Account → Organization → Project**. Rulează nativ pe **Google Cloud Platform** cu suport AI generativ.

---

## Arhitectura Sistemului

```
┌─────────────────────────────────────────────────────────────────┐
│                        SENTRY PLATFORM                           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    Frontend (React + Vite)                │    │
│  │  Dashboard · Analytics · Integrations · Chat · Graph    │    │
│  │           Organization Management · Billing              │    │
│  └──────────────────────┬───────────────────────────────────┘    │
│                         │ JWT Bearer                              │
│  ┌──────────────────────▼───────────────────────────────────┐    │
│  │             Backend API (Express + Node.js)               │    │
│  │  Auth · CRUD · RBAC · Proxy · Analytics · Integrations   │    │
│  └────┬────────────┬──────────────┬────────────────────┬────┘    │
│       │            │              │                    │          │
│       │            │    X-Internal-Token                │          │
│  ┌────▼────┐  ┌────▼────┐  ┌──────▼──────┐  ┌─────────▼──────┐  │
│  │Firestore│  │  GCS    │  │Chat Service │  │ Harness Service│  │
│  │Metadata │  │Storage  │  │  (Cloud Run) │  │  (Cloud Run)   │  │
│  │(NoSQL)  │  │(Objects)│  │  SSE + LLM  │  │  Discovery +   │  │
│  └─────────┘  └─────────┘  │  Gemini AI  │  │  Spec Gen      │  │
│                            └─────────────┘  └────────────────┘  │
│                                                    │              │
│                                               ┌────▼──────────┐  │
│                                               │   BigQuery    │  │
│                                               │   Analytics   │  │
│                                               └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Structura Ierarhică

```
Account (Facturare & Securitate Globală)
  └── Organization (Operațional & Planuri)
        ├── Members & Roles (RBAC)
        ├── Billing (Stripe)
        └── Projects (Sandbox-uri de lucru)
              ├── Data Sources (conectori)
              ├── Integrations
              ├── Analytics & Dashboards
              └── Chat AI Sessions
```

---

## Tehnologii & Stack

| Componentă | Tehnologie | Rol |
|---|---|---|
| **Frontend** | React 19 + Vite + Zustand + Tailwind CSS 4 | UI dashboard, analytics, chat |
| **Backend API** | Node.js 20+ / Express | API REST, auth, RBAC, orchestration |
| **Firestore** | Google Cloud Firestore | Metadate ierarhice (orgs, proiecte, users) |
| **BigQuery** | Google BigQuery | Stocare și interogare date analitice |
| **GCS** | Google Cloud Storage | Landing zone ingestie, spec-uri, cache |
| **Chat AI** | Cloud Run + Google Gemini 2.5 Flash | Agent conversațional SSE cu 5 tools |
| **Harness** | Cloud Run + Google Gemini 2.5 Flash | Data discovery, spec generation |
| **Auth** | JWT + bcrypt | Autentificare + roluri RBAC (user/admin/owner) |
| **Billing** | Stripe | Gestiune abonamente și facturi |
| **Infrastructure** | Docker Compose | Dezvoltare locală |

---

## Servicii

### 1. Backend API (`/backend`)
API Express ce orchestrează întreaga platformă:
- **Auth** — register, login, JWT, RBAC
- **Organizations** — CRUD, plan management, limite
- **Projects** — CRUD, settings, GCS signed URLs
- **Analytics** — SQL queries, schema discovery, dashboard metrics
- **Chat** — proxy către Cloud Run Chat Service
- **Integrations** — Meltano (legacy) și conectori BigQuery Data Transfer
- **Agents** — sesiuni AI, lansare pe Modal (legacy)
- **AI Specs** — endpoint pentru generare specificații widget-uri
- **Alerts** — sistem de alertare și monitorizare

### 2. Chat AI Service (`/services/chat`)
Agent conversațional cu streaming SSE (Server-Sent Events):
- Context specific proiectului (org, workspace, catalog)
- 5 tool-uri: connect, widget, suggest, query, navigate
- Rulează pe Cloud Run (scale-to-zero)
- LLM: Google Gemini 2.5 Flash

### 3. Harness Service (`/services/harness`)
Engine de data discovery și spec generation:
- Descoperire automată tabele și coloane în BigQuery
- Generare specificații widget-uri (Vega-Lite)
- Clasificare coloane pe categorii (dimensiuni, metrici, date)
- Rulează pe Cloud Run

### 4. Frontend (`/frontend`)
Aplicație React 19 cu Vite:
- Dashboard cu widget-uri configurabile
- Editor de grafice (Vega-Lite + Vega-Embed)
- Chat AI integrat
- Mindmap pentru vizualizare flux date
- Organization & Project management
- Billing UI cu planuri de pricing
- Integrations manager

---

## Planuri de Pricing

| Feature | Free | Launch ($50/mo) | Scale ($150/mo) | Enterprise |
|---|---|---|---|---|
| Users | 1 | Unlimited | Unlimited | Unlimited |
| Proiecte | 1 | 5 | 20 | Custom |
| Storage | 20 GB pooled | 150 GB pooled | 500 GB pooled | Custom |
| Refresh | 1h | 1h | 10 min | Live |
| Chat AI | ✓ | ✓ | ✓ | ✓ |
| AI Sentiment | ✓ | ✓ | ✓ | ✓ |
| Service Accounts | — | 2 | 5 | Unlimited |
| Integrations (Slack) | — | — | ✓ | ✓ |
| Engagement Tracking | — | Likes, Comments | Likes, Comments | Likes, Comments |
| Influencer Analysis | — | ✓ | ✓ | ✓ |
| Presence Score | — | 1 account | 5 accounts | Unlimited |

---

## Infrastructura Cloud (GCP)

### Cost Estimare (100 Free Users)

| Componentă | Cost/lună |
|---|---|
| BigQuery (storage 20GB + 1K query-uri) | ~$1 |
| LLM (Gemini 2.5 Flash — Chat AI) | ~$4 |
| Cloud Run (Chat + Harness) | ~$34 |
| VPS (backend Express) | ~$25 |
| Firestore + GCS | ~$7 |
| **Total** | **~$70/lună** |

### Cost per utilizator (Free): ~$0.70/lună

---

## Quick Start — Local Development

```bash
# 1. Clonează repository-ul
git clone git@github.com:AdrianTuci1/sentry-data.git
cd sentry-data

# 2. Copiază și configurează .env
cp .env.example .env
# Completează JWT_SECRET, LLM_API_KEY, INTERNAL_TOKEN, etc.

# 3. Pornește totul cu Docker Compose
docker compose up -d --build

# 4. Verifică sănătatea serviciilor
curl http://localhost:3000/health

# 5. Pentru development frontend separat:
cd frontend
npm install
npm run dev
```

### Variabile de Mediu Principale

| Variabilă | Descriere |
|---|---|
| `JWT_SECRET` | Secret pentru semnarea token-urilor JWT |
| `LLM_API_KEY` | Cheie API Gemini (sau OpenAI) |
| `INTERNAL_TOKEN` | Token partajat între servicii |
| `GCP_PROJECT_ID` | ID-ul proiectului GCP |
| `GCS_BUCKET_NAME` | Numele bucket-ului GCS |
| `ENABLE_BIGQUERY_ANALYTICS` | Activează/dezactivează BigQuery |
| `LLM_PROVIDER` | `gemini` sau `openai` |
| `LLM_MODEL` | Modelul LLM (ex: `gemini-2.5-flash`) |

---

## API Endpoints (principale)

### Auth
- `POST /api/v1/auth/register` — Înregistrare
- `POST /api/v1/auth/login` — Autentificare

### Organizations
- `POST /api/v1/organizations` — Creare organizație
- `GET /api/v1/organizations` — Listă organizații
- `GET /api/v1/organizations/:orgId` — Detalii
- `PATCH /api/v1/organizations/:orgId` — Update
- `DELETE /api/v1/organizations/:orgId` — Ștergere

### Projects
- `POST /api/v1/organizations/:orgId/projects` — Creare proiect
- `GET /api/v1/organizations/:orgId/projects` — Listă proiecte
- `GET /api/v1/organizations/:orgId/projects/:projectId/settings` — Setări
- `POST /api/v1/organizations/:orgId/projects/:projectId/gcs-url` — Signed URL GCS

### Analytics
- `POST /api/v1/organizations/:orgId/projects/:projectId/analytics/query` — SQL query
- `GET /api/v1/organizations/:orgId/projects/:projectId/analytics/schema` — Schema tabelelor
- `GET /api/v1/organizations/:orgId/projects/:projectId/analytics/dashboard` — Dashboard metrics

### Chat
- `POST /api/v1/organizations/:orgId/projects/:projectId/agents` — Creare sesiune chat
- `POST /api/v1/organizations/:orgId/projects/:projectId/agents/:sessionId/message` — Trimite mesaj (SSE)

### Specs
- `POST /api/v1/organizations/:orgId/projects/:projectId/specs/generate` — Generează specificații widget

---

## Securitate

- **JWT** pentru autentificare utilizatori
- **RBAC** cu roluri: `user`, `admin`, `owner`
- **X-Internal-Token** pentru comunicare între servicii (backend ↔ Cloud Run)
- **GCS Signed URLs** cu expirare limitată
- **Izolare BigQuery** per proiect (dataset dedicat)
- **CORS** configurat din variabile de mediu
- **Helmet** headere de securitate HTTP

---

## Licență

Proprietar — Sentry Platform
