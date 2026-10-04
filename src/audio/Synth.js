// Offline procedural sound synthesis into Float32Arrays (mono). No audio files.
import { Rng } from '../core/Rng.js';

export const SR = 44100;
const rng = new Rng(777);
const r = () => rng.next() * 2 - 1;

function buf(sec) { return new Float32Array(Math.max(1, Math.floor(sec * SR))); }

// Biquad (RBJ) applied in place.
export function biquad(x, type, freq, q = 0.707, gainDb = 0) {
  const w0 = 2 * Math.PI * Math.min(freq, SR * 0.45) / SR;
  const cs = Math.cos(w0), sn = Math.sin(w0), alpha = sn / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  const A = Math.pow(10, gainDb / 40);
  switch (type) {
    case 'lp': b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
    case 'hp': b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
    case 'bp': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
    case 'peak': b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A; break;
    default: return x;
  }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

// Time-varying one-pole lowpass with cutoff function f(t)
function sweepLP(x, fn) {
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    const fc = fn(i / SR);
    const a = 1 - Math.exp(-2 * Math.PI * fc / SR);
    y += a * (x[i] - y);
    x[i] = y;
  }
  return x;
}

function env(x, a, d, sustain = 0, curve = 1) {
  const n = x.length, an = Math.max(1, a * SR);
  for (let i = 0; i < n; i++) {
    const t = i;
    let e;
    if (t < an) e = t / an;
    else e = sustain + (1 - sustain) * Math.exp(-(t - an) / (d * SR));
    x[i] *= Math.pow(e, curve);
  }
  return x;
}

function normalize(x, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
}

function fadeEdges(x, sec = 0.005) {
  const n = Math.min(x.length / 2, sec * SR);
  for (let i = 0; i < n; i++) { const g = i / n; x[i] *= g; x[x.length - 1 - i] *= g; }
  return x;
}

function mixInto(dst, src, offset = 0, gain = 1) {
  const o = Math.floor(offset * SR);
  for (let i = 0; i < src.length && i + o < dst.length; i++) if (i + o >= 0) dst[i + o] += src[i] * gain;
  return dst;
}

function white(sec) { const x = buf(sec); for (let i = 0; i < x.length; i++) x[i] = r(); return x; }
function brown(sec) { const x = buf(sec); let v = 0; for (let i = 0; i < x.length; i++) { v = (v + 0.02 * r()) / 1.02; x[i] = v * 3.5; } return x; }
function pink(sec) {
  const x = buf(sec); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < x.length; i++) {
    const w = r();
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return x;
}
function sine(sec, f, phase = 0) { const x = buf(sec); for (let i = 0; i < x.length; i++) x[i] = Math.sin(2 * Math.PI * f * i / SR + phase); return x; }

