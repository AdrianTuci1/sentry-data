import json
import sys

# Add /root to path so we can import 'sentinel_legacy' as a package in Modal.
if "/root" not in sys.path:
    sys.path.append("/root")


def check_schema_coverage(source_profile_json: str) -> str:
    """[Model 1/4] Evaluates how well a source schema matches business requirements."""
    try:
        from sentinel_legacy import model_runtime

        profile = json.loads(source_profile_json)
        result = model_runtime.evaluate_coverage_ranker(profile, fallback_score=0.5)
        return json.dumps(result)
    except Exception as error:
        return f"Coverage check failed: {str(error)}"


def check_sql_risk(sql_query_json: str) -> str:
    """[Model 2/4] Scans an SQL query for security risks, injection, or severe inefficiencies."""
    try:
        from sentinel_legacy import model_runtime

        query_spec = json.loads(sql_query_json)
        result = model_runtime.evaluate_query_risk(query_spec, fallback_score=0.1)
        return json.dumps(result)
    except Exception as error:
        return f"SQL risk check failed: {str(error)}"


def check_data_drift(sample_rows_json: str) -> str:
    """[Model 3/4] Uses an LSTM model to detect statistical drift in a data sample."""
    try:
        from sentinel_legacy import model_runtime

        sample = json.loads(sample_rows_json)
        result = model_runtime.evaluate_drift_from_sample(sample)
        return json.dumps(result) if result else "No drift detected (insufficient data)."
    except Exception as error:
        return f"Drift check failed: {str(error)}"


def check_interaction_policy(recommendation_json: str, policy_state_json: str = "{}") -> str:
    """[Model 4/4] Validates an ML recommendation against historical user interaction policies."""
    try:
        from sentinel_legacy import model_runtime

        recommendation = json.loads(recommendation_json)
        policy_state = json.loads(policy_state_json)
        result = model_runtime.evaluate_interaction_policy(
            recommendation,
            policy_state,
            fallback_score=0.45,
        )
        return json.dumps(result)
    except Exception as error:
        return f"Policy check failed: {str(error)}"


def analyze_data_health(sample_json: str) -> str:
    """Evaluates null ratios and basic statistics from a small row sample."""
    try:
        data = json.loads(sample_json)
        if not data:
            return "Sample is empty."

        total_fields = 0
        null_fields = 0
        for row in data:
            for value in row.values():
                total_fields += 1
                if value is None or value == "":
                    null_fields += 1

        ratio = null_fields / total_fields if total_fields > 0 else 1.0
        quality_message = "Warning: High sparsity." if ratio > 0.4 else "Quality Optimal."
        return f"Data Health: Null Ratio is {round(ratio * 100, 1)}%. {quality_message}"
    except Exception as error:
        return f"Health check failed: {str(error)}"


def consult_sentinel_internal(plan_json: str) -> str:
    """Combined compatibility shim for older prompts that still call the legacy Sentinel tool."""
    return "Sentinel: All 4 ML models are now available as individual tools for granular verification."
