#!/usr/bin/env python3
"""
THE WORLD OF POPPY - audio stem builder.

Renders every entry in the "audio" list of poppy/assets.json to
poppy/build/audio/<name>.wav (44100 Hz, mono, 16-bit) with numpy, espeak-ng
and nothing else, and keeps poppy/build/audio/manifest.json up to date:

    {"build/audio/<name>.wav": {"duration", "peak", "rms", "kind", ...}, ...}

The two songs also carry "lyrics": [[start_seconds, text], ...]. Voice stems
get build/audio/<name>.env.json: a 30-values-per-second amplitude envelope
(max 20 ms RMS inside each video frame) so the compositor can flap mouths.

Re-runnable and incremental. A stem whose .wav already exists and reads back
as valid is skipped unless --force is given or the stem is named explicitly.
Every stem is written (atomically) as soon as it is done, so an interrupted
run loses at most one stem.

    python3 poppy/make_audio.py                  # everything that is missing
    python3 poppy/make_audio.py voice sfx        # missing stems of these kinds
    python3 poppy/make_audio.py vo_hs_1 sfx_pop  # these stems, always re-rendered
    python3 poppy/make_audio.py --force music    # all music stems again
    python3 poppy/make_audio.py --list           # status of all 76 stems
"""

import argparse
import atexit
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave
import zlib

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "audio")
ASSETS = os.path.join(HERE, "assets.json")
MANIFEST = os.path.join(OUT, "manifest.json")

SR = 44100
ENV_FPS = 30

rng = np.random.default_rng(1995)   # re-seeded per stem (see render_stem)


# ==========================================================================
# Basic helpers (several from horror/make_video.py)
# ==========================================================================

def db(x):
    return 10.0 ** (x / 20.0)


def secs(n):
    return int(round(n * SR))


def tvec(n):
    return np.arange(n) / SR


def sine(freq, dur=None, phase=0.0):
    """Sine from a constant or a per-sample frequency curve."""
    if np.isscalar(freq):
        freq = np.full(secs(dur), float(freq))
    return np.sin(2 * np.pi * np.cumsum(freq) / SR + phase)


def saw(freq_curve):
    phase = np.cumsum(freq_curve) / SR
    return 2 * (phase % 1.0) - 1


def white(dur):
    return rng.standard_normal(secs(dur))


def snow(dur):
    """TV static: noise with a hard ceiling, so bursts never spike."""
    return rng.uniform(-1, 1, secs(dur))


def fade(x, attack=0.01, release=0.01):
    x = np.array(x, dtype=float)
    a, r = min(secs(attack), len(x) // 2), min(secs(release), len(x) // 2)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if r:
        x[-r:] *= np.linspace(1, 0, r)
    return x


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) if len(x) else 0
    return x * (peak / m) if m > 0 else x


def rms(x):
    return float(np.sqrt(np.mean(np.square(x)))) if len(x) else 0.0


def resample(x, factor):
    """Play back at `factor` speed (0.8 = slower and lower)."""
    n = int(len(x) / factor)
    return np.interp(np.arange(n) * factor, np.arange(len(x)), x)


def fit(x, n):
    """Pad with zeros or crop to exactly n samples."""
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros(n - len(x))])


def expdec(n, tau):
    return np.exp(-tvec(n) / tau)


def attack_ramp(x, a=0.002):
    x = np.array(x, dtype=float)
    k = min(len(x), max(1, secs(a)))
    x[:k] *= np.linspace(0, 1, k)
    return x


# --------------------------------------------------------------------------
# Filters: zero-phase FFT filters with smooth (Butterworth-shaped) magnitude,
# so transients do not ring the way a brick wall would. circ=True treats the
# signal as periodic, which keeps loops seamless.
# --------------------------------------------------------------------------

def _ffilt(x, gain_fn, circ=False):
    x = np.asarray(x, dtype=float)
    if len(x) == 0:
        return x
    pad = 0 if circ else min(8192, max(1024, len(x) // 4))
    xp = np.pad(x, (pad, pad)) if pad else x
    f = np.fft.rfftfreq(len(xp), 1 / SR)
    y = np.fft.irfft(np.fft.rfft(xp) * gain_fn(np.maximum(f, 1e-6)), len(xp))
    return y[pad:pad + len(x)] if pad else y


def lp(x, fc, order=4, circ=False):
    return _ffilt(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)), circ)


def hp(x, fc, order=2, circ=False):
    return _ffilt(x, lambda f: 1 / np.sqrt(1 + (fc / f) ** (2 * order)), circ)


def bp(x, lo, hi, order=4, circ=False):
    return _ffilt(x, lambda f: 1 / np.sqrt((1 + (lo / f) ** (2 * order)) * (1 + (f / hi) ** (2 * order))), circ)


def peq(x, fc, gain_db, octaves=1.0, circ=False):
    """Bell boost/cut centred on fc, `octaves` wide."""
    g = db(gain_db) - 1
    return _ffilt(x, lambda f: 1 + g * np.exp(-0.5 * (np.log2(f / fc) / (octaves / 2.355)) ** 2), circ)


def low_shelf(x, fc, gain_db, circ=False):
    g = db(gain_db) - 1
    return _ffilt(x, lambda f: 1 + g / (1 + (f / fc) ** 2), circ)


def resonators(freqs, taus, amps=None, dur=0.5):
    """Impulse response of a bank of damped sines."""
    n = secs(dur)
    t = tvec(n)
    amps = amps if amps is not None else [1.0] * len(freqs)
    ir = np.zeros(n)
    for f, tau, a in zip(freqs, taus, amps):
        ir += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    return ir


def fftconv(a, b):
    n = len(a) + len(b) - 1
    nf = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(a, nf) * np.fft.rfft(b, nf), nf)[:n]


def cconv(a, b):
    """Circular convolution over len(a) (b must not be longer)."""
    return np.fft.irfft(np.fft.rfft(a) * np.fft.rfft(b, len(a)), len(a))


# --------------------------------------------------------------------------
# Modulation, time and pitch
# --------------------------------------------------------------------------

def lfo_noise(n, lo, hi):
    """Band-limited noise (lo..hi Hz) with unit std. Periodic over n samples."""
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(spec, n)
    s = np.std(y)
    return y / s if s > 0 else y


def wow_flutter(n, wow=0.003, flutter=0.001, wow_band=(0.5, 1.5), flutter_band=(6.0, 12.0)):
    """Speed curve for tape wow and flutter, driven by filtered noise (not an LFO).
    `wow`/`flutter` are roughly the peak deviations; they may be arrays (growing depth)."""
    return 1 + wow * lfo_noise(n, *wow_band) / 2.5 + flutter * lfo_noise(n, *flutter_band) / 2.5


def vari(x, rate, circular=False):
    """Varispeed: output sample i reads the input at sum(rate[:i]). len(out) == len(rate)."""
    rate = np.asarray(rate, dtype=float)
    pos = np.concatenate([[0.0], np.cumsum(rate[:-1])])
    if circular:
        n = len(x)
        return np.interp(pos % n, np.arange(n + 1), np.concatenate([x, x[:1]]))
    return np.interp(pos, np.arange(len(x)), x, right=0.0)


def granular(x, pitch=1.0, stretch=1.0, grain=0.05):
    """Overlap-add grains: change pitch and/or length independently (rough, robotic)."""
    g = max(64, secs(grain))
    hop = g // 4
    win = np.hanning(g)
    n_out = int(len(x) * stretch)
    out = np.zeros(n_out + 2 * g)
    src = np.arange(len(x))
    for o in range(-g, n_out, hop):
        centre_out = o + g / 2
        centre_in = centre_out / stretch
        pos = centre_in + (np.arange(g) - g / 2) * pitch
        seg = np.interp(pos, src, x, left=0.0, right=0.0)
        a = o + g
        out[a:a + g] += seg * win
    return out[g:g + n_out] / 2.0


def make_ir(t60, damp=5000, predelay=0.01, seed=7):
    r = np.random.default_rng(seed)
    n = secs(t60 * 1.15) + 1
    t = tvec(n)
    ir = r.standard_normal(n) * 10 ** (-3 * t / t60)
    dark = lp(ir, damp, 2)
    k = np.exp(-t / max(0.02, t60 * 0.2))
    ir = dark * (1 - k) + ir * k
    ir[:secs(predelay)] = 0
    # a few early reflections
    for d, g in ((0.011, 0.5), (0.017, 0.35), (0.023, 0.3), (0.031, 0.2)):
        i = secs(predelay + d * (0.5 + t60))
        if i < n:
            ir[i] += g * (1 if r.random() > 0.5 else -1) * 3 * np.std(ir[:secs(0.1)] + 1e-9)
    return ir / np.sqrt(np.sum(ir ** 2))


def reverb(x, t60=0.4, wet=0.15, damp=5000, predelay=0.01, tail=True, circular=False, seed=7):
    ir = make_ir(t60, damp, predelay, seed)
    if circular:
        y = cconv(x, ir)
        dry = x
    else:
        y = fftconv(x, ir)
        dry = fit(x, len(y))
        if not tail:
            y, dry = y[:len(x)], x
    y = y * (rms(x) / (rms(y) + 1e-12))
    return dry * (1 - wet) + y * wet


def place(buf, x, at, gain=1.0, circular=False):
    """Mix x into buf at time `at` (seconds)."""
    i = secs(at)
    x = np.asarray(x, dtype=float) * gain
    if circular:
        n = len(buf)
        idx = (i + np.arange(len(x))) % n
        np.add.at(buf, idx, x)
        return buf
    if i < 0:
        x, i = x[-i:], 0
    j = min(len(buf), i + len(x))
    if j > i:
        buf[i:j] += x[:j - i]
    return buf


def fold_tail(buf, n):
    """Loop helper: wrap everything past n samples back onto the start."""
    out = buf[:n].copy()
    rest = buf[n:]
    while len(rest):
        k = min(n, len(rest))
        out[:k] += rest[:k]
        rest = rest[k:]
    return out


def trim_silence(x, thresh_db=-45, pre=0.01, post=0.04):
    a = np.abs(x)
    m = a.max() if len(a) else 0
    if m == 0:
        return x
    idx = np.where(a > m * db(thresh_db))[0]
    s = max(0, idx[0] - secs(pre))
    e = min(len(x), idx[-1] + secs(post))
    return x[s:e]


def moving_rms(x, win=0.02):
    w = max(1, secs(win))
    c = np.concatenate([[0.0], np.cumsum(np.square(x))])
    half = w // 2
    lo = np.clip(np.arange(len(x)) - half, 0, len(x))
    hi = np.clip(np.arange(len(x)) + (w - half), 0, len(x))
    return np.sqrt((c[hi] - c[lo]) / np.maximum(1, hi - lo))


def bitcrush(x, bits=8, hold=1):
    if hold > 1:
        idx = (np.arange(len(x)) // hold) * hold
        x = x[idx]
    q = 2 ** (bits - 1)
    return np.round(x * q) / q


def f0_track(x, hop=0.01, win=0.04, fmin=70, fmax=1100):
    n, h = secs(win), secs(hop)
    out = []
    lo, hi = int(SR / fmax), int(SR / fmin)
    w = np.hanning(n)
    for i in range(0, max(0, len(x) - n), h):
        s = x[i:i + n] * w
        if rms(s) < 0.01 * (np.max(np.abs(x)) + 1e-9):
            out.append(0.0)
            continue
        ac = np.fft.irfft(np.abs(np.fft.rfft(s, 2 * n)) ** 2)[:n]
        k = lo + int(np.argmax(ac[lo:hi]))
        out.append(SR / k if ac[k] > 0.35 * ac[0] else 0.0)
    return np.array(out)


def f0_median(x, **kw):
    f = f0_track(x, **kw)
    f = f[f > 0]
    return float(np.median(f)) if len(f) >= 3 else 0.0


# ==========================================================================
# Instruments
# ==========================================================================

NOTE_INDEX = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi(name):
    if not isinstance(name, str):
        return float(name)
    m = re.fullmatch(r"([A-G])([#b]?)(-?\d)", name)
    v = NOTE_INDEX[m.group(1)] + {"#": 1, "b": -1, "": 0}[m.group(2)]
    return 12 * (int(m.group(3)) + 1) + v


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def toy_piano(f, dur=0.7, vel=1.0):
    """Toy piano: sine plus partials x2 and x3, decaying over 0.3-0.6 s, and a tine 'tink'."""
    decay = float(np.clip(0.6 * (440 / f) ** 0.35, 0.3, 0.6))
    n = secs(dur)
    t = tvec(n)
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / decay)
         + 0.45 * np.sin(2 * np.pi * 2 * f * t + 0.4) * np.exp(-t / (decay * 0.55))
         + 0.22 * np.sin(2 * np.pi * 3 * f * t + 1.3) * np.exp(-t / (decay * 0.35))
         + 0.16 * np.sin(2 * np.pi * 4.17 * f * t) * np.exp(-t / 0.025))
    return vel * fade(attack_ramp(y, 0.0015), 0, 0.02)


