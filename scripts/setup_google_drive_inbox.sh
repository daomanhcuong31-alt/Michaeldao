#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env not found at $ENV_FILE"
  exit 1
fi

DRIVE_BASE_DEFAULT="$HOME/My Drive/SF Agentic Inbox"
DRIVE_BASE="${1:-$DRIVE_BASE_DEFAULT}"

PENDING_DIR="$DRIVE_BASE/pending"
PROCESSING_DIR="$DRIVE_BASE/processing"
ARCHIVE_DIR="$DRIVE_BASE/archive"
FAILED_DIR="$DRIVE_BASE/failed"
CONTROL_DIR="$DRIVE_BASE/control"

mkdir -p "$PENDING_DIR" "$PROCESSING_DIR" "$ARCHIVE_DIR" "$FAILED_DIR" "$CONTROL_DIR"
export ENV_FILE PENDING_DIR PROCESSING_DIR ARCHIVE_DIR FAILED_DIR CONTROL_DIR

python3 - <<'PY'
from pathlib import Path
import os

env_path = Path(os.environ['ENV_FILE'])
updates = {
    'SF_INBOX_DIR': os.environ['PENDING_DIR'],
    'SF_PROCESSING_DIR': os.environ['PROCESSING_DIR'],
    'SF_ARCHIVE_DIR': os.environ['ARCHIVE_DIR'],
    'SF_FAILED_DIR': os.environ['FAILED_DIR'],
    'SF_CONTROL_DIR': os.environ['CONTROL_DIR'],
    'SF_POLL_SEC': '15',
    'SF_INBOX_MAX_FILES': '20',
    'SF_TRIGGER_MODE': 'auto',
    'SF_PROVIDER': 'hermes',
    'SF_POST_CREDIT_MODE': 'stop',
    'SF_HUMAN_GATE': 'approve',
    'SF_ROUTE_MODE': 'auto',
    'SF_FORCE_AUTONOMOUS': 'true',
    'SF_FORCE_FAST': 'true',
    'SF_SKIP_PREFLIGHT': 'false',
}

def fmt(v: str) -> str:
    # Keep .env shell-safe when paths contain spaces.
    if any(ch.isspace() for ch in v):
        escaped = v.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return v

lines = env_path.read_text(encoding='utf-8').splitlines()
out = []
seen = set()
for line in lines:
    if '=' in line and not line.lstrip().startswith('#'):
        key = line.split('=', 1)[0].strip()
        if key in updates:
            out.append(f"{key}={fmt(updates[key])}")
            seen.add(key)
            continue
    out.append(line)

for k, v in updates.items():
    if k not in seen:
        out.append(f"{k}={fmt(v)}")

env_path.write_text('\n'.join(out) + '\n', encoding='utf-8')
PY

# restart background worker so new env is loaded
"$ROOT_DIR/scripts/stop_inbox_worker_background.sh" || true
"$ROOT_DIR/scripts/start_inbox_worker_background.sh"

echo "Google Drive inbox configured: $DRIVE_BASE"
echo "Drop files into: $PENDING_DIR"
echo "Archive files in: $ARCHIVE_DIR"
echo "Failed files in:  $FAILED_DIR"
echo "Control folder:   $CONTROL_DIR"
