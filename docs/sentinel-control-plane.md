# Sentinel Control Plane

Sentinel are doua roluri complementare:

1. observer operational care invalideaza proiectii, query-uri, widget-uri si recomandari ML cand sursele sau formulele devin riscante;
2. policy learner metadata-only care invata preferinte din interactiuni fara sa stocheze raw rows.

## Modele disponibile

- `CoverageRanker`: verifica daca fiecare sursa are acoperire minima: volum, freshness cand exista timestamp, trend cand exista metric + timestamp, ML recommendation cand exista metric.
- `DriftClassifier`: compara fingerprint-uri, source cursors si prefixuri goale ca sa marcheze drift sau invalidare.
- `QueryRiskModel`: detecteaza SQL destructiv, scanari mari directe si formule neclare.
- `InteractionPolicyModel`: aplica priors din feedback-ul agregat al utilizatorilor asupra widget-urilor, surselor si recomandarilor.

Implementarea backend este in:

[SentinelModels.ts](/Users/adriantucicovenco/Proiecte/sentry-data/sentry-backend/src/application/services/SentinelModels.ts)

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
