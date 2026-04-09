Connector brand assets live here.

Drop the logo files into:

`sentry-frontend/public/connector-assets/icons/`

Expected file names:

- `ga4.png`
- `facebook-ads.png`
- `shopify.png`
- `tiktok-ads.png`
- `stripe.png`
- `hubspot.png`
- `object-storage.png`
- `managed-landing-zone.png`
- `postgres.png`
- `kafka.png`

Recommended format:

- transparent PNG or SVG exported as PNG
- square canvas
- 256x256 or larger
- keep the main mark centered with enough padding

How the app resolves them:

- backend catalog emits paths like `/connector-assets/icons/<filename>`
- frontend falls back to a generic database icon if the file is missing

If you only upload the six SaaS connector logos, the connect flow for GA4, Facebook Ads, Shopify, TikTok Ads, Stripe, and HubSpot will start showing them immediately.
