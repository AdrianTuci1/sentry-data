# Generator Modules

Directorul `ml-lab/datasets/generator/` contine generatorul modular pentru bundle-ul de antrenare.

## Module

- `common.py`: constante, seed-uri si utilitare numerice / temporale.
- `sources.py`: toate sursele sintetice brute si generatorii de dataframe-uri.
- `catalog.py`: blueprint-uri pentru surse, roluri semantice, widget-uri, proiecte si clustere RL.
- `bundle.py`: construirea registrului de surse, field specs, scenarii, semnale RL si exportul bundle-ului.
- `cli.py`: parserul de argumente si entrypoint-ul de linie de comanda.
- `__main__.py`: permite rularea cu `python3 -m datasets.generator`.

## Entry points

Din radacina repo-ului:

```bash
python3 ml-lab/datasets/generate_bundle.py --output-dir ml-lab/.generated/training_bundle --rows-per-source 240
```

Din `ml-lab/`:

```bash
python3 -m datasets.generator --output-dir .generated/training_bundle --rows-per-source 240
```

## Gemini synthetic datasets

Pentru varietate controlata de LLM, fara dependinte Python extra:

```bash
GEMINI_API_KEY=<key> \
GEMINI_MODEL=gemini-2.5-flash \
python3 ml-lab/datasets/generator/gemini_synthetic.py \
  --domain omnichannel_commerce \
  --sources orders,web_sessions,ad_spend,support_tickets \
  --rows-per-source 80 \
  --variety stress \
  --output-dir ml-lab/.generated/gemini_synthetic/commerce_stress
```

Upload bundle-ul generat in R2:

```bash
python3 ml-lab/datasets/upload_bundle_to_r2.py \
  --bundle-dir ml-lab/.generated/training_bundle
```

Sau direct prin Modal:

```bash
modal run ml-lab/modal_r2_artifacts.py --action training-bundle --rows-per-source 320
```

Modelul este configurabil prin `GEMINI_MODEL`, deci poate fi schimbat la `gemini-3.1-flash` daca acel cod de model exista in contul/API-ul folosit. Scriptul scrie CSV, JSONL si `manifest.json`.
