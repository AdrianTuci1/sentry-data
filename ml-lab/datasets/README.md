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
python3 ml-lab/datasets/generate_bundle.py --output-dir ml-lab/datasets/training_bundle --rows-per-source 240
```

Din `ml-lab/`:

```bash
python3 -m datasets.generator --output-dir datasets/training_bundle --rows-per-source 240
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
