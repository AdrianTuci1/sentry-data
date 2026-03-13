# Adaptive Pipeline Architecture — Planning v2

## Viziunea

Pipeline-ul e un motor de decizie care: detectează ce date ai → decide ce insight-uri sunt posibile → generează dashboards → lansează ML → suprascrie cu predicții. **Nu** re-rulează tot la fiecare refresh.

---

## 1. Diferential Pipeline — 3 Path-uri de Execuție

Principiul: **tokenii sunt costul #1**, nu VM-urile. Fiecare run trebuie să fie $0.15-0.25, max $10/lună per proiect.

### Hot Path — Date noi, schema identică (95% din rulări)

```
Date noi → Schema fingerprint CHECK → Identic?
  ├── DA → Rulează scripturile CACHED (0 tokeni LLM)
  │         → DuckDB execută SQL-urile deja generate
  │         → Dashboards se actualizează instant
  │         → Cost: ~$0.00 (doar compute)
  │
  └── NU → Cold Path ↓
```

**Ce se întâmplă concret:**
1. Webhook primește `POST /webhooks/meltano` → date noi în bronze
2. Scripturile cached din R2 rulează în sandbox → normalizare + gold table
3. SQL-urile cached din DynamoDB rulează în analytics worker → JSON nou
4. Frontend primește via SSE → dashboards actualizate
5. **Zero apeluri LLM**

### Cold Path — Schema schimbată sau sursă nouă (~5% din rulări)

```
Schema diferită SAU sursă nouă
  → Invalidare cache (scripturile vechi)
  → LLM regenerează scripturile
  → Source Classifier re-evaluează
  → Insight Strategy recalculează
  → Query Generator produce SQL-uri noi
  → Cost: ~$0.15-0.25 (tokeni LLM)
```

**Triggere Cold Path:**
- Coloane adăugate/șterse în sursă
- Tip nou de sursă conectat (ex: prima dată FB Ads)
- User forțează manual "Re-discover"

### ML Path — Periodic, decuplat (weekly/configurable)

```
Cron weekly → Verifică: "Au fost suficiente date noi de la ultimul training?"
  ├── DA (>N rows noi) → Re-train models → Scrie predictions → Re-run QG v2
  │                       Cost: ~$0.10-0.15 (tokeni) + compute
  │
  └── NU → Skip. Predicțiile existente rămân valide.
```

**Key insight:** ML models nu re-trainează la fiecare data refresh. Un model LTV antrenat pe 10k comenzi nu devine semnificativ mai bun cu 50 comenzi noi. Re-train se face weekly sau când datele noi depășesc un threshold.

---

## 2. Cost Budget — Target: max $10/lună per proiect

### Estimare costuri per tip de run

| Tip run | Frecvență tipică | Tokeni LLM | Cost/run | Cost/lună |
|---------|-----------------|------------|----------|-----------|
| **Hot Path** | Zilnic (30/lună) | 0 | $0.00 | $0.00 |
| **Cold Path** (schema change) | 1-2x/lună | ~30k tokens | ~$0.20 | ~$0.40 |
| **Cold Path** (sursă nouă) | Rar | ~50k tokens | ~$0.25 | ~$0.25 |
| **ML Path** (re-train) | Weekly (4/lună) | ~15k tokens | ~$0.10 | ~$0.40 |
| **First Run** (full discovery) | O dată | ~100k tokens | ~$1.50 | $1.50 |
| | | | **Total estimat:** | **~$2.55/lună** |

### Mecanisme de economisire

| Mecanism | Deja implementat? | Economie |
|----------|-------------------|----------|
| Script caching (CACHE HIT) | ✅ Da | 90%+ din rulări = 0 tokeni |
| Schema fingerprinting | ❌ Nu (planificat) | Previne invalidări false |
| Token budget cap per proiect | ❌ Nu | Hard limit: refuză LLM call dacă bugetul e epuizat |
| Prompt compression | ❌ Nu | Trimite doar schema, nu datele |
| Model reuse (skip re-train) | ❌ Nu | ML nu re-trainează dacă Δdata < threshold |

### Token Budget Tracking

```typescript
// Pe ProjectEntity salvăm:
tokenUsage: {
    currentMonth: number,    // tokeni consumați luna asta
    monthlyBudget: number,   // default: 300k tokens (~$10)
    lastResetAt: string,     // ISO date — reset la 1 ale lunii
    history: { month: string, tokens: number, cost: number }[]
}
```

Înainte de fiecare LLM call → verificare:
- `currentMonth + estimatedTokens > monthlyBudget` → **REFUZĂ** + notifică user via SSE

