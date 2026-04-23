import os
import yaml
import json
from pathlib import Path

def sync_widgets(widgets_root: str, output_path: str):
    print(f"Syncing widgets from {widgets_root}...")
    catalog = []
    
    root_path = Path(widgets_root)
    if not root_path.exists():
        print(f"Error: Widgets root {widgets_root} does not exist.")
        return

    # Walk through the categories
    for category_path in root_path.iterdir():
        if not category_path.is_dir():
            continue
            
        # Walk through the widgets in each category
        for widget_path in category_path.iterdir():
            if not widget_path.is_dir():
                continue
                
            manifest_file = widget_path / "manifest.yml"
            if manifest_file.exists():
                try:
                    with open(manifest_file, 'r') as f:
                        manifest = yaml.safe_load(f)
                        
                    # Extract only what Gemini needs for selection and SQL generation
                    widget_entry = {
                        "id": widget_path.name,
                        "title": manifest.get("title", widget_path.name),
                        "description": manifest.get("description", ""),
                        "category": manifest.get("category", category_path.name),
                        "selection_hints": manifest.get("selection_hints", []),
                        "data_requirements": manifest.get("data_requirements", []),
                        "sql_aliases": manifest.get("sql_aliases", []),
                        "grid_span": manifest.get("grid_span", "col-span-1"),
                    }
                    catalog.append(widget_entry)
                    print(f"  [+] Synced {widget_entry['id']}")
                except Exception as e:
                    print(f"  [!] Failed to parse {manifest_file}: {e}")

    # Also check the top-level index.yml/catalog.yml if needed, 
    # but the individual manifests are more reliable for granular metadata.

    with open(output_path, 'w') as f:
        json.dump(catalog, f, indent=2)
        
    print(f"Successfully synced {len(catalog)} widgets to {output_path}")

if __name__ == "__main__":
    # Assuming we run this from the project root or ml-lab directory
    # Adjust paths accordingly
    base_dir = Path(__file__).parent.parent.parent.parent # Project root
    sync_widgets(
        widgets_root=str(base_dir / "r2-system" / "widgets"),
        output_path=str(Path(__file__).parent / "widget_catalog.json")
    )
