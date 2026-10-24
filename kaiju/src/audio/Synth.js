// Offline synthesis of every sound effect into AudioBuffers. No samples ship with the game:
// roars are creaky glottal sources through sweeping vocal-tract formants; collapses are
// rumbling brown noise peppered with concrete grains; glass is clouds of tiny resonant
// pings, and so on. All recipes are deterministic for a given seed.

const TAU = Math.PI * 2;

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// RBJ biquad with per-call coefficient updates
export class Biquad {
  constructor(type, f, q, sr, gain = 0) { this.type = type; this.sr = sr; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q, gain); }
  set(f, q, gain = 0) {
    const w = TAU * Math.min(f, this.sr * 0.45) / this.sr, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    switch (this.type) {
      case 'lp': b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; break;
      case 'hp': b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; break;
      case 'bp': b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; break;
      case 'peak': { const A = Math.pow(10, gain / 40); b0 = 1 + a * A; b1 = -2 * c; b2 = 1 - a * A; a0 = 1 + a / A; a1 = -2 * c; a2 = 1 - a / A; break; }
      default: b0 = 1; b1 = b2 = 0; a0 = 1; a1 = a2 = 0;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

class Brown { constructor(r) { this.r = r; this.v = 0; } p() { this.v = (this.v + (this.r() * 2 - 1) * 0.02) * 0.998; return this.v * 3.5; } }
class Pink {
  constructor(r) { this.r = r; this.b = [0, 0, 0, 0, 0, 0, 0]; }
  p() {
    const w = this.r() * 2 - 1, b = this.b;
    b[0] = 0.99886 * b[0] + w * 0.0555179; b[1] = 0.99332 * b[1] + w * 0.0750759; b[2] = 0.969 * b[2] + w * 0.153852;
    b[3] = 0.8665 * b[3] + w * 0.3104856; b[4] = 0.55 * b[4] + w * 0.5329522; b[5] = -0.7616 * b[5] - w * 0.016898;
    const o = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362; b[6] = w * 0.115926;
    return o * 0.11;
  }
}

const sat = (x, d = 1) => Math.tanh(x * d);
function normalize(buf, peak = 0.92) {
  let m = 0;
  for (const ch of buf) for (let i = 0; i < ch.length; i++) m = Math.max(m, Math.abs(ch[i]));
  if (m > 0) for (const ch of buf) for (let i = 0; i < ch.length; i++) ch[i] *= peak / m;
  return buf;
}
function fadeEdges(a, sr, inT = 0.002, outT = 0.02) {
  const ni = Math.floor(inT * sr), no = Math.floor(outT * sr);
  for (let i = 0; i < ni && i < a.length; i++) a[i] *= i / ni;
  for (let i = 0; i < no && i < a.length; i++) a[a.length - 1 - i] *= i / no;
}
// make a loop seamless by crossfading its tail into its head
function loopify(a, sr, xf = 0.25) {
  const n = Math.floor(xf * sr), L = a.length - n;
  const out = new Float32Array(L);
  for (let i = 0; i < L; i++) out[i] = a[i + n];
  for (let i = 0; i < n; i++) { const t = i / n; out[L - n + i] = out[L - n + i] * (1 - t) + a[i] * t; }
  return out;
}

// ------------------------------------------------------------------ creature voices

export const VOICES = {
  razormaw: { base: 110, dur: 3.4, creak: 0.85, growl: 0.9, scream: 0.75, sub: 0.9, vowel: [[600, 1100, 2400], [450, 800, 2200]], bright: 0.9 },
  harrowblade: { base: 260, dur: 2.8, creak: 0.7, growl: 0.4, scream: 1.2, sub: 0.4, vowel: [[800, 1500, 2900], [650, 1250, 2700]], bright: 1.3 },
  hollowstrider: { base: 330, dur: 3.2, creak: 1.1, growl: 0.3, scream: 1.0, sub: 0.3, vowel: [[900, 1600, 3100], [700, 1900, 3300]], bright: 1.2, click: 1 },
  nyxwing: { base: 520, dur: 2.6, creak: 0.6, growl: 0.2, scream: 1.3, sub: 0.2, vowel: [[1000, 1900, 3400], [1300, 2400, 3800]], bright: 1.5 },
  gravemaw: { base: 48, dur: 3.4, creak: 0.3, growl: 1.1, scream: 0.1, sub: 1.3, vowel: [[350, 750, 2000], [280, 620, 1800]], bright: 0.45 },
  carapex: { base: 380, dur: 2.8, creak: 1.0, growl: 0.25, scream: 0.8, sub: 0.3, vowel: [[950, 1800, 3300], [1200, 2300, 3600]], bright: 1.4, click: 1 },
};

export function roar(sr, voice, seed = 1, scale = 1) {
  const V = voice, r = rng(seed);
  const dur = V.dur * scale;
  const n = Math.floor(dur * sr);
  const out = new Float32Array(n);
  const F = [0, 1, 2].map((i) => new Biquad('bp', V.vowel[0][i], 5 + i * 2, sr));
  const G = [0, 1, 2].map((i) => new Biquad('bp', V.vowel[0][i] * 0.5, 3, sr));
  const breath = new Biquad('bp', 1800, 0.8, sr);
  const lp = new Biquad('lp', 5200 * V.bright, 0.7, sr);
  const hp = new Biquad('hp', 28, 0.7, sr);
  let ph = 0, ph2 = 0, sub = 0, jitter = 0, nextCreak = 0;
  const pk = new Pink(r);
  const comb = new Float32Array(4096);
  let ci = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    // pitch contour: lunge up, ragged sustain, sag at the end
    let f = V.base * (0.75 + 0.55 * Math.min(1, t / 0.18) - 0.25 * Math.max(0, (t - 0.7) / 0.3) ** 1.5);
    f *= 1 + 0.035 * Math.sin(TAU * 5.5 * i / sr) + 0.05 * Math.sin(TAU * 1.3 * i / sr + 1);
    if (i % 256 === 0) jitter = (r() - 0.5) * 0.08;
    f *= 1 + jitter;
    const env = Math.min(1, t / 0.07) ** 1.2 * Math.min(1, (1 - t) / 0.28) * (0.85 + 0.15 * Math.sin(TAU * 0.7 * i / sr));
    // glottal source: saw plus irregular pulse train (vocal fry / creak)
    ph += f / sr; if (ph > 1) ph -= 1;
    let src = (ph * 2 - 1) * 0.6;
    if (i >= nextCreak) { src += V.creak * 0.9; nextCreak = i + Math.floor(sr / (f * (0.5 + r() * 0.6))); }
    // vowel morph a -> o
    if (i % 64 === 0) {
      const m = Math.min(1, Math.max(0, (t - 0.25) / 0.6));
      for (let k = 0; k < 3; k++) {
        const fv = V.vowel[0][k] * (1 - m) + V.vowel[1][k] * m;
        F[k].set(fv * (1 + 0.04 * Math.sin(i / sr * 7 + k)), 6 + k * 2);
        G[k].set(fv * 0.52, 2.5);
      }
    }
    let scream = 0;
    for (let k = 0; k < 3; k++) scream += F[k].p(src) * [1.0, 0.7, 0.45][k];
    let growl = 0;
    for (let k = 0; k < 3; k++) growl += G[k].p(src) * [1.0, 0.5, 0.25][k];
    ph2 += (f * 0.5) / sr; if (ph2 > 1) ph2 -= 1;
    sub = Math.sin(TAU * ph2) * V.sub;
    const br = breath.p(pk.p()) * 2.5 * (0.3 + 0.7 * env);
    let x = scream * V.scream * 2.2 + growl * V.growl * 2.4 + sub * 0.5 + br;
    if (V.click && r() < 0.0025) x += (r() - 0.5) * 6;
    // metallic resonance: a short feedback comb tuned to twice the pitch
    const dl = Math.max(8, Math.min(4000, Math.round(sr / (f * 2))));
    const fb = comb[(ci - dl + 4096) & 4095];
    comb[ci] = x + fb * 0.55 * V.creak;
    ci = (ci + 1) & 4095;
    x = x * 0.7 + fb * 0.6 * V.creak;
    x = sat(x * 1.6, 1.4);
    out[i] = hp.p(lp.p(x)) * env;
  }
  fadeEdges(out, sr, 0.01, 0.05);
  return normalize([out])[0];
}

// ------------------------------------------------------------------ impacts and destruction

export function thump(sr, seed, size = 1) {
  const r = rng(seed);
  const dur = 1.6 * size, n = Math.floor(dur * sr);
  const out = new Float32Array(n);
  const lp = new Biquad('lp', 320, 0.8, sr), lp2 = new Biquad('lp', 2200, 0.7, sr);
  const br = new Brown(r);
  let ph = 0;
  const clicks = [];
  for (let k = 0; k < 40 * size; k++) clicks.push([Math.floor((0.05 + Math.pow(r(), 1.8) * 0.9) * sr), 0.3 + r() * 0.7, 600 + r() * 3000]);
  const cf = clicks.map((c) => new Biquad('bp', c[2], 3, sr));
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = 24 + 40 * Math.exp(-t * 7);
    ph += f / sr;
    const body = Math.sin(TAU * ph) * Math.exp(-t * 3.2) * Math.min(1, t / 0.004);
    const crunch = lp.p(br.p() * 3) * Math.exp(-t * 6) * 1.6;
    let x = body * 1.4 + crunch;
    for (let k = 0; k < clicks.length; k++) {
      const [s, a] = clicks[k];
      const d = i - s;
      if (d >= 0 && d < sr * 0.06) x += cf[k].p((r() * 2 - 1)) * a * Math.exp(-d / (sr * 0.012)) * 0.8;
    }
    out[i] = sat(lp2.p(x), 1.1);
  }
  fadeEdges(out, sr);
  return normalize([out], 0.95)[0];
}

