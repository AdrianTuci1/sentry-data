# Deploy

Acest proiect foloseste acum un flux zero-ETL pentru discovery:

- uploadam doar `widgets` in R2 pentru catalogul de discovery;
- datele raw intra sub `sources/...`;
- proiectiile queryabile intra sub `projections/...`;
- artefactele de runtime intra sub `runtime/...`.

Documentul de mai jos este fluxul canonic de deploy si operare.

## 1. Preconditii

Ai nevoie de:

- Node.js 20+;
- `npm install` in [sentry-backend](/Users/adriantucicovenco/Proiecte/sentry-data/sentry-backend) si [sentry-frontend](/Users/adriantucicovenco/Proiecte/sentry-data/sentry-frontend);
- Python 3.9+ pentru worker-ul analytics local;
- credentials R2 / S3 compatible in `.env`.

## 2. Variabile necesare

In `.env`, minim:

```bash
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_REGION=auto
R2_BUCKET_DATA=statsparrot-data

AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
DYNAMO_TABLE_NAME=SentryAppTable

JWT_SECRET=<secret>
INTERNAL_API_SECRET=<secret>
ANALYTICS_WORKER_URL=http://localhost:4000/execute
```

Optional pentru servicii remote:

```bash
PNE_API_URL=<modal-or-http-url>
SENTINEL_API_URL=<modal-or-http-url>
ML_EXECUTOR_API_URL=<modal-or-http-url>
```

## 3. Deploy pentru widgets

Comanda canonica este:

```bash
cd /Users/adriantucicovenco/Proiecte/sentry-data/sentry-backend
npm run deploy:widgets
```

Ce face:

1. ruleaza [generate-artifacts.mjs](/Users/adriantucicovenco/Proiecte/sentry-data/boilerplates/widgets/generate-artifacts.mjs);
2. urca exclusiv continutul din [boilerplates/widgets](/Users/adriantucicovenco/Proiecte/sentry-data/boilerplates/widgets) in:

```text
system/boilerplates/widgets/...
```

Acesta este singurul deploy necesar pentru discovery-ul de widgets.

## 3.1. Brand assets pentru conectori

Logo-urile pentru ecranul de conectare se servesc direct din frontend, din:

```text
/Users/adriantucicovenco/Proiecte/sentry-data/sentry-frontend/public/connector-assets/icons/
```

Documentatia pentru naming este in:

[README.md](/Users/adriantucicovenco/Proiecte/sentry-data/sentry-frontend/public/connector-assets/README.md)

Frontend-ul cauta automat fisierele:

- `ga4.png`
- `facebook-ads.png`
- `shopify.png`
- `tiktok-ads.png`
- `stripe.png`
- `hubspot.png`

Daca un fisier lipseste, UI-ul face fallback la o iconita generica.

## 4. Seed pentru demo data

Comanda:

```bash
cd /Users/adriantucicovenco/Proiecte/sentry-data/sentry-backend
npm run seed
```

`seed_test_data.ts` face acum doua lucruri:

- urca doar `widgets` pentru discovery;
- urca dataset-urile demo sub:

```text
tenants/<tenantId>/projects/<projectId>/sources/<source>/<date>/<file>.parquet
```

si creeaza conectorii cu glob de forma:

```text
s3://<bucket>/tenants/<tenantId>/projects/<projectId>/sources/<source>/**/*.parquet
```

## 5. Rulare locala

Backend:

```bash
cd /Users/adriantucicovenco/Proiecte/sentry-data/sentry-backend
npm run dev
```

Frontend:

```bash
cd /Users/adriantucicovenco/Proiecte/sentry-data/sentry-frontend
npm run dev
```

Analytics worker local:

```bash
cd /Users/adriantucicovenco/Proiecte/sentry-data/sentry-analytics-worker
pip install -r requirements.txt
python3 main.py
```

## 5.1. Conectare BYOB object storage

Pentru o sursa user-owned, poti crea conectorul cu `storageConfig` si fara `uri` explicit. Backend-ul construieste automat glob-ul de citire din `bucket/prefix`.

Frontend-ul are acum si un catalog real de capabilitati, alimentat din backend:

```bash
GET /api/projects/connectors/catalog
```

Acest catalog separa explicit:

- `ready`: surse user-owned in object storage S3 / R2 compatibil;
- `assisted`: landing zone gestionat de noi, unde ingestia este operata asistat;
- `planned`: conectori directi de tip Postgres / Kafka.

Exemplu:

```json
POST /api/projects/<projectId>/sources
{
  "sourceName": "customer-orders",
  "type": "parquet",
  "cronSchedule": "0 * * * *",
  "storageConfig": {
    "provider": "generic_s3",
    "endpoint": "https://storage.example.com",
    "bucket": "customer-warehouse",
    "prefix": "exports/orders",
    "region": "auto",
    "fileFormat": "parquet",
    "urlStyle": "path",
    "credentials": {
      "accessKeyId": "<key>",
      "secretAccessKey": "<secret>"
    }
  }
}
```

Backend-ul va genera automat un URI de forma:

```text
s3://customer-warehouse/exports/orders/**/*.parquet
```

Pentru preview / auto-discovery pe bucket, exista acum si:

```bash
POST /api/projects/<projectId>/sources/discover
```

cu body:

```json
{
  "storageConfig": {
    "provider": "generic_s3",
    "endpoint": "https://storage.example.com",
    "bucket": "customer-warehouse",
    "prefix": "exports",
    "fileFormat": "parquet",
    "credentials": {
      "accessKeyId": "<key>",
      "secretAccessKey": "<secret>"
    }
  }
}
```

