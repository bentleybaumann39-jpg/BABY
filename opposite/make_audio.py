#!/usr/bin/env python3
"""
OPPOSITE DAY - audio stem builder.

Renders every entry in the "audio" list of opposite/assets.json to
opposite/build/audio/<name>.wav (44100 Hz, mono, 16-bit) with numpy, espeak-ng
and nothing else, and keeps opposite/build/audio/manifest.json up to date:

    {"build/audio/<name>.wav": {"duration", "peak", "rms", "kind", ...}, ...}

Adapted from poppy/make_audio.py (its DSP helpers, instruments, espeak wrapper,
stinger/breath/Shepard machinery and incremental registry are reused verbatim);
everything that makes a sound on this tape is new.

The tape's sound identity (STORYBOARD.md sections 2, 5 and 6):
  * ONE shared twin voice. BIM is the raw espeak voice pitched UP 4 semitones,
    MIB's own voice is the same take pitched DOWN 4 (heard only after the swap,
    coming out of BIM); a WSOLA granular shifter keeps the durations.
  * Palindromes: every theme phrase, the ident, the bumper and the bed read
    the same forwards and backwards.
  * Reversals: the bars tone fades IN, footsteps, the clock, the laugh track,
    breathing, one child's 'NO!', BIM's 'Walk happily!' and the whisper all run
    backwards; the whisper is cut from the same take that plays forwards in 12a.
  * Dread beds: a semitone cluster, a 41/42 Hz drone, sub-bass breathing, a
    DESCENDING Shepard tone; all end at full level so they can be cut dead.
  * Three stingers that escalate (density, roughness, length), a reversed
    scream under scare 2, and BIM's own voice torn into a scream inside
    stinger 3, the loudest sound on the tape.

The theme also carries "lyrics" (caption text) and "sung" (what is really sung)
as [[start_seconds, text], ...]. Voice stems get build/audio/<name>.env.json: a
30-values-per-second amplitude envelope (max 20 ms RMS inside each video frame)
for the compositor's lip-flap.

Re-runnable and incremental. A stem whose .wav already exists, reads back as
valid and is current is skipped unless --force is given or the stem is named
explicitly. A stem is stale (re-rendered by a plain run) when its RECIPE tag or
its voice text in assets.json changed, or when the stem it is cut from changed
(sfx_preverb_safe <- vo_safe_1, sfx_laugh_rev <- sfx_laugh, vo_whisper_rev <-
vo_whisper_fwd). Every stem is written atomically as soon as it is done, so an
interrupted run loses at most one stem.

    python3 opposite/make_audio.py                  # everything missing or stale
    python3 opposite/make_audio.py voice sfx        # missing/stale stems of these kinds
    python3 opposite/make_audio.py vo_safe_1 sfx_pop  # these stems, always re-rendered
    python3 opposite/make_audio.py --force music    # all music stems again
    python3 opposite/make_audio.py --list           # status of all 78 stems (OK / -- / OLD + why)
    python3 opposite/make_audio.py --report         # listen-check table of every stem on disk
    python3 opposite/make_audio.py --out DIR names  # review copies in DIR; build/ untouched

Stems stay mono; panning is the compositor's job. Pan notes for it live in the
manifest (vo_whisper_rev "pan" [[0, -1], [split, +1]] with a 22 ms / -8 dB Haas
double; sfx_breath_rev / sfx_inhale_rev "pan" -0.2).
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
BUILD_AUDIO = os.path.join(HERE, "build", "audio")
OUT = BUILD_AUDIO                   # --out DIR renders a review copy elsewhere
ASSETS = os.path.join(HERE, "assets.json")
MANIFEST = os.path.join(BUILD_AUDIO, "manifest.json")

SR = 44100
ENV_FPS = 30

rng = np.random.default_rng(1994)   # re-seeded per stem (see render_stem)


# ==========================================================================
# Basic helpers (from poppy/make_audio.py, unchanged)
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



# ==========================================================================
# Filters: zero-phase FFT filters (poppy)
# ==========================================================================

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



# ==========================================================================
# Modulation, time and pitch (poppy)
# ==========================================================================

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
# Instruments (poppy)
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
# espeak-ng wrapper and the TV voice chain (poppy)
# ==========================================================================

_ESPEAK_PATH = None

def espeak_path():
    """A private espeak-ng data dir: symlinks to the system data plus our variants."""
    global _ESPEAK_PATH
    if _ESPEAK_PATH:
        return _ESPEAK_PATH
    info = subprocess.run(["espeak-ng", "--version"], capture_output=True, text=True).stdout
    m = re.search(r"Data at:\s*(\S+)", info)
    src = m.group(1) if m else "/usr/lib/x86_64-linux-gnu/espeak-ng-data"
    root = tempfile.mkdtemp(prefix="opposite_espeak_")
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
    if prange is not None or "{" in text:
        # {word} in a line = that word spoken with the pitch dropped (SSML prosody)
        cmd += ["-m"]
        body = re.sub(r"\{([^}]*)\}", r'<prosody pitch="-38%">\1</prosody>', html.escape(text, quote=False))
        text = f'<speak><prosody range="{prange or "medium"}">{body}</prosody></speak>'
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



# ==========================================================================
# Shared sound-design machinery (poppy: impacts, motors, the scare-pass stinger, breath)
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


def metal_clang(f0, dur=1.2, vel=1.0):
    ratios = [1.0, 2.756, 5.404, 8.933, 13.34]
    taus = [0.9, 0.55, 0.3, 0.18, 0.1]
    amps = [1.0, 0.8, 0.55, 0.35, 0.2]
    ir = resonators([f0 * r for r in ratios], taus, amps, dur)
    exc = rng.standard_normal(secs(0.004)) * np.hanning(secs(0.004))
    return vel * fftconv(exc, ir)[:secs(dur)]


def blep_saw(freq):
    """Band-limited (polyBLEP) sawtooth from a per-sample frequency curve."""
    dt = np.clip(np.asarray(freq, dtype=float) / SR, 1e-9, 0.5)
    ph = np.cumsum(dt) % 1.0
    y = 2 * ph - 1
    a = ph < dt
    u = ph[a] / dt[a]
    y[a] -= u + u - u * u - 1
    b = ph > 1 - dt
    u = (ph[b] - 1) / dt[b]
    y[b] -= u * u + u + u + 1
    return y


def rough(x, hz, depth, phase=0.0):
    """Roughness (Arnal 2015): amplitude modulation at `hz`, modulation index `depth`."""
    t = tvec(len(x))
    return x * (1 + depth * np.sin(2 * np.pi * hz * t + phase)) / (1 + depth)


def proximity(x, gain_db, fc=200.0, octaves=0.8):
    """Close-mic bass bump centred on 150-250 Hz."""
    return peq(x, fc, gain_db, octaves)


def jump_curve(n, f0, jumps, glide_from=None, glide_oct=0.0, vib=None):
    """Frequency curve: f0, abrupt pitch jumps [(t, semitones)], then an exponential glide
    down `glide_oct` octaves from `glide_from` to the end; optional vib=(rate_hz, depth)."""
    t = tvec(n)
    st = np.zeros(n)
    for tj, s in jumps:
        st[t >= tj] += s
    if glide_oct and glide_from is not None and n > 1:
        k = np.clip((t - glide_from) / max(1e-3, t[-1] - glide_from), 0, 1)
        st -= 12 * glide_oct * (1 - np.exp(-3 * k)) / (1 - np.exp(-3))
    f = f0 * 2 ** (st / 12)
    if vib:
        f = f * (1 + vib[1] * np.sin(2 * np.pi * vib[0] * t + rng.uniform(0, 6.28)))
    return f


def screech(n, lo, hi, n_saws, jumps, glide_from, glide_oct, vib=(0.0, 0.0), vib_depth=0.0):
    """Detuned band-limited saws with abrupt jumps; returns (screech, octave-down copy)."""
    freqs = np.geomspace(lo, hi, n_saws) * 2 ** (rng.uniform(-22, 22, n_saws) / 1200)
    top, sub = np.zeros(n), np.zeros(n)
    for f in freqs:
        v = (rng.uniform(*vib), vib_depth) if vib_depth else None
        fc = jump_curve(n, f, jumps, glide_from, glide_oct, v)
        top += blep_saw(fc)
        sub += blep_saw(fc / 2)                     # subharmonic: the same screech an octave down
    return top / n_saws, sub / n_saws


def flicker_noise(n, t0, t1, density=30.0):
    """Chaotic noise: random 4-35 ms broadband bursts between t0 and t1, thinning out."""
    buf = np.zeros(n)
    t = t0
    while t < t1:
        L = rng.uniform(0.004, 0.035)
        m = max(32, secs(L))
        lo = rng.uniform(200, 2500)
        b = bp(rng.standard_normal(m), lo, min(16000, lo * rng.uniform(2.5, 10)), 2) * np.hanning(m)
        place(buf, b * rng.uniform(0.25, 1.0) / (np.std(b) + 1e-9), t)
        t += L + rng.exponential(1.0 / density) * (1 + 2.5 * (t - t0) / max(1e-3, t1 - t0))
    return buf


def stinger_v2(dur, lo, hi, n_saws, jumps, glide_from, glide_oct, am_hz, am_depth,
               noise_dur, thump_hz, thump_decay, vib=(0.0, 0.0), vib_depth=0.0,
               crunch=0.0, notch=None, drive=2.2, sub_db=-10.0, flicker_from=0.4,
               scr_drive=3.0, thump_gain=0.4, burst_gain=0.55):
    """Scare-pass stinger: noise burst + sub thump + rough, pitch-jumping screech with an
    octave-down subharmonic + chaotic noise in the tail, all through tanh.

    Balance (scare pass 2): the screech is driven on its own and leads; the thump sits
    under it at `thump_gain`. A full-level 40-45 Hz thump used to take the whole peak
    budget, so after normalising the part the ear hears (1-4 kHz) came out 2-4 dB
    quieter than the old stingers; now it is ~6 dB louder (A-weighted, first 0.3 s)."""
    n = secs(dur)
    t = tvec(n)
    top, sub = screech(n, lo, hi, n_saws, jumps, glide_from, glide_oct, vib, vib_depth)
    body = np.exp(-t / (dur * 0.6)) * np.minimum(1, (dur - t) / 0.12)
    scr = norm(top, 1) + db(sub_db) * norm(sub, 1)
    scr = rough(scr * body, am_hz, am_depth)
    scr = np.tanh(scr_drive * norm(scr, 1)) / np.tanh(scr_drive) * body ** 0.3   # dense, rasping
    scr = bp(scr, 150, 11000, 2)
    m = secs(noise_dur)
    nb = np.zeros(n)
    nb[:m] = bp(snow(noise_dur), 300, 10000, 2) * np.exp(-tvec(m) / (noise_dur * 0.3))
    tau = thump_decay / 3.45                                 # -30 dB at `thump_decay`
    fth = thump_hz * (1 + 0.7 * np.exp(-t / 0.02))          # a short pitch drop for punch
    thump = (sine(fth) + 0.35 * sine(2 * fth)) * np.exp(-t / tau)
    fl = flicker_noise(n, flicker_from * dur, dur - 0.05)
    fl = fl * np.exp(-np.maximum(0, t - flicker_from * dur) / (dur * 0.5))
    x = (burst_gain * norm(nb, 1) + thump_gain * thump + 1.0 * norm(scr, 1)
         + 0.35 * fl / (np.max(np.abs(fl)) + 1e-9))
    x = np.tanh(drive * x) / np.tanh(drive)
    if crunch:                                               # camcorder-mic overload
        k = np.exp(-t / 0.15)
        x = x * (1 - k * crunch) + k * crunch * bitcrush(np.tanh(6 * x), 5, 4)
        x = bp(x, 90, 6500, 2)
    if notch:            # flat cut across notch=(lo, hi, dB[, deeper dB until t_s, t_s])
        g = np.full(n, db(notch[2]))
        if len(notch) > 3:
            g = np.interp(t, [0, notch[4], notch[4] + 0.2], [db(notch[3]), db(notch[3]), db(notch[2])])
        x = x - (1 - g) * bp(x, notch[0], notch[1], 4)
    x = attack_ramp(x, 0.001)
    return fade(x, 0, 0.06)


def pitch_steps(x, steps, xfade=0.004, grain=0.035):
    """Abrupt pitch jumps that keep the timing: steps = [(t_from, semitones), ...]."""
    n = len(x)
    t = tvec(n)
    out = np.zeros(n)
    bounds = [s[0] for s in steps] + [t[-1] + 1]
    for i, (t0, st) in enumerate(steps):
        y = x if st == 0 else fit(granular(x, 2 ** (st / 12), 1.0, grain), n)
        w = np.clip((t - t0) / xfade + 0.5, 0, 1) * np.clip((bounds[i + 1] - t) / xfade + 0.5, 0, 1)
        if i == 0:
            w = np.clip((bounds[1] - t) / xfade + 0.5, 0, 1)
        out += y * w
    return out


def shepard_stack(t, base, layers, rate, cents=(-6.0, 6.0)):
    """Octave-spaced sines from `base` under a sin^2 window over log-frequency, all gliding
    up `rate` octaves per second and wrapping; plus narrow noise riding each layer."""
    n = len(t)
    tone, hiss = np.zeros(n), np.zeros(n)
    for k in range(layers):
        p = (k + rate * t) % layers                           # octaves above base, wrapping
        f = base * 2 ** p
        w = np.sin(np.pi * p / layers) ** 2
        for c in cents:                                       # a slow shimmer, not a test tone
            tone += 0.5 * w * sine(f * 2 ** (c / 1200), phase=rng.uniform(0, 6.28))
        band = lp(rng.standard_normal(n), 35, 2)              # narrow noise riding the layer
        hiss += w ** 3 * band / (np.std(band) + 1e-9) * sine(f, phase=rng.uniform(0, 6.28))
    return tone, hiss


def formant_noise(n, formants, tilt_db_oct=0.0, src=None):
    """Noise (or `src`) through a vocal-tract-like gain curve: resonant peaks (f, bw, gain).
    Unshaped band noise reads as wind; resonances make it a mouth and a nose."""
    x = rng.standard_normal(n) if src is None else src

    def g(f):
        f = np.maximum(f, 1.0)
        h = np.zeros_like(f)
        for fc, bw, a in formants:
            h += a / (1 + ((f - fc) / (bw / 2)) ** 2)
        return h * (f / 1000.0) ** (tilt_db_oct / 6.02)
    return _ffilt(x, g)


def creak(n, f0=(70, 48), jitter=0.12):
    """Irregular glottal pulses (vocal fry) slowing from f0[0] to f0[1] Hz."""
    y = np.zeros(n)
    t, T = 0.0, n / SR
    while t < T:
        f = np.interp(t, [0, T], f0) * (1 + jitter * rng.standard_normal())
        i = int(t * SR)
        if i < n:
            y[i] += rng.uniform(0.5, 1.0)
        t += 1.0 / max(20.0, f)
    m = secs(0.006)
    pulse = np.exp(-tvec(m) / 0.0012) * np.sin(2 * np.pi * 700 * tvec(m))
    return fftconv(y, pulse)[:n]


def crackle(n, density=18.0):
    """Sparse wet lip/saliva crackle: tiny 1-3 ms ticks."""
    y = np.zeros(n)
    t = rng.exponential(1 / density)
    while t < n / SR - 0.01:
        m = secs(rng.uniform(0.001, 0.003))
        tick = hp(rng.standard_normal(m), 2500, 2) * np.hanning(m)
        place(y, tick * rng.uniform(0.2, 1.0), t)
        t += rng.exponential(1 / density)
    return y


def breath_part(dur, kind, shift=0.0):
    """One breath through a vocal tract. 'in': drawn in through nose and teeth - nasal
    resonances, a bright 2.6-4 kHz hiss and a faint whistle; builds, peaks late, stops
    short. 'out': let out through an open mouth - 'haa' formants, an air puff on the mic
    capsule, a long sag, and the last of the air catching in the throat (a faint creak)."""
    n = secs(dur)
    t = tvec(n)
    d = 1 + shift                                             # each breath its own mouth shape
    if kind == "in":
        x = formant_noise(n, [(320 * d, 160, 0.25), (1150 * d, 380, 0.55), (2650 * d, 520, 1.0),
                              (3900 * d, 700, 0.8), (6200, 2500, 0.45)])
        x += 0.10 * bp(rng.standard_normal(n), 3050 * d, 3250 * d, 6)     # a faint nasal whistle
        env = np.minimum(1, t / 0.3) ** 1.3 * (0.55 + 0.45 * (t / dur) ** 0.8) * np.minimum(1, (dur - t) / 0.06)
    else:
        x = formant_noise(n, [(640 * d, 220, 1.0), (1180 * d, 300, 0.75), (2450 * d, 450, 0.4),
                              (3500, 900, 0.15)], tilt_db_oct=-2.0)
        puff = lp(rng.standard_normal(n), 160, 2) * np.exp(-t / 0.18)
        x = x / (np.std(x) + 1e-9) + 0.5 * puff / (np.std(puff) + 1e-9)
        env = np.minimum(1, t / 0.05) * (0.2 + 0.8 * np.exp(-t / (dur * 0.3))) * np.minimum(1, (dur - t) / 0.3)
        k0 = int(0.68 * n)
        cr = formant_noise(n - k0, [(640, 200, 1.0), (1180, 300, 0.7), (2450, 450, 0.35)], src=creak(n - k0))
        x = x / (np.std(x) + 1e-9)
        x[k0:] += 0.45 * cr / (np.std(cr) + 1e-9) * np.hanning(n - k0) ** 0.7
    x = x / (np.std(x) + 1e-9)
    jitter = 1 + 0.22 * lfo_noise(n, 3, 12)                  # air is never steady
    return x * env * np.clip(jitter, 0.4, 1.6)


def mouth_click(vel=1.0):
    """A soft wet mouth click: two or three tiny resonant ticks inside ~12 ms."""
    n = secs(0.03)
    y = np.zeros(n)
    for k in range(rng.integers(2, 4)):
        f = rng.uniform(1100, 2600)
        tick = resonators([f, f * 1.7], [0.003, 0.002], [1, 0.4], 0.02)
        place(y, tick * rng.uniform(0.4, 1.0), k * rng.uniform(0.003, 0.006))
    y += lp(rng.standard_normal(n), 600) * np.exp(-tvec(n) / 0.004) * 0.3
    return vel * attack_ramp(y, 0.0005)


def source_wav(name):
    """A stem this run (or an earlier one) has written: the review dir first, then build/audio."""
    for d in (OUT, BUILD_AUDIO):
        p = os.path.join(d, name + ".wav")
        if wav_ok(p):
            return p
    raise FileNotFoundError(f"{name}.wav is needed first")


def make_preecho(src_name, lead=1.0, take=0.6, t60=2.5):
    """Reverse the first `take` s of a line, drown it in a long dark reverb (100% wet,
    low-passed 3 kHz) and reverse again: the ghost of the word swells for `lead` s and
    ends exactly on the line's first sample."""
    path = source_wav(src_name)
    x = read_wav(path)
    seg = x[:secs(take)]
    ir = make_ir(t60, damp=3000, predelay=0.0, seed=11)
    wet = lp(fftconv(seg[::-1], ir), 3000, 4)
    rev = wet[::-1]
    end = len(rev) - len(seg)                       # rev[end:] lines up with the line itself
    out = rev[max(0, end - secs(lead)):end]
    out = np.concatenate([np.zeros(secs(lead) - len(out)), out])
    out = out * np.linspace(0, 1, len(out)) ** 1.2            # out of nothing, into the word
    out = fade(out, 0.0, 0.006)
    meta = {"source": "build/audio/" + src_name + ".wav", "source_crc": file_crc(path),
            "ends_at_line_onset": True, "lead_s": lead}
    return norm(out, db(-1)), meta



