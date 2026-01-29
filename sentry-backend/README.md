# Sentry Backend (Node.js)

This is the backend server for the Sentry Data platform, built with Node.js, Express, and TypeScript. It serves as the API and Orchestrator, managing data flow between the Frontend, AWS services (DynamoDB, S3, EventBridge, Step Functions), and external compute layers (E2B, Modal).

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
- **`src/services`**: Business Logic & Orchestration.
  - `orchestrator`: AWS EventBridge & Step Functions integration.
  - `sse`: Server-Sent Events (SSE) Manager for real-time frontend updates.
  - `ai`: Placeholder for E2B (Code Interpreter) & LLM logic discovery.
- **`src/utils`**: shared utilities (e.g., `cost-calc`).

## 🔌 API Endpoints

### Projects
- `GET /api/projects/:projectId/state`: Get the current state (Tidy Tree) of a project.

### Layers (Ingestion & Lineage)
- `GET /api/layers/health/connectors`: Check status of Airbyte/S3 (Layer 1).
- `GET /api/layers/scripts?key={s3_key}`: Get Signed URL for script content (Layer 2).

### Orchestration & Webhooks
- `POST /api/orchestration/trigger-sync`: Trigger a data sync job.
- `POST /api/orchestration/run-flow`: Start a Step Function workflow.
- `POST /api/webhooks/sandbox-callback`: Callback for E2B/Modal jobs (updates state).

### Real-time Events
- `GET /events`: SSE Endpoint. Connect to receive live updates.

## 🛠 Dependencies & Env

- **Environment Variables**:
  - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: For S3/DynamoDB access.
  - `MODAL_WEBHOOK_BASE_URL`: Base URL for Modal.com function triggers.
  - `E2B_API_KEY`: For Sandbox instantiation.
  - `MODAL_TOKEN_ID`: Authentication for Modal.
  - `MODAL_TOKEN_SECRET`: Secret key for Modal.
  - `API_BASE_URL`: Public URL of this backend (for callback webhooks).

- **Express**: Web server framework.
- **AWS SDK v3**: Modular SDK for DynamoDB, S3, EventBridge, StepFunctions.
- **E2B**: SDK for running secure code sandboxes (AI Logic).
- **SSE**: Custom implementation for real-time push.
