// Procedural texture generation. Everything is generated at load time; no image assets.
import * as THREE from 'three';
import { Rng } from '../core/Rng.js';

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
// Surface generators
// ---------------------------------------------------------------------------
function glazedTiles(base, groutCol, n, opts = {}) {
  const [br, bg, bb] = hexRgb(base);
  const [gr, gg, gb] = hexRgb(groutCol);
  const nz = noise();
  return (x, y, o) => {
    const t = tile(x, y, n, n, 3.2);
    const tv = hash2(t.gx, t.gy, 7) - 0.5;
    const dirt = smp(nz.lo, x, y, 1, 40, 90);
    const mid = smp(nz.mid, x, y);
    const grime = smooth(0.55, 0.85, dirt) * 0.35;
    const crack = (opts.cracks && hash2(t.gx, t.gy, 3) > 0.9) ? smooth(0.006, 0, Math.abs(smp(nz.mid, x, y, 2, t.gx * 31, 0) - 0.5) * 0.05) : 0;
    const v = 1 + tv * 0.08 + (mid - 0.5) * 0.06;
    let r = br * v, g = bg * v, b = bb * v;
    // Slight bevel highlight on tile edges
    const bevel = smooth(0, 6, t.edge);
    r = mix(gr, r, 1 - t.grout); g = mix(gg, g, 1 - t.grout); b = mix(gb, b, 1 - t.grout);
    r *= 1 - grime; g *= 1 - grime * 0.9; b *= 1 - grime * 1.1;
    r *= 1 - crack * 0.6; g *= 1 - crack * 0.6; b *= 1 - crack * 0.6;
    o.r = r; o.g = g; o.b = b;
    o.h = 0.4 + bevel * 0.5 - t.grout * 0.35 + (smp(nz.hi, x, y) - 0.5) * 0.02 - crack * 0.2;
    o.ro = t.grout > 0.5 ? 0.9 : 0.18 + grime * 0.9 + (mid - 0.5) * 0.1;
  };
}

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

function wallpaper(base, motif, opts = {}) {
  const [br, bg, bb] = hexRgb(base);
  const [mr, mg, mb] = hexRgb(motif);
  const nz = noise();
  return (x, y, o) => {
    // Damask-ish motif: stripes + diamond lattice + soft blobs
    const cx = (x % 64) - 32, cy = (y % 96) - 48;
    const diamond = Math.abs(cx) / 32 + Math.abs(cy) / 48;
    const ring = smooth(0.08, 0.0, Math.abs(diamond - 0.62)) * 0.8;
    const petal = smooth(0.35, 0.2, Math.hypot(cx * 1.4, cy * 0.8 + 6 * Math.sin(cx * 0.2)) / 40);
    const stripe = smooth(0.15, 0.0, Math.abs(((x % 64) / 64) - 0.5) - 0.42) * 0.4;
    let m = clamp01(ring + petal * 0.7 + stripe);
    const fade = smp(nz.lo, x, y, 1, 50, 50);
    m *= 0.55 + fade * 0.35;
    const water = smooth(0.62, 0.78, smp(nz.lo, x * 0.5, y, 1, 120, 20)) * (opts.stains ?? 0.5);
    const tide = smooth(0.012, 0, Math.abs(smp(nz.lo, x * 0.5, y, 1, 120, 20) - 0.62)) * (opts.stains ?? 0.5);
    const seam = smooth(1.5, 0, Math.min(x % 128, 128 - (x % 128)));
    const hi = smp(nz.hi, x, y);
    let r = mix(br, mr, m), g = mix(bg, mg, m), b = mix(bb, mb, m);
    const yel = water * 0.5;
    r = r * (1 - yel * 0.15) - tide * 0.15; g = g * (1 - yel * 0.25) - tide * 0.17; b = b * (1 - yel * 0.55) - tide * 0.2;
    r *= 1 - seam * 0.2; g *= 1 - seam * 0.2; b *= 1 - seam * 0.2;
    o.r = r * (0.95 + hi * 0.1); o.g = g * (0.95 + hi * 0.1); o.b = b * (0.95 + hi * 0.1);
    o.h = 0.5 + m * 0.08 + (hi - 0.5) * 0.15 - seam * 0.2;
    o.ro = 0.85;
  };
}

