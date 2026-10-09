#!/usr/bin/env python3
"""
THE WORLD OF POPPY - compositor.

Builds poppy/the_world_of_poppy.mp4 (640x480, 30 fps, H.264 + AAC, 309.4 s)
from the finished assets in poppy/build/, following poppy/STORYBOARD.md (the
shot timings are read from its machine-readable shot list, section 9) and the
scare pass in poppy/SCARE_PASS.md (section 5).

    python3 poppy/make_video.py                  # render changed chunks, mix, concat, mux
    python3 poppy/make_video.py --force 7 8b     # re-render segment 7 and the chunk holding shot 8b
    python3 poppy/make_video.py --force all      # re-render every chunk
    python3 poppy/make_video.py --still 41.5 2:52.9   # preview PNGs into build/preview/
    python3 poppy/make_video.py --video-only | --audio-only | --mux-only
    python3 poppy/make_video.py --sheets         # timecoded contact sheets of the final file
    python3 poppy/make_video.py --audio-report   # per-second RMS/peak of the final mix

Restartable and incremental: the picture is rendered in chunks (one per
storyboard segment, long segments split at shot boundaries) to
build/chunks/<name>.mp4, 2-3 chunk processes at a time.  Each chunk stores a
hash of its inputs in <name>.json: the shared code of this file (everything
above the first SEGMENT marker), the code block of every segment the chunk
touches (comments and blank lines ignored), the SCARE HELPERS block if that
code uses it, its frame range and shot timings, the encoder settings and the
bytes of every asset its shots use.  Unchanged chunks are skipped.  Every random number is drawn
from a generator seeded by the absolute frame number, so a frame renders the
same in any chunk or process.  Then the audio mix is built (build/mix.wav),
the chunks are concatenated with the ffmpeg concat demuxer (-c copy) and the
mix is muxed in.

Needs: numpy, Pillow, ffmpeg.
"""

import argparse
import hashlib
from types import SimpleNamespace
import json
import math
import os
import re
import subprocess
import sys
import time
import wave
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
CHUNK_DIR = os.path.join(BUILD, "chunks")
PREVIEW_DIR = os.path.join(BUILD, "preview")
OUTPUT = os.path.join(HERE, "the_world_of_poppy.mp4")

W, H, FPS, SR = 640, 480, 30, 44100
TOTAL = 309.4
NFRAMES = int(round(TOTAL * FPS))
SEED = 1995

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
MONO = os.path.join(FONT_DIR, "DejaVuSansMono-Bold.ttf")
SANS = os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf")

X264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "31", "-pix_fmt", "yuv420p",
        "-g", "60", "-threads", "2"]

MISSING = []          # assets that had to be replaced by placeholders

# --------------------------------------------------------------------------
# Storyboard timing
# --------------------------------------------------------------------------


def load_shots():
    txt = open(os.path.join(HERE, "STORYBOARD.md"), encoding="utf-8").read()
    m = re.search(r"## 9\. Machine-readable shot list.*?```json\s*(\[.*?\])\s*```", txt, re.S)
    shots = json.loads(m.group(1))
    for s in shots:
        s["f0"] = int(round(s["start"] * FPS))
        s["f1"] = int(round((s["start"] + s["dur"]) * FPS))
    for a, b in zip(shots, shots[1:]):
        assert a["f1"] == b["f0"], (a["id"], b["id"])
    assert shots[0]["f0"] == 0 and shots[-1]["f1"] == NFRAMES
    return shots


SHOTS = load_shots()
SHOT = {s["id"]: s for s in SHOTS}
_FRAME_SHOT = np.zeros(NFRAMES, np.int32)
for _k, _s in enumerate(SHOTS):
    _FRAME_SHOT[_s["f0"]:_s["f1"]] = _k


def T(sid):
    """Absolute start time of a shot."""
    return SHOT[sid]["start"]


# --------------------------------------------------------------------------
# Deterministic noise
# --------------------------------------------------------------------------


def h01(*k):
    d = hashlib.blake2b(repr(k).encode(), digest_size=8).digest()
    return int.from_bytes(d, "little") / 2.0 ** 64


def lfn(t, rate, key):
    """Smooth value noise in [-1, 1] (cosine-interpolated lattice)."""
    x = t * rate
    k = math.floor(x)
    f = x - k
    a = h01(key, k) * 2 - 1
    b = h01(key, k + 1) * 2 - 1
    u = (1 - math.cos(math.pi * f)) / 2
    return a + (b - a) * u


def lfn2(t, rate, key):
    return 0.7 * lfn(t, rate, key) + 0.3 * lfn(t, rate * 2.37, key + "~")


