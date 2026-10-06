"""
NIGHT ADVISORY - an analog horror tape.

Builds horror/night_advisory.mp4 from the Blender stills in horror/build/
(make those first with render_scenes.py), plus generated title cards,
VHS damage, a text-to-speech announcer and synthesized sound.

Needs: numpy, Pillow, ffmpeg and espeak-ng.
    python horror/make_video.py
"""

import os
import subprocess
import tempfile
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
OUTPUT = os.path.join(HERE, "night_advisory.mp4")

W, H = 640, 480
FPS = 30
SR = 44100

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
MONO = os.path.join(FONT_DIR, "DejaVuSansMono-Bold.ttf")
SANS = os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf")

rng = np.random.default_rng(1987)
_fonts = {}


def font(path, size):
    key = (path, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


# --------------------------------------------------------------------------
# Audio helpers
# --------------------------------------------------------------------------

def secs(n):
    return int(round(n * SR))


def sine(freq, dur, phase_wobble=0.0, wobble_rate=0.5):
    t = np.arange(secs(dur)) / SR
    f = freq * (1 + phase_wobble * np.sin(2 * np.pi * wobble_rate * t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def saw(freq_curve):
    phase = np.cumsum(freq_curve) / SR
    return 2 * (phase % 1.0) - 1


def white(dur):
    return rng.standard_normal(secs(dur))


def snow(dur):
    """TV static: noise with a hard ceiling, so bursts never spike."""
    return rng.uniform(-1, 1, secs(dur))


def band(x, lo, hi):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(spec, len(x))


def fade(x, attack=0.01, release=0.01):
    x = x.copy()
    a, r = min(secs(attack), len(x) // 2), min(secs(release), len(x) // 2)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if r:
        x[-r:] *= np.linspace(1, 0, r)
    return x


def norm(x, peak=1.0):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def resample(x, factor):
    """Play back at `factor` speed (0.7 = slower and lower)."""
    n = int(len(x) / factor)
    return np.interp(np.arange(n) * factor, np.arange(len(x)), x)


def read_wav(path):
    with wave.open(path) as w:
        rate = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    x = data.astype(np.float32) / 32768
    return resample(x, rate / SR)


def speak(text, speed=140, pitch=28, slow=1.0):
    """Robotic announcer voice, squashed through a cheap TV speaker."""
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "v.wav")
        subprocess.run(["espeak-ng", "-v", "en-us", "-s", str(speed), "-p", str(pitch),
                        "-g", "6", "-w", path, text], check=True)
        x = read_wav(path)
    if slow != 1.0:
        x = resample(x, slow)
    x = band(x, 180, 3600)
    x = np.tanh(x * 2.5)
    return norm(fade(x, 0.005, 0.05), 0.9)


# --------------------------------------------------------------------------
# Picture helpers
# --------------------------------------------------------------------------

def load(name):
    img = Image.open(os.path.join(BUILD, name + ".png")).convert("RGB").resize((W, H))
    return np.asarray(img).astype(np.float32) / 255


def to_img(arr):
    return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))


def to_arr(img):
    return np.asarray(img).astype(np.float32) / 255


def text_center(draw, y, text, f, fill=(255, 255, 255), shadow=True):
    w = draw.textlength(text, font=f)
    x = (W - w) / 2
    if shadow:
        draw.text((x + 3, y + 3), text, font=f, fill=(0, 0, 0))
    draw.text((x, y), text, font=f, fill=fill)


def wrap(text, f, width, draw):
    lines, line = [], ""
    for word in text.split():
        test = (line + " " + word).strip()
        if draw.textlength(test, font=f) > width and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines


def zoom(arr, scale, cx=0.5, cy=0.5, dx=0.0, dy=0.0):
    """Crop toward (cx, cy) by `scale` and stretch back to full size."""
    if scale <= 1.0 and not dx and not dy:
        return arr
    img = to_img(arr)
    cw, ch = W / scale, H / scale
    x0 = np.clip(cx * W - cw / 2 + dx, 0, W - cw)
    y0 = np.clip(cy * H - ch / 2 + dy, 0, H - ch)
    img = img.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))
    return to_arr(img)


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
    return to_arr(img)


