from __future__ import annotations

import numpy as np
import pandas as pd

from .common import DEFAULT_SEED, _clip, _rng, _series_wave, _time_index


def generate_saas_metrics(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED) -> pd.DataFrame:
    """Mock SaaS billing metrics with renewal, churn, and expansion signals."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    mrr = 72000 + np.linspace(0, 18000, rows) + _series_wave(rows, 4200, 7) + rng.normal(0, 1400, rows)
    active_seats = 9800 + np.linspace(0, 1600, rows) + _series_wave(rows, 430, 5, 0.4) + rng.normal(0, 120, rows)
    expansion_mrr = 6200 + _series_wave(rows, 900, 6, 0.8) + rng.normal(0, 250, rows)
    contraction_mrr = 1800 + _series_wave(rows, 240, 6, 1.2) + rng.normal(0, 90, rows)
    new_signups = 135 + _series_wave(rows, 22, 4, 0.2) + rng.normal(0, 7, rows)
    trial_to_paid_rate = _clip(0.19 + _series_wave(rows, 0.02, 4) + rng.normal(0, 0.01, rows), 0.08, 0.42)
    churn_rate = _clip(0.026 + _series_wave(rows, 0.006, 5, 0.6) + rng.normal(0, 0.0025, rows), 0.008, 0.12)
    nrr = _clip(1.05 + _series_wave(rows, 0.04, 5) + rng.normal(0, 0.01, rows), 0.88, 1.32)

    if inject_anomalies:
        tail = min(rows, 28)
        mrr[-tail:] *= np.linspace(0.96, 0.88, tail)
        churn_rate[-21:] = _clip(churn_rate[-21:] + 0.02, 0.01, 0.2)
        contraction_mrr[-21:] *= 1.35

    df = pd.DataFrame(
        {
            "timestamp": dates,
            "tenant_id": ["tenant_growth_lab"] * rows,
            "plan_name": rng.choice(["starter", "growth", "scale", "enterprise"], size=rows, p=[0.22, 0.31, 0.29, 0.18]),
            "mrr": np.round(mrr, 2),
            "arr": np.round(mrr * 12, 2),
            "expansion_mrr": np.round(expansion_mrr, 2),
            "contraction_mrr": np.round(contraction_mrr, 2),
            "new_signups": np.round(_clip(new_signups, 45, 280)).astype(int),
            "active_seats": np.round(_clip(active_seats, 3000, 30000)).astype(int),
            "trial_to_paid_rate": np.round(trial_to_paid_rate, 4),
            "churn_rate": np.round(churn_rate, 4),
            "net_revenue_retention": np.round(nrr, 4),
        }
    )
    return df


def generate_product_usage_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 1) -> pd.DataFrame:
    """Mock product-led growth and adoption metrics."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    weekly_active_teams = 1600 + np.linspace(0, 380, rows) + _series_wave(rows, 95, 5) + rng.normal(0, 30, rows)
    feature_adoption_rate = _clip(0.47 + _series_wave(rows, 0.08, 6, 0.7) + rng.normal(0, 0.02, rows), 0.18, 0.95)
    activation_rate = _clip(0.32 + _series_wave(rows, 0.05, 4) + rng.normal(0, 0.015, rows), 0.12, 0.82)
    seats_provisioned = 11000 + np.linspace(0, 1400, rows) + _series_wave(rows, 220, 4, 0.5) + rng.normal(0, 80, rows)
    seats_active = seats_provisioned * _clip(0.73 + _series_wave(rows, 0.04, 5, 0.2) + rng.normal(0, 0.01, rows), 0.5, 0.94)
    workspace_growth_rate = _clip(0.018 + _series_wave(rows, 0.007, 5) + rng.normal(0, 0.003, rows), -0.01, 0.08)

    if inject_anomalies:
        feature_adoption_rate[120:145] = _clip(feature_adoption_rate[120:145] - 0.12, 0.1, 1.0)
        seats_active[120:145] *= 0.88

    return pd.DataFrame(
        {
            "timestamp": dates,
            "workspace_id": [f"ws_{1000 + (i % 17)}" for i in range(rows)],
            "weekly_active_teams": np.round(_clip(weekly_active_teams, 300, 5000)).astype(int),
            "feature_adoption_rate": np.round(feature_adoption_rate, 4),
            "activation_rate": np.round(activation_rate, 4),
            "seats_provisioned": np.round(_clip(seats_provisioned, 2000, 30000)).astype(int),
            "seats_active": np.round(_clip(seats_active, 1000, 30000)).astype(int),
            "workspace_growth_rate": np.round(workspace_growth_rate, 4),
        }
    )


