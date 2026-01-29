# Ingestion Patterns & Airbyte

**YES, Airbyte este poarta de intrare in Bronze Layer.**

Rolul Airbyte este să standardizeze modul în care datele ajung din exterior (Sursă) în S3 (Bronze).

## Scenariul 1: Conectori API (Facebook, Shopify, Postgres)
1.  Configurezi sursa în UI-ul Airbyte (ex: Facebook Ads).
2.  Configurezi destinația: **S3 (Data Fortress - Bronze Path)**.
    *   Path Pattern: `s3://data-fortress/{tenant_id}/{project_id}/bronze/facebook_ads/...`
3.  Airbyte rulează sync-ul și scrie fișiere JSON/Parquet în acel path.

## Scenariul 2: Fișiere Brute (CSV / Excel)
Cum aducem un CSV local în Bronze prin Airbyte?

1.  **Opțiunea A (Recomandată): Upload Direct + Airbyte**
    *   Cineva încarcă CSV-ul într-un bucket "Landing Area" (sau direct in Bronze dacă e validat).
    *   Airbyte are un conector **"File" (S3/HTTP)**.
    *   Configurezi Airbyte să monitorizeze acel bucket și să copieze/transforme datele în Bronze-ul oficial.

2.  **Opțiunea B: Server Push**
    *   Ai un server custom care generează date?
    *   El poate scrie fișierul în S3.
    *   Apoi apelează endpoint-ul nostru `POST /api/orchestration/trigger-sync` pentru a notifica sistemul.

## Arhitectura Locală
Pentru dezvoltare locală, folosim scriptul din `infrastructure/airbyte`. Acesta pornește tot stack-ul Airbyte pe `localhost:8000`.

**Fluxul Complet:**
`Sursă (API/File)` -> **Airbyte** -> `S3 (Bronze)` -> **Sentry Backend (Trigger)** -> `E2B (Processing)` -> `S3 (Silver/Gold)`
