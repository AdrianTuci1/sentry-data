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
python3 ml-lab/datasets/generate_bundle.py --output-dir ml-lab/datasets/training_bundle --rows-per-source 240
```

Din `ml-lab/`:

```bash
python3 -m datasets.generator --output-dir datasets/training_bundle --rows-per-source 240
```