def generate_ga4_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 2) -> pd.DataFrame:
    """Mock GA4 event data with session quality signals."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    sessions = 8400 + np.linspace(0, 1200, rows) + _series_wave(rows, 620, 8) + rng.normal(0, 180, rows)
    page_views = sessions * _clip(2.8 + _series_wave(rows, 0.25, 5) + rng.normal(0, 0.08, rows), 1.5, 5.2)
    engaged_sessions = sessions * _clip(0.62 + _series_wave(rows, 0.06, 5, 0.3) + rng.normal(0, 0.02, rows), 0.28, 0.92)
    bounce_rate = _clip(0.39 + _series_wave(rows, 0.06, 5, 1.0) + rng.normal(0, 0.015, rows), 0.12, 0.84)
    avg_session_duration_sec = 146 + _series_wave(rows, 28, 4) + rng.normal(0, 9, rows)
    demo_requests = sessions * _clip(0.012 + _series_wave(rows, 0.004, 4, 0.8) + rng.normal(0, 0.0015, rows), 0.003, 0.04)

    if inject_anomalies:
        bounce_rate[75:96] = _clip(bounce_rate[75:96] + 0.18, 0.1, 0.95)
        avg_session_duration_sec[75:96] *= 0.7

    return pd.DataFrame(
        {
            "timestamp": dates,
            "channel": rng.choice(["organic", "paid", "partner", "direct"], size=rows, p=[0.34, 0.32, 0.12, 0.22]),
            "sessions": np.round(_clip(sessions, 1500, 25000)).astype(int),
            "page_views": np.round(_clip(page_views, 3000, 120000)).astype(int),
            "engaged_sessions": np.round(_clip(engaged_sessions, 1000, 20000)).astype(int),
            "bounce_rate": np.round(bounce_rate, 4),
            "avg_session_duration_sec": np.round(_clip(avg_session_duration_sec, 20, 900), 2),
            "demo_requests": np.round(_clip(demo_requests, 5, 600)).astype(int),
        }
    )


def generate_marketing_data(
    rows: int = 365,
    source: str = "meta",
    inject_anomalies: bool = False,
    seed: int = DEFAULT_SEED + 3,
) -> pd.DataFrame:
    """Mock paid acquisition performance for Meta, TikTok, LinkedIn, or Google Ads."""
    source_offsets = {"meta": 0, "tiktok": 7, "linkedin": 11, "google": 13}
    rng = _rng(seed + source_offsets.get(source, 0))
    dates = _time_index(rows, "D")

    spend = 5200 + np.linspace(0, 1200, rows) + _series_wave(rows, 480, 6) + rng.normal(0, 180, rows)
    impressions = spend * _clip(118 + _series_wave(rows, 8, 5, 0.4) + rng.normal(0, 2.5, rows), 70, 180)
    clicks = impressions * _clip(0.021 + _series_wave(rows, 0.004, 5, 0.7) + rng.normal(0, 0.0012, rows), 0.008, 0.08)
    conversions = clicks * _clip(0.082 + _series_wave(rows, 0.018, 4) + rng.normal(0, 0.006, rows), 0.015, 0.22)
    attributed_revenue = conversions * _clip(165 + _series_wave(rows, 16, 5, 0.9) + rng.normal(0, 5.0, rows), 60, 400)
    ctr = np.divide(clicks, impressions, out=np.zeros_like(clicks), where=impressions > 0)
    cpc = np.divide(spend, clicks, out=np.zeros_like(spend), where=clicks > 0)
    cac = np.divide(spend, conversions, out=np.zeros_like(spend), where=conversions > 0)

    if inject_anomalies:
        spend[-18:] *= 1.15
        conversions[-18:] *= 0.72
        cac[-18:] *= 1.45

    prefix = f"{source}_"
    return pd.DataFrame(
        {
            "timestamp": dates,
            "campaign_cluster": rng.choice(["prospecting", "retargeting", "brand", "expansion"], size=rows, p=[0.38, 0.22, 0.2, 0.2]),
            f"{prefix}spend_usd": np.round(_clip(spend, 1200, 20000), 2),
            f"{prefix}impressions": np.round(_clip(impressions, 10000, 400000)).astype(int),
            f"{prefix}clicks": np.round(_clip(clicks, 250, 18000)).astype(int),
            f"{prefix}conversions": np.round(_clip(conversions, 10, 2400)).astype(int),
            f"{prefix}ctr": np.round(_clip(ctr, 0.002, 0.22), 4),
            f"{prefix}cpc_usd": np.round(_clip(cpc, 0.2, 45.0), 2),
            f"{prefix}cac_usd": np.round(_clip(cac, 6.0, 600.0), 2),
            f"{prefix}attributed_revenue": np.round(_clip(attributed_revenue, 3000, 400000), 2),
        }
    )


def generate_ecommerce_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 4) -> pd.DataFrame:
    """Mock ecommerce order and margin data."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    orders = 320 + np.linspace(0, 90, rows) + _series_wave(rows, 42, 7) + rng.normal(0, 12, rows)
    aov = 118 + _series_wave(rows, 13, 4) + rng.normal(0, 4.5, rows)
    revenue = orders * aov
    gross_margin = revenue * _clip(0.46 + _series_wave(rows, 0.04, 5, 0.5) + rng.normal(0, 0.012, rows), 0.18, 0.72)
    carts_started = orders * _clip(3.2 + _series_wave(rows, 0.4, 4) + rng.normal(0, 0.12, rows), 1.2, 6.0)
    units_sold = orders * _clip(1.35 + _series_wave(rows, 0.12, 5, 0.3) + rng.normal(0, 0.05, rows), 1.0, 3.8)
    return_rate = _clip(0.048 + _series_wave(rows, 0.008, 5, 1.2) + rng.normal(0, 0.003, rows), 0.01, 0.18)

    if inject_anomalies:
        return_rate[170:194] = _clip(return_rate[170:194] + 0.06, 0.01, 0.28)
        gross_margin[170:194] *= 0.84

    return pd.DataFrame(
        {
            "timestamp": dates,
            "region": rng.choice(["emea", "na", "apac", "latam"], size=rows, p=[0.28, 0.39, 0.21, 0.12]),
            "orders": np.round(_clip(orders, 40, 2000)).astype(int),
            "revenue": np.round(_clip(revenue, 4000, 600000), 2),
            "gross_margin": np.round(_clip(gross_margin, 800, 250000), 2),
            "average_order_value": np.round(_clip(aov, 30, 500), 2),
            "carts_started": np.round(_clip(carts_started, 120, 10000)).astype(int),
            "units_sold": np.round(_clip(units_sold, 80, 6000)).astype(int),
            "return_rate": np.round(return_rate, 4),
        }
    )


