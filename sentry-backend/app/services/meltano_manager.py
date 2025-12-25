import subprocess
import os
import yaml
from typing import List, Dict, Optional

class MeltanoManager:
    def __init__(self, project_root: str = "meltano_project"):
        self.project_root = os.path.abspath(os.path.join(os.getcwd(), project_root))
        self._ensure_project_initialized()

    def _ensure_project_initialized(self):
        if not os.path.exists(self.project_root):
            print(f"Initializing Meltano project at {self.project_root}")
            try:
                subprocess.run(
                    ["meltano", "init", self.project_root], 
                    check=True, 
                    capture_output=True
                )
            except subprocess.CalledProcessError as e:
                print(f"Error initializing Meltano: {e.stderr.decode()}")
                # Fallback: Create directory manually if meltano init fails (e.g. if already exists but empty)
                os.makedirs(self.project_root, exist_ok=True)

    def _run_meltano(self, args: List[str]) -> Dict:
        """Runs a Meltano command and returns the output."""
        try:
            result = subprocess.run(
                ["meltano"] + args,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                check=True
            )
            return {"success": True, "stdout": result.stdout, "stderr": result.stderr}
        except subprocess.CalledProcessError as e:
            return {"success": False, "stdout": e.stdout, "stderr": e.stderr}

    def add_extractor(self, plugin_name: str, variant: str = None) -> Dict:
        """Adds an extractor (tap) to the project."""
        cmd = ["add", "extractor", plugin_name]
        if variant:
            cmd.extend(["--variant", variant])
        return self._run_meltano(cmd)

    def add_loader(self, plugin_name: str, variant: str = None) -> Dict:
        """Adds a loader (target) to the project."""
        cmd = ["add", "loader", plugin_name]
        if variant:
            cmd.extend(["--variant", variant])
        return self._run_meltano(cmd)

    def configure_plugin(self, plugin_name: str, config_key: str, config_value: str) -> Dict:
        """Configures a plugin setting."""
        return self._run_meltano(["config", plugin_name, "set", config_key, config_value])

    def run_elt(self, extractor: str, loader: str, job_id: str = None) -> Dict:
        """Runs an ELT pipeline."""
        cmd = ["run", extractor, loader]
        return self._run_meltano(cmd)

    def list_plugins(self) -> Dict:
        """Lists installed plugins."""
        # Parsing 'meltano list --format=json' would be ideal, but for now we might parse stdout
        # Or look at meltano.yml directly
        try:
            with open(os.path.join(self.project_root, "meltano.yml"), "r") as f:
                config = yaml.safe_load(f)
            return config.get("plugins", {})
        except FileNotFoundError:
            return {}
