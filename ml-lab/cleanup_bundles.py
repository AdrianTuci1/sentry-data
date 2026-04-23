import shutil
import os
from pathlib import Path

def cleanup():
    base_dir = Path(".generated")
    if not base_dir.exists():
        print("No .generated directory found.")
        return

    # 1. Identity folders to keep/delete
    keep_list = ["golden_bundle"]
    
    print(f"Cleaning up {base_dir}...")
    
    for item in base_dir.iterdir():
        if item.is_dir():
            if item.name not in keep_list:
                print(f"Deleting redundant bundle: {item.name}")
                shutil.rmtree(item)
            else:
                # 2. Inside golden_bundle, delete 'gemini' debris
                gemini_dir = item / "gemini"
                if gemini_dir.exists():
                    print(f"Cleaning 'gemini' debris inside {item.name}...")
                    shutil.rmtree(gemini_dir)

    print("\n✅ Cleanup complete. Only 'golden_bundle' (cleaned) remains.")

if __name__ == "__main__":
    cleanup()
