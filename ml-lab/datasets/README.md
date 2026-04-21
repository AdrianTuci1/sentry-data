# Training Bundle

Acest folder poate genera si gazdui un bundle coerent de antrenare pentru `ml-lab`, orientat catre:

- detectie de domenii si mixuri multi-source;
- recomandare de widget-uri puternice pentru dashboard-uri executive si diagnostice;
- generare de SQL / Python pentru fluxuri reale de data science si machine learning;
- feedback de reinforcement learning pentru reranking si ajustari colective per field.

Source packs dedicate incluse acum:

- banking / fraud / liquidity
- enterprise BI / ERP / procurement
- telecom / network health
- healthcare operations

## Generare

Din radacina repository-ului:

```bash
python3 ml-lab/datasets/generate_bundle.py --output-dir ml-lab/.generated/training_bundle --rows-per-source 240
```

Din `ml-lab/`:

```bash
python3 -m datasets.generator --output-dir .generated/training_bundle --rows-per-source 240
```

## Upload in R2

```bash
python3 ml-lab/datasets/upload_bundle_to_r2.py \
  --bundle-dir ml-lab/.generated/training_bundle
```

Scriptul citeste automat variabilele R2 din `sentry-backend/.env` daca nu sunt deja exportate in shell.

Modal training poate folosi apoi acelasi prefix:

```bash
modal run ml-lab/modal_training.py \
  --executor gpu-a10g
```

Prefix implicit: `s3://$R2_BUCKET_DATA/system/r2-system/training/sentinel/generated/latest`.

Alternativ, Modal poate genera si urca bundle-ul direct:

```bash
modal run ml-lab/modal_r2_artifacts.py --action training-bundle --rows-per-source 320
```

## Artefacte produse

- `csv/`: surse sintetice gata de inspectat sau de convertit mai departe.
- `parquet/`: aceleasi surse, scrise in Parquet atunci cand engine-ul local suporta exportul.
- `metadata/source_registry.json`: descrierea fiecarei surse si schema observata.
- `metadata/field_specs.json`: spec-uri ideale si complete pentru field-uri canonice.
- `metadata/widget_training_catalog.json`: catalog cu 44 widget-uri si contractele lor analitice.
- `metadata/domain_detection_scenarios.jsonl`: scenarii pentru detectie de domenii si selectie de widget-uri.
- `metadata/query_generation_scenarios.jsonl`: instructiuni de antrenare pentru agenti care produc SQL si Python profesional.
- `metadata/rl_cluster_profiles.json`: profile pentru multi-point clustering.
- `metadata/rl_feedback_events.jsonl`: evenimente de feedback RL pe user cohort.
- `metadata/collective_adaptation_signals.json`: directii de ajustare atunci cand mai multi useri deviaza in aceeasi directie.
- `metadata/training_bundle_manifest.json`: sumarul bundle-ului generat.

## Intentionat pentru

- proiecte SaaS, ecommerce, marketing, sales, support, observability, FinOps, cybersecurity si IoT;
- combinatii intre performanta sistemului si semnale comerciale;
- dashboard-uri cu 40-48 widget-uri recomandabile in functie de datele conectate;
- agenti care trebuie sa invete sa combine overview, diagnostic, forecast si politici RL.
