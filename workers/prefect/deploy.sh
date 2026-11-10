#!/usr/bin/env bash
# Publica os deployments versionados no Prefect Server.
# Uso: docker compose exec prefect-worker /app/workers/prefect/deploy.sh
set -euo pipefail

export PREFECT_CLI_PROMPT="${PREFECT_CLI_PROMPT:-0}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
prefect deploy --prefect-file workers/prefect/deployments/prefect.yaml --all
