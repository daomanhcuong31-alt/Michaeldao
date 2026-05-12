#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

log() { echo "[stopper] $*"; }
warn() { echo "[stopper][warn] $*" >&2; }
runtime_provider() {
  local raw="${LLM_PROVIDER:-lm_studio}"
  raw="$(echo "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$raw" in
    hermes|open_claw) echo "hermes" ;;
    lmstudio|lm-studio|lm_studio) echo "lm_studio" ;;
    *) echo "lm_studio" ;;
  esac
}

log "Stopping UI backend stack..."
./scripts/stop_local_ui_stack.sh || true

if [[ "$(runtime_provider)" == "hermes" ]]; then
  if command -v pm2 >/dev/null 2>&1; then
    pm2_name="${HERMES_PM2_NAME:-hermes}"
    log "Checking pm2 process '$pm2_name'..."
    if pm2 describe "$pm2_name" >/dev/null 2>&1; then
      log "Stopping pm2 process '$pm2_name'..."
      pm2 stop "$pm2_name" >/dev/null 2>&1 || warn "Failed to stop pm2 process '$pm2_name'."
    else
      log "pm2 process '$pm2_name' not found (nothing to stop)."
    fi
  else
    warn "pm2 not found. Skipping Hermes pm2 stop."
  fi
else
  log "Skipping Hermes pm2 stop because provider is lm_studio."
fi

log "Stopping inbox worker (if running)..."
./scripts/stop_inbox_worker_background.sh >/dev/null 2>&1 || true

log "Full local stack stop complete."
