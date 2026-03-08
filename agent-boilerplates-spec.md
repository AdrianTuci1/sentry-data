# The Agent Boilerplate Engine

**Problema:** Dacă lăsăm agentul să rescrie de la zero arhitecturi complexe (modele de predicție ml, integrări custom de transformare a datelor), consumul de tokeni și rata de eroare ("hallucinations") vor fi uriașe. Agentul trebuie să acționeze mai mult ca un configurator logic, nu ca un dezvoltator care scrie de la zero.

**Soluția: Arhitectura Bazată pe Template-uri (Boilerplates)**

Vom stoca în bucket-urile noastre R2 (ex: `s3://sentry-assets/boilerplates/...`) scripturi Python gata făcute, pre-testate, scrise și validate de noi.

### Cum funcționează?

1. **Stocarea în R2 (Admin Side):**
   Vom crea o structură de genul:
   - `boilerplates/ml_forecasting.py` (Cod complet Prophet/XGBoost care acceptă doar parametri)
   - `boilerplates/sql_transform_gold.py` (Script dbt-like pentru DuckDB care așteaptă doar numele tabelelor)
   - `boilerplates/anomaly_detection.py`

2. **Rolul Agentului (LLM Side):**
   Când un agent este trezit (în E2B/Modal), el nu primește un prompt de genul *"Scrie o rețea neurală pentru aceste date"*.
   Primește un prompt de genul:
   *"Ești un Data Engineer. Datele au schema X. Există următoarele scripturi de bază disponibile în R2 pe care le poți folosi: ml_forecasting.py, sql_transform_gold.py. Alegeti scriptul corect, descarcă-l în sandbox și modifică DOAR dicționarul CONFIG de la începutul fișierului pentru a-l potrivi cu schema pe care o ai."*

3. **Execuția în Sandbox (`AgentService`):**
   - În interiorul E2B, agentul scrie acel script mic de "glue code" (Cod de legătură).
   - Acel cod descarcă prin HTTP sau AWS SDK boilerplate-ul din R2.
   - Injectează automat configurațiile generate de LLM (ex: coloana target este `revenue`, data este `created_at`).
   - Rulează boilerplate-ul care generează output-ul sigur și validat de noi anterior.

### Exemplu de Flow în Cod (AgentService.ts)

Când apelăm agentul, noi îi putem injecta direct în Python codul care descarcă boilerplate-ul:

```python
import os
import urllib.request

# 1. Agentul descarcă automat logica complexă de la noi (ex: Predictie Vanzari)
urllib.request.urlretrieve("https://<R2_PUBLIC_URL>/boilerplates/forecasting.py", "/home/user/forecasting.py")

# 2. LLM-ul generează doar ACEASTĂ secțiune de configurare
MODEL_CONFIG = {
    "target_column": "sales_amount",
    "date_column": "transaction_date",
    "horizons": 30
}

# 3. Execută arhitectura stabilă
from forecasting import run_pipeline
result = run_pipeline(data_uri="s3://bronze/data.parquet", config=MODEL_CONFIG)
```

**Avantaje majore:**
1. **Securitate & Stabilitate:** Codul complex de Data Science este garantat să funcționeze pentru că noi l-am scris.
2. **Cost redus:** LLM-ul va consuma foarte puțini tokeni pentru a genera doar 5 rânduri de configurare (maparea coloanelor).
3. **Păstrarea cunoștințelor interne (Moat-ul tău):** Tehnologia de predicție și curățare a datelor rămâne stocată în sistemul tău R2, agentul fiind doar "pilotul" care îi apasă butoanele, neputând strica motoarele vitale.