def generate_crm_pipeline_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 5) -> pd.DataFrame:
    """Mock CRM and sales pipeline data."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    sqls = 85 + _series_wave(rows, 10, 6) + rng.normal(0, 4, rows)
    meetings_booked = sqls * _clip(0.44 + _series_wave(rows, 0.05, 5) + rng.normal(0, 0.02, rows), 0.18, 0.9)
    opportunities_created = meetings_booked * _clip(0.72 + _series_wave(rows, 0.06, 4, 0.6) + rng.normal(0, 0.025, rows), 0.2, 1.0)
    pipeline_value = opportunities_created * _clip(8400 + _series_wave(rows, 1100, 4) + rng.normal(0, 450, rows), 1800, 26000)
    win_rate = _clip(0.22 + _series_wave(rows, 0.04, 5, 0.5) + rng.normal(0, 0.015, rows), 0.05, 0.72)
    sales_cycle_days = 41 + _series_wave(rows, 5, 4, 1.2) + rng.normal(0, 2.0, rows)

    if inject_anomalies:
        sales_cycle_days[-35:] += 8
        win_rate[-35:] = _clip(win_rate[-35:] - 0.06, 0.01, 0.8)

    return pd.DataFrame(
        {
            "timestamp": dates,
            "owner_segment": rng.choice(["smb", "mid_market", "enterprise"], size=rows, p=[0.36, 0.34, 0.30]),
            "sqls": np.round(_clip(sqls, 10, 400)).astype(int),
            "meetings_booked": np.round(_clip(meetings_booked, 5, 240)).astype(int),
            "opportunities_created": np.round(_clip(opportunities_created, 2, 180)).astype(int),
            "pipeline_value_usd": np.round(_clip(pipeline_value, 18000, 4000000), 2),
            "win_rate": np.round(win_rate, 4),
            "sales_cycle_days": np.round(_clip(sales_cycle_days, 8, 180), 2),
        }
    )


def generate_support_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 6) -> pd.DataFrame:
    """Mock support operations data with service health indicators."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    tickets_opened = 180 + _series_wave(rows, 26, 7) + rng.normal(0, 9, rows)
    backlog_size = 410 + _series_wave(rows, 48, 6, 0.7) + rng.normal(0, 14, rows)
    resolution_time_hours = 13 + _series_wave(rows, 1.8, 5) + rng.normal(0, 0.7, rows)
    csat_score = _clip(4.38 + _series_wave(rows, 0.12, 5, 0.4) + rng.normal(0, 0.03, rows), 3.1, 4.95)
    escalation_rate = _clip(0.08 + _series_wave(rows, 0.02, 5) + rng.normal(0, 0.006, rows), 0.01, 0.3)

    if inject_anomalies:
        backlog_size[60:88] *= 1.22
        resolution_time_hours[60:88] *= 1.35
        csat_score[60:88] = _clip(csat_score[60:88] - 0.35, 1.0, 5.0)

    return pd.DataFrame(
        {
            "timestamp": dates,
            "support_tier": rng.choice(["self_serve", "standard", "premium"], size=rows, p=[0.18, 0.52, 0.30]),
            "tickets_opened": np.round(_clip(tickets_opened, 20, 1200)).astype(int),
            "backlog_size": np.round(_clip(backlog_size, 20, 3000)).astype(int),
            "resolution_time_hours": np.round(_clip(resolution_time_hours, 0.6, 120), 2),
            "csat_score": np.round(csat_score, 3),
            "escalation_rate": np.round(escalation_rate, 4),
        }
    )