// Loopable: crossfade tail into head.
function loopify(x, fadeSec = 0.3) {
  const n = Math.floor(fadeSec * SR);
  const out = new Float32Array(x.length - n);
  for (let i = 0; i < out.length; i++) out[i] = x[i];
  for (let i = 0; i < n; i++) { const t = i / n; out[i] = x[i] * t + x[out.length + i] * (1 - t); }
  return out;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------
const SURF = {
  tile: { f: 2400, q: 1.2, thump: 120, dec: 0.05, bright: 0.8 },
  concrete: { f: 1500, q: 0.9, thump: 90, dec: 0.06, bright: 0.6 },
  wood: { f: 900, q: 1.5, thump: 140, dec: 0.08, bright: 0.5, res: 210 },
  carpet: { f: 600, q: 0.6, thump: 80, dec: 0.04, bright: 0.15 },
  metal: { f: 3200, q: 3, thump: 100, dec: 0.12, bright: 0.9, ring: [420, 1130, 2370] },
  grate: { f: 2800, q: 4, thump: 90, dec: 0.15, bright: 1.0, ring: [610, 1520, 3100] },
  gravel: { f: 3500, q: 0.5, thump: 70, dec: 0.12, bright: 0.9, crunch: true },
  water: { f: 1200, q: 0.8, thump: 70, dec: 0.18, bright: 0.7, splash: true },
};

export function footstep(surface, v = 0, heavy = 1) {
  const s = SURF[surface] || SURF.concrete;
  const len = s.dec * 4 + 0.08;
  const x = buf(len);
  // heel + toe transients
  for (const [off, g] of [[0, 1], [0.03 + v * 0.007, 0.6]]) {
    const n = white(s.dec * 2);
    biquad(n, 'bp', s.f * (0.85 + 0.3 * rng.next()), s.q);
    env(n, 0.001, s.dec * 0.5, 0, 1.2);
    mixInto(x, n, off, g * s.bright);
  }
  // low thump
  const th = buf(0.12);
  for (let i = 0; i < th.length; i++) { const t = i / SR; th[i] = Math.sin(2 * Math.PI * s.thump * t * (1 - t * 2)) * Math.exp(-t / 0.025); }
  mixInto(x, th, 0, 0.9 * heavy);
  if (s.ring) for (const f of s.ring) { const ring = sine(0.25, f * (0.97 + rng.next() * 0.06)); env(ring, 0.001, 0.05 + rng.next() * 0.05); mixInto(x, ring, 0.002, 0.12); }
  if (s.res) { const rr = sine(0.15, s.res); env(rr, 0.002, 0.03); mixInto(x, rr, 0, 0.3); }
  if (s.crunch) { for (let k = 0; k < 14; k++) { const g = white(0.012); biquad(g, 'hp', 2500); env(g, 0.0005, 0.003); mixInto(x, g, rng.next() * 0.1, 0.25 + rng.next() * 0.3); } }
  if (s.splash) { const sp = white(0.3); biquad(sp, 'bp', 900 + rng.next() * 600, 0.7); env(sp, 0.01, 0.07); mixInto(x, sp, 0.01, 0.9); }
  return fadeEdges(normalize(x, 0.8));
}

function creak(sec, f0, rough = 0.6, seed = 0) {
  // Stick-slip friction: impulse train with jittery rate through resonant bandpasses.
  const x = buf(sec);
  let phase = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const f = f0 * (1 + 0.35 * Math.sin(t * 3.1 + seed) + 0.2 * Math.sin(t * 11.3 + seed * 2)) * (1 + rough * 0.1 * r());
    phase += f / SR;
    if (phase >= 1) { phase -= 1; x[i] = 1; }
  }
  const a = x.slice(), b = x.slice();
  biquad(a, 'bp', 700, 8); biquad(b, 'bp', 1650, 10);
  for (let i = 0; i < x.length; i++) x[i] = a[i] + b[i] * 0.7;
  const e = buf(sec);
  for (let i = 0; i < e.length; i++) { const t = i / e.length; e[i] = Math.sin(Math.PI * t) * (0.6 + 0.4 * Math.sin(t * 17 + seed)); }
  for (let i = 0; i < x.length; i++) x[i] *= e[i];
  return normalize(x, 0.7);
}

function thud(sec = 0.4, f = 70, noiseAmt = 0.6) {
  const x = buf(sec);
  for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(2 * Math.PI * f * t * (1 - t)) * Math.exp(-t / 0.06); }
  const n = white(sec); biquad(n, 'lp', 900); env(n, 0.001, 0.04); mixInto(x, n, 0, noiseAmt);
  return normalize(x, 0.9);
}

function click(f = 3000, dec = 0.004, g = 1) { const x = white(0.03); biquad(x, 'bp', f, 2); env(x, 0.0003, dec); return normalize(x, 0.8 * g); }

function metalRing(sec, freqs, dec) {
  const x = buf(sec);
  for (const f of freqs) { const s = sine(sec, f * (0.98 + rng.next() * 0.04)); env(s, 0.001, dec * (0.5 + rng.next())); mixInto(x, s, 0, 1 / freqs.length); }
  return x;
}

function pianoNote(freq, sec = 3.2) {
  const x = buf(sec);
  for (let h = 1; h <= 9; h++) {
    const f = freq * h * (1 + 0.0004 * h * h);
    const a = 1 / Math.pow(h, 1.25);
    const dec = 1.6 / Math.pow(h, 0.6);
    for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] += a * Math.sin(2 * Math.PI * f * t + h) * Math.exp(-t / dec); }
  }
  const hammer = white(0.03); biquad(hammer, 'bp', freq * 4, 1); env(hammer, 0.0005, 0.008); mixInto(x, hammer, 0, 0.3);
  env(x, 0.002, 10, 1);
  return fadeEdges(normalize(x, 0.7), 0.05);
}