def glock(f, dur=1.2, vel=1.0):
    """Glockenspiel bar: partials 1, 2.76, 5.40 plus a mallet click."""
    n = secs(dur)
    t = tvec(n)
    tau = float(np.clip(0.9 * (1000 / f) ** 0.4, 0.35, 1.2))
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / tau)
         + 0.35 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / (tau * 0.22))
         + 0.18 * np.sin(2 * np.pi * 5.40 * f * t) * np.exp(-t / (tau * 0.07)))
    click = hp(rng.standard_normal(secs(0.004)), 3000) * 0.15
    y[:len(click)] += click
    return vel * fade(attack_ramp(y, 0.001), 0, 0.02)


def music_box_note(f, dur=1.8, vel=1.0):
    """Music-box comb tooth: sine partials plus inharmonic metallic ones at x2.76 and x5.40."""
    n = secs(dur)
    t = tvec(n)
    tau = float(np.clip(1.6 * (523 / f) ** 0.5, 0.5, 2.2))
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / tau)
         + 0.18 * np.sin(2 * np.pi * 2 * f * t + 0.5) * np.exp(-t / (tau * 0.5))
         + 0.30 * np.sin(2 * np.pi * 2.76 * f * t + 1.0) * np.exp(-t / (tau * 0.22))
         + 0.14 * np.sin(2 * np.pi * 5.40 * f * t + 2.0) * np.exp(-t / (tau * 0.08)))
    tick = hp(rng.standard_normal(secs(0.003)), 2500) * 0.25
    y[:len(tick)] += tick
    return vel * fade(attack_ramp(y, 0.0008), 0, 0.01)


def bass_note(f, dur=0.5, vel=1.0):
    n = secs(dur + 0.25)
    t = tvec(n)
    y = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    env = np.exp(-t / 0.45)
    rel = secs(dur)
    env[rel:] *= np.exp(-(t[rel:] - t[rel]) / 0.05)
    y = np.tanh(1.4 * y * env) / np.tanh(1.4)
    return vel * fade(attack_ramp(y, 0.006), 0, 0.02)


def organ(freqs, dur=0.3, vel=1.0):
    n = secs(dur + 0.06)
    t = tvec(n)
    y = np.zeros(n)
    for f in freqs:
        for k, a in ((1, 1.0), (2, 0.55), (3, 0.3), (4, 0.18), (6, 0.08)):
            y += a * np.sin(2 * np.pi * k * f * t + rng.uniform(0, 6.28))
    y *= 1 + 0.08 * np.sin(2 * np.pi * 6.2 * t)
    env = np.ones(n)
    rel = secs(dur)
    env[rel:] = np.exp(-(t[rel:] - t[rel]) / 0.02)
    return vel * fade(attack_ramp(y * env, 0.008), 0, 0.01) / max(1, len(freqs))


def pad(freqs, dur=2.0, vel=1.0, attack=0.35, release=0.6):
    n = secs(dur + release)
    t = tvec(n)
    y = np.zeros(n)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 0.7 * t)
    for f in freqs:
        for det in (-0.0025, 0.0025):
            ff = f * (1 + det) * vib
            ph = np.cumsum(ff) / SR
            y += np.sin(2 * np.pi * ph) + 0.25 * np.sin(4 * np.pi * ph) + 0.08 * np.sin(6 * np.pi * ph)
    env = np.minimum(1, t / attack)
    rel = secs(dur)
    env[rel:] *= np.exp(-(t[rel:] - t[rel]) / (release / 3))
    return vel * y * env / (2 * max(1, len(freqs)))


def kick(vel=1.0):
    n = secs(0.3)
    t = tvec(n)
    f = 48 + 110 * np.exp(-t / 0.035)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11)
    y[:secs(0.003)] += lp(rng.standard_normal(secs(0.003)), 3000) * 0.3
    return vel * fade(y, 0.0005, 0.02)


def clap(vel=1.0):
    n = secs(0.25)
    t = tvec(n)
    y = np.zeros(n)
    noise = rng.standard_normal(n)
    for k, d in enumerate((0.0, 0.009, 0.019, 0.028)):
        i = secs(d)
        seg = np.exp(-t[:n - i] / (0.004 if k < 3 else 0.06))
        y[i:] += noise[i:] * seg * (0.8 if k < 3 else 1.0)
    return vel * fade(bp(y, 900, 3200, 2), 0.0005, 0.02)


def shaker(vel=1.0):
    n = secs(0.09)
    t = tvec(n)
    env = np.minimum(1, t / 0.008) * np.exp(-t / 0.03)
    return vel * hp(rng.standard_normal(n), 5000, 3) * env


def slide_whistle(f0, f1, dur, vel=1.0):
    n = secs(dur)
    t = tvec(n)
    k = (t / dur) ** 0.8
    f = f0 * (f1 / f0) ** k * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    y = sine(f) + 0.08 * sine(2 * f)
    breath = bp(rng.standard_normal(n), 900, 4000) * 0.08
    env = np.minimum(1, t / 0.04) * np.minimum(1, (dur - t) / 0.06)
    return vel * (y + breath) * env


INSTRUMENTS = {"toy": toy_piano, "glock": glock, "mbox": music_box_note, "bass": bass_note}

CHORDS = {
    "C": ["C4", "E4", "G4"], "Am": ["A3", "C4", "E4"], "G": ["G3", "B3", "D4"],
    "F": ["F3", "A3", "C4"], "G7": ["G3", "B3", "D4", "F4"], "Em": ["E3", "G3", "B3"],
}
ROOTS = {"C": "C3", "Am": "A2", "G": "G2", "F": "F2", "G7": "G2", "Em": "E2"}


def render_events(events, n, detune=15.0, transpose=0.0, drop=0.0, circular=False):
    """events: (time, dur, note(s), instrument, vel). Returns an n-sample buffer."""
    buf = np.zeros(n + (0 if circular else secs(3)))
    for t0, dur, notes, inst, vel in events:
        if inst == "kick":
            place(buf, kick(vel), t0, circular=circular)
            continue
        if inst == "clap":
            place(buf, clap(vel), t0, circular=circular)
            continue
        if inst == "shaker":
            place(buf, shaker(vel), t0, circular=circular)
            continue
        if drop and rng.random() < drop:
            continue
        nl = notes if isinstance(notes, (list, tuple)) else [notes]
        freqs = [mtof(midi(x) + transpose + rng.uniform(-detune, detune) / 100) for x in nl]
        if inst == "organ":
            x = organ(freqs, dur, vel)
        elif inst == "pad":
            x = pad(freqs, dur, vel)
        elif inst == "bass":
            x = sum(bass_note(f, dur, vel) for f in freqs)
        else:
            fn = INSTRUMENTS[inst]
            x = sum(fn(f, max(dur, 0.25) + 0.6, vel) for f in freqs)
        place(buf, x, t0, circular=circular)
    return buf if circular else buf[:n]


# ==========================================================================
# espeak-ng
# ==========================================================================

# Extra voice variants (based on en-us+f3) with child-like raised formants.
VARIANTS = {
    # Poppy's talking voice: f3 with formants raised ~15-35% and a higher pitch base.
    "poppykid": """language variant
name poppykid
gender female
pitch 215 250
formant 0 115  80 150
formant 1 128  75 150 -50
formant 2 138  70 150 -250
formant 3 128  80 150
formant 4 128  80 150
formant 5 125  80 150
formant 6 120  70 150
formant 7 110  70 150
formant 8 110  70 150
stressAmp 18 18 20 20 20 20 20 20
breath 0 2 3 3 3 3 3 2
echo 60 8
roughness 2
""",
    # The same voice with room to sing up to D5.
    "poppysing": """language variant
name poppysing
gender female
pitch 300 340
formant 0 115  80 150
formant 1 128  75 150 -50
formant 2 138  70 150 -250
formant 3 128  80 150
formant 4 128  80 150
formant 5 125  80 150
formant 6 120  70 150
formant 7 110  70 150
formant 8 110  70 150
stressAmp 18 18 20 20 20 20 20 20
breath 0 2 3 3 3 3 3 2
echo 40 6
roughness 1
""",
}

_ESPEAK_PATH = None


def espeak_path():
    """A private espeak-ng data dir: symlinks to the system data plus our variants."""
    global _ESPEAK_PATH
    if _ESPEAK_PATH:
        return _ESPEAK_PATH
    info = subprocess.run(["espeak-ng", "--version"], capture_output=True, text=True).stdout
    m = re.search(r"Data at:\s*(\S+)", info)
    src = m.group(1) if m else "/usr/lib/x86_64-linux-gnu/espeak-ng-data"
    root = tempfile.mkdtemp(prefix="poppy_espeak_")
    atexit.register(shutil.rmtree, root, True)
    dst = os.path.join(root, "espeak-ng-data")
    os.makedirs(os.path.join(dst, "voices", "!v"))
    for name in os.listdir(src):
        if name != "voices":
            os.symlink(os.path.join(src, name), os.path.join(dst, name))
    for name in os.listdir(os.path.join(src, "voices")):
        if name != "!v":
            os.symlink(os.path.join(src, "voices", name), os.path.join(dst, "voices", name))
    for name in os.listdir(os.path.join(src, "voices", "!v")):
        os.symlink(os.path.join(src, "voices", "!v", name), os.path.join(dst, "voices", "!v", name))
    for name, body in VARIANTS.items():
        with open(os.path.join(dst, "voices", "!v", name), "w") as fh:
            fh.write(body)
    _ESPEAK_PATH = root
    return root


def read_wav(path):
    with wave.open(path) as w:
        rate = w.getframerate()
        ch = w.getnchannels()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    x = data.astype(np.float64) / 32768
    if ch > 1:
        x = x.reshape(-1, ch).mean(1)
    if rate == SR:
        return x
    if rate * 2 == SR and len(x):
        # exact band-limited 2x upsample
        spec = np.fft.rfft(x)
        up = np.zeros(len(x) + 1, dtype=complex)
        up[:len(spec)] = spec
        return np.fft.irfft(up, 2 * len(x)) * 2
    return resample(x, rate / SR)


def espeak(text, voice="en-us", speed=175, pitch=50, gap=None, prange=None, amp=None):
    """Render text with espeak-ng; prange sets the SSML intonation range ('0' = monotone)."""
    speed = int(np.clip(speed, 80, 450))
    pitch = int(np.clip(pitch, 0, 99))
    cmd = ["espeak-ng", "--path=" + espeak_path(), "-v", voice, "-s", str(speed), "-p", str(pitch)]
    if gap is not None:
        cmd += ["-g", str(int(gap))]
    if amp is not None:
        cmd += ["-a", str(int(amp))]
    if prange is not None:
        cmd += ["-m"]
        text = f'<speak><prosody range="{prange}">{html.escape(text, quote=False)}</prosody></speak>'
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "v.wav")
        subprocess.run(cmd + ["-w", path, text], check=True, capture_output=True)
        return read_wav(path)


_PITCH_MAPS = {}


def pitch_map(voice):
    """Measured espeak -p -> monotone f0 (Hz) for a voice."""
    if voice not in _PITCH_MAPS:
        ps = list(range(0, 99, 9)) + [99]
        hz = []
        for p in ps:
            x = espeak("day", voice, speed=110, pitch=p, prange="0")
            hz.append(f0_median(x, fmax=1400))
        ps, hz = np.array(ps, float), np.array(hz)
        ok = hz > 0
        _PITCH_MAPS[voice] = (ps[ok], np.maximum.accumulate(hz[ok]))
    return _PITCH_MAPS[voice]


