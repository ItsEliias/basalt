#!/usr/bin/env bash
# snap.sh — capture the current screen of the connected device/emulator into
# docs/readme-assets/<name>.png, compressed. Part of the repeatable README
# screenshot pipeline (see scripts/readme-shots/screenshots.md).
#
#   scripts/readme-shots/snap.sh today-ledger
#
# Demo mode is (re)applied before every capture so the status bar is always
# clean: fixed 09:00 clock, full battery, wifi, zero notification icons.
set -euo pipefail
NAME="${1:?usage: snap.sh <shot-name>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/docs/readme-assets"
mkdir -p "$OUT"
ADB="${ADB:-adb}"

# Clean status bar — idempotent, safe to repeat per shot.
$ADB shell settings put global sysui_demo_allowed 1
$ADB shell am broadcast -a com.android.systemui.demo -e command enter >/dev/null
$ADB shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0900 >/dev/null
$ADB shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false >/dev/null
$ADB shell am broadcast -a com.android.systemui.demo -e command network -e wifi -e fully true -e level 4 >/dev/null
$ADB shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false >/dev/null

$ADB shell screencap -p /sdcard/_snap.png
$ADB pull /sdcard/_snap.png "$OUT/$NAME.png" >/dev/null
$ADB shell rm /sdcard/_snap.png

# Compress: pngquant when installed, Pillow quantize otherwise (both lossy
# palette quantization — fine for UI screenshots, ~70-80% smaller).
if command -v pngquant >/dev/null 2>&1; then
  pngquant --force --skip-if-larger --quality 70-92 --output "$OUT/$NAME.png" "$OUT/$NAME.png" || true
else
  python3 - "$OUT/$NAME.png" <<'PY'
import sys
from PIL import Image
p = sys.argv[1]
img = Image.open(p).convert('RGB')
img.quantize(colors=256, method=2).save(p, optimize=True)
PY
fi
echo "$NAME.png $(du -h "$OUT/$NAME.png" | cut -f1 | tr -d ' ')"
