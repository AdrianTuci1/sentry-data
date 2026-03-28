import duckdb
import pandas as pd
import os
from typing import List

class MultiSourceDataLoader:
    """
    Unifies data from multiple sources (GA4, Meta, Shopify, etc.) 
    using DuckDB for high-performance Parquet processing.
    """
    def __init__(self, data_dir: str = "datasets/parquet"):
        self.con = duckdb.connect(database=':memory:')
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        
    def load_source(self, source_name: str, df: pd.DataFrame):
        """Save a source to Parquet and register in DuckDB."""
        path = os.path.join(self.data_dir, f"{source_name}.parquet")
        df.to_parquet(path)
        self.con.execute(f"CREATE OR REPLACE VIEW {source_name} AS SELECT * FROM read_parquet('{path}')")
        print(f"📦 Source '{source_name}' registered.")

    def get_unified_metrics(self) -> pd.DataFrame:
        """
        Joins multiple sources on timestamp.
        Example: GA4 page_views + Meta Spend + Ecommerce Revenue.
        """
        # Note: In a real scenario, we'd join on 'timestamp' after normalization
        query = """
            SELECT 
                g.timestamp,
                g.page_views,
                m.meta_spend_usd,
                e.revenue,
                (e.revenue / NULLIF(m.meta_spend_usd, 0)) as roas
            FROM ga4 g
            LEFT JOIN meta m ON CAST(g.timestamp AS DATE) = CAST(m.timestamp AS DATE)
            LEFT JOIN ecommerce e ON CAST(g.timestamp AS DATE) = CAST(e.timestamp AS DATE)
            ORDER BY g.timestamp DESC
        """
        try:
            return self.con.execute(query).df()
        except Exception as e:
            print(f"⚠️ Could not join all sources: {e}")
            return pd.DataFrame()

if __name__ == "__main__":
    # Test local unification
    from datasets.generator import generate_ga4_data, generate_marketing_data, generate_ecommerce_data
    
    loader = MultiSourceDataLoader()
    loader.load_source("ga4", generate_ga4_data(100))
    loader.load_source("meta", generate_marketing_data(100, "meta"))
    loader.load_source("ecommerce", generate_ecommerce_data(100))
    
    unified_df = loader.get_unified_metrics()
    print("\n✅ Unified Dataset Preview:")
    print(unified_df.head())