def p_for_hz(voice, f):
    ps, hz = pitch_map(voice)
    return float(np.interp(np.log(f), np.log(hz), ps))


# ==========================================================================
# Voice presets (STORYBOARD.md section 5)
# ==========================================================================

VOICE_CTX = {"max_pause": None}     # set by make_voice while fitting a line into its slot


def squeeze_pauses(x, max_pause=0.22, thresh_db=-38):
    """Shorten silences longer than max_pause (keeps max_pause of each; 6 ms fades at the cuts)."""
    m = moving_rms(x, 0.02)
    quiet = m < m.max() * db(thresh_db)
    n, keep, xf = len(x), secs(max_pause), secs(0.006)
    edges = np.flatnonzero(np.diff(np.concatenate([[0], quiet.astype(int), [0]])))
    out, last = [], 0
    for a, b in zip(edges[::2], edges[1::2]):
        if b - a > keep + 2 * xf and a > 0 and b < n:
            seg = x[last:a + keep // 2].copy()
            if last > 0:
                seg[:xf] *= np.linspace(0, 1, xf)
            seg[-xf:] *= np.linspace(1, 0, xf)
            out.append(seg)
            last = b - keep // 2
    seg = x[last:].copy()
    if last > 0:
        seg[:xf] *= np.linspace(0, 1, xf)
    out.append(seg)
    return np.concatenate(out)


def tidy(x, thresh_db=-48, pre=0.015, post=0.05):
    x = trim_silence(x, thresh_db, pre, post)
    if VOICE_CTX["max_pause"]:
        x = squeeze_pauses(x, VOICE_CTX["max_pause"])
    return x


def sentences(text):
    parts = [s.strip() for s in re.findall(r"[^.!?]+[.!?]*", text)]
    return [p for p in parts if re.search(r"\w", p)]


def tremolo(x, rate=6.0, depth=0.1):
    t = tvec(len(x))
    return x * (1 + depth * np.sin(2 * np.pi * rate * t + rng.uniform(0, 6.28)))


def chorus(x, mix=0.32, delay=0.017, depth=0.0025):
    """Light doubling: a slightly delayed copy with a slow pitch wobble."""
    n = len(x)
    rate = 1 + depth * np.sin(2 * np.pi * 0.9 * tvec(n + secs(delay)))
    dbl = vari(np.concatenate([np.zeros(secs(delay)), x]), rate)[:n]
    return x + mix * dbl


def tv_voice_chain(x, lo=250, hi=4000, drive=1.5, wet=0.12, t60=0.3, double=True):
    if double:
        x = chorus(x)
    x = norm(x, 1.0)
    x = np.tanh(drive * x) / np.tanh(drive)
    x = bp(x, lo, hi, 3)
    x = peq(x, 2500, 2.5, 1.5)          # a little presence, like a small speaker
    if wet > 0:
        x = reverb(x, t60, wet, damp=4500, predelay=0.006)
    return x


def poppy_raw(text, speed=172, pitches=(80, 90, 75, 88, 84), gap=2, prange="high"):
    """Sing-song delivery: each sentence at a different base pitch."""
    parts = []
    for i, s in enumerate(sentences(text)):
        p = pitches[i % len(pitches)]
        x = espeak(s, "en-us+poppykid", speed, p, gap, prange=prange)
        parts.append(tidy(x, -48, 0.015, 0.05))
        if i < len(sentences(text)) - 1:
            parts.append(np.zeros(secs(0.14 if s[-1] in ".!?" else 0.08)))
    return np.concatenate(parts)


def voice_poppy(text, speed=172, pitches=(80, 90, 75, 88, 84), prange="high", wet=0.12):
    x = poppy_raw(text, speed, pitches, 2, prange)
    return tv_voice_chain(x, 250, 4000, 1.5, wet, 0.3)


def voice_poppy_flat(text, speed=140, pitch=70, wet=0.05, close=3.0):
    x = espeak(text, "en-us+poppykid", speed, pitch, 4, prange="x-low")
    x = tidy(x, -48, 0.015, 0.06)
    x = tv_voice_chain(x, 250, 4000, 1.5, wet, 0.25, double=False)
    return low_shelf(x, 450, close)      # proximity: a little too close


def octave_double(x, level_db):
    return x + db(level_db) * granular(x, pitch=0.5, stretch=1.0, grain=0.06)


def voice_poppy_wrong(text, factor=0.82, double_db=-12.0, speed=150, pitch=60, gap=10,
                      wobble=0.008, rev_whisper=0.0, close=0.0):
    x = espeak(text, "en-us+poppykid", speed, pitch, gap, prange="low")
    x = tidy(x, -48, 0.01, 0.06)
    x = resample(x, factor)                       # slower and deeper
    x = norm(x, 1.0)
    x = octave_double(x, double_db)
    n = len(x)
    x = vari(np.concatenate([x, np.zeros(secs(0.1))]), wow_flutter(n + secs(0.1), wobble, 0.0015))
    if rev_whisper > 0:
        w = espeak(text, "en-us+whisperf", speed * 0.9, 50, gap)
        w = trim_silence(w, -45, 0.0, 0.0)
        w = reverb(w, 1.2, 0.6, damp=3000, predelay=0.0)[::-1]     # reversed: the tail swells in
        w = resample(lp(w, 3500), factor)
        w = fit(norm(w, 1.0), len(x))
        x = norm(x, 1.0) + rev_whisper * w
    x = bp(x, 80, 7000, 2)
    if close:
        x = low_shelf(x, 300, close)
    x = norm(x, 1.0)
    return np.tanh(1.3 * x) / np.tanh(1.3)


def voice_whisper(text):
    x = espeak(text, "en-us+whisperf", 120, 50)
    a = np.abs(x)
    start = int(np.argmax(a > a.max() * 0.06))      # hard attack: start right on the consonant
    x = x[max(0, start - secs(0.001)):]
    x = trim_silence(x, -50, 0.0, 0.06)
    x = attack_ramp(x, 0.001)
    x = hp(x, 70, 2)
    return low_shelf(x, 400, 2.0)


def voice_narrator(text, speed=160):
    x = espeak(text, "en-us+m3", speed, 40, 4)
    x = tidy(x, -48, 0.02, 0.08)
    x = low_shelf(x, 220, 4.0)                    # warmth
    x = bp(x, 180, 3600, 3)
    x = norm(x, 1.0)
    x = np.tanh(2.0 * x) / np.tanh(2.0)
    return fade(x, 0.005, 0.05)


def voice_crew(text, speed=160, called=False, laugh=False):
    x = espeak(text, "en-us+whisper", speed, 35)
    x = tidy(x, -45, 0.02, 0.06)
    if called:
        v = espeak(text, "en-us+m2", 135, 45)
        v = tidy(v, -45, 0.02, 0.06)
        x = 0.55 * norm(fit(x, len(v)), 1) + 0.8 * norm(v, 1)
        x = reverb(x, 0.9, 0.2, damp=3500, predelay=0.03)
    if laugh:                                      # breathy half-laugh before the line
        puffs = np.zeros(secs(0.32))
        for k, t0 in enumerate((0.0, 0.11)):
            p = bp(rng.standard_normal(secs(0.08)), 500, 2500) * np.hanning(secs(0.08)) * (1 - 0.3 * k)
            place(puffs, p, t0)
        x = np.concatenate([0.5 * norm(puffs, 1) * np.max(np.abs(x)), x])
    x = tremolo(x, 6.5, 0.12)                      # nervous
    x = bp(x, 300, 3400, 3)                        # camcorder mic
    return fade(x, 0.003, 0.03)


def envelope_json(x, duration):
    m = moving_rms(x, 0.02)
    hop = SR / ENV_FPS
    nfr = int(np.ceil(len(x) / hop))
    starts = (np.arange(nfr) * hop).astype(int)
    vals = np.maximum.reduceat(m, starts) if len(m) else np.zeros(0)
    dbs = 20 * np.log10(np.maximum(vals, 1e-6))
    return {
        "fps": ENV_FPS, "window_ms": 20, "measure": "max 20 ms RMS inside each frame (linear, full scale = 1.0)",
        "threshold_db": -30.0, "duration": round(duration, 3),
        "rms": [round(float(v), 4) for v in vals],
        "db": [round(float(v), 1) for v in dbs],
        "open": [int(v > -30.0) for v in dbs],
    }


# --------------------------------------------------------------------------
# Voice lines: (name, preset, espeak text, options)
# Texts are the script lines, respelled only where espeak needs help.
# --------------------------------------------------------------------------

VOICE_LINES = [
    ("vo_narr_ident", "narrator", "Sunny Meadow Home Video presents...", {}),
    ("vo_greet_1", "poppy", "Hi, friend! It's me, Poppy! Welcome to my playroom!", {}),
    ("vo_greet_2", "poppy", "I'm so glad you came over. You look ready to play!", {"pitches": (84, 92)}),
    ("vo_greet_3", "poppy", "Today we're going to have so much fun!", {"pitches": (88,)}),
    ("vo_count_intro", "poppy", "Let's count my flower friends! Count with me, friend!", {"pitches": (82, 92)}),
    ("vo_count_1", "poppy", "One!", {"pitches": (78,)}),
    ("vo_count_2", "poppy", "Two!", {"pitches": (82,)}),
    ("vo_count_3", "poppy", "Three!", {"pitches": (86,)}),
    ("vo_count_4", "poppy", "Four!", {"pitches": (90,)}),
    ("vo_count_5", "poppy", "Five!", {"pitches": (94,)}),
    ("vo_count_done", "poppy", "Five flower friends! Great counting, friend!", {"pitches": (86, 80)}),
    ("vo_feel_intro", "poppy", "How do we feel today? Let's look at our feelings faces!", {"pitches": (80, 90)}),
    ("vo_feel_happy", "poppy", "This is happy!", {"pitches": (92,)}),
    ("vo_feel_sad", "poppy", "This is sad.", {"pitches": (70,), "prange": "x-high"}),
    ("vo_feel_angry", "poppy", "This is angry!", {"pitches": (84,)}),
    ("vo_feel_scared", "poppy", "This is scared.", {"pitches": (88,)}),
    ("vo_feel_hungry", "poppy_flat", "This is hungry.", {}),
    ("vo_feel_hungry_2", "poppy_flat", "It's okay to feel hungry, friend.", {}),
    ("vo_friends_intro", "poppy", "Let's say hello to all my friends!", {"pitches": (86,)}),
    ("vo_friends_buttons", "poppy", "Hello, Mister Buttons!", {"pitches": (90,)}),
    ("vo_friends_dot", "poppy", "Hello, Dot!", {"pitches": (84,)}),
    ("vo_friends_pip", "poppy_flat", "Pip didn't follow the rules.", {}),
    ("vo_friends_pip_2", "poppy_flat", "You follow the rules. Don't you, friend?", {"wet": 0.02, "close": 5.0}),
    ("vo_crew_1", "crew", "Okay. It's almost midnight. Studio B. Everybody went home.", {}),
    ("vo_crew_2", "crew", "Hello?", {"called": True, "peak_db": -3.0}),
    ("vo_crew_3", "crew", "It's just a light stand.", {"laugh": True}),
    ("vo_crew_4", "crew", "Dana left it in dressing room two. She won't touch it anymore.", {}),
    ("vo_crew_5", "crew", "There it is.", {"speed": 150}),
    ("vo_crew_6", "crew", "Where did it go?", {"speed": 140, "peak_db": -12.0}),
    ("vo_wrong_welcome", "poppy_wrong", "Welcome back, friend. I missed you.", {"rev_whisper": 0.22}),
    ("vo_wrong_game", "poppy_wrong", "Let's play hide and seek, friend! I'll count.", {}),
    ("vo_hs_1", "poppy_wrong", "One.", {"factor": 0.90, "double_db": -18}),
    ("vo_hs_2", "poppy_wrong", "Two.", {"factor": 0.88, "double_db": -16}),
    ("vo_hs_3", "poppy_wrong", "Three.", {"factor": 0.86, "double_db": -15}),
    ("vo_hs_4", "poppy_wrong", "Four.", {"factor": 0.84, "double_db": -14}),
    ("vo_hs_5", "poppy_wrong", "Five.", {"factor": 0.81, "double_db": -12}),
    ("vo_hs_6", "poppy_wrong", "Six.", {"factor": 0.78, "double_db": -10}),
    ("vo_hs_7", "poppy_wrong", "Seven.", {"factor": 0.75, "double_db": -9}),
    ("vo_hs_8", "poppy_wrong", "Eight.", {"factor": 0.72, "double_db": -8, "close": 4.0}),
    ("vo_hs_9", "poppy_wrong", "Nine.", {"factor": 0.68, "double_db": -6, "close": 5.0}),
    ("vo_hs_10", "poppy_whisper", "Ten.", {}),
    ("vo_narr_adv_a", "narrator",
     "This video cassette was recalled in nineteen ninety-six. If you are watching it, please stop the tape.", {}),
    ("vo_narr_adv_e", "narrator", "Thank you for watching Sunny Meadow Home Video. Please stop the tape.", {}),
    ("vo_wrong_stop", "poppy_wrong", "You didn't stop the tape, friend.", {"rev_whisper": 0.25}),
    ("vo_wrong_again", "poppy_wrong", "That's okay. Let's count again.", {"rev_whisper": 0.18}),
    ("vo_end_see_you", "poppy", "See you tomorrow, friend!", {"pitches": (92,), "end": True}),
]

PRESET_PEAK = {"poppy": -3.0, "poppy_flat": -3.0, "poppy_wrong": -3.0, "poppy_whisper": -1.0,
               "narrator": -3.0, "crew": -6.0}
PRESET_SPEED = {"poppy": 172, "poppy_flat": 140, "poppy_wrong": 150, "poppy_whisper": 120,
                "narrator": 160, "crew": 160}


def render_voice(preset, text, opts, speed, gap=None):
    o = dict(opts)
    if preset == "poppy":
        x = voice_poppy(text, speed, o.get("pitches", (80, 90, 75, 88)), o.get("prange", "high"))
        if o.get("end"):
            n = len(x)
            x = vari(np.concatenate([x, np.zeros(secs(0.3))]), 0.9 * wow_flutter(n + secs(0.3), 0.006, 0.0015))
            x = trim_silence(x, -60, 0.0, 0.0)
        return x
    if preset == "poppy_flat":
        return voice_poppy_flat(text, speed, 70, o.get("wet", 0.05), o.get("close", 3.0))
    if preset == "poppy_wrong":
        return voice_poppy_wrong(text, o.get("factor", 0.82), o.get("double_db", -12.0), speed,
                                 60, 10 if gap is None else gap, 0.008, o.get("rev_whisper", 0.0),
                                 o.get("close", 0.0))
    if preset == "poppy_whisper":
        return voice_whisper(text)
    if preset == "narrator":
        return voice_narrator(text, speed)
    if preset == "crew":
        return voice_crew(text, speed, o.get("called", False), o.get("laugh", False))
    raise ValueError(preset)


def make_voice(name, preset, text, opts, max_s):
    """Render a line at its preset; if it overruns its slot, first tighten the pauses,
    then (wrong Poppy) the word gaps, and only then speak faster."""
    speed0 = opts.get("speed", PRESET_SPEED[preset])
    plan = [(speed0, None, None), (speed0, None, 0.26), (speed0, 6, 0.22), (speed0, 4, 0.18)]
    if preset != "poppy_wrong":
        plan = plan[:2]
    x, used = None, None
    for speed, gap, pause in plan:
        VOICE_CTX["max_pause"] = pause
        x = render_voice(preset, text, opts, speed, gap)
        x = trim_silence(x, -55, 0.0, 0.0)
        used = (speed, gap, pause)
        if not max_s or len(x) / SR <= max_s:
            break
    speed, gap, pause = used
    for _ in range(6):
        if not max_s or len(x) / SR <= max_s or speed >= 420:
            break
        speed = speed * (len(x) / SR / max_s) * 1.03
        x = render_voice(preset, text, opts, speed, gap)
        x = trim_silence(x, -55, 0.0, 0.0)
    VOICE_CTX["max_pause"] = None
    if max_s and len(x) / SR > max_s:                 # e.g. a reverb tail: fade it inside the slot
        x = fade(x[:secs(max_s)], 0.0, min(0.12, max_s / 4))
    peak = opts.get("peak_db", PRESET_PEAK[preset])
    x = norm(fade(x, 0.0, 0.01), db(peak))
    meta = {"text": text, "voice": preset, "espeak_speed": int(round(min(speed, 450))),
            "pause_limit": pause, "max_seconds": max_s,
            "fits": bool(not max_s or len(x) / SR <= max_s + 1e-6)}
    if gap is not None:
        meta["word_gap"] = gap
    return x, meta


# ==========================================================================
# Songs: theme, reprise, beds, music box
# ==========================================================================

# Each line: caption, [(espeak syllable, note)], (chord bar 1, chord bar 2).
# Seven syllables on beats 0-6 of a 2-bar line; the last one is held.
THEME = [
    ("Poppy, Poppy, red and bright,",
     [("pop", "G4"), ("pee", "E4"), ("pop", "G4"), ("pee", "E4"), ("red", "A4"), ("and", "G4"), ("bright", "E4")],
     ("C", "Am")),
    ("in the meadow, warm and light!",
     [("in", "G4"), ("the", "E4"), ("med", "G4"), ("oh", "A4"), ("warm", "G4"), ("and", "E4"), ("light", "D4")],
     ("C", "G")),
    ("Count the flowers, one, two, three,",
     [("count", "C4"), ("the", "D4"), ("flau", "E4"), ("wers", "E4"), ("one", "G4"), ("two", "A4"), ("three", "C5")],
     ("C", "F")),
    ("feel your feelings, friends with me!",
     [("feel", "C5"), ("your", "A4"), ("feel", "G4"), ("lings", "E4"), ("friends", "D4"), ("with", "E4"), ("me", "C4")],
     ("Am", "C")),
    ("Close your eyes and hide away,",
     [("close", "E4"), ("your", "E4"), ("eyes", "G4"), ("and", "E4"), ("hide", "D4"), ("uh", "C4"), ("way", "D4")],
     ("Am", "G")),
    ("Poppy finds you every day!",
     [("pop", "G4"), ("pee", "E4"), ("finds", "G4"), ("you", "A4"), ("ev", "C5"), ("ree", "D5"), ("day", "C5")],
     ("F", "C")),
]

REPRISE = [
    ("Poppy, Poppy, red and bright,", THEME[0][1], ("C", "Am")),
    ("in your house, and out of sight.",
     [("in", "G4"), ("your", "E4"), ("house", "G4"), ("and", "A4"), ("out", "G4"), ("of", "E4"), ("sight", "D4")],
     ("C", "G")),
    ("Close your eyes and hide away,", THEME[4][1], ("Am", "G")),
    ("Poppy found you. Now you stay.",
     [("pop", "G4"), ("pee", "E4"), ("found", "G4"), ("you", "A4"), ("now", "C5"), ("you", "D5"), ("stay", "F#4")],
     ("F", "C")),
]

SING_VOICE = "en-us+poppysing"


def sing(syl, freq, dur, formant=1.0):
    """One sung syllable: monotone espeak at the note's pitch, fitted to the note length.
    Returns (audio, index of the vowel onset)."""
    f_r, d_r = freq / formant, dur * formant
    p = p_for_hz(SING_VOICE, f_r)
    speed = 170
    x = None
    for _ in range(3):
        x = espeak(syl, SING_VOICE, speed, p, 0, prange="0")
        x = trim_silence(x, -40, 0.0, 0.01)
        L = len(x) / SR
        if abs(L - d_r) < 0.08 * d_r:
            break
        new = float(np.clip(speed * L / d_r, 80, 450))
        if abs(new - speed) < 2:
            break
        speed = new
    f0 = f0_median(x, fmax=1400)
    if f0 > 0 and 0.7 < f_r / f0 < 1.4:
        x = resample(x, f_r / f0)                   # fine pitch correction
    L = len(x) / SR
    if L < 0.85 * d_r:                               # too short for a held note: stretch it
        x = granular(x, 1.0, min(1.8, d_r / L), 0.045)
    if formant != 1.0:
        x = resample(x, formant)
    n = len(x)
    if dur > 0.45:                                   # gentle vibrato on held notes
        t = tvec(n)
        ramp = np.clip((t - 0.15) / 0.3, 0, 1)
        x = vari(np.concatenate([x, np.zeros(400)]), 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t) * ramp)[:n]
    x = x[:secs(dur * 1.08)] if len(x) > secs(dur * 1.08) else x
    x = fade(x, 0.003, 0.04)
    m = moving_rms(x, 0.01)
    onset = int(np.argmax(m > 0.4 * m.max())) if m.max() > 0 else 0
    return x, onset


