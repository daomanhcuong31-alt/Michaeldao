#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT_DIR/data/inbox/worker.bg.pid"
OUT_LOG="$ROOT_DIR/data/inbox/worker.bg.stdout.log"
ERR_LOG="$ROOT_DIR/data/inbox/worker.bg.stderr.log"

mkdir -p "$ROOT_DIR/data/inbox"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    echo "Background worker already running (pid=$PID)"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

cd "$ROOT_DIR"
nohup ./run_inbox_worker.sh >"$OUT_LOG" 2>"$ERR_LOG" < /dev/null &
PID=$!
echo "$PID" > "$PID_FILE"

echo "Background inbox worker started (pid=$PID)"
echo "stdout: $OUT_LOG"
echo "stderr: $ERR_LOG"
