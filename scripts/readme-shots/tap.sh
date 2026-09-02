#!/usr/bin/env bash
# tap.sh — tap the on-screen element whose accessible text contains the
# given string (case-insensitive), located via a uiautomator dump. Makes
# README capture runs scriptable without hardcoding coordinates that rot.
#
#   scripts/readme-shots/tap.sh "Favorites"        # tap first match
#   scripts/readme-shots/tap.sh "Favorites" 2      # tap second match
#
# Fails loudly when nothing matches — a capture run should stop when the
# UI moved, not tap the wrong thing.
set -euo pipefail
TEXT="${1:?usage: tap.sh <text> [nth]}"
NTH="${2:-1}"
ADB="${ADB:-adb}"

$ADB shell uiautomator dump /sdcard/_ui.xml >/dev/null
$ADB pull /sdcard/_ui.xml /tmp/_ui.xml >/dev/null
$ADB shell rm /sdcard/_ui.xml

COORDS=$(python3 - "$TEXT" "$NTH" <<'PY'
import re, sys
text, nth = sys.argv[1].lower(), int(sys.argv[2])
xml = open('/tmp/_ui.xml', encoding='utf-8', errors='replace').read()
hits = []
for n in re.findall(r'<node[^>]*>', xml):
    t = re.search(r'text="([^"]*)"', n)
    d = re.search(r'content-desc="([^"]*)"', n)
    label = ((t.group(1) if t else '') + ' ' + (d.group(1) if d else '')).lower()
    if text in label:
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if b:
            x1, y1, x2, y2 = map(int, b.groups())
            hits.append(((x1 + x2) // 2, (y1 + y2) // 2))
if len(hits) < nth:
    print(f"tap.sh: NO MATCH for {text!r} ({len(hits)} found)", file=sys.stderr)
    sys.exit(1)
print(f"{hits[nth - 1][0]} {hits[nth - 1][1]}")
PY
)
$ADB shell input tap $COORDS