def song_score(lines, line_starts, beat, rit_last=0.0, intro=None, transpose=0.0):
    """Instrument events and vocal note list for a song made of 2-bar lines."""
    ev, vox = [], []

    def bt(li, b):
        rit = rit_last if li == len(lines) - 1 else 0.0
        return line_starts[li] + beat * (b + rit * b * (b - 1) / 2)

    for li, (cap, syls, chords) in enumerate(lines):
        for k, (syl, note) in enumerate(syls):
            t0 = bt(li, k)
            hold = 1.9 if k == len(syls) - 1 else 0.92
            d = bt(li, k + hold) - t0
            vox.append((t0, d, syl, midi(note) + transpose))
            ev.append((t0, d, midi(note) + 12, "toy", 0.55 if k < 6 else 0.6))
        for bar in range(2):
            ch = chords[bar]
            b0 = bar * 4
            root = midi(ROOTS[ch])
            ev.append((bt(li, b0), bt(li, b0 + 0.9) - bt(li, b0), root, "bass", 0.9))
            ev.append((bt(li, b0 + 2), bt(li, b0 + 2.9) - bt(li, b0 + 2), root + 7, "bass", 0.75))
            for b in (1, 3):
                ev.append((bt(li, b0 + b), beat * 0.45, CHORDS[ch], "organ", 0.5))
                ev.append((bt(li, b0 + b), 0.2, None, "clap", 0.45))
            for b in (0, 2):
                ev.append((bt(li, b0 + b), 0.2, None, "kick", 0.6))
            for h in range(8):
                ev.append((bt(li, b0 + h / 2), 0.05, None, "shaker", 0.35 if h % 2 else 0.18))
        # glockenspiel answer in the held beats
        top = CHORDS[chords[1]]
        for j, b in enumerate((6.5, 7.0, 7.5)):
            nt = midi(top[[2, 1, 0][j]]) + 24
            ev.append((bt(li, b), 0.4, nt, "glock", 0.32))
    return ev, vox


def render_vocals(vox, n, formant=1.0, transpose_v=0.0):
    buf = np.zeros(n + secs(2))
    onsets = []
    for t0, d, syl, m in vox:
        x, onset = sing(syl, mtof(m + transpose_v), d, formant)
        start = secs(t0) - onset
        onsets.append(max(0, start) / SR)
        place(buf, x, start / SR)
    return buf[:n], onsets