def ease(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def lerp(a, b, u):
    return a + (b - a) * u


# --------------------------------------------------------------------------
# Assets
# --------------------------------------------------------------------------

META = json.load(open(os.path.join(BUILD, "rooms", "rooms_meta.json")))
AMAN = json.load(open(os.path.join(BUILD, "audio", "manifest.json")))


def placeholder_img(rel, size=(640, 480)):
    im = Image.new("RGBA", size, (60, 0, 60, 255))
    d = ImageDraw.Draw(im)
    for k in range(0, size[0] + size[1], 40):
        d.line([(k, 0), (k - size[1], size[1])], fill=(120, 0, 120, 255), width=8)
    d.text((10, size[1] // 2), "MISSING " + os.path.basename(rel), font=font(MONO, 18), fill=(255, 255, 0, 255))
    return im


@lru_cache(None)
def asset(rel):
    """An image asset (path relative to poppy/) as RGBA, or a placeholder."""
    p = os.path.join(HERE, rel)
    try:
        im = Image.open(p)
        im.load()
        return im.convert("RGBA")
    except Exception as e:  # noqa: BLE001
        MISSING.append(f"{rel} ({e.__class__.__name__})")
        size = (420, 640) if "/poppy/" in rel and "close" not in rel and "scare" not in rel else (640, 480)
        return placeholder_img(rel, size)


def room(name):
    return asset(f"build/rooms/{name}.png")


def art(name):
    return f"build/art/poppy/{name}.png"


def misc(name):
    return f"build/art/misc/{name}.png"


_fonts = {}


def font(path, size):
    key = (path, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


# --------------------------------------------------------------------------
# Picture helpers
# --------------------------------------------------------------------------


def to_arr(img):
    return np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0


def to_pil(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))


def solid(c):
    a = np.empty((H, W, 3), np.float32)
    a[...] = c
    return a


def view(src, zoom=1.0, cx=0.5, cy=0.5, dx=0.0, dy=0.0, rot=0.0, blur=0.0):
    """Camera: crop a window of 1/zoom of the source around (cx, cy) (fractions of
    the source), offset by (dx, dy) output pixels, scale to 640x480, optionally
    rotate (degrees) and defocus.  Returns RGB PIL."""
    sw, sh = src.size
    zoom = max(1.0, zoom)
    ww, wh = sw / zoom, sh / zoom
    x0 = cx * sw - ww / 2 + dx * ww / W
    y0 = cy * sh - wh / 2 + dy * wh / H
    x0 = min(max(0.0, x0), sw - ww)
    y0 = min(max(0.0, y0), sh - wh)
    img = src.convert("RGB").resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + ww, y0 + wh))
    if rot:
        img = img.rotate(rot, resample=Image.BICUBIC)
        m = 0.012 + abs(math.sin(math.radians(rot))) * 0.75
        img = img.resize((W, H), Image.BICUBIC, box=(W * m, H * m, W * (1 - m), H * (1 - m)))
    if blur > 0.05:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    return img


def paste(base, spr, x, y):
    """alpha_composite spr onto base with its top-left at (x, y), clipped."""
    bw, bh = base.size
    sw, sh = spr.size
    x, y = int(round(x)), int(round(y))
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(sw, bw - x), min(sh, bh - y)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    base.alpha_composite(spr, dest=(x + sx0, y + sy0), source=(sx0, sy0, sx1, sy1))


@lru_cache(maxsize=600)
def sprite(rel, scale, sx=1.0, sy=1.0, tint=None, blur=0.0, bright=1.0, vgrad=None, invert=False, sat=1.0):
    """Scaled, graded cutout (premultiplied resize so edges stay clean)."""
    im = asset(rel)
    w = max(1, int(round(im.width * scale * sx)))
    h = max(1, int(round(im.height * scale * sy)))
    s = im.convert("RGBa").resize((w, h), Image.LANCZOS)
    if blur > 0:
        s = s.filter(ImageFilter.GaussianBlur(blur))
    s = s.convert("RGBA")
    if tint is not None or bright != 1.0 or vgrad is not None or invert or sat != 1.0:
        a = np.asarray(s, np.float32).copy()
        rgb = a[..., :3]
        if invert:
            rgb[...] = 255 - rgb
        if sat != 1.0:
            lum = (rgb @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
            rgb[...] = lum + (rgb - lum) * sat
        mul = np.array(tint if tint is not None else (1, 1, 1), np.float32) * bright
        rgb *= mul
        if vgrad is not None:
            g = np.linspace(vgrad[0], vgrad[1], h, dtype=np.float32)[:, None, None]
            rgb *= g
        s = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
    return s


@lru_cache(maxsize=64)
def blob(w, h, alpha, blur):
    """Soft black ellipse (contact shadow) as RGBA; returns (img, pad)."""
    pad = int(blur * 3) + 2
    m = Image.new("L", (w + 2 * pad, h + 2 * pad), 0)
    ImageDraw.Draw(m).ellipse([pad, pad, pad + w, pad + h], fill=int(255 * alpha))
    if blur > 0:
        m = m.filter(ImageFilter.GaussianBlur(blur))
    im = Image.new("RGBA", m.size, (0, 0, 0, 0))
    im.putalpha(m)
    return im, pad


FULL_FOOT = (210, 628)      # full-body canvas registration
FULL_HEAD = (210, 190)
NORMAL_S = 330 / 557.0      # 'normal on-mark size' in playroom_wide (head-top 71 .. feet 628)


def contact_shadow(base, foot, s, alpha=0.5):
    w, h = max(8, int(200 * s)), max(4, int(34 * s))
    im, pad = blob(w, h, alpha, max(1.5, 7 * s))
    paste(base, im, foot[0] - w / 2 - pad, foot[1] - h * 0.62 - pad)
    w2, h2 = max(6, int(140 * s)), max(3, int(14 * s))
    im2, pad2 = blob(w2, h2, alpha * 0.7, max(1.0, 2.5 * s))
    paste(base, im2, foot[0] - w2 / 2 - pad2, foot[1] - h2 * 0.7 - pad2)


def figure(base, rel, foot, s, tint=None, blur=0.6, shadow=0.5, dy=0, bright=1.0, vgrad=None,
           reg=FULL_FOOT, invert=False, sat=1.0):
    """Composite a cutout so that canvas point `reg` lands on `foot` at scale s."""
    if shadow:
        contact_shadow(base, foot, s, shadow)
    spr = sprite(rel, round(s, 4), tint=tint, blur=blur, bright=bright, vgrad=vgrad, invert=invert, sat=sat)
    paste(base, spr, foot[0] - reg[0] * s, foot[1] - reg[1] * s + dy)


@lru_cache(maxsize=32)
def drop_shadow_of(rel, scale, sx, sy, blur=2.0, alpha=0.35):
    spr = sprite(rel, scale, sx, sy)
    a = spr.getchannel("A").point(lambda v: int(v * alpha))
    sh = Image.new("RGBA", spr.size, (20, 10, 0, 0))
    sh.putalpha(a)
    pad = int(blur * 3)
    big = Image.new("RGBA", (spr.width + 2 * pad, spr.height + 2 * pad), (0, 0, 0, 0))
    big.paste(sh, (pad, pad))
    return big.filter(ImageFilter.GaussianBlur(blur)), pad


def bob(ctx, amp=1.0, period=2.6):
    """Idle bob, stepped at 6 fps (Poppy never moves smoothly)."""
    k = ctx.i // 5
    return int(round(amp * math.sin(2 * math.pi * k * 5 / FPS / period)))


@lru_cache(None)
def blurred_room(name, radius=6.0, bright=0.9):
    im = room(name).convert("RGB").filter(ImageFilter.GaussianBlur(radius))
    a = np.asarray(im, np.float32) * bright
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert("RGBA")


def closeup(room_name, rel, tint=None, room_blur=6.0, room_bright=0.9):
    base = blurred_room(room_name, room_blur, room_bright)
    if base.size != (W, H):
        base = base.resize((W, H), Image.LANCZOS)
    base = base.copy()
    paste(base, sprite(rel, 1.0, tint=tint, blur=0.4), 0, 0)
    return base


# ---- mouth flaps -------------------------------------------------------------

@lru_cache(None)
def env_open(name):
    """Per-frame mouth state from the voice envelope: open on the first frame
    the 20 ms RMS rises above -30 dBFS and stay open at least 3 frames; after
    that, close at syllable dips (6 dB under the local +-4 frame peak), so the
    mouth flaps per syllable instead of hanging open, and short leading
    syllables still get a mouth."""
    p = os.path.join(BUILD, "audio", name + ".env.json")
    try:
        e = json.load(open(p))
        d = e.get("db")
        if not d:
            return tuple(e["open"])
        thr = e.get("threshold_db", -30.0)
        out, run = [], 0
        for k, v in enumerate(d):
            if v <= thr:
                out.append(0)
                run = 0
                continue
            if run < 3:
                out.append(1)
                run += 1
                continue
            loc = max(d[max(0, k - 4):k + 5])
            o = int(v >= loc - 6.0)
            out.append(o)
            run = run + 1 if o else 0
        return tuple(out)
    except Exception:  # noqa: BLE001
        MISSING.append(f"build/audio/{name}.env.json")
        n = int(AMAN.get(f"build/audio/{name}.wav", {}).get("duration", 1.0) * FPS)
        return tuple(int((k // 4) % 2 == 0) for k in range(n))


@lru_cache(None)
def mouth(cues, lag=3, minhold=3, overrun=0):
    """Frames (absolute) where the talk frame shows.  cues = ((voice, t), ...).
    Talk while the voice's 20 ms RMS > -30 dBFS, 3 frames late, >= 3 frames per state."""
    marks = {}
    lo, hi = NFRAMES, 0
    for name, t in cues:
        f0 = int(round(t * FPS)) + lag
        ops = env_open(name)
        for k, o in enumerate(ops):
            if o:
                marks[f0 + k] = 1
        lo, hi = min(lo, f0), max(hi, f0 + len(ops))
    if not marks:
        return frozenset()
    n = hi - lo + overrun + 2
    st = [0] * n
    for f in marks:
        st[f - lo] = 1
    if overrun:
        last = max(marks) - lo
        for k in range(overrun):
            st[last + 1 + k] = 1 if (k // 3) % 2 == 1 else 0
    # minimum hold: runs shorter than `minhold` take the previous state
    k = 0
    while k < n:
        j = k
        while j < n and st[j] == st[k]:
            j += 1
        if j - k < minhold and k > 0:
            for q in range(k, j):
                st[q] = st[k - 1]
        k = j
    return frozenset(lo + k for k in range(n) if st[k])


# ---- text --------------------------------------------------------------------

YELLOW = (255, 225, 77)


def caption(img, text, color=YELLOW, dx=0, dy=0, y=440, size=24):
    """Sing-along caption: DejaVu Sans Bold, black outline, centred at y."""
    d = ImageDraw.Draw(img)
    f = font(SANS, size)
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2 + dx, y - size * 0.62 + dy), text, font=f, fill=color,
           stroke_width=3, stroke_fill=(0, 0, 0))


def text_c(d, y, text, f, fill=(255, 255, 255), shadow=None, cx=W / 2):
    w = d.textlength(text, font=f)
    if shadow:
        d.text((cx - w / 2 + shadow[0], y + shadow[1]), text, font=f, fill=shadow[2])
    d.text((cx - w / 2, y), text, font=f, fill=fill)


def wrap(text, f, width, d):
    lines, line = [], ""
    for word in text.split():
        test = (line + " " + word).strip()
        if d.textlength(test, font=f) > width and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines


def vcr_osd(a, left=None, right=None):
    """The playback VCR's own OSD: crisp, drawn after the tape degradation."""
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    f = font(MONO, 30)
    if left:
        d.text((42, 34), left, font=f, fill=(0, 0, 0))
        d.text((40, 32), left, font=f, fill=(240, 240, 240))
    if right:
        w = d.textlength(right, font=f)
        d.text((W - 40 - w + 2, 34), right, font=f, fill=(0, 0, 0))
        d.text((W - 40 - w, 32), right, font=f, fill=(240, 240, 240))
    return to_arr(img)


def tracking_osd(a, fill):
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    f = font(MONO, 22)
    text_c(d, 380, "TRACKING", f, fill=(240, 240, 240), shadow=(2, 2, (0, 0, 0)))
    n, bw, gap = 16, 18, 5
    x0 = (W - (n * bw + (n - 1) * gap)) / 2
    k = int(round(fill * n))
    for j in range(n):
        x = x0 + j * (bw + gap)
        d.rectangle([x + 2, 414, x + bw + 2, 432], fill=(0, 0, 0))
        if j < k:
            d.rectangle([x, 412, x + bw, 430], fill=(240, 240, 240))
        else:
            d.rectangle([x, 412, x + bw, 430], outline=(240, 240, 240), width=2)
    return to_arr(img)


@lru_cache(maxsize=16)
def _cam_osd_layers(clock, rec_on, dot_on):
    """Camcorder OSD at 1/3 resolution, no anti-aliasing, upscaled 3x nearest."""
    w3, h3 = (W + 2) // 3, H // 3
    white = Image.new("L", (w3, h3), 0)
    red = Image.new("L", (w3, h3), 0)
    dw, dr = ImageDraw.Draw(white), ImageDraw.Draw(red)
    dw.fontmode = "1"
    f = font(MONO, 11)
    if rec_on:
        if dot_on:
            dr.ellipse([8, 8, 15, 15], fill=255)
        dw.text((19, 5), "REC", font=f, fill=255)
    dw.text((w3 - 52, 5), "SP", font=f, fill=255)
    bx, by = w3 - 30, 7
    dw.rectangle([bx, by, bx + 17, by + 8], outline=255)
    dw.rectangle([bx + 18, by + 2, bx + 19, by + 6], fill=255)
    for k in range(3):
        dw.rectangle([bx + 2 + k * 5, by + 2, bx + 5 + k * 5, by + 6], fill=255)
    dw.text((8, h3 - 18), "JUN 14 1996", font=f, fill=255)
    tw = dw.textlength(clock, font=f)
    dw.text((w3 - 8 - tw, h3 - 18), clock, font=f, fill=255)
    up = lambda m: np.asarray(m.resize((w3 * 3, h3 * 3), Image.NEAREST), np.float32)[:H, :W] / 255.0
    wm, rm = up(white), up(red)
    allm = np.maximum(wm, rm)
    shadow = np.zeros_like(allm)
    shadow[2:, 2:] = allm[:-2, :-2]
    return wm, rm, shadow


def cam_osd(a, t, clock, jx=0, jy=0):
    rec_dot = (t % 1.0) < 0.5
    wm, rm, sh = _cam_osd_layers(clock, True, rec_dot)
    if jx or jy:
        wm, rm, sh = (np.roll(np.roll(m, jy, 0), jx, 1) for m in (wm, rm, sh))
    out = a * (1 - 0.8 * sh[..., None])
    out = out * (1 - wm[..., None]) + wm[..., None] * np.array([0.95, 0.95, 0.92], np.float32)
    out = out * (1 - rm[..., None]) + rm[..., None] * np.array([0.95, 0.12, 0.1], np.float32)
    return out


# ---- generated pictures --------------------------------------------------------


@lru_cache(None)
def color_bars():
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    top = [(191, 191, 191), (191, 191, 0), (0, 191, 191), (0, 191, 0),
           (191, 0, 191), (191, 0, 0), (0, 0, 191)]
    mid = [(0, 0, 191), (19, 19, 19), (191, 0, 191), (19, 19, 19),
           (0, 191, 191), (19, 19, 19), (191, 191, 191)]
    bw = W / 7
    for i, (a, b) in enumerate(zip(top, mid)):
        d.rectangle([i * bw, 0, (i + 1) * bw, H * 0.67], fill=a)
        d.rectangle([i * bw, H * 0.67, (i + 1) * bw, H * 0.75], fill=b)
    bottom = [(0, 33, 76), (255, 255, 255), (50, 0, 106), (19, 19, 19),
              (9, 9, 9), (19, 19, 19), (29, 29, 29), (19, 19, 19)]
    widths = [1.25, 1.25, 1.25, 1.25, 1 / 3, 1 / 3, 1 / 3, 1]
    x = 0
    for c, w in zip(bottom, widths):
        d.rectangle([x, H * 0.75, x + w * bw, H], fill=c)
        x += w * bw
    d.rectangle([52, 268, W - 52, 306], fill=(0, 0, 0))
    text_c(d, 274, "SMV-0417   THE WORLD OF POPPY   VOL. 4", font(MONO, 22), fill=(235, 235, 235))
    return to_arr(img)


def static_img(rng, level=1.0):
    n = rng.random((H, W // 2), dtype=np.float32)
    n = np.repeat(n, 2, 1)
    n *= 0.55 + 0.45 * rng.random((H, 1), dtype=np.float32)
    return np.repeat(n[..., None], 3, 2) * level


NAVY = (16, 26, 74)


@lru_cache(None)
def home_card():
    img = Image.new("RGBA", (W, H), NAVY + (255,))
    d = ImageDraw.Draw(img)
    for y in range(H):        # gentle vertical gradient
        c = 1.0 - 0.25 * y / H
        d.line([(0, y), (W, y)], fill=(int(NAVY[0] * c), int(NAVY[1] * c), int(NAVY[2] * c * 1.1), 255))
    d.rectangle([14, 14, W - 15, H - 15], outline=(242, 194, 48, 255), width=3)
    d.rectangle([22, 22, W - 23, H - 23], outline=(120, 140, 220, 255), width=1)
    logo = asset(misc("sm_logo"))
    paste(img, logo, (W - logo.width) // 2, 40)
    sh = (2, 2, (0, 0, 20))
    text_c(d, 214, "THE WORLD OF POPPY", font(SANS, 34), fill=(255, 225, 77), shadow=sh)
    text_c(d, 260, "VOLUME 4: COUNTING WITH POPPY", font(SANS, 24), fill=(255, 255, 255), shadow=sh)
    text_c(d, 312, "© 1995 SUNNY MEADOW HOME VIDEO", font(SANS, 19), fill=(225, 230, 255), shadow=sh)
    text_c(d, 342, "FOR HOME VIEWING ONLY", font(SANS, 19), fill=(225, 230, 255), shadow=sh)
    text_c(d, 392, "BE KIND, PLEASE REWIND!", font(SANS, 24), fill=(255, 225, 77), shadow=sh)
    return img


@lru_cache(maxsize=64)
def _title_text(text, size=52):
    f = font(SANS, size)
    d = ImageDraw.Draw(Image.new("RGB", (4, 4)))
    w = int(d.textlength(text, font=f)) + 24
    img = Image.new("RGBA", (w, size + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.text((14, 10), text, font=f, fill=(110, 10, 16, 255), stroke_width=4, stroke_fill=(110, 10, 16, 255))
    d.text((12, 6), text, font=f, fill=(215, 38, 43, 255), stroke_width=4, stroke_fill=(255, 214, 40, 255))
    return img


def bumper(lines, lt):
    """bumper_bg with red title lines bouncing into the panel."""
    base = asset(misc("bumper_bg")).copy()
    n = len(lines)
    for k, line in enumerate(lines):
        u = lt - 0.06 - 0.16 * k
        if u < 0:
            continue
        ty = 240 + (k - (n - 1) / 2) * 64
        if u < 0.22:                       # falls in
            y = ty - 300 * (1 - u / 0.22) ** 2
            sx, sy = 0.9, 1.12
        else:
            v = u - 0.22
            y = ty - 26 * math.exp(-v * 7) * abs(math.sin(v * 15))
            sq = math.exp(-v * 9)
            sx, sy = 1 + 0.18 * sq, 1 - 0.22 * sq
        im = _title_text(line)
        im = im.resize((max(1, int(im.width * sx)), max(1, int(im.height * sy))), Image.BICUBIC)
        paste(base, im, W / 2 - im.width / 2, y - im.height / 2)
    return base


ADVISORY = {
    "A": dict(header="A MESSAGE FROM SUNNY MEADOW HOME VIDEO",
              body="THIS VIDEOCASSETTE WAS RECALLED IN 1996. IF YOU ARE WATCHING IT, PLEASE STOP THE TAPE."),
    "B": dict(body="IF POPPY ASKS WHERE YOU LIVE, DO NOT ANSWER."),
    "C": dict(body="IF POPPY IS IN YOUR HOME, DO NOT COUNT WITH HER."),
    "D": dict(body="SHE ALWAYS FINDS YOU ON TEN.", black=True, size=40),
    "E": dict(body="THANK YOU FOR WATCHING SUNNY MEADOW HOME VIDEO. PLEASE STOP THE TAPE."),
}


@lru_cache(maxsize=256)
def advisory_card(key, nchars, cursor):
    c = ADVISORY[key]
    black = c.get("black", False)
    size = c.get("size", 26)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255) if black else NAVY + (255,))
    d = ImageDraw.Draw(img)
    f = font(MONO, size)
    top, bottom = 196, 440
    if not black:
        for y in range(H):
            k = 1.0 - 0.22 * y / H
            d.line([(0, y), (W, y)], fill=(int(NAVY[0] * k), int(NAVY[1] * k), int(NAVY[2] * k * 1.1), 255))
        d.rectangle([14, 14, W - 15, H - 15], outline=(120, 140, 220, 255), width=2)
        logo = asset(misc("sm_logo"))
        logo = logo.resize((int(logo.width * 0.72), int(logo.height * 0.72)), Image.LANCZOS)
        paste(img, logo, (W - logo.width) // 2, 26)
        if c.get("header"):
            d.rectangle([0, 150, W, 188], fill=(242, 194, 48, 255))
            text_c(d, 157, c["header"], font(MONO, 20), fill=NAVY)
            top = 214
    else:
        top, bottom = 120, 360
    lines = wrap(c["body"], f, W - 110, d)
    lh = size + 14
    y = (top + bottom) / 2 - len(lines) * lh / 2
    budget = nchars
    cur_xy = None
    # teleprinter style: lines left-aligned inside a centred block, so the
    # cursor starts every new line at the same left edge as the text above
    x = (W - max(d.textlength(ln, font=f) for ln in lines)) / 2
    for line in lines:
        shown = line[:max(0, budget)]
        if shown:
            d.text((x + 2, y + 2), shown, font=f, fill=(0, 0, 0, 255))
            d.text((x, y), shown, font=f, fill=(255, 255, 255, 255))
        if 0 <= budget <= len(line) and cur_xy is None:
            cur_xy = (x + d.textlength(shown, font=f), y)
        budget -= len(line) + 1
        y += lh
    if cursor and cur_xy is not None:
        d.rectangle([cur_xy[0] + 2, cur_xy[1] + 3, cur_xy[0] + size * 0.6, cur_xy[1] + size + 2],
                    fill=(255, 255, 255, 255))
    return img


def advisory_frame(key, lt):
    total = len(ADVISORY[key]["body"])
    n = int(max(0.0, lt - 0.35) * 25)
    typing = n < total
    cursor = typing or (int(lt * 2.5) % 2 == 0)
    return advisory_card(key, min(n, total), cursor)


def persp_coeffs(dst, src):
    """PIL PERSPECTIVE data mapping output points `dst` to input points `src`."""
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        B.append(v)
    return tuple(np.linalg.solve(np.array(A, float), np.array(B, float)))


# --------------------------------------------------------------------------
# VHS
# --------------------------------------------------------------------------

YW = np.array([0.299, 0.587, 0.114], np.float32)
_yy, _xx = np.mgrid[0:H, 0:W]
VIGNETTE = np.clip(1 - 0.32 * (((_xx - W / 2) / (W / 2)) ** 2 + ((_yy - H / 2) / (H / 2)) ** 2) ** 1.5,
                   0.2, 1).astype(np.float32)
ROWS = np.arange(H)
COLS = np.arange(W)

LEVELS = {
    # V0 CLEAN: scare frames only
    "V0": dict(noise=0.015, jitter=0.2, chroma=2, drop_p=0.0, drop_n=(0, 0), sat=1.0, lift=0.03, clip=1.0,
               ring=0.0, unsharp=0.6, flag=(0, 0), wobble=0.3, track=0.0, itrack=0.0, hops=0.0,
               tint=(1.0, 1.0, 1.0), luma_k=1, chroma_k=5, bleed=0.75, blot=0.0, head=0, scan=0.95, vig=0.5),
    # V1 light (Act 1)
    "V1": dict(noise=0.03, jitter=0.6, chroma=3, drop_p=0.15, drop_n=(0, 1), sat=0.85, lift=0.06, clip=0.93,
               ring=0.5, unsharp=0.0, flag=(8, 5), wobble=0.8, track=0.0, itrack=0.0, hops=0.0,
               tint=(1.04, 1.0, 0.94), luma_k=3, chroma_k=15, bleed=0.88, blot=0.03, head=7, scan=0.9, vig=1.0),
    "V2": dict(noise=0.05, jitter=1.0, chroma=4, drop_p=0.25, drop_n=(0, 2), sat=0.75, lift=0.07, clip=0.92,
               ring=0.5, unsharp=0.0, flag=(12, 15), wobble=1.2, track=0.0, itrack=0.0, hops=0.0,
               tint=(1.02, 1.0, 0.96), luma_k=3, chroma_k=15, bleed=0.88, blot=0.03, head=9, scan=0.9, vig=1.0),
    "V3": dict(noise=0.08, jitter=1.6, chroma=6, drop_p=0.4, drop_n=(2, 5), sat=0.65, lift=0.08, clip=0.92,
               ring=0.6, unsharp=0.0, flag=(20, 20), wobble=1.6, track=0.0, itrack=0.3, hops=0.04,
               tint=(1.0, 1.0, 1.0), luma_k=3, chroma_k=17, bleed=0.88, blot=0.04, head=12, scan=0.88, vig=1.0),
    "V4": dict(noise=0.14, jitter=3.0, chroma=9, drop_p=0.9, drop_n=(4, 8), sat=0.8, lift=0.08, clip=0.92,
               ring=0.6, unsharp=0.0, flag=(20, 25), wobble=2.0, track=1.0, itrack=0.0, hops=0.1,
               tint=(1.0, 1.0, 1.0), luma_k=3, chroma_k=21, bleed=0.9, blot=0.05, head=16, scan=0.86, vig=1.0),
}
GREEN = (0.86, 1.02, 0.84)


def level(lv, ep=False, **ov):
    P = dict(LEVELS[lv])
    P.update(rainbow=0.0, roll=0, drops=None, drop_add=0, track_y=None)
    if ep:   # EP tape speed (camcorder): softer, noisier, more dropouts, green
        P.update(noise=P["noise"] * 1.6, luma_k=5, chroma_k=25, drop_add=2, tint=GREEN,
                 drop_p=max(P["drop_p"], 0.2))
    P.update(ov)
    return P


def mix_levels(a, b, u, ep=False, **ov):
    """Interpolate numeric parameters between two levels (for V2 -> V3 shots)."""
    A, B = level(a, ep), level(b, ep)
    P = dict(B if u >= 0.5 else A)
    for k, v in A.items():
        if isinstance(v, (int, float)) and not isinstance(v, bool) and isinstance(B[k], (int, float)):
            P[k] = lerp(v, B[k], u) if isinstance(v, float) or isinstance(B[k], float) else int(round(lerp(v, B[k], u)))
    P["flag"] = tuple(int(round(lerp(x, y, u))) for x, y in zip(A["flag"], B["flag"]))
    P["drop_n"] = tuple(int(round(lerp(x, y, u))) for x, y in zip(A["drop_n"], B["drop_n"]))
    P["tint"] = tuple(lerp(x, y, u) for x, y in zip(A["tint"], B["tint"]))
    P.update(ov)
    return P


def hblur(x, k):
    """Horizontal box blur (axis 1) of width k."""
    k = int(k)
    if k <= 1:
        return x
    pw = [(0, 0)] * x.ndim
    pw[1] = (k // 2 + 1, k - k // 2 - 1)
    c = np.cumsum(np.pad(x, pw, mode="edge"), axis=1, dtype=np.float32)
    return (c[:, k:] - c[:, :-k]) / k


def vblur(x, k):
    return hblur(x.swapaxes(0, 1), k).swapaxes(0, 1)


def bleed_right(C, b):
    """One-sided (rightward) IIR chroma smear, run at 1/4 horizontal resolution."""
    d = C.reshape(H, W // 4, 4, C.shape[2]).mean(2)
    a = b ** 4
    out = np.empty_like(d)
    acc = d[:, 0].copy()
    for n in range(d.shape[1]):
        acc *= a
        acc += (1 - a) * d[:, n]
        out[:, n] = acc
    return hblur(np.repeat(out, 4, 1), 4)


def dropout_count(ctx, P):
    if P["drops"] is not None:
        return P["drops"]
    if P["drop_p"] <= 0:
        return 0
    win = ctx.i // 4
    if h01("dropwin", win) >= P["drop_p"]:
        return 0
    lo, hi = P["drop_n"]
    n = lo + int(h01("dropn", ctx.i) * (hi - lo + 1))
    return n + (P["drop_add"] if n > 0 or P["drop_add"] and h01("dropx", ctx.i) < 0.5 else 0)


def draw_dropouts(out, n, rng):
    for _ in range(n):
        y0 = int(rng.integers(6, H - 14))
        x0 = int(rng.integers(0, W - 24))
        L = int(10 + 110 * rng.random() ** 2)
        hh = 1 + int(rng.random() < 0.4)
        x1 = min(W, x0 + L)
        kind = rng.random()
        if kind < 0.5:
            val = 0.9 + 0.1 * rng.random()
            out[y0:y0 + hh, x0:x1] = val
            tail_val = val
        elif kind < 0.82:
            out[y0:y0 + hh, x0:x1] = np.clip(out[y0 - 1, x0:x1] * 1.15 + 0.08, 0, 1)
            tail_val = 0.95
        else:
            out[y0:y0 + hh, x0:x1] = 0.04
            tail_val = 0.03
        tl = int(8 + 34 * rng.random())
        x2 = min(W, x1 + tl)
        if x2 > x1:
            r = (np.linspace(1, 0, x2 - x1, dtype=np.float32) ** 1.6 * 0.85)[None, :, None]
            out[y0:y0 + hh, x1:x2] = out[y0:y0 + hh, x1:x2] * (1 - r) + tail_val * r


def vhs(a, ctx, lv="V1", ep=False, P=None, **ov):
    """Make a clean frame look like it came off a worn VHS tape.  Levels V0-V4
    (see STORYBOARD section 4), EP tape speed, plus overrides."""
    if P is None:
        P = level(lv, ep, **ov)
    rng = ctx.rng
    t = ctx.t
    a = np.asarray(a, np.float32)
    y = a @ YW
    cb = a[..., 2] - y
    cr = a[..., 0] - y

    # ---- luma: bandwidth, unsharp (V0), edge ringing (halo right of dark edges)
    if P["unsharp"]:
        y = y + P["unsharp"] * (y - vblur(hblur(y, 3), 3))
    y = hblur(y, P["luma_k"])
    if P["ring"]:
        y = y + P["ring"] * np.roll(y - hblur(y, 7), 2, 1)

    # ---- chroma: low bandwidth, rightward bleed, delay, blotches, rainbow
    C = np.stack([cb, cr], -1)
    C = hblur(C, P["chroma_k"])
    C = bleed_right(C, P["bleed"])
    C = np.roll(C, P["chroma"], 1)
    if P["blot"]:
        small = rng.normal(0, P["blot"], (H // 8, W // 8, 2)).astype(np.float32)
        C += hblur(np.repeat(np.repeat(small, 8, 0), 8, 1), 9)
    if P["rainbow"]:
        th = 2 * np.pi * (ROWS / H * 2.5 + t * 5.0)
        r = P["rainbow"]
        c, s = np.cos(th)[:, None], np.sin(th)[:, None]
        cb2 = C[..., 0] * c - C[..., 1] * s + r * 0.32 * c
        cr2 = C[..., 0] * s + C[..., 1] * c + r * 0.32 * s
        C = np.stack([cb2, cr2], -1)

    # ---- grain: horizontally streaky noise plus per-line noise
    nz = P["noise"]
    g = rng.standard_normal((H, W // 2), dtype=np.float32)
    y = y + nz * np.repeat(g, 2, 1)
    y = y + (nz * 0.5) * rng.standard_normal((H, 1), dtype=np.float32)

    s = P["sat"]
    out = np.empty((H, W, 3), np.float32)
    out[..., 0] = y + s * C[..., 1]
    out[..., 2] = y + s * C[..., 0]
    out[..., 1] = y - s * (0.194 * C[..., 0] + 0.509 * C[..., 1])
    out *= np.asarray(P["tint"], np.float32)

    # ---- dropouts (clustered bursts; logged so the audio can dip with them)
    nd = dropout_count(ctx, P)
    if nd:
        draw_dropouts(out, nd, rng)
    if ctx.ev is not None:
        ctx.ev["drop"] = ctx.ev.get("drop", 0) + nd

    # ---- timebase: line jitter, frame wobble, top-edge flagging, head switching
    offs = rng.normal(0, 0.6 * P["jitter"], H) + 0.75 * P["jitter"] * np.sin(t * 7 + ROWS / 40)
    offs += P["wobble"] * lfn2(t, 0.6, "wobble")
    nfl, amp = P["flag"]
    if nfl:
        k = np.arange(nfl)
        offs[:nfl] += amp * ((nfl - k) / nfl) ** 2 * (0.55 + 0.45 * lfn(t, 1.3, "flag"))
    hs = P["head"]
    if hs:
        offs[-hs:] += rng.integers(6, 14 + 2 * hs, hs)

    # ---- tracking band (scripted) or intermittent band (V3)
    tr = P["track"]
    itr = 0.0
    if P["itrack"]:
        slot = int(t / 1.5)
        if h01("itrk", slot) < 0.28:
            itr = P["itrack"]
            if ctx.ev is not None:
                ctx.ev["trk"] = 1
    tr = max(tr, itr)
    band = None
    if tr > 0:
        centre = P["track_y"] if P["track_y"] is not None else (t * 220) % (H + 120) - 60
        band = np.abs(ROWS - centre) < 20 * tr + 4
        nb = int(band.sum())
        if nb:
            offs[band] += rng.integers(5, 40, nb)

    idx = COLS[None, :] - np.round(offs).astype(np.int32)[:, None]
    oob = (idx < 0) | (idx >= W)
    out = out[ROWS[:, None], np.clip(idx, 0, W - 1)]
    out[oob] = 0.02
    if hs:
        out[-hs:] = out[-hs:] * 0.6 + rng.random((hs, W, 1), dtype=np.float32) * 0.35
    if band is not None and band.any():
        nb = int(band.sum())
        out[band] = out[band] * 0.5 + rng.random((nb, W // 4, 1), dtype=np.float32).repeat(4, 1) * 0.6 * tr

    # ---- vertical: hops and roll
    if P["hops"] and rng.random() < P["hops"]:
        out = np.roll(out, 1, 0)
        out[0] = 0.02
    roll = int(P["roll"]) % H if P["roll"] else 0
    if roll:
        out = np.roll(out, roll, 0)

    # ---- levels, scanlines, vignette
    out = P["lift"] + out * (1 - P["lift"])
    np.minimum(out, P["clip"], out=out)
    out[1::2] *= P["scan"]
    out *= VIGNETTE[..., None] ** P["vig"]
    if roll:
        for r in range(roll - 25, roll):
            out[r % H] = 0.01
    return np.clip(out, 0, 1)


def black(ctx):
    return solid((0.0, 0.0, 0.0))


# --------------------------------------------------------------------------
# Shot registry
# --------------------------------------------------------------------------

SHOT_FN = {}


def shot(*ids):
    def deco(fn):
        for s in ids:
            SHOT_FN[s] = fn
        return fn
    return deco


class Ctx:
    __slots__ = ("i", "t", "lt", "lf", "dur", "nf", "sid", "rng", "ev")

    def __init__(self, i, ev=None):
        s = SHOTS[_FRAME_SHOT[i]]
        self.i = i
        self.t = i / FPS
        self.sid = s["id"]
        self.lf = i - s["f0"]
        self.nf = s["f1"] - s["f0"]
        self.lt = self.lf / FPS
        self.dur = s["dur"]
        self.rng = np.random.default_rng([SEED, i])
        self.ev = ev


def handheld(t, amp=6.0, rot=0.6, key="hh"):
    return (amp * lfn2(t, 0.45, key + "x"), amp * lfn2(t, 0.38, key + "y"), rot * lfn2(t, 0.3, key + "r"))


def exposure(t, lo=0.7, hi=1.0):
    return lerp(lo, hi, 0.5 + 0.5 * lfn2(t, 0.3, "expo"))


THEME_LYRICS = AMAN.get("build/audio/mus_theme.wav", {}).get("lyrics", [])
REPRISE_LYRICS = AMAN.get("build/audio/mus_reprise.wav", {}).get("lyrics", [])


def lyric(t, lyrics, t0, until):
    cur = None
    for s, txt in lyrics:
        if t >= t0 + s:
            cur = txt
    return cur if t < until else None


# ===== SCARE HELPERS =====
# Scare-pass compositing (SCARE_PASS.md section 5.1): hidden figures, boil
# frames, scare-frame framing, subliminal luminance caps.  This block is hashed
# into a chunk only when the chunk's segment code uses one of its names.

HID = "build/art/poppy/hidden_poppy_stand.png"
HID_REG = (120.0, 630.0)                 # feet, bottom centre of the 240x640 canvas
HID_FULL = 579.0                         # feet (y 631) to the top of the petal ring (y 52)
HID_GLINTS = ((103.5, 175.3), (159.5, 175.3))


def lum(a):
    return a @ YW


@lru_cache(maxsize=48)
def _hidden_layers(rel, scale, blur, mirror):
    """Alpha (blurred, padded) and a 0-1 'detail' map (the art's rim light and
    petal ring, brighter than its near-black body) of a cutout at `scale`."""
    im = asset(rel)
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = max(1, int(round(im.width * scale))), max(1, int(round(im.height * scale)))
    s = im.convert("RGBa").resize((w, h), Image.LANCZOS)
    pad = int(blur * 3) + 3
    big = Image.new("RGBa", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    big.paste(s, (pad, pad))
    if blur > 0:
        big = big.filter(ImageFilter.GaussianBlur(blur))
    arr = np.asarray(big.convert("RGBA"), np.float32) / 255.0
    detail = np.clip((lum(arr[..., :3]) - 0.045) / 0.2, 0, 1)
    return arr[..., 3].copy(), detail, pad


def _soft_dot(a, x, y, r, val, tint=(1.0, 1.0, 1.0)):
    """Add a small gaussian highlight (peak `val`) centred at (x, y)."""
    hh, ww = a.shape[:2]
    x0, x1 = max(0, int(x - 4 * r - 1)), min(ww, int(x + 4 * r + 2))
    y0, y1 = max(0, int(y - 4 * r - 1)), min(hh, int(y + 4 * r + 2))
    if x1 <= x0 or y1 <= y0:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    g = np.exp(-(((xx - x) ** 2 + (yy - y) ** 2) / (2 * r * r)))[..., None]
    a[y0:y1, x0:x1] += g * val * np.asarray(tint, np.float32)


def hidden(a, foot, height_px, blur=3.0, delta=0.06, glint=0.10, clip=None, mirror=False,
           rel=HID, reg=HID_REG, full_h=HID_FULL, glints=HID_GLINTS, glint_r=None, detail_k=0.8, mul=None):
    """Composite a hidden figure into the float room array `a` (its own pixel
    space), in place.  The figure is opaque and graded to the room: one flat
    luma = the mean luma of what it covers + `delta` (negative = a silhouette
    against a lit window), tinted with the local hue, its rim and petal ring
    up to `detail_k` x delta brighter; blurred `blur` px.  With `mul` it is a
    silhouette against light instead: what is behind it darkened by that
    fraction, so the glass keeps its gradient.  The eye glints are
    drawn after the blur, `glint` above the background.  `clip` (same size as
    `a`, 1 = visible) cuts it behind occluders.  Returns (mask, bg_luma)."""
    s = height_px / full_h
    alpha, detail, pad = _hidden_layers(rel, round(s, 4), round(blur, 2), mirror)
    cw = asset(rel).width
    rx = (cw - reg[0]) if mirror else reg[0]
    x0 = int(round(foot[0] - rx * s)) - pad
    y0 = int(round(foot[1] - reg[1] * s)) - pad
    hh, ww = a.shape[:2]
    ax0, ay0 = max(0, x0), max(0, y0)
    ax1, ay1 = min(ww, x0 + alpha.shape[1]), min(hh, y0 + alpha.shape[0])
    if ax1 <= ax0 or ay1 <= ay0:
        return None, 0.0
    al = alpha[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0]
    de = detail[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0]
    if clip is not None:
        al = al * clip[ay0:ay1, ax0:ax1]
    reg_a = a[ay0:ay1, ax0:ax1]
    wsum = float(al.sum())
    if wsum < 1e-3:
        return None, 0.0
    bgc = (reg_a * al[..., None]).sum((0, 1)) / wsum                   # mean colour behind it
    bgl = float(lum(bgc))
    hue = (bgc + 0.02) / (bgl + 0.02)
    if mul is not None:
        fig = reg_a * (1.0 - mul * (1.0 + detail_k * de))[..., None]
    else:
        tl = np.clip(bgl + delta * (1.0 + detail_k * de), 0, 1)
        fig = tl[..., None] * hue
    a[ay0:ay1, ax0:ax1] = reg_a * (1 - al[..., None]) + fig * al[..., None]
    if glint:
        r = glint_r if glint_r is not None else max(0.6, 2.2 * s)
        for gx, gy in glints:
            gx = (cw - gx) if mirror else gx
            px, py = foot[0] + (gx - rx) * s, foot[1] + (gy - reg[1]) * s
            if clip is None or clip[min(hh - 1, max(0, int(py))), min(ww - 1, max(0, int(px)))] > 0.5:
                _soft_dot(a, px, py, r, glint)
    full = np.zeros(a.shape[:2], np.float32)
    full[ay0:ay1, ax0:ax1] = al
    return full, bgl


def boil(ctx, rel_a, rel_b, every=4):
    """Scare-face boil: the drawing and its re-hatched _b frame alternate every
    4 frames (7.5 fps), so the hatched shadows crawl."""
    return rel_a if (ctx.lf // every) % 2 == 0 else rel_b


LOOM_FROM = 0.62          # a scare face lunges from 0.62x to full size over its first 3 frames
SNAP_DEG = 10.0           # the 2-frame head snap at ~55 % of the shot


@lru_cache(maxsize=8)
def _padded(rel):
    """The 800x600 scare art centred on a 1600x1200 black canvas, its outer
    60 px faded to black, for the loom frames (where the face is smaller than
    the frame)."""
    a = to_arr(asset(rel))
    hh, ww = a.shape[:2]
    ex = np.minimum(np.arange(ww), np.arange(ww)[::-1]).astype(np.float32)
    ey = np.minimum(np.arange(hh), np.arange(hh)[::-1]).astype(np.float32)
    a = a * (np.clip(ey / 60.0, 0, 1)[:, None] * np.clip(ex / 60.0, 0, 1)[None, :])[..., None]
    P = np.zeros((hh * 2, ww * 2, 3), np.float32)
    P[hh // 2:hh // 2 + hh, ww // 2:ww // 2 + ww] = a
    return to_pil(P)


def scare_framing(ctx, rel_a, rel_b, fill, face_h, centre, z1, shake, swap=None):
    """A scare face (800x600 art, face `face_h` px tall centred at `centre`)
    scaled so the face fills `fill` of the frame height, pushing to z1x and
    shaking +-shake px, boiling.  It MOVES: it looms from 0.62x to full size
    over the first 3 frames (ease-out, zoom-blurred), and the head snaps
    SNAP_DEG for 2 frames at ~55 %.  swap = (frame, rel_c, rel_d) switches to
    another boil pair from that frame on.  Returns the clean float frame."""
    lf = ctx.lf
    z0 = max(1.0, fill * 600.0 / face_h)
    z = z0 * lerp(1.0, z1, ctx.lt / ctx.dur)
    dx, dy = ctx.rng.uniform(-shake, shake, 2)
    if swap and lf >= swap[0]:
        rel_a, rel_b = swap[1], swap[2]
    rel = boil(ctx, rel_a, rel_b)
    snap = int(round(0.55 * ctx.nf))
    rot = SNAP_DEG * (1.0 if h01("snap", ctx.sid) < 0.5 else -1.0) if snap <= lf < snap + 2 else 0.0
    cx, cy = centre[0] / 800.0, centre[1] / 600.0
    if lf >= 3:
        return to_arr(view(asset(rel), z, cx, cy, dx, dy, rot))
    u = 1.0 - (1.0 - (lf + 1) / 3.0) ** 2                  # ease-out: 0.56, 0.89, 1.0
    k = lerp(LOOM_FROM, 1.0, u)
    src = _padded(rel)
    pcx, pcy = (200.0 + centre[0]) / 1600.0, (150.0 + centre[1]) / 1200.0
    # zoom blur: the lunge smeared outward from the centre (less on the landing frame)
    spread = (0.10, 0.06, 0.025)[lf]
    acc = None
    for j in range(5):
        a = to_arr(view(src, 2.0 * z * k * (1.0 + spread * j / 4.0), pcx, pcy, dx, dy))
        acc = a if acc is None else acc + a
    return acc / 5.0


def scare_level(ctx, clean_frac, to="V3", ep=False):
    """V0 CLEAN while the face registers, then the tape degrades into the cut:
    the last (1 - clean_frac) of the shot ramps V0 -> `to`.  No flashing."""
    u = (ctx.lt / ctx.dur - clean_frac) / max(1e-3, 1 - clean_frac)
    A = level("V0")
    if u <= 0:
        return A
    u = ease(u)
    B = level(to, ep)
    P = dict(B if u >= 0.5 else A)
    for k, v in A.items():
        w = B[k]
        if isinstance(v, (int, float)) and not isinstance(v, bool) and isinstance(w, (int, float)):
            P[k] = lerp(v, w, u) if isinstance(v, float) or isinstance(w, float) else int(round(lerp(v, w, u)))
        elif isinstance(v, tuple) and isinstance(w, tuple) and len(v) == len(w):
            P[k] = tuple(lerp(x, y, u) for x, y in zip(v, w))
    P["flag"] = tuple(int(round(x)) for x in P["flag"])
    P["drop_n"] = tuple(int(round(x)) for x in P["drop_n"])
    P.update(drops=int(round(3 * u)), itrack=0.0, hops=0.0)
    return P


def lum_cap(a, ref, max_delta=0.15):
    """Scale a subliminal frame so its mean luma is within `max_delta` of `ref`
    (no full-frame flash; SCARE_PASS photosensitivity rule)."""
    m = float(lum(a).mean())
    lo, hi = max(0.0, ref - max_delta), ref + max_delta
    if m > hi:
        return a * (hi / max(1e-4, m))
    if m < lo:
        return a + (lo - m)
    return a


# ===== SEGMENT 1 =====
# TAPE START: black, VCR blue, tracking lock, colour bars, ident, home-viewing card, edit point

VCR_BLUE = (0.08, 0.08, 0.75)


@shot("1a")
def s1a(ctx):
    return black(ctx)


@shot("1b")
def s1b(ctx):
    a = vhs(solid(VCR_BLUE), ctx, "V1", drops=0, tint=(1, 1, 1), sat=1.0, vig=0.4, flag=(0, 0))
    return vcr_osd(a, "PLAY ▶", f"0:00:{int(ctx.lt):02d}")


@shot("1c")
def s1c(ctx):
    sn = static_img(ctx.rng)
    sn = np.roll(sn, int(ctx.lt * 1100) % H, 0)
    if ctx.lt > 0.7:
        k = (ctx.lt - 0.7) / 0.3
        sn = sn * (1 - 0.75 * k) + color_bars() * 0.75 * k
    a = vhs(sn, ctx, "V4", sat=0.6)
    a = tracking_osd(a, min(1.0, ctx.lt / 0.85))
    return vcr_osd(a, "PLAY ▶", "0:00:03")


@shot("1d")
def s1d(ctx):
    tr = max(0.0, 1 - ctx.lt / 0.8)
    return vhs(color_bars(), ctx, "V1", tint=(1, 1, 1), track=tr * 2.0, track_y=200 + 260 * ctx.lt / 0.8,
               drops=0 if ctx.lt < 1 else None)


@shot("1e")
def s1e(ctx):
    img = view(asset(misc("ident_sunny_meadow")), lerp(1.0, 1.04, ctx.lt / ctx.dur))
    return vhs(to_arr(img), ctx, "V1", tint=(1.07, 1.0, 0.9))


@shot("1f")
def s1f(ctx):
    return vhs(to_arr(home_card()), ctx, "V1")


@shot("1g")
def s1g(ctx):
    a = solid((0.03, 0.03, 0.035))
    roll = int(ctx.lf / ctx.nf * H * 1.1) + 30
    rb = 1.0 if ctx.lf in (7, 8) else 0.0
    if rb:
        a = a + static_img(ctx.rng, 0.35)
    return vhs(a, ctx, "V3", roll=roll, rainbow=rb, itrack=0)


# ===== SEGMENT 2 =====
# THEME SONG with sing-along captions

def theme_caption(img, t):
    txt = lyric(t, THEME_LYRICS, T("2a"), T("3a"))
    if txt:
        caption(img, txt)


PW = META["playroom_wide"]
PLAY_FOOT = tuple(PW["poppy_foot"])
PLAY_TINT = (1.0, 0.97, 0.93)


def playroom_poppy(rel, room_name="playroom_wide", dy=0, s=NORMAL_S):
    base = room(room_name).copy()
    figure(base, rel, PLAY_FOOT, s, tint=PLAY_TINT, shadow=0.55, dy=dy)
    return base


@shot("2a")
def s2a(ctx):
    img = view(asset(misc("title_card")), lerp(1.0, 1.06, ctx.lt / ctx.dur), 0.5, 0.42)
    theme_caption(img, ctx.t)
    return vhs(to_arr(img), ctx, "V1")


def wave_frame(ctx, every=5):
    return art("poppy_wave_a") if (ctx.i // every) % 2 == 0 else art("poppy_wave_b")


@shot("2b")
def s2b(ctx):
    img = view(playroom_poppy(wave_frame(ctx), dy=bob(ctx)))
    theme_caption(img, ctx.t)
    return vhs(to_arr(img), ctx, "V1")


FLOWER_S = 110 / 308.0
POP_SY = [0.6, 0.85, 1.1, 1.06, 0.99, 1.0]
POP_SX = [0.75, 0.92, 0.95, 0.98, 1.01, 1.0]


def pop_scale(pf):
    if pf is None or pf >= 6:
        return 1.0, 1.0
    return POP_SX[pf], POP_SY[pf]


def place_bottom(base, rel, s, cx, bottom, pf=None, shadow=False, tint=None):
    """Place a canvas whose content reaches its bottom edge, anchored at
    (cx, bottom), with a pop-in squash-and-stretch (pf = frames since pop)."""
    sx, sy = pop_scale(pf)
    spr = sprite(rel, round(s, 4), sx, sy, tint=tint, blur=0.4)
    x, y = cx - spr.width / 2, bottom - spr.height
    if shadow:
        sh, pad = drop_shadow_of(rel, round(s, 4), sx, sy)
        paste(base, sh, x + 3 - pad, y + 4 - pad)
    paste(base, spr, x, y)


@shot("2c")
def s2c(ctx):
    base = asset(misc("bumper_bg")).copy()
    for k in range(4):
        pf = ctx.lf - int(round((0.1 + 0.6 * k) * FPS))
        if pf < 0:
            continue
        place_bottom(base, misc(f"flower_{k + 1}"), FLOWER_S, 150 + 110 * k, 300, pf, shadow=True)
    img = base.convert("RGB")
    theme_caption(img, ctx.t)
    return vhs(to_arr(img), ctx, "V1")


FRIEND_S2 = 150 / 320.0


@shot("2d")
def s2d(ctx):
    base = asset(misc("bumper_bg")).copy()
    # the empty third slot: the faded outline where a portrait used to hang,
    # four yellowed tape strips still on its corners, one torn paper corner
    d = ImageDraw.Draw(base, "RGBA")
    cx, cy, hw, hh = 470, 236, 60, 77
    d.rectangle([cx - hw, cy - hh, cx + hw, cy + hh], fill=(196, 186, 160, 70))
    d.rectangle([cx - hw, cy - hh, cx + hw, cy + hh], outline=(150, 132, 96, 190), width=2)
    d.rectangle([cx - hw + 3, cy - hh + 3, cx + hw - 3, cy + hh - 3], outline=(214, 204, 180, 120), width=1)
    d.polygon([(cx + hw - 2, cy + hh - 2), (cx + hw - 20, cy + hh - 2), (cx + hw - 2, cy + hh - 16)],
              fill=(250, 248, 240, 255), outline=(170, 160, 140, 200))           # torn corner left behind
    for sx_, sy_ in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        x, y = cx + sx_ * hw, cy + sy_ * hh
        ang = math.radians(42 * sx_ * sy_ + 6 * sx_)
        pts = [(x + math.cos(ang) * u - math.sin(ang) * v, y + math.sin(ang) * u + math.cos(ang) * v)
               for u, v in ((-19, -7), (19, -7.5), (18.5, 7), (-19.5, 7.5))]
        d.polygon([(px + 1.5, py + 2) for px, py in pts], fill=(90, 70, 30, 60))
        d.polygon(pts, fill=(232, 206, 128, 235), outline=(176, 144, 70, 230))
    for k, (name, x) in enumerate((("friend_mr_buttons", 168), ("friend_dot", 320))):
        pf = ctx.lf - int(round((0.1 + 0.6 * k) * FPS))
        if pf < 0:
            continue
        place_bottom(base, misc(name), FRIEND_S2, x, 238 + 170 / 2 + 2, pf, shadow=True)
    img = base.convert("RGB")
    theme_caption(img, ctx.t)
    return vhs(to_arr(img), ctx, "V1")


@shot("2e")
def s2e(ctx):
    img = view(playroom_poppy(art("poppy_blink")))      # perfectly still: no bob
    theme_caption(img, ctx.t)
    return vhs(to_arr(img), ctx, "V1")


@shot("2f")
def s2f(ctx):
    base = closeup("playroom_wide", art("poppy_close"), tint=PLAY_TINT)
    img = view(base, lerp(1.0, 1.08, ctx.lt / ctx.dur), 0.5, 0.40)
    theme_caption(img, ctx.t)
    return vhs(to_arr(img), ctx, "V1")


@shot("2g")
def s2g(ctx):
    base = asset(misc("title_card")).copy()
    figure(base, wave_frame(ctx), (540, 470), 250 / 557.0, shadow=0, blur=0.4)
    img = base.convert("RGB")
    theme_caption(img, ctx.t)
    return vhs(to_arr(img), ctx, "V1")


# ===== SEGMENT 3 =====
# GREETING

GREET = mouth((("vo_greet_1", T("3a") + 0.5), ("vo_greet_2", T("3a") + 5.0), ("vo_greet_3", T("3a") + 8.6)))


@shot("3a")
def s3a(ctx):
    if ctx.lf in (int(4.6 * FPS), int(4.6 * FPS) + 1):
        rel = art("poppy_blink")
    elif ctx.i in GREET:
        rel = art("poppy_talk")
    else:
        rel = art("poppy_idle")
    img = view(playroom_poppy(rel, dy=bob(ctx)), lerp(1.0, 1.03, ctx.lt / ctx.dur), 0.5, 0.62)
    return vhs(to_arr(img), ctx, "V1")


# ===== SEGMENT 4 =====
# COUNTING TIME: the flowers, the freeze, the eye

BOARD = META["playroom_board"]
SLOTS = [tuple(c) for c in BOARD["slot_centers"]]
BOARD_TINT = (1.0, 0.98, 0.95)
BOARD_S = 0.90
BOARD_HEAD = (552, 150)
BOARD_FOOT = (BOARD_HEAD[0], BOARD_HEAD[1] + (FULL_FOOT[1] - FULL_HEAD[1]) * BOARD_S)
FLOWER_SLOT_S = 0.375
FACE_SLOT_S = 0.345


def slot_flower(base, k, rel, pf=None):
    cx, cy = SLOTS[k]
    place_bottom(base, rel, FLOWER_SLOT_S, cx, cy + (320 - 166) * FLOWER_SLOT_S, pf, shadow=True)


def slot_face(base, k, rel, pf=None, s=FACE_SLOT_S):
    cx, cy = SLOTS[k]
    place_bottom(base, rel, s, cx, cy + (300 - 152) * s, pf, shadow=True)


def board_poppy(base, rel, dy=0):
    figure(base, rel, BOARD_FOOT, BOARD_S, tint=BOARD_TINT, shadow=0, dy=dy)


FLOWERS5 = [misc("flower_1"), misc("flower_2"), misc("flower_3"), misc("flower_4"), misc("flower_5_eye")]
COUNT_POP = [4.0, 5.6, 7.2, 8.8, 10.4]


@shot("4a")
def s4a(ctx):
    return vhs(to_arr(bumper(["COUNTING", "TIME!"], ctx.lt)), ctx, "V1")


COUNT_MOUTH = mouth((("vo_count_intro", T("4b") + 0.3),) +
                    tuple((f"vo_count_{k + 1}", T("4b") + COUNT_POP[k]) for k in range(5)))


@shot("4b")
def s4b(ctx):
    base = room("playroom_board").copy()
    for k in range(5):
        pf = ctx.lf - int(round(COUNT_POP[k] * FPS))
        if pf >= 0:
            slot_flower(base, k, FLOWERS5[k], pf)
    board_poppy(base, art("poppy_point_talk") if ctx.i in COUNT_MOUTH else art("poppy_point"), bob(ctx))
    return vhs(to_arr(base), ctx, "V1")


@shot("4c")
def s4c(ctx):
    wink = ctx.lf in (int(6.0 * FPS), int(6.0 * FPS) + 1)
    base = closeup("playroom_board", art("poppy_close_wink") if wink else art("poppy_close"), tint=BOARD_TINT)
    img = view(base, lerp(1.0, 1.10, ctx.lt / ctx.dur), 0.5, 0.40)
    k = ctx.lf - int(4.5 * FPS)
    drops = {0: 1, 1: 2, 2: 1}.get(k, 0)        # one dropout cluster: the tape keeps living
    return vhs(to_arr(img), ctx, "V1", drops=drops)


DONE_MOUTH = mouth((("vo_count_done", T("4d") + 0.4),))


@shot("4d")
def s4d(ctx):
    base = room("playroom_board").copy()
    for k in range(4):
        slot_flower(base, k, FLOWERS5[k])
    board_poppy(base, art("poppy_point_talk") if ctx.i in DONE_MOUTH else art("poppy_point"), bob(ctx))
    # operator push: static until +4.0 s, then 1.0 -> 2.4x on slot 5 over 1.5 s
    # and held, so the eye (re-composited at full art resolution) reads as
    # having turned to the lens
    e = ease((ctx.lt - 4.0) / 1.5)
    z = 1 + 1.4 * e
    sx, sy = SLOTS[4]
    cx, cy = lerp(0.5, sx / W, e), lerp(0.5, sy / H, e)
    img = view(base, z, cx, cy).convert("RGBA")
    ww, wh = W / z, H / z
    x0 = min(max(0.0, cx * W - ww / 2), W - ww)
    y0 = min(max(0.0, cy * H - wh / 2), H - wh)
    s = FLOWER_SLOT_S * z
    place_bottom(img, misc("flower_5_eye_look"), s, (sx - x0) * z, (sy - y0 + (320 - 166) * FLOWER_SLOT_S) * z,
                 shadow=True)
    return vhs(to_arr(img), ctx, "V1")


# ===== SEGMENT 5 =====
# FEELINGS TIME: four faces, then HUNGRY

FACES = [misc("feel_happy"), misc("feel_sad"), misc("feel_angry"), misc("feel_scared")]


@shot("5a")
def s5a(ctx):
    return vhs(to_arr(bumper(["FEELINGS", "TIME!"], ctx.lt)), ctx, "V1")


FEEL_MOUTH = mouth((("vo_feel_intro", T("5b") + 0.3), ("vo_feel_happy", T("5c") + 0.1),
                    ("vo_feel_sad", T("5c") + 2.1), ("vo_feel_angry", T("5c") + 4.1),
                    ("vo_feel_scared", T("5c") + 6.1)))


@shot("5b", "5c")
def s5bc(ctx):
    base = room("playroom_board").copy()
    if ctx.sid == "5c":
        for k in range(4):
            pf = ctx.lf - int(round(2.0 * k * FPS))
            if pf >= 0:
                slot_face(base, k, FACES[k], pf)
    board_poppy(base, art("poppy_point_talk") if ctx.i in FEEL_MOUTH else art("poppy_point"), bob(ctx))
    return vhs(to_arr(base), ctx, "V1")


@shot("5d")
def s5d(ctx):
    base = room("playroom_board").copy()
    for k in range(4):
        slot_face(base, k, FACES[k])
    after = ctx.lf >= 9
    if after:
        slot_face(base, 4, misc("feel_hungry"))
    board_poppy(base, art("poppy_idle") if after else art("poppy_point"))
    if 6 <= ctx.lf <= 8:      # 3-frame V3 tracking flicker
        return vhs(to_arr(base), ctx, "V3", track=0.9, track_y=120 + 110 * (ctx.lf - 6), tint=(1.04, 1.0, 0.94))
    return vhs(to_arr(base), ctx, "V1")


@shot("5e")
def s5e(ctx):
    z = 2.5
    sx, sy = SLOTS[4]
    x0, y0 = sx - W / z / 2, sy - H / z / 2
    bg = room("playroom_board").resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + W / z, y0 + H / z))
    bg = bg.filter(ImageFilter.GaussianBlur(1.2)).convert("RGBA")
    # Poppy's bonnet, out of focus at the right edge (re-composited, not an upscale of the small one)
    pop = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    s = BOARD_S * z
    spr = sprite(art("poppy_idle"), round(s, 4), tint=BOARD_TINT, blur=5.0)
    paste(pop, spr, (BOARD_FOOT[0] - x0) * z - FULL_FOOT[0] * s, (BOARD_FOOT[1] - y0) * z - FULL_FOOT[1] * s)
    # the faces at full art resolution
    for k, rel in ((3, FACES[3]), (4, misc("feel_hungry"))):
        cx, cy = SLOTS[k]
        place_bottom(bg, rel, FACE_SLOT_S * z, (cx - x0) * z, (cy - y0 + (300 - 152) * FACE_SLOT_S) * z,
                     shadow=True)
    bg.alpha_composite(pop)
    return vhs(to_arr(bg), ctx, "V1")


HUNGRY_MOUTH = mouth((("vo_feel_hungry", T("5f") + 0.3),), overrun=15)   # keeps flapping 0.5 s after


@shot("5f")
def s5f(ctx):
    rel = art("poppy_close_talk") if ctx.i in HUNGRY_MOUTH else art("poppy_close")
    return vhs(to_arr(closeup("playroom_board", rel, tint=BOARD_TINT)), ctx, "V1")


HUNGRY2_MOUTH = mouth((("vo_feel_hungry_2", T("5g") + 0.2),))


@shot("5g")
def s5g(ctx):
    base = room("playroom_board").copy()
    for k in range(4):
        slot_face(base, k, FACES[k])
    slot_face(base, 4, misc("feel_hungry"))
    still = ctx.t > T("5g") + 0.2 + 2.75
    board_poppy(base, art("poppy_talk") if ctx.i in HUNGRY2_MOUTH else art("poppy_idle"),
                0 if still else bob(ctx))
    return vhs(to_arr(base), ctx, "V1")


# ===== SEGMENT 6 =====
# POPPY'S FRIENDS, Pip, the turn, the recorded-over splice

@shot("6a")
def s6a(ctx):
    return vhs(to_arr(bumper(["POPPY'S", "FRIENDS!"], ctx.lt)), ctx, "V1")


FRIENDS_MOUTH = mouth((("vo_friends_intro", T("6b") + 0.2),))


@lru_cache(None)
def ajar_room():
    """playroom_wide_ajar with the door gap pushed to a clean black sliver
    (widened a few px into the door's shadowed edge) so the tape's rightward
    chroma bleed cannot smear it shut."""
    a = np.asarray(room("playroom_wide_ajar").convert("RGB"), np.float32)
    x = np.arange(W, dtype=np.float32)
    m = np.clip((x - 497) / 3, 0, 1) * np.clip((521 - x) / 2, 0, 1)        # the door stands open a little wider
    rows = np.zeros(H, np.float32)
    rows[121:369] = 1
    k = (rows[:, None] * m[None, :])[..., None]
    a = a * (1 - 0.97 * k)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert("RGBA")


PEEK_EYE = (70.0, 100.0)        # the wet eye in hidden_peek's 120x240 canvas
PEEK_AT = (509.0, 203.0)        # where that eye sits in the door gap (playroom_wide_ajar)
PEEK_H = 130.0                  # the eye ~24 px wide, its iris ~10 px: it reads as an eye on a still


@lru_cache(None)
def ajar_room_h1():
    """HIDDEN FIGURE H1: hidden_peek tucked into the black gap of the ajar
    door, clipped to the gap, so only petal tips and one wet eye show, a few
    percent above the black, blurred ~1 px."""
    a = to_arr(ajar_room())
    s = PEEK_H / 240.0
    spr = sprite(art("hidden_peek"), round(s, 4), blur=0.6)
    p = np.asarray(spr, np.float32) / 255.0
    x0 = int(round(PEEK_AT[0] - PEEK_EYE[0] * s))
    y0 = int(round(PEEK_AT[1] - PEEK_EYE[1] * s))
    hh, ww = p.shape[:2]
    x = np.arange(x0, x0 + ww, dtype=np.float32)
    gap = np.clip((x - 497.5) / 1.5, 0, 1) * np.clip((521.0 - x) / 1.5, 0, 1)
    al = p[..., 3] * gap[None, :]
    rgb = p[..., :3]
    # graded into the dark: felt and petals ~6-8 % above the black, the eye's
    # own highlights kept (dimmed) so it reads as wet on a still
    l = lum(rgb)
    rgb = rgb * np.where(l > 0.3, 1.15, 1.6)[..., None] * np.array([1.0, 0.93, 0.88], np.float32)   # the white lifted ~15 %
    reg = a[y0:y0 + hh, x0:x0 + ww]
    a[y0:y0 + hh, x0:x0 + ww] = reg * (1 - al[..., None]) + np.clip(rgb, 0, 1) * al[..., None]
    return to_pil(a).convert("RGBA")


@shot("6b")
def s6b(ctx):
    rel = art("poppy_talk") if ctx.i in FRIENDS_MOUTH else art("poppy_idle")
    base = ajar_room_h1().copy()
    figure(base, rel, PLAY_FOOT, NORMAL_S, tint=PLAY_TINT, shadow=0.55, dy=bob(ctx))
    return vhs(to_arr(view(base)), ctx, "V1", bleed=0.6, chroma_k=9)


FRIEND_S = 300 / 336.0


@shot("6c", "6d")
def s6cd(ctx):
    base = asset(misc("bumper_bg")).copy()
    name = "friend_mr_buttons" if ctx.sid == "6c" else "friend_dot"
    place_bottom(base, misc(name), FRIEND_S, W / 2, 240 + 168 + 3, ctx.lf, shadow=True)
    return vhs(to_arr(base), ctx, "V1")


@shot("6e")
def s6e(ctx):
    base = asset(misc("bumper_bg")).copy()
    place_bottom(base, misc("friend_pip_scribbled"), FRIEND_S, W / 2, 240 + 168 + 3, None, shadow=True)
    img = view(base, lerp(1.0, 1.05, ctx.lt / ctx.dur))
    return vhs(to_arr(img), ctx, "V1")


def stare_img():
    return closeup("playroom_wide_ajar", art("poppy_close_stare"), tint=PLAY_TINT)


@shot("6f")
def s6f(ctx):
    return vhs(to_arr(stare_img()), ctx, "V2")      # dead still; the noise floor steps up here


@shot("6g")
def s6g(ctx):
    lt = ctx.lt
    if lt < 0.3:
        return vhs(to_arr(stare_img()), ctx, "V4", track=1.6, track_y=60 + 900 * lt, rainbow=0.3)
    if lt < 0.7:
        if ctx.lf in (12, 13):                        # S1: sub_eyes_dark, 2 frames, the roll held still
            a = np.roll(to_arr(asset(misc("sub_eyes_dark"))), 195, 1)    # the eyes to frame centre
            return vhs(a, ctx, "V4", rainbow=0.3, roll=0, track=0.0)
        else:
            a = to_arr(stare_img()) * 0.7 + static_img(ctx.rng, 0.3)
        return vhs(a, ctx, "V4", rainbow=1.0, roll=int((lt - 0.3) / 0.4 * H * 1.3) + 40)
    return vhs(static_img(ctx.rng), ctx, "V4", sat=0.4)


# ===== SEGMENT 7 =====
# RECORDED OVER: CAMCORDER, June 1996 (EP + V2, green, exposure pumping, REC OSD)

def clock_for(t):
    if t >= T("7l"):
        return "11:54 PM"
    if t >= T("7f"):
        return "11:53 PM"
    return "11:52 PM"


def camcorder(ctx, img, gain=None, lv="V2", osd=True, noise_mul=1.0, gamma=1.0, **ov):
    """EP camcorder footage: exposure pumping, green cast, REC OSD (recorded, so
    it goes through the tape too).  gamma < 1 is the camcorder's low-light gain-up."""
    a = to_arr(img) if not isinstance(img, np.ndarray) else img
    if gamma != 1.0:
        a = a ** gamma
    a = a * (exposure(ctx.t) if gain is None else gain)
    if osd:
        a = cam_osd(a, ctx.t, clock_for(ctx.t))
    P = level(lv, True, **ov)
    P["noise"] *= noise_mul
    return vhs(a, ctx, P=P)


STUDIO = META["studio_night"]
STUDIO_GAMMA = 0.72          # low-light gain-up: the dark studio stays readable


H2_FOOT = (884.0, 432.0)       # its head right in front of the green exit light, the sign at its ear (960x720)
H2_TALL = 140.0                # ~20 % of the frame height at the 1.06 framing


@lru_cache(None)
def studio_glow():
    """studio_night with the exit sign's green light spilling onto the back
    wall (a soft halo ~60 px), so whatever stands in front of it is a shape."""
    a = to_arr(room("studio_night"))
    ex, ey = STUDIO["exit_sign"]
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)
    d2 = (xx - ex + 8) ** 2 + (yy - ey + 6) ** 2
    halo = 0.7 * np.exp(-d2 / (2 * 42.0 ** 2)) + 0.3 * np.exp(-d2 / (2 * 110.0 ** 2))
    a = a + halo[..., None] * np.array([0.08, 0.42, 0.2], np.float32)
    return to_pil(a).convert("RGBA")


@lru_cache(None)
def studio_h2():
    """HIDDEN FIGURE H2: hidden_poppy_stand standing in front of the green
    exit light: a dark silhouette (what is behind it darkened by half) whose
    jagged petal ring cuts into the green halo, two faint glints.  It is part
    of the room, so it pans and drifts with it; the whip pan lands on the
    same glow, empty."""
    a = to_arr(studio_glow())
    hidden(a, H2_FOOT, H2_TALL, blur=1.0, glint=0.3, glint_r=1.0, detail_k=-0.2, mul=0.72)
    return to_pil(a).convert("RGBA")


def studio_view(ctx, zoom, cx, cy, dx=0.0, dy=0.0, amp=6.0, rot=0.6, blur=0.0, h2=False):
    hx, hy, hr = handheld(ctx.t, amp, rot)
    src = studio_h2() if h2 else studio_glow()
    return view(src, zoom, cx, cy, dx + hx, dy + hy, hr, blur)


@shot("7a")
def s7a(ctx):
    lt = ctx.lt
    if lt < 0.5:
        img = solid((0, 0, 0))
    else:
        k = (lt - 0.5) / 0.3
        img = to_arr(studio_view(ctx, 1.06, 0.54, 0.5, blur=4.0, h2=True)) ** STUDIO_GAMMA * (0.65 * k)
    if lt < 0.3:
        return vhs(img, ctx, P=level("V2", True, drops=0))
    return camcorder(ctx, img, gain=1.0, drops=0)


@shot("7b")
def s7b(ctx):
    lt = ctx.lt
    blur = 4.0 * (1 - ease(lt / 1.2))
    img = studio_view(ctx, 1.06, 0.54, 0.5, dx=40 * lt / ctx.dur, blur=blur, h2=True)
    return camcorder(ctx, img, gamma=STUDIO_GAMMA, gain=exposure(ctx.t, 0.85, 1.15))


@shot("7c")
def s7c(ctx):
    lf = ctx.lf
    A = (1.06, 0.54, 0.5, 40.0)
    B = (1.4, 0.82, 0.55, 0.0)
    if lf < 4:                                       # jolt
        img = studio_view(ctx, A[0], A[1], A[2], A[3] + ctx.rng.uniform(-6, 6), ctx.rng.uniform(-6, 6))
        return camcorder(ctx, img, gamma=STUDIO_GAMMA)
    if lf < 12:                                      # whip-pan right, motion smear
        u = ease((lf - 4 + 1) / 8)
        z, cx, cy, dx = (lerp(p, q, u) for p, q in zip(A, B))
        if lf == 9:                                  # S2: sub_teeth, 1 frame in the smear
            a = hblur(to_arr(asset(misc("sub_teeth"))), 15)
        else:
            a = hblur(to_arr(studio_view(ctx, z, cx, cy, dx)) ** STUDIO_GAMMA, 61)
        return camcorder(ctx, a)
    img = studio_view(ctx, B[0], B[1], B[2], amp=4.0)
    return camcorder(ctx, img, gamma=0.62)


@shot("7d")
def s7d(ctx):
    u = ctx.lt / ctx.dur
    img = studio_view(ctx, 1.4, 0.82, 0.55, amp=5.0, rot=0.5)
    g = lerp(0.7, 1.0, ease(u)) * 1.25 * (0.95 + 0.05 * lfn(ctx.t, 0.3, "expo"))
    return camcorder(ctx, img, gain=g, noise_mul=lerp(1.0, 1.4, u), gamma=0.62)


def flicker(ctx, rate=1.0, key="fl"):
    """Fluorescent flicker: about once a second, 1-2 frames at x0.7."""
    slot = int(ctx.t * rate)
    at = int(h01(key, slot) * FPS / rate)
    length = 1 + int(h01(key + "n", slot) < 0.5)
    pos = ctx.i - int(slot * FPS / rate)
    return 0.7 if at <= pos < at + length else 1.0


@shot("7e")
def s7e(ctx):
    u = ctx.lt / ctx.dur
    t = ctx.t
    by = 4 * math.sin(2 * math.pi * 1.8 * t)
    bx = 2 * math.sin(2 * math.pi * 0.9 * t)
    hx, hy, hr = handheld(t, 2.0, 0.3, "walk")
    img = view(room("backstage_corridor"), lerp(1.04, 1.18 * 1.04, u), 0.5, 0.48, bx + hx, by + hy, hr)
    return camcorder(ctx, to_arr(img) * flicker(ctx), gain=exposure(t, 0.8, 1.0))


DRESS = META["dressing_room"]
COSTUME_S = 0.66
COSTUME_TINT = (1.0, 0.91, 0.79)       # warm felt; the camcorder adds its own green


@lru_cache(maxsize=2)
def dressing(costume=False):
    base = room("dressing_room").copy()
    if costume:
        seat = DRESS["seat_point"]
        contact_shadow(base, (seat[0] + 4, 432), 0.62, 0.38)       # under the chair, on the floor
        # its weight on the seat: a soft dark pool on the seat and the backrest
        sh, pad = blob(118, 30, 0.6, 6.0)
        paste(base, sh, seat[0] - 59 - pad, seat[1] - 8 - pad)
        # graded down into the dim room: the felt face stays peach, not white
        spr = sprite(art("costume_slumped"), round(COSTUME_S, 4), tint=COSTUME_TINT, bright=0.6, blur=1.2,
                     vgrad=(0.92, 0.82), sat=1.05)
        spr = costume_head_dark(spr)
        x, y = seat[0] - 210 * COSTUME_S, seat[1] + 4 - 330 * COSTUME_S
        # soft occlusion shadow of the costume on the chair and wall behind it
        a = spr.getchannel("A").filter(ImageFilter.GaussianBlur(5)).point(lambda v: int(v * 0.45))
        shadow = Image.new("RGBA", spr.size, (8, 10, 6, 0))
        shadow.putalpha(a)
        paste(base, shadow, x + 5, y + 4)
        paste(base, spr, x, y)
        # one mesh eye holds a faint wet glint (something behind it); the other stays black
        b = to_arr(base)
        _soft_dot(b, x + COSTUME_GLINT[0] * COSTUME_S, y + COSTUME_GLINT[1] * COSTUME_S, 0.9, 0.22, (0.95, 1.0, 0.95))
        base = to_pil(b).convert("RGBA")
    return base


COSTUME_HEAD_C = (118.0, 180.0)       # the fallen head (face centre) in costume_slumped's 420x480 canvas
COSTUME_GLINT = (121.0, 152.0)        # inside its upper mesh eye hole


def costume_head_dark(spr):
    """Sink the slumped costume's head into the dark: face and petal ring x0.5,
    the red desaturated, so it reads as a dark lolling head, not a bright sign."""
    a = np.asarray(spr, np.float32)
    hh, ww = a.shape[:2]
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
    s = ww / 420.0
    d = np.hypot(xx - COSTUME_HEAD_C[0] * s, yy - COSTUME_HEAD_C[1] * s) / (100 * s)
    m = np.clip((1.15 - d) / 0.25, 0, 1)[..., None]
    rgb = a[..., :3]
    L = (rgb @ YW)[..., None]
    dark = (L + (rgb - L) * 0.45) * 0.5
    a[..., :3] = rgb * (1 - m) + dark * m
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


@shot("7f")
def s7f(ctx):
    lt = ctx.lt
    # autofocus hunts 3 -> 0 -> 2 -> 0 px over the first 1.5 s
    af = float(np.interp(lt, [0, 0.45, 0.8, 1.15, 1.5], [3, 0, 2, 0.6, 0]))
    head = (400 + (120 - 210) * COSTUME_S, 334 + (182 - 330) * COSTUME_S)
    u = ease(lt / ctx.dur)
    hx, hy, hr = handheld(ctx.t, 3.0, 0.3)
    img = view(dressing(True), lerp(1.03, 1.12 * 1.03, u), lerp(0.5, head[0] / W, u * 0.8),
               lerp(0.5, head[1] / H, u * 0.8), hx, hy, hr, af)
    return camcorder(ctx, img)


@shot("7g")
def s7g(ctx):
    lt = ctx.lt
    # the whole memo first (reading time), drift down the items, then push to
    # 1.21x on items 3-4 and the handwritten note and hold for the last 2.25 s.
    # The memo keeps 90 px side margins so every line stays in frame, and the
    # note ends above y~380, clear of the camcorder's date/clock band.
    # (keyframes of the 10 s version scaled by 0.9 for the 9 s shot)
    z = float(np.interp(lt, [0, 3.6, 5.4, 6.75, 9.0], [1.03, 1.03, 1.09, 1.21, 1.21]))
    cy = float(np.interp(lt, [0, 3.15, 5.4, 6.75, 9.0], [0.5, 0.5, 0.56, 0.66, 0.66]))
    hold = ease((lt - 6.48) / 0.54)
    hx, hy, hr = handheld(ctx.t, lerp(2.5, 1.2, hold), lerp(0.3, 0.12, hold), "memo")
    af = max(0.0, 0.7 * lfn(ctx.t, 0.7, "breath") - 0.25) * (1 - 0.7 * hold)    # autofocus breathing
    img = view(asset(misc("memo_card")), z, lerp(0.5, 0.51, hold), cy, hx, hy, hr, af)
    P = level("V2", True)
    P.update(luma_k=3, chroma_k=21)      # close to the paper: keep the type readable
    a = to_arr(img) * exposure(ctx.t, 0.88, 1.0)
    return vhs(cam_osd(a, ctx.t, clock_for(ctx.t)), ctx, P=P)


@shot("7h", "7l")
def s7hl(ctx):
    hx, hy, hr = handheld(ctx.t, 2.0, 0.2)
    return camcorder(ctx, view(dressing(False), 1.03, 0.5, 0.5, hx, hy, hr))


CORR = META["backstage_corridor"]


@lru_cache(None)
def corridor_mirrored(costume=False):
    base = room("backstage_corridor").transpose(Image.FLIP_LEFT_RIGHT).copy()
    if costume:
        foot = CORR["far_end_foot_mirrored"]
        s = (CORR["far_end_foot"][1] - CORR["costume_head_top_for_1p8m"][1]) / (630 - 129)
        figure(base, art("costume_standing"), (foot[0], foot[1]), s, tint=(0.82, 0.92, 0.76), bright=0.8,
               blur=0.5, shadow=0.45, reg=(120, 630))
    return base


def far_tube_dim(a, k):
    """Darken the far end of the corridor (the far tube flickering)."""
    m = np.exp(-(((_xx - 320) / 110.0) ** 2 + ((_yy - 215) / 95.0) ** 2))[..., None]
    return a * (1 - (1 - k) * m)


@shot("7i")
def s7i(ctx):
    hx, hy, hr = handheld(ctx.t, 1.5, 0.15)
    a = to_arr(view(corridor_mirrored(True), 1.03, 0.5, 0.5, hx, hy, hr))
    if ctx.lf in (30, 31, 32, 66, 67):
        a = far_tube_dim(a, 0.35)
    return camcorder(ctx, a)


COSTUME_EYES = ((308.5, 233.0), (320.5, 233.0))     # its eye glints in 7j: 12 px apart where its head was


@lru_cache(None)
def glint_layer():
    """Two pinpoint eye glints where the costume's head was, as a layer in the
    mirrored corridor's pixel space (so they ride the same handheld camera)."""
    a = np.zeros((480, 640, 3), np.float32)
    for x, y in COSTUME_EYES:
        _soft_dot(a, x, y, 2.0, 0.35 / 1.6, (0.9, 1.0, 0.95))    # ~2 px, 0.35 after the x1.6 below
    return to_pil(np.clip(a, 0, 1))


@shot("7j")
def s7j(ctx):
    hx, hy, hr = handheld(ctx.t, 1.5, 0.15)
    a = to_arr(view(corridor_mirrored(False), 1.03, 0.5, 0.5, hx, hy, hr)) * 0.12
    blink = int(ctx.nf * 0.5)
    if not (blink <= ctx.lf < blink + 2):                        # they blink once, mid-shot
        a = a + to_arr(view(glint_layer(), 1.03, 0.5, 0.5, hx, hy, hr)) * 1.6
    return camcorder(ctx, a, gain=1.0)


@shot("7k", "7m")
def s7km(ctx):
    hx, hy, hr = handheld(ctx.t, 2.0, 0.2)
    a = to_arr(view(corridor_mirrored(False), 1.03, 0.5, 0.5, hx, hy, hr))
    return camcorder(ctx, a * flicker(ctx, 0.8, "fl2"))


@shot("7n")
def s7n(ctx):
    hx, hy, hr = handheld(ctx.t, 2.0, 0.2)
    drift = -12 * ease((ctx.lt - 0.5) / 0.4)          # drifts LEFT toward the hanger rattle
    return camcorder(ctx, view(dressing(False), 1.04, 0.5, 0.5, hx + drift, hy, hr))


@shot("7o")
def s7o(ctx):
    # SCARE 1: the head fills ~60 % of the frame height, pushing 1.00 -> 1.05,
    # shaking; boiling hatching; the image V0 CLEAN while it registers, then
    # the camcorder tape tears into the drop
    img = scare_framing(ctx, art("poppy_scare_costume"), art("poppy_scare_costume_b"), 0.60, 330.0,
                        (380.0, 310.0), 1.05, 6)
    clean = vhs(img, ctx, P=scare_level(ctx, 0.7, "V2", ep=True))
    # it is still the camcorder: the OSD goes through the same EP softness and
    # chroma bleed as in 7a-7n, composited over the clean face
    clock = clock_for(ctx.t)
    deg = vhs(cam_osd(img, ctx.t, clock), ctx, P=level("V2", True, drops=0, flag=(0, 0), head=0))
    wm, rm, sh = _cam_osd_layers(clock, True, (ctx.t % 1.0) < 0.5)
    m = np.maximum(np.maximum(wm, rm), sh)
    m = np.clip(vblur(hblur(m, 13), 5) * 3.0, 0, 1)[..., None]
    return clean * (1 - m) + deg * m


@shot("7p")
def s7p(ctx):
    u = ctx.lt / ctx.dur
    ang = lerp(30, 110, u)
    acc = None
    for k, da in enumerate((-9, -6, -3, 0)):
        im = to_arr(view(dressing(False), 1.25, 0.5, 0.5).rotate(-(ang + da), resample=Image.BILINEAR))
        acc = im if acc is None else acc + im
    a = hblur(acc / 4, 9)
    rng = ctx.rng
    for _ in range(3):
        y0 = int(rng.integers(0, H - 30))
        a[y0:y0 + int(rng.integers(8, 30))] = static_img(rng)[y0:y0 + 1].repeat(1, 0)[0] * 0.8
    a = cam_osd(a * 0.9, ctx.t, clock_for(ctx.t), int(rng.integers(-4, 5)), int(rng.integers(-4, 5)))
    return vhs(a, ctx, "V4", ep=True, track=0.8)


@shot("7q")
def s7q(ctx):
    return black(ctx)


# ===== SEGMENT 8 =====
# BACK TO THE SHOW (WRONG): HIDE AND SEEK

PD = META["playroom_dark"]
RED = (1.0, 0.42, 0.40)             # deep red grade (props in the dark room)
WRONG_TINT = (1.0, 0.64, 0.58)      # milder grade for Poppy herself, so she keeps her colours
RED_TINT = (1.06, 0.92, 0.9)


def dark_room_full():
    return room("playroom_dark")


@lru_cache(maxsize=16)
def _sil_layers(rel, scale, blur, halo_r):
    """Dark halo (soft, wide) and 2 px rim (dilated alpha) for a graded sprite."""
    spr = sprite(rel, scale, tint=WRONG_TINT, blur=blur)
    pad = int(halo_r * 3) + 4
    a = Image.new("L", (spr.width + 2 * pad, spr.height + 2 * pad), 0)
    a.paste(spr.getchannel("A"), (pad, pad))
    halo = a.filter(ImageFilter.GaussianBlur(halo_r))
    rim = a.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(0.8))
    return halo, rim, pad


def silhouette(base, rel, scale, x, y, blur=0.8, halo=0.5, rim=0.6, halo_r=14.0):
    """Paste the separation layers for a sprite whose top-left lands at (x, y):
    a soft dark halo from her alpha (the room falls away behind her) and a
    1-2 px dark rim, so she has a solid silhouette against the red room."""
    hl, rm, pad = _sil_layers(rel, scale, blur, halo_r)
    for m, k in ((hl, halo), (rm, rim)):
        im = Image.new("RGBA", m.size, (6, 0, 0, 0))
        im.putalpha(m.point(lambda v, k=k: int(v * k)))
        paste(base, im, x - pad, y - pad)


def wrong_figure(base, rel, foot, s, dy=0):
    s = round(s, 4)
    contact_shadow(base, foot, s, 0.65)
    x, y = foot[0] - FULL_FOOT[0] * s, foot[1] - FULL_FOOT[1] * s + dy
    silhouette(base, rel, s, x, y)
    paste(base, sprite(rel, s, tint=WRONG_TINT, bright=1.0, blur=0.8, vgrad=(1.0, 0.85)), x, y)


@shot("8a")
def s8a(ctx):
    lf = ctx.lf
    u = ctx.lt / ctx.dur
    dark = to_arr(view(dark_room_full()))
    if lf in (9, 10, 11):
        bright = to_arr(view(playroom_poppy(art("poppy_idle"))))
        a = dark * 0.5 + bright * 0.5
    else:
        a = dark * (0.4 + 0.6 * u) + static_img(ctx.rng, 0.4 * (1 - u))
    roll = int((1 - ease(u)) * H * 1.6)
    return vhs(a, ctx, "V4", rainbow=max(0.0, 1 - u * 1.3), roll=roll, tint=RED_TINT)


WRONG_HEAD_TOP = 29            # top of the petal ring in the redrawn poppy_wrong_idle canvas (head lolling off the neck)


@lru_cache(maxsize=4)
def wrong_scene(scale_mult, mirror=False):
    """The dark playroom with the redrawn wrong Poppy at the rug mark at
    `scale_mult` x her old size; the foot anchor drops (below the frame if
    need be) so her head top stays inside the frame.  mirror=True flips her
    left-right about the rug mark (x 640 is the frame centre)."""
    base = dark_room_full().copy()
    s = NORMAL_S * 2 * scale_mult
    fy = max(PD["poppy_foot"][1] + (scale_mult - 1.0) * 160, (FULL_FOOT[1] - WRONG_HEAD_TOP) * s + 26)
    foot = (PD["poppy_foot"][0], fy)
    if not mirror:
        wrong_figure(base, art("poppy_wrong_idle"), foot, s)
        return base
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    wrong_figure(layer, art("poppy_wrong_idle"), (base.width - foot[0], foot[1]), s)
    base.alpha_composite(layer.transpose(Image.FLIP_LEFT_RIGHT))
    return base


@shot("8b")
def s8b(ctx):
    # dead still at 1.15x; a 2-frame tracking flicker at +4.2 s -> 1.3x; a
    # second at +7.4 s -> 1.45x AND mirrored (her head on the other shoulder)
    lf = ctx.lf
    k1, k2 = int(4.2 * FPS), int(7.4 * FPS)
    u = ctx.lt / ctx.dur
    P = mix_levels("V2", "V3", u, tint=RED_TINT, sat=0.65)
    if lf < k1:
        state = (1.15, False)
    elif lf < k2:
        state = (1.3, False)
    else:
        state = (1.45, True)
    for k, prev in ((k1, (1.15, False)), (k2, (1.3, False))):
        if k <= lf < k + 2:                            # the flicker: she moves inside it
            P.update(track=1.2, track_y=200 + 140 * (lf - k), noise=P["noise"] * 1.5)
            if lf == k:
                state = prev
    return vhs(to_arr(view(wrong_scene(*state))), ctx, P=P)


COVER_HEAD = (222.0, 160.0)     # head centre of the redrawn poppy_cover_eyes (1.5x neck, tilted head)


def cover_closeup(zoom, s, head=(320, 150), poppy=True):
    """playroom_dark cropped `zoom` with poppy_cover_eyes, head centre at `head`."""
    bg = view(dark_room_full(), zoom).convert("RGBA")
    if poppy:
        s = round(s, 4)
        hc = COVER_HEAD
        x, y = head[0] - hc[0] * s, head[1] - hc[1] * s
        silhouette(bg, art("poppy_cover_eyes"), s, x, y, blur=0.7, halo=0.55, halo_r=18.0)
        spr = sprite(art("poppy_cover_eyes"), s, tint=WRONG_TINT, bright=1.0, blur=0.7, vgrad=(1.0, 0.85))
        paste(bg, spr, x, y)
    return bg


@lru_cache(maxsize=2)
def one_picture(poppy=True):
    # head only, ~2.3x the old framing: the long arms' loops are below the frame
    return cover_closeup(2.0, 2.4, head=(320, 262), poppy=poppy)


@shot("8c")
def s8c(ctx):
    return vhs(to_arr(one_picture()), ctx, "V3", tint=RED_TINT)


BED = META["bedroom_night"]


@lru_cache(None)
def nroom(name):
    """Night rooms lifted a little (gamma 0.85, x1.1) so the shapes read on tape."""
    a = np.asarray(room(name).convert("RGB"), np.float32) / 255.0
    a = np.clip(a ** 0.85 * 1.1, 0, 1)
    return Image.fromarray((a * 255 + 0.5).astype(np.uint8)).convert("RGBA")


@lru_cache(maxsize=2)
def bedroom_tv(poppy=True):
    """bedroom_night (960x720) with the 8c picture on the TV."""
    base = nroom("bedroom_night").copy()
    pic = np.asarray(one_picture(poppy).convert("RGB"), np.float32) / 255.0
    pic = (pic ** 0.75 * 1.15 + np.array([0.04, 0.05, 0.09], np.float32)) * 255   # a lit CRT
    pic[1::2] *= 0.72                                        # the TV's own scanlines
    pic = Image.fromarray(np.clip(pic, 0, 255).astype(np.uint8)).convert("RGBA")
    quad = [tuple(p) for p in BED["tv_screen_quad_tl_tr_br_bl"]]
    co = persp_coeffs(quad, [(0, 0), (W, 0), (W, H), (0, H)])
    warped = pic.transform(base.size, Image.PERSPECTIVE, co, Image.BICUBIC)
    # faint blue bloom from the screen onto the dresser
    glow = warped.filter(ImageFilter.GaussianBlur(28))
    g = np.asarray(glow, np.float32)
    bloom = g[..., :3] * (g[..., 3:] / 255.0) * np.array([0.55, 0.65, 1.0], np.float32) * 0.9
    b = np.asarray(base.convert("RGB"), np.float32) + bloom
    base = Image.fromarray(np.clip(b, 0, 255).astype(np.uint8)).convert("RGBA")
    base.alpha_composite(warped)
    return base


_TVQ = BED["tv_screen_quad_tl_tr_br_bl"]
TV_C = (sum(p[0] for p in _TVQ) / 4 / 960.0, sum(p[1] for p in _TVQ) / 4 / 720.0)
TV_Z = 2.9          # the TV filling ~45% of the frame width: its picture reads


@shot("8d")
def s8d(ctx):
    # the bedroom, then a push onto the TV: she is on your TV, covering her eyes
    e = ease((ctx.lt - 0.3) / 1.8)
    z = lerp(1.0, TV_Z, e)
    return vhs(to_arr(view(bedroom_tv(True), z, lerp(0.5, TV_C[0], e), lerp(0.5, TV_C[1], e))), ctx, "V3")


WIN_GLASS = (433, 60, 521, 306)     # bedroom_night window glass (960x720)
H3_FOOT = (482.0, 218.0)            # it stands outside: its head in the moonlit upper pane, centre ~(482, 135)
H3_TALL = 106.0


@lru_cache(None)
def bedroom_h3():
    """HIDDEN FIGURE H3: the head and shoulders of hidden_poppy_stand OUTSIDE
    the moonlit window: only where the glass is, a still silhouette several
    percent DARKER than the glass (against light a figure is darker)."""
    a = to_arr(nroom("bedroom_night"))
    x0, y0, x1, y1 = WIN_GLASS
    clip = np.zeros(a.shape[:2], np.float32)
    g = lum(a[y0:y1, x0:x1])
    clip[y0:y1, x0:x1] = np.clip((g - 0.10) / 0.05, 0, 1)        # the lit glass, not the frame
    clip = np.asarray(Image.fromarray((clip * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)),
                      np.float32) / 255.0
    hidden(a, H3_FOOT, H3_TALL, blur=1.2, glint=0.0, clip=clip, detail_k=-0.2, mul=0.55)
    return to_pil(a).convert("RGBA")


@shot("8e")
def s8e(ctx):
    # cropped on the bed, a little high so the window (and what stands outside
    # it) stays in the frame through the push
    cx, cy = BED["bed_center"][0] / 960, 320.0 / 720
    img = view(bedroom_h3(), lerp(1.5, 1.6, ctx.lt / ctx.dur), cx, cy)
    return vhs(to_arr(img), ctx, "V3")


HALL_DOOR = META["hallway_night"]["ajar_door_rect"]
FAR_DOOR = META["hallway_night"]["far_door_rect"]
H4_FOOT = (298.0, 292.0)            # at the far end of the hall, against the lit far door, half past its left jamb
H4_TALL = 88.0                      # ~18 % of the frame height (a toy at the far end of the hall)


@lru_cache(None)
def hallway_lit():
    """hallway_night with the far door's panel lit a little more (a lamp on
    behind its frosted glass), so it is the brightest thing in the hall."""
    a = to_arr(nroom("hallway_night"))
    x0, y0, x1, y1 = FAR_DOOR
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)
    m = (np.clip((xx - x0 - 2) / 6, 0, 1) * np.clip((x1 - 2 - xx) / 6, 0, 1) *
         np.clip((yy - y0 - 2) / 6, 0, 1) * np.clip((y1 - 2 - yy) / 6, 0, 1))
    a = a * (1 + 1.1 * m[..., None]) + m[..., None] * np.array([0.02, 0.025, 0.035], np.float32)
    return to_pil(a).convert("RGBA")


@lru_cache(None)
def hallway_h4():
    """HIDDEN FIGURE H4: hidden_poppy_stand at the far end of the hall, a
    silhouette against the lit far door (the brightest thing in 8f/8g): what
    is behind it darkened by ~45 %; its left half is lost against the dark
    jamb and wall.  Gone after the jolt in 8g."""
    a = to_arr(hallway_lit())
    hidden(a, H4_FOOT, H4_TALL, blur=0.8, glint=0.0, detail_k=-0.2, mul=0.62)
    return to_pil(a).convert("RGBA")


@shot("8f")
def s8f(ctx):
    return vhs(to_arr(view(hallway_h4())), ctx, "V3")


@shot("8g")
def s8g(ctx):
    # H4 is still in the doorway, growing with the push, until the 3-frame
    # jolt at +2.0 s; when the jolt settles the doorway is empty
    fy = META["hallway_night"]["far_door_center"][1] / H
    dx = dy = 0.0
    j = int(2.0 * FPS)
    if j <= ctx.lf < j + 3:                                   # 3-frame jolt
        dx, dy = ctx.rng.uniform(-7, 7, 2)
    src = hallway_h4() if ctx.lf < j else hallway_lit()
    img = view(src, 1.0 + 0.2 * ease(ctx.lt / ctx.dur) + 0.01, 0.5, fy, dx, dy)
    return vhs(to_arr(img), ctx, "V3")


@shot("8h")
def s8h(ctx):
    return vhs(to_arr(cover_closeup(2.2, 2.7, head=(322, 268))), ctx, "V3", tint=RED_TINT)


@shot("8i")
def s8i(ctx):
    if ctx.lf < 4:
        if ctx.lf in (1, 2):                                  # S3: the closet face, positive, graded dark
            a = to_arr(view(asset(art("poppy_scare_closet")), 1.06))
            a = lum_cap(a, 0.27)                               # no white flash: within 15 % of the flicker
            return vhs(a, ctx, "V4", rainbow=0.2, track=0.3)
        a = to_arr(view(nroom("closet_door"))) * 0.6 + static_img(ctx.rng, 0.4)
        return vhs(a, ctx, "V4", rainbow=0.5, track=1.0)
    return vhs(to_arr(view(nroom("closet_door"))), ctx, "V3")


@shot("8j")
def s8j(ctx):
    # the identical TV framing as the end of 8d, now empty; after 'Eight' the
    # camera pulls back to the dark bedroom she is somewhere in
    e = ease((ctx.lt - 1.9) / 1.9)
    z = lerp(TV_Z, 1.0, e)
    return vhs(to_arr(view(bedroom_tv(False), z, lerp(TV_C[0], 0.5, e), lerp(TV_C[1], 0.5, e))), ctx, "V3")


@shot("8k")
def s8k(ctx):
    g = META["closet_door"]["gap_rect"]
    cx, cy = (g[0] + g[2]) / 2 / W, 0.45
    img = view(nroom("closet_door"), lerp(1.0, 1.10, ctx.lt / ctx.dur), cx, cy)
    return vhs(to_arr(img), ctx, "V3")


@shot("8l")
def s8l(ctx):
    return vhs(to_arr(view(nroom("closet_door_open"))), ctx, "V3")


@shot("8m")
def s8m(ctx):
    # SCARE 2: the face fills ~75 % of the frame height (the door edges stay in
    # frame), pushing 1.00 -> 1.05, shaking; boiling; clean, then it tears
    a = scare_framing(ctx, art("poppy_scare_closet"), art("poppy_scare_closet_b"), 0.75, 430.0,
                      (400.0, 300.0), 1.05, 4)
    return vhs(a, ctx, P=scare_level(ctx, 0.72, "V3"))


@shot("8n")
def s8n(ctx):
    return black(ctx)


# ---- 8o: your screen.  The black is the glass of a switched-off CRT
# reflecting the room it stands in; something stands behind your bed (H5).

CRT_CROP = (330, 60, 960, 532)        # bedroom_night: the bed, the window, the wall (not the TV)
H5_FOOT = (474.0, 352.0)              # in your room, between the bed and the window: its head against the glass
H5_TALL = 150.0


def _barrel(a, k):
    """Curved-glass barrel distortion (k ~0.12), bilinear; outside -> black."""
    hh, ww = a.shape[:2]
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
    nx, ny = (xx - ww / 2) / (ww / 2), (yy - hh / 2) / (ww / 2)
    r2 = nx * nx + ny * ny
    f = (1 + k * r2) / (1 + k * 0.45)
    sx, sy = nx * f * (ww / 2) + ww / 2, ny * f * (ww / 2) + hh / 2
    x0, y0 = np.floor(sx).astype(np.int32), np.floor(sy).astype(np.int32)
    fx, fy = (sx - x0)[..., None], (sy - y0)[..., None]
    ok = ((x0 >= 0) & (x0 < ww - 1) & (y0 >= 0) & (y0 < hh - 1))[..., None]
    x0c, y0c = np.clip(x0, 0, ww - 2), np.clip(y0, 0, hh - 2)
    out = (a[y0c, x0c] * (1 - fx) * (1 - fy) + a[y0c, x0c + 1] * fx * (1 - fy) +
           a[y0c + 1, x0c] * (1 - fx) * fy + a[y0c + 1, x0c + 1] * fx * fy)
    return out * ok


@lru_cache(None)
def crt_reflection():
    """bedroom_night cropped to the bed/window/wall, mirrored, graded cold
    grey-blue and dark (room 3-12 % luma, the moonlit window ~18 %), H5 behind
    the bed in the dark left third, barrel-distorted, crt_glass on top."""
    src = to_arr(room("bedroom_night"))
    L = lum(src)
    x0, y0, x1, y1 = CRT_CROP
    # the bed hides the figure's legs: its top edge on the right side of the room
    occ = np.ones(L.shape, np.float32)
    occ[378:, 800:] = 0.0
    # grade: dark and cold, a little of the room's own colour left
    gl = 0.035 + 0.30 * L                       # lifted: a mean of ~8 %, so it is not just black
    wx0, wy0, wx1, wy1 = WIN_GLASS
    wm = np.zeros(L.shape, np.float32)
    wm[wy0:wy1, wx0:wx1] = np.clip((L[wy0:wy1, wx0:wx1] - 0.12) / 0.08, 0, 1)
    gl = gl * (1 + 0.45 * wm)
    cold = np.array([0.82, 0.95, 1.18], np.float32)
    g = gl[..., None] * cold * 0.85 + (src / np.maximum(L, 1e-3)[..., None]) * gl[..., None] * 0.15
    # H5, graded in the reflection's own values
    hidden(g, H5_FOOT, H5_TALL, blur=1.6, glint=0.0, detail_k=-0.3, mul=0.6)
    g = g[y0:y1, x0:x1][:, ::-1]
    img = to_pil(np.clip(g, 0, 1)).resize((W, H), Image.LANCZOS)
    a = _barrel(to_arr(img), 0.12)
    glass = asset(misc("crt_glass"))
    out = to_pil(a).convert("RGBA")
    out.alpha_composite(glass)
    return to_arr(out)


@shot("8o")
def s8o(ctx):
    # fades up from black over 2.5 s like eyes adjusting, then holds absolutely
    # still; NO tape damage: only fine grain in the shadows (it is your screen)
    a = crt_reflection() * ease(ctx.lt / 2.5)
    L = lum(a)[..., None]
    g = ctx.rng.standard_normal((H, W, 1)).astype(np.float32) * 0.010 * np.clip(1 - L / 0.15, 0, 1)
    return np.clip(a + g, 0, 1)


# ===== SEGMENT 9 =====
# A MESSAGE FROM SUNNY MEADOW: advisory cards over a dying music box

GLITCH_9C = 4.6                       # card C's V4 glitch; S4 0.1 s into it


@shot("9a", "9b", "9c", "9d")
def s9(ctx):
    key = ctx.sid[1].upper()
    if ctx.sid == "9c" and ctx.lt >= GLITCH_9C:
        lf = ctx.lf - int(round(GLITCH_9C * FPS))
        if lf in (3, 4):                                    # S4
            img = Image.new("RGB", (W, H), (0, 0, 0))
            d = ImageDraw.Draw(img)
            text_c(d, H / 2 - 34, "SHE IS COUNTING", font(MONO, 56))
            a = to_arr(img)
        else:
            a = to_arr(advisory_frame(key, ctx.lt)) * 0.7 + static_img(ctx.rng, 0.3)
        return vhs(a, ctx, "V4", rainbow=0.6, track=1.0, roll=int(lf * 23))
    return vhs(to_arr(advisory_frame(key, ctx.lt)), ctx, "V2")


# ===== SEGMENT 10 =====
# SEE YOU TOMORROW: the reprise, the wave, the crack, the last subliminal, the
# closest close-up, the tape stops, STOP in true silence (the false ending).

def reprise_caption(img, t):
    txt = lyric(t, REPRISE_LYRICS, T("10b"), T("10d"))
    if txt:
        caption(img, txt, color=(226, 228, 150), dx=3, dy=2)


@shot("10a")
def s10a(ctx):
    # tracking roll from card D into the title card
    u = ctx.lt / ctx.dur
    src = advisory_frame("D", 10.0) if u < 0.4 else asset(misc("title_card"))
    a = to_arr(src) * lerp(0.5, 1.0, u) + static_img(ctx.rng, 0.6 * (1 - u))
    return vhs(a, ctx, "V4", roll=int((1 - ease(u)) * H * 1.2), rainbow=0.6 * (1 - u), sat=0.5)


@shot("10b")
def s10b(ctx):
    t = ctx.t
    if ctx.lf in (int(6.0 * FPS), int(6.0 * FPS) + 1):      # 2 frames: the 4c wink, once, at you
        img = view(closeup("playroom_board", art("poppy_close_wink"), tint=BOARD_TINT), 1.1, 0.5, 0.40)
        return vhs(to_arr(img), ctx, "V3", sat=0.5)
    img = view(asset(misc("title_card")), lerp(1.0, 1.05, ctx.lt / ctx.dur) + 0.01, 0.5, 0.45,
               3 * lfn(t, 0.8, "wobx"), 3 * lfn(t, 0.7, "woby"))
    reprise_caption(img, t)
    return vhs(to_arr(img), ctx, "V3", sat=0.5)


SEE_FREEZE = 4.0          # 10c: she freezes mid-wave here and her head becomes the wrong head
SEE_GONE = 1.5            # ... and for the last 1.5 s she is gone from the card


@lru_cache(maxsize=2)
def wave_wrong_head(rel):
    """The waving Poppy frozen mid-wave with the WRONG head: the lolling,
    button-eyed, re-sewn head of poppy_wrong_idle on her neck."""
    spr = asset(rel).convert("RGBA").copy()
    a = np.asarray(spr, np.float32).copy()
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)
    # take her own head away (face + petal ring around (210, 190), r ~125)
    cut = np.clip((np.hypot(xx - 210, yy - 190) - 118) / 8, 0, 1)
    cut = np.maximum(cut, (yy > 262).astype(np.float32))          # keep the neck below the head
    a[..., 3] *= cut
    spr = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
    # the wrong head (centre (262, 150) in its canvas, r ~125), hung off her neck top the same way
    w = np.asarray(asset(art("poppy_wrong_idle")).convert("RGBA"), np.float32).copy()
    wy, wx = np.mgrid[0:w.shape[0], 0:w.shape[1]].astype(np.float32)
    keep = np.clip((128 - np.hypot(wx - 262, wy - 150)) / 6, 0, 1) * (wy < 238).astype(np.float32)
    w[..., 3] *= keep
    head = Image.fromarray(np.clip(w, 0, 255).astype(np.uint8), "RGBA")
    out = Image.new("RGBA", spr.size, (0, 0, 0, 0))
    out.alpha_composite(spr)
    out.alpha_composite(head, dest=(-262 + 243, -150 + 196))
    return out


@shot("10c")
def s10c(ctx):
    base = asset(misc("end_card")).copy()
    # 1.7x her 2g size, head centre near y=200, body cut off well below the frame
    s = 250 / 557.0 * 1.7
    foot = (505, 200 + (FULL_FOOT[1] - FULL_HEAD[1]) * s)
    if ctx.lt < SEE_FREEZE:
        figure(base, wave_frame(ctx, every=10), foot, s, shadow=0, blur=0.5)
    elif ctx.lt < ctx.dur - SEE_GONE:
        # frozen mid-wave; the wrong head under 'Poppy found you. Now you stay.'
        frozen = wave_frame(SimpleNamespace(i=T("10c") * FPS + SEE_FREEZE * FPS - 1), every=10)
        spr = wave_wrong_head(frozen)
        sc = round(s, 4)
        small = spr.resize((max(1, int(spr.width * sc)), max(1, int(spr.height * sc))), Image.LANCZOS)
        if 0.5 > 0:
            small = small.filter(ImageFilter.GaussianBlur(0.5))
        paste(base, small, foot[0] - FULL_FOOT[0] * sc, foot[1] - FULL_FOOT[1] * sc)
    # else: she has left the card (she left the TV)
    img = base.convert("RGB")
    reprise_caption(img, ctx.t)
    return vhs(to_arr(img), ctx, "V3", sat=0.55)


@shot("10d")
def s10d(ctx):
    img = view(asset(misc("end_card_cracked")), lerp(1.0, 1.03, ctx.lt / ctx.dur))
    return vhs(to_arr(img), ctx, "V3", sat=0.55)


@shot("10e")
def s10e(ctx):
    lf = ctx.lf
    if lf in (6, 7, 8):                                       # S5
        a = to_arr(asset(misc("sub_crayon_house")))
    else:
        a = to_arr(asset(misc("end_card_cracked"))) * 0.5 + static_img(ctx.rng, 0.5)
    return vhs(a, ctx, "V4", track=1.0, rainbow=0.4)


@shot("10f")
def s10f(ctx):
    return vhs(static_img(ctx.rng), ctx, "V4", sat=0.3)


@lru_cache(None)
def final_close(name="poppy_final_close"):
    a = to_arr(asset(art(name)))
    warm = 1 - 0.3 * (((_xx - W / 2) / (W / 2)) ** 2 + ((_yy - H / 2) / (H / 2)) ** 2)
    return a * np.clip(warm, 0.55, 1)[..., None] * np.array([1.05, 0.98, 0.9], np.float32)


@shot("10g")
def s10g(ctx):
    a = final_close()
    if ctx.lt < 2.7:
        return vhs(a, ctx, "V2", drop_p=0.1, tint=(1.03, 1.0, 0.95))
    # VCR PAUSE: the two fields 1 px apart, jittering at 15 Hz, two noise bars.
    # The fields are not the same picture: in one of them her pupils are dead
    # centre on the lens, with no catchlight - she is looking at you.
    ph = (ctx.i // 2) % 2
    if ph:
        a = final_close("poppy_final_close_look")
    b = a.copy()
    b[1::2] = np.roll(a[1::2], 1 if ph else -1, 1)
    if ph:
        b = np.roll(b, 1, 0)
    rng = ctx.rng
    for yc in (118 + 3 * ph, 372 - 2 * ph):
        hh = 10
        b[yc:yc + hh] = b[yc:yc + hh] * 0.3 + static_img(rng)[yc:yc + hh] * 0.7
        b[yc:yc + hh] = np.roll(b[yc:yc + hh], 9, 1)
    return vhs(b, ctx, "V2", drops=0, tint=(1.03, 1.0, 0.95), jitter=0.4, wobble=0.0)


@shot("10h")
def s10h(ctx):
    lt = ctx.lt
    src = to_pil(final_close())
    hgt = max(2, int(H * (1 - ease(lt / 0.4))))
    a = np.zeros((H, W, 3), np.float32)
    if lt < 0.5:
        sq = to_arr(src.resize((W, hgt), Image.BILINEAR))
        gain = 1 + 2.5 * (1 - hgt / H)
        y0 = (H - hgt) // 2 + int(lt * 300) % 40 - 20
        y0 = min(max(0, y0), H - hgt)
        a[y0:y0 + hgt] = np.clip(sq * gain + 0.15 * (1 - hgt / H), 0, 1)
    else:
        a[H // 2 - 1:H // 2 + 1] = 0.9 * (1 - (lt - 0.5) / 0.1)
    return vhs(a, ctx, "V4", track=0.0, roll=int(lt * 400), rainbow=0.0, drops=2)


@shot("10i")
def s10i(ctx):
    return vcr_osd(solid(VCR_BLUE), "STOP ■")


# ===== SEGMENT 11 =====
# THE TAPE DOES NOT STOP: the VCR rewinds by itself and presses PLAY; the bars
# say HIDE AND SEEK; 'You tried to stop the tape'; the direct address; the
# count again; four never comes; scare 3, the last image of the tape.

def tape_counter(sec):
    sec = max(0, int(sec))
    return f"{sec // 3600}:{sec // 60 % 60:02d}:{sec % 60:02d}"


TAPE_AT_STOP = T("10i") - T("1b")       # the counter when the tape stopped (it started at 1b)
REW_SHOTS = ("10g", "10d", "10c")       # scanned backwards; the static (10f) and S5 (10e) are skipped
REW_T0, REW_T1 = 0.3, 1.9
REW_LUMA = 0.22                         # the search picture's mean luma, held steady (no flashing)


@lru_cache(None)
def rewind_seq():
    seq = []
    for sid in REW_SHOTS:
        s = SHOT[sid]
        seq += list(range(s["f1"] - 1, s["f0"] - 1, -1))
    return tuple(seq)


def rewind_frame(ctx):
    """Reverse search: the tape's own earlier frames, rendered again by
    render_frame() (deterministic: every frame is seeded by its number),
    played backwards at x7 with 4 of each 7 fields averaged into a smear,
    desaturated 30 %, its mean luma held at REW_LUMA, 2-3 rolling noise bars."""
    k = ctx.lf - int(round(REW_T0 * FPS))
    seq = rewind_seq()
    idx = [seq[min(len(seq) - 1, 7 * k + d)] for d in (0, 2, 4, 6)]
    a = sum(render_frame(i).astype(np.float32) for i in idx) / (255.0 * len(idx))
    L = lum(a)[..., None]
    a = L + (a - L) * 0.7
    a = a * float(np.clip(REW_LUMA / max(1e-3, float(L.mean())), 0.6, 1.8))
    rng = ctx.rng
    for b in range(3):
        yc = int((k * (29 + 11 * b) + 160 * b) % (H + 40)) - 20
        hh = 12 + 6 * b
        y0, y1 = max(0, yc), min(H, yc + hh)
        if y1 > y0:
            a[y0:y1] = a[y0:y1] * 0.25 + static_img(rng)[y0:y1] * 0.45
    return a


@lru_cache(None)
def scare_final_still():
    """S7: the scare 3 eyes, positive (a negative read as mud), graded a little dark."""
    return to_arr(view(asset(art("poppy_scare_final_c")), 1.0)) * 0.85


@shot("11a")
def s11a(ctx):
    lt = ctx.lt
    cnt = tape_counter(TAPE_AT_STOP * (1 - ease(lt / REW_T1)))
    if lt < REW_T0:                                      # STOP -> REW by itself
        return vcr_osd(solid(VCR_BLUE), "◀◀ REW", cnt)
    if lt >= REW_T1:                                     # rewound: blue
        return vcr_osd(solid(VCR_BLUE), None, "0:00:00")
    if ctx.lf == int(round(0.8 * FPS)):                  # S6
        a = lum_cap(to_arr(asset(misc("sub_scrawl_face"))), REW_LUMA)
    elif ctx.lf == int(round(1.8 * FPS)):                # S7 (foreshadows scare 3)
        a = lum_cap(scare_final_still(), REW_LUMA)
    else:
        a = rewind_frame(ctx)
    a = vhs(a, ctx, "V4", track=0.6, rainbow=0.0, sat=0.7)
    return vcr_osd(a, "◀◀ REW", cnt)


@shot("11b")
def s11b(ctx):
    a = vhs(solid(VCR_BLUE), ctx, "V1", drops=0, tint=(1, 1, 1), sat=1.0, vig=0.4, flag=(0, 0))
    return vcr_osd(a, "PLAY ▶", "0:00:00")


@lru_cache(None)
def bars_wrong():
    """1d's colour bars, dimmed x0.7 and desaturated 40 %; a different episode."""
    img = to_pil(color_bars())
    d = ImageDraw.Draw(img)
    d.rectangle([52, 268, W - 52, 306], fill=(0, 0, 0))
    text_c(d, 274, "SMV-0417   HIDE AND SEEK   VOL. 4", font(MONO, 22), fill=(235, 235, 235))
    a = to_arr(img)
    L = lum(a)[..., None]
    return (L + (a - L) * 0.6) * 0.7


@shot("11c")
def s11c(ctx):
    return vhs(bars_wrong(), ctx, "V2", tint=(1, 1, 1))


PANES = (245, 128, 426, 327)          # playroom_dark: the four window panes (1280x960)


@lru_cache(None)
def dark_room_black():
    """playroom_dark with the four window panes solid black: the painted meadow
    behind them is gone (only the dark glass; the lit frame stays)."""
    a = to_arr(dark_room_full())
    x0, y0, x1, y1 = PANES
    m = np.clip((0.095 - lum(a[y0:y1, x0:x1])) / 0.03, 0, 1)
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)),
                   np.float32)[..., None] / 255.0
    a[y0:y1, x0:x1] *= 1 - m
    return to_pil(a).convert("RGBA")


H6_FOOT = (950.0, 735.0)
H6_TALL = 262.0


@lru_cache(None)
def dark_room_h6():
    """HIDDEN FIGURE H6 in the open black doorway, a few percent above the
    black, two faint glints."""
    a = to_arr(dark_room_black())
    r = PD["door_opening_rect"]
    clip = np.zeros(a.shape[:2], np.float32)
    x0, y0, x1, y1 = int(r[0]), int(r[1]), int(math.ceil(r[2])), int(math.ceil(r[3]))
    clip[y0:y1, x0:x1] = np.clip((0.06 - lum(a[y0:y1, x0:x1])) / 0.03, 0, 1)
    hidden(a, H6_FOOT, H6_TALL, blur=3.0, delta=0.095, glint=0.5, clip=clip, glint_r=1.8)
    return to_pil(a).convert("RGBA")


@shot("11d")
def s11d(ctx):
    lt = ctx.lt
    room_a = to_arr(view(dark_room_h6()))
    if lt < 0.5:                                          # tracking roll from the bars into the room
        u = lt / 0.5
        a = bars_wrong() * (1 - u) + room_a * u + static_img(ctx.rng, 0.3 * (1 - u))
        P = mix_levels("V4", "V3", ease(u), tint=RED_TINT, sat=0.65)
        P.update(roll=int((1 - ease(u)) * H * 1.3) + 10, rainbow=0.6 * (1 - u))
        return vhs(a, ctx, P=P)
    return vhs(room_a, ctx, "V3", tint=RED_TINT, sat=0.65)


# ---- 11e: direct address.  Level, dead centre, happy voice; the lower face
# stretches while she chats.

ADDR_EYE_Y = 190
ADDR_CUES = (("vo_addr_1", 0.4), ("vo_addr_2", 3.0), ("vo_addr_3", 6.0))
ADDR_SHUT = 8.4                        # from here the WRONG voice, mouth shut


def _addr_mouth():
    """Lip flap with a lag growing from 3 frames at +0.0 s to 12 by +7.5 s
    (the voice runs ahead of her mouth), minimum 3 frames per state."""
    s = SHOT["11e"]
    n = s["f1"] - s["f0"]
    st = [0] * n
    for k in range(n):
        lag = int(round(3 + 9 * min(1.0, k / FPS / 7.5)))
        for name, t0 in ADDR_CUES:
            ops = env_open(name)
            j = k - int(round(t0 * FPS)) - lag
            if 0 <= j < len(ops) and ops[j]:
                st[k] = 1
    k = 0
    while k < n:
        j = k
        while j < n and st[j] == st[k]:
            j += 1
        if j - k < 3 and k > 0:
            for q in range(k, j):
                st[q] = st[k - 1]
        k = j
    shut = int(round(ADDR_SHUT * FPS))
    return frozenset(s["f0"] + k for k in range(n) if st[k] and k < shut)


ADDR_MOUTH = _addr_mouth()


@lru_cache(maxsize=8)
def addr_sprite(talk, kq):
    """poppy_address(_talk) with every row below the eye line stretched
    vertically by kq/1000 (premultiplied, so the edges stay clean)."""
    im = asset(art("poppy_address_talk" if talk else "poppy_address")).convert("RGBa")
    k = kq / 1000.0
    nh = int(round((H - ADDR_EYE_Y) * k))
    out = Image.new("RGBa", (W, ADDR_EYE_Y + nh), (0, 0, 0, 0))
    out.paste(im.crop((0, 0, W, ADDR_EYE_Y)), (0, 0))
    out.paste(im.resize((W, nh), Image.LANCZOS, box=(0, ADDR_EYE_Y, W, H)), (0, ADDR_EYE_Y))
    return out


@lru_cache(None)
def addr_bg():
    """playroom_dark cropped 1.6x on the rug area, blurred 8 px, x0.5, red."""
    img = view(dark_room_black(), 1.6, 0.56, 0.62).filter(ImageFilter.GaussianBlur(8))
    return to_pil(to_arr(img) * 0.5 * np.array([1.0, 0.8, 0.78], np.float32))


@shot("11e")
def s11e(ctx):
    u = ctx.lt / ctx.dur
    us = (ctx.lf // 4) * 4 / ctx.nf                      # the stretch steps at 7.5 fps
    k = 1.0 + 0.22 * ease(us)
    spr = addr_sprite(ctx.i in ADDR_MOUTH, int(round(k * 1000)))
    z = 1.0 + 0.15 * ease(u)                             # the camera pushes toward her eyes, smoothly
    ex, ey = W / 2, ADDR_EYE_Y
    cx = (ex * (1 - 1 / z) + W / (2 * z)) / W
    cy = (ey * (1 - 1 / z) + H / (2 * z)) / H
    base = view(addr_bg(), z, cx, cy).convert("RGBA")
    s2 = spr.resize((int(round(spr.width * z)), int(round(spr.height * z))), Image.LANCZOS).convert("RGBA")
    paste(base, s2, ex - ex * z, ey - ey * z)
    return vhs(to_arr(base), ctx, "V2", luma_k=2, chroma_k=11)


# ---- 11f-11i: the count again

@lru_cache(None)
def chair_shot():
    """playroom_dark at 3.0x on the yellow chair (turned to face the wall), so
    the chair sits near the centre; the pale light spill on the cabinet behind
    it is pulled down x0.6 and the shiny floor spill left of it x0.3, so the
    chair, in a soft pool of light, is what reads."""
    cx, cy = PD["chair_center"][0] / 1280, PD["chair_center"][1] / 960
    a = to_arr(view(dark_room_black(), 3.0, cx, cy))
    m = np.clip((_xx - 320) / 25, 0, 1) * np.clip((500 - _xx) / 25, 0, 1) * np.clip((250 - _yy) / 30, 0, 1)
    a = a * (1 - 0.4 * m[..., None])
    fl = np.clip((285 - _xx) / 40, 0, 1) * np.clip((_yy - 170) / 40, 0, 1)
    a = a * (1 - 0.7 * fl[..., None])
    spot = np.exp(-(((_xx - 420) / 230.0) ** 2 + ((_yy - 250) / 230.0) ** 2))
    return np.clip(a * (0.3 + 0.7 * spot)[..., None] * 1.45, 0, 1)


@shot("11f")
def s11f(ctx):
    return vhs(chair_shot(), ctx, "V3", tint=RED_TINT, sat=0.65)


@shot("11g")
def s11g(ctx):
    # the doorway, EMPTY now: H6 is gone
    r = PD["door_opening_rect"]
    cx, cy = (r[0] + r[2]) / 2 / 1280, (r[1] + r[3]) / 2 / 960
    return vhs(to_arr(view(dark_room_black(), 2.2, cx, cy)), ctx, "V3", tint=RED_TINT, sat=0.65)


BOARD5_Z = 3.0
HUNGRY_ROT = (-5.0, 3.5, -1.5, 6.0, -6.0)


@lru_cache(None)
def board_hungry5():
    """The felt board: FIVE HUNGRY faces pinned in a row at slot spacing, each
    rotated differently, dim (x0.6) and red graded, composited at output
    resolution (~84x105 px each, so the eyes and teeth read) over the
    cropped room."""
    r = PD["board_rect"]
    cx, cy = (r[0] + r[2]) / 2 / 1280, (r[1] + r[3]) / 2 / 960
    base = view(dark_room_black(), BOARD5_Z, cx, cy).convert("RGBA")
    ww, wh = 1280 / BOARD5_Z, 960 / BOARD5_Z
    x0 = min(max(0.0, cx * 1280 - ww / 2), 1280 - ww)
    y0 = min(max(0.0, cy * 960 - wh / 2), 960 - wh)
    sc = W / ww
    s = 0.345
    d = ImageDraw.Draw(base)
    for k in range(5):
        X = r[0] + 6 + (r[2] - r[0] - 12) * (k + 0.5) / 5
        Y = (r[1] + r[3]) / 2 - 18 + 3 * math.sin(k * 2.1)
        ox, oy = (X - x0) * sc, (Y - y0) * sc
        spr = sprite(misc("feel_hungry"), s, tint=(1.0, 0.72, 0.66), bright=0.62, blur=0.2)
        spr = spr.rotate(HUNGRY_ROT[k], resample=Image.BICUBIC, expand=True)
        sh = Image.new("RGBA", spr.size, (0, 0, 0, 0))
        sh.putalpha(spr.getchannel("A").point(lambda v: int(v * 0.5)).filter(ImageFilter.GaussianBlur(3)))
        paste(base, sh, ox - spr.width / 2 + 4, oy - spr.height / 2 + 5)
        paste(base, spr, ox - spr.width / 2, oy - spr.height / 2)
        py = oy - spr.height / 2 + 7
        d.ellipse([ox - 3, py - 3, ox + 3, py + 3], fill=(110, 28, 24, 255))
    return base


@shot("11h")
def s11h(ctx):
    return vhs(to_arr(board_hungry5()), ctx, "V3", tint=RED_TINT, sat=0.65)


@shot("11i")
def s11i(ctx):
    return vhs(to_arr(view(dark_room_black())), ctx, "V3", tint=RED_TINT, sat=0.65)


@shot("11j")
def s11j(ctx):
    # SCARE 3: an extreme close-up of the eyes (not another grin), looming in,
    # pushing 1.00 -> 1.06, shaking; boiling; clean while it registers, then the tape tears
    # the eyes ECU fills the frame; from frame 10 the searching eyes snap onto the lens (_c/_d)
    a = scare_framing(ctx, art("poppy_scare_final"), art("poppy_scare_final_b"), 1.0, 600.0,
                      (400.0, 300.0), 1.06, 6, swap=(10, art("poppy_scare_final_c"), art("poppy_scare_final_d")))
    return vhs(a, ctx, P=scare_level(ctx, 0.72, "V3"))


@shot("11k")
def s11k(ctx):
    return black(ctx)


# ===== END SEGMENTS =====
# Everything below is the render engine, the audio mix and the CLI; it is not
# part of any chunk's picture hash (encoder settings are hashed explicitly).

def render_frame(i, ev=None):
    ctx = Ctx(i, ev)
    fn = SHOT_FN.get(ctx.sid)
    if fn is None:
        img = placeholder_img(f"shot {ctx.sid}")
        a = to_arr(img)
    else:
        a = fn(ctx)
    return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)


# ---- chunks --------------------------------------------------------------------

CHUNK_DEFS = [
    ("c01_tape_start", 0.0, 18.0), ("c02_theme", 18.0, 41.0), ("c03_greeting", 41.0, 53.0),
    ("c04_counting", 53.0, 79.5), ("c05_feelings", 79.5, 103.5), ("c06_friends", 103.5, 121.0),
    ("c07_camcorder_a", 121.0, 145.6), ("c08_camcorder_b", 145.6, 173.1),
    ("c09_hide_seek_a", 173.1, 197.5), ("c10_hide_seek_b", 197.5, 227.8),
    ("c11_advisory", 227.8, 249.2), ("c12_see_you", 249.2, 276.6),
    ("c13_restart", 276.6, 285.4), ("c14_address", 285.4, 309.4),
]

# Shots whose picture re-renders other shots' frames (the self-rewind plays
# the tape's own earlier frames backwards): those shots' code, timing and
# assets are part of the chunk's hash too.
RENDER_DEPS = {"11a": ("10c", "10d", "10g")}


def chunk_frames(c):
    return int(round(c[1] * FPS)), int(round(c[2] * FPS))


def chunk_shots(c):
    f0, f1 = chunk_frames(c)
    return [s for s in SHOTS if s["f0"] < f1 and s["f1"] > f0]


def picture_shots(c):
    """The chunk's shots plus the shots their pictures re-render."""
    shots = chunk_shots(c)
    ids = {s["id"] for s in shots}
    for s in list(shots):
        for d in RENDER_DEPS.get(s["id"], ()):
            if d not in ids:
                ids.add(d)
                shots.append(SHOT[d])
    return shots


def code_fingerprint(code):
    """Code as it affects the picture: blank lines, full-line comments and the
    module docstring dropped, and the runtime line (each chunk hashes its own
    frame range and shot timings instead), so editing prose or the total
    length does not re-render chunks whose frames cannot have changed."""
    code = re.sub(r'\A\s*#![^\n]*\n', "", code)
    code = re.sub(r'\A\s*"""(?:.|\n)*?"""', "", code)
    code = re.sub(r"(?m)^(TOTAL|NFRAMES) = .*$", "", code)
    return "\n".join(ln.rstrip() for ln in code.splitlines() if ln.strip() and not ln.lstrip().startswith("#"))


_DEF_RE = re.compile(r"(?m)^(?:def|class)\s+([A-Za-z_]\w*)|^([A-Za-z_]\w*)\s*(?:,\s*[A-Za-z_]\w*\s*)*=(?!=)")


def source_blocks():
    """shared code, the SCARE HELPERS block and the per-segment code blocks."""
    src = open(os.path.abspath(__file__), encoding="utf-8").read()
    helpers = src.index("# ===== SCARE HELPERS =====")
    first = src.index("# ===== SEGMENT 1 =====")
    end = src.index("# ===== END SEGMENTS =====")
    blocks = {"helpers": src[helpers:first]}
    parts = re.split(r"(?m)^# ===== SEGMENT (\d+) =====\s*$", src[first:end])
    for k in range(1, len(parts), 2):
        blocks[parts[k]] = parts[k + 1]
    return src[:helpers], blocks


def code_names(code):
    """Identifiers a code block uses (comments and strings excluded)."""
    import io
    import tokenize
    try:
        return {t.string for t in tokenize.generate_tokens(io.StringIO(code).readline) if t.type == tokenize.NAME}
    except (tokenize.TokenError, IndentationError, SyntaxError):
        return set(re.findall(r"[A-Za-z_]\w*", code_fingerprint(code)))


def code_closure(segs, blocks):
    """The segment blocks `segs` plus every other block (another segment, or
    the SCARE HELPERS) that defines a name they use, transitively."""
    defs = {}
    for key, code in blocks.items():
        for m in _DEF_RE.finditer(code):
            defs.setdefault(m.group(1) or m.group(2), set()).add(key)
    todo, seen = list(segs), set()
    while todo:
        key = todo.pop()
        if key in seen or key not in blocks:
            continue
        seen.add(key)
        for name in code_names(blocks[key]):
            todo.extend(defs.get(name, ()))
    return sorted(seen, key=lambda k: (not k.isdigit(), int(k) if k.isdigit() else 0, k))


_file_hashes = {}


def file_hash(rel):
    if rel not in _file_hashes:
        p = os.path.join(HERE, rel)
        try:
            _file_hashes[rel] = hashlib.sha1(open(p, "rb").read()).hexdigest()
        except OSError:
            _file_hashes[rel] = "missing"
    return _file_hashes[rel]


ALWAYS_ASSETS = ["build/rooms/rooms_meta.json"]
# The storyboard and the audio manifest feed the picture only through the
# shots' timings and the song lyrics (captions), so only those are hashed, per
# chunk: editing the storyboard's prose, re-timing another segment or
# re-rendering an audio stem does not force a picture re-render.


def chunk_hash(c):
    shared, blocks = source_blocks()
    shots = picture_shots(c)
    keys = code_closure({s["seg"] for s in shots}, blocks)
    h = hashlib.sha1()
    h.update(code_fingerprint(shared).encode())
    for k in keys:
        h.update(k.encode())
        h.update(code_fingerprint(blocks[k]).encode())
    h.update(repr(chunk_frames(c)).encode())
    h.update(" ".join(X264).encode())
    h.update(json.dumps([[s["id"], s["seg"], s["f0"], s["f1"]] for s in shots]).encode())
    code = " ".join(blocks[k] for k in keys)
    if "THEME_LYRICS" in code:
        h.update(json.dumps(THEME_LYRICS).encode())
    if "REPRISE_LYRICS" in code:
        h.update(json.dumps(REPRISE_LYRICS).encode())
    rels = set(ALWAYS_ASSETS)
    for s in shots:
        for a in s["assets"]:
            if a.endswith(".png"):
                rels.add(a)
            elif a.endswith(".wav") and "/vo_" in a:
                rels.add(a.replace(".wav", ".env.json"))
    # assets used by code but not listed for the shot (the same few everywhere)
    rels.update([misc("sm_logo"), misc("bumper_bg"), misc("title_card"), art("poppy_idle"),
                 misc("end_card_cracked"), "build/rooms/playroom_wide.png"])
    for r in sorted(rels):
        h.update(r.encode())
        h.update(file_hash(r).encode())
    return h.hexdigest()


def chunk_paths(c):
    return os.path.join(CHUNK_DIR, c[0] + ".mp4"), os.path.join(CHUNK_DIR, c[0] + ".json")


def chunk_done(c):
    mp4, js = chunk_paths(c)
    if not (os.path.exists(mp4) and os.path.exists(js)):
        return False
    try:
        info = json.load(open(js))
    except Exception:  # noqa: BLE001
        return False
    return info.get("hash") == chunk_hash(c)


def render_chunk(name):
    c = next(c for c in CHUNK_DEFS if c[0] == name)
    f0, f1 = chunk_frames(c)
    os.makedirs(CHUNK_DIR, exist_ok=True)
    mp4, js = chunk_paths(c)
    tmp = mp4 + ".part.mp4"
    hsh = chunk_hash(c)
    t0 = time.time()
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", *X264, tmp],
                          stdin=subprocess.PIPE)
    events = {"drop": [], "trk": []}
    for i in range(f0, f1):
        ev = {}
        fr = render_frame(i, ev)
        ff.stdin.write(fr.tobytes())
        if ev.get("drop"):
            events["drop"].append([i, int(ev["drop"])])
        if ev.get("trk"):
            events["trk"].append(i)
        if (i - f0) % 150 == 0:
            print(f"  [{name}] {(i - f0) / FPS:5.1f}s / {(f1 - f0) / FPS:.1f}s  "
                  f"({time.time() - t0:.0f}s)", flush=True)
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit(f"ffmpeg failed for {name}")
    os.replace(tmp, mp4)
    with open(js + ".tmp", "w") as f:
        json.dump({"name": name, "hash": hsh, "frames": [f0, f1], "seconds": round(time.time() - t0, 1),
                   "missing": sorted(set(MISSING)), "events": events}, f)
    os.replace(js + ".tmp", js)
    print(f"  [{name}] done in {time.time() - t0:.0f}s", flush=True)


def render_chunks(force, jobs):
    todo = []
    for c in CHUNK_DEFS:
        forced = ("all" in force or c[0] in force or any(s["seg"] in force or s["id"] in force
                                                          for s in chunk_shots(c)))
        if forced or not chunk_done(c):
            todo.append(c[0])
    if not todo:
        print("All chunks up to date.")
        return
    # longest first
    todo.sort(key=lambda n: -dict((c[0], c[2] - c[1]) for c in CHUNK_DEFS)[n])
    print(f"Rendering {len(todo)} chunk(s) with {jobs} process(es): {', '.join(todo)}")
    running = []
    logs = {}
    while todo or running:
        while todo and len(running) < jobs:
            n = todo.pop(0)
            log = open(os.path.join(CHUNK_DIR, n + ".log"), "w")
            p = subprocess.Popen([sys.executable, os.path.abspath(__file__), "--render-chunk", n],
                                 stdout=log, stderr=subprocess.STDOUT)
            running.append((n, p))
            logs[n] = log
        time.sleep(1.0)
        for n, p in list(running):
            if p.poll() is not None:
                running.remove((n, p))
                logs[n].close()
                if p.returncode != 0:
                    print(open(os.path.join(CHUNK_DIR, n + ".log")).read()[-3000:])
                    for _, q in running:
                        q.terminate()
                    raise SystemExit(f"chunk {n} failed")
                print(f"  chunk {n} finished", flush=True)


def concat_chunks():
    lst = os.path.join(CHUNK_DIR, "concat.txt")
    with open(lst, "w") as f:
        for c in CHUNK_DEFS:
            f.write(f"file '{chunk_paths(c)[0]}'\n")
    out = os.path.join(BUILD, "video_concat.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-c", "copy", out], check=True)
    return out


def chunk_events():
    drops, trk = {}, set()
    for c in CHUNK_DEFS:
        js = chunk_paths(c)[1]
        if os.path.exists(js):
            ev = json.load(open(js)).get("events", {})
            for i, n in ev.get("drop", []):
                drops[i] = n
            trk.update(ev.get("trk", []))
    return drops, trk


# ---- audio ---------------------------------------------------------------------

def db(x):
    return 10 ** (x / 20.0)


@lru_cache(None)
def stem(name):
    p = os.path.join(BUILD, "audio", name + ".wav")
    try:
        with wave.open(p) as w:
            rate, ch = w.getframerate(), w.getnchannels()
            x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        if ch > 1:
            x = x.reshape(-1, ch).mean(1)
        if rate != SR:
            x = np.interp(np.arange(int(len(x) * SR / rate)) * rate / SR, np.arange(len(x)), x).astype(np.float32)
        return x
    except Exception as e:  # noqa: BLE001
        MISSING.append(f"build/audio/{name}.wav ({e.__class__.__name__})")
        n = int(AMAN.get(f"build/audio/{name}.wav", {}).get("duration", 1.0) * SR)
        t = np.arange(n) / SR
        return (0.3 * np.sin(2 * np.pi * 440 * t) * (np.sin(2 * np.pi * 4 * t) > 0)).astype(np.float32)


def info(name):
    return AMAN.get(f"build/audio/{name}.wav", {})


def g_peak(name, d):
    x = stem(name)
    return db(d) / max(1e-6, float(np.max(np.abs(x))))


def g_rms(name, d):
    x = stem(name)
    return db(d) / max(1e-6, float(np.sqrt(np.mean(x.astype(np.float64) ** 2))))


def S(t):
    return int(round(t * SR))


def fades(x, fin=0.0, fout=0.0):
    x = x.copy()
    a, r = min(S(fin), len(x)), min(S(fout), len(x))
    if a:
        x[:a] *= np.linspace(0, 1, a, dtype=np.float32)
    if r:
        x[-r:] *= np.linspace(1, 0, r, dtype=np.float32)
    return x


def trim(x, dur, fout=0.005):
    return fades(x[:S(dur)], 0.0, fout)


def looped(name, dur, offset=0.0):
    x = stem(name)
    idx = (np.arange(S(dur)) + S(offset)) % len(x)
    return x[idx]


def resample(x, factor):
    n = int(len(x) / factor)
    return np.interp(np.arange(n) * factor, np.arange(len(x)), x).astype(np.float32)


def varispeed(x, speed):
    """Play x with a per-output-sample speed curve (len(speed) output samples)."""
    pos = np.cumsum(speed) - speed[0]
    pos = np.clip(pos, 0, len(x) - 1)
    return np.interp(pos, np.arange(len(x)), x).astype(np.float32)


def smooth_filter(x, lo=None, hi=None, order=2):
    """Zero-phase Butterworth-magnitude band limit via FFT (low ringing)."""
    n = len(x)
    nfft = 1 << int(math.ceil(math.log2(n + SR // 2)))
    spec = np.fft.rfft(x, nfft)
    f = np.fft.rfftfreq(nfft, 1 / SR)
    g = np.ones_like(f)
    if lo:
        with np.errstate(divide="ignore"):
            g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    return np.fft.irfft(spec * g, nfft)[:n].astype(np.float32)


def env(n, pts):
    """Piecewise-linear gain curve over n samples; pts = [(t_rel, gain), ...]."""
    ts = np.array([p[0] for p in pts]) * SR
    gs = np.array([p[1] for p in pts])
    return np.interp(np.arange(n), ts, gs).astype(np.float32)


class Bus:
    def __init__(self, n):
        self.x = np.zeros((2, n), np.float32)

    def add(self, sig, at, gain=1.0, pan=0.0):
        s = S(at)
        if s >= self.x.shape[1]:
            return
        sig = np.asarray(sig, np.float32)[: self.x.shape[1] - s]
        gl, gr = gain * (1 - max(0.0, pan)), gain * (1 + min(0.0, pan))
        self.x[0, s:s + len(sig)] += sig * gl
        self.x[1, s:s + len(sig)] += sig * gr


def tape_noise(n, seed):
    rng = np.random.default_rng(seed)
    return rng.standard_normal(n).astype(np.float32)


def dense(x, drive):
    """Soft saturation to peak 1: raises a stinger's density (RMS) without a
    limiter's pumping; the attack stays under 5 ms."""
    x = x / max(1e-6, float(np.max(np.abs(x))))
    return (np.tanh(drive * x) / np.tanh(drive)).astype(np.float32)


def band_noise(n, seed, lo, hi):
    x = smooth_filter(tape_noise(n, seed), lo, hi, 2)
    return x / max(1e-6, float(np.max(np.abs(x))))


def scare1_hit():
    """SCARE 1 (7o): sfx_stinger_1 with a full-band body under it (a 55->38 Hz
    thump and a noise burst), plus the camcorder mic overloading (tanh drive)
    for the first 0.3 s: only that overload layer is band-limited to the
    camcorder's 100 Hz-6 kHz.  Runs through 7p; 7q cuts it."""
    s1 = stem("sfx_stinger_1")
    s1 = s1 / max(1e-6, float(np.max(np.abs(s1))))
    n = S(T("7q") - T("7o"))
    s1 = np.pad(s1, (0, max(0, n - len(s1))))[:n]
    t = np.arange(n) / SR
    att = np.clip(t / 0.003, 0, 1)
    f = 38 + 17 * np.exp(-t / 0.12)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28) * att
    burst = band_noise(n, 31, 150, 5000) * np.exp(-t / 0.42) * att
    body = s1 + 0.55 * thump + 0.5 * burst
    over = smooth_filter(np.tanh(5.0 * body), 100, 6000)
    ov = np.exp(-np.maximum(0, t - 0.3) / 0.06)                     # overload for ~0.3 s
    x = dense(0.75 * body + 0.6 * over * ov, 2.6)
    return fades(x * 0.8, 0.0, 0.005)


def scare2_hit():
    """SCARE 2 (8m): the rough whispered 'Ten.' on the first frame inside a
    dense sfx_stinger_2 (which leaves a 2-4 kHz notch for it); whisper and
    stinger scaled together."""
    d = T("8n") - T("8m")
    s2 = dense(stem("sfx_stinger_2")[:S(d)], 2.2)
    w = stem("vo_hs_10")[:S(d)]
    w = w / max(1e-6, float(np.max(np.abs(w))))
    m = min(len(s2), len(w))
    both = s2.copy()
    both[:m] = 0.8 * both[:m] + 0.6 * w[:m]
    both = smooth_filter(both, None, 9000)
    both = dense(both, 1.6)
    return fades(both * 0.97, 0.0, 0.005)


def scare3_hit():
    """SCARE 3 (11j): sfx_stinger_3 + sfx_scream (Poppy's own voice, torn), the
    loudest moment of the tape; 11k cuts it to digital silence."""
    d = T("11k") - T("11j")
    s3 = stem("sfx_stinger_3")[:S(d)]
    sc = stem("sfx_scream")[:S(d - 0.02)]
    s3 = s3 / max(1e-6, float(np.max(np.abs(s3))))
    sc = sc / max(1e-6, float(np.max(np.abs(sc)))) * db(-2)
    off = S(0.02)
    both = s3.copy()
    both[off:off + len(sc)] += sc[:len(both) - off]
    # a long 40 Hz body under it (48 -> 38 Hz, ~0.7 s decay): the climax is felt as well as heard
    n = len(both)
    t = np.arange(n) / SR
    f = 38 + 10 * np.exp(-t / 0.2)
    thump = (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7) * np.clip(t / 0.004, 0, 1)).astype(np.float32)
    both = both + 0.7 * thump
    both = dense(both, 3.2)
    both = smooth_filter(both, None, 9000)
    both *= 0.97 / np.max(np.abs(both))
    return fades(both, 0.0, 0.005)


def teleprinter_tick():
    """One soft character-generator tick: a 3 ms click and a short 2.6 kHz ping."""
    n = S(0.03)
    t = np.arange(n) / SR
    x = tape_noise(n, 41) * np.exp(-t / 0.0015) * 0.7
    x += np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.006) * 0.6
    x += np.sin(2 * np.pi * 1150 * t) * np.exp(-t / 0.01) * 0.35
    x = smooth_filter(x.astype(np.float32), 300, 7000)
    return (x / max(1e-6, float(np.max(np.abs(x))))).astype(np.float32)


def build_audio(out_path):
    n = S(TOTAL)
    # prog: the programme (wow, flutter, tape bandwidth, dropouts); hits: the
    # three scares (full band, no limiter); sub: sub-bass pressure that the
    # 80 Hz tape high-pass would eat; deck: the VCR's own mechanism sounds
    prog, hits, deck, sub = Bus(n), Bus(n), Bus(n), Bus(n)

    def pk(name, at, d, pan=0.0, x=None):
        sig = stem(name) if x is None else x
        prog.add(sig, at, g_peak(name, d), pan)

    def amb(name, t0, t1, d, offset=0.0, pts=None, fin=0.05, fout=0.05):
        sig = looped(name, t1 - t0, offset)
        if pts:
            sig = sig * env(len(sig), pts)
        prog.add(fades(sig, fin, fout), t0, g_rms(name, d))

    def close_breath(x, at, d):
        """Someone breathing right beside you: 85% left, with a 15 ms Haas copy at -12 dB on the right."""
        g = g_peak("sfx_breath_close", d)
        prog.add(x, at, g, pan=-0.85)
        prog.add(x, at + 0.015, g * db(-12), pan=1.0)

    # Gain staging (peak dBFS unless noted): dialogue -11, theme/narrator -11,
    # bumpers -14, show music bed -14 in gaps ducked 8 dB under dialogue,
    # ambiences/room tone as RMS targets, hiss -43 RMS, misdirection cues -15
    # hard-panned, false scares -12, stingers dense at ~-1 so every real scare
    # is 12 dB or more above the loudest dialogue (400 ms RMS).
    V = -11.0                     # dialogue / narrator peak

    # ---- segment 1
    deck.add(stem("sfx_vcr_insert"), 0.0, g_peak("sfx_vcr_insert", -17))
    pk("sfx_static_burst", 3.5, -22, x=trim(stem("sfx_static_burst"), 1.0, 0.3))
    pk("sfx_tracking_garble", 4.1, -26)
    bars = stem("sfx_bars_tone")
    sp = np.ones(len(bars), np.float32)
    sp[:S(0.4)] = np.linspace(0.6, 1.0, S(0.4))
    pk("sfx_bars_tone", 4.5, -24, x=fades(varispeed(bars, sp)[:S(3.5)], 0.0, 0.01))
    pk("mus_ident_chime", 8.1, -13)
    pk("vo_narr_ident", 9.2, V)
    pk("sfx_tracking_garble", 17.5, -28, x=trim(stem("sfx_tracking_garble"), 0.4, 0.05))

    # ---- segment 2: theme
    pk("mus_theme", 18.0, V)
    for k in range(4):
        pk("sfx_pop", 26.1 + 0.6 * k, -23)

    # ---- the show's music bed: 3a until the freeze, back mid-phrase in 4d, until 6e.
    # Loud enough in the gaps to sound like a bouncy kids' show (and so that its
    # hard cuts at 4c and 6e are felt as a sudden absence), ducked 8 dB under
    # every line of dialogue and 6 dB under the bumpers.
    t_bed0, t_bed1 = 41.0, 113.5
    bed = looped("mus_playroom_bed", t_bed1 - t_bed0)
    sag0 = S(94.2 - t_bed0)
    spd = np.ones(len(bed), np.float32)
    u = np.linspace(0, 1, S(0.4))
    spd[sag0:sag0 + len(u)] = 1 - 0.3 * np.sin(np.pi * u)
    bed = varispeed(np.concatenate([bed, bed[:S(1)]]), spd)[:len(bed)]
    gate = env(len(bed), [(0, 1), (53.0 - t_bed0, 1), (53.03 - t_bed0, 0.5), (54.97 - t_bed0, 0.5),
                          (55.0 - t_bed0, 1), (66.497 - t_bed0, 1), (66.5 - t_bed0, 0), (73.5 - t_bed0, 0),
                          (73.503 - t_bed0, 1), (79.5 - t_bed0, 1), (79.53 - t_bed0, 0.5),
                          (81.47 - t_bed0, 0.5), (81.5 - t_bed0, 1), (103.5 - t_bed0, 1),
                          (103.53 - t_bed0, 0.5), (105.47 - t_bed0, 0.5), (105.5 - t_bed0, 1),
                          (113.497 - t_bed0, 1), (113.5 - t_bed0, 0)])
    show_lines = [("vo_greet_1", 41.5), ("vo_greet_2", 46.0), ("vo_greet_3", 49.6), ("vo_count_intro", 55.3)]
    show_lines += [(f"vo_count_{k + 1}", T("4b") + t) for k, t in enumerate(COUNT_POP)]
    show_lines += [("vo_count_done", 73.9), ("vo_feel_intro", 81.8)]
    show_lines += [(f"vo_feel_{nm}", 86.1 + 2 * k) for k, nm in enumerate(["happy", "sad", "angry", "scared"])]
    show_lines += [("vo_feel_hungry", 97.3), ("vo_feel_hungry_2", 99.7), ("vo_friends_intro", 105.7),
                   ("vo_friends_buttons", 108.4), ("vo_friends_dot", 111.4)]
    duck = np.ones(len(bed), np.float32)
    for name, t in show_lines:
        x = stem(name)
        loud = np.nonzero(np.abs(x) > 0.02)[0]
        a0, a1 = t - t_bed0 + loud[0] / SR, t - t_bed0 + loud[-1] / SR
        duck = np.minimum(duck, env(len(bed), [(0, 1), (a0 - 0.08, 1), (a0, db(-8)), (a1 + 0.05, db(-8)),
                                               (a1 + 0.3, 1), (t_bed1 - t_bed0 + 1, 1)]))
    prog.add(bed * gate * duck, t_bed0, g_peak("mus_playroom_bed", -14))

    # ---- segment 3
    pk("vo_greet_1", 41.5, V)
    pk("vo_greet_2", 46.0, V)
    pk("vo_greet_3", 49.6, V)

    # ---- segment 4
    pk("mus_bumper", 53.0, -14)
    pk("vo_count_intro", 55.3, V)
    for k, t in enumerate(COUNT_POP):
        at = T("4b") + t
        if k < 4:
            pk("sfx_pop", at, -21)
        else:
            pk("sfx_pop", at, -21, x=resample(stem("sfx_pop"), 0.7))
        pk(f"vo_count_{k + 1}", at, V)
    amb("amb_room_tone", 66.5, 73.5, -42, fin=0.003, fout=0.003)
    amb("amb_drone", 69.5, 73.5, -36, pts=[(0, 0), (3.0, 1), (4.0, 1)], fin=0.0, fout=0.003)
    # the first, barely-there Ligeti shimmer under the freeze, cut dead with the drone
    amb("amb_cluster", 69.5, 73.5, -42, pts=[(0, 0), (3.0, 1), (4.0, 1)], fin=0.0, fout=0.003)
    pk("vo_count_done", 73.9, V)

    # ---- segment 5
    pk("mus_bumper", 79.5, -14)
    pk("vo_feel_intro", 81.8, V)
    for k, name in enumerate(["happy", "sad", "angry", "scared"]):
        pk("sfx_pop", 86.0 + 2 * k, -21)
        pk(f"vo_feel_{name}", 86.1 + 2 * k, V)
    pk("sfx_tracking_garble", 94.2, -24, x=trim(stem("sfx_tracking_garble"), 0.15, 0.03))
    pk("vo_feel_hungry", 97.3, V + 1)
    pk("vo_feel_hungry_2", 99.7, V + 1)

    # ---- segment 6
    pk("mus_bumper", 103.5, -14, x=resample(stem("mus_bumper"), 0.97))
    pk("vo_friends_intro", 105.7, V)
    pk("sfx_pop", 108.0, -21)
    pk("vo_friends_buttons", 108.4, V)
    pk("sfx_pop", 111.0, -21)
    pk("vo_friends_dot", 111.4, V)
    pk("sfx_scribble", 114.0, -20, x=trim(stem("sfx_scribble"), 1.1, 0.25))   # a beat of nothing after the hard cut
    pk("vo_friends_pip", 114.4, V - 1, x=smooth_filter(stem("vo_friends_pip"), 200, 3000))
    amb("amb_room_tone", 116.5, 120.0, -42, fin=0.01, fout=0.003)
    pk("vo_friends_pip_2", 116.7, V + 1)
    pk("sfx_tracking_garble", 120.0, -21)
    click = np.zeros(S(0.1), np.float32)
    click[:S(0.004)] = np.linspace(1, -1, S(0.004))
    click += tape_noise(len(click), 5) * np.exp(-np.linspace(0, 12, len(click))).astype(np.float32) * 0.6
    prog.add(click, 120.3, db(-17) / np.max(np.abs(click)))
    pk("sfx_static_burst", 120.7, -22, x=trim(stem("sfx_static_burst"), 0.3, 0.02))

    # ---- segment 7: camcorder
    pk("sfx_cam_beep", T("7a") + 0.1, -21)
    tt = np.arange(S(T("8a") - T("7a"))) / SR
    whine = (np.sin(2 * np.pi * 1180 * tt + 3 * np.sin(2 * np.pi * 0.7 * tt)) +
             0.5 * np.sin(2 * np.pi * 2360 * tt) + 0.35 * np.sin(2 * np.pi * 395 * tt)).astype(np.float32)
    whine *= db(-50) / np.sqrt(np.mean(whine ** 2))
    prog.add(fades(whine, 0.2, 0.003), T("7a"))
    amb("amb_studio_night", T("7b"), T("7e"), -36, fin=0.3, fout=0.2)
    fs = looped("sfx_footsteps", T("7c") - (T("7b") + 0.5))
    pk("sfx_footsteps", T("7b") + 0.5, -28, x=fades(fs, 0.1, 0.01))
    pk("vo_crew_1", T("7b") + 1.5, V - 2)
    pk("sfx_clunk", T("7c"), -12, pan=0.6)                    # false scare 1, screen-right
    pk("vo_crew_2", T("7d") + 0.4, V - 2)
    pk("vo_crew_3", T("7d") + 1.8, V - 2)
    # the fluorescent hum: -34 in the corridor, -36 in the dressing room, -38
    # under the empty chair; it dies with the lights (7j)
    e0 = T("7e")
    amb("amb_fluorescent", e0, T("7j"), -34, fin=0.15, fout=0.004,
        pts=[(0, 1), (T("7f") - e0, 1), (T("7f") - e0 + 0.2, db(-2)), (T("7h") - e0, db(-2)),
             (T("7h") - e0 + 0.2, db(-4)), (T("7j") - e0, db(-4))])
    pk("sfx_footsteps", T("7e"), -27, x=fades(looped("sfx_footsteps", T("7f") - T("7e"), 2.0), 0.05, 0.2))
    pk("vo_crew_4", T("7e") + 1.0, V - 2)
    pk("vo_crew_5", T("7f") + 2.5, V - 2)
    # 7g +7.0 s: a faint, muffled 'friend?' from behind the camera (hard right), Poppy's own voice
    # (the last word of vo_friends_pip_2); nobody reacts.  Pays off memo item 4.
    fr = smooth_filter(fades(stem("vo_friends_pip_2")[S(2.62):], 0.02, 0.06), 150, 800, 3)
    prog.add(fr, T("7g") + 7.0, db(-25) / max(1e-6, float(np.max(np.abs(fr)))), pan=1.0)
    # the Shepard riser replaces the old drone swell: from 7h it climbs for
    # 13.5 s (about -40 -> -28 dBFS RMS) and is cut DEAD on a zero crossing
    # at 7m +1.0 s, together with the hum
    cut1 = T("7m") + 1.0
    rs = stem("sfx_shepard_riser")[:S(cut1 - T("7h")) + 400]
    zc = np.nonzero(np.diff(np.signbit(rs[S(cut1 - T("7h")) - 400:])))[0]
    rs = rs[:S(cut1 - T("7h")) - 400 + (int(zc[0]) + 1 if len(zc) else 400)]
    prog.add(rs, T("7h"), db(-28) / float(np.sqrt(np.mean(rs[-SR:] ** 2))))
    pk("vo_crew_6", T("7h") + 2.2, V - 4)
    amb("amb_fluorescent", T("7k"), cut1, -36, offset=4.0, fin=0.004, fout=0.004)
    amb("amb_room_tone", cut1, T("7o"), -42, fin=0.3, fout=0.003)
    pk("sfx_hanger", T("7n") + 0.5, -13, pan=-0.95)          # the ONE sound: pulls the eye hard LEFT
    hits.add(scare1_hit(), T("7o"), db(-2.0))                # scare 3 must be the loudest of the three
    pk("sfx_cam_drop", T("7p"), -10)
    pk("sfx_static_burst", T("7p") + 0.3, -20, x=trim(stem("sfx_static_burst"), 0.2, 0.01))

    # ---- segment 8
    pk("sfx_tracking_garble", T("8a"), -22)
    amb_bw = looped("mus_playroom_bed_wrong", T("8c") - T("8b"))
    prog.add(fades(amb_bw, 0.01, 0.003), T("8b"), g_peak("mus_playroom_bed_wrong", -17))
    pk("sfx_preecho_welcome", T("8b"), -22)                   # the reversed ghost of 'Welcome'
    pk("vo_wrong_welcome", T("8b") + 1.0, V)
    pk("vo_wrong_game", T("8b") + 5.0, V)
    hold = T("8k") + 7.0                                      # everything is cut dead here
    amb("amb_drone", T("8c"), hold, -40, pts=[(0, 1), (T("8k") + 2.0 - T("8c"), 1), (hold - T("8c"), db(6))],
        fin=0.2, fout=0.004)
    amb("amb_house_night", T("8d"), hold, -38, fin=0.2, fout=0.004)
    amb("amb_room_tone", hold - 0.5, T("8m"), -42, fin=0.5, fout=0.003)
    pk("vo_hs_1", T("8c") + 0.4, V)
    pk("vo_hs_2", T("8d") + 0.4, V - 5, x=smooth_filter(stem("vo_hs_2"), 300, 3000, 3))     # from the TV
    pk("vo_hs_3", T("8e") + 0.5, V - 9, pan=-0.5, x=smooth_filter(stem("vo_hs_3"), 300, 3000, 3))
    pk("vo_hs_4", T("8f") + 0.6, V)
    pk("vo_hs_5", T("8g") + 0.6, V)
    pk("sfx_toy_fall", T("8g") + 2.0, -12, pan=-0.6)          # false scare 2, screen-left
    pk("vo_hs_6", T("8h") + 0.7, V)
    pk("sfx_tracking_garble", T("8i"), -26, x=trim(stem("sfx_tracking_garble"), 0.15, 0.02))
    pk("vo_hs_7", T("8i") + 0.8, V)
    pk("vo_hs_8", T("8j") + 1.0, V + 1, pan=-0.2)
    pk("vo_hs_9", T("8k") + 1.2, V + 1)
    # the hold: cluster shimmer + breathing sub-bass + someone breathing right
    # beside you (20 % left); the second inhale ends at +7.0 s and is HELD;
    # cut dead on one frame
    amb("amb_cluster", T("8k") + 2.0, hold, -35, pts=[(0, 0), (5.0, 1)], fin=0.0, fout=0.004)
    sub.add(fades(looped("amb_sub_breath", hold - T("8k") - 2.0), 0.4, 0.004), T("8k") + 2.0,
            g_rms("amb_sub_breath", -33))
    br = fades(stem("sfx_breath_close")[:S(hold - (T("8k") + 2.4))], 0.0, 0.004)
    close_breath(br, T("8k") + 2.4, -10)
    pk("sfx_door_creak", T("8l") + 2.2, -13, pan=-0.95, x=trim(stem("sfx_door_creak"), 0.8, 0.1))   # hard LEFT
    hits.add(scare2_hit(), T("8m"), db(-2.0))
    # 8o, your screen: hiss creeps back from digital zero (in the tape-noise
    # envelope below); the bedroom's fridge hum and clock; sub-bass pressure
    amb("amb_house_night", T("8o") + 0.5, T("9a"), -50, fin=1.5, fout=0.004)
    sub.add(fades(looped("amb_sub_breath", T("9a") - T("8o") - 1.0, 3.0), 2.0, 0.004), T("8o") + 1.0,
            g_rms("amb_sub_breath", -32))

    # ---- segment 9: the music box (played from 2.1 s into its file, so it dies
    # mid-phrase on 9d's first frame) and the character generator ticking as
    # each card types on
    mb0 = 2.1
    mb = stem("mus_music_box")[S(mb0):S(mb0 + T("9d") - T("9a"))]
    # ducked 4 dB under the narrator and 3 dB under the whispers; its last
    # phrase swells a little so the death is felt
    t9 = T("9a")
    wh0 = T("9b") + 0.6
    mbd = env(len(mb), [(0, 1), (0.5, 1), (0.6, db(-4)), (7.2, db(-4)), (7.5, 1), (wh0 - t9 - 0.3, 1),
                        (wh0 - t9, db(-14)), (wh0 - t9 + 5.8, db(-14)), (wh0 - t9 + 6.2, 1),
                        (T("9d") - t9 - 2.0, 1), (T("9d") - t9 - 0.5, db(2.5)), (30, db(2.5))])
    pk("mus_music_box", t9, -15, x=fades(mb * mbd, 0.0, 0.004))
    pk("vo_narr_adv_a", T("9a") + 0.6, V)
    # 'where do you live?': phrase 1 hard LEFT, 2 hard RIGHT, 3 hard LEFT, each
    # with a Haas double 22 ms later on the opposite side at -8 dB
    wx = stem("vo_whisper_where")
    wi = info("vo_whisper_where")
    spans = wi.get("phrase_spans") or [[0.0, 1.9], [1.9, 3.8], [3.8, len(wx) / SR]]
    pans = wi.get("pan") or [-1.0, 1.0, -1.0]
    # each phrase gets its own gain from its own RMS (phrases 1-2 at -29 dBFS RMS, 3 at -26), the loud
    # 'friend' burst soft-limited at -12 dBFS; the Haas double on the far side at -12 dB so the
    # side stays readable
    hd, hg = wi.get("haas_ms", 22) / 1000.0, db(-12)
    lim = db(-12)
    for (p0, p1), pn, tgt in zip(spans, pans, (-29.0, -29.0, -26.0)):
        seg = wx[S(p0):S(min(len(wx) / SR, p1 + 0.05))]
        seg = seg * (db(tgt) / max(1e-6, float(np.sqrt(np.mean(seg.astype(np.float64) ** 2)))))
        seg = fades((np.tanh(seg / lim) * lim).astype(np.float32), 0.0, 0.03)
        prog.add(seg, wh0 + p0, 1.0, pan=pn)
        prog.add(seg, wh0 + p0 + hd, hg, pan=-pn)
    pk("sfx_tracking_garble", T("9c") + GLITCH_9C, -24, x=trim(stem("sfx_tracking_garble"), 0.3, 0.03))
    tick = teleprinter_tick()
    for sid in ("9a", "9b", "9c", "9d"):
        body = ADVISORY[sid[1].upper()]["body"]
        for k, ch in enumerate(body):
            t = T(sid) + 0.35 + (k + 1) / 25.0
            if ch == " " or t >= T(sid) + SHOT[sid]["dur"] or (sid == "9c" and t >= T("9c") + GLITCH_9C):
                continue
            g = db(-34 + 2.5 * (h01("tick", sid, k) - 0.5))
            prog.add(tick if h01("tickp", sid, k) < 0.6 else resample(tick, 0.9), t, g)

    # ---- segment 10: the show 'ends'
    pk("sfx_static_burst", T("10a"), -26, x=trim(stem("sfx_static_burst"), 0.3, 0.03))
    pk("mus_reprise", T("10b"), V - 2)
    pk("vo_end_see_you", T("10c") + 7.0, V - 1)
    pk("sfx_tracking_garble", T("10e"), -24)
    pk("sfx_static_burst", T("10f"), -24, x=trim(stem("sfx_static_burst"), 0.5, 0.05))
    amb("amb_house_night", T("10g"), T("10i"), -46, fin=0.3, fout=0.01)
    deck.add(stem("sfx_vcr_stop"), T("10h") + 0.5, g_peak("sfx_vcr_stop", -15))

    # ---- segment 11: the tape does not stop (11a's rewind is added after the
    # tape stop, from the mix itself)
    ins = stem("sfx_vcr_insert")[S(0.5):]
    pk("sfx_vcr_insert", T("11b") + 0.1, -16, x=fades(ins, 0.0, 0.02))
    bars2 = stem("sfx_bars_tone")
    nb = S(T("11d") - T("11c"))
    bars2 = varispeed(np.concatenate([bars2] * 2), np.linspace(1.0, 0.6, nb).astype(np.float32))[:nb]
    pk("sfx_bars_tone", T("11c"), -22, x=fades(bars2, 0.0, 0.004))
    pk("sfx_tracking_garble", T("11d"), -22)
    cut3 = T("11i")                                          # everything but room tone and hiss dies here
    sub.add(fades(looped("amb_sub_breath", cut3 - T("11d") - 0.5), 1.0, 0.004)
            * env(S(cut3 - T("11d") - 0.5), [(0, 1), (T("11e") - T("11d") - 0.5, 1),
                                             (T("11f") - T("11d") - 0.5, db(2)), (60, db(2))]),
            T("11d") + 0.5, g_rms("amb_sub_breath", -30))
    pk("sfx_preecho_tried", T("11d") + 0.6, -22)
    pk("vo_wrong_stop", T("11d") + 1.6, V)
    pk("vo_addr_1", T("11e") + 0.4, V + 0.3)                  # the happy Act 1 voice, talking to YOU, close
    pk("vo_addr_2", T("11e") + 3.0, V + 0.3)
    pk("vo_addr_3", T("11e") + 6.0, V + 0.3)
    pk("vo_wrong_again", T("11e") + 8.4, V)
    amb("amb_cluster", T("11e") + 6.0, cut3, -34, pts=[(0, 0), (cut3 - T("11e") - 6.0, 1)], fin=0.0, fout=0.004)
    amb("amb_drone", T("11f"), cut3, -40, pts=[(0, 1), (cut3 - T("11f"), db(4))], fin=0.4, fout=0.004)
    pk("vo_hs_1", T("11f") + 0.3, V - 2)
    pk("vo_hs_2", T("11g") + 0.3, V - 2)
    pk("vo_hs_3", T("11h") + 0.3, V - 2)
    amb("amb_room_tone", cut3, T("11j"), -46, fin=0.003, fout=0.003)
    # the ONE sound before the hit: an inhale right beside you at +1.5 s (0.8 s), then 0.9 s of held breath
    inh = fades(stem("sfx_breath_close")[S(3.5):S(4.3)], 0.06, 0.01)
    close_breath(inh, cut3 + 1.5, -19)
    hits.add(scare3_hit(), T("11j"))

    # ---- picture-synced tape damage: audio dropouts and garbles on tracking bursts
    drops, trk = chunk_events()
    dip = np.ones(n, np.float32)
    clusters = 0
    last = -1e9
    for i in sorted(drops):
        tot = sum(drops.get(j, 0) for j in range(i - 2, i + 1))
        quiet = any(a <= i / FPS < b for a, b in ((T("7o"), T("8a")), (T("8m"), T("9a")), (T("10g"), T("11b")),
                                                   (T("11i"), TOTAL)))
        if tot >= 4 and i / FPS - last >= 3.0 and not quiet:
            last = i / FPS
            dur = 0.02 + 0.13 * h01("adrop", i)
            a, b = S(i / FPS), S(i / FPS + dur)
            r = S(0.003)
            seg = np.full(b - a, db(-20), np.float32)
            seg[:r] = np.linspace(1, db(-20), r)
            seg[-r:] = np.linspace(db(-20), 1, r)
            dip[a:b] = np.minimum(dip[a:b], seg)
            clusters += 1
    g = trim(stem("sfx_tracking_garble"), 0.12, 0.03)
    onsets = [i for i in sorted(trk) if i - 1 not in trk]
    for i in onsets:
        prog.add(g, i / FPS, g_peak("sfx_tracking_garble", -32))
    print(f"  audio: {clusters} dropout dips, {len(onsets)} tracking garbles from the picture")

    # ---- tape transport: wow and flutter (0.2% in Act 1 rising to 1-3%), bandwidth
    x = prog.x
    cr = 1000
    nc = int(TOTAL * cr) + 2
    tc = np.arange(nc) / cr
    rng = np.random.default_rng(77)
    wowf = sum(np.sin(2 * np.pi * f * tc + p) for f, p in zip(rng.uniform(0.5, 1.5, 4), rng.uniform(0, 6.3, 4))) / 2
    flut = sum(np.sin(2 * np.pi * f * tc + p) for f, p in zip(rng.uniform(6, 12, 4), rng.uniform(0, 6.3, 4))) / 2
    depth = np.interp(tc, [0, T("7a") - 1, T("7a"), T("8a") - 0.5, T("8a"), T("10a") - 0.5, T("10a"),
                           T("10i"), T("11b"), TOTAL],
                      [0.002, 0.002, 0.004, 0.004, 0.01, 0.01, 0.02, 0.02, 0.012, 0.012])
    dev = depth * (0.8 * wowf + 0.25 * flut)
    pos = tc + np.cumsum(dev) / cr
    read = np.interp(np.arange(n) / SR, tc, pos) * SR
    for c in range(2):
        x[c] = np.interp(read, np.arange(n), x[c]).astype(np.float32)
    a7, b7 = S(T("7a") - 0.25), S(T("8a") + 0.25)
    for c in range(2):
        full = smooth_filter(x[c], 80, 8000)
        cam = smooth_filter(x[c][a7:b7], 100, 6000)
        xf = np.ones(b7 - a7, np.float32)
        r = S(0.2)
        xf[:r] = np.linspace(0, 1, r)
        xf[-r:] = np.linspace(1, 0, r)
        full[a7:b7] = full[a7:b7] * (1 - xf) + cam * xf
        x[c] = full * dip

    # ---- hiss (2-8 kHz, -43 dBFS RMS) and 60 Hz hum (-52 dBFS) under the tape
    hiss = smooth_filter(tape_noise(n, 11), 2000, 8000, 3)
    hiss *= db(-43) / np.sqrt(np.mean(hiss ** 2))
    tt = np.arange(n) / SR
    hum = (np.sin(2 * np.pi * 60 * tt) + 0.5 * np.sin(2 * np.pi * 120 * tt) + 0.3 * np.sin(2 * np.pi * 180 * tt))
    hum = (hum * db(-52) / np.sqrt(np.mean(hum ** 2))).astype(np.float32)
    # hiss: the camcorder segment 2.5 dB hotter; 7q near-silence (-20 dB); 8o
    # creeps back from digital zero over 2 s and settles 4 dB lower (your dark
    # screen, not the tape), no hum; 11b brings hiss and hum back on its first frame
    o0 = T("8o")
    hl = env(n, [(0, 0), (0.6, 0), (1.0, 1), (T("7a"), 1), (T("7a") + 0.05, db(2.5)), (T("7q") - 0.005, db(2.5)),
                 (T("7q"), db(-20)), (T("8a"), db(-20)), (T("8a") + 0.005, 1), (o0 - 0.003, 1), (o0, 0), (o0 + 2.0, db(-4)),
                 (T("9a") - 0.003, db(-4)), (T("9a"), 1), (TOTAL, 1)])
    ml = env(n, [(0, 0), (1.0, 0), (1.2, 1), (T("7q") - 0.005, 1), (T("7q"), 0), (T("8a"), 0),
                 (T("8a") + 0.005, 1), (o0 - 0.003, 1), (o0, 0), (T("9a") - 0.003, 0), (T("9a"), 1), (TOTAL, 1)])
    noise = hiss * hl + hum * ml

    # ---- tape stop: pitch dive to zero over 0.5 s (program and tape noise),
    # then nothing until the VCR starts itself again
    mix = x + hits.x + sub.x + noise[None, :]
    d0, d1 = S(T("10h")), S(T("10h") + 0.5)
    u = np.linspace(0, 1, d1 - d0)
    spd = (1 - u) ** 1.6
    rpos = d0 + np.cumsum(spd)
    for c in range(2):
        mix[c, d0:d1] = np.interp(rpos, np.arange(n), mix[c])
    mix[:, d1:S(T("11b"))] = 0.0
    mix[:, d1 - S(0.01):d1] *= np.linspace(1, 0, S(0.01))

    # ---- digital silences (true zero), and the 7q near-silence
    def silence(t0, t1, fout=0.005):
        a, b = S(t0), S(t1)
        r = S(fout)
        mix[:, a - r:a] *= np.linspace(1, 0, r)
        mix[:, a:b] = 0.0

    def cut_prog(t0, t1):
        a, b = S(t0), S(t1)
        r = S(0.005)
        noise_part = noise[None, a:b]
        mix[:, a - r:a] = (mix[:, a - r:a] - noise[None, a - r:a]) * np.linspace(1, 0, r) + noise[None, a - r:a]
        mix[:, a:b] = noise_part

    cut_prog(T("7q"), T("8a"))
    silence(T("8n"), T("8o"))                        # DIGITAL SILENCE #1 (8o's hiss creeps back from zero)
    silence(T("11k"), TOTAL)                         # DIGITAL SILENCE #3, to the end

    # ---- 11a: the VCR rewinds by itself.  The mechanism breaks the silence;
    # under it the tape's own last 14 s (the mix itself) reversed at x7,
    # band-passed, chipmunk-backwards Poppy
    r0, r1 = T("10c") + 1.8, T("10i")
    rev = mix[:, S(r0):S(r1)].mean(0)[::-1].copy()
    rev = smooth_filter(resample(rev, 7.0), 300, 5000)
    rev = fades(rev[:S(T("11b") - T("11a") - 0.08)], 0.08, 0.05)
    deck.add(rev, T("11a") + 0.05, db(-24) / max(1e-6, float(np.max(np.abs(rev)))))
    deck.add(stem("sfx_rewind"), T("11a"), g_peak("sfx_rewind", -14))
    mix = mix + deck.x
    mix[:, S(T("11k")):] = 0.0

    peak = float(np.max(np.abs(mix)))
    mix *= 0.97 / peak
    print(f"  audio: pre-normalisation peak {peak:.3f} -> scaled x{0.97 / peak:.3f}")
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16).T.copy()
    with wave.open(out_path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return out_path


def decoded_peak(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return float(np.max(np.abs(np.frombuffer(raw, np.float32))))


def mux(video, audio):
    """Mux, then check the decoded AAC.  The default (twoloop) AAC coder overshot
    the dense stinger transients by up to +50 %; the 'fast' coder does not, and
    if anything still overshoots the mix is scaled until the delivered audio
    peaks at <= 0.97."""
    tmp = OUTPUT + ".part.mp4"
    src = audio
    gain = 1.0
    for _ in range(4):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", src, "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-aac_coder", "fast", "-b:a", "192k", "-t", f"{TOTAL}", "-movflags", "+faststart",
                        tmp], check=True)
        pk = decoded_peak(tmp)
        print(f"  decoded AAC peak {pk:.3f} (mix gain {gain:.3f})")
        if pk <= 0.975:
            break
        gain *= 0.97 / pk * 0.995
        with wave.open(audio) as w:
            pcm = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) * gain
        src = os.path.join(BUILD, "mix_delivery.wav")
        with wave.open(src, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(np.round(pcm).astype(np.int16).tobytes())
    os.replace(tmp, OUTPUT)


# ---- verification ----------------------------------------------------------------

def parse_time(s):
    if ":" in s:
        m, sec = s.split(":")
        return int(m) * 60 + float(sec)
    return float(s)


def stills(times):
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    paths = []
    for t in times:
        i = min(NFRAMES - 1, int(round(t * FPS)))
        a = render_frame(i)
        p = os.path.join(PREVIEW_DIR, f"still_{i / FPS:07.2f}_{SHOTS[_FRAME_SHOT[i]]['id']}.png")
        Image.fromarray(a).save(p)
        paths.append(p)
        print(p)
    return paths


def tc(t):
    return f"{int(t // 60)}:{t % 60:04.1f}"


def contact_sheets(src=OUTPUT, step=5.0, start=2.5, per=12, cols=4, prefix="sheet"):
    out_dir = os.path.join(BUILD, "sheets")
    os.makedirs(out_dir, exist_ok=True)
    times = np.arange(start, TOTAL, step)
    frames = []
    for t in times:
        p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", src, "-frames:v", "1",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
        frames.append((t, Image.frombytes("RGB", (W, H), p[:W * H * 3]) if len(p) >= W * H * 3
                       else Image.new("RGB", (W, H))))
    tw, th = 320, 240
    paths = []
    for k in range(0, len(frames), per):
        grp = frames[k:k + per]
        rows = (len(grp) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tw, rows * (th + 22)), (30, 30, 30))
        d = ImageDraw.Draw(sheet)
        for j, (t, im) in enumerate(grp):
            x, y = (j % cols) * tw, (j // cols) * (th + 22)
            sheet.paste(im.resize((tw, th)), (x, y))
            i = int(round(t * FPS))
            d.text((x + 4, y + th + 3), f"{tc(t)}  shot {SHOTS[_FRAME_SHOT[min(i, NFRAMES - 1)]]['id']}",
                   font=font(MONO, 14), fill=(255, 255, 0))
        p = os.path.join(out_dir, f"{prefix}_{k // per + 1:02d}.png")
        sheet.save(p)
        paths.append(p)
        print(p)
    return paths


def audio_report(src=OUTPUT):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-f", "s16le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32).reshape(-1, 2) / 32768
    m = x.mean(1)
    print(f"samples {len(m) / SR:.2f}s  peak {20 * np.log10(np.max(np.abs(x)) + 1e-9):.2f} dBFS")
    rows = []
    for s in range(int(len(m) / SR)):
        seg = x[s * SR:(s + 1) * SR]
        rms = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
        pkv = 20 * np.log10(np.max(np.abs(seg)) + 1e-9)
        rows.append((s, rms, pkv))
    for s, rms, pkv in rows:
        sid = SHOTS[_FRAME_SHOT[min(NFRAMES - 1, s * FPS + FPS // 2)]]["id"]
        print(f"{tc(s):>7} {sid:>4}  rms {rms:7.1f}  peak {pkv:7.1f}")
    top = sorted(rows, key=lambda r: -r[1])[:8]
    print("loudest seconds by RMS:", ", ".join(f"{tc(s)} ({r:.1f})" for s, r, _ in top))
    return rows


# ---- CLI -------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--render-chunk", help=argparse.SUPPRESS)
    ap.add_argument("--force", nargs="*", default=[], help="segments ('7'), shot ids ('8b'), chunk names or 'all'")
    ap.add_argument("--jobs", type=int, default=3)
    ap.add_argument("--still", nargs="*", help="write preview PNGs at these times (s or m:ss.s)")
    ap.add_argument("--video-only", action="store_true")
    ap.add_argument("--audio-only", action="store_true")
    ap.add_argument("--mux-only", action="store_true")
    ap.add_argument("--sheets", action="store_true")
    ap.add_argument("--audio-report", action="store_true")
    ap.add_argument("--status", action="store_true")
    args = ap.parse_args()

    if args.render_chunk:
        render_chunk(args.render_chunk)
        return
    if args.still:
        stills([parse_time(s) for s in args.still])
        if MISSING:
            print("MISSING (placeholders):", sorted(set(MISSING)))
        return
    if args.status:
        for c in CHUNK_DEFS:
            print(f"{c[0]:20s} {c[1]:6.1f}-{c[2]:6.1f}  {'ok' if chunk_done(c) else 'TODO'}")
        return
    if args.sheets:
        contact_sheets()
        return
    if args.audio_report:
        audio_report()
        return
    os.makedirs(CHUNK_DIR, exist_ok=True)
    t0 = time.time()
    if not (args.audio_only or args.mux_only):
        render_chunks(set(args.force), args.jobs)
        if args.video_only:
            return
    mix_path = os.path.join(BUILD, "mix.wav")
    if not args.mux_only or not os.path.exists(mix_path):
        print("Building audio mix...")
        build_audio(mix_path)
        if args.audio_only:
            return
    missing = [c[0] for c in CHUNK_DEFS if not chunk_done(c)]
    if missing:
        raise SystemExit(f"chunks not rendered: {missing}")
    print("Concatenating chunks and muxing...")
    video = concat_chunks()
    mux(video, mix_path)
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", OUTPUT],
                         capture_output=True, text=True).stdout.strip()
    print(f"Wrote {OUTPUT}: {dur} s, {os.path.getsize(OUTPUT) / 1e6:.1f} MB ({time.time() - t0:.0f}s)")
    miss = set(MISSING)
    for c in CHUNK_DEFS:
        miss.update(json.load(open(chunk_paths(c)[1])).get("missing", []))
    if miss:
        print("MISSING assets drawn as placeholders:", sorted(miss))


if __name__ == "__main__":
    main()