def generate_observability_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 7) -> pd.DataFrame:
    """Mock system performance and reliability telemetry."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    request_count = 480000 + np.linspace(0, 110000, rows) + _series_wave(rows, 42000, 8) + rng.normal(0, 9000, rows)
    p95_latency_ms = 260 + _series_wave(rows, 26, 6, 0.7) + rng.normal(0, 8.0, rows)
    error_rate = _clip(0.014 + _series_wave(rows, 0.003, 5, 0.3) + rng.normal(0, 0.0009, rows), 0.001, 0.12)
    saturation_pct = _clip(0.58 + _series_wave(rows, 0.08, 6) + rng.normal(0, 0.02, rows), 0.15, 0.99)
    deploy_frequency = 3.2 + _series_wave(rows, 0.6, 4, 0.6) + rng.normal(0, 0.15, rows)
    incident_count = request_count * error_rate / 1500

    if inject_anomalies:
        p95_latency_ms[-24:] *= 1.38
        error_rate[-24:] = _clip(error_rate[-24:] + 0.012, 0.001, 0.2)
        incident_count[-24:] *= 1.65

    return pd.DataFrame(
        {
            "timestamp": dates,
            "service_name": rng.choice(["api", "etl", "sync", "dashboard"], size=rows, p=[0.32, 0.18, 0.18, 0.32]),
            "request_count": np.round(_clip(request_count, 100000, 2000000)).astype(int),
            "p95_latency_ms": np.round(_clip(p95_latency_ms, 40, 3000), 2),
            "error_rate": np.round(error_rate, 5),
            "saturation_pct": np.round(saturation_pct, 4),
            "deploy_frequency": np.round(_clip(deploy_frequency, 0.2, 24.0), 2),
            "incident_count": np.round(_clip(incident_count, 0, 200), 2),
        }
    )


def generate_finops_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 8) -> pd.DataFrame:
    """Mock cloud and platform cost efficiency metrics."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    cloud_cost_usd = 42000 + np.linspace(0, 9000, rows) + _series_wave(rows, 3500, 5) + rng.normal(0, 1200, rows)
    compute_cost_usd = cloud_cost_usd * _clip(0.56 + _series_wave(rows, 0.04, 4) + rng.normal(0, 0.015, rows), 0.25, 0.82)
    storage_cost_usd = cloud_cost_usd * _clip(0.18 + _series_wave(rows, 0.02, 5, 0.7) + rng.normal(0, 0.01, rows), 0.05, 0.4)
    cost_per_request_usd = np.divide(cloud_cost_usd, 520000 + np.linspace(0, 80000, rows), out=np.zeros(rows), where=np.ones(rows, dtype=bool))
    rightsizing_score = _clip(0.71 + _series_wave(rows, 0.06, 5) + rng.normal(0, 0.015, rows), 0.3, 0.98)
    error_budget_burn = _clip(0.34 + _series_wave(rows, 0.08, 4, 0.4) + rng.normal(0, 0.02, rows), 0.02, 0.98)

    if inject_anomalies:
        cloud_cost_usd[80:106] *= 1.2
        cost_per_request_usd[80:106] *= 1.18
        rightsizing_score[80:106] = _clip(rightsizing_score[80:106] - 0.12, 0.1, 1.0)

    return pd.DataFrame(
        {
            "timestamp": dates,
            "cloud_region": rng.choice(["eu-central", "us-east", "us-west", "ap-south"], size=rows, p=[0.24, 0.37, 0.25, 0.14]),
            "cloud_cost_usd": np.round(_clip(cloud_cost_usd, 5000, 250000), 2),
            "compute_cost_usd": np.round(_clip(compute_cost_usd, 2000, 220000), 2),
            "storage_cost_usd": np.round(_clip(storage_cost_usd, 300, 100000), 2),
            "cost_per_request_usd": np.round(_clip(cost_per_request_usd, 0.0001, 1.5), 6),
            "rightsizing_score": np.round(rightsizing_score, 4),
            "error_budget_burn": np.round(error_budget_burn, 4),
        }
    )


