#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-stop}"          # stop|distribution|holdbook|hybrid
RUN_RUNTIME="${RUN_RUNTIME:-0}"  # set RUN_RUNTIME=1 to enable live runtime smoke
RUNTIME_TIMEOUT_SEC="${RUNTIME_TIMEOUT_SEC:-600}"

if [[ ! "$MODE" =~ ^(stop|distribution|holdbook|hybrid)$ ]]; then
  echo "Usage: $0 [stop|distribution|holdbook|hybrid]"
  exit 2
fi

if [[ ! -f ".venv/bin/activate" ]]; then
  echo "ERROR: Missing .venv/bin/activate"
  exit 1
fi

source .venv/bin/activate

echo "[1/4] Compile checks"
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile config.py main.py workflow/*.py agents/*.py tools/*.py prompts/*.py

echo "[2/4] Unit tests"
pytest -q

echo "[3/4] Shell lint (bash -n)"
bash -n run_sf.sh
bash -n run_hermes.sh

if [[ "$RUN_RUNTIME" == "1" ]]; then
  echo "[4/4] Runtime smoke (autonomous, timeout=${RUNTIME_TIMEOUT_SEC}s)"
  MODE_ENV="$MODE" RUNTIME_TIMEOUT_SEC_ENV="$RUNTIME_TIMEOUT_SEC" PYTHONPYCACHEPREFIX=/tmp/pycache python3 - <<'PY'
import os
import subprocess
import sys

mode = os.environ["MODE_ENV"]
timeout_sec = int(os.environ["RUNTIME_TIMEOUT_SEC_ENV"])
cmd = [
    "python3",
    "main.py",
    "--sample",
    "--post-credit",
    mode,
    "--human-gate",
    "approve",
    "--autonomous",
    "--fast",
]
print("runtime_cmd:", " ".join(cmd))
proc = subprocess.run(cmd, timeout=timeout_sec)
sys.exit(proc.returncode)
PY
else
  echo "[4/4] Runtime smoke skipped (RUN_RUNTIME=0)"
fi

echo "Production check: PASS"
