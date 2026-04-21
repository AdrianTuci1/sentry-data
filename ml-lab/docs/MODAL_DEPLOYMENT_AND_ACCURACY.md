# Modal Deployment And Accuracy Guide

Acest document descrie runtime-ul Modal curent, fara managerul agentic vechi. `modal_executor.py` ramane doar un scaffold de compatibilitate: nu mai incarca task templates, nu mai ruleaza prompturi vechi si nu mai forteaza agentii sa execute cod generat din `boilerplates`.

## Ce exista acum in repo

| Flux | Fisier | Rol | Stare actuala |
| --- | --- | --- | --- |
| Analytics Worker | `modal_apps/analytics_worker.py` | executa query-uri aprobate si citeste catalogul de widget-uri din `r2-system/widgets` | activ |
| PNE | `modal_apps/pne.py` | compileaza planuri de proiectii si scoruri de executie folosind prompturi runtime | activ |
| Sentinel | `modal_apps/sentinel.py` | evalueaza runtime-ul, riscul de query, drift-ul si guardrails de executie | activ |
| ML Executor | `modal_apps/ml_executor.py` | lanseaza fluxuri ML aprobate si executa job-uri controlate | activ |
| Runtime scaffold | `modal_apps/executor.py` / `modal_executor.py` | returneaza explicit ca managerul vechi a fost eliminat | compatibilitate |
| Training Sentinel | `ml-lab/modal_training.py` | antreneaza modelul LSTM si scrie checkpoint-uri intr-un Volume Modal | activ |

## Sursa runtime canonica

`r2-system` inlocuieste directorul vechi `boilerplates`.

- `r2-system/widgets/` contine catalogul, indexul si manifestele pentru widget discovery.
- `r2-system/prompts/runtime/` contine prompturile citite de PNE si Sentinel.
- `r2-system/scaffolds/modal/` contine contracte JSON pentru payload-uri Modal.
- `r2-system/scaffolds/python/` contine scaffolds Python executate doar de Modal pentru DuckDB leases, query runtime si ML workflows aprobate.
- prefixul R2 canonic este `system/r2-system/...`.

Nu mai exista `agent_manager.py`, task templates Python vechi sau prompturi pentru ETL clasic. Datele raman asa cum intra, iar PNE construieste proiectii versionate peste ele. Diferenta importanta: avem din nou scaffolds Python, dar sunt runtime scaffolds versionate pentru Modal, nu fisiere pe care agentul le rescrie liber.

## Preconditii

Pe masina de deploy:

```bash
pip install modal
modal setup
```

Resurse si credentiale necesare:

- workspace Modal activ;
- secrete pentru R2 sau S3 compatibil;
- `INTERNAL_API_SECRET` pentru apeluri backend <-> Modal;
- cheia LLM folosita de PNE/Sentinel, daca prompturile runtime sunt executate cu model extern;
- variabile backend pentru endpoint-urile Modal.

## Secrets recomandate in Modal

```bash
modal secret create sentry-r2-secrets \
  R2_REGION=auto \
  R2_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com \
  R2_ENDPOINT_CLEAN=<account>.r2.cloudflarestorage.com \
  R2_ACCESS_KEY_ID=<key> \
  R2_SECRET_ACCESS_KEY=<secret> \
  R2_BUCKET=statsparrot-data \
  R2_BUCKET_DATA=statsparrot-data \
  GEMINI_API_KEY=<gemini_key> \
  AGENT_MODEL=gemini-3.1-flash \
  INTERNAL_API_SECRET=<shared_secret>
```

Secretul poate include si chei pentru alti provideri, dar fluxurile runtime trebuie sa ramana controlate prin PNE, Sentinel, Analytics Worker si ML Executor.

## Variabile pentru backend

```bash
PNE_API_URL=https://<workspace>--statsparrot-pne-fastapi-app.modal.run
SENTINEL_API_URL=https://<workspace>--statsparrot-sentinel-fastapi-app.modal.run
ML_EXECUTOR_API_URL=https://<workspace>--statsparrot-ml-executor-fastapi-app.modal.run
INTERNAL_API_SECRET=<shared_secret>
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_REGION=auto
R2_BUCKET_DATA=statsparrot-data
```

## Deploy pentru runtime

Deploy-ul se face explicit per app:

```bash
modal deploy modal_analytics_worker.py
modal deploy modal_pne.py
modal deploy modal_sentinel.py
modal deploy modal_ml_executor.py
```

`modal deploy modal_executor.py` este optional si ar trebui folosit doar daca ai nevoie de endpoint-ul de compatibilitate care semnaleaza eliminarea managerului vechi.

## DuckDB leases intre Modal apps si backend

Analytics Worker si ML Executor monteaza `r2-system/scaffolds/python/` si expun endpoint-uri de lease/keepalive pentru DuckDB:

- Analytics Worker: `/runtime/lease`, `/runtime/leases/{leaseId}/keepalive`, `/execute`.
- ML Executor: `/api/v1/runtime/lease`, `/api/v1/runtime/leases/{leaseId}/keepalive`, `/api/v1/ml/train`.

Backend-ul nu ruleaza DuckDB si nu executa scaffolds Python. El cere un lease, trimite query-uri sau job-uri ML catre Modal si poate trimite keepalive cat timp workflow-ul este activ. Lease-ul reduce costul de setup si pastreaza conexiunea calda, dar precizia ramane data de fingerprints pentru sursa, proiectie si query.

## Deploy pentru training