# ==========================================================================
# File helpers (poppy)
# ==========================================================================

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


def file_crc(path):
    with open(path, "rb") as fh:
        return zlib.crc32(fh.read()) & 0xFFFFFFFF


def read_meta(name):
    try:
        with open(os.path.join(OUT, name + ".meta.json")) as fh:
            return json.load(fh)
    except Exception:
        return {}



# ==========================================================================
# OPPOSITE DAY: new helpers (time-stretch, the twin shifter, reversals)
# ==========================================================================

def wsola(x, stretch, frame=0.032, tol=0.010):
    """Time-stretch by `stretch` (2.0 = twice as long) keeping the pitch: waveform-similarity
    overlap-add (each grain is slid +-tol to line up with the natural continuation of the last
    one, so voiced speech stays smooth instead of phasey)."""
    x = np.asarray(x, dtype=float)
    if len(x) == 0 or abs(stretch - 1.0) < 1e-4:
        return x.copy()
    N = max(64, secs(frame) // 2 * 2)
    Hs = N // 2
    Ha = Hs / stretch
    T = max(1, secs(tol))
    win = 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(N) / N)        # periodic Hann
    n_out = int(round(len(x) * stretch))
    nfr = n_out // Hs + 2
    pad_l = T + N
    xp = np.concatenate([np.zeros(pad_l), x, np.zeros(T + 3 * N + int(2 * Ha) + 16)])
    out = np.zeros(nfr * Hs + N)
    wsum = np.zeros(nfr * Hs + N)
    prev = None
    for k in range(nfr):
        nom = pad_l + int(round(k * Ha))
        if prev is None:
            pos = nom
        else:
            target = xp[prev + Hs:prev + Hs + N]
            seg = xp[nom - T:nom + T + N]
            if not target.any() or not seg.any():
                pos = nom
            else:
                pos = nom - T + int(np.argmax(np.correlate(seg, target, mode="valid")))
        out[k * Hs:k * Hs + N] += xp[pos:pos + N] * win
        wsum[k * Hs:k * Hs + N] += win
        prev = pos
    y = out / np.maximum(wsum, 1e-3)
    return y[:n_out]


def pshift(x, semitones, frame=0.032):
    """The twin shifter: resample (pitch AND formants move, the felt-puppet colour) and WSOLA the
    length back, so the line keeps its duration."""
    x = np.asarray(x, dtype=float)
    if abs(semitones) < 1e-6 or len(x) == 0:
        return x.copy()
    r = 2 ** (semitones / 12.0)
    return fit(wsola(resample(x, r), r, frame), len(x))


def reverse(x):
    return np.asarray(x, dtype=float)[::-1].copy()


def swell_into(x, lead, t60=2.0, damp=3000, take=None, seed=11):
    """Reverse-reverb pre-echo of x: reverse, drown in a dark reverb (100% wet), reverse again.
    Returns (swell, wet): `swell` is `lead` s long and ends exactly where x starts; `wet` is the
    rest of the ghost, lined up with x itself."""
    seg = np.asarray(x[:secs(take)] if take else x, dtype=float)
    ir = make_ir(t60, damp=damp, predelay=0.0, seed=seed)
    wet = lp(fftconv(seg[::-1], ir), damp, 4)
    rev = wet[::-1]
    end = len(rev) - len(seg)
    out = rev[max(0, end - secs(lead)):end]
    out = np.concatenate([np.zeros(secs(lead) - len(out)), out])
    out = out * np.linspace(0, 1, len(out)) ** 1.2              # out of nothing, into the word
    return out, rev[end:]


def end_on_zero(x):
    """Trim to the last zero crossing so a stem meant to be CUT DEAD stops without a click."""
    x = np.asarray(x, dtype=float)
    s = np.signbit(x)
    zc = np.flatnonzero(s[1:] != s[:-1])
    if len(zc) and len(x) - zc[-1] < secs(0.02):
        return x[:zc[-1] + 1]
    return x


def stickslip(dur, rate_pts, body, taus, amp_jitter=0.5):
    """Stick-slip friction (wood on a nail, a coil spring): a pulse train whose rate follows
    rate_pts (pulses/s), each pulse ringing a bank of resonances."""
    n = secs(dur)
    rate = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(rate_pts)), rate_pts)
    rate = rate * (1 + 0.12 * lfo_noise(n, 2, 12))
    ph = np.cumsum(rate) / SR
    exc = np.zeros(n)
    idx = np.where(np.diff(np.floor(ph)) > 0)[0]
    exc[idx] = rng.uniform(1 - amp_jitter, 1.0, len(idx))
    y = fftconv(exc, resonators(body, taus, None, 0.3))[:n]
    y += bp(rng.standard_normal(n), 500, 3000) * 0.02 * np.abs(lfo_noise(n, 1, 6))
    return y


def rms_max(x, win=0.4):
    """Loudest `win`-second RMS in x (dBFS): the stinger escalation check."""
    m = moving_rms(np.asarray(x, dtype=float), win)
    return round(20 * np.log10(max(float(m.max()) if len(m) else 0.0, 1e-9)), 2)


# ==========================================================================
# Voices (STORYBOARD.md section 6)
# ==========================================================================

TWIN = "en-us+m3"                  # the ONE shared twin voice
SING_VOICE = "en-us+twinsing"      # the same voice with room to sing

VARIANTS = {
    # m3's formants with a higher base pitch, so the raw twin voice can reach the theme's
    # notes (C4-A4 sung = 208-349 Hz raw, before BIM's +4 semitones).
    "twinsing": """language variant
name twinsing
gender male
pitch 160 330
formant 0 100 100 100
formant 1  96  97 100
formant 2  96  97 100
formant 3  96 103 100
formant 4  95 103 100
formant 5  95 103 100
formant 6 100 100 100
formant 7 100 100 100
formant 8 100 100 100
consonants 100
stressAdd 10 10 0 0 0 0 -30 -30
""",
}

KID_VOICES = ["en-us+f1", "en-us+f2", "en-us+f3", "en-us+f4", "en-us+f5", "en-us+m1", "en-us+m3", "en-us+klatt"]

PRESET_PEAK = {"bim": -3.0, "bim_low": -3.0, "mib_as_bim": -3.0, "mib_flat": -3.0, "kids": -3.0,
               "child_rev": -3.0, "narrator": -3.0, "crew": -6.0, "whisper": -1.0}
PRESET_SPEED = {"bim": 170, "bim_low": 170, "mib_as_bim": 170, "mib_flat": 135, "kids": 170,
                "child_rev": 160, "narrator": 160, "crew": 155, "whisper": 120}


def espeak_text(text):
    """Script text -> what espeak should read (respellings only)."""
    t = text.replace("’", "'").replace("“", "").replace("”", "")
    t = re.sub(r"\bBIM\b", "Bim", t)
    t = re.sub(r"\bMIB\b", "Mib", t)
    t = re.sub(r"\bNOT\b", "not", t)
    t = re.sub(r"\b([A-Z]{2,})\b", lambda m: m.group(1).capitalize(), t)   # YES! NO! GOODBYE!
    return t


def split_line(text):
    """A line as spoken chunks: [[chunk, pause_after_s], ...]. Sentences end on . ! ? (0.14 s),
    '...' trails off (0.32 s), '|' is a short breath inside a sentence (0.12 s)."""
    out = []
    for m in re.finditer(r"[^.!?|]+(?:\.\.\.|[.!?]+|\|)?", text):
        s = m.group(0).strip()
        if not re.search(r"\w", s):
            continue
        if s.endswith("|"):
            out.append([s[:-1].strip(), 0.12])
        elif s.endswith("..."):
            out.append([s, 0.32])
        else:
            out.append([s, 0.14])
    if out:
        out[-1][1] = 0.0
    return out


