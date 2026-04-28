import json
from typing import Any, Dict, List

import requests

from .config import logger


def execute_worker_query_rows(sql: str, url: str, secret: str, tenantId: str, projectId: str) -> Dict[str, Any]:
    """Executes a SQL query on the analytics worker and returns the raw result envelope."""
    if not url:
        logger.warning("[WARN] analytics_worker query skipped: worker URL not configured.")
        return {
            "ok": False,
            "error": "worker_url_not_configured",
            "rows": [],
            "result": {},
        }

    try:
        logger.info(
            "[OK] analytics_worker query dispatch started. context=%s",
            {
                "tenantId": tenantId,
                "projectId": projectId,
                "sqlPreview": " ".join(str(sql or "").split())[:220],
            },
        )
        payload = {
            "tenantId": tenantId,
            "projectId": projectId,
            "queries": [{"widgetId": "agent_inspect", "sqlString": sql}],
        }
        headers = {
            "Content-Type": "application/json",
            "X-Internal-Secret": secret,
        }

        response = requests.post(url, json=payload, headers=headers, timeout=30)
        if not response.ok:
            logger.error(
                "[FAIL] analytics_worker query failed. context=%s",
                {
                    "tenantId": tenantId,
                    "projectId": projectId,
                    "statusCode": response.status_code,
                    "bodyPreview": response.text[:500],
                },
            )
            return {
                "ok": False,
                "error": f"worker_http_{response.status_code}",
                "rows": [],
                "result": {},
                "statusCode": response.status_code,
                "bodyPreview": response.text[:500],
            }

        data = response.json()
        results = data.get("results", [])
        if not results:
            logger.warning("[WARN] analytics_worker query returned no result envelope.")
            return {
                "ok": False,
                "error": "worker_no_results",
                "rows": [],
                "result": {},
            }

        result = results[0] if isinstance(results[0], dict) else {}
        if result.get("error"):
            logger.error(
                "[FAIL] analytics_worker query returned execution error. context=%s",
                {
                    "tenantId": tenantId,
                    "projectId": projectId,
                    "error": str(result.get("error")),
                },
            )
            return {
                "ok": False,
                "error": f"worker_query_error:{str(result.get('error'))}",
                "rows": [],
                "result": result,
            }
        rows = result.get("data", [])
        if not isinstance(rows, list):
            rows = []

        if not rows:
            logger.warning("[WARN] analytics_worker query returned an empty dataset.")
            return {
                "ok": False,
                "error": "worker_empty_dataset",
                "rows": [],
                "result": result,
            }

        logger.info(
            "[OK] analytics_worker query completed. context=%s",
            {
                "tenantId": tenantId,
                "projectId": projectId,
                "rowCountPreview": len(rows),
            },
        )
        return {
            "ok": True,
            "rows": rows,
            "result": result,
        }
    except Exception as error:
        logger.exception(
            "[FAIL] analytics_worker query crashed. context=%s",
            {
                "tenantId": tenantId,
                "projectId": projectId,
                "error": str(error),
            },
        )
        return {
            "ok": False,
            "error": f"worker_exception:{str(error)}",
            "rows": [],
            "result": {},
        }


def execute_worker_query(sql: str, url: str, secret: str, tenantId: str, projectId: str) -> str:
    """Executes a SQL query on the analytics worker and returns a small JSON preview."""
    result = execute_worker_query_rows(sql=sql, url=url, secret=secret, tenantId=tenantId, projectId=projectId)
    if not result.get("ok"):
        error = result.get("error") or "worker_query_failed"
        if error == "worker_url_not_configured":
            return "Error: Worker URL not configured."
        if error == "worker_empty_dataset":
            return "Empty dataset."
        if error == "worker_no_results":
            return "No results returned."
        status_code = result.get("statusCode")
        body_preview = result.get("bodyPreview")
        if status_code:
            return f"Worker Error: HTTP {status_code} - {body_preview or ''}"
        return f"Query Failed: {error}"

    rows: List[Dict[str, Any]] = result.get("rows") or []
    return json.dumps(rows[:5], indent=2)
