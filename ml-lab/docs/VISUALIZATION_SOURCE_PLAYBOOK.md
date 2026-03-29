# Visualization Source Playbook

Acest document descrie ce tipuri de vizualizari poate genera platforma in functie de sursele de date conectate, cum se comporta sistemul cand apar amestecari multi-source si cum se extinde aceeasi logica spre banking, cybersecurity, senzori, servere, enterprise BI, ecommerce si alte domenii.

Documentul este aliniat cu:
- bundle-ul de antrenare din `ml-lab/datasets/training_bundle/metadata/`;
- catalogul de widget-uri sintetice de antrenare cu 44 de widget-uri;
- componentele UI deja existente in `boilerplates/widgets/`.

## Cum alege sistemul vizualizarile

Pipeline-ul ideal este:

1. Detecteaza rolurile semantice ale field-urilor.
Exemple: `financial_metric`, `marketing_spend`, `traffic_metric`, `performance_metric`, `security_metric`, `sensor_metric`, `quality_metric`, `cost_metric`.

2. Stabileste domeniile dominante.
Exemple: `saas_metrics`, `web_analytics`, `commerce`, `cybersecurity`, `observability`, `finops`, `iot_operations`.

3. Alege un pachet de vizualizari in trei straturi.
- `overview`: 4-8 widget-uri executive care spun povestea de baza.
- `diagnostic`: 3-6 widget-uri de drill-down pentru cauze, anomalii si tensiuni intre surse.
- `predictive/adaptive`: 1-4 widget-uri pentru forecast, clustering sau policy feedback.

4. Genereaza artefactele de executie.
- query-uri SQL pentru fact tables si serving queries;
- scripturi Python pentru feature engineering, drift, clustering sau forecasting;
- metadata de incredere pentru join-uri si pentru reranking RL.

5. Ajusteaza selecția in timp.
Cand mai multi useri deviaza in aceeasi directie, sistemul repondera field-urile si promoveaza alte widget-uri, nu doar alte query-uri.

## Matrice Domeniu -> Vizualizari

Nota: generatorul curent materializeaza explicit SaaS, product, web, marketing, ecommerce, sales, support, observability, FinOps, cybersecurity si IoT. Banking si Enterprise BI folosesc aceleasi roluri semantice si sunt acoperite la nivel de design, dar merita un source pack dedicat in pasul urmator.

| Domeniu | Surse tipice | Vizualizari primare | Vizualizari de diagnostic | Vizualizari predictive / adaptive |
| --- | --- | --- | --- | --- |
| SaaS / Product Analytics | billing, subscriptions, product events, CRM, support | `north_star_kpi_board`, `mrr_retention_curve`, `activation_funnel`, `seat_utilization_balance` | `cohort_retention_heatmap`, `expansion_vs_contraction`, `customer_health_command`, `churn_risk_bubble_map` | `workspace_growth_clusters`, `demand_forecast_ribbon`, `reinforcement_policy_map` |
| Marketing / Web Analytics | GA4, Meta Ads, TikTok Ads, landing pages, attribution logs | `session_quality_breakdown`, `demand_generation_mix`, `roas_treemap`, `path_to_conversion_funnel` | `landing_page_dropoff_sankey`, `campaign_fatigue_monitor`, `spend_efficiency_frontier`, `multi_touch_attribution_paths` | `ltv_cac_radar`, `collective_deviation_compass` |
| Ecommerce | orders, payments, returns, GA4, ads, support | `north_star_kpi_board`, `roas_treemap`, `checkout_friction_matrix`, `demand_forecast_ribbon` | `customer_segment_clusters`, `path_to_conversion_funnel`, `support_burden_heatmap`, `inventory_pressure_matrix` | `spend_efficiency_frontier`, `revenue_forecast_vs_capacity` |
| Banking / Financial Services | core banking ledger, card processing, AML alerts, KYC, channels, collections | `north_star_kpi_board`, `revenue_growth_waterfall`, `executive_mixed_signal_wall`, `ltv_cac_radar` | `schema_drift_radar`, `customer_health_command`, `anomaly_investigation_panel`, `privileged_access_watchtower` | `customer_segment_clusters`, `reinforcement_policy_map`, `collective_deviation_compass` |
| Cybersecurity | SIEM, VPC flow logs, IAM/Auth0, EDR, vuln scanner | `security_threat_surface`, `privileged_access_watchtower`, `anomaly_investigation_panel` | `exfiltration_risk_chord`, `schema_drift_radar`, `latency_error_correlation` | `reinforcement_policy_map`, `collective_deviation_compass` |
| Servere / Observability | logs, traces, APM, metrics, deploy history, incidents | `incident_reliability_timeline`, `slo_burn_down`, `cloud_cost_efficiency`, `executive_mixed_signal_wall` | `latency_error_correlation`, `deploy_vs_incident_scatter`, `source_quality_lineage`, `anomaly_investigation_panel` | `revenue_forecast_vs_capacity`, `collective_deviation_compass` |
| Senzori / IoT | PLC/SCADA, telemetry, QA, maintenance, throughput | `inventory_pressure_matrix`, `anomaly_investigation_panel`, `demand_forecast_ribbon` | `latency_error_correlation`, `support_burden_heatmap`, `schema_drift_radar` | `workspace_growth_clusters`, `reinforcement_policy_map` |
| Enterprise BI | ERP, CRM, finance, procurement, HR, projects | `executive_mixed_signal_wall`, `pipeline_velocity_board`, `revenue_growth_waterfall`, `north_star_kpi_board` | `source_quality_lineage`, `schema_drift_radar`, `customer_segment_clusters`, `support_burden_heatmap` | `revenue_forecast_vs_capacity`, `collective_deviation_compass` |
| Support / Customer Operations | tickets, CSAT, escalations, product usage, churn | `customer_health_command`, `support_burden_heatmap`, `csat_resolution_tradeoff` | `churn_risk_bubble_map`, `seat_utilization_balance`, `anomaly_investigation_panel` | `workspace_growth_clusters`, `reinforcement_policy_map` |
| FinOps | cloud billing, capacity, usage, SLO burn, per-request cost | `cloud_cost_efficiency`, `finops_waste_treemap`, `executive_mixed_signal_wall` | `slo_burn_down`, `latency_error_correlation`, `source_quality_lineage` | `revenue_forecast_vs_capacity`, `collective_deviation_compass` |

