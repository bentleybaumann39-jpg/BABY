// Procedural PBR textures (colour + normal + optional roughness), generated at load time.
// The generator core (tileable noise, height->normal, DataTexture) is adapted from ANECHOIC's
// src/world/Textures.js; the surface set is ASHLINE's own.
import * as THREE from 'three';
import { Rng } from '../../../shared/rng.js';


const S = 512;

// ---------------------------------------------------------------------------
// Tileable noise layers (precomputed once, sampled with offsets/frequency).
// ---------------------------------------------------------------------------
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoiseLayer(size, period, seed) {
  // Periodic value noise with smooth interpolation.
  const out = new Float32Array(size * size);
  const lat = new Float32Array(period * period);
  for (let j = 0; j < period; j++) for (let i = 0; i < period; i++) lat[j * period + i] = hash2(i, j, seed);
  const sc = period / size;
  for (let y = 0; y < size; y++) {
    const fy = y * sc;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    const sy = ty * ty * (3 - 2 * ty);
    const ya = (y0 % period) * period, yb = ((y0 + 1) % period) * period;
    for (let x = 0; x < size; x++) {
      const fx = x * sc;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const sx = tx * tx * (3 - 2 * tx);
      const xa = x0 % period, xb = (x0 + 1) % period;
      const a = lat[ya + xa], b = lat[ya + xb], c = lat[yb + xa], d = lat[yb + xb];
      out[y * size + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
  }
  return out;
}

function fbmLayer(size, basePeriod, octaves, seed) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0, period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    const l = valueNoiseLayer(size, period, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += l[i] * amp;
    total += amp;
    amp *= 0.5;
    period *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

let N = null;
function noise() {
  if (N) return N;
  const rng = new Rng(1337);
  N = {
    lo: fbmLayer(S, 4, 5, 11),     // big blotches
    mid: fbmLayer(S, 16, 4, 23),   // medium mottling
    hi: fbmLayer(S, 64, 2, 37),    // grain
    white: new Float32Array(S * S).map(() => rng.next()),
  };
  return N;
}

// Sample a layer with integer frequency multiplier and offset, wrapping (tileable).
function smp(layer, x, y, k = 1, ox = 0, oy = 0) {
  const xx = ((x * k + ox) % S + S) % S;
  const yy = ((y * k + oy) % S + S) % S;
  return layer[(yy | 0) * S + (xx | 0)];
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------
// Texture builder: fn(x, y, out) writes out.r,g,b (0..1), out.h (0..1), out.ro (roughness 0..1)
// ---------------------------------------------------------------------------
function build(name, fn, opts = {}) {
  const size = opts.size || S;
  const col = new Uint8Array(size * size * 4);
  const hgt = new Float32Array(size * size);
  const rou = opts.rough ? new Uint8Array(size * size * 4) : null;
  const o = { r: 0, g: 0, b: 0, h: 0.5, ro: 0.8, a: 1 };
  const step = S / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      o.h = 0.5; o.ro = opts.baseRough ?? 0.8; o.a = 1;
      fn(x * step, y * step, o, x, y, size);
      const i = (y * size + x) * 4;
      col[i] = clamp01(o.r) * 255;
      col[i + 1] = clamp01(o.g) * 255;
      col[i + 2] = clamp01(o.b) * 255;
      col[i + 3] = clamp01(o.a) * 255;
      hgt[y * size + x] = o.h;
      if (rou) { const rv = clamp01(o.ro) * 255; rou[i] = rv; rou[i + 1] = rv; rou[i + 2] = rv; rou[i + 3] = 255; }
    }
  }
  const map = dataTex(col, size, true);
  map.name = name;
  let normalMap = null;
  if (opts.normal !== 0) normalMap = dataTex(heightToNormal(hgt, size, opts.normal ?? 2.0), size, false);
  const roughnessMap = rou ? dataTex(rou, size, false) : null;
  return { map, normalMap, roughnessMap };
}

function heightToNormal(h, size, strength) {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1 + size) % size) * size, yp = ((y + 1) % size) * size, yc = y * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size, xp = (x + 1) % size;
      // DataTexture rows: y increases with v.
      let nx = (h[yc + xm] - h[yc + xp]) * strength;
      let ny = (h[ym + x] - h[yp + x]) * strength;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (yc + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

function dataTex(data, size, srgb) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function hexRgb(hex) { return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]; }

// Tile pattern helper: returns {gx, gy (tile indices), fx, fy (0..1 within tile), grout (0..1)}
function tile(x, y, nx, ny, groutW, offsetRows = 0) {
  const tw = S / nx, th = S / ny;
  const gy = Math.floor(y / th);
  const xo = (gy % 2) * offsetRows * tw;
  const gx = Math.floor(((x + xo) % S) / tw);
  const fx = (((x + xo) % S) % tw) / tw;
  const fy = (y % th) / th;
  const ex = Math.min(fx, 1 - fx) * tw, ey = Math.min(fy, 1 - fy) * th;
  const e = Math.min(ex, ey);
  const grout = 1 - smooth(groutW * 0.5, groutW, e);
  return { gx, gy, fx, fy, grout, edge: e };
}

// ---------------------------------------------------------------------------
function paint(base, opts = {}) {
  const [br, bg, bb] = hexRgb(base);
  const nz = noise();
  return (x, y, o) => {
    const lo = smp(nz.lo, x, y, 1, 13, 7), mid = smp(nz.mid, x, y, 1, 5, 61), hi = smp(nz.hi, x, y);
    const stain = smooth(0.6, 0.85, lo) * (opts.stain ?? 0.25);
    const v = 1 + (mid - 0.5) * 0.08 + (hi - 0.5) * 0.04;
    o.r = br * v * (1 - stain * 0.5);
    o.g = bg * v * (1 - stain * 0.45);
    o.b = bb * v * (1 - stain * 0.7);
    // peeling flecks
    const peel = opts.peel ? smooth(0.82, 0.86, smp(nz.mid, x, y, 2, 99, 3)) : 0;
    if (peel > 0) { o.r = mix(o.r, 0.55, peel); o.g = mix(o.g, 0.53, peel); o.b = mix(o.b, 0.5, peel); }
    o.h = 0.5 + (hi - 0.5) * 0.25 + (mid - 0.5) * 0.15 - peel * 0.2;
    o.ro = 0.75 + (mid - 0.5) * 0.2;
  };
}

function concrete(base, opts = {}) {
  const [br, bg, bb] = hexRgb(base);
  const nz = noise();
  return (x, y, o) => {
    const lo = smp(nz.lo, x, y, 1, opts.seed || 0, 30), mid = smp(nz.mid, x, y, 1, 77, opts.seed || 0), hi = smp(nz.hi, x, y, 1, 9, 9);
    const w = smp(nz.white, x, y);
    const pore = w > 0.985 ? 1 : 0;
    let v = 0.82 + lo * 0.25 + (mid - 0.5) * 0.15 + (hi - 0.5) * 0.08 - pore * 0.25;
    let h = 0.5 + (mid - 0.5) * 0.3 + (hi - 0.5) * 0.25 - pore * 0.4;
    if (opts.boards) {
      // board-formed concrete: horizontal planks every 1/8 of the texture
      const by = (y % (S / 8)) / (S / 8);
      const seam = smooth(0.03, 0, Math.min(by, 1 - by));
      const plank = hash2(0, Math.floor(y / (S / 8)), 5);
      v *= 0.95 + plank * 0.08 - seam * 0.2;
      h -= seam * 0.3;
      // wood grain imprint
      h += (smp(nz.hi, x * 0.25, y * 4, 1, 0, Math.floor(y / 64) * 17) - 0.5) * 0.15;
    }
    if (opts.ties) {
      const tx = (x % (S / 2)) - S / 4, ty = (y % (S / 2)) - S / 4;
      const d = Math.hypot(tx, ty);
      const hole = smooth(10, 7, d);
      v *= 1 - hole * 0.45;
      h -= hole * 0.5;
    }
    let wet = 0;
    if (opts.wet) wet = smooth(0.5, 0.7, smp(nz.lo, x, y, 1, 200, 140));
    const streak = opts.streaks ? smooth(0.55, 0.9, smp(nz.mid, x * 0.08, y * 1.0, 1, 33, 0)) * 0.3 : 0;
    v *= 1 - wet * 0.35 - streak;
    o.r = br * v; o.g = bg * v; o.b = bb * v;
    o.h = h;
    o.ro = opts.polished ? 0.22 + (mid - 0.5) * 0.2 : (0.88 - wet * 0.65 + (hi - 0.5) * 0.1);
  };
}

function woodPlanks(base, dark, plankCount, vertical, opts = {}) {
  const [br, bg, bb] = hexRgb(base);
  const [dr, dg, db] = hexRgb(dark);
  const nz = noise();
  return (x, y, o) => {
    let u = x, v = y;
    if (vertical) { u = y; v = x; }
    const pw = S / plankCount;
    const pi = Math.floor(v / pw);
    const pf = (v % pw) / pw;
    const len = opts.short ? S / 2 : S;
    const seg = Math.floor((u + hash2(pi, 0, 3) * S) / len);
    const ph = hash2(pi, seg, 9);
    const grain = smp(nz.mid, u * 0.06 + ph * 300, v * 3.0, 1, 0, pi * 41);
    const rings = 0.5 + 0.5 * Math.sin(grain * 30 + v * 0.05);
    const fine = smp(nz.hi, u * 0.2, v * 2.0, 1, 11, pi * 7);
    let t = clamp01(rings * 0.55 + fine * 0.35 + ph * 0.3 - 0.1);
    const seam = smooth(0.04, 0, Math.min(pf, 1 - pf));
    const endSeam = smooth(2.5, 0, Math.abs(((u + hash2(pi, 0, 3) * S) % len)));
    const wear = smooth(0.55, 0.8, smp(nz.lo, x, y, 1, 3, 3)) * 0.25;
    o.r = mix(br, dr, t) * (1 - seam * 0.6 - endSeam * 0.5) * (1 + wear * 0.3);
    o.g = mix(bg, dg, t) * (1 - seam * 0.6 - endSeam * 0.5) * (1 + wear * 0.3);
    o.b = mix(bb, db, t) * (1 - seam * 0.6 - endSeam * 0.5) * (1 + wear * 0.2);
    o.h = 0.55 - seam * 0.5 - endSeam * 0.4 + (fine - 0.5) * 0.15;
    o.ro = (opts.gloss ? 0.35 : 0.6) + wear * 0.5 + fine * 0.1;
  };
}

function brick(base, mortar, opts = {}) {
  const [br, bg, bb] = hexRgb(base);
  const [mr, mg, mb] = hexRgb(mortar);
  const nz = noise();
  return (x, y, o) => {
    const t = tile(x, y, 4, 16, 3.5, 0.5);
    const bv = hash2(t.gx, t.gy, 17);
    const mid = smp(nz.mid, x, y, 1, t.gx * 9, t.gy * 3);
    const hi = smp(nz.hi, x, y);
    const soot = smooth(0.5, 0.85, smp(nz.lo, x, y, 1, 0, 40)) * (opts.soot ?? 0.4);
    const v = 0.75 + bv * 0.35 + (mid - 0.5) * 0.25;
    let r = br * v, g = bg * v, b = bb * v;
    r = mix(r, mr, t.grout); g = mix(g, mg, t.grout); b = mix(b, mb, t.grout);
    r *= 1 - soot; g *= 1 - soot; b *= 1 - soot * 0.9;
    o.r = r; o.g = g; o.b = b;
    o.h = 0.6 - t.grout * 0.45 + (hi - 0.5) * 0.2 + (mid - 0.5) * 0.1;
    o.ro = 0.9;
  };
}

function metalPaint(base) {
  const [br, bg, bb] = hexRgb(base);
  const nz = noise();
  return (x, y, o) => {
    const mid = smp(nz.mid, x, y), hi = smp(nz.hi, x, y), lo = smp(nz.lo, x, y, 1, 21, 4);
    const scratch = smooth(0.004, 0, Math.abs(smp(nz.mid, x * 4, y * 0.25, 1, 3, 0) - 0.5)) * smooth(0.5, 0.7, lo);
    const chip = smooth(0.78, 0.8, smp(nz.mid, x, y, 2, 40, 40));
    const rust = smooth(0.68, 0.9, lo) * 0.6;
    let r = br * (0.92 + mid * 0.16), g = bg * (0.92 + mid * 0.16), b = bb * (0.92 + mid * 0.16);
    r = mix(r, 0.45, chip); g = mix(g, 0.44, chip); b = mix(b, 0.43, chip);
    r = mix(r, 0.35, rust); g = mix(g, 0.2, rust); b = mix(b, 0.12, rust);
    r += scratch * 0.2; g += scratch * 0.2; b += scratch * 0.2;
    o.r = r; o.g = g; o.b = b;
    o.h = 0.5 - chip * 0.2 + (hi - 0.5) * 0.06 + rust * 0.1;
    o.ro = 0.45 + rust * 0.4 + (hi - 0.5) * 0.1 - scratch * 0.2;
  };
}

function fabric(base) {
  const [br, bg, bb] = hexRgb(base);
  const nz = noise();
  return (x, y, o) => {
    const weave = (Math.sin(x * 1.6) * Math.sin(y * 1.6)) * 0.5 + 0.5;
    const mid = smp(nz.mid, x, y), lo = smp(nz.lo, x, y, 1, 6, 66);
    const stain = smooth(0.62, 0.8, lo) * 0.25;
    const v = 0.85 + weave * 0.15 + (mid - 0.5) * 0.15;
    o.r = br * v * (1 - stain * 0.6); o.g = bg * v * (1 - stain * 0.7); o.b = bb * v * (1 - stain);
    o.h = 0.5 + weave * 0.2;
    o.ro = 0.95;
  };
}

function grime() {
  const nz = noise();
  return (x, y, o) => {
    const lo = smp(nz.lo, x, y), mid = smp(nz.mid, x, y), hi = smp(nz.hi, x, y);
    const v = 0.78 + lo * 0.2 + (mid - 0.5) * 0.15 + (hi - 0.5) * 0.1;
    o.r = v; o.g = v; o.b = v;
    o.h = 0.5 + (hi - 0.5) * 0.3 + (mid - 0.5) * 0.2;
    o.ro = 0.6 + (mid - 0.5) * 0.3;
  };
}

function skin() {
  const nz = noise();
  return (x, y, o) => {
    const lo = smp(nz.lo, x, y, 2, 3, 3), mid = smp(nz.mid, x, y, 1, 9, 2), hi = smp(nz.hi, x, y, 2);
    const vein = smooth(0.012, 0, Math.abs(smp(nz.mid, x, y, 1, 60, 10) - 0.5)) * 0.5;
    const bruise = smooth(0.6, 0.85, lo);
    let r = 0.72 + mid * 0.1, g = 0.7 + mid * 0.08, b = 0.66 + mid * 0.06;
    r = mix(r, 0.45, bruise * 0.6); g = mix(g, 0.42, bruise * 0.6); b = mix(b, 0.48, bruise * 0.6);
    r -= vein * 0.25; g -= vein * 0.2; b -= vein * 0.05;
    o.r = r; o.g = g; o.b = b;
    o.h = 0.5 + (hi - 0.5) * 0.5 + (mid - 0.5) * 0.3 + vein * 0.2;
    o.ro = 0.45 + hi * 0.2;
  };
}

// ---------------------------------------------------------------------------
// ASHLINE surfaces
// ---------------------------------------------------------------------------
function terrainGrass() {
  const nz = noise();
  return (x, y, o) => {
    const lo = smp(nz.lo, x, y, 1, 3, 3), mid = smp(nz.mid, x, y, 1, 7, 13), w = smp(nz.white, x, y);
    const blade = smp(nz.hi, x, y * 2.5, 2, 0, 0);
    const dead = smooth(0.42, 0.72, lo);
    const bare = smooth(0.66, 0.8, smp(nz.mid, x, y, 1, 90, 40)) * 0.6;
    let r = mix(0.19, 0.26, blade), g = mix(0.22, 0.29, blade), b = mix(0.1, 0.12, blade);
    r = mix(r, 0.36, dead); g = mix(g, 0.31, dead); b = mix(b, 0.17, dead);
    r = mix(r, 0.27, bare); g = mix(g, 0.22, bare); b = mix(b, 0.16, bare);
    if (w > 0.985) { r = 0.38; g = 0.36; b = 0.32; }
    const v = 0.78 + mid * 0.4;
    o.r = r * v; o.g = g * v; o.b = b * v;
    o.h = 0.5 + (blade - 0.5) * 0.45 + (w > 0.985 ? 0.35 : 0) - bare * 0.15;
    o.ro = 0.92;
  };
}
function terrainDirt() {
  const nz = noise();
  return (x, y, o) => {
    const lo = smp(nz.lo, x, y, 1, 50, 9), mid = smp(nz.mid, x, y, 1, 3, 70), hi = smp(nz.hi, x, y, 1, 4, 4), w = smp(nz.white, x, y);
    const pebble = smooth(0.78, 0.86, smp(nz.hi, x, y, 2, 17, 5));
    const dark = smooth(0.4, 0.75, lo);
    let r = mix(0.36, 0.25, dark), g = mix(0.29, 0.2, dark), b = mix(0.21, 0.15, dark);
    r = mix(r, 0.46, pebble * 0.7); g = mix(g, 0.43, pebble * 0.7); b = mix(b, 0.39, pebble * 0.7);
    const v = 0.85 + mid * 0.3 + (hi - 0.5) * 0.12 + (w > 0.97 ? 0.12 : 0);
    o.r = r * v; o.g = g * v; o.b = b * v;
    o.h = 0.45 + pebble * 0.45 + (hi - 0.5) * 0.25 + (mid - 0.5) * 0.2;
    o.ro = 0.95 - dark * 0.1;
  };
}
function terrainRock() {
  const nz = noise();
  return (x, y, o) => {
    const lo = smp(nz.lo, x, y, 1, 11, 33), mid = smp(nz.mid, x, y, 1, 20, 2), hi = smp(nz.hi, x, y, 1, 3, 9);
    const strata = 0.5 + 0.5 * Math.sin(y * 0.09 + mid * 6 + lo * 4);
    const crack = smooth(0.012, 0, Math.abs(smp(nz.mid, x, y, 2, 61, 13) - 0.5)) * smooth(0.3, 0.6, lo);
    const lichen = smooth(0.65, 0.8, smp(nz.mid, x, y, 1, 140, 77)) * 0.5;
    let v = 0.36 + strata * 0.12 + (mid - 0.5) * 0.2 + (hi - 0.5) * 0.1 - crack * 0.25;
    let r = v * 1.02, g = v, b = v * 0.94;
    r = mix(r, 0.34, lichen); g = mix(g, 0.36, lichen); b = mix(b, 0.24, lichen);
    o.r = r; o.g = g; o.b = b;
    o.h = 0.5 + strata * 0.25 + (mid - 0.5) * 0.4 + (hi - 0.5) * 0.2 - crack * 0.6;
    o.ro = 0.85;
  };
}
function terrainGravel() {
  const nz = noise();
  return (x, y, o) => {
    const w = smp(nz.white, x, y), hi = smp(nz.hi, x, y, 2), mid = smp(nz.mid, x, y), lo = smp(nz.lo, x, y, 1, 9, 31);
    const stone = smooth(0.45, 0.75, smp(nz.hi, x, y, 4, 13, 2));
    const rut = smooth(0.12, 0.02, Math.abs(((x / S) * 4 % 1) - 0.5) - 0.3) * 0.0;
    const puddle = smooth(0.7, 0.76, lo);
    let v = 0.33 + stone * 0.18 + (mid - 0.5) * 0.1 + (w > 0.9 ? 0.08 : 0) - rut;
    o.r = v * 1.03; o.g = v * 0.99; o.b = v * 0.92;
    o.r = mix(o.r, 0.13, puddle); o.g = mix(o.g, 0.12, puddle); o.b = mix(o.b, 0.11, puddle);
    o.h = 0.4 + stone * 0.5 + (hi - 0.5) * 0.2 - puddle * 0.3;
    o.ro = mix(0.9, 0.12, puddle);
  };
}
function terrainMud() {
  const nz = noise();
  return (x, y, o) => {
    const lo = smp(nz.lo, x, y, 1, 7, 71), mid = smp(nz.mid, x, y), hi = smp(nz.hi, x, y);
    const wet = smooth(0.35, 0.65, lo);
    const v = 0.2 + (mid - 0.5) * 0.08 + (hi - 0.5) * 0.04;
    o.r = v * 1.15 * (1 - wet * 0.25); o.g = v * (1 - wet * 0.25); o.b = v * 0.8 * (1 - wet * 0.2);
    o.h = 0.5 + (mid - 0.5) * 0.3 + (hi - 0.5) * 0.2;
    o.ro = mix(0.8, 0.25, wet);
  };
}
function corrugated(base) {
  const [br, bg, bb] = hexRgb(base);
  const nz = noise();
  return (x, y, o) => {
    const wave = Math.sin(x / S * Math.PI * 2 * 16);
    const lo = smp(nz.lo, x, y, 1, 21, 4), mid = smp(nz.mid, x, y), hi = smp(nz.hi, x, y);
    const rust = smooth(0.55, 0.85, lo * 0.7 + smp(nz.mid, x * 0.2, y, 1, 3, 0) * 0.5) * 0.85;
    const streak = smooth(0.5, 0.9, smp(nz.mid, x * 0.1, y * 0.8, 1, 9, 0)) * 0.3;
    const shade = 0.88 + wave * 0.1;
    let r = br * shade, g = bg * shade, b = bb * shade;
    r = mix(r, 0.36, rust); g = mix(g, 0.2, rust); b = mix(b, 0.11, rust);
    r *= 1 - streak * 0.4; g *= 1 - streak * 0.45; b *= 1 - streak * 0.5;
    o.r = r * (0.95 + mid * 0.1); o.g = g * (0.95 + mid * 0.1); o.b = b * (0.95 + mid * 0.1);
    o.h = 0.5 + wave * 0.45 + (hi - 0.5) * 0.05 + rust * 0.05;
    o.ro = 0.5 + rust * 0.4;
  };
}
function roofTiles(base) {
  const [br, bg, bb] = hexRgb(base);
  const nz = noise();
  return (x, y, o) => {
    const t = tile(x, y, 8, 8, 2.5, 0.5);
    const tv = hash2(t.gx, t.gy, 41);
    const lap = t.fy;  // overlapping: darker near the top edge of each tile
    const moss = smooth(0.62, 0.85, smp(nz.lo, x, y, 1, 5, 55)) * 0.6;
    const v = (0.75 + tv * 0.3) * (0.75 + lap * 0.35);
    let r = br * v, g = bg * v, b = bb * v;
    r = mix(r, 0.2, moss); g = mix(g, 0.24, moss); b = mix(b, 0.13, moss);
    o.r = mix(r, 0.08, t.grout); o.g = mix(g, 0.08, t.grout); o.b = mix(b, 0.08, t.grout);
    o.h = 0.3 + lap * 0.6 - t.grout * 0.4 + (smp(nz.hi, x, y) - 0.5) * 0.1;
    o.ro = 0.85;
  };
}
function bark() {
  const nz = noise();
  return (x, y, o) => {
    const ridge = smp(nz.mid, x * 4, y * 0.35, 1, 0, 0);
    const hi = smp(nz.hi, x, y), lo = smp(nz.lo, x, y);
    const groove = smooth(0.42, 0.3, ridge);
    const v = 0.22 + ridge * 0.15 + (hi - 0.5) * 0.08;
    o.r = v * 1.2 * (1 - groove * 0.5); o.g = v * 0.95 * (1 - groove * 0.5); o.b = v * 0.75 * (1 - groove * 0.5);
    o.r += (lo - 0.5) * 0.04;
    o.h = 0.3 + ridge * 0.7 - groove * 0.3;
    o.ro = 0.95;
  };
}
function crateWood() {
  const planks = woodPlanks(0x4f5a3a, 0x2e3522, 4, false, {});
  const nz = noise();
  return (x, y, o) => {
    planks(x, y, o);
    // painted military green with stencil band
    const band = Math.abs(y / S - 0.5) < 0.06 ? 1 : 0;
    const stencil = band && (Math.floor(x / 24) % 3 !== 0) && smp(nz.hi, x, y) > 0.35 ? 1 : 0;
    o.r = mix(o.r, 0.65, stencil * 0.6); o.g = mix(o.g, 0.62, stencil * 0.6); o.b = mix(o.b, 0.5, stencil * 0.6);
  };
}

const DEFS = {
  grass: { fn: terrainGrass, scale: 5, normal: 2.5 },
  dirt: { fn: terrainDirt, scale: 4, normal: 3 },
  rock: { fn: terrainRock, scale: 8, normal: 4 },
  gravel: { fn: terrainGravel, scale: 3.5, normal: 3 },
  mud: { fn: terrainMud, scale: 4, normal: 1.5 },
  concrete: { fn: () => concrete(0x7d7a73, { streaks: true }), scale: 3.0 },
  brick: { fn: () => brick(0x6a3a2a, 0x57524a, { soot: 0.5 }), scale: 1.6 },
  plaster: { fn: () => paint(0x9c9480, { stain: 0.6, peel: true }), scale: 2.6 },
  wood: { fn: () => woodPlanks(0x4a3624, 0x2a1d12, 5, false, {}), scale: 1.2 },
  metal: { fn: () => corrugated(0x5e675e), scale: 2.4 },
  roof: { fn: () => roofTiles(0x5a3a2c), scale: 2.2 },
  rust: { fn: () => metalPaint(0x5a3826), scale: 1.6 },
  bark: { fn: bark, scale: 1.0, size: 256 },
  sandbag: { fn: () => fabric(0x77684a), scale: 0.9, size: 256 },
  crate: { fn: crateWood, scale: 1.2 },
  floor: { fn: () => woodPlanks(0x5a412a, 0x34241a, 8, false, { short: true }), scale: 1.8 },
  plank: { fn: () => woodPlanks(0x5f554a, 0x37302a, 6, true, {}), scale: 2.2 },
  steel: { fn: () => metalPaint(0x4b4f52), scale: 1.0, size: 256 },
  skin: { fn: skin, scale: 0.6, size: 256 },
  cloth: { fn: () => fabric(0x3d3f33), scale: 0.6, size: 256 },
};
export const TEXTURE_KEYS = Object.keys(DEFS);

export async function generateTextures(onProgress, keys = TEXTURE_KEYS) {
  noise();
  const out = {};
  let k = 0;
  for (const key of keys) {
    const def = DEFS[key];
    out[key] = build(key, def.fn(), { rough: def.rough, size: def.size || S, normal: def.normal });
    out[key].scale = def.scale;
    k++;
    if (onProgress) onProgress(k / keys.length, key);
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

// Camouflage pattern from a 4-colour palette (cosmetics). Cached by id.
const camoCache = new Map();
export function camoTexture(id, palette) {
  if (camoCache.has(id)) return camoCache.get(id);
  noise();
  const size = 256;
  const nz = N;
  const cols = palette.map(h => { const v = parseInt(h.slice(1), 16); return hexRgb(v); });
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const X = x * 2, Y = y * 2;
    let ci;
    if (id === 'tiger') {
      const s = Math.sin((X + smp(nz.mid, X, Y, 1, 5, 5) * 140) * 0.05 + Y * 0.012);
      ci = s > 0.55 ? 1 : smp(nz.lo, X, Y, 2, 3, 9) > 0.55 ? 2 : 0;
    } else if (id === 'digital') {
      const q = 12;
      const v = smp(nz.mid, Math.floor(X / q) * q, Math.floor(Y / q) * q, 1, 3, 9);
      ci = v < 0.38 ? 3 : v < 0.5 ? 1 : v < 0.62 ? 0 : 2;
    } else if (id === 'night' || id === 'blackout' || id === 'olive') {
      const v = smp(nz.mid, X, Y, 1, 7, 7);
      ci = v < 0.45 ? 0 : v < 0.6 ? 1 : 2;
    } else {
      const a = smp(nz.lo, X, Y, 2, 11, 3), b = smp(nz.mid, X, Y, 1, 41, 77);
      ci = a > 0.6 ? 1 : b > 0.62 ? 2 : (a < 0.35 && b < 0.45) ? 3 : 0;
    }
    const c = cols[ci % cols.length];
    const g = 0.92 + smp(nz.hi, X, Y) * 0.14;
    const i = (y * size + x) * 4;
    data[i] = clamp01(c[0] * g) * 255; data[i + 1] = clamp01(c[1] * g) * 255; data[i + 2] = clamp01(c[2] * g) * 255; data[i + 3] = 255;
  }
  const t = dataTex(data, size, true);
  camoCache.set(id, t);
  return t;
}

void Rng;