def twin_raw(text, speed=170, pitches=(74, 84, 68, 86, 78), gap=2, prange="high", chunk_speed=None,
             pauses=None, voice=TWIN):
    """The shared twin voice before any shifting: each chunk at its own base pitch (sing-song)."""
    parts = []
    ch = split_line(text)
    for i, (s, pause) in enumerate(ch):
        p = pitches[i % len(pitches)]
        sc = chunk_speed[i] if chunk_speed and i < len(chunk_speed) else 1.0
        x = espeak(s, voice, speed * sc, p, gap, prange=prange)
        parts.append(tidy(x, -48, 0.015, 0.05))
        if i < len(ch) - 1:
            pz = pauses[i] if pauses and i < len(pauses) and pauses[i] is not None else pause
            if VOICE_CTX["max_pause"] is not None:
                pz = min(pz, VOICE_CTX["max_pause"] * 1.6)
            parts.append(np.zeros(secs(pz)))
    return np.concatenate(parts)


def voice_twin(text, o, speed, shift):
    """bim / bim_low / mib_as_bim: raw twin voice -> shifter -> TV speaker chain."""
    x = twin_raw(text, speed, o.get("pitches", (74, 84, 68, 86, 78)), 2, o.get("prange", "high"),
                 o.get("chunk_speed"), o.get("pauses"))
    x = pshift(x, shift)
    x = tv_voice_chain(x, 250, 4000, 1.5, o.get("wet", 0.10), 0.3, double=False)
    if o.get("close"):
        x = proximity(x, o["close"], 200.0, 0.8)
    return x


def voice_flat(text, o, speed):
    """mib_flat: BIM's voice gone flat, slow and much too close."""
    x = twin_raw(text, speed, (o.get("pitch", 55),), o.get("gap", 2), o.get("prange", "x-low"), o.get("chunk_speed"),
                 o.get("pauses"))
    x = pshift(x, o.get("shift", 4.0))
    x = bp(norm(x, 1.0), 200, 5000, 3)
    x = np.tanh(1.3 * norm(x, 1.0)) / np.tanh(1.3)
    if o.get("wet", 0.03) > 0:
        x = reverb(x, 0.3, o.get("wet", 0.03), damp=4500, predelay=0.004)
    x = proximity(x, o.get("prox", 4.0), 200.0, 0.8)           # +4 dB at 150-250 Hz
    x = rough(x, 45.0, o.get("am", 0.20))                       # 45 Hz roughness
    if o.get("breath_in"):                                      # a breath drawn right at the mic
        b = breath_part(0.38, "in", -0.04)
        b = proximity(hp(b, 200, 2), 4.0, 200, 0.8)
        x = np.concatenate([norm(b, 1) * 0.16 * np.max(np.abs(x)), np.zeros(secs(0.06)), x])
    return x


def kid_take(text, voice, speed, pitch, shift, max_s=None, prange="x-high"):
    x = None
    for _ in range(4):
        x = espeak(text, voice, speed, pitch, 1, prange=prange)
        x = trim_silence(x, -42, 0.005, 0.03)
        if not max_s or len(x) / SR <= max_s or speed >= 400:
            break
        speed = speed * (len(x) / SR / max_s) * 1.04
    return norm(pshift(x, shift), 1.0)


def kids_ensemble(text, n=8, max_take=None, spread=0.07, speed_scale=1.0):
    """8 children: different voices, -p 80-99, -s 150-190, +2..5 semitones, offsets 0-70 ms."""
    takes = []
    for v in KID_VOICES[:n]:
        p = int(rng.integers(80, 100))
        s = int(rng.integers(150, 191)) * speed_scale
        sh = float(rng.uniform(2.0, 5.0))
        x = kid_take(text, v, s, p, sh, max_take)
        takes.append((float(rng.uniform(0, spread)), x * float(rng.uniform(0.7, 1.0))))
    L = max(o + len(x) / SR for o, x in takes)
    out = np.zeros(secs(L) + 1)
    for o, x in takes:
        place(out, x, o)
    return out


def bleacher(x, wet=0.25, t60=0.6):
    """The studio bleacher: 250-5000 Hz, 0.6 s room at 25% wet."""
    return reverb(bp(x, 250, 5000, 3), t60, wet, damp=4000, predelay=0.012)


def voice_kids(text, o, speed):
    x = kids_ensemble(text, 8, o.get("max_take"), 0.07, speed / PRESET_SPEED["kids"])
    x = bleacher(x)
    return np.tanh(1.25 * norm(x, 1.0)) / np.tanh(1.25)       # shouted


def voice_child_rev(text, o, speed):
    """One laugh-track child's 'NO!', with the bleacher on it, played backwards: the room tail
    becomes a swell that sucks inward and the word stops dead on its own attack."""
    x = espeak(text, "en-us+f4", speed, 95, 1, prange="x-high")
    x = trim_silence(x, -42, 0.0, 0.03)
    x = pshift(x, 3.0)
    x = bp(norm(x, 1.0), 250, 5000, 3)
    x = reverb(x, 0.6, 0.38, damp=4000, predelay=0.012)       # wetter than the chorus: a long swell
    x = trim_silence(x, -48, 0.0, 0.0)
    return reverse(x)


def voice_narrator(text, o, speed):
    x = espeak(text, "en-us+m3", speed, 40, 4)
    x = tidy(x, -48, 0.02, 0.08)
    x = low_shelf(x, 220, 4.0)                                  # warmth
    x = bp(x, 180, 3600, 3)
    x = norm(x, 1.0)
    x = np.tanh(2.0 * x) / np.tanh(2.0)
    return fade(x, 0.005, 0.05)


def voice_crew(text, o, speed):
    x = espeak(text, "en-us+whisperf", speed, 40)
    x = tidy(x, -45, 0.02, 0.06)
    if o.get("called"):                                         # half-voiced, into the dark
        v = espeak(text, "en-us+f2", speed * 0.85, 36)
        v = tidy(v, -45, 0.02, 0.06)
        x = 0.55 * norm(fit(x, len(v)), 1) + 0.8 * norm(v, 1)
        x = reverb(x, 0.8, 0.2, damp=3200, predelay=0.03)
    x = tremolo(x, 6.5, 0.12)                                   # nervous
    x = bp(x, 300, 3400, 3)                                     # camcorder mic
    return fade(x, 0.003, 0.03)


def voice_whisper(text, o, speed):
    """A child-sized whisper right at the microphone: hard attack, high-passed at 300 Hz, dry."""
    x = espeak(text, "en-us+whisperf", speed, 55)
    a = np.abs(x)
    start = int(np.argmax(a > a.max() * 0.06))                  # start right on the consonant
    x = x[max(0, start - secs(0.001)):]
    x = trim_silence(x, -50, 0.0, 0.06)
    x = attack_ramp(x, 0.001)
    return hp(x, 300, 2)


def render_voice(preset, text, o, speed):
    if preset == "bim":
        return voice_twin(text, o, speed, o.get("shift", 4.0))
    if preset == "mib_as_bim":
        return voice_twin(text, o, speed, o.get("shift", 4.0))
    if preset == "bim_low":
        return voice_twin(text, o, speed, o.get("shift", -4.0))
    if preset == "mib_flat":
        return voice_flat(text, o, speed)
    if preset == "kids":
        return voice_kids(text, o, speed)
    if preset == "child_rev":
        return voice_child_rev(text, o, speed)
    if preset == "narrator":
        return voice_narrator(text, o, speed)
    if preset == "crew":
        return voice_crew(text, o, speed)
    if preset == "whisper":
        return voice_whisper(text, o, speed)
    raise ValueError(preset)


# Per-line delivery. The words come from assets.json (the single source); these are only
# the performance: pitches per chunk, '|' breath marks before a word, speeds, takes.
VOICE_OPTS = {
    "vo_narr_ident": {},
    "vo_bim_hi": {"pitches": (80, 88)},
    "vo_bim_twin": {"pitches": (76, 86)},
    "vo_bim_spot": {"pitches": (82,)},
    "vo_bim_rule1": {"pitches": (84, 78)},
    "vo_bim_wrongside": {"pitches": (90, 76, 80, 72), "mark": "wrong side", "pauses": [0.12, 0.16, 0.2]},
    "vo_bim_sky": {"pitches": (84,)},
    "vo_bim_icecream": {"pitches": (82,)},
    "vo_bim_everybody": {"pitches": (86,)},
    "vo_bim_great": {"pitches": (88,)},
    "vo_kids_yes": {},
    "vo_kids_no": {},
    "vo_child_no_rev": {"fit": "head"},
    "vo_bim_rule2": {"pitches": (84, 78, 88)},
    "vo_bim_walk_rev": {"pitches": (86,), "reverse": True},
    "vo_bim_goodbye": {"pitches": (80, 90)},
    "vo_kids_goodbye": {},
    "vo_bim_turnabout": {"pitches": (84, 70)},
    "vo_bim_happy": {"pitches": (86,)},
    "vo_bim_turn": {"pitches": (88,)},
    "vo_crew_1": {"pauses": [0.3, 0.35]},
    "vo_crew_2": {},
    "vo_crew_3": {"called": True},
    "vo_crew_4": {"speed": 140},
    "vo_crew_5": {"speed": 150},
    "vo_whisper_fwd": {"max_take": 1.9},          # + vo_whisper_rev's 0.5 s pre-echo = its 2.4 s slot
    "vo_whisper_hello": {},
    "vo_bim_welcome_low": {"pitches": (80, 86)},
    "vo_bim_rule3_low": {"pitches": (84, 76, 90)},
    "vo_bim_aww_low": {"pitches": (46,), "prange": "low", "chunk_speed": [0.8]},
    "vo_safe_1": {},
    "vo_safe_2": {"shift": 3.5, "prox": 5.0, "wet": 0.02, "speed": 128},
    "vo_safe_3": {"shift": 3.0, "prox": 6.0, "wet": 0.0, "speed": 114, "gap": 0},
    "vo_mib_here": {"pitches": (82, 88)},
    "vo_mib_rule4": {"pitches": (84, 78, 92, 80)},
    "vo_kids_chant": {},
    "vo_mib_means": {"pitches": (86, 80, 66), "chunk_speed": [1.0, 0.95, 0.7]},
    "vo_mib_bye": {"pitches": (86, 78, 90)},
    "vo_mib_notwith": {"pauses": [0.5, 0.5], "chunk_speed": [1.0, 1.0, 0.86]},
    "vo_bim_bye": {"pitches": (90,), "wet": 0.0},
}


def make_voice(name, preset, text, opts, max_s):
    """Render a line at its preset; if it overruns its slot, tighten the pauses, then speak
    faster (a reversed child's swell is trimmed from its head instead)."""
    etext = espeak_text(text)
    if opts.get("mark"):
        etext = etext.replace(opts["mark"], "| " + opts["mark"], 1)
    if name == "vo_kids_chant":
        return make_kids_chant(etext, text, opts, max_s)
    speed0 = opts.get("speed", PRESET_SPEED[preset])
    if preset == "whisper" and opts.get("max_take"):
        max_s = min(max_s or 99, opts["max_take"])
    core_db = {"kids": -30, "child_rev": -30}.get(preset, -24 if opts.get("called") else -50)

    def core(y):        # the spoken part, without a long reverb tail
        return len(trim_silence(y, core_db, 0.0, 0.0)) / SR

    x, speed, pause = None, speed0, None
    for pause in (None, 0.22, 0.16):
        VOICE_CTX["max_pause"] = pause
        x = trim_silence(render_voice(preset, etext, opts, speed), -55, 0.0, 0.0)
        if not max_s or core(x) <= max_s - 0.04 or opts.get("fit") == "head":
            break
    for _ in range(6):
        if not max_s or core(x) <= max_s - 0.04 or speed >= 420 or opts.get("fit") == "head":
            break
        speed = speed * (core(x) / (max_s - 0.04)) * 1.03
        x = trim_silence(render_voice(preset, etext, opts, speed), -55, 0.0, 0.0)
    VOICE_CTX["max_pause"] = None
    if max_s and len(x) / SR > max_s:
        if opts.get("fit") == "head":                          # keep the dead stop at the end
            x = x[-secs(max_s):].copy()
            x[:secs(0.08)] *= np.linspace(0, 1, secs(0.08)) ** 2
        else:                                                   # e.g. a reverb tail
            x = fade(x[:secs(max_s)], 0.0, min(0.12, max_s / 4))
    if opts.get("reverse"):
        x = reverse(x)
    if preset not in ("child_rev",) and not opts.get("reverse"):
        x = fade(x, 0.0, 0.01)
    x = norm(x, db(opts.get("peak_db", PRESET_PEAK[preset])))
    meta = {"text": text, "voice": preset, "espeak_text": etext.replace("| ", ""),
            "espeak_speed": int(round(min(speed, 450))), "pause_limit": pause, "max_seconds": max_s,
            "fits": bool(not max_s or len(x) / SR <= max_s + 1e-6)}
    if opts.get("reverse"):
        meta["reversed"] = True
        meta["subtitle"] = text.upper()
    if preset in ("bim", "mib_as_bim", "bim_low"):
        meta["twin_shift_semitones"] = opts.get("shift", -4.0 if preset == "bim_low" else 4.0)
    return x, meta


def make_kids_chant(etext, text, opts, max_s):
    """Three chants at 0.0 / 2.0 / 4.0 s, each 2 dB louder; in the third ONE extra child
    says the same line backwards, 6 dB under the chant."""
    phrase = split_line(etext)[0][0]
    total = max_s or 6.0
    starts = (0.0, 2.0, 4.0)
    buf = np.zeros(secs(total + 1.5))
    spans = []
    for k, t0 in enumerate(starts):
        x = kids_ensemble(phrase, 8, 1.6, 0.07)
        x = norm(x, 1.0) * db(2.0 * k)
        place(buf, x, t0)
        spans.append([t0, round(t0 + len(x) / SR, 3)])
        if k == 2:
            rv = reverse(kid_take(phrase, "en-us+f2", 165, 96, 3.5, 1.6))
            place(buf, norm(rv, 1.0) * db(2.0 * k - 6.0), t0 + 0.05)
    buf = bleacher(buf)
    buf = np.tanh(1.25 * norm(buf, 1.0)) / np.tanh(1.25)
    buf = trim_silence(buf, -60, 0.0, 0.0)
    if len(buf) > secs(total):
        buf = fade(buf[:secs(total)], 0.0, 0.15)
    x = norm(buf, db(PRESET_PEAK["kids"]))
    clean = [s.strip() + "!" for s in text.split("!") if s.strip()]
    meta = {"text": text, "voice": "kids", "phrases": [[s, c] for s, c in zip(starts, clean)],
            "phrase_spans": spans, "reversed_extra_child": {"chant": 3, "level_db": -6},
            "chant_gain_db": [0, 2, 4], "max_seconds": max_s, "fits": bool(len(x) / SR <= total + 1e-6)}
    return x, meta


