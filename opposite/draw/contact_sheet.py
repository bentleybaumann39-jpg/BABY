#!/usr/bin/env python3
"""contact_sheet.py - OPPOSITE DAY review sheets for the canvas art.

  python3 opposite/draw/contact_sheet.py OUT.png [--kind char|misc|all] [--dir DIR]
          [--cols N] [--cell WxH] [--rot180] [--dark] [names ...]

Grid of the pieces (alpha pieces over a checkerboard, or over near-black with
--dark, which is how the hidden figures sit), labelled with name, size and,
for opaque scare frames, the value budget (share of pixels <= 8% luma and
> 60% luma) and mean luminance. --rot180 adds each piece rotated 180 degrees
beside it (the Thatcher check: the upside-down view must read as a normal face).
"""
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))


def checker(w, h, s=12, dark=False):
    a, b = ((14, 14, 16), (22, 22, 26)) if dark else ((200, 200, 200), (235, 235, 235))
    im = Image.new('RGB', (w, h), a)
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=b)
    return im


def stats(im):
    g = im.convert('RGB')
    px = list(g.getdata())
    n = len(px)
    lum = [(0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255 for r, gg, b in px]
    dark = sum(1 for v in lum if v <= 0.08) / n
    bright = sum(1 for v in lum if v > 0.6) / n
    return dark, bright, sum(lum) / n


def main():
    args = sys.argv[1:]
    out = args.pop(0)
    kind, d, cols, cell, rot, darkbg, names = 'all', None, 4, (330, 270), False, False, []
    while args:
        a = args.pop(0)
        if a == '--kind':
            kind = args.pop(0)
        elif a == '--dir':
            d = args.pop(0)
        elif a == '--cols':
            cols = int(args.pop(0))
        elif a == '--cell':
            cell = tuple(int(v) for v in args.pop(0).split('x'))
        elif a == '--rot180':
            rot = True
        elif a == '--dark':
            darkbg = True
        else:
            names.append(os.path.basename(a).replace('.png', ''))
    man = json.load(open(os.path.join(ROOT, 'assets.json')))
    items = []
    for k in (['char_art', 'misc_art'] if kind == 'all' else [kind + '_art']):
        items += man[k]
    if names:
        byn = {os.path.basename(it['file'])[:-4]: it for it in items}
        items = [byn[n] for n in names if n in byn]
    tiles = []
    for it in items:
        p = os.path.join(d, os.path.basename(it['file'])) if d else os.path.join(ROOT, it['file'])
        tiles.append((it, p, False))
        if rot:
            tiles.append((it, p, True))
    cw, ch = cell
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * ch), (40, 40, 48))
    dr = ImageDraw.Draw(sheet)
    for i, (it, p, r180) in enumerate(tiles):
        n = os.path.basename(it['file'])
        x0, y0 = (i % cols) * cw, (i // cols) * ch
        label = n + (' (rot180)' if r180 else '')
        if not os.path.exists(p):
            dr.text((x0 + 6, y0 + ch - 16), label, fill=(255, 255, 160))
            dr.text((x0 + 100, y0 + 120), 'MISSING', fill=(255, 80, 80))
            continue
        a = Image.open(p).convert('RGBA')
        if r180:
            a = a.rotate(180)
        info = '%dx%d' % a.size
        if not it.get('transparent'):
            dk, br, mean = stats(a)
            info += ' dark%.0f%% bright%.0f%% mean%.3f' % (dk * 100, br * 100, mean)
        s = min((cw - 10) / a.width, (ch - 30) / a.height)
        a = a.resize((max(1, round(a.width * s)), max(1, round(a.height * s))), Image.LANCZOS)
        bgc = checker(a.width, a.height, dark=darkbg)
        bgc.paste(a, (0, 0), a)
        sheet.paste(bgc, (x0 + (cw - a.width) // 2, y0 + 4))
        dr.text((x0 + 6, y0 + ch - 26), label, fill=(255, 255, 160))
        dr.text((x0 + 6, y0 + ch - 14), info, fill=(190, 220, 255))
    sheet.save(out)
    print(out)


if __name__ == '__main__':
    main()
