# Training Dataset Build

Acest document descrie cum construim dataset-ul de antrenare pentru `ml-lab`, ce componente il compun si cum il extindem fara sa degradam calitatea pipeline-ului.

## Obiectiv

Bundle-ul de antrenare trebuie sa pregateasca agentii pentru:

- detectie de domenii pe baza field-urilor si a mixului de surse;
- generare de SQL si Python pentru fluxuri reale de analytics, data science si machine learning;
- recomandare de widget-uri executive, diagnostice si predictive;
- feedback de reinforcement learning pentru reranking per field si per cluster de useri.

## Structura generatorului modular

Generatorul este acum impartit in [generator/README.md](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/generator/README.md):

- [common.py](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/generator/common.py)
- [sources.py](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/generator/sources.py)
- [catalog.py](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/generator/catalog.py)
- [bundle.py](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/generator/bundle.py)
- [cli.py](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/generator/cli.py)

## Cum construim dataset-ul

### 1. Definim sursele brute sintetice

In [sources.py](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/generator/sources.py) avem generatoare dedicate pentru:

- SaaS / product / marketing / web / ecommerce / sales / support
- observability / FinOps / cybersecurity / IoT
- banking / fraud / liquidity
- enterprise BI / ERP / procurement
- telecom / network health
- healthcare operations

Fiecare sursa:
- are o granularitate clara;
- are anomalii injectabile;
- produce field-uri suficient de bogate pentru training;
- are chei de join explicite.

### 2. Declarăm catalogul analitic

In [catalog.py](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/generator/catalog.py):

- `SOURCE_BLUEPRINTS` descrie sursele si metadata lor;
- `ROLE_PRIORITY` defineste rolurile semantice ale field-urilor;
- `WIDGET_BLUEPRINTS` defineste familia si cerintele widget-urilor;
- `PROJECT_BLUEPRINTS` defineste scenarii multi-source;
- `RL_CLUSTER_BLUEPRINTS` defineste profile de adaptare.

### 3. Construim metadata de antrenare

In [bundle.py](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/generator/bundle.py), pipeline-ul face:

1. materializeaza dataframe-urile sursa;
2. construieste `source_registry.json`;
3. construieste `field_specs.json`;
4. construieste catalogul de widget-uri de antrenare;
5. genereaza scenarii pentru detectie de domenii;
6. genereaza scenarii pentru query/script generation;
7. genereaza profile RL si feedback events;
8. exporta CSV, Parquet si metadata JSON/JSONL.

### 4. Materializăm bundle-ul

Entry point:

- [generate_bundle.py](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/generate_bundle.py)
- [cli.py](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/generator/cli.py)

Rezultatul este scris implicit in:

- [training_bundle](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/training_bundle)

## Artefacte rezultate

In [training_bundle_manifest.json](/Users/adriantucicovenco/.codex/worktrees/0329/sentry-data/ml-lab/datasets/training_bundle/metadata/training_bundle_manifest.json) vei gasi sumarul bundle-ului. Artefactele principale sunt:

- `csv/*.csv`
- `parquet/*.parquet`
- `metadata/source_registry.json`
- `metadata/field_specs.json`
- `metadata/widget_training_catalog.json`
- `metadata/domain_detection_scenarios.jsonl`
- `metadata/query_generation_scenarios.jsonl`
- `metadata/rl_cluster_profiles.json`
- `metadata/rl_feedback_events.jsonl`
- `metadata/collective_adaptation_signals.json`

## Reguli de extindere

Cand adaugam o sursa noua:

1. punem generatorul de dataframe in `sources.py`;
2. il inregistram in `SOURCE_BLUEPRINTS`;
3. extindem rolurile semantice daca apar field-uri noi;
4. verificam daca domeniul nou trebuie adaugat in `PROJECT_BLUEPRINTS`;
5. adaugam cel putin un cluster RL sau extindem compatibilitatea de domenii;
6. regeneram bundle-ul si verificam sumarul.

## Criterii de calitate

- field-urile trebuie sa aiba unitati si validari coerente;
- mixed-source joins trebuie sa ramana explicabile;
- domeniile noi trebuie sa aiba scenarii reale, nu doar coloane noi;
- fiecare nou source pack trebuie sa poata sustine atat overview, cat si diagnostic si predictiv.

## Flux recomandat de lucru

1. modifici generatorul modular;
2. rulezi generatorul local;
3. verifici manifestul;
4. inspectezi `field_specs.json` si scenariile JSONL;
5. actualizezi documentatia daca ai introdus domenii noi.