# ==========================================================================
# Music: the palindrome theme, ident, bumper, bed and the goodbye reprise
# ==========================================================================

# Each line: (sung text, caption or None, [(espeak syllable, note, beat)], (chord bar 1, bar 2)).
# Notes are the toy-piano melody (octave 5); the voice sings an octave lower. Every line is a
# palindrome in pitch AND in onset rhythm (symmetric around its middle).
THEME = [
    ("Turn around and turn around,", None,
     [("turn", "C5", 0), ("uh", "E5", 1), ("round", "G5", 2), ("and", "A5", 3), ("turn", "G5", 4),
      ("uh", "E5", 5), ("round", "C5", 6)], ("C", "Am")),
    ("up is down and down is up!", None,
     [("up", "G5", 0), ("is", "E5", 1), ("down", "C5", 2), ("and", "D5", 3), ("down", "C5", 4),
      ("is", "E5", 5), ("up", "G5", 6)], ("F", "C")),
    ("Yes is no and no is yes,", None,
     [("yes", "E5", 0), ("is", "G5", 1), ("no", "A5", 2), ("and", "G5", 3), ("no", "A5", 4),
      ("is", "G5", 5), ("yes", "E5", 6)], ("C", "F")),
    ("BIM and MIB, who's who? Guess!", None,
     [("bim", "A5", 0), ("and", "G5", 1), ("mib", "E5", 2), ("whose", "E5", 4), ("who", "G5", 5),
      ("guess", "A5", 6)], ("F", "G")),
    ("Come and sit on the other side,", "Come and sit here by my side,",
     [("come", "C5", 0), ("and", "E5", 0.5), ("sit", "G5", 1), ("on", "A5", 2), ("the", "A5", 3),
      ("uh", "G5", 4), ("ther", "E5", 4.5), ("side", "C5", 5)], ("C", "Am")),
    ("Opposite Day is here for you!", None,
     [("op", "C5", 0), ("puh", "D5", 0.5), ("sit", "E5", 1), ("day", "G5", 2), ("is", "G5", 3),
      ("here", "E5", 4), ("for", "D5", 4.5), ("you", "C5", 5)], ("F", "C")),
]
PALINDROME = ["C5", "E5", "G5", "A5", "G5", "E5", "C5"]
TWIN_SHIFT = 4.0                    # BIM = raw voice + 4 semitones


def check_palindromes():
    for cap, _, syls, _ in THEME:
        notes = [nt for _, nt, _ in syls]
        beats = [b for _, _, b in syls]
        assert notes == notes[::-1], cap
        mid = beats[0] + beats[-1]
        assert all(abs(b + c - mid) < 1e-9 for b, c in zip(beats, beats[::-1])), cap


def sing(syl, freq, dur):
    """One sung syllable in the RAW twin voice: monotone espeak at the note's pitch, fitted to
    the note length. Returns (audio, index of the vowel onset)."""
    p = p_for_hz(SING_VOICE, freq)
    speed = 170
    x = None
    for _ in range(3):
        x = espeak(syl, SING_VOICE, speed, p, 0, prange="0")
        x = trim_silence(x, -40, 0.0, 0.01)
        L = len(x) / SR
        if abs(L - dur) < 0.08 * dur:
            break
        new = float(np.clip(speed * L / dur, 80, 450))
        if abs(new - speed) < 2:
            break
        speed = new
    f0 = f0_median(x, fmax=1400)
    if f0 > 0 and 0.7 < freq / f0 < 1.4:
        x = resample(x, freq / f0)                   # fine pitch correction
    L = len(x) / SR
    if L < 0.85 * dur:                               # too short for a held note: stretch it
        x = wsola(x, min(2.2, dur / L))
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


def theme_score(lines, line_starts, beat, music_box=False):
    """Instrument events and the vocal note list for 2-bar lines."""
    ev, vox = [], []
    for li, (_, _, syls, chords) in enumerate(lines):
        t_line = line_starts[li]
        for k, (syl, note, b) in enumerate(syls):
            t0 = t_line + b * beat
            nb = syls[k + 1][2] if k + 1 < len(syls) else 7.6
            d = (nb - b) * beat * (0.92 if k + 1 < len(syls) else 1.0)
            vox.append((t0, d, syl, midi(note) - 12))
            ev.append((t0, d, note, "toy", 0.55 if k + 1 < len(syls) else 0.62))
        for bar in range(2):
            ch = chords[bar]
            b0 = t_line + bar * 4 * beat
            root = midi(ROOTS[ch])
            ev.append((b0, beat * 0.9, root, "bass", 0.55))
            ev.append((b0 + 2 * beat, beat * 0.9, root + 7, "bass", 0.45))
            for b in (1, 3):
                ev.append((b0 + b * beat, beat * 0.4, [midi(x) + 12 for x in CHORDS[ch]], "toy", 0.26))
                ev.append((b0 + b * beat, 0.2, None, "clap", 0.55))
            for b in (0, 2):
                ev.append((b0 + b * beat, 0.2, None, "kick", 0.3))
            for h in range(8):
                ev.append((b0 + h * beat / 2, 0.05, None, "shaker", 0.3 if h % 2 else 0.15))
        # glockenspiel counter-line in the held beats: the chord's notes down then up (a palindrome)
        top = CHORDS[chords[1]]
        for j, nt in enumerate([top[2], top[1], top[0], top[1], top[2]]):
            ev.append((t_line + (6.0 + 0.4 * j) * beat, 0.4, midi(nt) + 24, "glock", 0.28))
    return ev, vox


def render_vocals(vox, n):
    """Sing every note in the raw voice (a 4-semitone-lower copy of each note), then shift the
    whole vocal up 4 semitones: the same shifter that makes BIM's speaking voice."""
    buf = np.zeros(n + secs(2))
    onsets = []
    for t0, d, syl, m in vox:
        x, onset = sing(syl, mtof(m - TWIN_SHIFT), d)
        start = secs(t0) - onset
        onsets.append(max(0, start) / SR)
        place(buf, x, start / SR)
    buf = pshift(buf[:n], TWIN_SHIFT)
    return buf, onsets


def make_theme():
    check_palindromes()
    total = 22.0
    n = secs(total)
    beat = 0.375                                     # 160 bpm, 1 bar = 1.5 s
    starts = [2.0 + 3.0 * i for i in range(6)]
    ev, vox = theme_score(THEME, starts, beat)
    # Intro: a glockenspiel run up and back down (palindrome), then a bar of the hook.
    for i, nt in enumerate(["C6", "E6", "G6", "C7", "G6", "E6", "C6"]):
        ev.append((0.02 + i * 0.06, 0.3, nt, "glock", 0.3))
    t_bar = 0.5
    for b in range(4):
        tb = t_bar + b * beat
        if b in (0, 2):
            ev.append((tb, beat * 0.9, midi("C3") + (7 if b == 2 else 0), "bass", 0.55))
            ev.append((tb, 0.2, None, "kick", 0.3))
        else:
            ev.append((tb, beat * 0.4, [midi(x) + 12 for x in CHORDS["C"]], "toy", 0.22))
            ev.append((tb, 0.2, None, "clap", 0.5))
    for i, nt in enumerate(PALINDROME):
        ev.append((t_bar + i * beat / 2, 0.3, nt, "toy", 0.5))
    # Outro bar on G7 under the spoken "Hi, kids!", then the button.
    for b in range(4):
        tb = 20.0 + b * beat
        if b in (0, 2):
            ev.append((tb, beat * 0.9, midi("G2") + (7 if b == 2 else 0), "bass", 0.5))
        else:
            ev.append((tb, beat * 0.4, [midi(x) + 12 for x in CHORDS["G7"]], "toy", 0.2))
    ev.append((21.125, 0.12, ["C5", "E5", "G5"], "toy", 0.6))
    ev.append((21.125, 0.12, midi("C3"), "bass", 0.8))
    ev.append((21.125, 0.12, None, "kick", 0.5))
    ev.append((21.5, 0.5, ["C5", "E5", "G5", "C6"], "toy", 0.7))
    ev.append((21.5, 0.5, ["C6", "E6", "G6"], "glock", 0.4))
    ev.append((21.5, 0.4, midi("C2") + 12, "bass", 1.0))
    ev.append((21.5, 0.2, None, "kick", 0.7))
    ev.append((21.5, 0.2, None, "clap", 0.6))
    music = render_events(ev, n, detune=8.0)
    vocals, onsets = render_vocals(vox, n)
    vocals = tv_voice_chain(vocals, 250, 4500, 1.5, 0.12, 0.3, double=False)[:n]
    hi = voice_twin("Hi, kids!", {"pitches": (90,)}, 170, TWIN_SHIFT)
    hi = trim_silence(hi, -50, 0.0, 0.0)
    vocals = vocals / (np.max(np.abs(vocals)) + 1e-9)
    hi = hi / (np.max(np.abs(hi)) + 1e-9)
    hi_at = 20.3
    place(vocals, hi, hi_at, 0.95)
    music = reverb(music, 0.5, 0.12, damp=6000)[:n]
    music = music / (np.max(np.abs(music)) + 1e-9)
    mix = 0.6 * music + 0.78 * vocals
    mix = np.tanh(1.2 * mix) / np.tanh(1.2)
    mix = bp(mix, 60, 11000, 2)
    mix = fade(mix, 0.0, 0.25)
    lyrics, sung = [], []
    k = 0
    for li, (sung_txt, cap, syls, _) in enumerate(THEME):
        t = round(min(onsets[k], starts[li] + 0.05), 2)
        lyrics.append([t, cap or sung_txt])
        sung.append([t, sung_txt])
        k += len(syls)
    lyrics.append([hi_at, "Hi, kids!"])
    sung.append([hi_at, "Hi, kids!"])
    meta = {"lyrics": lyrics, "sung": sung, "caption_differs": [4],
            "caption_note": "line 5 is SUNG 'Come and sit on the other side,' but CAPTIONED 'Come and sit here by my side,'",
            "bpm": 160, "line_starts": starts, "palindrome": PALINDROME,
            "vocals_env": envelope_json(np.maximum(vocals, -1), total)}
    return norm(mix, db(-1)), meta


def make_theme_wrong():
    """Goodbye reprise: the theme on a music box at 80% tempo, 70 cents flat, every note doubled
    50 cents lower so it beats, noise wow of 1.5%; the last phrase ends on F# (a tritone from C)
    and never resolves; then the mechanism keeps clicking with no notes."""
    total = 14.0
    n = secs(total)
    beat = 0.375 / 0.8
    lines = [THEME[0], THEME[4], THEME[5]]
    flat = -0.70
    ev = []
    t_line = 0.3
    last_note_t = 0.0
    for li, (_, _, syls, chords) in enumerate(lines):
        for k, (_, note, b) in enumerate(syls):
            m = midi(note) + flat
            if li == len(lines) - 1 and k == len(syls) - 1:
                m = midi("F#5") + flat
                last_note_t = t_line + b * beat
            ev.append((t_line + b * beat, 1.6, m, "mbox", 0.8))
            ev.append((t_line + b * beat + 0.004, 1.6, m - 0.5, "mbox", 0.5))
        for bar in range(2):
            if li == len(lines) - 1 and bar == 1:
                continue                             # nothing under the F#: it hangs alone
            ch = chords[bar]
            ev.append((t_line + bar * 4 * beat, 1.6, midi(ROOTS[ch]) + 24 + flat, "mbox", 0.42))
            ev.append((t_line + (bar * 4 + 2) * beat, 1.6, midi(CHORDS[ch][1]) + 12 + flat, "mbox", 0.28))
        t_line += 8 * beat
    notes = render_events(ev, n, detune=20.0)
    # the mechanism: ratchet clicks at ~8.5/s and a governor whirr, never stopping
    clicks = np.zeros(n)
    t, step = 0.05, 0.118
    while t < total - 0.01:
        c = hp(rng.standard_normal(secs(0.002)), 3000) * rng.uniform(0.03, 0.06)
        place(clicks, c, t + rng.uniform(-0.004, 0.004))
        t += step * (1 + 0.15 * max(0.0, (t - last_note_t - 2.0) / 3.0))   # loosening after the tune
    whirr = bp(rng.standard_normal(n), 1200, 3500) * 0.005 * (1 + 0.5 * np.sin(2 * np.pi * 16 * tvec(n)))
    y = notes + clicks + whirr
    rate = wow_flutter(n, 0.015, 0.002)
    y = vari(np.concatenate([y, np.zeros(secs(0.5))]), np.concatenate([rate, np.ones(secs(0.5))]))[:n]
    y = reverb(y, 0.4, 0.12, damp=6000, tail=False)
    y = lp(y, 7000, 2)
    meta = {"tempo": 0.8, "flat_cents": -70, "double_cents": -50, "wow": 0.015,
            "last_note": "F#5 (tritone, unresolved)", "last_note_at": round(last_note_t, 3),
            "clicks_only_from": round(last_note_t + 1.8, 2), "cut_dead": True}
    return norm(y, db(-6)), meta