export function crumble(sr, seed, dur = 4, glassAmt = 0.4) {
  const r = rng(seed);
  const n = Math.floor(dur * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const br = new Brown(r), lp = new Biquad('lp', 260, 0.7, sr);
  const grains = [];
  const count = Math.floor(160 * dur);
  for (let k = 0; k < count; k++) {
    const t = Math.pow(r(), 1.6) * dur * 0.92;
    grains.push({ s: Math.floor(t * sr), len: Math.floor((0.015 + r() * 0.08) * sr), a: (0.2 + r()) * Math.exp(-t / dur * 1.5), f: 250 + Math.pow(r(), 2) * 3200, pan: r(), q: 1.5 + r() * 4 });
  }
  for (let k = 0; k < glassAmt * 90 * dur; k++) {
    const t = Math.pow(r(), 2) * dur * 0.8;
    grains.push({ s: Math.floor(t * sr), len: Math.floor((0.01 + r() * 0.05) * sr), a: 0.25 + r() * 0.4, f: 3500 + r() * 6000, pan: r(), q: 25 + r() * 40, glass: true });
  }
  grains.sort((a, b) => a.s - b.s);
  for (const g of grains) g.bq = new Biquad('bp', g.f, g.q, sr);
  let gi = 0;
  const active = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.min(1, t / 0.03) * Math.pow(1 - t, 1.3);
    const rum = lp.p(br.p()) * 2.2 * env;
    let l = rum, rr = rum;
    while (gi < grains.length && grains[gi].s <= i) active.push(grains[gi++]);
    for (let k = active.length - 1; k >= 0; k--) {
      const g = active[k];
      const d = i - g.s;
      if (d > g.len) { active.splice(k, 1); continue; }
      const e = Math.exp(-d / (g.len * 0.3));
      const v = g.bq.p(r() * 2 - 1) * g.a * e * (g.glass ? 2.5 : 1.6);
      l += v * (1 - g.pan); rr += v * g.pan;
    }
    L[i] = sat(l, 1.2); R[i] = sat(rr, 1.2);
  }
  fadeEdges(L, sr, 0.003, 0.2); fadeEdges(R, sr, 0.003, 0.2);
  return normalize([L, R]);
}

