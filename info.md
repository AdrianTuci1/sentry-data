
A. Interfața și Backend-ul (The Shell)
* Frontend: Vite + React pentru viteză. Folosim WebSockets pentru ca chat-ul și sandbox-ul să se actualizeze în timp real în timp ce agentul "gândește".
* Backend: FastAPI. Este cel mai rapid mod de a servi modele de AI în Python. Aici gestionăm autentificarea și baza de date de metadate (cine e userul, ce proiecte are).
B. Lakehouse-ul (The Memory)
* Stocare: S3 (AWS) sau Cloudflare R2 pentru fișierele brute (Parquet/CSV).
* Motor de interogare: DuckDB. Este incredibil de rapid pentru analize pe fișiere locale și permite agentului să facă SQL direct peste fișierele din S3.
* Metadata: PostgreSQL (Supabase) pentru a ține minte configurațiile modelelor și log-urile de cost.
C. Agentic Sandbox (The Workspace)
* E2B: Aici „trăiește” agentul când lucrează. Când userul încarcă un set de date, agentul primește un sandbox E2B, instalează pandas și scikit-learn, analizează datele și generează codul de prelucrare. (e2b.dev)
* De ce E2B? Pentru că ne oferă un terminal securizat pe care îl putem oglindi în UI-ul tău (zona din dreapta).
D. Compute Engine (The Muscle)
* https://www.google.com/search?q=Modal.com: Este piesa cheie pentru a evita facturile imense.
    * Când userul dă "Proceed" la antrenare, backend-ul trimite un job către Modal.
    * Modal alocă un GPU (ex. A100), antrenează modelul, salvează rezultatul în S3 și se oprește imediat.
    * Plătești la secundă.
E. Reverse ETL & Ingestie (The Bridge)
* Airbyte (Self-hosted sau API): Pentru a trage date din Shopify/Facebook.
* Custom API Wrappers: Pentru Reverse ETL către Facebook Ads, vom scrie mici module Python pe care agentul le poate apela pentru a trimite audiențele (folosind Facebook Business SDK).