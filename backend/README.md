# Sentry Backend

Backend complet pentru platforma Sentry - sistem ierarhic de date si analytics AI.

## Arhitectura

```
Account > Organization > Project
```

## Tehnologii

- **Node.js 20+** cu Express
- **Google Cloud Firestore** - metadate ierarhice
- **Google Cloud Storage** - stocare fisiere
- **Google BigQuery** - analytics
- **Modal** - sandbox agenti AI
- **Meltano** - ingestie date
- **Terraform** - infrastructura GCP

## Structura

```
backend/
├── src/
│   ├── app.js                 # Entry point
│   ├── config/                # Configurare
│   ├── routes/                # API routes
│   ├── services/              # Business logic (OOP)
│   ├── models/                # Domain models
│   ├── middleware/            # Express middleware
│   └── utils/                 # Utilities
├── terraform/                 # Infrastructure as Code
├── sandboxes/                 # Modal agents
└── Dockerfile
```

## Design Patterns

- **Singleton** - GcpService (clienti GCP)
- **Repository** - Fiecare service interactioneaza cu Firestore
- **Factory** - Creare modele din Firestore
- **Facade** - GcpService abstractizeaza complexitatea GCP

## API Endpoints

### Auth
- `POST /api/v1/auth/register` - Inregistrare
- `POST /api/v1/auth/login` - Autentificare

### Organizations
- `POST /api/v1/organizations` - Creare organizatie
- `GET /api/v1/organizations` - Lista organizatii
- `GET /api/v1/organizations/:orgId` - Detalii
- `PATCH /api/v1/organizations/:orgId` - Update
- `DELETE /api/v1/organizations/:orgId` - Stergere

### Projects
- `POST /api/v1/organizations/:orgId/projects` - Creare proiect
- `GET /api/v1/organizations/:orgId/projects` - Lista proiecte
- `GET /api/v1/organizations/:orgId/projects/:projectId` - Detalii
- `PATCH /api/v1/organizations/:orgId/projects/:projectId` - Update
- `DELETE /api/v1/organizations/:orgId/projects/:projectId` - Stergere
- `GET /api/v1/organizations/:orgId/projects/:projectId/settings` - Setari
- `POST /api/v1/organizations/:orgId/projects/:projectId/gcs-url` - Signed URL

### Agents
- `POST /api/v1/organizations/:orgId/projects/:projectId/agents` - Creare sesiune
- `GET /api/v1/organizations/:orgId/projects/:projectId/agents` - Lista sesiuni
- `POST /api/v1/organizations/:orgId/projects/:projectId/agents/:sessionId/launch` - Lanseaza pe Modal
- `POST /api/v1/organizations/:orgId/projects/:projectId/agents/:sessionId/webhook` - Callback Modal

### Integrations
- `POST /api/v1/organizations/:orgId/projects/:projectId/integrations` - Creare
- `GET /api/v1/organizations/:orgId/projects/:projectId/integrations` - Lista
- `GET /api/v1/organizations/:orgId/projects/:projectId/integrations/:id/meltano-config` - Config Meltano

### Analytics
- `POST /api/v1/organizations/:orgId/projects/:projectId/analytics/query` - SQL query
- `GET /api/v1/organizations/:orgId/projects/:projectId/analytics/schema` - Schema tabele
- `GET /api/v1/organizations/:orgId/projects/:projectId/analytics/dashboard` - Metrics

### Meltano
- `GET /api/v1/organizations/:orgId/projects/:projectId/meltano/credentials` - Credentiale GCS
- `POST /api/v1/organizations/:orgId/projects/:projectId/meltano/validate` - Valideaza config
- `POST /api/v1/organizations/:orgId/projects/:projectId/meltano/config/:integrationId` - Genereaza config

## Instalare

```bash
cd backend
npm install
cp .env.example .env
# Editeaza .env cu valorile tale
npm run dev
```

## Deploy

```bash
# Docker
docker build -t sentry-backend .
docker run -p 3000:3000 --env-file .env sentry-backend

# Terraform
cd terraform
terraform init
terraform plan
terraform apply
```

## Securitate

- JWT pentru autentificare
- Roluri RBAC (user, admin, owner)
- Credentiale temporare STS pentru GCS
- Signed URLs cu expirare
- Izolare BigQuery per proiect
- Sandbox Modal izolat