def generate_cyber_logs(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 9) -> pd.DataFrame:
    """Mock cybersecurity and access control activity."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    failed_logins = 220 + _series_wave(rows, 35, 7) + rng.normal(0, 12, rows)
    suspicious_ips = 18 + _series_wave(rows, 3.0, 6) + rng.normal(0, 1.4, rows)
    privileged_actions = 42 + _series_wave(rows, 5.0, 5, 0.8) + rng.normal(0, 2.0, rows)
    bytes_out = 4.8e9 + _series_wave(rows, 4.2e8, 6) + rng.normal(0, 1.6e8, rows)
    threat_score = _clip(0.34 + _series_wave(rows, 0.08, 5) + rng.normal(0, 0.025, rows), 0.02, 0.98)

    if inject_anomalies:
        failed_logins[140:158] *= 2.8
        suspicious_ips[140:158] *= 3.0
        threat_score[140:158] = _clip(threat_score[140:158] + 0.32, 0.05, 1.0)

    return pd.DataFrame(
        {
            "timestamp": dates,
            "auth_region": rng.choice(["eu", "na", "apac", "remote"], size=rows, p=[0.27, 0.31, 0.21, 0.21]),
            "failed_logins": np.round(_clip(failed_logins, 10, 4000)).astype(int),
            "suspicious_ips": np.round(_clip(suspicious_ips, 0, 500)).astype(int),
            "privileged_actions": np.round(_clip(privileged_actions, 1, 600)).astype(int),
            "bytes_out": np.round(_clip(bytes_out, 5e7, 4e10), 2),
            "threat_score": np.round(threat_score, 4),
        }
    )


def generate_iot_telemetry(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 10) -> pd.DataFrame:
    """Mock industrial IoT telemetry with asset health signals."""
    rng = _rng(seed)
    dates = _time_index(rows, "H")

    temperature_c = 67 + _series_wave(rows, 5.2, 10) + rng.normal(0, 0.8, rows)
    vibration_mm_s = 3.4 + _series_wave(rows, 0.7, 8, 0.5) + rng.normal(0, 0.15, rows)
    throughput_units = 1220 + _series_wave(rows, 120, 7) + rng.normal(0, 35, rows)
    defect_rate = _clip(0.018 + _series_wave(rows, 0.004, 7, 0.2) + rng.normal(0, 0.0015, rows), 0.002, 0.12)
    energy_kwh = 980 + _series_wave(rows, 110, 8, 1.1) + rng.normal(0, 28, rows)

    if inject_anomalies:
        vibration_mm_s[-48:] *= 1.8
        defect_rate[-48:] = _clip(defect_rate[-48:] + 0.018, 0.0, 0.2)
        throughput_units[-48:] *= 0.84

    return pd.DataFrame(
        {
            "timestamp": dates,
            "line_id": rng.choice(["line_a", "line_b", "line_c"], size=rows, p=[0.38, 0.34, 0.28]),
            "temperature_c": np.round(_clip(temperature_c, 10, 140), 2),
            "vibration_mm_s": np.round(_clip(vibration_mm_s, 0.05, 40.0), 3),
            "throughput_units": np.round(_clip(throughput_units, 80, 6000)).astype(int),
            "defect_rate": np.round(defect_rate, 4),
            "energy_kwh": np.round(_clip(energy_kwh, 50, 10000), 2),
        }
    )


def generate_banking_core_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 11) -> pd.DataFrame:
    """Mock core banking ledger and liquidity performance."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    deposit_balance_usd = 4.2e8 + np.linspace(0, 8.5e7, rows) + _series_wave(rows, 1.2e7, 6) + rng.normal(0, 4.5e6, rows)
    loan_exposure_usd = 3.1e8 + np.linspace(0, 6.0e7, rows) + _series_wave(rows, 9.0e6, 5, 0.4) + rng.normal(0, 3.2e6, rows)
    daily_txn_volume_usd = 8.5e7 + _series_wave(rows, 1.0e7, 8, 0.7) + rng.normal(0, 4.8e6, rows)
    net_interest_margin = _clip(0.031 + _series_wave(rows, 0.003, 5, 0.3) + rng.normal(0, 0.0008, rows), 0.012, 0.08)
    liquidity_coverage_ratio = _clip(1.28 + _series_wave(rows, 0.07, 5, 0.5) + rng.normal(0, 0.02, rows), 0.82, 1.9)
    delinquency_rate = _clip(0.024 + _series_wave(rows, 0.004, 4) + rng.normal(0, 0.0012, rows), 0.004, 0.12)
    fraud_score = _clip(0.18 + _series_wave(rows, 0.05, 6) + rng.normal(0, 0.015, rows), 0.01, 0.98)

    if inject_anomalies:
        liquidity_coverage_ratio[-24:] = _clip(liquidity_coverage_ratio[-24:] - 0.18, 0.6, 2.0)
        delinquency_rate[-24:] = _clip(delinquency_rate[-24:] + 0.012, 0.0, 0.2)
        fraud_score[-18:] = _clip(fraud_score[-18:] + 0.14, 0.01, 1.0)

    return pd.DataFrame(
        {
            "timestamp": dates,
            "branch_id": [f"branch_{1 + (i % 12):02d}" for i in range(rows)],
            "deposit_balance_usd": np.round(_clip(deposit_balance_usd, 5.0e7, 1.2e9), 2),
            "loan_exposure_usd": np.round(_clip(loan_exposure_usd, 2.5e7, 1.0e9), 2),
            "daily_txn_volume_usd": np.round(_clip(daily_txn_volume_usd, 2.0e6, 4.0e8), 2),
            "net_interest_margin": np.round(net_interest_margin, 5),
            "liquidity_coverage_ratio": np.round(liquidity_coverage_ratio, 4),
            "delinquency_rate": np.round(delinquency_rate, 4),
            "fraud_score": np.round(fraud_score, 4),
        }
    )