---

## 3. Pipeline Steps — Versiunea completă

```
┌─────────────────────────────────────────────────┐
│  HOT PATH (date noi, schema identică)           │
│  1. Normalization ........... script CACHED ✓    │
│  2. Feature Engineering ..... script CACHED ✓    │
│  3. SQL Execution ........... queries CACHED ✓   │
│  → Dashboard update (0 tokeni)                   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  COLD PATH (schema schimbată / sursă nouă)      │
│  1. Normalization ........... LLM regenerează    │
│  2. Source Classifier ....... LLM clasifică      │
│  3. Feature Engineering ..... LLM regenerează    │
│  4. Insight Strategy ........ Rule-based (0 tok) │
│  5. Query Generator v1 ...... LLM generează SQL  │
│  → Dashboard update ($0.15-0.25)                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  ML PATH (periodic, decuplat)                   │
│  6. ML Models ............... Train/predict      │
│  7. Query Generator v2 ...... LLM enhance SQL    │
│  → Enhanced dashboards ($0.10-0.15)              │
└─────────────────────────────────────────────────┘
```

---

## 4. Source Classifier (Step 2 — Cold Path only)

Un agent LLM analizează schemele normalizate și clasifică fiecare sursă:

| Clasificare | Semnale detectate | Exemple |
|------------|-------------------|---------|
| `ads` | impressions, clicks, spend, campaign_id, cpc, ctr | FB Ads, Google Ads |
| `clickstream` | session_id, event_type, page_url, referrer | GA4, Mixpanel |
| `ecommerce` | order_id, product_id, price, quantity | Shopify, Olist |
| `crm` | customer_id, lead_status, deal_value | HubSpot |
| `financial` | revenue, cost, profit | Custom CSV |

---

## 5. Insight Strategy Matrix (Rule-based, 0 tokeni)

| Combinație surse | Insight-uri deblocate |
|-----------------|----------------------|
| `ecommerce` | Revenue, AOV, product mix, geo distribution |
| + `ads` | ROAS, acquisition cost, budget pacing, ad fatigue, creative health |
| + `clickstream` | Conversion funnel, bounce rate, peak engagement, live pulse |
| + `crm` | Leads, sales funnel, lead scoring |
| Orice 2+ surse | Retention, cohort analysis |
| ML ready | Predictive LTV, churn probability |

---

## 6. Insight-uri noi propuse

### 🔬 Model Training Saturation

**Ce face:** Monitorizează dacă ML models mai învață ceva util din datele noi.

Metrici:
- **Learning curve slope** — dacă accuracy/RMSE s-a plafonat
- **Δ performance** — diferența de performanță între ultimele 2 antrenări
- **Data sufficiency score** — raport: rows disponibile vs. rows necesare estimat

Output mesaj:
```
"LTV model saturated: accuracy improvement < 0.1% over last 3 trainings.
 Recommendation: Add new feature sources (clickstream/ads) or wait for 5k+ new orders."
```

**Utilitate:** Previne re-training inutil → economisește tokeni + compute.

### 💊 Core Vitals (System Health Dashboard)

**Ce face:** Un dashboard meta care arată sănătatea pipeline-ului însuși.

| Metric | Sursă | Scop |
|--------|-------|------|
| Pipeline latency | Timestamps start/end | Cât durează un run? |
| Cache hit rate | R2 script checks | Ce % din runuri sunt gratuite? |
| Token usage (MTD) | Token budget tracker | Cât am cheltuit luna asta? |
| Data freshness | Source `lastRunAt` | Cât de vechi sunt datele? |
| Model accuracy trend | ML metrics history | Modelele se degradează? |
| Cost per insight | Tokeni / nr dashboards | Eficiența pipeline-ului |

**Core Vitals** e generat **fără LLM** — e pur metadata din DynamoDB.

---

## 7. Prioritizare

| Fază | Ce | Efort | Cost impact |
|------|----|-------|-------------|
| **v1** ✅ | Pipeline fix (Normalize → FE → QG) | Done | ~$1.50 first run |
| **v1.5** | Schema fingerprint + cache invalidation | ~1h | Hot Path = $0 |
| **v2** | Source Classifier + Insight Strategy | ~4h | Cold Path only |
| **v2.5** | Token budget tracking + Core Vitals | ~2h | Cap la $10/mo |
| **v3** | ML Models (LTV, churn) + saturation check | ~6h | +$0.40/mo |
| **v4** | Two-pass QG (SQL v1 → ML → SQL v2) | ~3h | +$0.10/run |
