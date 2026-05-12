#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-stop}"
if [[ ! "$MODE" =~ ^(stop|distribution|holdbook|hybrid)$ ]]; then
  echo "Usage: $0 [stop|distribution|holdbook|hybrid]"
  exit 2
fi
shift || true

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BASE_URL="${HERMES_BASE_URL:-http://127.0.0.1:18000/v1}"
HEALTH_URL="${BASE_URL%/v1}/health"

for i in 1 2 3; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[hermes] Gateway reachable: $HEALTH_URL"
    break
  fi
  if [[ "$i" -eq 3 ]]; then
    echo "[hermes] Gateway unreachable after 3 attempts: $HEALTH_URL"
    exit 1
  fi
  sleep 1
done

if [[ ! -f ".venv/bin/activate" ]]; then
  echo "[hermes] Missing virtual environment activation script at .venv/bin/activate"
  exit 1
fi
# shellcheck disable=SC1091
source .venv/bin/activate

export LLM_PROVIDER="hermes"
echo "[hermes] Running pipeline mode=$MODE (provider=hermes)"
PYTHONPYCACHEPREFIX=/tmp/pycache python3 main.py --sample --post-credit "$MODE" --human-gate approve --autonomous "$@"
