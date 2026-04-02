# Sentry Backend (Node.js)

This is the backend control plane for StatsParrot, built with Node.js, Express, and TypeScript. It exposes APIs, persists project/runtime state, coordinates Parrot OS, and submits workloads to external execution layers such as Modal and Ray/Daft control planes.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- AWS Credentials configured locally (for DynamoDB/S3/EventBridge access)

### Installation

```bash
cd sentry-backend
npm install
```

### Running the Server

**Development Mode:**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
npm start
```

## 🏗 Architecture

The project follows a Clean Architecture / Monorepo-style structure:

- **`src/api`**: API Routes and Middlewares.
  - `middlewares/context.ts`: Handles Multi-tenancy (extracts `x-tenant-id`).
  - `routes/projects.ts`: Project state management.
  - `routes/orchestration.ts`: Triggers for Sync jobs and Workflows.
- **`src/dal`**: Data Access Layer.
  - `dynamo.ts`: AWS DynamoDB Single-Table Design helpers.
  - `s3.ts`: AWS S3 helpers for Bronze/Silver/Gold layers.
- **`src/services`**: Runtime orchestration and SSE delivery.
- **`src/utils`**: shared utilities (e.g., `cost-calc`).

## 🔌 API Endpoints

### Projects
- `GET /api/projects/:projectId/state`: Get the current state (Tidy Tree) of a project.

### Layers (Ingestion & Lineage)
- `GET /api/layers/health/connectors`: Check status of Airbyte/S3 (Layer 1).
- `GET /api/layers/scripts?key={s3_key}`: Get Signed URL for script content (Layer 2).

### Runtime & Webhooks
- `POST /api/projects/:projectId/runtime/run`: Start the Parrot runtime for a project.
- `POST /api/webhooks/meltano`: Trigger a runtime refresh after ingestion.

### Real-time Events
- `GET /events`: SSE Endpoint. Connect to receive live updates.

## 🛠 Dependencies & Env

- **Environment Variables**:
  - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: For S3/DynamoDB access.
  - `MODAL_TOKEN_ID`: Authentication for Modal.
  - `MODAL_TOKEN_SECRET`: Secret key for Modal.
  - `PNE_API_URL`: Optional URL for the dedicated Parrot Neural Engine service.
  - `SENTINEL_API_URL`: Optional URL for the dedicated Sentinel service.
  - `API_BASE_URL`: Public URL of this backend.

- **Express**: Web server framework.
- **AWS SDK v3**: Modular SDK for DynamoDB, S3, EventBridge, StepFunctions.
- **SSE**: Custom implementation for real-time push.