function speckledLino(base, chip, opts = {}) {
  const [br, bg, bb] = hexRgb(base);
  const [cr, cg, cb] = hexRgb(chip);
  const nz = noise();
  const n = opts.tiles || 2;
  return (x, y, o) => {
    const t = tile(x, y, n, n, 1.6);
    const alt = opts.checker && ((t.gx + t.gy) % 2) ? 0.88 : 1;
    const w = smp(nz.white, x, y);
    const sp = w > 0.93 ? (w - 0.93) / 0.07 : 0;
    const mid = smp(nz.mid, x, y, 2, t.gx * 13, t.gy * 7);
    const wear = smooth(0.5, 0.8, smp(nz.lo, x, y, 1, 60, 0));
    const v = alt * (0.94 + mid * 0.12) * (1 - wear * 0.12);
    o.r = mix(br * v, cr, sp * 0.7); o.g = mix(bg * v, cg, sp * 0.7); o.b = mix(bb * v, cb, sp * 0.7);
    const sc = smooth(0.003, 0, Math.abs(smp(nz.mid, x, y, 3, 7, 7) - 0.5)) * 0.25;
    o.r -= sc * 0.1 + t.grout * 0.08; o.g -= sc * 0.1 + t.grout * 0.08; o.b -= sc * 0.1 + t.grout * 0.08;
    o.h = 0.5 - t.grout * 0.25 + (smp(nz.hi, x, y) - 0.5) * 0.05;
    o.ro = 0.35 + wear * 0.4 + sc * 0.5;
  };
}

function carpet(base, alt, opts = {}) {
  const [br, bg, bb] = hexRgb(base);
  const [ar, ag, ab] = hexRgb(alt);
  const nz = noise();
  return (x, y, o) => {
    const w = smp(nz.white, x, y);
    const mid = smp(nz.mid, x, y, 2, 3, 3);
    let pat = 0;
    if (opts.pattern) {
      const cx = (x % 64) - 32, cy = (y % 64) - 32;
      pat = smooth(0.1, 0.0, Math.abs(Math.abs(cx) + Math.abs(cy) - 22) / 22) * 0.8;
    }
    const wear = smooth(0.55, 0.85, smp(nz.lo, x, y, 1, 7, 70)) * 0.35;
    const v = 0.8 + w * 0.3 + (mid - 0.5) * 0.2;
    o.r = mix(br, ar, pat) * v * (1 + wear * 0.4);
    o.g = mix(bg, ag, pat) * v * (1 + wear * 0.3);
    o.b = mix(bb, ab, pat) * v * (1 + wear * 0.2);
    o.h = 0.5 + (w - 0.5) * 0.4;
    o.ro = 0.95;
  };
}

function ceilingTiles(base, opts = {}) {
  const [br, bg, bb] = hexRgb(base);
  const nz = noise();
  return (x, y, o) => {
    const t = tile(x, y, 2, 2, 5);
    const w = smp(nz.white, x, y);
    const pin = w > 0.96 ? 0.2 : 0;
    const stain = smooth(0.66, 0.8, smp(nz.lo, x, y, 1, t.gx * 70 + 5, t.gy * 30)) * (opts.stains ?? 0.6);
    const ring = smooth(0.01, 0, Math.abs(smp(nz.lo, x, y, 1, t.gx * 70 + 5, t.gy * 30) - 0.66)) * (opts.stains ?? 0.6);
    const sag = hash2(t.gx, t.gy, 4) > 0.8 ? 0.05 : 0;
    const v = 0.92 + (smp(nz.mid, x, y) - 0.5) * 0.1 - pin - sag;
    let r = br * v, g = bg * v, b = bb * v;
    r = r * (1 - stain * 0.25) - ring * 0.2; g = g * (1 - stain * 0.32) - ring * 0.22; b = b * (1 - stain * 0.5) - ring * 0.25;
    const grid = t.grout;
    o.r = mix(r, 0.62, grid); o.g = mix(g, 0.6, grid); o.b = mix(b, 0.56, grid);
    o.h = 0.5 - pin * 1.2 + grid * 0.3;
    o.ro = 0.95;
  };
}