export function glass(sr, seed, dur = 1.6) {
  const r = rng(seed);
  const n = Math.floor(dur * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let k = 0; k < 110; k++) {
    const s = Math.floor(Math.pow(r(), 2.2) * (dur - 0.2) * sr);
    const f = 2600 + r() * 7000, d = 0.008 + r() * 0.05, a = 0.2 + r() * 0.8, pan = r();
    const len = Math.floor(d * 6 * sr);
    for (let i = 0; i < len && s + i < n; i++) {
      const v = Math.sin(TAU * f * i / sr + r() * 0.0) * Math.exp(-i / (d * sr)) * a;
      L[s + i] += v * (1 - pan); R[s + i] += v * pan;
    }
  }
  return normalize([L, R], 0.8);
}

export function explosion(sr, seed, size = 1) {
  const r = rng(seed);
  const dur = 2.6 + size, n = Math.floor(dur * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const lp = new Biquad('lp', 6000, 0.7, sr), lp2 = new Biquad('lp', 6000, 0.7, sr);
  const br = new Brown(r), pk = new Pink(r);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if (i % 64 === 0) { const fc = 120 + 7000 * Math.exp(-t * 5); lp.set(fc, 0.7); lp2.set(fc * 0.9, 0.7); }
    const crack = (r() * 2 - 1) * Math.exp(-t * 60) * 1.4;
    const body = (pk.p() * 3 + br.p() * 1.5) * Math.exp(-t * (1.6 / size)) * Math.min(1, t / 0.002);
    ph += (22 + 40 * Math.exp(-t * 4)) / sr;
    const boom = Math.sin(TAU * ph) * Math.exp(-t * 2.2) * 1.6;
    const crackle = r() < 0.002 * Math.exp(-t) ? (r() * 2 - 1) * 2 : 0;
    const x = body + crack + crackle;
    L[i] = sat(lp.p(x) + boom, 1.3);
    R[i] = sat(lp2.p(x * 0.95 + (r() - 0.5) * 0.05) + boom, 1.3);
  }
  fadeEdges(L, sr, 0.0005, 0.3); fadeEdges(R, sr, 0.0005, 0.3);
  return normalize([L, R]);
}

