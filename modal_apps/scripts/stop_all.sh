#!/usr/bin/env bash

set -euo pipefail

MODAL_BIN="${MODAL_BIN:-modal}"
APPS=(
  "sentry-sandbox-executor"
  "statsparrot-analytics-worker"
  "statsparrot-pne"
  "statsparrot-sentinel"
  "statsparrot-ml-executor"
)

echo "Listing active Modal apps..."
"${MODAL_BIN}" app list || true

for app_name in "${APPS[@]}"; do
  echo "Stopping app: ${app_name}..."
  "${MODAL_BIN}" app stop "${app_name}" || true
done

echo "Done."