function musicBoxNote(freq) {
  const x = buf(1.6);
  for (const [m, a, d] of [[1, 1, 0.6], [2.76, 0.4, 0.25], [5.4, 0.25, 0.1], [8.9, 0.1, 0.05]]) {
    for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] += a * Math.sin(2 * Math.PI * freq * 2 * m * t) * Math.exp(-t / d); }
  }
  mixInto(x, click(6000, 0.002, 0.3), 0, 0.3);
  return fadeEdges(normalize(x, 0.6), 0.04);
}

function phoneRing() {
  const sec = 2.0;
  const x = buf(sec);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const on = t < 1.6 ? 1 : 0;
    const strike = Math.sin(2 * Math.PI * 20 * t) > 0 ? 1 : -1;
    x[i] = on * (Math.sin(2 * Math.PI * 1030 * t) * 0.6 + Math.sin(2 * Math.PI * 1580 * t) * 0.4 + Math.sin(2 * Math.PI * 2590 * t) * 0.2) * (0.6 + 0.4 * strike);
  }
  biquad(x, 'peak', 1200, 1, 6);
  return fadeEdges(normalize(x, 0.6), 0.02);
}

function alarmBell() {
  const sec = 1.0;
  const x = buf(sec);
  for (let k = 0; k < 20; k++) mixInto(x, metalRing(0.2, [1300, 2900, 4100, 5800], 0.15), k * 0.05, 0.4);
  return normalize(loopify(x, 0.02), 0.6);
}

function steam(sec, burst = false) {
  const x = white(sec);
  biquad(x, 'hp', burst ? 1200 : 2500); biquad(x, 'lp', 9000);
  if (burst) env(x, 0.02, sec * 0.35); else fadeEdges(x, 0.2);
  return normalize(x, 0.7);
}

function steamWhistle(sec = 3) {
  const x = buf(sec);
  for (let i = 0; i < x.length; i++) { const t = i / SR; const f = 780 + 30 * Math.sin(t * 4); x[i] = Math.sin(2 * Math.PI * f * t) * 0.5 + Math.sin(2 * Math.PI * f * 2.01 * t) * 0.2; }
  const n = white(sec); biquad(n, 'bp', 800, 6); mixInto(x, n, 0, 0.6);
  return normalize(loopify(x, 0.1), 0.7);
}

function boilerRoar() {
  const x = brown(6);
  biquad(x, 'lp', 260);
  const rum = pink(6); biquad(rum, 'bp', 90, 0.8);
  mixInto(x, rum, 0, 0.8);
  for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= 0.8 + 0.2 * Math.sin(t * 2 * Math.PI * 7.5) * Math.sin(t * 0.7); }
  return normalize(loopify(x, 0.5), 0.8);
}

function hum(f0 = 50, sec = 4, buzz = 0.4) {
  const x = buf(sec);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    x[i] = Math.sin(2 * Math.PI * f0 * 2 * t) * 0.5 + Math.sin(2 * Math.PI * f0 * 4 * t) * 0.18 + Math.sin(2 * Math.PI * f0 * 6 * t) * 0.08 * buzz;
  }
  const n = white(sec); biquad(n, 'bp', 4000, 1.5); for (let i = 0; i < n.length; i++) n[i] *= 0.5 + 0.5 * Math.sin(2 * Math.PI * f0 * 2 * i / SR);
  mixInto(x, n, 0, 0.12 * buzz);
  return normalize(x, 0.5);
}

function roomTone(lp = 400, sec = 6, hiss = 0.04) {
  const x = brown(sec); biquad(x, 'lp', lp);
  const h = white(sec); biquad(h, 'hp', 6000); mixInto(x, h, 0, hiss);
  return normalize(loopify(x, 0.5), 0.5);
}