def generate_banking_aml_alerts(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 12) -> pd.DataFrame:
    """Mock AML, sanctions, and fraud investigation load."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    aml_alert_count = 340 + _series_wave(rows, 42, 7) + rng.normal(0, 15, rows)
    suspicious_txn_usd = 6.8e6 + _series_wave(rows, 8.5e5, 6, 0.4) + rng.normal(0, 2.8e5, rows)
    sanction_hits = 7 + _series_wave(rows, 1.8, 6, 1.0) + rng.normal(0, 0.8, rows)
    case_backlog = 185 + _series_wave(rows, 24, 5, 0.7) + rng.normal(0, 8, rows)
    investigation_time_hours = 21 + _series_wave(rows, 3.6, 5) + rng.normal(0, 1.2, rows)
    fraud_loss_usd = 2.2e5 + _series_wave(rows, 3.8e4, 6) + rng.normal(0, 1.1e4, rows)

    if inject_anomalies:
        aml_alert_count[130:148] *= 1.65
        suspicious_txn_usd[130:148] *= 1.9
        sanction_hits[130:148] *= 2.2
        case_backlog[130:148] *= 1.35

    return pd.DataFrame(
        {
            "timestamp": dates,
            "corridor": rng.choice(["emea", "na", "mena", "apac"], size=rows, p=[0.33, 0.24, 0.18, 0.25]),
            "aml_alert_count": np.round(_clip(aml_alert_count, 20, 3000)).astype(int),
            "suspicious_txn_usd": np.round(_clip(suspicious_txn_usd, 1.0e5, 8.0e7), 2),
            "sanction_hits": np.round(_clip(sanction_hits, 0, 120)).astype(int),
            "case_backlog": np.round(_clip(case_backlog, 5, 3000)).astype(int),
            "investigation_time_hours": np.round(_clip(investigation_time_hours, 1, 240), 2),
            "fraud_loss_usd": np.round(_clip(fraud_loss_usd, 1.0e4, 2.0e7), 2),
        }
    )


def generate_enterprise_finance_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 13) -> pd.DataFrame:
    """Mock ERP and finance planning metrics for enterprise BI."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    budget_usd = 1.4e7 + _series_wave(rows, 1.2e6, 4) + rng.normal(0, 4.5e5, rows)
    actual_spend_usd = budget_usd * _clip(0.96 + _series_wave(rows, 0.06, 5, 0.6) + rng.normal(0, 0.02, rows), 0.7, 1.3)
    revenue_forecast_usd = 2.6e7 + np.linspace(0, 6.0e6, rows) + _series_wave(rows, 1.6e6, 4, 0.3) + rng.normal(0, 5.0e5, rows)
    gross_margin_pct = _clip(0.36 + _series_wave(rows, 0.03, 4) + rng.normal(0, 0.01, rows), 0.08, 0.72)
    working_capital_days = 51 + _series_wave(rows, 5.5, 5, 0.8) + rng.normal(0, 1.8, rows)
    procurement_savings_usd = 6.5e5 + _series_wave(rows, 8.5e4, 4, 1.0) + rng.normal(0, 2.5e4, rows)

    if inject_anomalies:
        actual_spend_usd[-22:] *= 1.16
        gross_margin_pct[-22:] = _clip(gross_margin_pct[-22:] - 0.04, 0.05, 0.8)
        working_capital_days[-22:] += 7

    return pd.DataFrame(
        {
            "timestamp": dates,
            "business_unit": rng.choice(["retail", "industrial", "shared_services", "digital"], size=rows, p=[0.32, 0.28, 0.2, 0.2]),
            "budget_usd": np.round(_clip(budget_usd, 8.0e5, 8.0e7), 2),
            "actual_spend_usd": np.round(_clip(actual_spend_usd, 6.0e5, 9.0e7), 2),
            "revenue_forecast_usd": np.round(_clip(revenue_forecast_usd, 2.0e6, 1.4e8), 2),
            "gross_margin_pct": np.round(gross_margin_pct, 4),
            "working_capital_days": np.round(_clip(working_capital_days, 5, 180), 2),
            "procurement_savings_usd": np.round(_clip(procurement_savings_usd, 2.0e4, 1.0e7), 2),
        }
    )