export function rumble(sr, seed, dur = 9) {
  const r = rng(seed);
  const n = Math.floor(dur * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const b1 = new Brown(r), b2 = new Brown(r);
  const l1 = new Biquad('lp', 140, 0.8, sr), l2 = new Biquad('lp', 150, 0.8, sr);
  const m1 = new Biquad('bp', 420, 0.8, sr), m2 = new Biquad('bp', 380, 0.8, sr);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.min(1, t / 0.12) * Math.pow(1 - t, 0.9) * (0.8 + 0.2 * Math.sin(i / sr * 3.1));
    const a = b1.p(), b = b2.p();
    L[i] = sat((l1.p(a) * 3 + m1.p(a) * 1.2) * env, 1.2);
    R[i] = sat((l2.p(b) * 3 + m2.p(b) * 1.2) * env, 1.2);
  }
  fadeEdges(L, sr, 0.05, 0.4); fadeEdges(R, sr, 0.05, 0.4);
  return normalize([L, R]);
}

export function whoosh(sr, seed, dur = 0.9, lo = 250, hi = 1300) {
  const r = rng(seed);
  const n = Math.floor(dur * sr);
  const out = new Float32Array(n);
  const bp = new Biquad('bp', lo, 1.2, sr);
  const pk = new Pink(r);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    if (i % 32 === 0) bp.set(lo + (hi - lo) * Math.sin(Math.PI * t), 1.2);
    out[i] = bp.p(pk.p() * 4) * Math.sin(Math.PI * t) ** 1.5;
  }
  return normalize([out], 0.8)[0];
}

// ------------------------------------------------------------------ weapons and machines

export function gunshot(sr, seed, big = 1) {
  const r = rng(seed);
  const dur = 0.25 + 1.2 * big, n = Math.floor(dur * sr);
  const out = new Float32Array(n);
  const lp = new Biquad('lp', 9000, 0.7, sr), hp = new Biquad('hp', 80, 0.7, sr);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if (i % 64 === 0) lp.set(300 + 9000 * Math.exp(-t * 18 / big), 0.7);
    ph += (40 + 60 * Math.exp(-t * 20)) / sr;
    const x = (r() * 2 - 1) * Math.exp(-t * (14 / big)) + Math.sin(TAU * ph) * Math.exp(-t * 9 / big) * big * 1.2;
    out[i] = sat(hp.p(lp.p(x)) * 1.5, 1.4);
  }
  fadeEdges(out, sr, 0.0003, 0.05);
  return normalize([out])[0];
}

export function rotorLoop(sr, seed) {
  const r = rng(seed);
  const dur = 2.0, n = Math.floor(dur * sr);
  const out = new Float32Array(n);
  const lp = new Biquad('lp', 900, 0.9, sr), bp = new Biquad('bp', 2400, 4, sr);
  const br = new Brown(r);
  const bladeHz = 17; // blade passes per second (integer cycles in the loop)
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ph = (t * bladeHz) % 1;
    const slap = Math.exp(-ph * 14) * (0.8 + 0.2 * Math.sin(TAU * t * 2));
    const body = lp.p(br.p() * 2) * (0.35 + 1.4 * slap);
    const turbine = Math.sin(TAU * 1100 * t) * 0.05 + bp.p(r() * 2 - 1) * 0.15;
    out[i] = sat(body + turbine, 1.1);
  }
  return normalize([out], 0.8)[0];
}

