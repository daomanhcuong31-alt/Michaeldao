#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT_DIR/data/local/backend.pid"
OUT_LOG="$ROOT_DIR/data/local/backend.stdout.log"
ERR_LOG="$ROOT_DIR/data/local/backend.stderr.log"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    echo "Backend process: running (pid=$PID)"
  else
    PORT_PID="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
    if [[ -n "$PORT_PID" ]]; then
      echo "$PORT_PID" > "$PID_FILE"
      echo "Backend process: running via port listener (pid=$PORT_PID), pid file repaired"
    else
      echo "Backend process: pid file present but process not running (stale pid)"
    fi
  fi
else
  PORT_PID="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
  if [[ -n "$PORT_PID" ]]; then
    mkdir -p "$(dirname "$PID_FILE")"
    echo "$PORT_PID" > "$PID_FILE"
    echo "Backend process: running via port listener (pid=$PORT_PID), pid file repaired"
  else
    echo "Backend process: not running"
  fi
fi

echo "---"
HEALTH_JSON="$(mktemp -t sf_health.XXXXXX.json)"
CODE="$(curl --noproxy "*" -s -o "$HEALTH_JSON" -w "%{http_code}" "http://$HOST:$PORT/api/health" || true)"
if [[ "$CODE" == "200" ]]; then
  echo "Backend HTTP: OK ($HOST:$PORT)"
  "$ROOT_DIR/.venv/bin/python" - "$HEALTH_JSON" <<'PY' || true
import json
import sys

path = sys.argv[1]
try:
    data = json.load(open(path, encoding="utf-8"))
except Exception as exc:
    print(f"Runtime health: UNKNOWN (health JSON parse failed: {exc})")
    raise SystemExit(0)

provider = data.get("provider") or "unknown"
model = data.get("model") or "unknown"
base_url = data.get("base_url") or ""
ready = bool(data.get("ok") or data.get("ready"))
preflight = data.get("preflight") if isinstance(data.get("preflight"), dict) else {}
if ready:
    print(f"Runtime health: OK ({provider}, model={model}, base={base_url})")
else:
    detail = preflight.get("error") or data.get("error") or "runtime preflight failed"
    print(f"Runtime health: DOWN ({provider}, model={model}, base={base_url})")
    print(f"Runtime detail: {detail}")
PY
elif [[ "$CODE" == "401" ]]; then
  echo "Backend HTTP: API key required ($HOST:$PORT)"
else
  echo "Backend HTTP: DOWN ($HOST:$PORT, code=${CODE:-000})"
fi
rm -f "$HEALTH_JSON"

UI_CODE="$(curl --noproxy "*" -s -o /dev/null -w "%{http_code}" "http://$HOST:$PORT/api/ui-config" || true)"
if [[ "$UI_CODE" == "200" || "$UI_CODE" == "401" ]]; then
  echo "UI config endpoint: OK"
else
  echo "UI config endpoint: missing (code=${UI_CODE:-000})"
fi

echo "---"
if [[ -f "$OUT_LOG" ]]; then
  echo "backend stdout (tail)"
  tail -n 25 "$OUT_LOG"
fi
if [[ -f "$ERR_LOG" ]]; then
  echo "backend stderr (tail)"
  tail -n 25 "$ERR_LOG"
fi