## Ce vede userul cand sursele se amesteca

Cand un proiect combina surse din mai multe domenii, sistemul nu concateneaza vizualizari la intamplare. El urmeaza o logica de fuziune:

1. Normalizeaza granularitatea.
Zilnic, orar sau saptamanal devin un `serving grain` comun. Datele mai fine sunt agregate, iar cele mai coarse sunt pastrate ca overlay.

2. Evalueaza increderea join-urilor.
Prioritatea este `timestamp`, apoi chei de business precum `tenant_id`, `workspace_id`, `campaign_cluster`, `service_name`, `region`, `account_id`.

3. Creeaza fact tables hibride.
Exemple: venit vs cost vs latenta, churn vs suport vs adoptie, conversii vs lead quality vs securitate.

4. Activeaza widget-uri de conflict sau sinteza.
Exemple: `executive_mixed_signal_wall`, `source_quality_lineage`, `collective_deviation_compass`, `schema_drift_radar`.

5. Porneste bucla RL.
Daca un cluster de useri se muta catre diagnostic, forecasting sau mixed-source views, sistemul creste greutatea field-urilor relevante si ridica in top alte widget-uri.

## Scenarii de amestecare

| Mix de surse | Ce obtine userul | Ce genereaza agentii | Ce se ajusteaza automat |
| --- | --- | --- | --- |
| Banking + Cybersecurity | risc operational, fraude, acces privilegiat, tensiune intre volum tranzactional si alerte | joins pe cont, client, canal, timestamp; scoruri AML; panouri de investigatie | praguri mai stricte pe outlier detection si mai multa pondere pe `security_metric` |
| Ecommerce + Ads + GA4 + Support | poveste completa de la trafic la comanda, retur si ticket | funnel-uri, cohorts, CAC/ROAS, corelatii intre suport si conversie | accent pe `checkout_friction_matrix`, `roas_treemap`, `support_burden_heatmap` |
| SaaS + Product + Support + Observability | relatie intre adoptie, churn, performanta sistemului si supraincarcare suport | feature store comun pentru churn, health scores, capacity overlays | pondere crescuta pentru `quality_metric`, `performance_metric`, `adoption_metric` |
| Senzori + Servere + FinOps | legatura dintre productie, telemetrie, cost si incidente | ferestre temporale pe ore/zile, anomalii de vibratie si cost per throughput | sistemul favorizeaza `inventory_pressure_matrix`, `cloud_cost_efficiency`, `anomaly_investigation_panel` |
| Enterprise BI + CRM + ERP + Finance | board executiv unificat cu revenue, pipeline, cost si delivery risk | fact table unificat pe unitati, regiuni, produse, perioade | se ridica `executive_mixed_signal_wall`, `revenue_growth_waterfall`, `source_quality_lineage` |
| Web + Sales Pipeline + ML Predictions | traseu de la intentie la closed-won sau forecast | sankey, lead scoring, propensity models, segmentation | sistemul favorizeaza `multi_touch_attribution_paths`, `pipeline_velocity_board`, `customer_segment_clusters` |

