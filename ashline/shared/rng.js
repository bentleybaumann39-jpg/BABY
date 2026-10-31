// Seeded deterministic RNG (mulberry32) and hashing helpers. Adapted from src/core/Rng.js (ANECHOIC).

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hash3(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class Rng {
  constructor(seed = 1) { this.state = (seed >>> 0) || 0x9e3779b9; }
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  weighted(entries) { // [[value, weight], ...]
    let tot = 0; for (const e of entries) tot += e[1];
    let r = this.next() * tot;
    for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  gauss() { return (this.next() + this.next() + this.next() - 1.5) / 0.5; }
}

// Smooth value noise + fbm, deterministic for a seed.
export function makeNoise(seed) {
  const s = seed | 0;
  const lat = (i, j) => hash3(i, j, s) * 2 - 1;
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const tx = x - xi, ty = y - yi;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = lat(xi, yi), b = lat(xi + 1, yi), c = lat(xi, yi + 1), d = lat(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  function fbm(x, y, oct = 5, lac = 2.03, gain = 0.5) {
    let sum = 0, amp = 1, norm = 0;
    for (let o = 0; o < oct; o++) { sum += noise(x, y) * amp; norm += amp; amp *= gain; x *= lac; y *= lac; }
    return sum / norm;
  }
  function ridged(x, y, oct = 4) {
    let sum = 0, amp = 1, norm = 0;
    for (let o = 0; o < oct; o++) { sum += (1 - Math.abs(noise(x, y))) * amp; norm += amp; amp *= 0.5; x *= 2.1; y *= 2.1; }
    return sum / norm;
  }
  return { noise, fbm, ridged };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t, cz = az + dz * t;
  return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
}