def make_theme():
    total = 23.0
    n = secs(total)
    beat = 0.375
    starts = [2.0 + 3.0 * i for i in range(6)]
    ev, vox = song_score(THEME, starts, beat)
    # Intro: glockenspiel sparkle, then one bar of oom-pah with the hook on toy piano.
    for i, nt in enumerate(["C6", "D6", "E6", "G6", "A6", "C7"]):
        ev.append((0.02 + i * 0.07, 0.3, nt, "glock", 0.3))
    t_bar = 0.5
    for b in range(4):
        tb = t_bar + b * beat
        if b in (0, 2):
            ev.append((tb, beat * 0.9, midi("C3") + (7 if b == 2 else 0), "bass", 0.85))
            ev.append((tb, 0.2, None, "kick", 0.6))
        else:
            ev.append((tb, beat * 0.45, CHORDS["C"], "organ", 0.5))
            ev.append((tb, 0.2, None, "clap", 0.45))
    for i, nt in enumerate(["G5", "E5", "G5", "E5", "A5", "G5", "E5"]):
        ev.append((t_bar + i * beat / 2, 0.3, nt, "toy", 0.5))
    # Outro bar on G7 under the spoken "Hi, friend!", then the button.
    for b in range(4):
        tb = 20.0 + b * beat
        if b in (0, 2):
            ev.append((tb, beat * 0.9, midi("G2") + (7 if b == 2 else 0), "bass", 0.7))
        else:
            ev.append((tb, beat * 0.45, CHORDS["G7"], "organ", 0.35))
    ev.append((21.125, 0.12, ["C5", "E5", "G5"], "toy", 0.6))
    ev.append((21.125, 0.12, midi("C3"), "bass", 0.8))
    ev.append((21.125, 0.12, None, "kick", 0.5))
    ev.append((21.5, 1.2, ["C5", "E5", "G5", "C6"], "toy", 0.7))
    ev.append((21.5, 1.2, ["C6", "E6", "G6"], "glock", 0.4))
    ev.append((21.5, 1.1, midi("C2") + 12, "bass", 1.0))
    ev.append((21.5, 0.9, CHORDS["C"], "organ", 0.6))
    ev.append((21.5, 0.2, None, "kick", 0.8))
    ev.append((21.5, 0.2, None, "clap", 0.6))
    music = render_events(ev, n, detune=15.0)
    vocals, onsets = render_vocals(vox, n)
    vocals = tv_voice_chain(vocals, 250, 4500, 1.5, 0.12, 0.3)[:n]
    hi = voice_poppy("Hi, friend!", 172, (92,))
    vocals = vocals / (np.max(np.abs(vocals)) + 1e-9)
    hi = hi / (np.max(np.abs(hi)) + 1e-9)
    hi_at = 20.4 - 0.02
    place(vocals, hi, hi_at, 0.95)
    music = reverb(music, 0.5, 0.12, damp=6000)[:n]
    music = music / (np.max(np.abs(music)) + 1e-9)
    mix = 0.62 * music + 0.75 * vocals
    mix = np.tanh(1.2 * mix) / np.tanh(1.2)
    mix = bp(mix, 60, 11000, 2)
    mix = fade(mix, 0.0, 0.25)
    lyrics = []
    for li, (cap, syls, _) in enumerate(THEME):
        lyrics.append([round(onsets[li * 7], 2), cap])
    lyrics.append([round(hi_at + 0.02, 2), "Hi, friend!"])
    return norm(mix, db(-1)), {"lyrics": lyrics, "bpm": 160, "vocals_env": envelope_json(
        np.maximum(vocals, -1), total)}


def make_reprise():
    total = 17.0
    n = secs(total)
    beat = 0.45
    starts = [1.0, 4.6, 8.2, 11.8]
    tr = -1.5
    ev, vox = song_score(REPRISE, starts, beat, rit_last=0.04, transpose=tr)
    ev = [(t, d, (None if nt is None else ([midi(x) + tr for x in nt] if isinstance(nt, list) else midi(nt) + tr)),
           inst, vel) for t, d, nt, inst, vel in ev]
    ev = [e for e in ev if e[3] not in ("kick", "shaker")]       # no bounce left in it
    # Intro: the hook on a detuned toy piano over a swelling organ.
    for i, nt in enumerate(["G5", "E5", "G5", "E5"]):
        ev.append((0.1 + i * beat / 2, 0.4, midi(nt) + tr, "toy", 0.45))
    ev.append((0.0, 0.95, [midi(x) + tr for x in CHORDS["C"]], "organ", 0.25))
    # The final 'stay' chord is held so the tape can die on it.
    last = max(t for t, *_ in vox)
    ev.append((last, 2.4, [midi(x) + tr for x in CHORDS["C"]], "organ", 0.45))
    ev.append((last, 2.4, midi("C3") + tr, "bass", 0.8))
    music = render_events(ev, n, detune=25.0)
    vocals, onsets = render_vocals(vox, n, formant=0.85)
    vocals = octave_double(norm(vocals, 1.0), -16)
    vocals = tv_voice_chain(vocals, 200, 4000, 1.6, 0.18, 0.45, double=True)[:n]
    music = reverb(music, 0.7, 0.18, damp=4000)[:n]
    mix = 0.6 * norm(music, 1.0) + 0.75 * norm(vocals, 1.0)
    # Tape: wow and flutter growing from 0.3% to 2%, then the transport dies.
    t = tvec(n)
    grow = 0.003 + 0.017 * np.clip(t / 15.0, 0, 1) ** 1.5
    rate = wow_flutter(n, grow, 0.001 + 0.002 * np.clip(t / 15.0, 0, 1))
    die0, die1 = 15.0, 16.5
    k = np.clip((t - die0) / (die1 - die0), 0, 1)
    rate = rate * (1 - k) ** 1.6
    rate[t >= die1] = 0.0
    mix = vari(mix, rate)
    # map lyric starts through the varispeed
    pos = np.concatenate([[0.0], np.cumsum(rate[:-1])]) / SR
    lyrics = []
    for li, (cap, _, _) in enumerate(REPRISE):
        src = onsets[li * 7]
        lyrics.append([round(float(np.interp(src, pos, t)), 2), cap])
    # dropouts
    gain = np.ones(n)
    for d0 in (3.3, 6.85, 9.6, 12.4, 13.6):
        dl = rng.uniform(0.04, 0.18)
        a, b = secs(d0), secs(d0 + dl)
        gain[a:b] = db(-20)
    gain = lp(gain, 120, 2)
    mix = mix * gain
    mix = lp(mix, 3600, 3)
    mix = np.tanh(1.4 * norm(mix, 1.0)) / np.tanh(1.4)
    mix[t >= die1] = 0
    hiss = bp(rng.standard_normal(n), 2000, 8000) * db(-38)
    mix = norm(mix, 1.0) + hiss
    mix[-secs(0.01):] *= np.linspace(1, 0, secs(0.01))
    return norm(mix, db(-3)), {"lyrics": lyrics, "silent_from": die1}


# --------------------------------------------------------------------------
# Playroom bed: 100 bpm, 50 beats = 30.0 s, a seamless loop.
# --------------------------------------------------------------------------

def bed_score(beat, n_beats):
    ev = []
    order = [0, 1, 2, 3, 4, 5]
    for li in order:
        b0 = li * 8
        if b0 >= n_beats:
            break
        cap, syls, chords = THEME[li]
        for k, (_, note) in enumerate(syls):
            m = midi(note) + 12
            ev.append(((b0 + k) * beat, beat * 0.9, m, "toy", 0.42 if k % 2 == 0 else 0.34))
            if k in (1, 3) and li % 2:                # little neighbour-note noodles
                ev.append(((b0 + k + 0.5) * beat, beat * 0.4, m + 2, "toy", 0.22))
        for j, nt in enumerate(CHORDS[chords[1]][::-1]):
            ev.append(((b0 + 6.5 + 0.5 * j) * beat, 0.5, midi(nt) + 24, "glock", 0.25))
        for bar in range(2):
            ch = chords[bar]
            root = midi(ROOTS[ch])
            bb = b0 + bar * 4
            ev.append((bb * beat, beat * 1.8, root, "bass", 0.55))
            ev.append(((bb + 2) * beat, beat * 1.8, root + 7, "bass", 0.45))
            ev.append((bb * beat, beat * 3.8, CHORDS[ch], "pad", 0.35))
            ev.append(((bb + 1.5) * beat, 0.4, midi(CHORDS[ch][2]) + 24, "glock", 0.12))
    if n_beats >= 50:                                 # 2-beat turnaround back to the top
        for j, nt in enumerate(["G5", "A5", "C6", "D6"]):
            ev.append(((48 + 0.5 * j) * beat, 0.35, nt, "glock", 0.3))
        ev.append((48 * beat, beat * 1.8, midi("G2"), "bass", 0.5))
    return [e for e in ev if e[0] < n_beats * beat]


def make_bed():
    total = 30.0
    n = secs(total)
    beat = 0.6
    ev = bed_score(beat, 50)
    buf = render_events(ev, n, detune=15.0, circular=True)
    buf = reverb(buf, 0.6, 0.14, damp=6000, circular=True)
    buf = lp(buf, 9000, 2, circ=True)
    return norm(buf, db(-6)), {"bpm": 100, "loop": True}


def make_bed_wrong():
    total = 30.0
    n = secs(total)
    beat = 0.75                                     # ~80% tempo
    ev = bed_score(beat, 40)
    tr = 12 * np.log2(0.94)                         # resampled x0.94: about a semitone flat
    buf = render_events(ev, n, detune=30.0, transpose=tr, drop=0.13, circular=True)
    buf = reverb(buf, 0.8, 0.2, damp=3500, circular=True)
    rate = wow_flutter(n, 0.015, 0.002)
    rate = rate / rate.mean()
    buf = vari(buf, rate, circular=True)
    buf = lp(buf, 3000, 4, circ=True)
    buf = np.tanh(1.3 * norm(buf, 1.0))
    return norm(buf, db(-6)), {"bpm": 80, "loop": True}


def make_music_box():
    total = 19.5
    n = secs(total)
    beat = 0.5
    src_len = 40.0
    ev = []
    for li in range(6):
        b0 = 0.3 / beat + li * 8
        cap, syls, chords = THEME[li]
        for k, (_, note) in enumerate(syls):
            ev.append(((b0 + k) * beat, 1.6, midi(note) + 12, "mbox", 0.8))
        for bar in range(2):
            ch = chords[bar]
            ev.append(((b0 + bar * 4) * beat, 1.6, midi(ROOTS[ch]) + 12, "mbox", 0.5))
            ev.append(((b0 + bar * 4 + 2) * beat, 1.6, midi(CHORDS[ch][1]) + 12, "mbox", 0.3))
    src = render_events(ev, secs(src_len), detune=6.0)
    # mechanism: faint ratchet clicks and a governor whirr, in source time
    clicks = np.zeros(len(src))
    for i in range(int(src_len / 0.125)):
        c = hp(rng.standard_normal(secs(0.002)), 3000) * rng.uniform(0.02, 0.05)
        place(clicks, c, i * 0.125 + rng.uniform(-0.004, 0.004))
    whirr = bp(rng.standard_normal(len(src)), 1200, 3500) * 0.006 * (1 + 0.5 * np.sin(2 * np.pi * 16 * tvec(len(src))))
    src = src + clicks + whirr
    onsets = sorted({round(e[0], 4) for e in ev if e[2] is not None and e[4] >= 0.8})
    # wind-down: speed (tempo and pitch) decays exponentially from t0; pick tau so a note is
    # struck ~50 ms before the end and gets cut off half-way.
    t0 = 14.0
    best = None
    for tau in np.arange(3.0, 7.0, 0.002):
        for s in onsets:
            if s <= t0:
                continue
            if s - t0 >= tau:
                break
            out_t = t0 - tau * np.log(1 - (s - t0) / tau)
            if 19.43 <= out_t <= 19.47:
                best = (tau, s, out_t)
                break
        if best:
            break
    tau = best[0] if best else 5.0
    t = tvec(n)
    rate = np.where(t < t0, 1.0, np.exp(-(t - t0) / tau))
    y = vari(src, rate)
    y = reverb(y, 0.35, 0.1, damp=7000, tail=False)
    y = fit(y, n)                                     # hard stop at exactly 19.5 s, no fade
    meta = {"winddown_start": t0, "winddown_tau": round(float(tau), 3),
            "last_note_struck_at": round(best[2], 3) if best else None}
    return norm(y, db(-6)), meta


