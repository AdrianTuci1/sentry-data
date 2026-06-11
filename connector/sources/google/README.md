# Google-native connectors via BigQuery Data Transfer Service

These require zero code. Configure in GCP Console:

## GA4 (Google Analytics 4)

1. GCP Console → BigQuery → Data Transfers → Create Transfer
2. Source: Google Analytics 4
3. Destination: `${dataset}_landing` (append `_ga4` to table names)
4. Schedule: every 24h or streaming (continuous)
5. Tables created: `events_*`, `pseudonymous_users_*`

No code needed. GCP handles everything.

## Google Ads

1. Data Transfers → Create Transfer
2. Source: Google Ads
3. Destination: `${dataset}_landing_ads`
4. Tables: `campaigns`, `ad_groups`, `ads`, `keywords`, `clicks`, `impressions`

## Search Console

1. Data Transfers → Create Transfer
2. Source: Search Console
3. Tables: `searchdata_site_impression`, `searchdata_url_impression`

## YouTube

1. Data Transfers → Create Transfer
2. Source: YouTube Channel / Content Owner
3. Tables: `video_*`, `channel_*`