function rainLoop() {
  const sec = 6;
  const x = pink(sec); biquad(x, 'lp', 5000); biquad(x, 'hp', 300);
  for (let k = 0; k < 900; k++) { const d = white(0.01); biquad(d, 'bp', 2000 + rng.next() * 5000, 2); env(d, 0.0003, 0.002); mixInto(x, d, rng.next() * sec, 0.4 + rng.next()); }
  return normalize(loopify(x, 0.4), 0.6);
}

function windLoop() {
  const sec = 8;
  const x = white(sec);
  sweepLP(x, (t) => 300 + 250 * Math.sin(t * 0.8) + 180 * Math.sin(t * 2.1));
  biquad(x, 'hp', 80);
  return normalize(loopify(x, 1.0), 0.6);
}

function dripLoop() {
  const sec = 7;
  const x = buf(sec);
  let t = 0.2;
  while (t < sec - 0.3) {
    const f = 900 + rng.next() * 1500;
    const d = buf(0.12);
    for (let i = 0; i < d.length; i++) { const tt = i / SR; d[i] = Math.sin(2 * Math.PI * (f + 3000 * tt) * tt) * Math.exp(-tt / 0.02); }
    mixInto(x, d, t, 0.3 + rng.next() * 0.5);
    t += 0.4 + rng.next() * 1.6;
  }
  return normalize(x, 0.6);
}

function tinnitus() { const x = sine(4, 9800); const y = sine(4, 9850); mixInto(x, y, 0, 0.6); return normalize(x, 0.3); }

function heartbeat() {
  const x = buf(0.9);
  for (const [o, g] of [[0, 1], [0.18, 0.7]]) {
    const b = buf(0.2);
    for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = Math.sin(2 * Math.PI * (55 - 60 * t) * t) * Math.exp(-t / 0.04); }
    mixInto(x, b, o, g);
  }
  biquad(x, 'lp', 140);
  return normalize(x, 0.9);
}

function breath(inhale, intensity = 0.5) {
  const sec = inhale ? 0.9 + intensity * 0.2 : 1.0;
  const x = white(sec);
  biquad(x, 'bp', inhale ? 1400 + intensity * 800 : 900 + intensity * 500, 0.7);
  biquad(x, 'lp', 4000);
  const n = x.length;
  for (let i = 0; i < n; i++) { const t = i / n; x[i] *= Math.pow(Math.sin(Math.PI * Math.pow(t, inhale ? 0.7 : 1.3)), 1.5); }
  return normalize(x, 0.5 + intensity * 0.3);
}

function gasp() { const x = white(0.7); biquad(x, 'bp', 1800, 0.9); env(x, 0.03, 0.18); return normalize(x, 0.9); }

function reverseSwell(sec = 2.6) {
  // The Remainder's inhale: a reversed decaying noise + tone that cuts off abruptly.
  const x = buf(sec);
  const n = pink(sec); biquad(n, 'bp', 700, 0.8);
  for (let i = 0; i < x.length; i++) { const t = i / SR; const e = Math.pow(t / sec, 3.2); x[i] = n[i] * e; }
  const tone = buf(sec);
  for (let i = 0; i < tone.length; i++) { const t = i / SR; tone[i] = Math.sin(2 * Math.PI * (140 + 220 * t / sec) * t) * Math.pow(t / sec, 4) * 0.5; }
  mixInto(x, tone, 0, 1);
  const tail = Math.floor(0.012 * SR);
  for (let i = 0; i < tail; i++) x[x.length - 1 - i] *= i / tail;
  return normalize(x, 0.85);
}

function scratch(sec = 3) {
  const x = buf(sec);
  let t = 0;
  while (t < sec - 0.2) {
    const g = white(0.08 + rng.next() * 0.15); biquad(g, 'bp', 1500 + rng.next() * 2500, 1.5); env(g, 0.01, 0.04);
    mixInto(x, g, t, 0.3 + rng.next() * 0.7);
    t += 0.05 + rng.next() * 0.25;
  }
  biquad(x, 'lp', 2400);
  return normalize(x, 0.7);
}

function knock() { const x = buf(1.0); for (let k = 0; k < 3; k++) mixInto(x, thud(0.2, 110, 0.9), k * 0.22, 1); biquad(x, 'lp', 1400); return normalize(x, 0.9); }

