#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
AUTO_OPEN="${AUTO_OPEN:-1}"
START_WORKER="${START_WORKER:-0}"
FORCE_REFRESH_ON_MISMATCH="${FORCE_REFRESH_ON_MISMATCH:-1}"

PID_DIR="$ROOT_DIR/data/local"
PID_FILE="$PID_DIR/backend.pid"
OUT_LOG="$PID_DIR/backend.stdout.log"
ERR_LOG="$PID_DIR/backend.stderr.log"

mkdir -p "$PID_DIR"

if [[ ! -x "$ROOT_DIR/.venv/bin/python" ]]; then
  echo "Missing .venv python. Create venv and install requirements first." >&2
  exit 1
fi

start_backend() {
  PY_WARNINGS="${PYTHONWARNINGS:-ignore:urllib3 v2 only supports OpenSSL 1.1.1+}"
  if [[ "$PY_WARNINGS" == *"urllib3.exceptions"* ]]; then
    PY_WARNINGS="ignore:urllib3 v2 only supports OpenSSL 1.1.1+"
  fi
  PYTHONWARNINGS="$PY_WARNINGS" \
    nohup "$ROOT_DIR/.venv/bin/python" -m uvicorn backend.api:app --host "$HOST" --port "$PORT" >"$OUT_LOG" 2>"$ERR_LOG" < /dev/null &
  PID=$!
  echo "$PID" > "$PID_FILE"
  echo "Backend started (pid=$PID)"
}

wait_health() {
  READY=0
  for _ in {1..30}; do
    CODE="$(curl --noproxy "*" -s -o /dev/null -w "%{http_code}" "http://$HOST:$PORT/api/health" || true)"
    if [[ "$CODE" == "200" || "$CODE" == "401" ]]; then
      if [[ "$CODE" == "401" ]]; then
        echo "Backend ready at http://$HOST:$PORT/ (API key required for /api/*)"
      else
        echo "Backend ready at http://$HOST:$PORT/"
      fi
      READY=1
      break
    fi
    sleep 1
  done
  if [[ "$READY" != "1" ]]; then
    echo "Backend did not become healthy at http://$HOST:$PORT/api/health (last code: ${CODE:-000})" >&2
    if [[ -f "$ERR_LOG" ]]; then
      echo "--- backend stderr (tail) ---" >&2
      tail -n 40 "$ERR_LOG" >&2 || true
    fi
    if [[ -f "$PID_FILE" ]]; then
      DEAD_PID="$(cat "$PID_FILE" || true)"
      if [[ -n "$DEAD_PID" ]] && ! kill -0 "$DEAD_PID" 2>/dev/null; then
        rm -f "$PID_FILE"
      fi
    fi
    exit 1
  fi
}

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    echo "Backend already running (pid=$PID)"
  else
    rm -f "$PID_FILE"
  fi
fi

PORT_PID="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
if [[ -n "$PORT_PID" && ! -f "$PID_FILE" ]]; then
  echo "Backend already listening on $HOST:$PORT (pid=$PORT_PID)"
  echo "$PORT_PID" > "$PID_FILE"
fi

if [[ ! -f "$PID_FILE" ]]; then
  start_backend
fi

wait_health

UI_CODE="$(curl --noproxy "*" -s -o /dev/null -w "%{http_code}" "http://$HOST:$PORT/api/ui-config" || true)"
if [[ "$UI_CODE" != "200" && "$UI_CODE" != "401" ]]; then
  echo "Warning: backend is reachable but missing /api/ui-config (code=$UI_CODE)." >&2
  if [[ "$FORCE_REFRESH_ON_MISMATCH" == "1" ]]; then
    echo "Attempting auto-repair: restarting backend listener on port $PORT..." >&2
    "$ROOT_DIR/scripts/stop_local_ui_stack.sh" >/dev/null 2>&1 || true
    rm -f "$PID_FILE"
    start_backend
    wait_health
    UI_CODE="$(curl --noproxy "*" -s -o /dev/null -w "%{http_code}" "http://$HOST:$PORT/api/ui-config" || true)"
  fi
  if [[ "$UI_CODE" != "200" && "$UI_CODE" != "401" ]]; then
    echo "Backend still missing /api/ui-config after restart (code=$UI_CODE)." >&2
    echo "Run: ./stop_ui.command && ./open_ui.command, then check ./status_ui.command" >&2
    exit 1
  fi
fi

if [[ "${START_WORKER}" == "1" ]]; then
  "$ROOT_DIR/scripts/start_inbox_worker_background.sh" || true
fi

if [[ "${AUTO_OPEN}" == "1" ]]; then
  if command -v open >/dev/null 2>&1; then
    open "http://$HOST:$PORT/" || true
  fi
fi

echo "Backend logs:"
echo "  stdout: $OUT_LOG"
echo "  stderr: $ERR_LOG"
