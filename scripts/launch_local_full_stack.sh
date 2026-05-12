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

log() { echo "[launcher] $*"; }
warn() { echo "[launcher][warn] $*" >&2; }
runtime_provider() {
  local raw="${LLM_PROVIDER:-lm_studio}"
  raw="$(echo "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$raw" in
    hermes|open_claw) echo "hermes" ;;
    lmstudio|lm-studio|lm_studio) echo "lm_studio" ;;
    *) echo "lm_studio" ;;
  esac
}

http_code() {
  local url="$1"
  curl --noproxy "*" -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || true
}

check_hermes_pm2() {
  local pm2_name="${HERMES_PM2_NAME:-hermes}"
  local pm2_start_cmd="${HERMES_PM2_START_CMD:-}"

  if ! command -v pm2 >/dev/null 2>&1; then
    warn "pm2 not found. Skipping pm2-based Hermes process checks."
    return 0
  fi

  log "pm2 found. Checking process: $pm2_name"
  local status
  status="$(pm2 describe "$pm2_name" 2>/dev/null | awk -F': ' '/status/{print $2; exit}' | tr -d '[:space:]' || true)"

  if [[ "$status" == "online" ]]; then
    log "pm2 process '$pm2_name' is online."
    return 0
  fi

  if [[ -n "$status" ]]; then
    warn "pm2 process '$pm2_name' status=$status. Restarting..."
    pm2 restart "$pm2_name" >/dev/null 2>&1 || warn "Failed to restart pm2 process '$pm2_name'."
    return 0
  fi

  warn "pm2 process '$pm2_name' not found."
  if [[ -n "$pm2_start_cmd" ]]; then
    warn "Starting via HERMES_PM2_START_CMD..."
    # shellcheck disable=SC2086
    pm2 start $pm2_start_cmd --name "$pm2_name" >/dev/null 2>&1 || warn "Failed to start pm2 process from HERMES_PM2_START_CMD."
  else
    warn "Set HERMES_PM2_START_CMD in .env to auto-start missing Hermes pm2 process."
  fi
}

check_hermes_health() {
  local base="${HERMES_BASE_URL:-http://127.0.0.1:18789}"
  local health="${base%/}/health"
  log "Checking Hermes health: $health"
  for _ in 1 2 3 4; do
    local code
    code="$(http_code "$health")"
    if [[ "$code" == "200" ]]; then
      log "Hermes health OK."
      return 0
    fi
    sleep 1
  done
  warn "Hermes health is DOWN (last code=${code:-000})."
  return 0
}

check_lm_studio() {
  local base="${LM_STUDIO_BASE_URL:-http://127.0.0.1:1234/v1}"
  local models_url
  if [[ "$base" == */v1 ]]; then
    models_url="${base%/}/models"
  else
    models_url="${base%/}/v1/models"
  fi

  log "Checking LM Studio endpoint: $models_url"
  local code
  code="$(http_code "$models_url")"
  if [[ "$code" == "200" ]]; then
    log "LM Studio endpoint reachable."
    return 0
  fi

  warn "LM Studio endpoint not reachable (code=${code:-000}). Attempting to open LM Studio app..."
  if command -v open >/dev/null 2>&1; then
    open -a "LM Studio" >/dev/null 2>&1 || warn "Could not open LM Studio app automatically."
  fi

  for _ in 1 2 3 4 5 6; do
    code="$(http_code "$models_url")"
    if [[ "$code" == "200" ]]; then
      log "LM Studio endpoint reachable after app launch."
      return 0
    fi
    sleep 2
  done
  warn "LM Studio still unreachable. Start Local Server in LM Studio if runs fail."
  return 0
}

log "Starting full local stack preflight"
PROVIDER="$(runtime_provider)"
log "Configured LLM provider: $PROVIDER"
if [[ "$PROVIDER" == "hermes" ]]; then
  check_hermes_pm2
  check_hermes_health
else
  log "Skipping Hermes checks because provider is lm_studio."
fi
check_lm_studio

log "Starting backend UI stack..."
AUTO_OPEN=0 ./scripts/start_local_ui_stack.sh

if command -v open >/dev/null 2>&1; then
  open "http://127.0.0.1:8000/" || true
fi

log "Done. UI: http://127.0.0.1:8000/"
log "Run ./status_ui.command for runtime status."
