import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_saas_metrics(rows: int = 1000, inject_anomalies: bool = False) -> pd.DataFrame:
    """Mock SaaS metrics like MRR, Churn, Active Users."""
    np.random.seed(42)
    dates = [datetime.now() - timedelta(days=x) for x in range(rows)]
    
    mrr = np.random.normal(50000, 2000, rows)
    active_users = np.random.poisson(15000, rows)
    churn_rate = np.random.beta(2, 50, rows)
    
    if inject_anomalies:
        # Inject sudden drop in MRR and spike in Churn
        mrr[10:20] = mrr[10:20] * 0.5
        churn_rate[10:20] = churn_rate[10:20] * 5.0
        
    df = pd.DataFrame({
        "timestamp": dates,
        "mrr": mrr,
        "active_users": active_users,
        "churn_rate": churn_rate
    })
    return df.sort_values("timestamp").reset_index(drop=True)

def generate_cyber_logs(rows: int = 5000, inject_anomalies: bool = False) -> pd.DataFrame:
    """Mock Cybersecurity / SIEM logs (Failed logins, Bytes transferred)."""
    np.random.seed(42)
    dates = [datetime.now() - timedelta(minutes=x) for x in range(rows)]
    
    failed_logins = np.random.poisson(5, rows)
    bytes_out = np.random.lognormal(mean=10, sigma=1, size=rows)
    
    if inject_anomalies:
        # Inject SSH brute force
        failed_logins[100:150] = np.random.poisson(200, 50)
        # Exfiltration
        bytes_out[100:150] = bytes_out[100:150] * 20
        
    df = pd.DataFrame({
        "timestamp": dates,
        "failed_logins": failed_logins,
        "bytes_out": bytes_out
    })
    return df.sort_values("timestamp").reset_index(drop=True)

def generate_iot_telemetry(rows: int = 10000, inject_anomalies: bool = False) -> pd.DataFrame:
    """Mock IoT high-frequency sensors."""
    np.random.seed(42)
    dates = [datetime.now() - timedelta(seconds=x) for x in range(rows)]
    
    temperature = np.random.normal(22.5, 0.5, rows) + np.sin(np.linspace(0, 50, rows))
    vibration = np.random.exponential(scale=1.5, size=rows)
    
    if inject_anomalies:
        # Sensor malfunction drift
        temperature[-1000:] = temperature[-1000:] + np.linspace(0, 5, 1000)
        vibration[-1000:] = vibration[-1000:] * 3
        
    df = pd.DataFrame({
        "timestamp": dates,
        "temperature": temperature,
        "vibration": vibration
    })
    return df.sort_values("timestamp").reset_index(drop=True)
def generate_ga4_data(rows: int = 1000, inject_anomalies: bool = False) -> pd.DataFrame:
    """Mock GA4 event data: page_views, sessions, bounce_rate."""
    np.random.seed(42)
    dates = [datetime.now() - timedelta(hours=x) for x in range(rows)]
    page_views = np.random.poisson(200, rows)
    sessions = (page_views * np.random.uniform(0.4, 0.6, rows)).astype(int)
    bounce_rate = np.random.uniform(0.3, 0.7, rows)
    
    if inject_anomalies:
        # Technical issue: bounce rate spikes to 1.0
        bounce_rate[100:120] = 0.98
        
    return pd.DataFrame({
        "timestamp": dates,
        "page_views": page_views,
        "sessions": sessions,
        "bounce_rate": bounce_rate
    }).sort_values("timestamp")

def generate_marketing_data(rows: int = 500, source: str = "meta") -> pd.DataFrame:
    """Mock Meta/TikTok Ads data: spend, reach, conversions."""
    np.random.seed(42 if source == "meta" else 43)
    dates = [datetime.now() - timedelta(days=x) for x in range(rows)]
    spend = np.random.uniform(50, 500, rows)
    reach = (spend * np.random.uniform(50, 100, rows)).astype(int)
    conversions = (reach * np.random.uniform(0.01, 0.03, rows)).astype(int)
    
    prefix = f"{source}_"
    return pd.DataFrame({
        "timestamp": dates,
        f"{prefix}spend_usd": spend,
        f"{prefix}reach": reach,
        f"{prefix}conversions": conversions
    }).sort_values("timestamp")

def generate_ecommerce_data(rows: int = 1000) -> pd.DataFrame:
    """Mock Shopify/Stripe data: orders, revenue, avg_order_value."""
    np.random.seed(44)
    dates = [datetime.now() - timedelta(hours=x) for range_x in range(rows) for x in [range_x]] # dummy fix for list comp
    dates = [datetime.now() - timedelta(hours=x) for x in range(rows)]
    orders = np.random.poisson(10, rows)
    revenue = orders * np.random.normal(85, 15, rows)
    
    return pd.DataFrame({
        "timestamp": dates,
        "orders": orders,
        "revenue": revenue
    }).sort_values("timestamp")
def generate_failed_transformations(rows: int = 100) -> pd.DataFrame:
    """Simulates common database transformation failures (NULL spikes, unexpected types)."""
    np.random.seed(45)
    dates = [datetime.now() - timedelta(minutes=x) for x in range(rows)]
    
    # 1. Success case
    mrr = np.random.normal(50000, 2000, rows)
    
    # 2. Inject Failure: Sudden spike in NULLs/Zeros (Transformation bug)
    mrr[40:60] = 0.0 # Simulated NULL/Zero spike
    
    # 3. Inject Failure: Metric Scale change (Unit bug, e.g., cents vs dollars)
    mrr[80:] = mrr[80:] / 100.0
    
    return pd.DataFrame({
        "timestamp": dates,
        "mrr": mrr,
        "is_failed_transform": [1 if (40 <= i < 60 or i >= 80) else 0 for i in range(rows)]
    })
