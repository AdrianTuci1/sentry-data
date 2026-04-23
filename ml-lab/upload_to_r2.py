import sys
import os
from pathlib import Path

# Adăugăm ml-lab la path pentru a putea importa modulele interne
sys.path.insert(0, str(Path(__file__).parent))

from training.sentinel.io import default_r2_bucket, delete_prefix_in_r2, upload_directory_to_r2
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Configurație
LOCAL_BUNDLE_DIR = Path(".generated/golden_bundle")
# Preluăm bucket-ul corect din .env (R2_BUCKET_DATA)
BUCKET = default_r2_bucket() or "statsparrot-data"
PREFIX = "training-bundles/golden-bundle-v1"

def main():
    if not LOCAL_BUNDLE_DIR.exists():
        print(f"Error: Folderul {LOCAL_BUNDLE_DIR} nu există. Ai generat datele?")
        return

    print(f"🧹 Curățare prefix în R2: s3://{BUCKET}/{PREFIX}...")
    try:
        deleted = delete_prefix_in_r2(BUCKET, PREFIX)
        print(f"✅ Am șters {deleted} obiecte vechi.")
    except Exception as e:
        print(f"⚠️ Atenție: Nu s-a putut curăța prefixul (poate e gol?): {e}")

    print(f"🚀 Pregătire upload: {LOCAL_BUNDLE_DIR} -> s3://{BUCKET}/{PREFIX}")
    try:
        uploaded_count = upload_directory_to_r2(LOCAL_BUNDLE_DIR, BUCKET, PREFIX)
        print(f"✅ Succes! Am urcat {uploaded_count} fișiere.")
        print(f"\nUrmătorul pas (Antrenare pe Modal):")
        print(f"modal run modal_training.py --bundle-r2-uri s3://{BUCKET}/{PREFIX}")
    except Exception as e:
        print(f"❌ Eroare la upload: {e}")

if __name__ == "__main__":
    main()
