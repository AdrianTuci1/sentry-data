# Modal Deployment And Accuracy Guide

Acest document descrie cum se poate face deploy pentru training, testare si inference pe Modal, plecand de la codul existent in repo, si ce merita ajustat pentru a creste precizia modelelor si a recomandarilor generate de agenti.

Ghidul combina:
- implementarea reala din repo;
- conventiile deja folosite de backend;
- recomandarile oficiale Modal pentru `modal deploy`, `modal serve`, Secrets, Volumes si web endpoints.

## Ce exista acum in repo

| Flux | Fisier | Rol | Stare actuala |
| --- | --- | --- | --- |
| Agent sandbox execution | `modal_executor.py` | expune un endpoint FastAPI pe Modal care ruleaza `agent_manager.py` in containere efemere | implementat |
| Training Sentinel | `ml-lab/modal_training.py` | antreneaza modelul LSTM si scrie checkpoint-uri intr-un Volume Modal | implementat |
| Sentinel API local | `ml-lab/main.py` | FastAPI local pentru evaluarea nodurilor si injectarea de goal-uri | implementat local, nu este inca wrap-uit in Modal |
| Inference prin backend | `sentry-backend/src/infrastructure/providers/ModalInferenceProvider.ts` | backend-ul stie sa cheme endpoint-uri Modal per model | provider implementat, dar un app dedicat de inference nu este inca versionat in repo |

## Observatie importanta despre arhitectura curenta

Astazi exista doua moduri realiste de rulare pe Modal:

1. `sandbox execution`
Backend-ul trimite task-uri catre `modal_executor.py`, iar acolo un agent genereaza sau executa scripturile Python in container.

2. `training job`
`ml-lab/modal_training.py` ruleaza ca job remote, foloseste GPU daca este disponibil si salveaza modele / manifesturi in Volume.

Pentru `direct model inference`, backend-ul are deja un provider, dar lipseste inca un fisier dedicat de tip `ml-lab/modal_inference.py` sau echivalent. Din acest motiv, in productie poti porni cu sandbox-based inference si apoi sa separi inference-ul intr-un endpoint dedicat.

## Preconditii

Pe masina de deploy:

```bash
pip install modal
modal setup
```

Resurse si credențiale necesare:

- un workspace Modal activ;
- secrete pentru R2 sau S3 compatibil;
- cheia LLM folosita de `agent_manager.py` daca vrei task-uri agentice;
- variabile backend pentru selectarea providerului Modal.

## Secrets recomandate in Modal

`modal_executor.py` foloseste `modal.Secret.from_name("sentry-r2-secrets")`, deci secretul ar trebui sa includa cel putin:

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
  AGENT_MODEL=gemini-2.0-flash-exp
```

Daca vrei sa porti si alte credențiale in containerele Modal, secretul poate include si:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## Variabile pentru backend

In backend, Modal este activat prin `.env`:

```bash
SANDBOX_PROVIDER=modal
MODAL_TOKEN_ID=<modal_token_id>
MODAL_TOKEN_SECRET=<modal_token_secret>
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_REGION=auto
R2_BUCKET_DATA=statsparrot-data
```

## Deploy pentru sandbox execution

Acesta este fluxul folosit cand backend-ul vrea sa ruleze task-uri precum `ML_Architect`, `ML_Trainer`, `ML_Inference` sau `Query_Generator_V2` in containere efemere.

### Development

```bash
modal serve modal_executor.py
```

Cand rulezi cu `modal serve`, endpoint-ul este servit cu hot reload. Conform documentatiei Modal, URL-ul de dev primeste in mod normal un sufix dedicat de development.

### Production

```bash
modal deploy modal_executor.py
```

Ce face efectiv:
- construieste imaginea;
- injecteaza secretul `sentry-r2-secrets`;
- expune endpoint-ul FastAPI definit prin `@modal.fastapi_endpoint(method="POST")`.

### Cum este legat de backend

`ModalSandboxProvider` posteaza catre un URL fix:

- `https://adrian-tucicovenco--sentry-sandbox-executor-sandbox-executor.modal.run`

Daca schimbi workspace-ul, numele app-ului sau eticheta endpoint-ului, trebuie actualizat si URL-ul din provider.

## Deploy pentru training

### Ce antreneaza acum

`ml-lab/modal_training.py`:
- construieste o imagine separata pentru PyTorch si ML;
- monteaza Volume-ul `sentinel-ml-checkpoints`;
- antreneaza `LSTMDriftModel`;
- genereaza un `gold_manifest.json`;
- scrie checkpoint-urile in `/checkpoints`.

### Lansare

```bash
modal run ml-lab/modal_training.py
```

### Ce merita verificat dupa run

Volume-ul Modal:

```bash
modal volume ls sentinel-ml-checkpoints /
```

Sau descarcare locala:

```bash
modal volume get sentinel-ml-checkpoints / .
```

Artefacte asteptate:
- `drift_lstm.pth`
- `gold_manifest.json`

### Recomandare

Pentru productie, checkpoint-urile ar trebui versiunate separat pe:
- `latest`
- `candidate`
- `rollback`

si insotite de metadata cu:
- dataset version;
- feature version;
- target variable;
- scoruri de evaluare;
- timestamp si commit SHA.

## Testare recomandata

### 1. Smoke test local pentru dataset-uri

```bash
python3 ml-lab/datasets/generate_bundle.py --output-dir ml-lab/datasets/training_bundle --rows-per-source 240
```

### 2. Smoke test local pentru Sentinel API

```bash
python3 ml-lab/main.py
```

### 3. Test de sandbox in Modal

Porneste:

```bash
modal serve modal_executor.py
```

Apoi testeaza un POST simplu cu payload de forma:

```json
{
  "script": "print('hello from modal')",
  "sandboxId": "manual-test",
  "envVars": {
    "tenantId": "tenant_demo",
    "projectId": "project_demo",
    "taskName": "manual_smoke"
  }
}
```

### 4. Test de training remote

Ruleaza:

```bash
modal run ml-lab/modal_training.py
```

si verifica daca Volume-ul contine noile artefacte.

## Direct model inference: ce lipseste si cum sa il gandesti

`ModalInferenceProvider` este deja gata sa apeleze endpoint-uri de forma:

- `https://<workspace>--<modelName>.modal.run`

Dar un app dedicat pentru inference nu este inca versionat in repo. Din acest motiv, exista doua optiuni:

1. Varianta rapida
Continui sa rulezi inference-ul ca task agentic prin `modal_executor.py`.

2. Varianta buna pentru productie
Adaugi un app separat, de exemplu `ml-lab/modal_inference.py`, care:
- monteaza Volume-ul cu modele;
- face `volume.reload()` inainte sa citeasca artefactele active;
- expune endpoint-uri stabile pentru fiecare model sau pentru un router generic;
- intoarce payload-uri simple si predictibile pentru backend.

## Observatie importanta despre autentificare

In codul curent, providerii backend trimit header de forma:

- `Authorization: Bearer <MODAL_TOKEN_ID>:<MODAL_TOKEN_SECRET>`

Acest comportament este o conventie interna si nu este acelasi lucru cu proxy auth-ul oficial Modal. Din documentatia oficiala Modal, pentru proxy auth este preferata schema cu:

- `Modal-Key`
- `Modal-Secret`

sau o validare custom de Bearer token in endpoint-ul FastAPI.

Pentru productie, merita sa alegi una dintre variante si sa o faci explicita:

1. proxy auth oficial Modal;
2. custom bearer auth validat in endpoint;
3. acces restrans doar din backend privat plus secret de aplicatie.

## Ce sa ajustezi pentru precizie mai buna

### 1. Date si etichete

Impact mare:

- adauga source packs dedicate pentru banking si enterprise BI;
- separa clar train, validation si holdout pe timp, nu aleator;
- evita target leakage in mixed-source joins;
- pune semnale de business si tehnice in acelasi feature store doar dupa normalizare unitara.

### 2. Granularitate si ferestre temporale

In `RNNDriftPredictor`, `sequence_length` si pragul de drift sunt globale. Pentru productie, mai bine:

- secvente diferite pe domenii;
- praguri diferite pe field families;
- ferestre distincte pentru daily, hourly si weekly.

### 3. Hyperparametri

Zone utile de tuning:

- `epochs` si `lr` din `ml-lab/modal_training.py`;
- `hidden_size`, `num_layers`, `sequence_length` si `threshold` din `ml-lab/models/predictive_drift.py`;
- `ANOMALY_THRESHOLD` si `DRIFT_THRESHOLD` din `ml-lab/core/config.py`.

### 4. Feature engineering

Creste precizia daca:

- faci features per rol semantic, nu doar per nume de coloana;
- introduci lag-uri, rolling windows si rate normalizate per sursa;
- pastrezi `field_specs.json` ca sursa de adevar pentru unitati, validari si widget hints.

### 5. Mixed-source confidence

Cand proiectul amesteca surse:

- calculeaza explicit `join confidence`;
- propagheaza lipsurile de acoperire in metadata;
- evita sa arati forecast-uri foarte sigure peste join-uri slabe.

### 6. Evaluare si recalibrare

Nu te baza doar pe un singur scor de eroare:

- regresie: MAE, RMSE, MAPE;
- clasificare: precision, recall, AUC, calibration;
- clustering: silhouette, stability, cluster drift;
- recomandare de widget-uri: acceptance rate, expansion rate, user re-open rate.

### 7. RL si adaptare colectiva

Pentru componenta RL:

- foloseste feedback explicit si implicit;
- separa reward pe `overview`, `diagnostic`, `predictive`;
- ajusteaza pe field, nu doar pe widget;
- cere un minim de useri per cluster inainte de schimbari globale.

## Configuratie recomandata pe etape

### Etapa 1: validare tehnica

- `modal serve modal_executor.py`
- training remote cu date sintetice
- inference prin sandbox

### Etapa 2: pilot intern

- `modal deploy modal_executor.py`
- training versionat in Volume
- un endpoint dedicat de inference pentru modelul principal

### Etapa 3: productie

- endpoint-uri separate pentru training orchestration si inference;
- proxy auth sau auth custom clar;
- Volume pentru checkpoint-uri si model registry;
- versionare si rollback pe modele;
- evaluare continua cu retraining conditionat de drift si reward.

## Surse oficiale Modal utile

- Web endpoints: [modal.com/docs/guide/webhooks](https://modal.com/docs/guide/webhooks)
- `modal deploy`: [modal.com/docs/reference/cli/deploy](https://modal.com/docs/reference/cli/deploy)
- `modal serve`: [modal.com/docs/reference/cli/serve](https://modal.com/docs/reference/cli/serve)
- Secrets: [modal.com/docs/guide/secrets](https://modal.com/docs/guide/secrets)
- Volumes: [modal.com/docs/guide/volumes](https://modal.com/docs/guide/volumes)

## Concluzie operationala

Pentru starea actuala a repo-ului, cea mai solida ruta este:

1. folosesti `modal_executor.py` pentru task-uri agentice si inference orchestrat;
2. folosesti `ml-lab/modal_training.py` pentru training si checkpointing;
3. adaugi ulterior un endpoint dedicat de inference, dupa ce ai stabilizat schema de artefacte si model registry-ul.
