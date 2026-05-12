#!/usr/bin/env bash
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/ai.sfagent.inboxworker.plist"

if [[ -f "$PLIST" ]]; then
  echo "Plist: $PLIST"
  launchctl list | rg ai.sfagent.inboxworker || true
else
  echo "LaunchAgent not installed."
fi

echo "---"
BG_PID_FILE="data/inbox/worker.bg.pid"
if [[ -f "$BG_PID_FILE" ]]; then
  BG_PID="$(cat "$BG_PID_FILE" || true)"
  if [[ -n "$BG_PID" ]] && kill -0 "$BG_PID" 2>/dev/null; then
    echo "Background worker: running (pid=$BG_PID)"
  else
    echo "Background worker: pid file present but process not running"
  fi
else
  echo "Background worker: not running"
fi

echo "---"
if [[ -f data/inbox/worker.stdout.log ]]; then
  echo "stdout (tail)"; tail -n 40 data/inbox/worker.stdout.log
fi
if [[ -f data/inbox/worker.stderr.log ]]; then
  echo "stderr (tail)"; tail -n 40 data/inbox/worker.stderr.log
fi

if [[ -f data/inbox/worker.bg.stdout.log ]]; then
  echo "bg stdout (tail)"; tail -n 40 data/inbox/worker.bg.stdout.log
fi
if [[ -f data/inbox/worker.bg.stderr.log ]]; then
  echo "bg stderr (tail)"; tail -n 40 data/inbox/worker.bg.stderr.log
fi

echo "---"
if [[ -f data/inbox/worker.status.json ]]; then
  echo "worker status file"; cat data/inbox/worker.status.json
fi