def make_ident():
    total = 5.0
    n = secs(total)
    buf = np.zeros(n + secs(3))
    for i, nt in enumerate(["C5", "E5", "G5", "C6"]):
        place(buf, toy_piano(mtof(midi(nt)), 1.2, 0.8), 0.05 + i * 0.22)
        place(buf, glock(mtof(midi(nt) + 12), 1.2, 0.35), 0.05 + i * 0.22)
    # sparkle and the held major chord
    for i, nt in enumerate(["C6", "E6", "G6", "C7", "E7"]):
        place(buf, glock(mtof(midi(nt)), 1.5, 0.25 * (1 - 0.1 * i)), 0.95 + i * 0.045)
    place(buf, pad([mtof(midi(x)) for x in ["C4", "E4", "G4", "C5"]], 4.0, 1.1, attack=0.5, release=1.2), 0.0)
    for nt in ["C5", "E5", "G5", "C6"]:
        place(buf, toy_piano(mtof(midi(nt)), 3.5, 0.45), 0.95)
    place(buf, bass_note(mtof(midi("C3")), 3.0, 0.6), 0.95)
    for i in range(16):
        place(buf, shaker(0.25 if i % 2 else 0.12), 0.05 + i * 0.11)
    # a soft high shimmer that decays
    shimmer = sum(sine(mtof(midi(x)) * 2, 4.0) for x in ["C6", "G6"]) * expdec(secs(4.0), 1.0) * 0.05
    place(buf, shimmer, 1.0)
    y = reverb(buf[:n], 1.2, 0.2, damp=6000)[:n]
    y = fade(y, 0.0, 1.2)
    return norm(y, db(-1)), {}


def make_bumper():
    total = 2.0
    n = secs(total)
    buf = np.zeros(n + secs(2))
    for i, nt in enumerate(["C5", "E5", "G5", "C6", "E6"]):
        place(buf, toy_piano(mtof(midi(nt)), 0.6, 0.7), i * 0.075)
    place(buf, slide_whistle(650, 1900, 0.5, 0.45), 0.42)
    # ta-da
    for t0, d, v in ((1.0, 0.13, 0.7), (1.2, 0.8, 1.0)):
        for nt in ["C5", "E5", "G5", "C6"]:
            place(buf, toy_piano(mtof(midi(nt)), d + 0.6, v * 0.6), t0)
        place(buf, organ([mtof(midi(x)) for x in CHORDS["C"]], d, v * 0.6), t0)
        place(buf, bass_note(mtof(midi("C3")), d, v * 0.8), t0)
        place(buf, kick(0.5 * v), t0)
    place(buf, glock(mtof(midi("C7")), 0.8, 0.3), 1.2)
    place(buf, glock(mtof(midi("G6")), 0.8, 0.25), 1.25)
    y = reverb(buf[:n], 0.5, 0.12)[:n]
    y = fade(y, 0, 0.25)
    return norm(y, db(-1)), {}


# ==========================================================================
# Ambiences (20 s seamless loops: everything is built periodic)
# ==========================================================================

def colored_noise(n, slope_db_oct=-6.0, lo=20, hi=None):
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.where(f > 0, (np.maximum(f, 1) / 1000.0) ** (slope_db_oct / 6.0206), 0)
    g[f < lo] *= (f[f < lo] / lo) ** 3
    if hi:
        g /= np.sqrt(1 + (f / hi) ** 8)
    y = np.fft.irfft(spec * g, n)
    return y / np.std(y)


def make_room_tone():
    n = secs(20.0)
    x = colored_noise(n, -6.0, 25, 500)                 # brown noise, low-passed at 500 Hz
    x = x + 0.04 * sine(120.0, 20.0) + 0.012 * sine(240.0, 20.0)
    return x * (db(-20) / rms(x)), {"loop": True, "level": "-20 dBFS RMS"}


def make_studio_night():
    n = secs(20.0)
    t = tvec(n)
    hvac = colored_noise(n, -5.0, 32, 260) * (1 + 0.15 * lfo_noise(n, 0.05, 0.4))
    air = bp(rng.standard_normal(n), 300, 1800, 2, circ=True) * 0.08
    buzz = np.zeros(n)
    for k, a in ((1, 1.0), (2, 0.5), (3, 0.35), (4, 0.2), (5, 0.12), (7, 0.06)):
        buzz += a * np.sin(2 * np.pi * 120 * k * t)
    buzz *= 0.05 * (1 + 0.1 * lfo_noise(n, 0.1, 1.0))
    ticks = np.zeros(n)
    for t0 in (2.1, 8.4, 14.6):
        ping = resonators([2310, 3170, 4480, 5960], [0.08, 0.05, 0.03, 0.02], [1, 0.6, 0.4, 0.2], 0.3)
        ping[:secs(0.002)] += rng.standard_normal(secs(0.002)) * 0.5
        place(ticks, ping * 0.5, t0, circular=True)
    wet = reverb(ticks + 0.3 * air, 2.6, 0.75, damp=3500, circular=True)
    x = 0.55 * hvac + air + buzz + wet
    x = reverb(x, 1.8, 0.25, damp=3000, circular=True)
    return norm(x, db(-6)), {"loop": True}


def make_fluorescent():
    n = secs(20.0)
    t = tvec(n)
    hum = np.zeros(n)
    for k in range(1, 40):
        hum += (1.0 / k ** 0.85) * np.sin(2 * np.pi * 120 * k * t + rng.uniform(0, 6.28))
    hum = lp(hum, 3500, 2, circ=True)
    hum = np.tanh(2.2 * norm(hum, 1.0) + 0.25)          # asymmetric crunch
    hum = hum - hum.mean()
    gate = np.ones(n)
    ticks = np.zeros(n)
    for t0 in (3.7, 9.2, 9.45, 15.8):
        d = rng.uniform(0.04, 0.14)
        a, b = secs(t0), secs(t0 + d)
        gate[a:b] *= rng.uniform(0.05, 0.4)
        click = hp(rng.standard_normal(secs(0.004)), 1500) * np.hanning(secs(0.004))
        place(ticks, click * 0.6, t0, circular=True)
        place(ticks, click * 0.35, t0 + d, circular=True)
    gate = lp(gate, 400, 2, circ=True)
    x = hum * gate * (1 + 0.03 * lfo_noise(n, 0.2, 2.0)) + ticks
    x = x + 0.02 * bp(rng.standard_normal(n), 3000, 9000, circ=True)
    x = reverb(x, 0.35, 0.2, damp=5000, circular=True)
    return norm(x, db(-6)), {"loop": True}


def make_house_night():
    n = secs(20.0)
    t = tvec(n)
    fridge = (np.sin(2 * np.pi * 58 * t) + 0.6 * np.sin(2 * np.pi * 116 * t)
              + 0.3 * np.sin(2 * np.pi * 174 * t) + 0.15 * np.sin(2 * np.pi * 232 * t))
    fridge *= 0.18 * (1 + 0.15 * lfo_noise(n, 0.05, 0.3))
    fridge = lp(fridge, 300, 2, circ=True)
    clock = np.zeros(n)
    for i in range(20):
        f1 = 3100 if i % 2 == 0 else 2500
        tk = resonators([f1, f1 * 1.47, f1 * 2.3], [0.012, 0.008, 0.005], [1, 0.5, 0.3], 0.05)
        place(clock, tk * (0.22 if i % 2 == 0 else 0.17), 0.5 + i * 1.0, circular=True)
    clock = reverb(lp(clock, 2500, 2, circ=True), 0.9, 0.5, damp=2500, circular=True)
    base = bp(rng.standard_normal(n), 120, 1400, 2, circ=True)
    wind = base * (0.35 + 0.65 * np.clip(0.5 + 0.35 * lfo_noise(n, 0.03, 0.25), 0, 1.2))
    whistle = np.zeros(n)
    for fc in (620, 840, 1150):
        band = bp(rng.standard_normal(n), fc * 0.93, fc * 1.07, 6, circ=True)
        g = np.clip(lfo_noise(n, 0.02, 0.15), 0, None)
        whistle += band * g * 0.25
    x = fridge + 0.5 * wind + whistle + clock
    return norm(x, db(-6)), {"loop": True}


def make_drone():
    n = secs(20.0)
    t = tvec(n)
    x = (np.sin(2 * np.pi * 41 * t) + np.sin(2 * np.pi * 42 * t)
         + 0.5 * np.sin(2 * np.pi * 82 * t) + 0.5 * np.sin(2 * np.pi * 83 * t))
    noise_lo = bp(rng.standard_normal(n), 60, 150, 4, circ=True)
    noise_hi = bp(rng.standard_normal(n), 150, 300, 4, circ=True)
    m = 0.5 + 0.5 * np.tanh(lfo_noise(n, 0.03, 0.2))
    noise = (noise_lo * m + noise_hi * (1 - m)) * (1 + 0.3 * lfo_noise(n, 0.05, 0.3))
    x = norm(x, 1.0) + 0.35 * noise / np.std(noise) * 0.35
    x = np.tanh(1.8 * norm(x, 1.0))                     # harmonics so small speakers hear it
    x = hp(x, 34, 6, circ=True)                          # nothing below 30 Hz
    x = lp(x, 900, 2, circ=True)
    return norm(x, db(-6)), {"loop": True}


# ==========================================================================
# Sound effects
# ==========================================================================

def impact(dur, body_freqs, body_taus, click_band=(1000, 6000), thump_hz=0.0, thump_tau=0.03):
    n = secs(dur)
    t = tvec(n)
    exc = np.zeros(n)
    exc[:secs(0.003)] = rng.standard_normal(secs(0.003)) * np.hanning(secs(0.003))
    y = fftconv(exc, resonators(body_freqs, body_taus, None, dur))[:n] * 0.3
    y += bp(rng.standard_normal(n), *click_band) * np.exp(-t / 0.006) * 0.6
    if thump_hz:
        y += np.sin(2 * np.pi * thump_hz * t) * np.exp(-t / thump_tau) * 0.8
        y += lp(rng.standard_normal(n), 400) * np.exp(-t / 0.02) * 0.5
    return attack_ramp(y, 0.0005)


def motor(dur, f_curve, whine_ratio=7.3, vel=1.0):
    n = secs(dur)
    f = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(f_curve)), f_curve)
    buzz = lp(saw(f), 1400, 2)
    whine = sine(f * whine_ratio) * 0.15
    grit = bp(rng.standard_normal(n), 700, 3000) * 0.12 * (1 + np.sin(2 * np.pi * np.cumsum(f / 3) / SR))
    return vel * (buzz * 0.5 + whine + grit)


def make_vcr_insert():
    n = secs(1.2)
    buf = np.zeros(n)
    place(buf, impact(0.15, [2100, 3400, 5200], [0.02, 0.012, 0.008], (1500, 7000)), 0.0, 0.9)
    slide = bp(rng.standard_normal(secs(0.18)), 800, 3000) * np.hanning(secs(0.18)) * 0.25
    place(buf, slide, 0.08)
    place(buf, impact(0.3, [180, 410, 2800, 4300], [0.06, 0.04, 0.015, 0.01], (500, 4000), 110, 0.05), 0.33, 1.0)
    m = motor(0.72, [60, 110, 135, 140, 140, 138], 6.1, 0.55)
    m *= np.minimum(1, tvec(len(m)) / 0.03) * np.minimum(1, (0.72 - tvec(len(m))) / 0.1)
    place(buf, m, 0.42)
    place(buf, impact(0.2, [240, 1900, 3600], [0.04, 0.012, 0.008], (800, 5000), 90, 0.03), 0.8, 0.6)
    place(buf, impact(0.1, [3000, 4700], [0.008, 0.005], (2000, 8000)), 1.08, 0.3)
    y = reverb(buf, 0.25, 0.1, tail=False)
    return norm(fade(y, 0, 0.03), db(-1)), {}


def make_vcr_stop():
    n = secs(0.6)
    buf = np.zeros(n)
    place(buf, impact(0.25, [200, 520, 2600, 3900], [0.05, 0.03, 0.012, 0.008], (600, 5000), 95, 0.04), 0.0, 1.0)
    f = np.geomspace(140, 25, 50)
    m = motor(0.5, f, 6.1, 0.5) * expdec(secs(0.5), 0.2)
    place(buf, m, 0.03)
    place(buf, impact(0.08, [2600, 4100], [0.01, 0.006], (1500, 6000)), 0.5, 0.25)
    return norm(fade(buf, 0, 0.03), db(-1)), {}


def make_bars_tone():
    x = fade(sine(1000.0, 4.0), 0.005, 0.005)
    return norm(x, db(-1)), {}


def make_static_burst():
    dur = 1.5
    n = secs(dur)
    x = bp(snow(dur), 200, 9000, 4)
    x = np.clip(x / (2.2 * np.std(x)), -1, 1)                # hard ceiling: never spikes
    flutter = 0.82 + 0.18 * np.tanh(lfo_noise(n, 8, 40))
    x = x * flutter
    return norm(fade(x, 0.002, 0.03), db(-1)), {}


