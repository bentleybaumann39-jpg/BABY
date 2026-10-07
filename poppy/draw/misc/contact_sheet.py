#!/usr/bin/env python3
"""contact_sheet.py - review sheets for the misc art.

  python3 poppy/draw/misc/contact_sheet.py OUT.png [--dir DIR] [names ...]
      grid of the pieces (alpha pieces over a checkerboard), labelled.
  python3 poppy/draw/misc/contact_sheet.py OUT.png --board [--dir DIR]
      flowers / feelings faces composited into the felt-board slots of
      build/rooms/playroom_board.png at their on-screen size, plus a soft
      VHS-like blur version underneath (readability check).
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))


def checker(w, h, s=12):
    im = Image.new('RGB', (w, h), (200, 200, 200))
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=(235, 235, 235))
    return im


def vhs_soft(im):
    """cheap stand-in for the tape: luma blur, stronger chroma blur, slight shift."""
    im = im.convert('YCbCr')
    y, cb, cr = im.split()
    y = y.filter(ImageFilter.GaussianBlur(0.9))
    cb = cb.filter(ImageFilter.GaussianBlur(3)).transform(cb.size, Image.AFFINE, (1, 0, -3, 0, 1, 0))
    cr = cr.filter(ImageFilter.GaussianBlur(3)).transform(cr.size, Image.AFFINE, (1, 0, -3, 0, 1, 0))
    return Image.merge('YCbCr', (y, cb, cr)).convert('RGB')


def main():
    args = sys.argv[1:]
    out = args.pop(0)
    d = os.path.join(ROOT, 'build', 'art', 'misc')
    board = False
    names = []
    while args:
        a = args.pop(0)
        if a == '--dir':
            d = args.pop(0)
        elif a == '--board':
            board = True
        else:
            names.append(a.replace('.png', ''))
    man = json.load(open(os.path.join(ROOT, 'assets.json')))['misc_art']
    if board:
        meta = json.load(open(os.path.join(ROOT, 'build', 'rooms', 'rooms_meta.json')))['playroom_board']
        bg = Image.open(os.path.join(ROOT, 'build', 'rooms', 'playroom_board.png')).convert('RGB')
        rows = []
        for set_ in (['flower_1', 'flower_2', 'flower_3', 'flower_4', 'flower_5_eye'],
                     ['feel_happy', 'feel_sad', 'feel_angry', 'feel_scared', 'feel_hungry']):
            im = bg.copy()
            for (cx, cy), n in zip(meta['slot_centers'], set_):
                p = os.path.join(d, n + '.png')
                if not os.path.exists(p):
                    continue
                a = Image.open(p).convert('RGBA')
                th = 120 if n.startswith('flower') else 100
                tw = round(a.width * th / a.height)
                a = a.resize((tw, th), Image.LANCZOS)
                im.paste(a, (round(cx - tw / 2), round(cy - th / 2)), a)
            rows.append(im)
            rows.append(vhs_soft(im))
        sheet = Image.new('RGB', (1280, 960))
        for i, r in enumerate(rows):
            sheet.paste(r, ((i % 2) * 640, (i // 2) * 480))
        sheet.save(out)
        print(out)
        return
    items = [it for it in man if not names or os.path.basename(it['file'])[:-4] in names]
    cell_w, cell_h = 330, 270
    cols = 4
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell_w, rows * cell_h), (40, 40, 48))
    dr = ImageDraw.Draw(sheet)
    for i, it in enumerate(items):
        n = os.path.basename(it['file'])
        p = os.path.join(d, n)
        x0, y0 = (i % cols) * cell_w, (i // cols) * cell_h
        dr.text((x0 + 6, y0 + cell_h - 16), n, fill=(255, 255, 160))
        if not os.path.exists(p):
            dr.text((x0 + 100, y0 + 120), 'MISSING', fill=(255, 80, 80))
            continue
        a = Image.open(p).convert('RGBA')
        s = min((cell_w - 10) / a.width, (cell_h - 24) / a.height)
        a = a.resize((max(1, round(a.width * s)), max(1, round(a.height * s))), Image.LANCZOS)
        bgc = checker(a.width, a.height)
        bgc.paste(a, (0, 0), a)
        sheet.paste(bgc, (x0 + (cell_w - a.width) // 2, y0 + 4))
    sheet.save(out)
    print(out)


if __name__ == '__main__':
    main()
