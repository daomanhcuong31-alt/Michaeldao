#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
ICONSET_DIR="$DIST_DIR/SFAgentic.iconset"
BASE_PNG="$DIST_DIR/SFAgentic_1024.png"
OUT_ICNS="$DIST_DIR/SFAgentic.icns"

mkdir -p "$DIST_DIR"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

if python3 - "$BASE_PNG" <<'PY'
import sys
from pathlib import Path
try:
    from PIL import Image, ImageDraw
except Exception:
    sys.exit(42)

root = Path(sys.argv[1])
img = Image.new("RGBA", (1024, 1024), (18, 27, 38, 255))
d = ImageDraw.Draw(img)

for i in range(1024):
    alpha = int(115 * (1.0 - (i / 1023.0)))
    d.line([(0, i), (1024, i)], fill=(255, 110, 64, alpha), width=1)

d.rounded_rectangle((96, 96, 928, 928), radius=170, fill=(26, 39, 56, 240), outline=(255, 128, 84, 255), width=14)
d.rounded_rectangle((170, 180, 860, 850), radius=90, fill=(245, 247, 250, 255))
d.rectangle((220, 260, 810, 320), fill=(255, 128, 84, 255))
d.rectangle((220, 360, 610, 398), fill=(54, 74, 96, 255))
d.rectangle((220, 432, 720, 470), fill=(54, 74, 96, 255))
d.rectangle((220, 504, 760, 542), fill=(54, 74, 96, 255))
d.rectangle((220, 576, 520, 614), fill=(54, 74, 96, 255))

d.rounded_rectangle((590, 630, 820, 820), radius=40, fill=(255, 128, 84, 255))
d.polygon([(640, 723), (760, 670), (760, 776)], fill=(255, 255, 255, 255))

img.save(root, "PNG")
PY
then
  :
else
  cp "/System/Applications/Utilities/Terminal.app/Contents/Resources/Terminal.icns" "$OUT_ICNS"
  echo "$OUT_ICNS"
  exit 0
fi

if python3 - "$BASE_PNG" "$OUT_ICNS" <<'PY'
import sys
from PIL import Image

png_path = sys.argv[1]
icns_path = sys.argv[2]
img = Image.open(png_path).convert("RGBA")
img.save(
    icns_path,
    format="ICNS",
    sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)],
)
PY
then
  :
else
  sips -z 16 16 "$BASE_PNG" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
  sips -z 32 32 "$BASE_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
  sips -z 32 32 "$BASE_PNG" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
  sips -z 64 64 "$BASE_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
  sips -z 128 128 "$BASE_PNG" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
  sips -z 256 256 "$BASE_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
  sips -z 256 256 "$BASE_PNG" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
  sips -z 512 512 "$BASE_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
  sips -z 512 512 "$BASE_PNG" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
  cp "$BASE_PNG" "$ICONSET_DIR/icon_512x512@2x.png"
  iconutil -c icns "$ICONSET_DIR" -o "$OUT_ICNS" || cp "/System/Applications/Utilities/Terminal.app/Contents/Resources/Terminal.icns" "$OUT_ICNS"
fi

echo "$OUT_ICNS"