def make_tracking_garble():
    dur = 0.6
    n = secs(dur)
    t = tvec(n)
    frag = np.zeros(n + secs(1))
    for i, nt in enumerate(["G5", "E5", "G5", "A5", "C6"]):
        place(frag, toy_piano(mtof(midi(nt) + rng.uniform(-0.4, 0.4)), 0.5, 0.8), i * 0.11)
    rate = 1 + 0.12 * lfo_noise(len(frag), 6, 18) + 0.25 * np.sin(2 * np.pi * 2.2 * tvec(len(frag)))
    frag = vari(frag, np.maximum(rate, 0.2))[:n]
    frag = reverb(frag, 0.25, 0.4, tail=False)
    noise = bp(snow(dur), 300, 6000)
    buzz = lp(saw(np.full(n, 59.94)), 3000, 2) * 0.5
    # chop everything into 15-60 ms slivers
    gate_a, gate_b = np.zeros(n), np.zeros(n)
    i = 0
    while i < n:
        L = secs(rng.uniform(0.015, 0.06))
        r = rng.random()
        if r < 0.45:
            gate_a[i:i + L] = 1
        elif r < 0.8:
            gate_b[i:i + L] = 1
        else:
            gate_a[i:i + L] = 0.5
            gate_b[i:i + L] = 0.5
        i += L
    gate_a, gate_b = lp(gate_a, 300, 2), lp(gate_b, 300, 2)
    x = norm(frag, 1) * gate_a + 0.6 * norm(noise + buzz, 1) * gate_b
    x = x * (1 + 0.3 * np.sin(2 * np.pi * 9 * t))
    x = np.tanh(1.5 * norm(x, 1))
    return norm(fade(x, 0.002, 0.03), db(-1)), {}


def make_pop():
    dur = 0.35
    n = secs(dur)
    t = tvec(n)
    f = 260 * (1000 / 260) ** np.minimum(1, t / 0.045)
    blip = sine(f) * np.exp(-t / 0.05)
    k = np.clip((t - 0.035) / 0.3, 0, 1)
    boing_f = 760 * (1 - 0.15 * k) * (1 + 0.07 * np.sin(2 * np.pi * 22 * t) * np.exp(-t / 0.12))
    boing = sine(boing_f) * np.clip((t - 0.03) / 0.01, 0, 1) * np.exp(-np.maximum(0, t - 0.03) / 0.08) * 0.5
    puff = lp(rng.standard_normal(n), 1500) * np.exp(-t / 0.012) * 0.6
    x = attack_ramp(blip + boing + puff, 0.001)
    return norm(fade(x, 0, 0.03), db(-1)), {}


def make_scribble():
    dur = 1.5
    n = secs(dur)
    buf = np.zeros(n)
    t0 = 0.0
    d = 0
    while t0 < dur - 0.05:
        L = rng.uniform(0.06, 0.13)
        m = secs(L)
        tt = tvec(m)
        rough = 1 + 0.9 * np.tanh(2 * lp(rng.standard_normal(m), rng.uniform(250, 700)))
        lo, hi = (1300, 5500) if d % 2 else (2200, 8000)
        s = bp(rng.standard_normal(m), lo, hi, 2) * rough
        env = np.minimum(1, tt / 0.008) * np.minimum(1, (L - tt) / 0.015)
        acc = rng.uniform(0.6, 1.0) * (1.4 if rng.random() < 0.15 else 1.0)
        s = s * env * acc
        s += lp(rng.standard_normal(m), 400) * env * 0.25        # paper body
        place(buf, s, t0)
        gap = rng.uniform(0.0, 0.03) if rng.random() > 0.12 else rng.uniform(0.06, 0.12)
        t0 += L + gap
        d += 1
    buf = np.tanh(1.6 * norm(buf, 1))
    return norm(fade(buf, 0.002, 0.04), db(-1)), {}


def make_cam_beep():
    n = secs(0.4)
    buf = np.zeros(n)
    for t0 in (0.02, 0.20):
        b = sine(2600.0, 0.1) + 0.18 * sine(7800.0, 0.1)
        place(buf, fade(b, 0.003, 0.004), t0, 0.8)
    place(buf, impact(0.05, [3200, 5100], [0.006, 0.004], (2000, 6000)), 0.33, 0.35)
    hum = motor(0.06, [90, 120], 5.0, 0.1)
    place(buf, fade(hum, 0.005, 0.02), 0.335)
    buf = bp(buf, 100, 6500, 2)
    return norm(buf, db(-1)), {}


def footstep(heel=1.0, squeak=False):
    n = secs(0.35)
    y = np.zeros(n)
    place(y, impact(0.25, [95, 210, 1200, 2300], [0.04, 0.03, 0.012, 0.008], (1200, 5000), 80, 0.035), 0.0, heel)
    place(y, impact(0.15, [160, 1500, 2700], [0.02, 0.01, 0.006], (1800, 6000)), rng.uniform(0.06, 0.09), 0.45 * heel)
    if squeak:
        L = 0.06
        f = np.linspace(1700, 2300, secs(L))
        place(y, sine(f) * np.hanning(secs(L)) * 0.08, 0.1)
    return y


def make_footsteps():
    dur = 8.0
    n = secs(dur)
    buf = np.zeros(n)
    steps = 14                                           # 1.75 steps per second, loops
    for i in range(steps):
        t0 = i * dur / steps + rng.uniform(-0.03, 0.03)
        st = footstep((0.85 if i % 2 else 1.0) * rng.uniform(0.8, 1.05), squeak=(i in (3, 10)))
        place(buf, st, t0, circular=True)
    buf = reverb(buf, 0.9, 0.22, damp=4000, circular=True)
    buf = bp(buf, 100, 6000, 2, circ=True)
    return norm(buf, db(-1)), {"loop": True}


def metal_clang(f0, dur=1.2, vel=1.0):
    ratios = [1.0, 2.756, 5.404, 8.933, 13.34]
    taus = [0.9, 0.55, 0.3, 0.18, 0.1]
    amps = [1.0, 0.8, 0.55, 0.35, 0.2]
    ir = resonators([f0 * r for r in ratios], taus, amps, dur)
    exc = rng.standard_normal(secs(0.004)) * np.hanning(secs(0.004))
    return vel * fftconv(exc, ir)[:secs(dur)]


def make_clunk():
    dur = 1.5
    n = secs(dur)
    buf = np.zeros(n + secs(3))
    # short creak as it tips
    m = secs(0.2)
    rate = np.linspace(180, 420, m)
    ph = np.cumsum(rate) / SR
    exc = np.zeros(m)
    exc[np.where(np.diff(np.floor(ph)) > 0)[0]] = 1
    creak = fftconv(exc, resonators([1900, 2700, 3900], [0.01, 0.008, 0.005], None, 0.05))[:m]
    place(buf, creak * np.hanning(m) * 0.3, 0.02)
    # the clang on concrete
    hit = metal_clang(410, 1.4, 1.0) + metal_clang(617, 1.4, 0.6)
    thud = impact(0.3, [120, 340], [0.05, 0.03], (800, 7000), 70, 0.06) * 2.0
    hit[:len(thud)] += thud[:len(hit)]
    place(buf, hit, 0.24)
    for t0, v in ((0.43, 0.45), (0.53, 0.3), (0.6, 0.2), (0.66, 0.12), (0.71, 0.08)):
        place(buf, metal_clang(410 * rng.uniform(0.98, 1.02), 0.8, v), t0)
        place(buf, impact(0.1, [300], [0.02], (1000, 6000)) * v, t0)
    # rattling tail
    for i in range(14):
        t0 = 0.75 + i * 0.035 * (1 + 0.15 * i) + rng.uniform(0, 0.01)
        place(buf, impact(0.05, [2400, 3700], [0.01, 0.006], (2000, 7000)) * 0.12 * (1 - i / 15), t0)
    y = reverb(buf, 2.2, 0.32, damp=3500, predelay=0.03)[:n]
    y = np.tanh(1.3 * norm(y, 1))
    return norm(fade(y, 0, 0.2), db(-1)), {}


def make_hanger():
    dur = 0.8
    n = secs(dur)
    buf = np.zeros(n + secs(1))
    scrape = bp(rng.standard_normal(secs(0.3)), 1800, 7000, 2) * np.hanning(secs(0.3)) * 0.15
    place(buf, scrape * (1 + 0.8 * np.sin(2 * np.pi * 37 * tvec(secs(0.3)))), 0.0)
    times = np.sort(np.concatenate([rng.uniform(0.0, 0.18, 9), rng.uniform(0.2, 0.42, 7), rng.uniform(0.45, 0.6, 3)]))
    for t0 in times:
        f = rng.uniform(1700, 3600)
        ping = resonators([f, f * 2.41, f * 4.13], [rng.uniform(0.05, 0.16), 0.04, 0.02], [1, 0.5, 0.25], 0.3)
        ping *= rng.uniform(0.3, 1.0)
        place(buf, ping, t0)
    place(buf, metal_clang(880, 0.6, 0.25), 0.02)
    y = reverb(buf, 0.35, 0.18, damp=6000)[:n]
    return norm(fade(y, 0, 0.1), db(-1)), {}


def make_cam_drop():
    dur = 0.8
    n = secs(dur)
    t = tvec(n)
    buf = np.zeros(n)
    place(buf, impact(0.5, [70, 160, 520, 940, 1500], [0.08, 0.05, 0.03, 0.02, 0.012], (300, 5000), 62, 0.09) * 2, 0.0)
    for t0, v in ((0.16, 0.5), (0.27, 0.3), (0.33, 0.2), (0.41, 0.12)):
        place(buf, impact(0.08, [700, 1300, 2600], [0.02, 0.012, 0.008], (900, 6000)) * v, t0)
    # mic overload and crunch: heavy drive, bit crush, crackle
    crack = np.zeros(n)
    k = rng.random(n) < 0.002 * np.exp(-t / 0.2)
    crack[k] = rng.uniform(-1, 1, k.sum())
    crack = bp(crack, 500, 6000) * 3
    x = buf + crack
    drive = 1 + 9 * np.exp(-t / 0.25)
    x = np.tanh(drive * norm(x, 1))
    x = bitcrush(x, 6, 3) * np.exp(-t / 0.35) + x * 0.3 * np.exp(-t / 0.35)
    x = bp(x, 100, 6000, 2)
    return norm(fade(x, 0, 0.05), db(-1)), {}


def make_toy_fall():
    dur = 1.2
    n = secs(dur)
    buf = np.zeros(n + secs(1))
    for t0, v in ((0.0, 1.0), (0.27, 0.55), (0.45, 0.3)):
        hit = impact(0.25, [140, 260, 930, 1460, 2350], [0.05, 0.03, 0.035, 0.025, 0.015], (900, 7000), 150, 0.025)
        place(buf, hit * v, t0)
    # the voice box chirps: espeak 'hee hee', squashed to 8 bits and dragging like a weak battery
    hee = espeak("hee hee", "en-us+poppysing", 230, 95, 0, prange="x-high")
    hee = trim_silence(hee, -40, 0, 0.02)
    hee = resample(hee, 1.25)
    m = len(hee)
    rate = np.linspace(1.0, 0.72, m) * (1 + 0.02 * np.sin(2 * np.pi * 9 * tvec(m)))
    hee = vari(np.concatenate([hee, np.zeros(m)]), np.concatenate([rate, np.full(m, 0.72)]))
    hee = trim_silence(hee, -50, 0, 0.0)
    hee = bitcrush(norm(hee, 1), 6, 5)
    hee = bp(hee, 700, 5000, 2)
    place(buf, hee * 0.55, 0.63)
    y = reverb(buf[:n], 0.4, 0.12)[:n]
    return norm(fade(y, 0, 0.05), db(-1)), {}


def creak(dur, rate_pts, body, taus, seed_amp=1.0):
    n = secs(dur)
    rate = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(rate_pts)), rate_pts)
    rate = rate * (1 + 0.12 * lfo_noise(n, 2, 12))
    ph = np.cumsum(rate) / SR
    exc = np.zeros(n)
    idx = np.where(np.diff(np.floor(ph)) > 0)[0]
    exc[idx] = rng.uniform(0.5, 1.0, len(idx)) * seed_amp
    y = fftconv(exc, resonators(body, taus, None, 0.25))[:n]
    y += bp(rng.standard_normal(n), 500, 3000) * 0.02 * np.abs(lfo_noise(n, 1, 6))
    return y


