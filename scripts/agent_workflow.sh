#!/usr/bin/env bash
set -euo pipefail

PROVIDER="${1:-hermes}"
MODE="${2:-stop}"
MAX_CASES="${3:-0}"

if [[ ! "$MODE" =~ ^(stop|distribution|holdbook|hybrid)$ ]]; then
  echo "Usage: $0 [provider] [stop|distribution|holdbook|hybrid] [max_cases]"
  exit 2
fi

export LLM_PROVIDER="$PROVIDER"

echo "[workflow] provider=$LLM_PROVIDER mode=$MODE max_cases=$MAX_CASES"

echo "[workflow] QA gate 1/4: shell syntax"
bash -n run_sf.sh run_hermes.sh run_backend.sh run_inbox_worker.sh scripts/*.sh

echo "[workflow] QA gate 2/4: targeted tests"
PYTHONPATH=. PYTHONPYCACHEPREFIX=/tmp/pycache ./.venv/bin/python -m pytest -q   tests/test_base_hermes.py   tests/test_healthcheck.py   tests/test_intent_router.py   tests/test_parallel_analysis.py   tests/test_supervisor_routing.py

echo "[workflow] QA gate 3/4: gateway diagnostics"
./.venv/bin/python diagnose_gateways.py

echo "[workflow] QA gate 4/4: autonomous UAT"
./.venv/bin/python scripts/run_uat.py --provider "$LLM_PROVIDER" --mode "$MODE" --max-cases "$MAX_CASES"

echo "[workflow] DONE"
