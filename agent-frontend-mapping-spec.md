# Agent-to-Frontend Communication Protocol

Pentru a rezolva problema deciziei agentului privind „ce date să afișez și unde”, introducem arhitectura **Widget Manifest**.

## Cum funcționează on-boarding-ul noului conector

1. **Adăugarea Conectorului:** Utilizatorul apasă adaugă Stripe. Sentry Backend primește evenimentul și Meltano face extragerea în Bronze Layer.
2. **Construirea Promptului Dinamic:** 
   În baza conectorilor activi, `AgentService` citește `frontend-widget-manifest.json` și filtrează doar widget-urile care au ca trigger "stripe_connector" (sau componente cross-connector dacă există mai mulți).
3. **Instruirea Agentului:** Prompt-ul către Sandbox (E2B/Modal) va suna așa:
   *"Ai la dispoziție datele din schema Stripe. Trebuie să populezi următoarele widget-uri de frontend: `total_revenue_card` și `ltv_cac_scatter`. Vezi în JSON-ul atașat (Manifestul) exact ce coloane SQL cere fiecare widget. Scrie interogările DuckDB pentru Gold Layer asftel încât output-ul SQL să se potrivească 100% cu coloanele cerute de frontend."*
4. **Validarea și Salvarea:** Agentul produce un array JSON cu `{ widgetId, sqlString }`. Noi îl salvăm în DynamoDB.
5. **Afișarea:** Când dashboard-ul Frontend dă refresh, citește din DynamoDB ce widgetId-uri sunt active, apelează Analytics Worker (Python) și arată vizualul dorit.

## Combinarea mai multor conectori (Cross-Connector Analytics)

Când utilizatorul are și `stripe_connector` și `facebook_ads_connector`:
- Manifestul are widget-ul `ltv_cac_scatter` care necesită ambele surse.
- Agentul primește schemele la AMBELE tabele (Stripe și Facebook) și i se dă comanda să scrie un SQL cu `JOIN` direct în DuckDB. 
- Agentul nu modifică frontend-ul, el doar știe să prepare SQL-ul exact pe forma cerută de `ltv_cac_scatter`.

## Avantaje
- Frontend-ul este ultra-stabil. Componentele React se așteaptă la un contract de date fix (ex: `current_value`, `previous_value`).
- Agentul are o „listă de cumpărături” clară. Nu halucinează metrici pe care nu le putem afișa, ci i se cere strict să construiască SQL pentru metricile suportate de UI-ul nostru.
