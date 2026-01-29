📂 Structura Proiectului (Monorepo sau Clean Architecture)Plaintext/src
  /api
    /routes          # Endpoints (Auth, Projects, Webhooks)
    /middlewares     # Multi-tenancy isolation, Auth validation
  /services
    /orchestrator    # Logica de declanșare Step Functions/EventBridge
    /sse             # Managementul conexiunilor live (SSE Manager)
    /ai              # Prompt engineering și integrare E2B SDK
  /workers
    /reverse-etl     # Scripturi pentru trimitere date în HubSpot/FB
  /dal               # Data Access Layer (Interfața cu DynamoDB și S3)
  /utils
    /cost-calc       # Calculator de costuri per run

✨ Feature-uri Principale
1. Contextual Multi-Tenancy (Isolation)Serverul folosește un middleware care extrage tenant_id din JWT. Toate apelurile ulterioare către S3 sau DynamoDB sunt prefixate automat.Feature: Nu poți interoga datele fără un context de proiect valid.
2. SSE Manager (Real-Time State)În loc de polling, serverul menține o conexiune deschisă cu frontend-ul.Funcționalitate: Când un Webhook de la E2B/Modal ajunge la server, SSE Managerul trimite instant un pachet JSON către UI: { "nodeId": "gold_sales", "newStatus": "GREEN" }.
3. AI Logic Discovery (E2B Bridge)Node.js acționează ca un traducător. Ia schema tabelelor din S3 (Bronze), o trimite la LLM pentru a genera SQL, apoi pornește sandbox-ul E2B pentru a valida acel SQL.
4. Cost Tracking & ObservabilityFiecare execuție în Modal sau E2B raportează timpul de rulare.Feature: Node.js calculează în timp real costul estimat (ex: 1.40$) și îl salvează în starea proiectului pentru a fi afișat în widget-ul din UI.📊 

Structura Datelor (DynamoDB Single-Table Design)Această structură permite recuperarea întregului "copac" cu o singură interogare.Tabelă: DataFortress_StateAtributValoare/ExempluDescrierePKTENANT#agentie_01Identificatorul clientului principal.SKPROJ#magazin_fashion#TREEDocumentul de stare pentru un magazin specific.tree_json{ "layers": { ... } }Obiectul care conține nodurile pentru toate cele 3 Tidy Trees.active_jobs[ { "id": "job_99", "node": "ML_Churn" } ]Joburile care rulează în prezent în AWS/Modal.billing_mtd132.50Costul total acumulat pe luna curentă (Month-to-Date).🧠 Logica de Orchestrare (Step Functions ASL)În loc să scrii if/else complexe în Node.js, definești un fișier ASL (Amazon States Language) pe care Node îl pornește. Acesta arată ordinea execuției:Pasul 1: Ingestie (Airbyte) -> Așteaptă succes.Pasul 2: Transformare (E2B) -> Rulează DuckDB pentru a crea tabele Silver/Gold.Pasul 3: Analytics (Modal) -> Rulează modelele de predicție.Pasul 4: Reverse ETL -> Trimite scorurile în HubSpot.Pasul 5: Callback -> Apelează Webhook-ul Node.js pentru a închide fluxul