Endpoint-ul face listare de prefixe si intoarce dataset-urile detectate automat sub acel landing zone. Daca gaseste doar partitii sub prefixul dat, trateaza prefixul curent ca o singura sursa.

Pentru mapare mai buna in mindmap, frontend-ul poate trimite si `connectorId` cand userul stie sursa de origine. In prezent avem profile dedicate pentru:

- `ga4`
- `facebook_ads`
- `shopify`
- `tiktok_ads`
- `stripe`
- `hubspot`

Aceste profile nu schimba locul in care traim datele. Ele adauga doar schema hints pentru discovery, astfel incat `entity id`, `timestamp`, `metrics` si alte campuri sa fie detectate mai corect.

## 5.2. Managed landing zone

Pentru varianta fully managed, fluxul recomandat este:

1. ingestia ruleaza prin Meltano / AppFlow / Data Exchange / alt pipeline gestionat;
2. datele sunt aduse intr-un bucket sau prefix convenit;
3. runtime-ul este declansat prin webhook sau polling;
4. discovery-ul ruleaza identic cu BYOB, doar ca storage-ul este operat de noi.

Astazi aceasta varianta este `assisted`, nu full self-serve: control plane-ul suporta landing zone + runtime, dar setup-ul complet de onboarding / credențiale / scheduling nu este inca produsizat cap-coada in UI.

## 6. Trigger runtime

Dupa seed sau dupa ce ai conectat surse reale:

```bash
POST /api/projects/<projectId>/runtime/run
```

Backend-ul citeste sursele persistate din DynamoDB si ruleaza discovery-ul pe URI-urile lor.

## 6.1. Detectie de date noi

Exista acum doua moduri:

manual, per proiect:

```bash
POST /api/projects/<projectId>/runtime/check-updates
```

scriptabil, pentru scheduler:

```bash
cd /Users/adriantucicovenco/Proiecte/sentry-data/sentry-backend
npm run refresh:check -- <tenantId>
```

sau pentru un singur proiect:

```bash
cd /Users/adriantucicovenco/Proiecte/sentry-data/sentry-backend
npm run refresh:check -- <tenantId> <projectId>
```

Scriptul compara cursorul ultimelor obiecte vazute cu starea curenta din object storage si retrigger-uieste runtime-ul doar daca apar schimbari.

## 7. Layout-ul recomandat in object storage

Raw sources:

```text
tenants/<tenantId>/projects/<projectId>/sources/<source>/<date>/<file>
```

Zero-ETL projections:

```text
tenants/<tenantId>/projects/<projectId>/projections/<projection-id>/versions/<version>/<file>
```

Runtime artifacts:

```text
tenants/<tenantId>/projects/<projectId>/runtime/requests/<request-id>/<artifact>
```

Mindmap manifest si YAML:

```text
tenants/<tenantId>/projects/<projectId>/runtime/requests/<request-id>/mindmap-manifest.json
tenants/<tenantId>/projects/<projectId>/runtime/requests/<request-id>/mindmap.yaml
```

Widget discovery catalog:

```text
system/boilerplates/widgets/<category>/<widget>/...
```

## 8. Modal

Nu mai exista script global de deploy pentru toate serviciile. Pentru Modal, deploy-ul se face explicit per app, doar cand chiar ai nevoie:

```bash
modal deploy modal_analytics_worker.py
modal deploy modal_pne.py
modal deploy modal_sentinel.py
modal deploy modal_ml_executor.py
modal deploy modal_executor.py
```

Pentru oprire exista in continuare:

```bash
/Users/adriantucicovenco/Proiecte/sentry-data/stop_modal_sandboxes.sh
```

## 9. Ce ramane de implementat

Lipsurile reale pentru productie, ramase dupa aceasta simplificare:

- secret management dedicat pentru credentials per-tenant; acum configuratia per-source exista, dar secretele sunt inca persistate direct in configuratia sursei;
- scheduler extern recurent care apeleaza `refresh:check`; logica de detectie exista, dar job-ul recurent nu este orchestrat din aplicatie;
- cleanup/retention policy pentru versiunile vechi din `projections/...`;
- discovery mai inteligent pe bucket/prefix pentru formate non-parquet si pentru maparea automata a mai multor prefixe per sursa;
- calibrarea fina a planner-ului pe scan cost real si latenta observata in productie; planner-ul foloseste acum bytes, numar de fisiere, row estimate si cardinalitate, dar pragurile sunt inca euristice.
- conectori directi pentru Postgres / Kafka / alte baze sau stream-uri; in prezent recomandarea este landing in object storage si zero-ETL discovery de acolo;
- contract self-serve pentru managed ingestion; avem suport bun pentru landing zone si webhook-uri, dar nu inca pentru configurare completa in produs;
- metadata feedback loop real; manifest-ul expune deja `feedbackLoop.mode = metadata_only`, dar nu exista inca persistența si invatarea efectiva a preferintelor userilor din accept/reject/edit pentru a alinia automat alti useri similari.

## 10. Cum mapam sursele cunoscute in mindmap

Sistemul poate mapa mult mai bine GA4, Facebook Ads, Shopify, TikTok Ads, Stripe si HubSpot daca sursa este conectata cu profilul corect.

Ce face acum:

- foloseste alias-uri specifice per conector pentru a marca mai bine `id`, `timestamp`, `metric` si `dimension`;
- salveaza manifestul de mindmap in object storage;
- pastreaza si copia din DynamoDB ca cache/proiectie rapida pentru frontend.

Ce nu face inca:

- nu normalizeaza complet fiecare conector intr-un contract semantic versionat de productie;
- nu are inca feedback learning operational care sa reinvete din preferintele userilor pe conectori similari.