def generate_procurement_ops_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 14) -> pd.DataFrame:
    """Mock procurement and supply efficiency metrics."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    open_po_count = 1180 + _series_wave(rows, 120, 5) + rng.normal(0, 40, rows)
    supplier_lead_time_days = 19 + _series_wave(rows, 2.8, 6, 0.5) + rng.normal(0, 0.9, rows)
    inventory_turns = _clip(7.2 + _series_wave(rows, 0.9, 5) + rng.normal(0, 0.18, rows), 1.0, 18.0)
    on_time_delivery_rate = _clip(0.92 + _series_wave(rows, 0.03, 5, 0.4) + rng.normal(0, 0.01, rows), 0.55, 0.995)
    backorder_rate = _clip(0.037 + _series_wave(rows, 0.008, 6) + rng.normal(0, 0.002, rows), 0.002, 0.18)
    purchase_commitment_usd = 8.0e6 + _series_wave(rows, 6.0e5, 4, 1.0) + rng.normal(0, 2.0e5, rows)

    if inject_anomalies:
        supplier_lead_time_days[90:114] += 5
        on_time_delivery_rate[90:114] = _clip(on_time_delivery_rate[90:114] - 0.08, 0.3, 1.0)
        backorder_rate[90:114] = _clip(backorder_rate[90:114] + 0.03, 0.0, 0.3)

    return pd.DataFrame(
        {
            "timestamp": dates,
            "supplier_tier": rng.choice(["strategic", "preferred", "spot"], size=rows, p=[0.28, 0.46, 0.26]),
            "open_po_count": np.round(_clip(open_po_count, 50, 8000)).astype(int),
            "supplier_lead_time_days": np.round(_clip(supplier_lead_time_days, 1, 180), 2),
            "inventory_turns": np.round(inventory_turns, 3),
            "on_time_delivery_rate": np.round(on_time_delivery_rate, 4),
            "backorder_rate": np.round(backorder_rate, 4),
            "purchase_commitment_usd": np.round(_clip(purchase_commitment_usd, 2.0e5, 9.0e7), 2),
        }
    )


def generate_telecom_network_health(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 15) -> pd.DataFrame:
    """Mock telecom network quality and repair dynamics."""
    rng = _rng(seed)
    dates = _time_index(rows, "H")

    dropped_call_rate = _clip(0.012 + _series_wave(rows, 0.004, 10, 0.6) + rng.normal(0, 0.0012, rows), 0.001, 0.18)
    packet_loss_pct = _clip(0.48 + _series_wave(rows, 0.16, 8, 0.4) + rng.normal(0, 0.05, rows), 0.02, 5.0)
    network_latency_ms = 54 + _series_wave(rows, 7.0, 8, 0.8) + rng.normal(0, 2.2, rows)
    tower_availability_pct = _clip(0.992 + _series_wave(rows, 0.004, 9) + rng.normal(0, 0.0015, rows), 0.90, 1.0)
    mean_time_to_repair_hours = 4.6 + _series_wave(rows, 0.7, 6, 0.2) + rng.normal(0, 0.25, rows)
    subscriber_outage_minutes = 1450 + _series_wave(rows, 220, 8, 1.0) + rng.normal(0, 60, rows)

    if inject_anomalies:
        dropped_call_rate[-36:] = _clip(dropped_call_rate[-36:] + 0.018, 0.0, 0.3)
        packet_loss_pct[-36:] = _clip(packet_loss_pct[-36:] + 0.45, 0.0, 8.0)
        tower_availability_pct[-36:] = _clip(tower_availability_pct[-36:] - 0.018, 0.7, 1.0)

    return pd.DataFrame(
        {
            "timestamp": dates,
            "tower_cluster": rng.choice(["metro", "regional", "rural"], size=rows, p=[0.44, 0.36, 0.20]),
            "dropped_call_rate": np.round(dropped_call_rate, 5),
            "packet_loss_pct": np.round(packet_loss_pct, 4),
            "network_latency_ms": np.round(_clip(network_latency_ms, 8, 900), 2),
            "tower_availability_pct": np.round(tower_availability_pct, 5),
            "mean_time_to_repair_hours": np.round(_clip(mean_time_to_repair_hours, 0.2, 72), 2),
            "subscriber_outage_minutes": np.round(_clip(subscriber_outage_minutes, 10, 90000), 2),
        }
    )


def generate_telecom_subscriber_usage(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 16) -> pd.DataFrame:
    """Mock subscriber usage, ARPU, and experience pressure."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    active_subscribers = 185000 + np.linspace(0, 16000, rows) + _series_wave(rows, 5200, 5) + rng.normal(0, 1800, rows)
    data_usage_gb = 98000 + _series_wave(rows, 12000, 6, 0.7) + rng.normal(0, 3500, rows)
    arpu_usd = 17.2 + _series_wave(rows, 1.1, 5) + rng.normal(0, 0.35, rows)
    topup_revenue_usd = active_subscribers * _clip(0.19 + _series_wave(rows, 0.02, 5, 0.3) + rng.normal(0, 0.008, rows), 0.08, 0.35)
    support_contact_rate = _clip(0.082 + _series_wave(rows, 0.012, 5, 0.9) + rng.normal(0, 0.003, rows), 0.01, 0.25)
    subscriber_churn_rate = _clip(0.017 + _series_wave(rows, 0.004, 4, 0.4) + rng.normal(0, 0.0012, rows), 0.002, 0.08)

    if inject_anomalies:
        support_contact_rate[160:186] = _clip(support_contact_rate[160:186] + 0.03, 0.0, 0.4)
        subscriber_churn_rate[160:186] = _clip(subscriber_churn_rate[160:186] + 0.008, 0.0, 0.12)
        arpu_usd[160:186] *= 0.95

    return pd.DataFrame(
        {
            "timestamp": dates,
            "subscriber_segment": rng.choice(["consumer", "family", "smb", "enterprise"], size=rows, p=[0.48, 0.19, 0.18, 0.15]),
            "active_subscribers": np.round(_clip(active_subscribers, 10000, 3000000)).astype(int),
            "data_usage_gb": np.round(_clip(data_usage_gb, 1500, 500000), 2),
            "arpu_usd": np.round(_clip(arpu_usd, 4, 180), 2),
            "topup_revenue_usd": np.round(_clip(topup_revenue_usd, 4.0e5, 1.2e8), 2),
            "support_contact_rate": np.round(support_contact_rate, 4),
            "subscriber_churn_rate": np.round(subscriber_churn_rate, 4),
        }
    )


