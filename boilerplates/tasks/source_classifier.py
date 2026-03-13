# boilerplates/tasks/source_classifier.py
import os
import json
import logging

# Configure basic logging for debugging but keep it clean for orchestration parsing
logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(levelname)s - %(message)s')

def main():
    try:
        # Expected inputs from the Orchestrator / Modal environment
        schema_json_raw = os.environ.get('INJECTED_SCHEMA_JSON', '[]')
        
        # We don't need Spark here, just parsing the injected JSON
        schemas = json.loads(schema_json_raw)
        
        tables_analyzed = len(schemas)
        
        # When running from the Agent Loop (Cache Miss), the LLM will have already generated
        # a script that hardcodes the discovery it made.
        # But if this boilerplate is executed directly (which is rare for a classifier, usually LLM handles it), 
        # it would need to contain the logic.
        # However, the framework design assumes the LLM dynamically rewrites this file with the hardcoded print.
        
        # This boilerplate serves as the *base template* the LLM sees if it asks for the boilerplate.
        # It's primarily a placeholder since the LLM completely replaces its contents with the generated classification.
        
        print(f"AGENT_RESULT: {json.dumps({'status': 'base_classifier_executed', 'tables_analyzed': tables_analyzed})}")
        
    except Exception as e:
        print(f"AGENT_RESULT: {json.dumps({'status': 'error', 'error': str(e)})}")
        raise e

if __name__ == "__main__":
    main()
