#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
APP_NAME="SF Agentic AI Launcher"
APP_PATH="$DIST_DIR/$APP_NAME.app"

mkdir -p "$DIST_DIR"

if ! command -v osacompile >/dev/null 2>&1; then
  echo "osacompile not found (macOS only)." >&2
  exit 1
fi

TMP_SCRIPT="$(mktemp -t sf_launcher).applescript"
cat > "$TMP_SCRIPT" <<EOF
do shell script "cd " & quoted form of "$ROOT_DIR" & " && ./open_ui.command"
EOF

osacompile -o "$APP_PATH" "$TMP_SCRIPT"
rm -f "$TMP_SCRIPT"

echo "Launcher created: $APP_PATH"
echo "Double-click it to start backend + open UI."
