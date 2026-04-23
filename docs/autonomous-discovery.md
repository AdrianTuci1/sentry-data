# Autonomous Data Discovery with Sentinel

StatsParrot supports a "Zero-Touch" autonomous discovery workflow. This allows the system to detect new datasets in your R2 bucket and automatically generate projections and insights using the PNE (Parrot Neural Engine) and Sentinel (Validation Engine).

## 🚀 The Discovery Workflow

Instead of manually registering each data source, you can follow these steps:

### 1. Upload Data to R2
Upload your Parquet or CSV files to the following path structure in your R2 bucket:
`tenants/{tenantId}/projects/{projectId}/bronze/{SourceName}/`

*Example:*
`statsparrot-data/tenants/test_tenant_1/projects/proj_ecommerce_demo/bronze/Olist_Orders/data_01.parquet`

### 2. Run Discovery Script
Run the autonomous discovery script from the `sentry-backend` directory. This will scan the R2 bucket, register new sources in DynamoDB, and trigger the PNE pipeline.

```bash
cd sentry-backend
npx ts-node scripts/sync_bronze_discovery.ts [tenantId] [projectId]
```

*Default values if omitted:*
- `tenantId`: test_tenant_1
- `projectId`: proj_ecommerce_demo

### 3. Automatic Sentinel Validation
The discovery script automatically triggers PNE. During this phase:
1. **PNE** discovers the schema and proposes business features.
2. **Sentinel** evaluates the proposed plan:
   - `QueryRiskModel` checks for SQL safety.
   - `InteractionPolicyModel` validates widget compatibility.
3. **Results** are available as "Live Insights" in your dashboard.

## 🛠️ Infrastructure Setup

Ensure your Modal services are deployed and the backend is configured:

```bash
# Deploy PNE and Sentinel
./scripts/deploy_modal.sh

# Update .env
PNE_API_URL=...
SENTINEL_API_URL=...
```

---
> [!IMPORTANT]
> The discovery script expects the directory structure to exactly match `bronze/{SourceName}/`. Every subdirectory found under `bronze/` will be treated as a unique data source connector.