## Recomandari specifice pe domenii sensibile

### Banking

Field-uri critice:
- tranzactii, expunere, sold, delinquency, utilizare card, alerte AML, risc client, canal, sucursala, dispozitiv.

Vizualizari recomandate:
- board executiv pentru lichiditate si venit;
- waterfall pe venit net si provizioane;
- cluster map pe segmente de clienti si risc;
- sankey pe migratie intre canale si produse;
- watchtower pentru acces privilegiat si anomalii AML.

Ce trebuie adaugat in dataset pack:
- `bank_transactions`
- `loan_portfolio`
- `card_authorizations`
- `aml_alerts`
- `branch_operations`

### Cybersecurity

Field-uri critice:
- failed logins, privileged actions, suspicious IPs, bytes out, severitate alerta, endpoint health, vulnerability age.

Vizualizari recomandate:
- suprafata de atac;
- chord de exfiltrare;
- radar de drift pe schema si pe severitati;
- flux pe identitate -> actiune -> impact.

### Senzori si date industriale

Field-uri critice:
- temperatura, vibratie, throughput, defect rate, consum energetic, stari mentenanta.

Vizualizari recomandate:
- matrix pentru presiune de inventar si calitate;
- panou de anomalii;
- ribbon pentru forecast de throughput;
- scatter pe defect rate vs vibratie.

### Servere, observability si date de performanta

Field-uri critice:
- request count, p95 latency, error rate, saturation, deploy frequency, incident count, cloud cost.

Vizualizari recomandate:
- timeline pe incidente si fiabilitate;
- burn-down pe SLO;
- cost efficiency board;
- scatter deploy vs incident;
- lineage pentru surse si calitatea lor.

### Enterprise BI

Field-uri critice:
- revenue, margin, pipeline, budget, forecast, headcount, procurement lead time, project burn.

Vizualizari recomandate:
- wall executiv mixt;
- waterfall pe revenue si cost;
- pipeline velocity;
- clusters pe unitati de business;
- radar pe drift operational.

## Mapare catre componentele UI existente

Widget-urile de antrenare nu trebuie sa fie identice 1-la-1 cu componentele vizuale curente. In practica, ele se pot materializa astfel:

| Familie logica | Componente existente care se potrivesc |
| --- | --- |
| `scorecard-grid` | `SimpleMicro`, `ChronoDial`, `LiquidGauge`, `PulseCircle`, `TechnicalHealth` |
| `line-ribbon` | `RangeArea`, `StreamGraph`, `Forecast`, `LiveTraffic` |
| `heatmap` | `ActivityHeatmap`, `OptimalTime`, `Cohorts`, `IntensityHeat` |
| `funnel` / `sankey` | `Funnel`, `Sankey`, `Attribution` |
| `scatter` / `clusters` | `ScatterPlot`, `LeadClustering`, `CreativeQuadrant` |
| `radar` | `InterestRadar`, `MarketSentiment` |
| `waterfall` / financial | `Waterfall`, `BudgetSensitivity` |
| `network` / mixed-source topology | `MarketEvolution`, `IntentSunburst` |
| anomaly / streaming alerts | `AnomalyStream`, `TechnicalHealth`, `TrendSpotter` |

## Reguli bune pentru mixed-source dashboards

- Mereu livreaza un board executiv plus un set scurt de drill-down, nu doar un perete de grafice.
- Cand lipseste cheia perfecta de join, expune un scor de incredere, nu un join fortat tacut.
- Nu combina metri cu unitati incompatibile fara normalizare si etichetare explicita.
- Cand apar semnale contradictorii, promoveaza widget-uri de conflict, nu doar KPI cards.
- Pentru domenii noi, maparea incepe din rolurile semantice ale field-urilor si abia apoi din numele surselor.

## Extensia implementata

Source packs dedicate adaugate in generatorul de dataset-uri:
- banking / fraud / liquidity: `banking_core_ledger`, `banking_aml_alerts`
- enterprise BI / ERP / procurement: `enterprise_erp_finance`, `enterprise_procurement_ops`
- telecom / network health: `telecom_network_health`, `telecom_subscriber_usage`
- healthcare operations: `healthcare_operations`, `healthcare_capacity_planning`

Acestea intra acum direct in bundle-ul de antrenare si in scenariile multi-domain, astfel incat agentii pot invata nu doar domeniile clasice, ci si combinatiile dintre banking, BI, retele telecom si operatiuni medicale.
