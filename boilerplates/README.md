# Sentry Data Engine Boilerplates

This directory contains the foundational logic for the Sentry Data Multi-Agent Orchestration Engine. These files are injected into secure MicroVMs (via Modal or E2B) and executed dynamically.

## Architecture Overview

The system operates on an "Adaptive Pipeline" architecture consisting of three main paths:
1. **Hot Path:** Cached execution (0 LLM tokens). Analyzes data schemas and if they haven't changed, reruns the exact same Python transformations generated previously.
2. **Cold Path:** LLM-driven execution. Used for new data sources or when schemas change. Agents use `google-genai` to write custom PySpark transformations based on the input schemas and prompts.
3. **ML Path:** Periodic execution for model training (e.g., LTV prediction) and inference.

## Directory Structure

*   **/manager**: Contains the core execution sandbox environment.
    *   `agent_manager.py`: The entrypoint for every MicroVM. It handles communication with the Gemini API, manages the LLM tool loop (if on Cold Path), catches exceptions, and formats the output logs (`AGENT_RESULT`, `AGENT_DISCOVERY`) for the backend orchestrator to parse.

*   **/tasks**: The root Python files that perform the actual PySpark data manipulation. During a Cold Path, the LLM heavily edits these files before execution.
    *   `source_classifier.py`: Analyzes database schemas to infer the business domain (e-commerce, SaaS) without touching raw records.
    *   `data_normalizer.py`: Transforms nested, messy JSON/API data from the Bronze layer into a clean, flat Parquet format in the Silver layer.
    *   `feature_engineer.py`: Joins multiple Silver tables into a unified Gold Layer optimized for analytics.
    *   `query_generator.py`: Generates SQL widgets and dashboard configurations based on the Gold layer schema and business context.
    *   `ml_trainer.py` & `ml_inference.py`: Standard ML workflows for predictive analytics.

*   **/prompts**: The system instructions provided to the Gemini model for each corresponding task.
    *   These prompts dictate the rules for writing PySpark code, the expected output formats (e.g., `AGENT_DISCOVERY_METADATA`), and how to handle errors.

## Execution Flow inside the MicroVM (`agent_manager.py`)

1.  **Boot & Environment Load:** The backend orchestrator spins up the MicroVM and injects environment variables (e.g., `R2_ACCESS_KEY_ID`, `INJECTED_RAW_URI`, `INJECTED_SYSTEM_PROMPT`).
2.  **Cache Check:** `agent_manager.py` checks if `R2_VERIFIED_SCRIPT_URI` is provided (Hot Path). If so, it downloads and executes it immediately, bypassing the LLM.
3.  **LLM Generation (Cold Path):** If no cached script exists, it downloads the boilerplate code and the prompt. It then enters a conversational loop with the Gemini model.
4.  **Tool Use:** The LLM uses the `execute_python_script` tool to run its generated code. The manager captures `stdout` and `stderr`.
5.  **Iteration:** If the script fails (e.g., PySpark syntax error), the manager feeds the error back to the LLM for correction. This loop continues until success or a max retry limit is reached.
6.  **Finalization:** Upon success, the manager prints `--- AGENT_FINAL_SCRIPT_START ---` (for the backend to cache) and `--- AGENT_DISCOVERY_METADATA ---` (for frontend insights).

## Extending Boilerplates

When creating a new agent step in the pipeline:
1. Create a `new_task.py` in `/tasks` with basic error handling and an `AGENT_RESULT` print.
2. Create `new_task.txt` in `/prompts` detailing exactly what the LLM should write and what JSON discovery payload it should return.
3. Update the `OrchestrationService.ts` to call `AgentExecutor.execute()` with the new URIs and required `additionalEnvVars`.

## Secret Management
**NEVER hardcode keys in boilerplates.** All credentials (like R2 access keys) are passed securely via environment variables by the Sandbox Provider upon boot.
