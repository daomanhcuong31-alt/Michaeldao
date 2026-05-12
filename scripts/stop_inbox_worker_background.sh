#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT_DIR/data/inbox/worker.bg.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Background worker not running (no pid file)."
  exit 0
fi

PID="$(cat "$PID_FILE" || true)"
if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID" || true
  sleep 1
fi
rm -f "$PID_FILE"
echo "Background inbox worker stopped."
