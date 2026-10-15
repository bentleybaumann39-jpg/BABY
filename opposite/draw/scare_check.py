#!/usr/bin/env python3
"""scare_check.py - OPPOSITE DAY: acceptance numbers and a review sheet for the
scare faces (the rules in poppy/research/scarier.md).

  python3 opposite/draw/scare_check.py [--dir DIR] [--sheet OUT.png]

For each scare frame: share of pixels at or below 8% luma (target 55-70%),
share above 60% (target 5-15%), mean luma; for each boil pair (X, X_b) the
relative mean-luma difference (must be within 2%) and the share of pixels
that differ (the boil should touch only hatching / tremor lines). The sheet
shows every frame next to its 180-degree rotation (the Thatcher check: the
upside-down view of a Thatchered face must read as a normal face).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
FRAMES = ['turnabout_scare', 'turnabout_scare_b', 'mib_scare', 'mib_scare_b', 'bim_scare_turn', 'bim_scare', 'bim_scare_b']
PAIRS = [('turnabout_scare', 'turnabout_scare_b'), ('mib_scare', 'mib_scare_b'), ('bim_scare', 'bim_scare_b')]


def luma(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255.0
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def main():
    args = sys.argv[1:]
    d = os.path.join(ROOT, 'build', 'art', 'char')
    sheet = None
    if '--dir' in args:
        d = args[args.index('--dir') + 1]
    if '--sheet' in args:
        sheet = args[args.index('--sheet') + 1]
    ok = True
    L = {}
    print(f"{'frame':20s} {'<=8%':>6s} {'>60%':>6s} {'mean':>6s}")
    for n in FRAMES:
        p = os.path.join(d, n + '.png')
        if not os.path.exists(p):
            print(f'{n:20s} MISSING'); ok = False; continue
        l = luma(p); L[n] = l
        dark, bright, mean = (l <= 0.08).mean(), (l > 0.6).mean(), l.mean()
        flag = '' if 0.55 <= dark <= 0.70 and bright <= 0.15 else '  <- budget'
        print(f'{n:20s} {dark*100:5.1f}% {bright*100:5.1f}% {mean:6.3f}{flag}')
    for a, b in PAIRS:
        if a in L and b in L:
            rel = abs(L[a].mean() - L[b].mean()) / max(1e-6, L[a].mean())
            diff = (np.abs(L[a] - L[b]) > 0.02).mean()
            flag = '' if rel <= 0.02 else '  <- boil luma'
            ok &= rel <= 0.02
            print(f'boil {a:16s} mean diff {rel*100:4.2f}%  pixels changed {diff*100:4.1f}%{flag}')
    if sheet:
        tiles = []
        for n in FRAMES:
            p = os.path.join(d, n + '.png')
            if not os.path.exists(p):
                continue
            im = Image.open(p).convert('RGB').resize((400, 300), Image.LANCZOS)
            row = Image.new('RGB', (810, 318), (30, 30, 36))
            row.paste(im, (0, 0)); row.paste(im.rotate(180), (410, 0))
            ImageDraw.Draw(row).text((4, 303), n + '   (right: rotated 180)', fill=(230, 230, 120))
            tiles.append(row)
        out = Image.new('RGB', (810 * 2, 318 * ((len(tiles) + 1) // 2)), (20, 20, 24))
        for i, t in enumerate(tiles):
            out.paste(t, ((i % 2) * 810, (i // 2) * 318))
        out.save(sheet)
        print('sheet ->', sheet)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