def make_ident():
    """Two-Way Kids ident: the palindrome on toy piano + glock, 0.32 s apart, dynamics
    p-mf-f-ff-f-mf-p, over a soft pad; then the C chord rings out. The motif fits inside the
    first 2.0 s, so 9e can play 0-2 s forwards and then reversed and the tune is the same."""
    total = 4.0
    n = secs(total)
    buf = np.zeros(n + secs(3))
    vel = [0.35, 0.55, 0.75, 1.0, 0.75, 0.55, 0.35]
    times = [0.04 + 0.32 * i for i in range(7)]
    for t0, nt, v in zip(times, PALINDROME, vel):
        place(buf, toy_piano(mtof(midi(nt)), 1.0, 0.8 * v), t0)
        place(buf, glock(mtof(midi(nt) + 12), 1.0, 0.32 * v), t0)
    place(buf, pad([mtof(midi(x)) for x in ["C4", "E4", "G4"]], 2.2, 0.55, attack=0.6, release=0.8), 0.0)
    t_ch = 2.28
    for nt in ["C5", "E5", "G5", "C6"]:
        place(buf, toy_piano(mtof(midi(nt)), 2.0, 0.5), t_ch)
    for i, nt in enumerate(["C6", "E6", "G6", "C7"]):
        place(buf, glock(mtof(midi(nt)), 1.6, 0.22 * (1 - 0.12 * i)), t_ch + i * 0.03)
    place(buf, pad([mtof(midi(x)) for x in ["C4", "E4", "G4", "C5"]], 1.6, 0.9, attack=0.05, release=1.0), t_ch)
    place(buf, bass_note(mtof(midi("C3")), 1.5, 0.6), t_ch)
    shimmer = sum(sine(mtof(midi(x)) * 2, 1.7) for x in ["C6", "G6"]) * expdec(secs(1.7), 0.7) * 0.04
    place(buf, shimmer, t_ch)
    y = reverb(buf[:n], 1.0, 0.18, damp=6000)[:n]
    y = fade(y, 0.0, 0.9)
    meta = {"notes": [[round(t, 2), nt] for t, nt in zip(times, PALINDROME)], "palindrome_window": [0.0, 2.0],
            "chord_at": t_ch, "dynamics": "p-mf-f-ff-f-mf-p"}
    return norm(y, db(-1)), meta


def make_bumper():
    """Rule bumper: glock C-E-G-E-C (a palindrome), slide whistle up then down, a ta-da."""
    total = 1.5
    n = secs(total)
    buf = np.zeros(n + secs(2))
    for i, nt in enumerate(["C6", "E6", "G6", "E6", "C6"]):
        place(buf, glock(mtof(midi(nt)), 0.6, 0.55), i * 0.065)
        place(buf, toy_piano(mtof(midi(nt) - 12), 0.4, 0.35), i * 0.065)
    place(buf, slide_whistle(700, 1900, 0.22, 0.4), 0.34)
    place(buf, slide_whistle(1900, 700, 0.22, 0.4), 0.56)
    for t0, d, v in ((0.86, 0.1, 0.7), (1.0, 0.45, 1.0)):
        for nt in ["C5", "E5", "G5", "C6"]:
            place(buf, toy_piano(mtof(midi(nt)), d + 0.5, v * 0.6), t0)
        place(buf, bass_note(mtof(midi("C3")), d, v * 0.8), t0)
        place(buf, kick(0.45 * v), t0)
        place(buf, clap(0.4 * v), t0)
    place(buf, glock(mtof(midi("C7")), 0.6, 0.28), 1.0)
    place(buf, glock(mtof(midi("G6")), 0.6, 0.22), 1.04)
    y = reverb(buf[:n], 0.45, 0.12)[:n]
    y = fade(y, 0, 0.2)
    return norm(y, db(-1)), {"palindrome": ["C6", "E6", "G6", "E6", "C6"]}


def bed_score(beat, n_beats):
    """The show bed: the theme's palindromes noodled on toy piano, glock answers, bass, pad."""
    ev = []
    for li in range(6):
        b0 = li * 8
        _, _, syls, chords = THEME[li]
        for k, (_, note, b) in enumerate(syls):
            ev.append(((b0 + b) * beat, beat * 0.9, note, "toy", 0.42 if k % 2 == 0 else 0.34))
        # the same line answered backwards an octave up, quietly (it is the same line)
        for k, (_, note, b) in enumerate(syls[::-1][:3]):
            ev.append(((b0 + 6.0 + 0.5 * k) * beat, beat * 0.45, midi(note) + 12, "glock", 0.16))
        for bar in range(2):
            ch = chords[bar]
            root = midi(ROOTS[ch])
            bb = b0 + bar * 4
            ev.append((bb * beat, beat * 1.8, root, "bass", 0.28))
            ev.append(((bb + 2) * beat, beat * 1.8, root + 7, "bass", 0.22))
            ev.append((bb * beat, beat * 3.8, CHORDS[ch], "pad", 0.26))
    for j, nt in enumerate(["G5", "A5", "G5", "E5"]):              # 2-beat turnaround to the top
        ev.append(((48 + 0.5 * j) * beat, 0.35, nt, "glock", 0.28))
    ev.append((48 * beat, beat * 1.8, midi("G2"), "bass", 0.26))
    return [e for e in ev if e[0] < n_beats * beat]


def make_show_bed():
    total = 30.0
    n = secs(total)
    beat = 0.6                                       # 100 bpm, 50 beats = 30.0 s
    buf = render_events(bed_score(beat, 50), n, detune=12.0, circular=True)
    buf = reverb(buf, 0.6, 0.14, damp=6000, circular=True)
    buf = lp(buf, 9000, 2, circ=True)
    return norm(buf, db(-6)), {"bpm": 100, "loop": True, "detune_cents": 12}


# ==========================================================================
# Ambiences (20 s; loops are built periodic)
# ==========================================================================

def make_room_tone():
    n = secs(20.0)
    x = colored_noise(n, -6.0, 25, 500)                  # brown noise, low-passed at 500 Hz
    hvac = bp(rng.standard_normal(n), 180, 900, 2, circ=True)
    hvac = hvac / np.std(hvac) * 0.12 * (1 + 0.25 * lfo_noise(n, 0.05, 0.3))
    x = x + hvac + 0.03 * sine(60.0, 20.0) + 0.012 * sine(120.0, 20.0)
    return x * (db(-20) / rms(x)), {"loop": True, "level": "-20 dBFS RMS (mix it at -42)"}


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


def make_drone():
    """41 + 42 Hz (1 Hz beating) and a quiet 83 Hz partial; saturated a little so small
    speakers carry it. Whole cycles in 20 s: loops."""
    n = secs(20.0)
    t = tvec(n)
    x = np.sin(2 * np.pi * 41 * t) + np.sin(2 * np.pi * 42 * t) + 0.3 * np.sin(2 * np.pi * 83 * t)
    rumble = bp(rng.standard_normal(n), 45, 120, 4, circ=True)
    x = norm(x, 1.0) + 0.12 * rumble / np.max(np.abs(rumble))
    x = np.tanh(1.7 * norm(x, 1.0))
    x = hp(x, 32, 6, circ=True)
    x = lp(x, 700, 2, circ=True)
    return norm(x, db(-6)), {"loop": True, "cut_dead": True}


def make_cluster():
    """Five tones a semitone apart (E4 F4 F#4 G4 G#4), each its own 0.1-0.3 Hz vibrato and slow
    swell (micropolyphony), a breath of bow noise; the whole file swells +14 dB and ends at
    full level so it can be cut dead."""
    dur = 20.0
    n = secs(dur)
    t = tvec(n)
    y = np.zeros(n)
    breath = np.zeros(n)
    for nm in ["E4", "F4", "F#4", "G4", "G#4"]:
        f0 = mtof(midi(nm) + rng.uniform(-6, 6) / 100)
        vib_rate = rng.uniform(0.1, 0.3)
        cents = rng.uniform(10, 18)
        f = f0 * 2 ** (cents / 1200 * np.sin(2 * np.pi * vib_rate * t + rng.uniform(0, 6.28))
                        + 3 / 1200 * lfo_noise(n, 0.05, 0.5))
        ph = 2 * np.pi * np.cumsum(f) / SR
        tone = np.sin(ph) + 0.16 * np.sin(2 * ph + 0.3) + 0.05 * np.sin(3 * ph + 1.1)
        amp = 0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(0.04, 0.12) * t + rng.uniform(0, 6.28))
        y += amp * tone
        nb = bp(rng.standard_normal(n), f0 * 0.9, f0 * 3.0, 2)
        breath += amp * nb / np.std(nb)
    y = norm(y, 1.0) + 0.05 * breath / np.max(np.abs(breath))
    y = peq(y, 1000, 2.0, 1.2)
    y = lp(y, 4000, 2)
    y = y * db(-14 + 14 * (t / dur) ** 1.4)
    y = end_on_zero(y)
    return norm(y, db(-6)), {"tones": ["E4", "F4", "F#4", "G4", "G#4"], "swell_db": 14,
                             "ends_at_full_level": True, "cut_dead": True}


def make_sub_breath():
    """30-45 Hz rumble breathing at 0.3 Hz (a 1.3 s swell in, 2.0 s ebb). Loops."""
    dur = 20.0
    n = secs(dur)
    t = tvec(n)
    x = np.sin(2 * np.pi * 34 * t) + 0.8 * np.sin(2 * np.pi * 41 * t)
    nz = bp(rng.standard_normal(n), 30, 48, 4, circ=True)
    x = norm(x, 1) + 0.4 * nz / (np.max(np.abs(nz)) + 1e-9)
    period = 1 / 0.3
    ph = t % period
    swell = np.where(ph < 1.3, 0.5 - 0.5 * np.cos(np.pi * ph / 1.3),
                     0.5 + 0.5 * np.cos(np.pi * (ph - 1.3) / (period - 1.3)))
    x = x * (0.15 + 0.85 * swell)
    x = np.tanh(1.6 * norm(x, 1)) / np.tanh(1.6)
    x = hp(x, 28, 4, circ=True)
    x = lp(x, 160, 2, circ=True)
    return norm(x, db(-6)), {"loop": True, "breath_hz": 0.3, "cut_dead": True}


def make_shepard_down():
    """A riser turned upside down, sinking forever: 8 octave-spaced sines from 55 Hz under a
    sin^2 window, FALLING 0.10 octave/s with +-6 cent drift, a quieter stack a tritone above it,
    climbing +12 dB over the file and ending at full level (cut dead at the hit).
    26 s long: it has to run from 10b +0.0 to 10f +2.8 (25.8 s)."""
    dur, layers, rate = 26.0, 8, -0.10
    n = secs(dur)
    t = tvec(n)
    tone, hiss = shepard_stack(t, 55.0, layers, rate)
    tri, _ = shepard_stack(t, 55.0 * 2 ** 0.5, layers, rate, cents=(-9.0, 4.0))
    x = norm(tone, 1) + db(-10) * norm(tri, 1) + db(-20) * norm(hiss, 1)
    k = t / dur
    ph = 2 * np.pi * np.cumsum(0.8 + 2.4 * k ** 1.6) / SR       # a slow pulse that quickens
    ph -= ph[-1]
    x = x * (1 - 0.22 * k ** 1.3 * (0.5 - 0.5 * np.cos(ph))) / (1 - 0.11 * k ** 1.3)
    x = x * db(-12 + 12 * t / dur)
    x[:secs(0.05)] *= np.linspace(0, 1, secs(0.05))
    x = end_on_zero(x)
    return norm(x, db(-1)), {"glide_oct_per_s": rate, "rise_db": 12, "ends_at_full_level": True,
                             "covers": "10b +0.0 to 10f +2.8 (25.8 s); assets.json target was 16.0 s",
                             "cut_dead": True}


# ==========================================================================
# Sound effects
# ==========================================================================

def make_bars_tone_rev():
    """The bars tone run backwards: a 1 kHz sine whose (reversed, exponential) release fades it
    IN from silence over 3.9 s; it then stops dead on the last sample. 4200 whole cycles, so the
    last sample is a zero crossing: dead, but no click."""
    dur = 4.2
    n = secs(dur) + 1                                # the extra sample lands on the zero crossing
    t = tvec(n)
    x = np.sin(2 * np.pi * 1000.0 * t)
    rise = 3.9
    env = 10 ** (-60 * np.clip(1 - t / rise, 0, 1) ** 1.6 / 20)
    env[0] = 0.0
    return norm(x * env, db(-1)), {"fade_in_s": rise, "stops_dead": True}


def make_static_burst():
    dur = 1.5
    n = secs(dur)
    x = bp(snow(dur), 300, 6000, 4)
    x = np.clip(x / (2.2 * np.std(x)), -1, 1)                  # hard ceiling: never spikes
    x = x * (0.82 + 0.18 * np.tanh(lfo_noise(n, 8, 40)))
    cr = crackle(n, 70.0)
    x = 0.85 * x + 0.5 * cr / (np.max(np.abs(cr)) + 1e-9)
    return norm(fade(x, 0.002, 0.03), db(-1)), {}


def make_tracking_garble():
    """0.1 s pop, then the palindrome smeared: warbling pitch, chopped into slivers with noise."""
    dur = 0.6
    n = secs(dur)
    t = tvec(n)
    frag = np.zeros(n + secs(1))
    for i, nt in enumerate(PALINDROME[:5]):
        place(frag, toy_piano(mtof(midi(nt) + rng.uniform(-0.4, 0.4)), 0.5, 0.8), 0.08 + i * 0.1)
    rate = 1 + 0.12 * lfo_noise(len(frag), 6, 18) + 0.25 * np.sin(2 * np.pi * 2.2 * tvec(len(frag)))
    frag = vari(frag, np.maximum(rate, 0.2))[:n]
    frag = reverb(frag, 0.25, 0.4, tail=False)
    noise = bp(snow(dur), 300, 6000)
    buzz = lp(saw(np.full(n, 59.94)), 3000, 2) * 0.5
    gate_a, gate_b = np.zeros(n), np.zeros(n)
    i = secs(0.1)
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
    pop = impact(0.1, [70, 140, 900], [0.03, 0.02, 0.008], (400, 5000), 55, 0.03)
    x = norm(x, 0.8)
    x[:len(pop)] += norm(pop, 1.0)[:n]
    x = np.tanh(1.5 * norm(x, 1))
    return norm(fade(x, 0.0005, 0.03), db(-1)), {"pop_s": 0.1}


