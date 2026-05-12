#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/ai.sfagent.inboxworker.plist"
RUNNER="$ROOT_DIR/run_inbox_worker.sh"

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>ai.sfagent.inboxworker</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>$RUNNER</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$ROOT_DIR</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>$ROOT_DIR/data/inbox/worker.stdout.log</string>

    <key>StandardErrorPath</key>
    <string>$ROOT_DIR/data/inbox/worker.stderr.log</string>

    <key>EnvironmentVariables</key>
    <dict>
      <key>PYTHONPYCACHEPREFIX</key>
      <string>/tmp/pycache</string>
    </dict>
  </dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "Installed and started: ai.sfagent.inboxworker"
echo "Plist: $PLIST"
