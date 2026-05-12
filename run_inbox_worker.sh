#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ ! -f .venv/bin/activate ]]; then
  echo "ERROR: missing .venv/bin/activate"
  exit 1
fi
source .venv/bin/activate

PYTHONPYCACHEPREFIX=/tmp/pycache python3 -u tools/inbox_worker.py "$@"