export function jetLoop(sr, seed) {
  const r = rng(seed);
  const n = Math.floor(3.0 * sr);
  const out = new Float32Array(n);
  const pk = new Pink(r), br = new Brown(r);
  const bp = new Biquad('bp', 700, 0.5, sr), hp = new Biquad('hp', 150, 0.7, sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    out[i] = hp.p(bp.p(pk.p() * 3) + br.p() * 0.6) + Math.sin(TAU * 2200 * t + Math.sin(TAU * 3 * t)) * 0.03;
  }
  return normalize([loopify(out, sr, 0.4)], 0.8)[0];
}

export function siren(sr, dur = 16) {
  // air-raid siren: rotor pitch climbs, holds, falls; two harmonically related tones
  const n = Math.floor(dur * sr);
  const out = new Float32Array(n);
  const lp = new Biquad('lp', 2400, 0.7, sr);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, c = (t % 8) / 8;
    const f = 230 + 330 * (c < 0.35 ? Math.sin(c / 0.35 * Math.PI / 2) : c < 0.6 ? 1 : Math.cos((c - 0.6) / 0.4 * Math.PI / 2) ** 0.7);
    p1 += f / sr; p2 += f * 1.25 / sr;
    const x = Math.sin(TAU * p1) + 0.5 * Math.sin(TAU * p2) + 0.25 * Math.sin(TAU * p1 * 3);
    out[i] = lp.p(sat(x * 1.5, 1));
  }
  return normalize([loopify(out, sr, 0.5)], 0.7)[0];
}

export function policeLoop(sr) {
  const n = Math.floor(4.0 * sr);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = 700 + 600 * (0.5 - 0.5 * Math.cos(TAU * t / 2));
    ph += f / sr;
    out[i] = sat(Math.sin(TAU * ph) + 0.3 * Math.sin(TAU * ph * 2), 1.3);
  }
  return normalize([out], 0.6)[0];
}

// ------------------------------------------------------------------ ambiences

export function cityLoop(sr, seed, night = 0) {
  const r = rng(seed);
  const dur = 10, n = Math.floor(dur * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const b1 = new Brown(r), b2 = new Brown(r);
  const l1 = new Biquad('lp', 320, 0.7, sr), l2 = new Biquad('lp', 300, 0.7, sr);
  const p = new Pink(r), hp = new Biquad('hp', 1500, 0.7, sr);
  // distant horns
  const horns = [];
  for (let k = 0; k < 3; k++) horns.push({ s: Math.floor(r() * (dur - 1) * sr), f: 330 + r() * 120, len: Math.floor((0.2 + r() * 0.4) * sr), pan: r() });
  for (let i = 0; i < n; i++) {
    let l = l1.p(b1.p()) * 1.8, rr = l2.p(b2.p()) * 1.8;
    const hiss = hp.p(p.p()) * 0.08;
    l += hiss; rr += hiss;
    for (const h of horns) {
      const d = i - h.s;
      if (d >= 0 && d < h.len) { const v = Math.sign(Math.sin(TAU * h.f * d / sr)) * 0.04 * Math.min(1, d / 400, (h.len - d) / 400); l += v * (1 - h.pan); rr += v * h.pan; }
    }
    if (night && r() < 0.00012) { /* crickets */ }
    L[i] = l; R[i] = rr;
  }
  return normalize([loopify(L, sr, 0.8), loopify(R, sr, 0.8)], 0.6);
}

export function oceanLoop(sr, seed) {
  const r = rng(seed);
  const dur = 12, n = Math.floor(dur * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const pk1 = new Pink(r), pk2 = new Pink(r);
  const lp1 = new Biquad('lp', 900, 0.6, sr), lp2 = new Biquad('lp', 900, 0.6, sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const w = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(TAU * t / 6 - 1.2), 2.5);
    const w2 = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(TAU * t / 4 + 0.7), 2.5);
    if (i % 128 === 0) { lp1.set(400 + 1800 * w, 0.6); lp2.set(400 + 1800 * w2, 0.6); }
    L[i] = lp1.p(pk1.p() * 3) * w; R[i] = lp2.p(pk2.p() * 3) * w2;
  }
  return normalize([L, R], 0.6);
}