function tapeVoice(sec, seed = 1, pitch = 1) {
  // Formant-filtered babble: syllable envelopes over a buzzy source.
  const loc = new Rng(seed);
  const x = buf(sec);
  let t = 0;
  while (t < sec - 0.3) {
    const syl = 0.12 + loc.next() * 0.18;
    const f0 = (115 + loc.next() * 40) * pitch;
    const s = buf(syl);
    let ph = 0;
    for (let i = 0; i < s.length; i++) { ph += f0 * (1 + 0.05 * Math.sin(i / SR * 30)) / SR; s[i] = (ph % 1) * 2 - 1; }
    const a = s.slice(), b = s.slice();
    const F = [[730, 1090], [270, 2290], [530, 1840], [570, 840], [300, 870]][Math.floor(loc.next() * 5)];
    biquad(a, 'bp', F[0], 6); biquad(b, 'bp', F[1], 8);
    for (let i = 0; i < s.length; i++) s[i] = a[i] + b[i] * 0.6;
    for (let i = 0; i < s.length; i++) s[i] *= Math.sin(Math.PI * i / s.length);
    mixInto(x, s, t, 1);
    t += syl + (loc.next() < 0.2 ? 0.25 + loc.next() * 0.3 : 0.02);
  }
  const h = white(sec); biquad(h, 'bp', 3000, 0.5); mixInto(x, h, 0, 0.05);
  biquad(x, 'hp', 250); biquad(x, 'lp', 3400);
  return normalize(x, 0.6);
}

function radioWaltz() {
  const sec = 12;
  const x = buf(sec);
  const notes = [392, 440, 494, 440, 392, 330, 294, 330, 392, 349, 330, 294, 262, 294, 330, 392];
  const beat = 0.75;
  notes.forEach((f, k) => {
    const n = buf(beat * 1.4);
    for (let i = 0; i < n.length; i++) { const t = i / SR; n[i] = (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t)) * Math.exp(-t / 0.5); }
    mixInto(x, n, k * beat, 0.5);
    const bass = buf(0.4);
    for (let i = 0; i < bass.length; i++) { const t = i / SR; bass[i] = Math.sin(2 * Math.PI * f / 4 * t) * Math.exp(-t / 0.2); }
    mixInto(x, bass, k * beat, 0.4);
  });
  biquad(x, 'bp', 1200, 0.6);
  const st = white(sec); biquad(st, 'hp', 2000); mixInto(x, st, 0, 0.08);
  return normalize(x, 0.6);
}

function staticBurst(sec = 1.2) { const x = white(sec); biquad(x, 'bp', 2500, 0.4); for (let i = 0; i < x.length; i++) x[i] *= Math.random() < 0.002 ? 3 : 1; env(x, 0.01, sec * 0.4); return normalize(x, 0.6); }

function oscTone() {
  const sec = 2;
  const x = buf(sec);
  for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(2 * Math.PI * 1000 * t) * (((t * 4) % 1) < 0.7 ? 1 : 0.2); }
  return normalize(loopify(x, 0.01), 0.6);
}

function sting() {
  const sec = 4;
  const x = buf(sec);
  for (const f of [110, 116.5, 164.8, 233, 246.9, 349]) {
    for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] += (((f * t) % 1) * 2 - 1) * 0.2 * Math.min(1, t * 20) * Math.exp(-t / 1.4); }
  }
  biquad(x, 'lp', 2500);
  const h = white(sec); biquad(h, 'hp', 3000); env(h, 0.005, 0.5); mixInto(x, h, 0, 0.15);
  return normalize(x, 0.8);
}

function drone(f0, sec = 8) {
  const x = buf(sec);
  for (const [m, a] of [[1, 1], [1.5, 0.4], [2.01, 0.3], [0.5, 0.6]]) {
    for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] += a * Math.sin(2 * Math.PI * f0 * m * t + Math.sin(t * 0.3 * m) * 2); }
  }
  return normalize(loopify(x, 1), 0.5);
}

function pulseLoop() {
  const sec = 2;
  const x = buf(sec);
  for (let k = 0; k < 4; k++) {
    const b = buf(0.3);
    for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = Math.sin(2 * Math.PI * (60 - 50 * t) * t) * Math.exp(-t / 0.08); }
    mixInto(x, b, k * 0.5, k % 2 ? 0.6 : 1);
  }
  const n = white(sec); biquad(n, 'hp', 6000); for (let i = 0; i < n.length; i++) n[i] *= ((i / SR * 8) % 1) < 0.05 ? 0.3 : 0; mixInto(x, n, 0, 1);
  return normalize(x, 0.8);
}

