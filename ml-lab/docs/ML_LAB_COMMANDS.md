# ML-LAB Command Dictionary

Acest document centralizeaza comenzile uzuale pentru pregatirea datelor, generarea bundle-urilor, demo-urile locale si fluxurile de training / serving.

## Comenzi pentru pregatirea datelor

### Genereaza bundle-ul complet de antrenare

Din radacina repo-ului:

```bash
python3 ml-lab/datasets/generate_bundle.py --output-dir ml-lab/datasets/training_bundle --rows-per-source 240
```

### Genereaza bundle-ul din directorul `ml-lab`

```bash
cd ml-lab
python3 -m datasets.generator --output-dir datasets/training_bundle --rows-per-source 240
```

### Regenerare determinista cu seed explicit

```bash
python3 ml-lab/datasets/generate_bundle.py --output-dir ml-lab/datasets/training_bundle --rows-per-source 240 --seed 42
```

### Verifica manifestul bundle-ului

```bash
python3 - <<'PY'
import json
from pathlib import Path
manifest = json.loads(Path('ml-lab/datasets/training_bundle/metadata/training_bundle_manifest.json').read_text())
print(json.dumps(manifest['summary'], indent=2))
PY
```

## Comenzi pentru debug si validare generator

### Compile check pentru generatorul modular

```bash
PYTHONPYCACHEPREFIX=/tmp/codex-pycache python3 -m py_compile \
  ml-lab/datasets/generator/common.py \
  ml-lab/datasets/generator/sources.py \
  ml-lab/datasets/generator/catalog.py \
  ml-lab/datasets/generator/bundle.py \
  ml-lab/datasets/generator/cli.py
```

### Vezi structura bundle-ului generat

```bash
find ml-lab/datasets/training_bundle -maxdepth 2 -type f | sort
```

## Comenzi pentru ML-LAB local

### Pornește API-ul Sentinel local

```bash
cd ml-lab
python3 main.py
```

### Ruleaza demo de auto-discovery

```bash
cd ml-lab
python3 core/gold_discovery.py
```

### Ruleaza demo de self-healing

```bash
cd ml-lab
python3 self_healing_demo.py
```

### Ruleaza demo de goal alignment

```bash
cd ml-lab
python3 align_demo.py
```

## Comenzi pentru training si Modal

### Training remote pe Modal

```bash
modal run ml-lab/modal_training.py
```

### Sandbox executor in development

```bash
modal serve modal_executor.py
```

### Sandbox executor in production

```bash
modal deploy modal_executor.py
```

### Vezi volume-urile Modal

```bash
modal volume ls sentinel-ml-checkpoints /
```

## Comenzi de inspectie utile

### Cauta rapid referinte la generator sau dataset-uri

```bash
rg -n "datasets.generator|training_bundle|field_specs|widget_training_catalog" ml-lab -S
```

### Inspecteaza primele scenarii de query generation

```bash
head -n 5 ml-lab/datasets/training_bundle/metadata/query_generation_scenarios.jsonl
```

### Inspecteaza noile source packs

```bash
python3 - <<'PY'
import json
from pathlib import Path
manifest = json.loads(Path('ml-lab/datasets/training_bundle/metadata/training_bundle_manifest.json').read_text())
for item in manifest["source_exports"]:
    if item["source_name"].startswith(("banking_", "enterprise_", "telecom_", "healthcare_")):
        print(item["source_name"])
PY
```

## Cand folosim ce

- folosesti `generate_bundle.py` cand vrei sa regenerezi artefactele de antrenare;
- folosesti `python3 -m datasets.generator` cand lucrezi deja din `ml-lab/`;
- folosesti `main.py` cand vrei API local Sentinel;
- folosesti `modal_training.py` cand vrei training remote;
- folosesti `modal_executor.py` cand vrei sandbox agents pe Modal.
