# Checkpoints & Next Steps for Sentinel Integration

Acest document conține lucrurile discutate și necesar a fi realizate în fazele următoare, pe măsură ce integrăm `Sentinel Agent` în arhitectura principală.

## 1. Conectarea la DAG (Node.js Backend)
- [ ] Backend-ul central din Node (Stats Parrot Orchestrator) trebuie să trimită un webhook sau request HTTP către acest Sentinel (`/api/v1/evaluate_node`) odată ce un job de ingestie din Bronze -> Silver este finalizat.
- [ ] În Endpoint, Node-ul va trimite URL-ul către fișierele Parquet (S3/R2). 
- [ ] `Sentinel Agent` va trebui modificat să citească din S3/R2 via DuckDB `read_parquet()` direct, deoarece acum primește `data_sample` ca array din Request Body (temporar pt mock).

## 2. Salvarea Agenților în Workspaces (Feature Request curent)
S-a menționat de către utilizator: *"agenții nu se salveaza in folderul fiecarui user/proiect, doar cache-ul acestora"*.
- [ ] Trebuie refactorizat codul din orchestrator care instanțiază Modal Sandboxes.
- [ ] În loc să rulăm un singur agent general care preia parametri, ar trebui să stocăm `.py` agent script definitivat direct în folderul proiectului în R2 (`tenants/{tenant}/projects/{project}/agents/agent_123.py`).
- [ ] Asta va asigura că fiecare Tenant/Proiect are agentul izolat și versiuni controlate prin "Verified Script Caching", facilitând self-healing mult mai clar.

## 3. Dezvoltarea Modelelor
- [X] **Predictive Drift:** Modelul actual `LSTMDriftModel` a fost implementat folosind `PyTorch LSTM`. Arhitectura este gata pentru antrenare în Modal folosind GPU-uri.
- [ ] **Data Explainer:** Integrarea efectivă a pipeline-ului din SentenceTransformers. Generarea de embeddings pe `schema_semantics` în ChromaDB.

## 4. Modal Deployment
- [X] **Training App:** S-a creat `ml-lab/modal_training.py` care configurează mediul Modal (GPU, Volumes, Images) pentru training.
- [ ] Serverul `ml-lab` va fi wrappat pe viitor într-un proces `modal.Image().pip_install(...)` pentru a rula funcțiile de analiză în parallel.
- [ ] Endpoint-urile din FastAPI vor deveni `modal.web_endpoint`.