function paper() { const x = white(0.35); biquad(x, 'hp', 1500); for (let i = 0; i < x.length; i++) x[i] *= Math.abs(Math.sin(i / SR * 60)) * (1 - i / x.length); return normalize(x, 0.5); }
function keys() { const x = buf(0.6); for (let k = 0; k < 8; k++) mixInto(x, metalRing(0.2, [3200 + k * 300, 5100, 7300], 0.04), rng.next() * 0.35, 0.5); return normalize(x, 0.6); }
function sparks() { const x = buf(0.8); for (let k = 0; k < 30; k++) mixInto(x, click(4000 + rng.next() * 4000, 0.003), rng.next() * 0.6, rng.next()); const z = white(0.8); biquad(z, 'hp', 3000); env(z, 0.001, 0.1); mixInto(x, z, 0, 0.6); return normalize(x, 0.9); }
function bang() { const x = thud(1.2, 45, 1); const n = white(1.2); biquad(n, 'lp', 3000); env(n, 0.001, 0.15); mixInto(x, n, 0, 0.8); mixInto(x, sparks(), 0.02, 0.5); return normalize(x, 1); }
function clunk() { const x = thud(0.4, 90, 0.4); mixInto(x, metalRing(0.4, [520, 1340, 2100], 0.06), 0, 0.5); return normalize(x, 0.8); }
function breaker() { const x = click(1800, 0.012); mixInto(x, thud(0.15, 160, 0.3), 0, 0.5); return normalize(x, 0.9); }
function scrape(sec = 1.6) { const x = white(sec); sweepLP(x, (t) => 300 + 300 * Math.sin(t * 9)); biquad(x, 'peak', 180, 2, 8); fadeEdges(x, 0.1); return normalize(x, 0.7); }
function valveSqueak() { return creak(0.8, 26, 0.8, 3); }
function metalDoorOpen() { const x = creak(1.0, 30, 0.6, 5); mixInto(x, clunk(), 0, 0.6); return normalize(x, 0.8); }
function metalDoorClose() { const x = thud(0.6, 70, 0.5); mixInto(x, metalRing(0.6, [310, 840, 1720], 0.12), 0, 0.4); return normalize(x, 0.9); }
function doorClose() { const x = thud(0.5, 85, 0.7); mixInto(x, click(2500, 0.006), 0.03, 0.4); return normalize(x, 0.8); }
function doorLocked() { const x = buf(0.6); for (let k = 0; k < 3; k++) mixInto(x, click(1500 + rng.next() * 900, 0.01), k * 0.13 + rng.next() * 0.03, 0.8); biquad(x, 'lp', 4000); return normalize(x, 0.8); }
function slam() { const x = thud(1.0, 60, 1.0); mixInto(x, click(2000, 0.02), 0.01, 0.6); return normalize(x, 1); }
function crawl(sec = 4) { const x = scratch(sec); const t = knock(); mixInto(x, t, 1.2, 0.4); return normalize(x, 0.7); }
function paCrackle() { const x = white(1.5); biquad(x, 'bp', 1600, 0.7); for (let i = 0; i < x.length; i++) x[i] *= (Math.random() < 0.01 ? 4 : 0.3) * (1 - i / x.length); const h = hum(60, 1.5, 1); mixInto(x, h, 0, 0.5); return normalize(x, 0.7); }
function sweepTone(sec = 6) { const x = buf(sec); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; const f = 40 * Math.pow(400, t / sec); ph += f / SR; x[i] = Math.sin(2 * Math.PI * ph); } fadeEdges(x, 0.05); return normalize(x, 0.6); }
function collage(sec = 3) {
  // Chase scream: stolen sounds re-assembled frantically.
  const x = buf(sec);
  const parts = [() => doorClose(), () => click(2000 + rng.next() * 2000, 0.01), () => pianoNote(220 * Math.pow(2, Math.floor(rng.next() * 12) / 12), 0.5), () => footstep('tile', 0, 1), () => metalRing(0.3, [700, 1900], 0.08), () => tapeVoice(0.4, Math.floor(rng.next() * 99), 0.7)];
  let t = 0;
  while (t < sec - 0.3) { mixInto(x, parts[Math.floor(rng.next() * parts.length)](), t, 0.4 + rng.next() * 0.6); t += 0.04 + rng.next() * 0.16; }
  const sub = buf(sec); for (let i = 0; i < sub.length; i++) { const tt = i / SR; sub[i] = Math.sin(2 * Math.PI * 38 * tt) * 0.5; }
  mixInto(x, sub, 0, 1);
  biquad(x, 'peak', 2500, 1, 5);
  return normalize(loopify(x, 0.05), 0.9);
}
function heavyStep() { const x = footstep('concrete', 0, 2.2); const y = thud(0.3, 50, 0.3); mixInto(x, y, 0, 0.8); return normalize(x, 0.9); }
function whisper(seed) { const x = tapeVoice(1.4, seed, 1.2); const n = white(1.4); biquad(n, 'bp', 3500, 0.6); for (let i = 0; i < n.length; i++) n[i] *= Math.abs(x[i]) * 3; return normalize(n, 0.6); }
function bootsOnStairs() { const x = buf(3); for (let k = 0; k < 6; k++) mixInto(x, footstep('concrete', k % 2), k * 0.48, 0.7 - k * 0.08); return normalize(x, 0.8); }
function pickupSound() { const x = click(1200, 0.02); mixInto(x, white(0.08).map((v, i) => v * Math.exp(-i / 800) * 0.3), 0.01); return normalize(x, 0.5); }
function batterySound() { const x = buf(0.4); mixInto(x, click(3000, 0.006), 0, 1); mixInto(x, click(2200, 0.01), 0.18, 1); return normalize(x, 0.6); }
function tapeClunk() { const x = click(900, 0.02); mixInto(x, thud(0.2, 140, 0.2), 0, 0.5); return normalize(x, 0.7); }
function vaultOpen() { const x = buf(7); mixInto(x, scrape(6), 0, 0.8); for (let k = 0; k < 6; k++) mixInto(x, clunk(), 0.3 + k * 0.2, 0.7); mixInto(x, thud(1.5, 35, 0.5), 6.0, 1); biquad(x, 'lp', 3000); return normalize(x, 1); }
function tvStatic() { const x = white(3); biquad(x, 'bp', 3000, 0.3); return normalize(loopify(x, 0.05), 0.4); }

