#!/usr/bin/env bash
# diffdir.sh — pixel-diff two directories of same-named screenshots and
# print a fraction-changed number per pair. The V4 all-off gate: at the end
# of every phase, shots of the phase build with every Extra off are diffed
# against the baseline; any non-live-content difference is a bug.
#
#   scripts/readme-shots/diffdir.sh docs/report-assets/v4-baseline docs/report-assets/v4-phase0-alloff
set -euo pipefail
A="${1:?usage: diffdir.sh <dirA> <dirB>}"
B="${2:?usage: diffdir.sh <dirA> <dirB>}"
python3 - "$A" "$B" <<'PY'
import sys, os
from PIL import Image, ImageChops
a_dir, b_dir = sys.argv[1], sys.argv[2]
names = sorted(set(os.listdir(a_dir)) & set(os.listdir(b_dir)))
names = [n for n in names if n.endswith('.png')]
if not names:
    print('no common shots'); sys.exit(1)
worst = 0.0
for n in names:
    a = Image.open(os.path.join(a_dir, n)).convert('RGB')
    b = Image.open(os.path.join(b_dir, n)).convert('RGB')
    if a.size != b.size:
        print(f'{n}: SIZE MISMATCH {a.size} vs {b.size}'); worst = 1.0; continue
    diff = ImageChops.difference(a, b).convert('L')
    px = list(diff.getdata())
    changed = sum(1 for v in px if v > 8) / len(px)
    worst = max(worst, changed)
    print(f'{n}: {changed*100:.2f}% pixels differ')
only_a = sorted(set(os.listdir(a_dir)) - set(os.listdir(b_dir)))
only_b = sorted(set(os.listdir(b_dir)) - set(os.listdir(a_dir)))
if only_a: print('only in baseline:', only_a)
if only_b: print('only in phase dir:', only_b)
print(f'WORST {worst*100:.2f}%')
PY
