# Sandboxes - Modal Agents

Acest folder contine agentii AI care ruleaza in sandbox-uri izolate pe platforma Modal.

## Structura

- `agent.py` - Agentul principal care primeste context si credentiale temporare
- `requirements.txt` - Dependente Python
- `Dockerfile` - Imagine container pentru agent

## Cum functioneaza

1. Backend-ul genereaza credentiale temporare (STS tokens) pentru GCS si BigQuery
2. Backend-ul apeleaza Modal webhook cu contextul sesiunii
3. Agentul ruleaza in sandbox izolat cu acces limitat la resursele proiectului
4. Agentul salveaza rezultatele in GCS si notifica backend-ul prin webhook

## Securitate

- Fiecare agent primeste doar credentiale temporare (15-60 minute)
- Accesul este limitat la prefixul proiectului in GCS
- Accesul BigQuery este limitat la dataset-ul proiectului
- Nicio cheie statica nu este distribuita catre agenti
