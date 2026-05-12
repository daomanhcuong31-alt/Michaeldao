#!/usr/bin/env bash
set -euo pipefail
PLIST="$HOME/Library/LaunchAgents/ai.sfagent.inboxworker.plist"
if [[ -f "$PLIST" ]]; then
  launchctl unload "$PLIST" || true
  echo "Stopped ai.sfagent.inboxworker"
else
  echo "Not installed."
fi
