# Documentație ML-Lab (Sentinel)

Agentul Sentinel funcționează ca nucleul inteligent al platformei *Stats Parrot*, transformând-o dintr-un simplu pipeline ETL într-un **Self-Healing Data Engine**. La baza sa stă un sistem de **Reinforcement Learning (RL)** alimentat de un Large Language Model (recomandat **Gemini 3 Flash** pentru un raport excelent eficiență-viteză).

## Concepte Cheie

### 1. Reinforcement Learning & Goal Injection
Sistemul nu doar monitorizează calitatea (Anomaly & Drift Detection), ci **intervine proactiv**.
Dacă datele "par" a indica un nou trend sau dacă apare un nou tabel nerecunoscut (ex: log-uri de SaaS sau comenzi noi), LLM-ul investighează natura datelor. Folosindu-se de RL, Sentinel decide să **modifice automat macro-urile/obiectivele agenților generatori de execuții SQL** (din Node.js).
Astfel, sistemul "învață" să ceară metrici pe care utilizatorul încă nu știe că și le dorește, dar care aduc valoare.

### 2. The Insight Catalog (Catalog de Insights)
Acesta este dicționarul dinamic care funcționează pe două direcții:
- **Requirement-based (Top-Down):** Utilizatorul cere "Vreau Life Time Value (LTV)". Insight Catalogul știe că pentru a furniza asta, Sentinel trebuie să forțeze agenții să caute scheme cu GA4, Facebook Ads și tranzacții. Dacă lipsesc, returnează un Confidence Score mic și alertează user-ul.
- **Discovery-based (Bottom-Up):** Sistemul primește date brute necunoscute. Agentul Gemini își dă seama "Acestea par a fi date SaaS (Abonamente)". Consultând catalogul, decide automat: "Vom genera *Time to Value*, *LTV:CAC* și *Stickiness*". 

## Arhitectura `/ml-lab`

*   `core/` - Setări și variabile (inclusiv cheia de API pt Gemini).
*   `api/routes.py` - Endpoint-uri REST chemate de ecosistemul principal (Stats Parrot Orchestrator).
*   `agents/sentinel.py` - Inima platformei, clasa care înglobează logicile.
*   `agents/llm_engine.py` - Conectorul către Gemini 3 Flash.
*   `agents/insight_catalog.py` - Managerul matricial de dependențe (Date -> Insights).
*   `models/` - Detecție anomalii și vector space de similaritate.
*   `datasets/` - Generator pentru bundle-uri de antrenare multi-domain, seedings și mock testing.
*   `vector_store/` - ChromaDB client pentru a reține istoric embeddings ale schemelor și scorurile de decizie RL.

## Documente operaționale

*   `VISUALIZATION_SOURCE_PLAYBOOK.md` - Matricea surse de date -> vizualizări -> comportament la mixuri.
*   `MODAL_DEPLOYMENT_AND_ACCURACY.md` - Ghid pentru deploy pe Modal, testare, inference și creșterea preciziei.
*   `TRAINING_DATASET_BUILD.md` - Cum construim dataset-ul de antrenare și cum extindem generatorul modular.
*   `ML_LAB_COMMANDS.md` - Dicționarul de comenzi pentru pregătirea datelor și fluxurile ML-LAB.
