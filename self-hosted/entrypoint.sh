#!/bin/sh
# Statsparrot self-hosted entrypoint.
#
# Scaffolds a new project on first boot (when the project directory has no
# statsparrot.yaml), then starts the full self-hosted application (runtime + embedded
# web UI) via the `sp` command group.
#
# The `sp` command group lives on the `statsparrot` binary and must be invoked
# explicitly as `statsparrot sp <command>`. Cobra dispatches on the first CLI token
# (os.Args[1]) and ignores the binary name or any symlink, so a bare `sp start`
# would hit the root-level `start` command rather than the `sp` group. This
# script therefore always writes `statsparrot sp ...`.
set -e

PROJECT_DIR="${STATSPARROT_PROJECT_DIR:-/var/lib/statsparrot/project}"
PORT="${STATSPARROT_PORT:-9009}"
OLAP="${STATSPARROT_OLAP:-duckdb}"
ALLOWED_ORIGINS="${STATSPARROT_ALLOWED_ORIGINS:-http://localhost:${PORT}}"

if [ ! -f "${PROJECT_DIR}/statsparrot.yaml" ]; then
  echo "Initializing a new Statsparrot project at ${PROJECT_DIR}..."
  statsparrot sp init "${PROJECT_DIR}" --olap "${OLAP}" --agent none
fi

echo "Starting self-hosted Statsparrot on port ${PORT}..."
exec statsparrot sp start "${PROJECT_DIR}" \
  --port "${PORT}" \
  --no-open \
  --pull-env=false \
  --allowed-origins "${ALLOWED_ORIGINS}"
