#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-stop}"   # stop | distribution | holdbook | hybrid
BASE_URL="${LM_STUDIO_BASE_URL:-http://127.0.0.1:1234/v1}"
MODELS_URL="${BASE_URL%/v1}/v1/models"

case "$MODE" in
  stop|distribution|holdbook|hybrid) ;;
  *)
    echo "Usage: ./run_sf.sh [stop|distribution|holdbook|hybrid] [extra-main-flags...]"
    exit 2
    ;;
esac
shift || true

echo "[1/4] Checking LM Studio endpoint: $MODELS_URL"
ok=0
for i in 1 2 3; do
  if curl -fsS --max-time 5 "$MODELS_URL" >/tmp/lm_models.json 2>/dev/null; then
    echo "OK: LM Studio endpoint reachable"
    ok=1
    break
  fi
  echo "Attempt $i/3 failed, retrying..."
  sleep 2
done
if [[ "$ok" -ne 1 ]]; then
  echo "ERROR: LM Studio is unreachable at $MODELS_URL after 3 attempts."
  echo "Start LM Studio server and verify a model is loaded, then rerun."
  exit 1
fi

if [[ ! -f ".venv/bin/activate" ]]; then
  echo "ERROR: Missing virtual environment activation script at .venv/bin/activate"
  exit 1
fi

echo "[2/4] Activating virtual environment"
source .venv/bin/activate

echo "[3/4] Running pipeline mode=$MODE"
PYTHONPYCACHEPREFIX=/tmp/pycache python3 main.py --sample --post-credit "$MODE" --human-gate approve --autonomous "$@"

echo "[4/4] Latest outputs"
ls -lt data/output | head -n 12