def make_door_creak():
    dur = 2.0
    n = secs(dur)
    t = tvec(n)
    y = creak(dur, [24, 40, 58, 50, 66, 45, 34, 28], [190, 340, 600, 920, 1330, 1950, 2700],
              [0.03, 0.025, 0.02, 0.015, 0.012, 0.008, 0.006])
    env = np.minimum(1, t / 0.03) * np.minimum(1, (dur - t) / 0.35) * (0.7 + 0.3 * np.tanh(lfo_noise(n, 0.5, 3)))
    y = np.tanh(1.5 * norm(y * env, 1))
    y = reverb(y, 0.6, 0.15, tail=False)
    return norm(y, db(-1)), {}


def stinger(dur, saw_lo, saw_hi, n_saws, vib_lo, vib_hi, glide_oct, noise_dur, thump_tau,
            crunch=0.0, drive=2.5):
    n = secs(dur)
    t = tvec(n)
    freqs = np.geomspace(saw_lo, saw_hi, n_saws) * rng.uniform(0.97, 1.03, n_saws)
    glide = 2 ** (-glide_oct * (1 - np.exp(-t / (dur * 0.45))) / (1 - np.exp(-1 / 0.45)))
    scr = np.zeros(n)
    for f in freqs:
        vr = rng.uniform(vib_lo, vib_hi)
        fc = f * glide * (1 + 0.03 * np.sin(2 * np.pi * vr * t + rng.uniform(0, 6.28)))
        scr += saw(fc)
    scr = scr / n_saws * np.exp(-t / (dur * 0.5))
    nb = np.zeros(n)
    m = secs(noise_dur)
    nb[:m] = bp(snow(noise_dur), 200, 9000, 2) * np.exp(-tvec(m) / (noise_dur * 0.45))
    thump = (np.sin(2 * np.pi * 45 * t) + 0.5 * np.sin(2 * np.pi * 90 * t + 0.5)) * np.exp(-t / thump_tau)
    x = 0.9 * nb / (np.max(np.abs(nb)) + 1e-9) + 1.0 * thump + 0.8 * scr / (np.max(np.abs(scr)) + 1e-9)
    x = np.tanh(drive * x)
    if crunch:
        k = np.exp(-t / 0.15)
        x = x * (1 - k * crunch) + k * crunch * bitcrush(np.tanh(6 * x), 5, 4)
        x = bp(x, 100, 6000, 2)
    x = attack_ramp(x, 0.0015)
    x = fade(x, 0, 0.08)
    return x


def make_stinger_1():
    x = stinger(1.0, 900, 2400, 3, 10, 10, 0.8, 0.3, 0.35, crunch=0.7)
    return norm(x, db(-1)), {}


def make_stinger_2():
    x = stinger(1.0, 1200, 3000, 5, 12, 12, 0.9, 0.15, 0.3, drive=3.0)
    return norm(x, db(-1)), {}


def make_stinger_3():
    x = stinger(1.4, 800, 3000, 5, 8, 14, 1.0, 0.3, 0.7, drive=3.0)
    return norm(x, db(-1)), {}


def make_scream():
    dur = 1.4
    n = secs(dur)
    t = tvec(n)
    v = espeak("aaaah", "en-us+poppysing", 80, 99, 0, prange="0")
    v = trim_silence(v, -30, 0, 0)
    v = granular(v, 1.0, max(1.0, dur * 1.1 * SR / len(v)), 0.04)
    v = fit(v, n)
    # shriek contour: snaps up, then sags
    contour = np.interp(t, [0, 0.12, 0.6, dur], [1.0, 1.18, 1.05, 0.82])
    v = vari(np.concatenate([v, np.zeros(n)]), contour)[:n]
    ring = np.sin(2 * np.pi * np.cumsum(np.interp(t, [0, dur], [70, 40])) / SR)
    voice = 0.75 * v * ring + 0.35 * v
    noise = rng.standard_normal(n)
    form = sum(a * bp(noise, f * 0.9, f * 1.1, 4) for f, a in ((800, 1.0), (1200, 0.8), (2500, 0.5)))
    form = form / np.std(form) * np.std(voice) * 0.9
    x = norm(voice, 1) + norm(form, 1) * 0.7
    vib = 1 + 0.04 * np.sin(2 * np.pi * np.cumsum(np.interp(t, [0, dur], [6, 9])) / SR)
    x = vari(np.concatenate([x, np.zeros(n)]), vib)[:n]
    growl = resample(x, 0.5)[:n]
    x = norm(x, 1) + 0.6 * norm(growl, 1)
    x = np.tanh(3.0 * norm(x, 1))
    x = hp(x, 90, 2)
    env = np.minimum(1, t / 0.002) * np.minimum(1, (dur - t) / 0.25)
    x = x * env
    return norm(x, db(-1)), {}


# ==========================================================================
# Registry, manifest and CLI
# ==========================================================================

GENERATORS = {
    "mus_ident_chime": make_ident,
    "mus_theme": make_theme,
    "mus_bumper": make_bumper,
    "mus_playroom_bed": make_bed,
    "mus_playroom_bed_wrong": make_bed_wrong,
    "mus_music_box": make_music_box,
    "mus_reprise": make_reprise,
    "amb_room_tone": make_room_tone,
    "amb_studio_night": make_studio_night,
    "amb_fluorescent": make_fluorescent,
    "amb_house_night": make_house_night,
    "amb_drone": make_drone,
    "sfx_vcr_insert": make_vcr_insert,
    "sfx_vcr_stop": make_vcr_stop,
    "sfx_bars_tone": make_bars_tone,
    "sfx_static_burst": make_static_burst,
    "sfx_tracking_garble": make_tracking_garble,
    "sfx_pop": make_pop,
    "sfx_scribble": make_scribble,
    "sfx_cam_beep": make_cam_beep,
    "sfx_footsteps": make_footsteps,
    "sfx_clunk": make_clunk,
    "sfx_hanger": make_hanger,
    "sfx_cam_drop": make_cam_drop,
    "sfx_toy_fall": make_toy_fall,
    "sfx_door_creak": make_door_creak,
    "sfx_stinger_1": make_stinger_1,
    "sfx_stinger_2": make_stinger_2,
    "sfx_stinger_3": make_stinger_3,
    "sfx_scream": make_scream,
}
VOICES = {name: (preset, text, opts) for name, preset, text, opts in VOICE_LINES}


def load_assets():
    with open(ASSETS) as fh:
        items = json.load(fh)["audio"]
    out = {}
    for a in items:
        name = os.path.splitext(os.path.basename(a["file"]))[0]
        out[name] = a
    return out


def wav_path(name):
    return os.path.join(OUT, name + ".wav")


def wav_ok(path):
    try:
        with wave.open(path) as w:
            return (w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2
                    and w.getnframes() > 0)
    except Exception:
        return False


def atomic_write_bytes(path, data):
    tmp = path + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(data)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


def atomic_write_json(path, obj, indent=1):
    atomic_write_bytes(path, (json.dumps(obj, indent=indent) + "\n").encode())


def write_wav(path, x):
    x = np.clip(np.asarray(x, dtype=float), -1, 1)
    pcm = np.round(x * 32767).astype("<i2").tobytes()
    tmp = path + ".tmp"
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)
    os.replace(tmp, path)


def stats(x):
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    r = rms(x)
    return {"duration": round(len(x) / SR, 3), "peak": round(peak, 4), "rms": round(r, 5),
            "peak_dbfs": round(20 * np.log10(max(peak, 1e-9)), 2),
            "rms_dbfs": round(20 * np.log10(max(r, 1e-9)), 2)}


def manifest_entry(name, asset):
    x = read_wav(wav_path(name))
    e = stats(x)
    e["kind"] = asset["kind"]
    e["target_seconds"] = asset.get("target_seconds")
    meta_path = os.path.join(OUT, name + ".meta.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path) as fh:
                e.update(json.load(fh))
        except Exception:
            pass
    if os.path.exists(os.path.join(OUT, name + ".env.json")):
        e["env"] = "build/audio/" + name + ".env.json"
    return e


def update_manifest(assets, names):
    man = {}
    if os.path.exists(MANIFEST):
        try:
            with open(MANIFEST) as fh:
                man = json.load(fh)
        except Exception:
            man = {}
    for name in names:
        key = "build/audio/" + name + ".wav"
        if wav_ok(wav_path(name)):
            man[key] = manifest_entry(name, assets[name])
        else:
            man.pop(key, None)
    order = ["build/audio/" + n + ".wav" for n in assets]
    man = {k: man[k] for k in order if k in man}
    atomic_write_json(MANIFEST, man)


def render_stem(name, asset):
    global rng
    rng = np.random.default_rng(zlib.crc32(name.encode()))
    meta = {}
    if name in VOICES:
        preset, text, opts = VOICES[name]
        x, meta = make_voice(name, preset, text, opts, asset.get("target_seconds"))
    else:
        x, meta = GENERATORS[name]()
    x = np.asarray(x, dtype=float)
    peak = np.max(np.abs(x))
    if peak > 0.98:
        x = x * (0.98 / peak)
    write_wav(wav_path(name), x)
    env = meta.pop("vocals_env", None)
    if asset["kind"] == "voice":
        atomic_write_json(os.path.join(OUT, name + ".env.json"), envelope_json(x, len(x) / SR), indent=None)
    elif env is not None:
        atomic_write_json(os.path.join(OUT, name + ".env.json"), dict(env, note="vocal layer only"), indent=None)
    meta_path = os.path.join(OUT, name + ".meta.json")
    if meta:
        atomic_write_json(meta_path, meta)
    elif os.path.exists(meta_path):
        os.remove(meta_path)
    return x


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*", help="stem names (re-rendered) or kinds: voice music ambience sfx")
    ap.add_argument("--force", action="store_true", help="re-render even if the .wav exists")
    ap.add_argument("--list", action="store_true", help="show which stems exist")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    assets = load_assets()
    missing_gen = [n for n in assets if n not in GENERATORS and n not in VOICES]
    if missing_gen:
        print("WARNING: no generator for", missing_gen)

    kinds = {a["kind"] for a in assets.values()}
    explicit, kind_sel = [], set()
    for a in args.names:
        a = os.path.splitext(os.path.basename(a))[0]
        if a in kinds:
            kind_sel.add(a)
        elif a in assets:
            explicit.append(a)
        else:
            sys.exit(f"unknown stem or kind: {a}")

    if args.list:
        for name, a in assets.items():
            ok = wav_ok(wav_path(name))
            print(f"{'OK ' if ok else '-- '} {a['kind']:9s} {name}")
        return

    if explicit:
        todo = explicit
    else:
        todo = [n for n, a in assets.items() if not kind_sel or a["kind"] in kind_sel]
        if not args.force:
            todo = [n for n in todo if not wav_ok(wav_path(n))]

    print(f"{len(todo)} stem(s) to render")
    print(f"{'stem':26s} {'kind':9s} {'dur':>7s} {'target':>7s} {'peak':>7s} {'pk dB':>7s} {'rms dB':>7s}")
    for name in todo:
        a = assets[name]
        try:
            x = render_stem(name, a)
        except Exception as exc:                       # keep going; report at the end
            print(f"{name:26s} FAILED: {exc!r}")
            continue
        s = stats(x)
        tgt = a.get("target_seconds")
        flag = ""
        if a["kind"] == "voice" and tgt and s["duration"] > tgt + 1e-6:
            flag = "  LONGER THAN SLOT"
        print(f"{name:26s} {a['kind']:9s} {s['duration']:7.3f} {tgt if tgt else 0:7.2f} {s['peak']:7.4f} "
              f"{s['peak_dbfs']:7.2f} {s['rms_dbfs']:7.2f}{flag}", flush=True)
        update_manifest(assets, [name])
    update_manifest(assets, list(assets))
    done = sum(wav_ok(wav_path(n)) for n in assets)
    print(f"{done}/{len(assets)} stems present in {OUT}")


if __name__ == "__main__":
    main()
