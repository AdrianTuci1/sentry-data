# Connectors — GCP-native data ingestion

## Arhitectură

```
┌─────────────────────────────────────────────────────────┐
│                     SOURCES                              │
│                                                          │
│  Google sources (GA4, Ads, Search Console)               │
│  ─────────────────────────────────────                   │
│  BigQuery Data Transfer Service                          │
│  Config: GCP Console → Data Transfers → Create           │
│  Zero code. Scheduled automatically by GCP.              │
│  ─────────────────────────────────────                   │
│                                                          │
│  Third-party sources (Stripe, Shopify, HubSpot)          │
│  ─────────────────────────────────────                   │
│  Cloud Function + Cloud Scheduler                        │
│  sources/stripe/index.js  →  Stripe API  → BigQuery      │
│  sources/shopify/index.js →  Shopify API → BigQuery      │
│  ─────────────────────────────────────                   │
│                                                          │
│  Streaming sources (Sentry, PostHog)                     │
│  ─────────────────────────────────────                   │
│  Webhook → Cloud Function → Pub/Sub → BigQuery           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Deploy un connector

```bash
cd sources/stripe

gcloud functions deploy sentry-connector-stripe \
  --runtime nodejs22 \
  --trigger-http \
  --entry-point ingest \
  --set-env-vars STRIPE_API_KEY=...CS_BUCKET=... \
  --region europe-west1
```

Apoi creezi un Cloud Scheduler job care cheamă funcția la fiecare oră.

## Structură

```
connector/
├── README.md
├── sources/
│   ├── google/           # Config docs for BigQuery Data Transfer
│   │   └── README.md     # Setup instructions per Google source
│   ├── stripe/
│   │   └── index.js      # Stripe → BigQuery
│   ├── shopify/
│   │   └── index.js      # Shopify → BigQuery
│   └── _template/
│       └── index.js      # Template for new connectors
└── deploy.sh             # Deploy all connectors