const NOTE = (n) => 261.63 * Math.pow(2, n / 12);

// Library definition: name -> array of variant generators (lazy-built)
export const LIBRARY = {
  click: [() => click(3000, 0.004)],
  flashOn: [() => click(2600, 0.006)],
  pickup: [pickupSound],
  paper: [paper],
  keys: [keys],
  battery: [batterySound],
  tape: [tapeClunk],
  doorOpen: [() => creak(0.9, 22, 0.5, 1), () => creak(1.1, 28, 0.6, 2), () => creak(0.8, 18, 0.4, 3)],
  doorCreak: [() => creak(2.6, 14, 0.7, 4), () => creak(3.0, 11, 0.8, 6)],
  doorClose: [doorClose],
  latch: [() => click(1800, 0.008)],
  doorSlam: [slam],
  doorLocked: [doorLocked],
  doorMetalOpen: [metalDoorOpen],
  doorMetalClose: [metalDoorClose],
  shelfScrape: [() => scrape(1.8)],
  relayClunk: [clunk],
  breaker: [breaker],
  bang: [bang],
  sparks: [sparks],
  phone: [phoneRing],
  bell: [alarmBell],
  steam: [() => steam(2.5)],
  steamBurst: [() => steam(3, true)],
  whistle: [() => steamWhistle(3)],
  valve: [valveSqueak],
  boilerIgnite: [() => { const x = bang(); mixInto(x, steam(2, true), 0.2, 0.5); return x; }],
  heartbeat: [heartbeat],
  breathIn: [() => breath(true, 0.3), () => breath(true, 0.8)],
  breathOut: [() => breath(false, 0.3), () => breath(false, 0.8)],
  gasp: [gasp],
  inhale: [() => reverseSwell(2.6), () => reverseSwell(1.8)],
  scratch: [() => scratch(3)],
  crawl: [() => crawl(4)],
  knock: [knock],
  heavyStep: [heavyStep],
  collage: [() => collage(3)],
  whisper: [() => whisper(3), () => whisper(9), () => whisper(17)],
  voiceMorrow: [() => tapeVoice(8, 41, 1.15)],
  voiceMan: [() => tapeVoice(8, 7, 0.85)],
  voiceWoman: [() => tapeVoice(8, 23, 1.25)],
  voiceTape: [() => tapeVoice(8, 99, 1.0)],
  radio: [radioWaltz],
  static: [() => staticBurst(1.2)],
  tvStatic: [tvStatic],
  pa: [paCrackle],
  oscTone: [oscTone],
  sting: [sting],
  sweep: [() => sweepTone(6)],
  vault: [vaultOpen],
  stairs: [bootsOnStairs],
  musicBox: [0, 2, 4, 5, 7, 9, 11, 12].map((n) => () => musicBoxNote(NOTE(n))),
  piano: [0, 2, 4, 5, 7, 9, 11, 12].map((n) => () => pianoNote(NOTE(n))),
  // Loops
  loopHum: [() => hum(50, 4, 0.5)],
  loopRoom: [() => roomTone(300, 6, 0.03)],
  loopCorridor: [() => roomTone(500, 6, 0.05)],
  loopBasement: [() => roomTone(180, 6, 0.02)],
  loopElectrical: [() => { const x = hum(50, 4, 1.0); mixInto(x, roomTone(250, 4, 0.02), 0, 0.5); return x; }],
  loopBoiler: [boilerRoar],
  loopRain: [rainLoop],
  loopWind: [windLoop],
  loopDrip: [dripLoop],
  loopTinnitus: [tinnitus],
  loopDroneLow: [() => drone(41.2)],
  loopDroneHigh: [() => drone(98)],
  loopPulse: [pulseLoop],
  loopWhistle: [() => steamWhistle(3)],
  loopBell: [alarmBell],
  loopOsc: [oscTone],
  loopCollage: [() => collage(3)],
  loopRadio: [radioWaltz],
  loopVending: [() => hum(60, 4, 0.2)],
};