def make_boing():
    """A felt spring: a twangy FM tone that wobbles ('boyoyoing') and settles, with a soft thud."""
    dur = 0.5
    n = secs(dur)
    t = tvec(n)
    f = 150 + 260 * np.exp(-t / 0.05) + 40 * np.exp(-t / 0.3)
    f = f * (1 + 0.09 * np.sin(2 * np.pi * 17 * t) * np.exp(-t / 0.22))
    ph = 2 * np.pi * np.cumsum(f) / SR
    idx = 2.2 * np.exp(-t / 0.18) * (1 + 0.5 * np.sin(2 * np.pi * 17 * t))
    y = np.sin(ph + idx * np.sin(2 * ph))
    y = y * np.minimum(1, t / 0.003) * np.exp(-t / 0.16)
    thud = lp(rng.standard_normal(n), 500) * np.exp(-t / 0.015) * 0.5
    y = y + thud
    y = bp(y, 90, 6000, 2)
    return norm(fade(y, 0.0, 0.05), db(-1)), {}


def make_pop():
    dur = 0.3
    n = secs(dur)
    t = tvec(n)
    f = 260 * (1000 / 260) ** np.minimum(1, t / 0.045)
    blip = sine(f) * np.exp(-t / 0.05)
    k = np.clip((t - 0.035) / 0.25, 0, 1)
    whistle_f = 1500 * (1 + 0.35 * k) * (1 + 0.02 * np.sin(2 * np.pi * 20 * t))   # tiny slide-whistle blip
    whistle = sine(whistle_f) * np.clip((t - 0.03) / 0.01, 0, 1) * np.exp(-np.maximum(0, t - 0.03) / 0.05) * 0.25
    puff = lp(rng.standard_normal(n), 1500) * np.exp(-t / 0.012) * 0.6
    x = attack_ramp(blip + whistle + puff, 0.001)
    return norm(fade(x, 0, 0.03), db(-1)), {}


_SYL_CACHE = {}


def kid_syllable(syl, voice, pitch, speed, shift):
    key = (syl, voice, pitch, int(speed), round(shift, 2))
    if key not in _SYL_CACHE:
        x = espeak(syl, voice, speed, pitch, 0, prange="x-high")
        x = trim_silence(x, -40, 0.0, 0.01)
        _SYL_CACHE[key] = norm(pshift(x, shift), 1.0)
    return _SYL_CACHE[key]


def make_laugh():
    """A bleacher of 11 children giggling: each a run of 'ha'/'hee'/'hih' syllables at falling
    pitch with breathy whispered doubles, staggered, swelling then settling."""
    dur = 3.0
    n = secs(dur)
    buf = np.zeros(n + secs(1))
    t_env = lambda t0: float(np.interp(t0, [0, 0.5, 1.2, 3.0], [0.45, 1.0, 0.8, 0.25]))
    for k in range(11):
        v = KID_VOICES[k % len(KID_VOICES)]
        syl = ["ha", "hee", "hih", "heh"][int(rng.integers(0, 4))]
        p0 = int(rng.integers(82, 100))
        sh = float(rng.uniform(2.5, 5.0))
        t0 = float(rng.uniform(0.0, 0.6))
        nsyl = int(rng.integers(4, 9))
        gap = float(rng.uniform(0.12, 0.19))
        for j in range(nsyl):
            if t0 > dur - 0.1:
                break
            p = max(40, p0 - 4 * j + int(rng.integers(-3, 4)))
            x = kid_syllable(syl, v, p, 260, sh)
            w = kid_syllable(syl, "en-us+whisperf", p, 260, sh) * 0.5
            g = t_env(t0) * (0.85 ** j) * float(rng.uniform(0.6, 1.0))
            place(buf, (x + fit(w, len(x))) * g, t0)
            t0 += gap * float(rng.uniform(0.85, 1.2))
        if rng.random() < 0.5:                       # a breath in at the end of a run
            b = bp(rng.standard_normal(secs(0.18)), 1500, 6000) * np.hanning(secs(0.18)) * 0.08
            place(buf, b, t0)
    y = bleacher(buf[:n + secs(0.5)])[:n]
    y = np.tanh(1.2 * norm(y, 1.0))
    return norm(fade(y, 0.01, 0.35), db(-1)), {"voices": 11}


def make_laugh_rev():
    """sfx_laugh reversed: the giggles become long sucking inhales that end abruptly."""
    path = source_wav("sfx_laugh")
    x = reverse(read_wav(path))
    x[:secs(0.02)] *= np.linspace(0, 1, secs(0.02))
    return norm(x, db(-1)), {"source": "build/audio/sfx_laugh.wav", "source_crc": file_crc(path)}


def make_kids_yay():
    dur = 2.0
    n = secs(dur)
    buf = np.zeros(n + secs(1))
    for k, v in enumerate(KID_VOICES):
        p = int(rng.integers(84, 100))
        sh = float(rng.uniform(2.0, 5.0))
        x = espeak("yay!", v, int(rng.integers(150, 190)), p, 0, prange="x-high")
        x = trim_silence(x, -40, 0.0, 0.02)
        x = norm(pshift(x, sh), 1.0)
        # hold the vowel: stretch the middle so 'yaaay' lasts ~1.1 s, the pitch arching
        a, b = int(len(x) * 0.25), int(len(x) * 0.8)
        mid = wsola(x[a:b], float(np.clip(0.95 / max(1e-3, (b - a) / SR), 1.0, 4.0)))
        m = len(mid)
        arch = 1 + 0.05 * np.sin(np.pi * np.arange(m) / m)
        mid = vari(np.concatenate([mid, np.zeros(m)]), np.concatenate([arch, np.ones(m)]))[:m]
        x = np.concatenate([x[:a], mid, fade(x[b:], 0, 0.05)])
        place(buf, x * rng.uniform(0.7, 1.0), rng.uniform(0.0, 0.09))
    claps = np.zeros(n + secs(1))
    for c in range(12):                              # 12 clappers, 4-6 claps/s each
        t0 = rng.uniform(0.25, 0.4)
        rate = rng.uniform(4.0, 6.0)
        while t0 < dur - 0.1:
            place(claps, clap(rng.uniform(0.4, 1.0) * float(np.interp(t0, [0, 0.6, 2.0], [0.6, 1.0, 0.4]))), t0)
            t0 += 1 / rate * rng.uniform(0.9, 1.1)
    y = norm(fit(bleacher(buf[:n]), n), 1.0) + 0.45 * norm(claps[:n], 1.0)
    y = np.tanh(1.2 * norm(y, 1.0))
    return norm(fade(y, 0.01, 0.4), db(-1)), {}


def clock_tick(f1, vel=1.0):
    tk = resonators([f1, f1 * 1.47, f1 * 2.3, f1 * 0.41], [0.012, 0.008, 0.005, 0.03], [1, 0.5, 0.3, 0.3], 0.08)
    tk[:secs(0.001)] += rng.standard_normal(secs(0.001)) * 0.3
    return vel * tk


def make_clock_rev():
    """A wall clock running backwards, 10 s loop: every tick is reversed with its room, so it
    swells into a click and stops dead ('tock-tick')."""
    dur = 10.0
    n = secs(dur)
    buf = np.zeros(n)
    clicks = []
    for i in range(10):
        tk = clock_tick(2900 if i % 2 == 0 else 2300, 1.0 if i % 2 == 0 else 0.8)
        tk = reverb(tk, 0.55, 0.5, damp=3000, predelay=0.004)
        tk = reverse(tk)
        at = i + 0.5
        place(buf, tk, at - len(tk) / SR, circular=True)
        clicks.append(at)
    buf = lp(buf, 6000, 2, circ=True)
    return norm(buf, db(-1)), {"loop": True, "clicks_at": clicks}


def felt_step(vel=1.0):
    """A padded felt foot on a carpeted stage: a soft low thump and a cloth scuff, no click."""
    n = secs(0.3)
    y = impact(0.3, [85, 160, 420, 900], [0.05, 0.035, 0.02, 0.01], (300, 1500), 70, 0.04)
    sc = bp(rng.standard_normal(secs(0.12)), 600, 3200, 2) * np.hanning(secs(0.12)) * 0.12
    place(y, sc, 0.02)
    return vel * lp(fit(y, n), 2500, 2)


def make_steps_rev():
    """Reversed felt-puppet footsteps at 1.6 per second: each thump (with its room) reversed, so
    it swells and stops dead; faint reversed floor squeaks. 12 steps in 7.5 s, a seamless loop
    long enough for 10b (7.0 s)."""
    dur, steps = 7.5, 12
    n = secs(dur)
    buf = np.zeros(n)
    stops = []
    for i in range(steps):
        st = felt_step((1.0 if i % 2 == 0 else 0.82) * rng.uniform(0.85, 1.05))
        if i in (3, 9):
            L = 0.09
            f = np.geomspace(1500, 2300, secs(L)) * (1 + 0.03 * np.sin(2 * np.pi * 40 * tvec(secs(L))))
            place(st, sine(f) * np.hanning(secs(L)) * 0.05, 0.06)
        st = reverb(st, 0.8, 0.38, damp=3200, predelay=0.006)
        st = reverse(st)
        at = i * dur / steps + 0.3 + rng.uniform(-0.02, 0.02)
        place(buf, st, at - len(st) / SR, circular=True)
        stops.append(round(at, 3))
    buf = bp(buf, 80, 6000, 2, circ=True)
    return norm(buf, db(-1)), {"loop": True, "steps_per_s": 1.6, "dead_stops_at": stops,
                               "note": "7.5 s (assets.json target 6.0) so 10b's 7.0 s needs no loop"}


def make_ratchet():
    """The portrait turning one step on its nail: a dry wooden creak, then the frame's click."""
    dur = 0.8
    n = secs(dur)
    buf = np.zeros(n + secs(0.5))
    c = stickslip(0.42, [26, 52, 66, 44], [240, 520, 980, 1650, 2600], [0.02, 0.015, 0.01, 0.008, 0.006])
    tt = tvec(len(c))
    c = c * np.minimum(1, tt / 0.04) * np.minimum(1, (0.42 - tt) / 0.06)
    place(buf, norm(c, 0.6), 0.0)
    click = impact(0.2, [880, 1720, 3050, 4400], [0.025, 0.014, 0.007, 0.004], (1500, 6000), 0)
    thunk = impact(0.2, [140, 310], [0.03, 0.02], (500, 2000), 120, 0.02)
    place(buf, norm(click, 1.0), 0.44)
    place(buf, norm(thunk, 0.5), 0.445)
    y = reverb(buf[:n], 0.18, 0.05, tail=False)
    return norm(fade(y, 0.002, 0.05), db(-1)), {"click_at": 0.44}


def make_neg_click():
    n = secs(0.3)
    buf = np.zeros(n)
    place(buf, impact(0.04, [2400, 4100, 6200], [0.004, 0.003, 0.002], (2000, 8000)), 0.01, 1.0)
    place(buf, impact(0.03, [1900, 3300], [0.003, 0.002], (1500, 7000)), 0.075, 0.55)
    place(buf, impact(0.03, [5200, 7400], [0.005, 0.003], (4000, 9000)), 0.16, 0.35)
    buf = bp(buf, 100, 6500, 2)
    return norm(fade(buf, 0.0, 0.02), db(-1)), {}


def make_light_step():
    """A big studio light switched off: contactor clunk, a filament tick, the hum dying away."""
    dur = 1.2
    n = secs(dur)
    t = tvec(n)
    buf = np.zeros(n + secs(1))
    place(buf, impact(0.45, [75, 180, 640, 1400, 2900], [0.09, 0.05, 0.03, 0.015, 0.008], (500, 5000), 62, 0.08), 0.0, 1.4)
    place(buf, impact(0.08, [2300, 3700, 5100], [0.01, 0.006, 0.004], (2000, 8000)), 0.004, 0.5)
    place(buf, resonators([4800, 6900], [0.02, 0.012], [1, 0.5], 0.06) * 0.25, 0.09)
    hum = np.zeros(n)
    fh = 120 * (1 - 0.02 * (1 - np.exp(-t / 0.4)))
    ph = 2 * np.pi * np.cumsum(fh) / SR
    for k, a in ((1, 1.0), (2, 0.6), (3, 0.4), (4, 0.25), (6, 0.12), (8, 0.06)):
        hum += a * np.sin(k * ph)
    hum = np.tanh(2.0 * norm(hum, 1.0) + 0.2)
    hum = (hum - hum.mean()) * np.exp(-t / 0.32) * 0.35
    place(buf, hum, 0.0)
    y = reverb(buf[:n], 1.2, 0.16, damp=3500)[:n]
    return norm(fade(y, 0.0005, 0.08), db(-1)), {}


def make_preverb_safe():
    """Reverse-reverb pre-echo of 'You're safe': the first 0.6 s of vo_safe_1, reversed, 2.5 s
    reverb 100% wet, reversed again; the 0.8 s swell that leads INTO the word. The file ends
    where the word would start."""
    x, meta = make_preecho("vo_safe_1", lead=0.8, take=0.6, t60=2.5)
    return x, meta


# --- stingers and screams ---------------------------------------------------