`ml-lab/modal_training.py`:

- construieste o imagine separata pentru PyTorch si ML;
- monteaza Volume-ul `sentinel-ml-checkpoints`;
- genereaza un bundle sintetic de training;
- antreneaza `LSTMDriftModel` cu hiperparametri configurabili;
- scrie checkpoint-uri versionate in `/checkpoints/sentinel/<version>` si `/checkpoints/sentinel/latest`;
- poate publica aceleasi artefacte in R2 sub `system/r2-system/models/sentinel/<version>`.

Lansare:

```bash
modal run ml-lab/modal_training.py --epochs 40 --lr 0.001 --hidden-size 32 --sequence-length 10 --rows-per-source 320
```

Artefacte asteptate:

- `drift_lstm.pth`
- `sentinel_model_manifest.json`

Training-ul local foloseste acelasi cod:

```bash
python3 ml-lab/sentinel_training.py --bundle-dir ml-lab/datasets/training_bundle --output-dir ml-lab/checkpoints/sentinel --epochs 40 --learning-rate 0.001
```

Pentru productie, checkpoint-urile sunt versionate pe `<version>` si `latest`. Promovarea `candidate -> latest -> rollback` ar trebui facuta prin schimbarea pointerului/manifestului R2, nu prin redeploy obligatoriu al backend-ului.

## Testare recomandata

### 1. Smoke test local pentru dataset-uri

```bash
python3 ml-lab/datasets/generate_bundle.py --output-dir ml-lab/datasets/training_bundle --rows-per-source 240
```

### 2. Smoke test local pentru Sentinel API

```bash
python3 ml-lab/main.py
```

### 3. Test pentru runtime Modal

```bash
modal serve modal_pne.py
modal serve modal_sentinel.py
modal serve modal_ml_executor.py
```

Trimite payload-uri conforme cu contractele din `r2-system/scaffolds/modal/`.
Pentru Sentinel, `/health` trebuie sa arate daca modelul a fost incarcat din Volume sau din `SENTINEL_MODEL_MANIFEST_URI`.

### 4. Test pentru scaffold-ul de compatibilitate

```bash
modal serve modal_executor.py
```

Endpoint-ul trebuie sa intoarca `deprecated_agent_manager_removed`, nu sa execute task-uri.

## Ce sa ajustezi pentru precizie mai buna

### 1. Date si etichete

- adauga source packs dedicate pentru banking si enterprise BI;
- separa train, validation si holdout pe timp, nu aleator;
- evita target leakage in mixed-source joins;
- pastreaza semnalele brute si descrie proiectiile, nu transforma datele in loc.

### 2. Proiectii si versionare

- fiecare proiectie trebuie sa aiba `projection_id`, `projection_version`, `source_fingerprint`, `schema_fingerprint` si `query_fingerprint`;
- Sentinel invalideaza doar cache-urile afectate de schimbari reale;
- Analytics Worker poate reutiliza rezultate materializate cand fingerprint-urile sunt stabile.

### 3. Mixed-source confidence

- calculeaza explicit `join confidence`;
- propaga lipsurile de acoperire in metadata;
- evita forecast-uri foarte sigure peste join-uri slabe.

### 4. Evaluare si recalibrare

- regresie: MAE, RMSE, MAPE;
- clasificare: precision, recall, AUC, calibration;
- clustering: silhouette, stability, cluster drift;
- recomandare de widget-uri: acceptance rate, expansion rate, user re-open rate.

### 5. RL si adaptare colectiva

- foloseste feedback explicit si implicit;
- separa reward pe `overview`, `diagnostic`, `predictive`;
- ajusteaza pe field si pe proiectie, nu doar pe widget;
- cere un minim de useri per cluster inainte de schimbari globale;
- trateaza override-urile userilor ca preferinte versionate, nu ca invalidari automate.

## Configuratie recomandata pe etape

### Etapa 1: validare tehnica

- `modal serve modal_pne.py`
- `modal serve modal_sentinel.py`
- training remote cu date sintetice
- ML executor cu aprobari manuale

### Etapa 2: pilot intern

- `modal deploy modal_pne.py`
- `modal deploy modal_sentinel.py`
- `modal deploy modal_analytics_worker.py`
- `modal deploy modal_ml_executor.py`
- training versionat in Volume

### Etapa 3: productie

- endpoint-uri separate pentru PNE, Sentinel, analytics si ML;
- keepalive pentru DuckDB leases in workflow-uri multi-step;
- proxy auth sau auth custom clar;
- model registry pentru checkpoint-uri;
- versionare si rollback pe modele;
- observabilitate continua cu retraining conditionat de drift si reward.

## Surse oficiale Modal utile

- Web endpoints: [modal.com/docs/guide/webhooks](https://modal.com/docs/guide/webhooks)
- `modal deploy`: [modal.com/docs/reference/cli/deploy](https://modal.com/docs/reference/cli/deploy)
- `modal serve`: [modal.com/docs/reference/cli/serve](https://modal.com/docs/reference/cli/serve)
- Secrets: [modal.com/docs/guide/secrets](https://modal.com/docs/guide/secrets)
- Volumes: [modal.com/docs/guide/volumes](https://modal.com/docs/guide/volumes)

## Concluzie operationala

Ruta curenta este: PNE compileaza proiectii versionate, Sentinel decide invalidari si guardrails, Analytics Worker executa query-uri aprobate, iar ML Executor porneste fluxuri ML cu aprobare. `modal_executor.py` nu mai este un runtime agentic.
