# Sentinel Control Plane

Sentinel are doua roluri complementare:

1. observer operational care invalideaza proiectii, query-uri, widget-uri si recomandari ML cand sursele sau formulele devin riscante;
2. policy learner metadata-only care invata preferinte din interactiuni fara sa stocheze raw rows.

## Modele disponibile

- `CoverageRanker`: model antrenat din `source_registry.json`; estimeaza acoperirea unei surse pe baza schemei, volumului, metricilor, timpului si cheilor de entitate.
- `DriftClassifier`: LSTM antrenat din seriile numerice generate; marcheaza drift pe sample-uri si completeaza invalidarea bazata pe fingerprint.
- `QueryRiskModel`: model antrenat din scenarii de query generation plus augmentari SQL sigure/riscante; detecteaza SQL distructiv sau formule riscante.
- `InteractionPolicyModel`: model antrenat din `rl_feedback_events.jsonl`; estimeaza interesul pentru recomandari ML si widget-uri fara raw rows.

Trainerul este in [sentinel_training.py](/Users/adriantucicovenco/Proiecte/sentry-data/ml-lab/sentinel_training.py), iar runtime-ul Modal este in [sentinel_service](/Users/adriantucicovenco/Proiecte/sentry-data/modal_apps/sentinel_service).

## Feedback RL

Endpoint:

```http
POST /api/projects/<projectId>/feedback/sentinel
```

Payload metadata-only:

```json
{
  "targetType": "widget",
  "targetId": "ins-source-volume",
  "action": "accept",
  "reward": 1,
  "metadata": {
    "widgetType": "technical-health",
    "modelName": "CoverageRanker"
  }
}
```

Evenimentele sunt salvate in R2 sub `feedback/events/...`, iar starea agregata in `feedback/sentinel-policy-state.json`.

## Override-uri user

Endpoint-uri:

```http
GET  /api/projects/<projectId>/runtime/overrides
POST /api/projects/<projectId>/runtime/overrides
GET  /api/projects/<projectId>/runtime/code-formulas
```

Regula produsului: decizia userului se pastreaza. Sentinel o blocheaza doar daca este nefunctionala sau nesigura; altfel intoarce warnings inainte de executie.

`code-formulas` expune doar formula editabila, fara versiuni, registry-uri sau chei interne de proiectie.