export function screams(sr, seed, dur = 8) {
  // distant panicking crowd: overlapping formant glides and a murmur bed
  const r = rng(seed);
  const n = Math.floor(dur * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const mur = new Biquad('bp', 500, 0.9, sr), pk = new Pink(r);
  for (let i = 0; i < n; i++) { const v = mur.p(pk.p()) * 0.9; L[i] = v; R[i] = v; }
  for (let k = 0; k < 26; k++) {
    const s = Math.floor(r() * (dur - 1.2) * sr), len = Math.floor((0.4 + r() * 0.9) * sr);
    const f0 = 380 + r() * 700, pan = r();
    const f1 = new Biquad('bp', 900, 6, sr), f2 = new Biquad('bp', 2300, 8, sr);
    let ph = 0;
    for (let i = 0; i < len && s + i < n; i++) {
      const t = i / len;
      const f = f0 * (1 + 0.35 * Math.sin(Math.PI * t)) * (1 + 0.02 * Math.sin(TAU * 6 * i / sr));
      ph += f / sr;
      const src = (ph % 1) * 2 - 1;
      const v = (f1.p(src) * 2 + f2.p(src)) * Math.sin(Math.PI * t) * 0.35;
      L[s + i] += v * (1 - pan); R[s + i] += v * pan;
    }
  }
  return normalize([loopify(L, sr, 0.6), loopify(R, sr, 0.6)], 0.6);
}

// ------------------------------------------------------------------ powers

export function beamLoop(sr, seed) {
  const r = rng(seed);
  const n = Math.floor(2.0 * sr);
  const out = new Float32Array(n);
  const bp = new Biquad('bp', 3200, 1.5, sr), lp = new Biquad('lp', 7000, 0.7, sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const am = 0.65 + 0.35 * Math.sin(TAU * 30 * t);
    let x = 0;
    for (let h = 1; h <= 12; h++) x += Math.sin(TAU * 55 * h * t + h) / h;
    x = sat(x * 1.2, 1.5) * am * 0.8;
    x += bp.p(r() * 2 - 1) * (0.4 + 0.6 * (r() < 0.02 ? 1 : 0.3));
    x += Math.sin(TAU * 1760 * t + 0.4 * Math.sin(TAU * 6 * t)) * 0.12;
    out[i] = lp.p(x);
  }
  return normalize([out], 0.8)[0];
}

export function charge(sr, seed, dur = 1.2) {
  const r = rng(seed);
  const n = Math.floor(dur * sr);
  const out = new Float32Array(n);
  let ph = 0;
  const bp = new Biquad('bp', 800, 3, sr);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = 80 + 900 * t * t;
    ph += f / sr;
    if (i % 64 === 0) bp.set(300 + 4000 * t, 3);
    const x = Math.sin(TAU * ph) * 0.5 + bp.p(r() * 2 - 1) * 0.8 * t;
    out[i] = x * Math.min(1, t * 4) * (0.4 + 0.6 * t);
  }
  return normalize([out], 0.8)[0];
}

export function blip(sr, f = 880, dur = 0.08) {
  const n = Math.floor(dur * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin(TAU * f * i / sr) * Math.exp(-i / (sr * dur * 0.3)) * 0.5;
  return out;
}

export function taiko(sr, seed, pitch = 1) {
  const r = rng(seed);
  const n = Math.floor(1.6 * sr);
  const out = new Float32Array(n);
  const lp = new Biquad('lp', 600, 0.8, sr);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (62 * pitch + 50 * Math.exp(-t * 30)) / sr;
    out[i] = sat(Math.sin(TAU * ph) * Math.exp(-t * 4) * 1.5 + lp.p(r() * 2 - 1) * Math.exp(-t * 30) * 0.8, 1.2);
  }
  return normalize([out], 0.9)[0];
}

// cavernous impulse response for the city: early slaps off facades, long diffuse tail
export function cityIR(sr, seed, dur = 3.6) {
  const r = rng(seed);
  const n = Math.floor(dur * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let k = 0; k < 18; k++) {
    const s = Math.floor((0.03 + r() * 0.35) * sr), a = 0.5 * Math.exp(-s / sr * 4) * (0.5 + r());
    if (r() < 0.5) L[s] += a; else R[s] += a;
  }
  const lp1 = new Biquad('lp', 5000, 0.7, sr), lp2 = new Biquad('lp', 5000, 0.7, sr);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if (i % 256 === 0) { const fc = 6000 * Math.exp(-t * 0.9) + 300; lp1.set(fc, 0.7); lp2.set(fc, 0.7); }
    const e = Math.exp(-t * 2.0) * Math.min(1, t / 0.02);
    L[i] += lp1.p((r() * 2 - 1) * e * 0.35);
    R[i] += lp2.p((r() * 2 - 1) * e * 0.35);
  }
  return [L, R];
}