def scream_core(dur, text="aah!", voice=TWIN, shift=4.0, steps=((0.0, 0), (0.15, 7), (0.55, -5)),
                am_hz=55.0, vib_hz=7.0, pitch=99):
    """The brief's synthetic scream from the twin voice: espeak at -p 99, the vowel stretched
    and flattened, abrupt pitch jumps, a throat that cannot hold the note, ring-modulated at
    `am_hz`, breath through formant band-passes at 800/1200/2500 Hz with `vib_hz` vibrato,
    and an octave-down growl copy."""
    n = secs(dur)
    t = tvec(n)
    v = espeak(text, voice, 120, pitch, 2, prange="x-high")
    v = trim_silence(v, -40, 0.0, 0.0)
    m = moving_rms(v, 0.02)
    loud = np.flatnonzero(m > 0.55 * m.max())
    va, vb = int(loud[0]), int(loud[-1])
    onset = v[max(0, va - secs(0.05)):va]
    vowel = v[va:vb]
    vowel = wsola(vowel, float(np.clip(dur * SR / max(1, len(vowel)), 1.0, 40.0)), frame=0.04)
    base = fit(np.concatenate([norm(onset, 0.7) if len(onset) else onset, norm(vowel, 1.0)]), n)
    base = attack_ramp(base / (moving_rms(base, 0.03) + 0.05 * np.max(np.abs(base))), 0.001)
    base = pshift(base, shift)
    voice_x = pitch_steps(base, list(steps))
    wob = 1 + 0.03 * np.sin(2 * np.pi * np.cumsum(np.interp(t, [0, dur], [5.5, 8.5])) / SR) \
        + 0.012 * lfo_noise(n, 15, 60)
    voice_x = vari(np.concatenate([voice_x, np.zeros(n)]), np.concatenate([wob, np.ones(n)]))[:n]
    voice_x = voice_x * (0.4 + 0.6 * np.sin(2 * np.pi * am_hz * t))       # ring mod, 60% depth
    noise = rng.standard_normal(n)
    form = sum(g * bp(noise, f * 0.88, f * 1.12, 3) for f, g in ((800, 1.0), (1200, 0.8), (2500, 0.5)))
    form = form / (np.std(form) + 1e-9) * (moving_rms(voice_x, 0.03) + 1e-6)
    vib = 1 + 0.04 * np.sin(2 * np.pi * vib_hz * t)
    form = vari(np.concatenate([form, np.zeros(n)]), np.concatenate([vib, np.ones(n)]))[:n]
    x = norm(voice_x, 1) + 0.8 * norm(form, 1)
    x = x + db(-10) * norm(fit(granular(x, 0.5, 1.0, 0.05), n), 1)       # octave-down growl
    x = np.tanh(2.6 * norm(x, 1))
    return hp(x, 90, 2)


def make_scream_rev():
    """MIB's scream (the twin voice, +4 st) REVERSED: it swells and cuts off dead at the end."""
    dur = 0.8
    n = secs(dur)
    t = tvec(n)
    x = scream_core(dur, "aah!", TWIN, 4.0, ((0.0, 0), (0.12, 6), (0.42, -4)), am_hz=55.0, vib_hz=7.0)
    x = x * np.minimum(1, t / 0.002) * np.exp(-t / 0.32)          # forward: hit, then dying
    x = reverse(x)
    return norm(x, db(-1)), {"reversed": True, "stops_dead": True, "voice": "twin +4 st, -p 99"}


# final saturation of stingers 1-3: sets their density (loudest 400 ms RMS at a -1 dBFS peak),
# which must climb from scare to scare
STING_DRIVE = [1.6, 2.2, 2.6]


def slap(x, delay=0.09, gain_db=-8.0):
    d = secs(delay)
    return x + db(gain_db) * np.concatenate([np.zeros(d), x[:-d]])


def reversed_cymbal(dur, end_at):
    """A cymbal (metallic noise ringing) played backwards: swells and stops at `end_at`."""
    m = secs(end_at)
    tt = tvec(m)
    ring = np.zeros(m)
    for f in rng.uniform(3000, 11000, 24):
        ring += np.sin(2 * np.pi * f * tt + rng.uniform(0, 6.28)) * rng.uniform(0.3, 1.0)
    cym = (hp(rng.standard_normal(m), 3500, 2) + 0.15 * ring) * np.exp(-tt / (end_at * 0.35))
    out = np.zeros(secs(dur))
    out[:m] = reverse(cym)
    return out


def make_stinger_1():
    """Scare 1, the smallest: noise burst, 45 Hz thump, a dry felt thump, 3 detuned saws
    800-2500 Hz gliding down with 10 Hz vibrato, 50 Hz roughness at 40%, a 90 ms slap, tanh."""
    dur = 1.0
    n = secs(dur)
    x = stinger_v2(dur, 800, 2500, 3, [], 0.02, 0.9, am_hz=50, am_depth=0.4, noise_dur=0.3,
                   thump_hz=45, thump_decay=0.5, vib=(9.5, 10.5), vib_depth=0.02, drive=2.0,
                   sub_db=-60.0, flicker_from=0.5, scr_drive=2.5, thump_gain=0.45, burst_gain=0.5)
    felt = impact(0.15, [110, 240, 520], [0.03, 0.02, 0.01], (300, 2500), 90, 0.03)
    x = norm(x, 1.0)
    x[:len(felt)] += 0.6 * norm(felt, 1.0)[:n]
    x = slap(x, 0.09, -9.0)
    x = np.tanh(STING_DRIVE[0] * norm(x, 1.0)) / np.tanh(STING_DRIVE[0])
    x = attack_ramp(fade(x, 0, 0.06), 0.001)
    return norm(x, db(-1)), {"rms_400ms_dbfs": rms_max(norm(x, db(-1)))}


def make_stinger_2():
    """Scare 2: 4 saws that jump up a minor ninth at 0.25 s, 60 Hz roughness at 50%, an octave-
    down subharmonic at -10 dB, denser (more drive, chaotic noise sooner)."""
    dur = 1.0
    x = stinger_v2(dur, 800, 2800, 4, [(0.25, +13)], 0.3, 1.0, am_hz=60, am_depth=0.5,
                   noise_dur=0.3, thump_hz=45, thump_decay=0.45, vib=(9.0, 12.0), vib_depth=0.022,
                   drive=3.0, sub_db=-10.0, flicker_from=0.25, scr_drive=3.2, thump_gain=0.4,
                   burst_gain=0.55)
    felt = impact(0.15, [110, 240, 520], [0.03, 0.02, 0.01], (300, 2500), 90, 0.03)
    x = norm(x, 1.0)
    x[:len(felt)] += 0.5 * norm(felt, 1.0)
    x = slap(x, 0.07, -10.0)
    x = np.tanh(STING_DRIVE[1] * norm(x, 1.0)) / np.tanh(STING_DRIVE[1])
    x = attack_ramp(fade(x, 0, 0.05), 0.001)
    return norm(x, db(-1)), {"rms_400ms_dbfs": rms_max(norm(x, db(-1)))}


def make_stinger_3():
    """Scare 3, the loudest and densest sound on the tape: 5 saws 700-3000 Hz with abrupt pitch
    jumps, a 40 Hz thump, a reversed cymbal swelling UNDER the attack (from the hit, never before
    it), 65 Hz roughness at 60%, a subharmonic at -8 dB, and BIM's own voice torn into a scream
    on top of it all, through tanh."""
    dur = 1.4
    n = secs(dur)
    t = tvec(n)
    x = stinger_v2(dur, 700, 3000, 5, [(0.08, +7), (0.22, -10), (0.42, +6), (0.7, -5)], 0.7, 0.8,
                   am_hz=65, am_depth=0.6, noise_dur=0.3, thump_hz=40, thump_decay=1.0,
                   vib=(8.0, 14.0), vib_depth=0.025, drive=3.2, sub_db=-8.0, flicker_from=0.2,
                   scr_drive=3.5, thump_gain=0.45, burst_gain=0.55)
    scream = scream_core(1.25, "bye!", TWIN, 4.0, ((0.0, 0), (0.1, 7), (0.38, 3), (0.62, -2)),
                         am_hz=65.0, vib_hz=8.0)
    scream = scream * np.minimum(1, tvec(len(scream)) / 0.003) * np.minimum(1, (1.25 - tvec(len(scream))) / 0.15)
    cym = reversed_cymbal(dur, 1.15)
    x = norm(x, 1.0) + 0.9 * norm(fit(scream, n), 1.0) + 0.35 * norm(cym, 1.0)
    x = slap(x, 0.06, -12.0)
    x = np.tanh(STING_DRIVE[2] * norm(x, 1.0)) / np.tanh(STING_DRIVE[2])
    x = x * np.minimum(1, (dur - t) / 0.08)
    x = attack_ramp(x, 0.001)
    return norm(x, db(-1)), {"rms_400ms_dbfs": rms_max(norm(x, db(-1))),
                             "scream": "BIM's voice ('bye', -p 99, +4 st) torn into a scream"}


# --- breathing --------------------------------------------------------------

def make_breath_rev():
    """The camcorder operator breathing right at the mic, then played REVERSED: the exhales
    become swells that stop dead, a cycle every 3 s, mouth clicks, +5 dB at 150-250 Hz, dry."""
    dur = 6.0
    n = secs(dur)
    buf = np.zeros(n + secs(1))
    for c in range(2):
        b0 = c * 3.0 + rng.uniform(-0.03, 0.03)
        sh = (-0.03, 0.02)[c]
        place(buf, breath_part(1.0, "in", sh) * 0.8, b0 + 0.05)
        place(buf, breath_part(1.5, "out", sh) * 1.0, b0 + 1.2)
        m = secs(1.5)
        place(buf, 0.1 * crackle(m) * np.exp(-tvec(m) / 0.6), b0 + 1.2)
        place(buf, mouth_click(0.8), b0 + 1.12)
    place(buf, mouth_click(0.5), 5.6)
    buf = buf[:n]
    buf = proximity(buf, 5.0, 200, 0.8)
    buf = hp(buf, 60, 2)
    x = reverse(buf)
    return norm(x, db(-3)), {"pan": -0.2, "dry": True, "reversed": True, "cycle_s": 3.0}


def make_inhale_rev():
    """One reversed breath: swells from nothing to a rough, catching peak and stops dead on the
    last sample. Built backwards: a mouth-and-teeth hiss that grows, a throat creak and 40 Hz
    roughness coming in near the top."""
    dur = 1.3
    n = secs(dur)
    t = tvec(n)
    k = t / dur
    hiss = formant_noise(n, [(320, 160, 0.25), (1150, 380, 0.55), (2650, 520, 1.0), (3900, 700, 0.8),
                             (6200, 2500, 0.45)])
    haa = formant_noise(n, [(640, 220, 1.0), (1180, 300, 0.75), (2450, 450, 0.4), (3500, 900, 0.15)],
                        tilt_db_oct=-2.0)
    x = norm(hiss, 1) * (1 - 0.5 * k) + norm(haa, 1) * (0.3 + 0.7 * k)
    cr = formant_noise(n, [(640, 200, 1.0), (1180, 300, 0.7), (2450, 450, 0.35)], src=creak(n, (45, 70), 0.2))
    x = x + 0.6 * norm(cr, 1) * np.clip((k - 0.55) / 0.45, 0, 1) ** 1.5
    x = x * np.clip(1 + 0.22 * lfo_noise(n, 3, 12), 0.4, 1.6)
    x = rough(x, 40.0, 0.35 * np.clip((k - 0.5) / 0.5, 0, 1))
    x = x * k ** 2.2
    x = proximity(x, 5.0, 200, 0.8)
    x = hp(x, 60, 2)
    return norm(x, db(-1)), {"pan": -0.2, "dry": True, "stops_dead": True}


# --- furniture, glass, machines ---------------------------------------------

def make_couch_creak():
    """A couch spring and cushion giving under a small weight, dry and close."""
    dur = 0.9
    n = secs(dur)
    t = tvec(n)
    buf = np.zeros(n + secs(0.5))
    cush = lp(rng.standard_normal(n), 900, 2)
    cush = cush * np.minimum(1, t / 0.06) * np.exp(-np.maximum(0, t - 0.08) / 0.18) * 0.5
    rustle = bp(rng.standard_normal(n), 1500, 6000, 2) * np.clip(lfo_noise(n, 8, 30), 0, None) * 0.12
    rustle = rustle * np.exp(-t / 0.3)
    place(buf, cush + rustle, 0.0)
    place(buf, impact(0.2, [120, 230], [0.04, 0.025], (300, 1200), 95, 0.03) * 0.6, 0.03)
    sp = stickslip(0.55, [16, 38, 46, 30, 20], [410, 760, 1190, 1730, 2480, 3350],
                   [0.06, 0.05, 0.04, 0.03, 0.02, 0.015])
    st = tvec(len(sp))
    sp = sp * np.minimum(1, st / 0.03) * np.minimum(1, (0.55 - st) / 0.1)
    place(buf, norm(sp, 0.8), 0.1)
    ring = resonators([520, 1340], [0.15, 0.08], [1, 0.4], 0.4) * 0.08
    place(buf, ring, 0.62)
    y = proximity(buf[:n], 3.0, 200, 0.8)
    y = hp(y, 50, 2)
    return norm(fade(y, 0.001, 0.08), db(-1)), {"dry": True}


def knock(vel=1.0):
    """A knuckle on a TV screen: a dull thock through the cabinet with a short glassy ring."""
    n = secs(0.35)
    body = impact(0.3, [190, 260, 410, 640], [0.03, 0.02, 0.012, 0.008], (700, 3500), 110, 0.02)
    exc = np.zeros(n)
    exc[:secs(0.002)] = rng.standard_normal(secs(0.002)) * np.hanning(secs(0.002))
    glass = fftconv(exc, resonators([1350, 2240, 3170, 4420], [0.03, 0.02, 0.012, 0.008],
                                    [1, 0.7, 0.5, 0.3], 0.2))[:n]
    return vel * (fit(body, n) + 0.25 * norm(glass, 1.0) * np.max(np.abs(body)))


def make_knocks():
    dur = 1.6
    n = secs(dur)
    buf = np.zeros(n + secs(0.5))
    place(buf, knock(1.0), 0.05)
    place(buf, knock(0.92), 0.65)
    y = reverb(buf[:n], 0.15, 0.05, tail=False)
    y = proximity(y, 2.5, 220, 0.8)
    return norm(fade(y, 0.0005, 0.1), db(-1)), {"knocks_at": [0.05, 0.65], "dry": True}


