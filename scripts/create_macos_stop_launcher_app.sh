#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
APP_NAME="SF Agentic AI Stop Launcher"
APP_PATH="$DIST_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_PATH/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
EXEC_NAME="sf-agentic-stop-launcher"
ICON_SCRIPT="$ROOT_DIR/scripts/create_macos_app_icon.sh"
ICON_FILE="$ROOT_DIR/dist/SFAgentic.icns"

mkdir -p "$DIST_DIR"
rm -rf "$APP_PATH"
mkdir -p "$MACOS_DIR" "$APP_PATH/Contents/Resources"

if [[ -x "$ICON_SCRIPT" ]]; then
  "$ICON_SCRIPT" >/dev/null || true
fi

cat > "$CONTENTS_DIR/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundleExecutable</key>
  <string>$EXEC_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>com.sfagentic.stop.launcher</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleIconFile</key>
  <string>SFAgentic.icns</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
</dict>
</plist>
EOF

cat > "$MACOS_DIR/$EXEC_NAME" <<EOF
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$ROOT_DIR"
CMD="\$ROOT_DIR/stop_full_stack.command"

if [[ ! -x "\$CMD" ]]; then
  /usr/bin/osascript -e 'display alert "Stop launcher error" message "stop_full_stack.command not found or not executable." as warning'
  exit 1
fi

/usr/bin/open -a Terminal "\$CMD"
EOF

chmod +x "$MACOS_DIR/$EXEC_NAME"

if [[ -f "$ICON_FILE" ]]; then
  cp "$ICON_FILE" "$APP_PATH/Contents/Resources/SFAgentic.icns"
fi

echo "Stop launcher app created: $APP_PATH"
echo "Double-click it to stop UI backend + pm2 Hermes (if configured)."