def generate_healthcare_operations_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 17) -> pd.DataFrame:
    """Mock hospital throughput, quality, and safety metrics."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    patient_wait_minutes = 36 + _series_wave(rows, 6.0, 6, 0.4) + rng.normal(0, 2.0, rows)
    bed_occupancy_rate = _clip(0.81 + _series_wave(rows, 0.05, 5) + rng.normal(0, 0.015, rows), 0.45, 0.99)
    procedure_throughput = 265 + _series_wave(rows, 22, 6, 0.8) + rng.normal(0, 9, rows)
    patient_safety_events = 8.5 + _series_wave(rows, 1.8, 5, 0.6) + rng.normal(0, 0.7, rows)
    staff_overtime_hours = 390 + _series_wave(rows, 52, 6, 0.2) + rng.normal(0, 16, rows)
    readmission_rate = _clip(0.093 + _series_wave(rows, 0.012, 5) + rng.normal(0, 0.003, rows), 0.02, 0.22)

    if inject_anomalies:
        patient_wait_minutes[-18:] += 14
        staff_overtime_hours[-18:] *= 1.2
        readmission_rate[-18:] = _clip(readmission_rate[-18:] + 0.018, 0.0, 0.3)

    return pd.DataFrame(
        {
            "timestamp": dates,
            "facility_id": [f"facility_{1 + (i % 9):02d}" for i in range(rows)],
            "patient_wait_minutes": np.round(_clip(patient_wait_minutes, 2, 720), 2),
            "bed_occupancy_rate": np.round(bed_occupancy_rate, 4),
            "procedure_throughput": np.round(_clip(procedure_throughput, 10, 4000)).astype(int),
            "patient_safety_events": np.round(_clip(patient_safety_events, 0, 200), 2),
            "staff_overtime_hours": np.round(_clip(staff_overtime_hours, 10, 5000), 2),
            "readmission_rate": np.round(readmission_rate, 4),
        }
    )


def generate_healthcare_capacity_data(rows: int = 365, inject_anomalies: bool = False, seed: int = DEFAULT_SEED + 18) -> pd.DataFrame:
    """Mock scheduling, capacity, and claims efficiency for healthcare."""
    rng = _rng(seed)
    dates = _time_index(rows, "D")

    scheduled_visits = 1450 + _series_wave(rows, 160, 5, 0.5) + rng.normal(0, 45, rows)
    no_show_rate = _clip(0.082 + _series_wave(rows, 0.012, 5, 0.9) + rng.normal(0, 0.003, rows), 0.01, 0.24)
    operating_room_utilization = _clip(0.69 + _series_wave(rows, 0.07, 4) + rng.normal(0, 0.018, rows), 0.25, 0.98)
    discharge_delay_hours = 9.8 + _series_wave(rows, 1.3, 5, 0.6) + rng.normal(0, 0.5, rows)
    claim_denial_rate = _clip(0.061 + _series_wave(rows, 0.01, 4, 0.3) + rng.normal(0, 0.0025, rows), 0.005, 0.2)
    care_margin_usd = 1.4e6 + _series_wave(rows, 1.8e5, 4, 0.8) + rng.normal(0, 5.8e4, rows)

    if inject_anomalies:
        no_show_rate[100:124] = _clip(no_show_rate[100:124] + 0.022, 0.0, 0.3)
        discharge_delay_hours[100:124] += 4.5
        claim_denial_rate[100:124] = _clip(claim_denial_rate[100:124] + 0.016, 0.0, 0.3)

    return pd.DataFrame(
        {
            "timestamp": dates,
            "care_unit": rng.choice(["er", "surgery", "imaging", "ambulatory"], size=rows, p=[0.26, 0.24, 0.18, 0.32]),
            "scheduled_visits": np.round(_clip(scheduled_visits, 60, 12000)).astype(int),
            "no_show_rate": np.round(no_show_rate, 4),
            "operating_room_utilization": np.round(operating_room_utilization, 4),
            "discharge_delay_hours": np.round(_clip(discharge_delay_hours, 0.1, 240), 2),
            "claim_denial_rate": np.round(claim_denial_rate, 4),
            "care_margin_usd": np.round(_clip(care_margin_usd, 5.0e4, 4.0e7), 2),
        }
    )


def generate_failed_transformations(rows: int = 180, seed: int = DEFAULT_SEED + 11) -> pd.DataFrame:
    """Simulates transformation failures and schema-scale regressions."""
    rng = _rng(seed)
    dates = _time_index(rows, "H")
    mrr = 72000 + rng.normal(0, 1400, rows)
    null_spike = np.zeros(rows, dtype=int)
    scale_bug = np.zeros(rows, dtype=int)

    mrr[42:70] = 0.0
    null_spike[42:70] = 1
    mrr[120:] = mrr[120:] / 100.0
    scale_bug[120:] = 1

    return pd.DataFrame(
        {
            "timestamp": dates,
            "mrr": np.round(mrr, 2),
            "is_failed_transform": ((null_spike + scale_bug) > 0).astype(int),
            "null_spike_flag": null_spike,
            "scale_bug_flag": scale_bug,
        }
    )


SOURCE_GENERATORS = {
    "generate_banking_aml_alerts": generate_banking_aml_alerts,
    "generate_banking_core_data": generate_banking_core_data,
    "generate_crm_pipeline_data": generate_crm_pipeline_data,
    "generate_cyber_logs": generate_cyber_logs,
    "generate_ecommerce_data": generate_ecommerce_data,
    "generate_enterprise_finance_data": generate_enterprise_finance_data,
    "generate_failed_transformations": generate_failed_transformations,
    "generate_finops_data": generate_finops_data,
    "generate_ga4_data": generate_ga4_data,
    "generate_healthcare_capacity_data": generate_healthcare_capacity_data,
    "generate_healthcare_operations_data": generate_healthcare_operations_data,
    "generate_iot_telemetry": generate_iot_telemetry,
    "generate_marketing_data": generate_marketing_data,
    "generate_observability_data": generate_observability_data,
    "generate_procurement_ops_data": generate_procurement_ops_data,
    "generate_product_usage_data": generate_product_usage_data,
    "generate_saas_metrics": generate_saas_metrics,
    "generate_support_data": generate_support_data,
    "generate_telecom_network_health": generate_telecom_network_health,
    "generate_telecom_subscriber_usage": generate_telecom_subscriber_usage,
}


__all__ = list(SOURCE_GENERATORS.keys()) + ["SOURCE_GENERATORS"]