def make_rewind():
    """The VCR rewinding by itself: a clunk, the motor whine rising, tape hiss and squeal, the
    twins' own voices chattering backwards at x6, a soft clunk at the end, and PLAY engaging."""
    dur = 2.2
    n = secs(dur)
    buf = np.zeros(n + secs(1))
    place(buf, impact(0.3, [160, 420, 2300, 3600], [0.05, 0.035, 0.012, 0.008], (600, 5000), 90, 0.05), 0.0, 1.0)
    place(buf, impact(0.12, [1900, 3100, 4700], [0.012, 0.008, 0.005], (1500, 7000)), 0.06, 0.5)
    m0, m1 = 0.08, 1.78
    mn = secs(m1 - m0)
    tm = tvec(mn)
    f = np.interp(tm, [0, 1.4, m1 - m0], [400, 1150, 980])
    f = f * (1 + 0.012 * lfo_noise(mn, 6, 14) + 0.004 * np.sin(2 * np.pi * 23 * tm))
    whine = sine(f) + 0.35 * sine(2 * f) + 0.12 * sine(3.01 * f)
    hum = lp(blep_saw(f / 7.3), 900, 2) * 0.6
    spool = bp(rng.standard_normal(mn), 1500, 7000, 2) * 0.25 * np.clip(tm / 1.2, 0, 1)
    menv = np.minimum(1, tm / 0.08) * np.minimum(1, (m1 - m0 - tm) / 0.06) * (0.55 + 0.45 * np.clip(tm / 1.4, 0, 1))
    place(buf, (0.45 * whine + hum + spool) * menv, m0)
    tc = 0.25
    while tc < 1.65:
        L = rng.uniform(0.03, 0.08)
        f0, f1 = rng.uniform(2000, 4000), rng.uniform(2000, 4000)
        cf = np.geomspace(f0, f1, secs(L)) * (1 + 0.01 * np.sin(2 * np.pi * 70 * tvec(secs(L))))
        place(buf, sine(cf) * np.hanning(secs(L)) * rng.uniform(0.3, 0.55), tc)
        tc += rng.uniform(0.2, 0.4)
    lines = ["Hi, kids! I'm Bim!", "And this is your spot, right here on my side!"]
    chat = np.concatenate([reverse(voice_twin(s, {"pitches": (84, 80)}, 170, TWIN_SHIFT)) for s in lines])
    chat = resample(norm(chat, 1), 6.0)
    chat = bp(chat, 400, 7000, 2)
    cn = min(len(chat), secs(1.45))
    chat = fade(chat[:cn], 0.05, 0.1)
    place(buf, norm(chat, 1) * db(-17), 0.15)
    place(buf, impact(0.2, [200, 520, 2600], [0.04, 0.025, 0.01], (600, 4000), 90, 0.03), 1.78, 0.6)  # soft clunk
    place(buf, impact(0.06, [2600, 4100], [0.008, 0.005], (1500, 6000)), 1.98, 0.4)                    # PLAY
    pm = motor(0.2, [60, 120, 140], 6.1, 0.35)
    pm *= np.minimum(1, tvec(len(pm)) / 0.04)
    place(buf, pm, 2.0)
    y = buf[:n]
    y = np.tanh(1.2 * norm(y, 1)) / np.tanh(1.2)
    y = bp(y, 60, 9000, 2)
    return norm(fade(y, 0, 0.02), db(-1)), {"stop_clunk_at": 1.78, "play_at": 1.98}


def make_whisper_rev():
    """vo_whisper_fwd's take REVERSED, with a reverse-reverb pre-echo swelling ~0.5 s ahead of it
    and a ghost of that reverb under it: unintelligible until 12a plays the take forwards."""
    path = source_wav("vo_whisper_fwd")
    x = read_wav(path)
    r = reverse(x)
    lead = float(np.clip(2.4 - len(r) / SR, 0.3, 0.6))          # the swell, inside the 2.4 s slot
    swell, wet = swell_into(r, lead, t60=1.8, damp=3500, seed=13)
    pk = np.max(np.abs(r))
    g = 0.55 * pk / (np.max(np.abs(swell)) + 1e-12)              # one gain: the ghost is continuous
    body = r + g * fit(wet, len(r))
    out = np.concatenate([g * swell, body])
    out = norm(out, db(PRESET_PEAK["whisper"]))
    # pan split: the quietest 30 ms near the middle of the reversed words
    a0, a1 = secs(lead + 0.35 * len(r) / SR), secs(lead + 0.65 * len(r) / SR)
    m = moving_rms(out, 0.03)
    split = (a0 + int(np.argmin(m[a0:a1]))) / SR if a1 > a0 else len(out) / SR / 2
    meta = {"text": "Your turn to be the reflection.", "voice": "whisper", "reversed": True,
            "source": "build/audio/vo_whisper_fwd.wav", "source_crc": file_crc(path), "pre_echo_s": round(lead, 3),
            "pan": [[0.0, -1.0], [round(split, 3), 1.0]], "pan_split_s": round(split, 3),
            "haas_ms": 22, "haas_db": -8, "max_seconds": 2.4, "fits": bool(len(out) / SR <= 2.4 + 1e-6)}
    return out, meta


# ==========================================================================
# Registry, manifest and CLI
# ==========================================================================

GENERATORS = {
    "mus_ident_palindrome": make_ident,
    "mus_theme": make_theme,
    "mus_bumper": make_bumper,
    "mus_show_bed": make_show_bed,
    "mus_theme_wrong": make_theme_wrong,
    "amb_room_tone": make_room_tone,
    "amb_studio_night": make_studio_night,
    "amb_drone": make_drone,
    "amb_cluster": make_cluster,
    "amb_sub_breath": make_sub_breath,
    "amb_shepard_down": make_shepard_down,
    "sfx_vcr_insert": make_vcr_insert,
    "sfx_bars_tone_rev": make_bars_tone_rev,
    "sfx_static_burst": make_static_burst,
    "sfx_tracking_garble": make_tracking_garble,
    "sfx_boing": make_boing,
    "sfx_pop": make_pop,
    "sfx_laugh": make_laugh,
    "sfx_laugh_rev": make_laugh_rev,
    "sfx_kids_yay": make_kids_yay,
    "sfx_clock_rev": make_clock_rev,
    "sfx_steps_rev": make_steps_rev,
    "sfx_ratchet": make_ratchet,
    "sfx_cam_beep": make_cam_beep,
    "sfx_neg_click": make_neg_click,
    "sfx_light_step": make_light_step,
    "sfx_preverb_safe": make_preverb_safe,
    "sfx_stinger_1": make_stinger_1,
    "sfx_stinger_2": make_stinger_2,
    "sfx_scream_rev": make_scream_rev,
    "sfx_stinger_3": make_stinger_3,
    "sfx_breath_rev": make_breath_rev,
    "sfx_inhale_rev": make_inhale_rev,
    "sfx_couch_creak": make_couch_creak,
    "sfx_rewind": make_rewind,
    "sfx_knocks": make_knocks,
    "sfx_vcr_stop": make_vcr_stop,
    "vo_whisper_rev": make_whisper_rev,          # a voice stem cut from vo_whisper_fwd's take
}

# stems cut from another stem: re-rendered whenever their source changes
DEPENDS = {"sfx_preverb_safe": "vo_safe_1", "sfx_laugh_rev": "sfx_laugh", "vo_whisper_rev": "vo_whisper_fwd"}

# Recipe tags: a stem whose .meta.json does not carry its current tag is stale and is
# re-rendered by a plain run. Bump a tag whenever its generator changes.
RECIPE_DEFAULT = "od-1"
RECIPE = {}


def recipe(name):
    return RECIPE.get(name, RECIPE_DEFAULT)


def manifest_entry(name, asset):
    x = read_wav(wav_path(name))
    e = stats(x)
    e["kind"] = asset["kind"]
    e["target_seconds"] = asset.get("target_seconds")
    e["used_in"] = asset.get("used_in", [])
    meta = read_meta(name)
    meta.pop("recipe", None)
    e.update(meta)
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


def stale_reason(name, asset):
    """Why a stem must be (re-)rendered, or None if its .wav is current."""
    if not wav_ok(wav_path(name)):
        return "missing"
    meta = read_meta(name)
    if meta.get("recipe") != recipe(name):
        return "recipe changed"
    if asset["kind"] == "voice" and meta.get("text") != asset.get("text"):
        return "text changed"
    if asset["kind"] == "voice" and not os.path.exists(os.path.join(OUT, name + ".env.json")):
        return "no mouth envelope"
    src = DEPENDS.get(name)
    if src:
        try:
            if meta.get("source_crc") != file_crc(source_wav(src)):
                return f"{src} changed"
        except FileNotFoundError:
            return f"{src} missing"
    return None


def order_with_deps(todo, assets):
    """Pull in stale sources of dependents, append dependents of re-rendered sources,
    and render every source before the stems cut from it."""
    todo = list(dict.fromkeys(todo))
    for d, s in DEPENDS.items():
        if d in todo and s in assets and s not in todo and stale_reason(s, assets[s]):
            todo.insert(todo.index(d), s)
    for d, s in DEPENDS.items():
        if s in todo and d in assets and d not in todo:
            todo.append(d)
    for d, s in DEPENDS.items():
        if d in todo and s in todo and todo.index(d) < todo.index(s):
            todo.remove(d)
            todo.insert(todo.index(s) + 1, d)
    return todo


def render_stem(name, asset):
    global rng
    rng = np.random.default_rng(zlib.crc32(name.encode()))
    if name in GENERATORS:
        x, meta = GENERATORS[name]()
        if asset["kind"] == "voice":
            meta.update({"text": asset.get("text"), "voice": asset.get("voice")})
    else:
        opts = VOICE_OPTS.get(name, {})
        x, meta = make_voice(name, asset["voice"], asset["text"], opts, asset.get("target_seconds"))
    x = np.asarray(x, dtype=float)
    peak = np.max(np.abs(x))
    if peak > 0.98:
        x = x * (0.98 / peak)
    meta["recipe"] = recipe(name)
    write_wav(wav_path(name), x)
    env = meta.pop("vocals_env", None)
    if asset["kind"] == "voice":
        atomic_write_json(os.path.join(OUT, name + ".env.json"), envelope_json(x, len(x) / SR), indent=None)
    elif env is not None:
        atomic_write_json(os.path.join(OUT, name + ".env.json"), dict(env, note="vocal layer only"), indent=None)
    atomic_write_json(os.path.join(OUT, name + ".meta.json"), meta)
    return x


def report_line(name, a, x):
    s = stats(x)
    tgt = a.get("target_seconds")
    flag = ""
    if a["kind"] == "voice" and tgt and s["duration"] > tgt + 1e-6:
        flag = "  LONGER THAN SLOT"
    if s["peak"] > 0.98 + 1e-4:
        flag += "  PEAK > 0.98"
    extra = f" {rms_max(x):7.2f}" if name.startswith("sfx_stinger") or name.startswith("sfx_scream") else ""
    return (f"{name:24s} {a['kind']:8s} {s['duration']:7.3f} {tgt if tgt else 0:7.2f} {s['peak']:7.4f} "
            f"{s['peak_dbfs']:7.2f} {s['rms_dbfs']:7.2f}{extra}{flag}")


HEADER = f"{'stem':24s} {'kind':8s} {'dur':>7s} {'target':>7s} {'peak':>7s} {'pk dB':>7s} {'rms dB':>7s} (stingers: loudest 400 ms RMS dB)"


def main():
    global OUT
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*", help="stem names (re-rendered) or kinds: voice music ambience sfx")
    ap.add_argument("--force", action="store_true", help="re-render even if the .wav is current")
    ap.add_argument("--list", action="store_true", help="show which stems exist and which are stale")
    ap.add_argument("--report", action="store_true", help="print duration/peak/rms of every stem on disk")
    ap.add_argument("--out", metavar="DIR", help="render review copies into DIR (build/ and the manifest untouched)")
    args = ap.parse_args()
    if args.out:
        OUT = os.path.abspath(args.out)
    os.makedirs(OUT, exist_ok=True)
    assets = load_assets()
    missing_gen = [n for n, a in assets.items() if n not in GENERATORS and a["kind"] != "voice"]
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
            why = stale_reason(name, a)
            tag = "OK " if not why else ("-- " if why == "missing" else "OLD")
            print(f"{tag} {a['kind']:9s} {name:26s} {why or ''}")
        return
    if args.report:
        print(HEADER)
        for name, a in assets.items():
            if (kind_sel and a["kind"] not in kind_sel) or (explicit and name not in explicit):
                continue
            if wav_ok(wav_path(name)):
                print(report_line(name, a, read_wav(wav_path(name))))
            else:
                print(f"{name:24s} {a['kind']:8s} MISSING")
        return

    if explicit:
        todo = explicit
    else:
        todo = [n for n, a in assets.items() if not kind_sel or a["kind"] in kind_sel]
        if not args.force:
            todo = [n for n in todo if stale_reason(n, assets[n])]
    todo = order_with_deps(todo, assets)

    print(f"{len(todo)} stem(s) to render" + (f" into {OUT}" if args.out else ""))
    print(HEADER)
    for name in todo:
        a = assets[name]
        try:
            x = render_stem(name, a)
        except Exception as exc:                       # keep going; report at the end
            import traceback
            traceback.print_exc()
            print(f"{name:24s} FAILED: {exc!r}")
            continue
        print(report_line(name, a, x), flush=True)
        if not args.out:
            update_manifest(assets, [name])
    if args.out:
        return
    update_manifest(assets, list(assets))
    done = sum(wav_ok(wav_path(n)) for n in assets)
    stale = [n for n, a in assets.items() if stale_reason(n, a)]
    print(f"{done}/{len(assets)} stems present in {OUT}" + (f"; still stale: {stale}" if stale else ""))


if __name__ == "__main__":
    main()
