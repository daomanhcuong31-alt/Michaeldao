#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT_DIR/data/local/backend.pid"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" || true
    sleep 1
    if kill -0 "$PID" 2>/dev/null; then
      kill -9 "$PID" || true
    fi
    echo "Backend stopped (pid=$PID)"
  else
    echo "Pid file existed but process was not running."
  fi
else
  echo "No backend pid file."
fi

rm -f "$PID_FILE"

PORT_PIDS="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null || true)"
if [[ -n "$PORT_PIDS" ]]; then
  for P in $PORT_PIDS; do
    if kill -0 "$P" 2>/dev/null; then
      kill "$P" || true
      sleep 1
      if kill -0 "$P" 2>/dev/null; then
        kill -9 "$P" || true
      fi
      echo "Stopped listener on $HOST:$PORT (pid=$P)"
    fi
  done
fi
