#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"

exec uvicorn backend.api:app --host "$HOST" --port "$PORT"
