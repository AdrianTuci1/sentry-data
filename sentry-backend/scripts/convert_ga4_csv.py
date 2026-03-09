import pandas as pd
import sys
import os

def convert_csv_to_parquet(csv_path, parquet_path):
    try:
        # Read CSV
        df = pd.read_csv(csv_path, low_memory=False)
        
        # Simple cleanup of column names (remove spaces/dots if needed, 
        # but Parquet handles them, though some engines prefer underscores)
        # df.columns = [c.replace('.', '_').replace(' ', '_') for c in df.columns]
        
        # Save as Parquet
        df.to_parquet(parquet_path, index=False, engine='pyarrow')
        print(f"Successfully converted {csv_path} to {parquet_path}")
        return True
    except Exception as e:
        print(f"Error converting CSV to Parquet: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_csv.py <input_csv> <output_parquet>")
        sys.exit(1)
        
    input_csv = sys.argv[1]
    output_parquet = sys.argv[2]
    
    if convert_csv_to_parquet(input_csv, output_parquet):
        sys.exit(0)
    else:
        sys.exit(1)