def hblur(x, k):
    """Horizontal box blur of width k."""
    c = np.cumsum(np.pad(x, ((0, 0), (k // 2 + 1, k // 2)), mode="edge"), axis=1)
    return (c[:, k:] - c[:, :-k]) / k


def vhs(arr, t, noise=0.06, jitter=1.0, chroma=4, tracking=0.0, lift=0.05, sat=0.8):
    """Make a clean frame look like a fifth-generation VHS dub."""
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    cb, cr = b - y, r - y

    # VHS has very little horizontal detail, and even less for color.
    k = 3
    y = (np.roll(y, -1, 1) + y + np.roll(y, 1, 1)) / k
    cb = hblur(cb, 15)
    cr = hblur(cr, 15)
    cb = np.roll(cb, chroma, 1)
    cr = np.roll(cr, chroma, 1)

    # Grain, plus streaky noise that runs along each scanline.
    y = y + rng.normal(0, noise, (H, W)).astype(np.float32)
    y = y + rng.normal(0, noise * 0.5, (H, 1)).astype(np.float32)
    streaks = rng.random((H, W)) > 0.9995 - noise * 0.004
    y = np.where(np.roll(streaks, 1, 1) | streaks, 0.9, y)

    out = np.stack([y + cr, y - 0.194 * cb - 0.509 * cr, y + cb], -1) * sat + y[..., None] * (1 - sat)

    # Wobbly lines: each row slides sideways a little.
    offs = np.round(rng.normal(0, 0.6 * jitter, H) + 1.5 * jitter * np.sin(t * 7 + np.arange(H) / 40))
    offs[-10:] += rng.integers(8, 30)  # head-switching noise at the bottom
    if tracking > 0:
        center = (t * 220) % (H + 120) - 60
        rows = np.arange(H)
        in_band = np.abs(rows - center) < 20 * tracking + 4
        offs[in_band] += rng.integers(5, 40, in_band.sum())
        out[in_band] = out[in_band] * 0.5 + rng.random((in_band.sum(), W, 1)) * 0.6 * tracking
    idx = (np.arange(W)[None, :] - offs[:, None].astype(int)) % W
    out = np.take_along_axis(out, idx[..., None].repeat(3, -1), 1)

    out[1::2] *= 0.86  # scanlines
    out = out * VIGNETTE[..., None]
    out = lift + out * (1 - lift)
    return np.clip(out, 0, 1)


yy, xx = np.mgrid[0:H, 0:W]
VIGNETTE = (1 - 0.45 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) ** 1.5).astype(np.float32)
VIGNETTE = np.clip(VIGNETTE, 0.2, 1)


def static(level=1.0):
    snow = rng.random((H, W)).astype(np.float32)
    snow = snow * (0.6 + 0.4 * rng.random((H, 1)))
    return np.repeat(snow[..., None], 3, -1) * level


# --------------------------------------------------------------------------
# The tape
# --------------------------------------------------------------------------

class Tape:
    def __init__(self):
        self.shots = []          # (start, dur, draw_fn)
        self.audio = np.zeros(secs(200), dtype=np.float32)
        self.t = 0.0

    def shot(self, dur, fn):
        self.shots.append((self.t, dur, fn))
        self.t += dur
        return self.t - dur

    def sound(self, at, x, gain=1.0):
        start = secs(at)
        end = start + len(x)
        if end > len(self.audio):
            self.audio = np.concatenate([self.audio, np.zeros(end - len(self.audio), np.float32)])
        self.audio[start:end] += (x * gain).astype(np.float32)

    def frame(self, i):
        t = i / FPS
        for start, dur, fn in self.shots:
            if start <= t < start + dur:
                return fn(t - start, dur, t)
        return np.zeros((H, W, 3), np.float32)


def osd(img, t, text, blink=False):
    """VCR on-screen display, drawn over the picture."""
    if blink and int(t * 2) % 2:
        return img
    pil = to_img(img)
    d = ImageDraw.Draw(pil)
    f = font(MONO, 30)
    d.text((42, 34), text, font=f, fill=(0, 0, 0))
    d.text((40, 32), text, font=f, fill=(235, 235, 235))
    return to_arr(pil)


def card(lines, top=None, header=None, header_color=(170, 0, 0), bg=(0, 0, 0),
         size=30, reveal=1.0, crawl=None, crawl_x=0.0, corrupt=0.0):
    """Text card: optional header bar, wrapped body text, optional crawl."""
    pil = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(pil)
    if header:
        d.rectangle([0, 40, W, 100], fill=header_color)
        text_center(d, 52, header, font(SANS, 34))
    f = font(SANS, size)
    body = []
    for line in lines:
        body += wrap(line, f, W - 90, d) + [""]
    body = body[:-1]
    total = sum(len(s) for s in body)
    budget = int(total * reveal)
    y = top if top is not None else (H - len(body) * (size + 12)) / 2
    for line in body:
        shown = line[:max(0, budget)]
        budget -= len(line)
        if corrupt:
            shown = "".join(
                c if rng.random() > corrupt or c == " " else chr(rng.integers(33, 126))
                for c in shown)
        text_center(d, y, shown, f)
        y += size + 12
    if crawl:
        d.rectangle([0, H - 70, W, H - 30], fill=(20, 20, 20))
        cf = font(SANS, 24)
        x = W - crawl_x
        d.text((x, H - 63), crawl, font=cf, fill=(255, 220, 0))
    return to_arr(pil)


def build():
    tape = Tape()
    hall = {n: load(n) for n in
            ("hall_empty", "hall_far", "hall_mid", "hall_peek", "hall_close", "hall_dark", "face")}
    bars = color_bars()

    # ---- voice lines (made first so shots can be timed to them) ----
    v = {
        "signoff": speak("This concludes our broadcast day. Thank you for watching. "
                         "Good night, Hollow Creek."),
        "a1": speak("A night advisory is in effect for Hollow Creek until sunrise."),
        "a2": speak("Remain indoors. Lock all doors. Turn off all lights."),
        "a3": speak("If you hear a family member calling your name from outside, "
                    "do not answer. Your family is inside."),
        "a4": speak("Count the people in your home. Now count again."),
        "a5": speak("If the second number is higher, do not let it know that you noticed."),
        "a6": speak("It is taller than your doorways. It will have to duck.", pitch=20),
        "counted": speak("We counted. There is one more of you than there should be.",
                         speed=130, pitch=8, slow=0.8),
        "turn": speak("Do not turn around.", speed=110, pitch=0, slow=0.68),
        "end": speak("The night advisory has ended. Please stay where you are. "
                     "Someone will be by to count you.", pitch=30),
    }

    def vlen(key, pad=0.9):
        return len(v[key]) / SR + pad

    hiss_level = 0.012

    # ---- 1. VCR blue screen ----
    blue = np.zeros((H, W, 3), np.float32)
    blue[..., 2] = 0.75
    blue[..., :2] = 0.08

    def play_screen(lt, dur, t):
        img = blue if lt < 1.6 else vhs(blue * 0.3 + static(0.5), t, noise=0.1, tracking=1.0)
        return osd(img, t, "PLAY ▶")

    s = tape.shot(3.0, play_screen)
    tape.sound(s + 0.05, fade(band(white(0.08), 200, 3000), 0.001, 0.05), 0.4)  # mechanism click
    tape.sound(s + 1.6, fade(band(white(1.4), 300, 9000), 0.05, 0.2), 0.12)

    # ---- 2. Color bars + tone ----
    def bars_shot(lt, dur, t):
        pil = to_img(bars)
        d = ImageDraw.Draw(pil)
        d.rectangle([110, 300, W - 110, 352], fill=(0, 0, 0))
        text_center(d, 310, "HOLLOW CREEK COMMUNITY TV  13", font(MONO, 24), shadow=False)
        img = vhs(to_arr(pil), t, noise=0.04, tracking=max(0, 1 - lt * 2))
        return osd(img, t, "PLAY ▶") if lt < 2 else img

    s = tape.shot(6.5, bars_shot)
    tape.sound(s + 0.3, fade(sine(1000, 6.0), 0.02, 0.02), 0.22)

    # ---- 3. Friendly sign-off card with music ----
    def signoff_card():
        pil = Image.new("RGB", (W, H))
        d = ImageDraw.Draw(pil)
        for yline in range(H):
            c = int(20 + 60 * yline / H)
            d.line([(0, yline), (W, yline)], fill=(c // 3, c // 2, c + 40))
        d.ellipse([W / 2 - 70, 70, W / 2 + 70, 210], outline=(255, 210, 90), width=8)
        text_center(d, 98, "13", font(SANS, 72), fill=(255, 210, 90))
        text_center(d, 245, "HOLLOW CREEK", font(SANS, 40))
        text_center(d, 300, "COMMUNITY TELEVISION", font(SANS, 24), fill=(200, 210, 255))
        text_center(d, 370, "GOOD NIGHT", font(SANS, 30), fill=(255, 255, 255))
        return to_arr(pil)

    signoff_img = signoff_card()

    def signoff(lt, dur, t):
        return vhs(signoff_img, t, noise=0.05)

    dur = max(8.5, vlen("signoff", 1.8))
    s = tape.shot(dur, signoff)
    tape.sound(s + 1.0, v["signoff"], 0.55)
    # A warbly music-box lullaby.
    notes = [659, 784, 988, 880, 784, 659, 587, 659, 523, 587, 494, 659]
    for i, f in enumerate(notes):
        n = sine(f, 1.1, phase_wobble=0.006) * np.exp(-np.linspace(0, 5, secs(1.1)))
        tape.sound(s + 0.2 + i * 0.7, fade(n, 0.005, 0.1), 0.12)
    tape.sound(s, fade(sine(165, dur, 0.004) + 0.5 * sine(247, dur, 0.004), 1.0, 0.3), 0.04)

    # ---- 4. Signal cut ----
    def burst(lt, dur, t):
        return vhs(static(1.0), t, noise=0.2, tracking=1.0)

    s = tape.shot(0.7, burst)
    tape.sound(s, fade(snow(0.7), 0.001, 0.02), 0.3)

    def black(lt, dur, t):
        return vhs(np.zeros((H, W, 3), np.float32), t, noise=0.03)

    tape.shot(1.8, black)

    def standby(lt, dur, t):
        return vhs(card(["PLEASE STAND BY"], size=34, reveal=min(1, lt * 1.5)), t, noise=0.05)

    tape.shot(2.5, standby)

    # ---- 5. The advisory ----
    crawl = ("REMAIN INDOORS • DO NOT ANSWER THE DOOR • DO NOT ANSWER YOUR NAME "
             "• COUNT AGAIN • DO NOT LOOK AT IT • ") * 3
    alert_start = tape.t
    lines = [("A NIGHT ADVISORY IS IN EFFECT FOR HOLLOW CREEK UNTIL SUNRISE.", "a1"),
             ("REMAIN INDOORS. LOCK ALL DOORS. TURN OFF ALL LIGHTS.", "a2"),
             ("IF YOU HEAR A FAMILY MEMBER CALLING YOUR NAME FROM OUTSIDE, DO NOT ANSWER. "
              "YOUR FAMILY IS INSIDE.", "a3"),
             ("COUNT THE PEOPLE IN YOUR HOME.  NOW COUNT AGAIN.", "a4"),
             ("IF THE SECOND NUMBER IS HIGHER, DO NOT LET IT KNOW THAT YOU NOTICED.", "a5"),
             ("IT IS TALLER THAN YOUR DOORWAYS. IT WILL HAVE TO DUCK.", "a6")]

    def advisory_tone(lt, dur, t):
        on = (lt % 1.1) < 0.8
        img = card(["ATTENTION"] if on else [""], header="⚠ NIGHT ADVISORY ⚠",
                   size=44, crawl=crawl, crawl_x=(t - alert_start) * 90)
        return vhs(img, t, noise=0.05)

    s = tape.shot(3.3, advisory_tone)
    for k in range(3):
        beep = sine(523, 0.8) + sine(554, 0.8) + 0.4 * np.sign(sine(277, 0.8))
        tape.sound(s + k * 1.1, fade(beep, 0.01, 0.02), 0.13)

    def advisory_line(text, key):
        def draw(lt, dur, t):
            reveal = min(1.0, lt / max(0.5, len(v[key]) / SR * 0.8))
            img = card([text], header="⚠ NIGHT ADVISORY ⚠", size=30, reveal=reveal,
                       crawl=crawl, crawl_x=(t - alert_start) * 90)
            return vhs(img, t, noise=0.05)
        return draw

    for text, key in lines:
        s = tape.shot(vlen(key, 1.1), advisory_line(text, key))
        tape.sound(s + 0.3, v[key], 0.55)
    advisory_end = tape.t
    # Low hum under the whole advisory.
    tape.sound(alert_start, fade(sine(60, advisory_end - alert_start) * 0.6
                                 + sine(120, advisory_end - alert_start) * 0.3, 0.5, 0.05), 0.05)

    # ---- 6. "Live" footage of a hallway. Your hallway. ----
    tape.sound(tape.t, fade(snow(0.4), 0.001, 0.05), 0.28)

    cam_start = tape.t

    def cam(name, push=1.0, cx=0.5, cy=0.5, flicker=0.0, tracking=0.0, gain=1.15):
        def draw(lt, dur, t):
            img = hall[name]
            if flicker and rng.random() < flicker:
                img = img * rng.uniform(0.15, 0.5)
            img = zoom(img, 1 + (push - 1) * lt / dur, cx, cy)
            img = vhs(img * gain, t, noise=0.07, tracking=tracking, sat=0.6)
            pil = to_img(img)
            d = ImageDraw.Draw(pil)
            f = font(MONO, 22)
            stamp = 2 * 3600 + 31 * 60 + 7 + (t - cam_start)
            hh, mm, ss = int(stamp // 3600), int(stamp % 3600 // 60), int(stamp % 60)
            d.text((30, 26), "CAM 2", font=f, fill=(240, 240, 240))
            if int(t * 2) % 2:
                d.ellipse([W - 130, 30, W - 114, 46], fill=(220, 0, 0))
            d.text((W - 105, 26), "LIVE", font=f, fill=(240, 240, 240))
            d.text((30, H - 52), f"OCT 14 1987  {hh:02d}:{mm:02d}:{ss:02d} AM",
                   font=f, fill=(240, 240, 240))
            return to_arr(pil)
        return draw

    def snap(dur=0.25, gain=0.28):
        s = tape.shot(dur, burst)
        tape.sound(s, fade(snow(dur), 0.001, 0.01), gain)

    def subliminal(text):
        def draw(lt, dur, t):
            return vhs(card([text], size=56), t, noise=0.1)
        tape.shot(2 / FPS, draw)

    tape.shot(4.0, cam("hall_empty", push=1.04, flicker=0.03))
    tape.shot(3.5, cam("hall_far", push=1.08, flicker=0.03))
    subliminal("COUNT AGAIN")
    snap()
    tape.shot(3.0, cam("hall_mid", push=1.12, cy=0.42, flicker=0.05))
    snap()
    tape.shot(2.2, cam("hall_empty", push=1.02))
    tape.shot(3.8, cam("hall_peek", push=1.9, cx=0.27, cy=0.4, flicker=0.04))
    snap(0.15, 0.35)
    subliminal("IT SEES YOU")
    tape.shot(2.6, cam("hall_close", push=1.15, cy=0.3, flicker=0.15, tracking=0.4))
    tape.shot(2.4, cam("hall_dark", push=1.1, flicker=0.1, tracking=0.6, gain=4.0))
    cam_end = tape.t

    # Drone under the footage that swells toward the end.
    n = cam_end - cam_start
    tt = np.linspace(0, 1, secs(n))
    drone = (sine(41, n, 0.01, 0.2) + sine(43.7, n, 0.01, 0.13) + 0.6 * sine(55, n)
             + 0.5 * band(white(n), 60, 400))
    tape.sound(cam_start, fade(drone * (0.3 + 1.4 * tt ** 2), 1.5, 0.01), 0.1)
    # Slow heartbeat-like thumps in the last stretch.
    for k in range(7):
        at = cam_end - 6.0 + k * 0.85
        thump = sine(48, 0.25) * np.exp(-np.linspace(0, 8, secs(0.25)))
        tape.sound(at, thump, 0.35)

    # ---- 7. The card comes back wrong ----
    def counted(lt, dur, t):
        img = card(["WE COUNTED.", "THERE IS ONE MORE OF YOU THAN THERE SHOULD BE."],
                   header="⚠ NIGHT ADVISORY ⚠", header_color=(90, 0, 0),
                   bg=(25, 0, 0), size=32, reveal=min(1, lt / 3.0), corrupt=0.04)
        return vhs(img, t, noise=0.09, chroma=7, jitter=2.0, tracking=0.3 * (lt % 2 < 0.3))

    s = tape.shot(vlen("counted", 1.5), counted)
    tape.sound(s + 0.4, v["counted"], 0.7)
    tape.sound(s + 0.4, resample(v["counted"][::-1], 0.8)[:len(v["counted"])], 0.08)

    def turn(lt, dur, t):
        img = card(["DO NOT TURN AROUND"], size=int(40 + 10 * lt / dur))
        return vhs(img, t, noise=0.06, jitter=0.5 + 2 * (lt / dur))

    s = tape.shot(vlen("turn", 1.0), turn)
    tape.sound(s + 0.2, v["turn"], 0.75)

    # Dead air. Just hiss. Long enough to make you lean in.
    tape.shot(2.6, black)
    quiet_start = tape.t - 2.6

    # ---- 8. Face ----
    face = hall["face"]

    def scare(lt, dur, t):
        k = lt / dur
        img = zoom(face * 1.6, 1.0 + 0.3 * k, 0.53, 0.5,
                   dx=rng.normal(0, 14), dy=rng.normal(0, 14))
        img[..., 0] = np.clip(img[..., 0] * 1.4, 0, 1)
        if rng.random() < 0.25:
            img = 1 - img
        return vhs(img, t, noise=0.15, chroma=10, jitter=4.0, sat=1.0, tracking=0.8)

    s = tape.shot(0.75, scare)
    n = 0.85
    tt = np.linspace(0, 1, secs(n))
    scream = sum(saw(np.full(secs(n), f) * (1 + 0.6 * tt) * (1 + 0.03 * np.sin(2 * np.pi * 9 * tt * n)))
                 for f in (310, 333, 466, 497, 702))
    scream = np.tanh(3 * (scream / 5 + 0.8 * band(white(n), 900, 5000)))
    boom = sine(70, n) * np.exp(-np.linspace(0, 4, secs(n)))
    tape.sound(s, norm(fade(scream * 0.75 + boom, 0.003, 0.05)), 0.97)

    tape.shot(1.6, lambda lt, dur, t: np.zeros((H, W, 3), np.float32))
    silent_until = tape.t

    # ---- 9. Ending ----
    def ending(lt, dur, t):
        img = card(["THE NIGHT ADVISORY HAS ENDED.", "PLEASE STAY WHERE YOU ARE.",
                    "SOMEONE WILL BE BY TO COUNT YOU."],
                   size=28, reveal=min(1, lt / (dur * 0.7)))
        return vhs(img, t, noise=0.05)

    s = tape.shot(vlen("end", 2.5), ending)
    tape.sound(s + 0.5, v["end"], 0.5)

    def outro_static(lt, dur, t):
        if 0.9 < lt < 0.9 + 2 / FPS:
            return vhs(zoom(face * 1.4, 1.1, 0.53, 0.5), t, noise=0.3)
        return vhs(static(0.9), t, noise=0.2, tracking=1.0)

    s = tape.shot(2.2, outro_static)
    tape.sound(s, fade(snow(2.2), 0.01, 0.4), 0.25)

    def stop_screen(lt, dur, t):
        return osd(blue, t, "STOP ■")

    s = tape.shot(2.5, stop_screen)
    tape.sound(s, fade(band(white(0.08), 200, 3000), 0.001, 0.05), 0.4)

    # Tape hiss over everything, except the dead air and the moment after the
    # scare, which drop to almost nothing.
    total = tape.t
    hiss = band(white(total), 2000, 12000)
    level = np.full(len(hiss), hiss_level, np.float32)
    level[secs(quiet_start):secs(quiet_start + 2.6)] = hiss_level * 0.25
    level[secs(silent_until - 1.6):secs(silent_until)] = 0.0
    tape.sound(0, hiss * level)
    tape.audio = tape.audio[:secs(total)]
    return tape


def main():
    tape = build()
    total = tape.t
    audio = tape.audio / max(1.0, np.max(np.abs(tape.audio)) / 0.97)
    print(f"Tape length: {total:.1f}s, audio peak {np.max(np.abs(audio)):.2f}")

    with tempfile.TemporaryDirectory() as tmp:
        wav_path = os.path.join(tmp, "audio.wav")
        with wave.open(wav_path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((audio * 32767).astype(np.int16).tobytes())

        ff = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
             "-i", wav_path,
             "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUTPUT],
            stdin=subprocess.PIPE)
        frames = int(total * FPS)
        for i in range(frames):
            img = tape.frame(i)
            ff.stdin.write((np.clip(img, 0, 1) * 255).astype(np.uint8).tobytes())
            if i % (FPS * 10) == 0:
                print(f"  {i / FPS:5.1f}s / {total:.1f}s")
        ff.stdin.close()
        ff.wait()
    print("Wrote", OUTPUT)


if __name__ == "__main__":
    main()