function acoustic(base, holes, opts = {}) {
  const [br, bg, bb] = hexRgb(base);
  const nz = noise();
  return (x, y, o) => {
    const t = tile(x, y, opts.panels || 2, opts.panels || 2, 4);
    const hx = (x % 16) - 8, hy = (y % 16) - 8;
    const hole = smooth(2.6, 1.6, Math.hypot(hx, hy));
    const v = 0.9 + (smp(nz.mid, x, y) - 0.5) * 0.12 + hash2(t.gx, t.gy, 2) * 0.06;
    const stain = smooth(0.62, 0.85, smp(nz.lo, x, y, 1, 3, 1)) * 0.2;
    o.r = br * v * (1 - hole * holes) * (1 - stain); o.g = bg * v * (1 - hole * holes) * (1 - stain); o.b = bb * v * (1 - hole * holes) * (1 - stain * 1.2);
    o.r = mix(o.r, 0.15, t.grout); o.g = mix(o.g, 0.15, t.grout); o.b = mix(o.b, 0.15, t.grout);
    o.h = 0.55 - hole * 0.4 - t.grout * 0.4;
    o.ro = 0.9;
  };
}

function foamPyramids(base) {
  const [br, bg, bb] = hexRgb(base);
  const nz = noise();
  return (x, y, o) => {
    const c = 64;
    const fx = (x % c) / c - 0.5, fy = (y % c) / c - 0.5;
    const flip = (Math.floor(x / c) + Math.floor(y / c)) % 2;
    const h = flip ? 1 - Math.max(Math.abs(fx), Math.abs(fy)) * 2 : 1 - Math.abs(fx + fy) - Math.abs(fx - fy);
    const fib = smp(nz.hi, x, y, 2) * 0.5 + smp(nz.white, x, y) * 0.5;
    const v = 0.55 + h * 0.4 + (fib - 0.5) * 0.2;
    o.r = br * v; o.g = bg * v; o.b = bb * v;
    o.h = h * 0.8 + fib * 0.1;
    o.ro = 1;
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

function terrazzo() {
  const nz = noise();
  return (x, y, o) => {
    const w = smp(nz.white, x, y);
    const chipN = smp(nz.hi, x, y, 2, 31, 17);
    const chipM = smp(nz.mid, x, y, 2, 5, 9);
    let r = 0.68, g = 0.66, b = 0.62;
    if (chipN > 0.62) { const k = hash2(Math.floor(x / 6), Math.floor(y / 6), 3); r = 0.3 + k * 0.4; g = 0.28 + k * 0.35; b = 0.26 + k * 0.3; }
    if (chipM > 0.7) { r = 0.82; g = 0.8; b = 0.76; }
    if (w > 0.97) { r *= 0.6; g *= 0.6; b *= 0.6; }
    const t = tile(x, y, 1, 1, 2);
    const dirt = smooth(0.5, 0.8, smp(nz.lo, x, y, 1, 90, 90)) * 0.25;
    o.r = mix(r, 0.35, t.grout) * (1 - dirt); o.g = mix(g, 0.34, t.grout) * (1 - dirt); o.b = mix(b, 0.32, t.grout) * (1 - dirt);
    o.h = 0.5 - t.grout * 0.3;
    o.ro = 0.15 + dirt * 0.6 + (smp(nz.mid, x, y) - 0.5) * 0.08;
  };
}

function steelPlate() {
  const nz = noise();
  return (x, y, o) => {
    const c = 32;
    const gx = Math.floor(x / c), gy = Math.floor(y / c);
    const fx = (x % c) / c - 0.5, fy = (y % c) / c - 0.5;
    const ang = (gx + gy) % 2 ? 1 : -1;
    const u = fx * 0.707 + fy * 0.707 * ang, v = -fx * 0.707 * ang + fy * 0.707;
    const d = Math.hypot(u * 3.2, v * 0.9);
    const bump = smooth(0.42, 0.3, d);
    const rust = smooth(0.6, 0.85, smp(nz.lo, x, y, 1, 4, 44));
    const sc = smp(nz.hi, x, y);
    const v0 = 0.45 + sc * 0.1;
    o.r = mix(v0, 0.36, rust); o.g = mix(v0, 0.22, rust); o.b = mix(v0 * 1.02, 0.14, rust);
    o.h = 0.4 + bump * 0.5;
    o.ro = 0.4 + rust * 0.5 + sc * 0.1;
  };
}

function grassGround() {
  const nz = noise();
  return (x, y, o) => {
    const lo = smp(nz.lo, x, y, 1, 3, 3), mid = smp(nz.mid, x, y, 1, 7, 13), w = smp(nz.white, x, y);
    const mud = smooth(0.45, 0.7, lo);
    const blade = smp(nz.hi, x * 0.5, y * 3, 1, 0, 0);
    let r = mix(0.16, 0.2, blade), g = mix(0.2, 0.26, blade), b = mix(0.1, 0.12, blade);
    r = mix(r, 0.2, mud); g = mix(g, 0.16, mud); b = mix(b, 0.11, mud);
    if (w > 0.97) { r = 0.4; g = 0.38; b = 0.35; }
    const v = 0.8 + mid * 0.4;
    o.r = r * v; o.g = g * v; o.b = b * v;
    o.h = 0.5 + (blade - 0.5) * 0.3 + (w > 0.97 ? 0.3 : 0) - mud * 0.2;
    o.ro = mix(0.95, 0.4, mud * 0.8);
  };
}

function asphalt() {
  const nz = noise();
  return (x, y, o) => {
    const w = smp(nz.white, x, y), mid = smp(nz.mid, x, y), lo = smp(nz.lo, x, y, 1, 9, 9);
    const agg = w > 0.8 ? (w - 0.8) * 1.5 : 0;
    const crack = smooth(0.008, 0, Math.abs(smp(nz.lo, x, y, 2, 77, 3) - 0.5)) * smooth(0.4, 0.6, lo);
    const puddle = smooth(0.62, 0.7, lo);
    const v = 0.17 + agg * 0.25 + (mid - 0.5) * 0.06 - crack * 0.1;
    o.r = v; o.g = v; o.b = v * 1.05;
    o.h = 0.5 + agg * 0.3 - crack * 0.6;
    o.ro = mix(0.85, 0.08, puddle);
  };
}

function wireGrid() {
  return (x, y, o) => {
    const c = 32;
    const fx = x % c, fy = y % c;
    const line = Math.min(fx, c - fx) < 2.2 || Math.min(fy, c - fy) < 2.2;
    o.r = o.g = o.b = line ? 0.5 : 0;
    o.a = line ? 1 : 0;
    o.h = line ? 0.8 : 0;
    o.ro = 0.4;
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

function facade() {
  const nz = noise();
  return (x, y, o) => {
    // Precast concrete panels with rain streaks; texture v spans 2 m vertically.
    const t = tile(x, y, 2, 1, 4);
    const streak = smooth(0.55, 0.95, smp(nz.mid, x * 0.04, y * 0.5, 1, t.gx * 50, 0)) * 0.18;
    const lo = smp(nz.lo, x, y, 1, 30, 1), mid = smp(nz.mid, x, y), hi = smp(nz.hi, x, y);
    const moss = smooth(0.66, 0.82, lo) * smooth(0.3, 0.0, y / S) * 0.5;
    let v = 0.55 + lo * 0.15 + (mid - 0.5) * 0.1 - streak;
    let r = v, g = v * 0.98, b = v * 0.95;
    r = mix(r, 0.18, moss); g = mix(g, 0.22, moss); b = mix(b, 0.12, moss);
    o.r = mix(r, 0.2, t.grout); o.g = mix(g, 0.2, t.grout); o.b = mix(b, 0.2, t.grout);
    o.h = 0.5 + (hi - 0.5) * 0.3 - t.grout * 0.5 + (smp(nz.white, x, y) > 0.985 ? -0.3 : 0);
    o.ro = 0.85 - streak * 0.5;
  };
}

// Registry: key -> {fn, opts, scale (texture world size in metres)}
const DEFS = {
  greenTile: { fn: () => glazedTiles(0x5f8c74, 0xb8b4a6, 8, { cracks: true }), scale: 1.2 },
  blueTile: { fn: () => glazedTiles(0x7d97a1, 0xbdbab2, 8, { cracks: true }), scale: 1.2 },
  whiteTile: { fn: () => glazedTiles(0xd8d5cb, 0x8f8b80, 8, { cracks: true }), scale: 1.2 },
  whiteTileFloor: { fn: () => glazedTiles(0xbdbab0, 0x5a574f, 4, { cracks: true }), scale: 1.0 },
  darkTile: { fn: () => glazedTiles(0x2f3b33, 0x1e1f1b, 16), scale: 1.2 },
  paint: { fn: () => paint(0xcfc6ad, { stain: 0.35, peel: true }), scale: 2.0 },
  greyPaint: { fn: () => paint(0x8e979b, { stain: 0.3 }), scale: 2.0 },
  plaster: { fn: () => paint(0xc8bfa8, { stain: 0.25 }), scale: 2.5 },
  plasterCeil: { fn: () => paint(0xbdb7a8, { stain: 0.5 }), scale: 3.0 },
  wallpaper: { fn: () => wallpaper(0xa69a6c, 0x7c6f45, { stains: 0.6 }), scale: 1.4 },
  wallpaper2: { fn: () => wallpaper(0x3d4a3c, 0x5f6b4c, { stains: 0.4 }), scale: 1.4 },
  woodPanel: { fn: () => woodPlanks(0x6b4a2e, 0x3f2a18, 5, true), scale: 1.0 },
  darkWood: { fn: () => woodPlanks(0x3a2516, 0x1f130b, 4, true, { gloss: true }), scale: 1.0 },
  woodFloor: { fn: () => woodPlanks(0x6a4b30, 0x3b2817, 8, false, { short: true, gloss: true }), scale: 1.6 },
  terrazzo: { fn: terrazzo, scale: 1.0 },
  lino: { fn: () => speckledLino(0x9a9784, 0x3d3b33, { tiles: 2, checker: true }), scale: 0.6 },
  lino2: { fn: () => speckledLino(0x8fa39c, 0x384440, { tiles: 2 }), scale: 0.6 },
  linoDark: { fn: () => speckledLino(0x5c6566, 0x22282a, { tiles: 2, checker: true }), scale: 0.6 },
  carpet: { fn: () => carpet(0x4a2a24, 0x5e3a2a, { pattern: true }), scale: 0.6 },
  carpet2: { fn: () => carpet(0x3e4530, 0x55503a, { pattern: true }), scale: 0.6 },
  ceilTile: { fn: () => ceilingTiles(0xc9c4b4), scale: 1.2 },
  acoustic: { fn: () => acoustic(0x8f8a7d, 0.5), scale: 1.2 },
  acousticCeil: { fn: () => acoustic(0xbcb8ac, 0.4, { panels: 2 }), scale: 1.2 },
  foamPanel: { fn: () => foamPyramids(0x6c6c72), scale: 0.6 },
  foam: { fn: () => foamPyramids(0x8a8a92), scale: 0.6 },
  concrete: { fn: () => concrete(0x8a8780, { boards: true, ties: true }), scale: 2.4 },
  concretePaint: { fn: () => concrete(0xa7a59c, { seed: 50 }), scale: 2.4 },
  concreteWet: { fn: () => concrete(0x6f6d67, { wet: true, seed: 90 }), scale: 2.4, rough: true },
  polished: { fn: () => concrete(0x7d7b76, { polished: true, seed: 120 }), scale: 3.0, rough: true },
  steel: { fn: steelPlate, scale: 0.8, rough: true },
  brick: { fn: () => brick(0x6e3a28, 0x4b4740), scale: 1.2 },
  grass: { fn: grassGround, scale: 3.0, rough: true },
  asphalt: { fn: asphalt, scale: 3.0, rough: true },
  facade: { fn: facade, scale: 3.0 },
  wireGrid: { fn: wireGrid, scale: 0.5, size: 256 },
  metalGreen: { fn: () => metalPaint(0x51634f), scale: 1.0, rough: true },
  metalGrey: { fn: () => metalPaint(0x6f7477), scale: 1.0, rough: true },
  metalCream: { fn: () => metalPaint(0xb9b29a), scale: 1.0, rough: true },
  rust: { fn: () => metalPaint(0x5b3a26), scale: 1.0, rough: true },
  fabricRed: { fn: () => fabric(0x5a2a26), scale: 0.5, size: 256 },
  fabricGreen: { fn: () => fabric(0x3b4a37), scale: 0.5, size: 256 },
  fabricBeige: { fn: () => fabric(0x9b917a), scale: 0.5, size: 256 },
  fabricWhite: { fn: () => fabric(0xb8b4a8), scale: 0.5, size: 256 },
  skin: { fn: skin, scale: 0.7 },
  grime: { fn: grime, scale: 1.0, rough: true },
};

export const TEXTURE_KEYS = Object.keys(DEFS);

export function textureScale(key) { return DEFS[key]?.scale ?? 1; }

// Generate all textures asynchronously (yield between textures for the loading bar).
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