export function stepNames() { return Object.keys(SURF); }
export function makeFootsteps() {
  const out = {};
  for (const s of Object.keys(SURF)) out[s] = [0, 1, 2, 3].map((v) => footstep(s, v));
  return out;
}

// Procedural impulse responses for zone reverb.
export function impulse(preset) {
  const P = {
    outdoor: [0.6, 0.15, 3000, 0.06],
    lobby: [2.2, 0.5, 4500, 0.02],
    room: [0.7, 0.25, 4000, 0.01],
    small: [0.4, 0.2, 5000, 0.005],
    corridor: [1.5, 0.45, 5000, 0.015],
    bathroom: [1.3, 0.55, 7000, 0.008],
    hall: [7.0, 0.85, 6000, 0.04],
    studio: [0.9, 0.3, 4000, 0.01],
    dead: [0.15, 0.08, 2500, 0.002],
    anechoic: [0.02, 0.0, 2000, 0.0],
    stair: [2.0, 0.55, 4500, 0.02],
    tunnel: [2.6, 0.6, 3000, 0.03],
    basement: [1.6, 0.5, 3200, 0.02],
    cistern: [3.5, 0.7, 3500, 0.03],
  }[preset] || [1, 0.3, 4000, 0.01];
  const [dec, level, damp, pre] = P;
  const len = Math.max(0.05, dec * 1.2);
  const n = Math.floor(len * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const preN = Math.floor(pre * SR);
  for (let i = preN; i < n; i++) {
    const t = (i - preN) / SR;
    const e = Math.exp(-t * 6.9 / Math.max(0.02, dec)) * level;
    L[i] = r() * e; R[i] = r() * e;
  }
  sweepLP(L, (t) => damp * Math.exp(-t * 0.6) + 200);
  sweepLP(R, (t) => damp * Math.exp(-t * 0.6) + 200);
  return [L, R];
}
